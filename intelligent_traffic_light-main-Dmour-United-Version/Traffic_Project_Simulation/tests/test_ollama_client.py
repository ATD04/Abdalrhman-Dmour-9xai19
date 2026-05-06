"""Tests for the Ollama chat client."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))


def test_ollama_payload_uses_configured_model():
    from chat.ollama_client import OllamaClient

    client = OllamaClient({"llm": {"model": "gemma4:latest", "temperature": 0.1}})
    payload = client.build_chat_payload("hello")
    assert payload["model"] == "gemma4:latest"
    assert payload["messages"][0]["role"] == "system"
    assert payload["messages"][1]["content"] == "hello"


def test_ollama_health_detects_model(monkeypatch):
    from chat.ollama_client import OllamaClient

    class DummyResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self):
            return json.dumps({"models": [{"name": "gemma4:latest"}]}).encode("utf-8")

    monkeypatch.setattr("chat.ollama_client.request.urlopen", lambda req, timeout=0: DummyResponse())
    health = OllamaClient({"llm": {"model": "gemma4:latest"}}).health()
    assert health["ready"] is True


def test_ollama_generate_answer_parses_message(monkeypatch):
    from chat.ollama_client import OllamaClient

    class DummyResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self):
            return json.dumps({"message": {"content": "Grounded answer"}}).encode("utf-8")

    monkeypatch.setattr("chat.ollama_client.request.urlopen", lambda req, timeout=0: DummyResponse())
    answer = OllamaClient({"llm": {"model": "gemma4:latest"}}).generate_answer("prompt")
    assert answer == "Grounded answer"
