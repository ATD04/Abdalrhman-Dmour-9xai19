"""Ollama client used by the grounded chat service."""

from __future__ import annotations

import json
from typing import Any
from urllib import error, request

from .prompts import SYSTEM_PROMPT


class OllamaClient:
    def __init__(self, config: dict[str, Any]) -> None:
        llm = config.get("llm", {}) or {}
        self.provider = str(llm.get("provider") or "ollama")
        self.enabled = bool(llm.get("enabled", True))
        self.model = str(llm.get("model") or "gemma4:latest")
        self.base_url = str(llm.get("base_url") or "http://127.0.0.1:11434").rstrip("/")
        self.timeout = float(llm.get("request_timeout_seconds", 90))
        self.temperature = float(llm.get("temperature", 0.1))
        self.num_predict = int(llm.get("num_predict", 260))

    def health(self) -> dict[str, Any]:
        if not self.enabled:
            return {"ready": False, "provider": self.provider, "model": self.model, "reason": "LLM disabled in config."}
        try:
            payload = self._get_json("/api/tags")
        except Exception as exc:  # noqa: BLE001
            return {"ready": False, "provider": self.provider, "model": self.model, "reason": f"Ollama unavailable: {exc}"}
        models = {item.get("name") for item in payload.get("models", [])}
        if self.model not in models:
            return {
                "ready": False,
                "provider": self.provider,
                "model": self.model,
                "reason": f"Model {self.model} is not installed in Ollama.",
                "available_models": sorted(model for model in models if model),
            }
        return {"ready": True, "provider": self.provider, "model": self.model, "reason": None}

    def build_chat_payload(self, prompt: str) -> dict[str, Any]:
        return {
            "model": self.model,
            "stream": False,
            "think": False,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "options": {
                "temperature": self.temperature,
                "num_predict": self.num_predict,
            },
        }

    def generate_answer(self, prompt: str) -> str:
        payload = self.build_chat_payload(prompt)
        response = self._post_json("/api/chat", payload)
        message = response.get("message", {}) or {}
        content = str(message.get("content", "")).strip()
        if not content:
            raise RuntimeError("Ollama returned an empty response.")
        return content

    def _get_json(self, path: str) -> dict[str, Any]:
        req = request.Request(self.base_url + path, method="GET")
        with request.urlopen(req, timeout=self.timeout) as response:  # noqa: S310 - local configurable endpoint
            return json.loads(response.read().decode("utf-8"))

    def _post_json(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        body = json.dumps(payload).encode("utf-8")
        req = request.Request(
            self.base_url + path,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=self.timeout) as response:  # noqa: S310 - local configurable endpoint
                return json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Ollama HTTP {exc.code}: {detail}") from exc
