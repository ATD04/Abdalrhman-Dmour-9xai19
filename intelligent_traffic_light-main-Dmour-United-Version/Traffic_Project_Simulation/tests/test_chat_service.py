"""Tests for chat service orchestration."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "tests"))

from test_chat_retrieval import FakeEngine  # noqa: E402


class ReadyClient:
    provider = "ollama"
    model = "gemma4:latest"

    def health(self):
        return {"ready": True, "provider": self.provider, "model": self.model, "reason": None}

    def generate_answer(self, prompt):
        assert "Evidence" in prompt or "الأدلة" in prompt
        return "northbound is heavy based on live readings."


class DownClient(ReadyClient):
    def health(self):
        return {"ready": False, "provider": self.provider, "model": self.model, "reason": "Ollama unavailable"}


def test_chat_service_returns_grounded_response_with_citations():
    from chat.service import ChatService

    service = ChatService({"llm": {"model": "gemma4:latest"}}, FakeEngine(), ollama_client=ReadyClient())
    result = service.query({"message": "Is there congestion on northbound right now?"})
    assert result["answer"]
    assert result["time_scope"] == "live"
    assert result["citations"]
    assert result["debug"]["tools_used"]
    ref = service.materialize_reference(result["citations"][0]["ref_id"])
    assert ref["structured_payload"]


def test_chat_service_unavailable_when_model_not_ready():
    from chat.service import ChatService

    service = ChatService({"llm": {"model": "gemma4:latest"}}, FakeEngine(), ollama_client=DownClient())
    result = service.query({"message": "Is there congestion on northbound right now?"})
    assert result["answer"] is None
    assert "unavailable" in result["refusal_reason"].lower()
