"""Grounded chat orchestration for the live dashboard."""

from __future__ import annotations

import json
import uuid
from copy import deepcopy
from typing import Any

from .citations import ReferenceRegistry
from .mcp_server import LocalMCPServer
from .ollama_client import OllamaClient
from .prompts import final_answer_prompt
from .retrieval import TrafficRetrieval
from .schemas import unavailable_response, validate_chat_request


class ChatService:
    def __init__(self, config: dict[str, Any], engine: Any, ollama_client: OllamaClient | None = None) -> None:
        self.config = config
        self.engine = engine
        self.references = ReferenceRegistry()
        self.retrieval = TrafficRetrieval(engine, self.references)
        self.mcp = LocalMCPServer(self.retrieval)
        self.ollama = ollama_client or OllamaClient(config)
        self._conversations: dict[str, list[dict[str, str]]] = {}

    def health(self) -> dict[str, Any]:
        model_health = self.ollama.health()
        return {
            **model_health,
            "mcp_tools": [tool["name"] for tool in self.mcp.list_tools()],
            "mode": "hybrid_optional_cloud",
            "cloud_fallback_enabled": bool((self.config.get("llm") or {}).get("allow_cloud_fallback", False)),
        }

    def query(self, payload: dict[str, Any]) -> dict[str, Any]:
        request = validate_chat_request(payload)
        conversation_id = request["conversation_id"] or str(uuid.uuid4())
        language = request["language"]
        health = self.health()
        if not health.get("ready"):
            return unavailable_response(
                conversation_id=conversation_id,
                language=language,
                reason=health.get("reason") or "LLM is not ready.",
                model=self.ollama.model,
                provider=self.ollama.provider,
            )

        evidence = self.retrieval.collect_evidence(request["message"])
        if evidence.get("refusal_reason"):
            return {
                "conversation_id": conversation_id,
                "answer": None,
                "language": language,
                "time_scope": evidence.get("time_scope"),
                "citations": [],
                "refusal_reason": evidence["refusal_reason"],
                "debug": {
                    "tools_used": evidence.get("tools_used", []),
                    "model": self.ollama.model,
                    "provider": self.ollama.provider,
                    "model_status": "ready",
                },
            }

        prompt = final_answer_prompt(
            language,
            request["message"],
            self._evidence_json(evidence),
        )
        try:
            answer = self.ollama.generate_answer(prompt)
        except Exception as exc:  # noqa: BLE001
            return unavailable_response(
                conversation_id=conversation_id,
                language=language,
                reason=f"LLM generation failed: {exc}",
                model=self.ollama.model,
                provider=self.ollama.provider,
            )

        citations = self._dedupe_citations(evidence.get("citations", []))
        self._append_history(conversation_id, "user", request["message"])
        self._append_history(conversation_id, "assistant", answer)
        return {
            "conversation_id": conversation_id,
            "answer": answer,
            "language": language,
            "time_scope": evidence.get("time_scope"),
            "citations": citations,
            "refusal_reason": None,
            "debug": {
                "tools_used": evidence.get("tools_used", []),
                "model": self.ollama.model,
                "provider": self.ollama.provider,
                "model_status": "ready",
            },
        }

    def reset(self, conversation_id: str | None = None) -> dict[str, Any]:
        if conversation_id:
            self._conversations.pop(conversation_id, None)
        else:
            self._conversations.clear()
        return {"reset": True, "conversation_id": conversation_id}

    def materialize_reference(self, ref_id: str) -> dict[str, Any] | None:
        return self.retrieval.materialize_reference(ref_id)

    def _append_history(self, conversation_id: str, role: str, content: str) -> None:
        history = self._conversations.setdefault(conversation_id, [])
        history.append({"role": role, "content": content})
        del history[:-8]

    @staticmethod
    def _dedupe_citations(citations: list[dict[str, Any]]) -> list[dict[str, Any]]:
        seen = set()
        output = []
        for citation in citations:
            ref_id = citation.get("ref_id")
            if ref_id in seen:
                continue
            seen.add(ref_id)
            output.append(citation)
        return output

    @staticmethod
    def _evidence_json(evidence: dict[str, Any]) -> str:
        compact = {
            "time_scope": evidence.get("time_scope"),
            "tools_used": evidence.get("tools_used", []),
            "items": [],
        }
        for item in evidence.get("items", []):
            compact["items"].append({
                "tool": item.get("tool"),
                "time_scope": item.get("time_scope"),
                "data": ChatService._compact(item.get("data")),
                "citation_titles": [c.get("title") for c in item.get("citations", [])],
            })
        text = json.dumps(compact, ensure_ascii=False, sort_keys=True, default=str)
        return text[:14000]

    # Keys that add noise / reveal internal source names to the LLM
    _STRIP_KEYS = frozenset({"polyline", "traffic_segments", "data_provenance", "google_snapshot"})

    @staticmethod
    def _compact(value: Any) -> Any:
        value = deepcopy(value)
        if isinstance(value, dict):
            for key in list(value.keys()):
                if key in ChatService._STRIP_KEYS:
                    del value[key]
                    continue
                item = value[key]
                if isinstance(item, list) and len(item) > 8:
                    value[key] = item[:8]
                elif isinstance(item, dict):
                    value[key] = ChatService._compact(item)
            return value
        if isinstance(value, list) and len(value) > 8:
            return value[:8]
        return value
