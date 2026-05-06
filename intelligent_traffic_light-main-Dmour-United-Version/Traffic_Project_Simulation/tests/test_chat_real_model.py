"""Real local-model tests for the grounded chat service.

These tests use the installed Ollama model from config. They skip only when the
local Ollama runtime or required model is unavailable.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "tests"))

from test_chat_retrieval import FakeEngine  # noqa: E402


def _service_or_skip():
    from chat.ollama_client import OllamaClient
    from chat.service import ChatService

    config = {
        "llm": {
            "provider": "ollama",
            "enabled": True,
            "model": "gemma4:latest",
            "base_url": "http://127.0.0.1:11434",
            "request_timeout_seconds": 120,
            "temperature": 0.1,
            "num_predict": 140,
        }
    }
    client = OllamaClient(config)
    health = client.health()
    if not health.get("ready"):
        pytest.skip(health.get("reason") or "Ollama model unavailable")
    return ChatService(config, FakeEngine(), ollama_client=client)


@pytest.mark.parametrize(
    ("message", "expected_scope"),
    [
        ("شو وضع الازدحام في جهة الشمال الآن؟", "live"),
        ("What is the current signal phase?", "live"),
        ("What is the average queue on northbound over the last 5 minutes?", "live"),
        ("What are the historical peak hours for northbound?", "historical"),
        ("Show me historical incidents for northbound.", "historical"),
        ("Show historical signal phase history for phase 1.", "historical"),
        ("Compare current northbound congestion with historical peak hours.", "mixed"),
    ],
)
def test_real_ollama_chat_answers_with_citations(message, expected_scope):
    service = _service_or_skip()
    result = service.query({"message": message})
    assert result["answer"], result
    assert result["time_scope"] == expected_scope
    assert result["citations"], result
    for citation in result["citations"]:
        assert service.materialize_reference(citation["ref_id"]) is not None


def test_real_ollama_chat_refuses_out_of_scope_question():
    service = _service_or_skip()
    result = service.query({"message": "What is traffic in Irbid right now?"})
    assert result["answer"] is None
    assert result["refusal_reason"]
    assert result["citations"] == []
