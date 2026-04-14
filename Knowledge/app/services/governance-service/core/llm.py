"""
Governance Service — Gemini LLM Client
Wraps Gemini API with retry logic, JSON extraction, and structured output.
Copied from agent-service with governance-specific logging.
"""
import json
import time
import logging
from google import genai
from config import GEMINI_API_KEY, GEMINI_MODEL

logger = logging.getLogger("governance-service.llm")


class GeminiClient:
    """Shared Gemini LLM client for governance service components."""

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

    async def generate(self, prompt: str, system_instruction: str = None,
                       max_retries: int = 3, max_output_tokens: int = None) -> str:
        """Generate a text response from Gemini."""
        for attempt in range(max_retries):
            try:
                kwargs = {
                    "model": self.model,
                    "contents": prompt,
                }
                config_kwargs = {}
                if system_instruction:
                    config_kwargs["system_instruction"] = system_instruction
                if max_output_tokens:
                    config_kwargs["max_output_tokens"] = max_output_tokens
                if config_kwargs:
                    kwargs["config"] = genai.types.GenerateContentConfig(**config_kwargs)

                response = self.client.models.generate_content(**kwargs)
                return response.text.strip()
            except Exception as e:
                logger.warning(f"LLM generate attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
                else:
                    raise

    async def generate_json(self, prompt: str, system_instruction: str = None,
                            max_retries: int = 3) -> dict:
        """Generate a JSON response from Gemini. Strips markdown fences and parses."""
        text = await self.generate(prompt, system_instruction, max_retries)

        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM JSON response: {e}\nRaw: {text[:500]}")
            raise ValueError(f"LLM returned invalid JSON: {e}")
