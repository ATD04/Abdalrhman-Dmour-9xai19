"""HTTP integration tests for chat endpoints."""

from __future__ import annotations

import json
import sys
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib import request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "tests"))

from test_chat_retrieval import FakeEngine  # noqa: E402
from test_chat_service import ReadyClient  # noqa: E402


def _post_json(url: str, payload: dict) -> dict:
    req = request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with request.urlopen(req, timeout=5) as response:  # noqa: S310 - local test server
        return json.loads(response.read().decode("utf-8"))


def _get_json(url: str) -> dict:
    with request.urlopen(url, timeout=5) as response:  # noqa: S310 - local test server
        return json.loads(response.read().decode("utf-8"))


def test_chat_http_endpoints_round_trip():
    from chat.service import ChatService
    from core.start_live_simulation import LiveHandler

    engine = FakeEngine()
    chat_service = ChatService({"llm": {"model": "gemma4:latest"}}, engine, ollama_client=ReadyClient())

    def handler(*args, **kwargs):
        return LiveHandler(*args, engine=engine, chat_service=chat_service, **kwargs)

    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        health = _get_json(base + "/api/chat/health")
        assert health["ready"] is True

        response = _post_json(base + "/api/chat/query", {"message": "Is there congestion on northbound right now?"})
        assert response["answer"]
        assert response["citations"]

        ref = _get_json(base + f"/api/chat/reference/{response['citations'][0]['ref_id']}")
        assert ref["structured_payload"]

        reset = _post_json(base + "/api/chat/reset", {"conversation_id": response["conversation_id"]})
        assert reset["reset"] is True

        legacy = _post_json(base + "/api/assistant/query", {"query": "What is the current signal state?"})
        assert legacy["confidence"] is not None or legacy["cannot_answer_reason"] is not None
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
