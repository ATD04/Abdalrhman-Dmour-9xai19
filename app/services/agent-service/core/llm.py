"""
Agent Service — Gemini LLM Client
Wraps Gemini API with retry logic, JSON extraction, and structured output.
"""
import asyncio
import json
import re
import logging
from dataclasses import dataclass
from typing import Any
from google import genai


@dataclass
class StreamChunk:
    """A single chunk from the Gemini streaming response."""
    text: str
    is_thinking: bool = False


from config import (
    GEMINI_API_KEY,
    GEMINI_MODEL,
    EMBEDDING_MODEL,
    EMBEDDING_DIMENSIONS,
    CONCISE_MAX_OUTPUT_TOKENS,
    DETAILED_MAX_OUTPUT_TOKENS,
)

logger = logging.getLogger("agent-service.llm")


class GeminiClient:
    """Shared Gemini LLM client for all agent service components."""

    def __init__(self):
        self._client = None
        self.model = GEMINI_MODEL

    @property
    def client(self):
        """Lazy-initialize the Gemini client (defers API key validation to first use)."""
        if self._client is None:
            if not GEMINI_API_KEY:
                raise ValueError(
                    "GEMINI_API_KEY is not set. Add it to your .env file."
                )
            self._client = genai.Client(api_key=GEMINI_API_KEY)
        return self._client

    @staticmethod
    def _resolved_thinking_budget(max_output_tokens: int | None) -> int | None:
        """
        Control thinking token allocation so it doesn't starve the visible output.

        - Concise mode (<=768 tokens):  thinking=0 (deterministic, no thinking)
        - Detailed mode (>768 tokens):  cap thinking at 25% of budget so the model
          has at least 75% left for the actual answer.  Without a cap, the model
          can burn most of the 16K budget on hidden thoughts and cut off mid-sentence.
        """
        if not max_output_tokens:
            return None
        if int(max_output_tokens) <= int(CONCISE_MAX_OUTPUT_TOKENS):
            return 0
        # Detailed / full-doc mode: cap thinking at 25% of output budget
        return int(max_output_tokens * 0.25)

    async def generate(self, prompt: str, system_instruction: str = None,
                       max_retries: int = 3, max_output_tokens: int = None,
                       model: str = None) -> str:
        """
        Generate a text response from Gemini.

        Args:
            prompt: The user/task prompt.
            system_instruction: Optional system instruction for the model.
            max_retries: Number of retry attempts with exponential backoff.
            max_output_tokens: Optional limit on output length.

        Returns:
            Generated text response.
        """
        for attempt in range(max_retries):
            try:
                kwargs = {
                    "model": model or self.model,
                    "contents": prompt,
                }
                config_kwargs = {}
                if system_instruction:
                    config_kwargs["system_instruction"] = system_instruction
                if max_output_tokens is not None and max_output_tokens > 0:
                    config_kwargs["max_output_tokens"] = max_output_tokens
                    thinking_budget = self._resolved_thinking_budget(max_output_tokens)
                    if thinking_budget is not None:
                        config_kwargs["thinking_config"] = genai.types.ThinkingConfig(
                            thinking_budget=thinking_budget,
                            include_thoughts=thinking_budget > 0,
                        )
                if config_kwargs:
                    kwargs["config"] = genai.types.GenerateContentConfig(**config_kwargs)

                response = await asyncio.to_thread(
                    self.client.models.generate_content,
                    **kwargs,
                )
                return response.text.strip()
            except Exception as e:
                logger.warning(f"LLM generate attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
                else:
                    raise

    async def generate_stream(self, prompt: str, system_instruction: str = None,
                              max_output_tokens: int = None, model: str = None):
        """
        Generate a streaming text response from Gemini.
        Yields StreamChunk objects as they become available, distinguishing
        thinking tokens (is_thinking=True) from answer tokens.

        Yields:
            StreamChunk objects with text and is_thinking flag.
        """
        kwargs = {
            "model": model or self.model,
            "contents": prompt,
        }
        config_kwargs = {}
        if system_instruction:
            config_kwargs["system_instruction"] = system_instruction
        if max_output_tokens is not None and max_output_tokens > 0:
            config_kwargs["max_output_tokens"] = max_output_tokens
            thinking_budget = self._resolved_thinking_budget(max_output_tokens)
            if thinking_budget is not None:
                config_kwargs["thinking_config"] = genai.types.ThinkingConfig(
                    thinking_budget=thinking_budget,
                    include_thoughts=thinking_budget > 0,
                )
        if config_kwargs:
            kwargs["config"] = genai.types.GenerateContentConfig(**config_kwargs)

        # Use a queue to communicate between the sync iterator thread and async generator
        queue = asyncio.Queue()
        loop = asyncio.get_event_loop()

        def stream_to_queue():
            """Run the synchronous streaming in a thread and put chunks in queue."""
            try:
                response = self.client.models.generate_content_stream(**kwargs)
                final_finish_reason = None
                final_usage = None
                for chunk in response:
                    # Extract parts with thinking/answer distinction
                    candidates = getattr(chunk, "candidates", None) or []
                    if candidates:
                        content = getattr(candidates[0], "content", None)
                        parts = getattr(content, "parts", None) or [] if content else []
                        for part in parts:
                            part_text = getattr(part, "text", None) or ""
                            if not part_text:
                                continue
                            is_thought = bool(getattr(part, "thought", False))
                            loop.call_soon_threadsafe(
                                queue.put_nowait,
                                StreamChunk(text=part_text, is_thinking=is_thought),
                            )

                        finish_reason = getattr(candidates[0], "finish_reason", None)
                        if finish_reason is not None:
                            final_finish_reason = str(finish_reason)

                    usage = getattr(chunk, "usage_metadata", None)
                    if usage is not None:
                        final_usage = {
                            "prompt_token_count": getattr(usage, "prompt_token_count", None),
                            "candidates_token_count": getattr(usage, "candidates_token_count", None),
                            "total_token_count": getattr(usage, "total_token_count", None),
                            "thoughts_token_count": getattr(usage, "thoughts_token_count", None),
                        }

                if final_finish_reason:
                    logger.info(
                        "LLM stream finished: model=%s reason=%s max_output_tokens=%s usage=%s",
                        kwargs.get("model"),
                        final_finish_reason,
                        max_output_tokens,
                        final_usage,
                    )
                    if "MAX_TOKENS" in final_finish_reason:
                        logger.warning(
                            "LLM stream ended due to max tokens: model=%s max_output_tokens=%s usage=%s",
                            kwargs.get("model"),
                            max_output_tokens,
                            final_usage,
                        )
                # Signal completion
                loop.call_soon_threadsafe(queue.put_nowait, None)
            except Exception as e:
                logger.error(f"LLM streaming failed in thread: {e}")
                loop.call_soon_threadsafe(queue.put_nowait, e)

        # Start the streaming in a background thread
        thread_future = loop.run_in_executor(None, stream_to_queue)

        # Yield chunks as they arrive
        try:
            while True:
                chunk = await queue.get()
                if chunk is None:
                    # Streaming complete
                    break
                if isinstance(chunk, Exception):
                    raise chunk
                yield chunk
        finally:
            # Ensure the thread completes
            await thread_future

    async def generate_json(self, prompt: str, system_instruction: str = None,
                            max_retries: int = 3, model: str = None,
                            max_output_tokens: int = None,
                            temperature: float | None = None,
                            response_schema: dict[str, Any] | None = None,
                            strict_schema: bool = False,
                            retry_on_parse_error: bool = True,
                            retry_backoff_seconds: float = 1.0) -> dict:
        """
        Generate a JSON response from Gemini.
        Strips markdown code fences and parses the result.

        Args:
            prompt: The user/task prompt.
            system_instruction: Optional system instruction for the model.
            max_retries: Number of retry attempts.

        Returns:
            Parsed JSON dict.
        """
        text = ""
        for attempt in range(max_retries):
            try:
                kwargs = {
                    "model": model or self.model,
                    "contents": prompt,
                }
                config_kwargs = {"response_mime_type": "application/json"}
                if system_instruction:
                    config_kwargs["system_instruction"] = system_instruction
                if max_output_tokens:
                    config_kwargs["max_output_tokens"] = max_output_tokens
                if temperature is not None:
                    config_kwargs["temperature"] = float(temperature)
                if response_schema:
                    config_kwargs["response_schema"] = response_schema
                kwargs["config"] = genai.types.GenerateContentConfig(**config_kwargs)

                response = await asyncio.to_thread(
                    self.client.models.generate_content,
                    **kwargs,
                )
                text = (response.text or "").strip()

                # Strip markdown code fences if present
                if text.startswith("```"):
                    text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

                parsed: dict[str, Any] | None = None

                # First-pass direct parse
                try:
                    parsed = json.loads(text)
                except json.JSONDecodeError:
                    parsed = None

                if parsed is None:
                    # Recovery: extract first plausible JSON object substring
                    match = re.search(r"\{[\s\S]*\}", text)
                    if match:
                        parsed = json.loads(match.group(0))

                if parsed is None:
                    raise ValueError(f"LLM returned invalid JSON: {text[:300]}")

                if strict_schema:
                    self._validate_json_schema(parsed, response_schema)

                return parsed
            except Exception as e:
                logger.warning(f"LLM generate_json attempt {attempt + 1} failed: {e}")
                parse_failure = isinstance(e, (ValueError, json.JSONDecodeError))
                should_retry = attempt < max_retries - 1 and (retry_on_parse_error or not parse_failure)
                if should_retry:
                    if retry_backoff_seconds > 0:
                        await asyncio.sleep(retry_backoff_seconds * (2 ** attempt))
                else:
                    logger.error(f"Failed to parse LLM JSON response. Raw: {(text if 'text' in locals() else '')[:500]}")
                    raise ValueError(f"LLM returned invalid JSON: {e}")

    def _validate_json_schema(self, payload: Any, schema: dict[str, Any] | None) -> None:
        if not schema:
            return

        def _matches_type(value: Any, expected_type: str) -> bool:
            if expected_type == "object":
                return isinstance(value, dict)
            if expected_type == "array":
                return isinstance(value, list)
            if expected_type == "string":
                return isinstance(value, str)
            if expected_type == "boolean":
                return isinstance(value, bool)
            if expected_type == "number":
                return isinstance(value, (int, float)) and not isinstance(value, bool)
            if expected_type == "integer":
                return isinstance(value, int) and not isinstance(value, bool)
            if expected_type == "null":
                return value is None
            return True

        schema_type = schema.get("type")
        allowed_types = schema_type if isinstance(schema_type, list) else [schema_type] if schema_type else []
        if allowed_types and not any(_matches_type(payload, t) for t in allowed_types):
            raise ValueError(
                f"Schema validation failed: expected type {allowed_types}, got {type(payload).__name__}"
            )

        enum_vals = schema.get("enum")
        if enum_vals and payload not in enum_vals:
            raise ValueError(f"Schema validation failed: value '{payload}' not in enum {enum_vals}")

        if isinstance(payload, dict):
            required = schema.get("required", [])
            for key in required:
                if key not in payload:
                    raise ValueError(f"Schema validation failed: missing required field '{key}'")

            properties = schema.get("properties", {})
            additional_allowed = schema.get("additionalProperties", True)
            for key, value in payload.items():
                if key not in properties:
                    if not additional_allowed:
                        raise ValueError(f"Schema validation failed: unexpected field '{key}'")
                    continue
                self._validate_json_schema(value, properties[key])
            return

        if isinstance(payload, list):
            item_schema = schema.get("items")
            if item_schema:
                for idx, item in enumerate(payload):
                    try:
                        self._validate_json_schema(item, item_schema)
                    except ValueError as exc:
                        raise ValueError(f"Schema validation failed in item[{idx}]: {exc}") from exc

    async def embed(self, text: str, model: str = None, dimensions: int = None) -> list[float]:
        """Generate a semantic embedding for a text query."""
        content = (text or "").strip()
        if not content:
            return []

        kwargs = {
            "model": model or EMBEDDING_MODEL,
            "contents": content,
            "config": {"output_dimensionality": int(dimensions or EMBEDDING_DIMENSIONS)},
        }

        try:
            response = await asyncio.to_thread(
                self.client.models.embed_content,
                **kwargs,
            )
        except TypeError:
            # Backward-compatible fallback for SDKs without config support.
            response = await asyncio.to_thread(
                self.client.models.embed_content,
                model=model or EMBEDDING_MODEL,
                contents=content,
            )
        return list(response.embeddings[0].values)
