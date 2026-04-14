"""
LangGraph compiled graph for the Unified RAG pipeline.

Two entry-points are exported:

* ``compiled_graph``        – the compiled StateGraph (for testing / introspection).
* ``run_pipeline``          – async helper that invokes the graph non-streaming.
* ``run_pipeline_stream``   – async generator that runs the graph and yields
                              SSE-compatible dicts (``{"event": ..., "data": ...}``).
"""
from __future__ import annotations

import asyncio
import logging
import time
import uuid
from typing import Any, AsyncGenerator

from langgraph.graph import END, StateGraph

from agent_graph.nodes import (
    _no_evidence_response,
    _stabilize_answer_tail,
    _error_response,
    embed_and_rewrite_node,
    escalation_check_node,
    generate_node,
    input_guardrail_node,
    intent_clarity_node,
    output_guardrail_node,
    post_generation_node,
    prepare_generation,
    retrieve_node,
    stream_generate,
    suggestions_node,
    transfer_check_node,
    workflow_match_node,
)
from agent_graph.state import RAGState

logger = logging.getLogger("agent-service.graph")


# ──────────────────────────────────────────────────────────────────────────────
#  Graph construction
# ──────────────────────────────────────────────────────────────────────────────

def _build_graph() -> StateGraph:
    """Construct (but do not compile) the RAG state graph."""
    g = StateGraph(RAGState)

    # -- Add nodes ---------------------------------------------------------
    g.add_node("input_guardrail", input_guardrail_node)
    g.add_node("intent_clarity", intent_clarity_node)
    g.add_node("transfer_check", transfer_check_node)
    g.add_node("embed_and_rewrite", embed_and_rewrite_node)
    g.add_node("workflow_match", workflow_match_node)
    g.add_node("retrieve", retrieve_node)
    g.add_node("generate", generate_node)
    g.add_node("output_guardrail", output_guardrail_node)
    g.add_node("post_generation", post_generation_node)
    g.add_node("escalation_check", escalation_check_node)
    g.add_node("suggestions", suggestions_node)

    # -- Entry point -------------------------------------------------------
    g.set_entry_point("input_guardrail")

    # -- Edges (with conditional early exits) ------------------------------
    g.add_conditional_edges(
        "input_guardrail",
        _after_input_guardrail,
        {"blocked": END, "continue": "intent_clarity"},
    )
    g.add_conditional_edges(
        "intent_clarity",
        _after_intent_clarity,
        {"greeting": END, "handoff": END, "clarification": END, "continue": "transfer_check"},
    )
    g.add_edge("transfer_check", "embed_and_rewrite")
    g.add_edge("embed_and_rewrite", "workflow_match")
    g.add_conditional_edges(
        "workflow_match",
        _after_workflow_match,
        {"answered": END, "continue": "retrieve"},
    )
    g.add_edge("retrieve", "generate")
    g.add_edge("generate", "output_guardrail")
    g.add_edge("output_guardrail", "post_generation")
    g.add_edge("post_generation", "escalation_check")
    g.add_edge("escalation_check", "suggestions")
    g.add_edge("suggestions", END)

    return g


# ──────────────────────────────────────────────────────────────────────────────
#  Conditional-edge helpers
# ──────────────────────────────────────────────────────────────────────────────

def _after_input_guardrail(state: RAGState) -> str:
    return "blocked" if state.blocked else "continue"


def _after_intent_clarity(state: RAGState) -> str:
    if state.is_greeting:
        return "greeting"
    if state.handoff_requested:
        return "handoff"
    if state.needs_clarification:
        return "clarification"
    return "continue"


def _after_workflow_match(state: RAGState) -> str:
    return "answered" if state.answered_from_workflow else "continue"


# ──────────────────────────────────────────────────────────────────────────────
#  Compile
# ──────────────────────────────────────────────────────────────────────────────
compiled_graph = _build_graph().compile()


# ──────────────────────────────────────────────────────────────────────────────
#  Public entry-points
# ──────────────────────────────────────────────────────────────────────────────

async def run_pipeline(request_dict: dict) -> RAGState:
    """Run the full graph synchronously (non-streaming) and return final state."""
    initial = RAGState(
        query=request_dict["query"],
        user_type=request_dict.get("user_type", "citizen"),
        language=request_dict.get("language", "ar"),
        mode=request_dict.get("mode", "concise"),
        session_id=request_dict.get("session_id", ""),
        response_id=request_dict.get("response_id") or str(uuid.uuid4()),
        user_id=request_dict.get("user_id"),
        sector_hint=request_dict.get("sector_hint"),
        agent_id=request_dict.get("agent_id"),
        conversation_history=request_dict.get("conversation_history", []),
        t_total_start=time.time(),
    )
    result = await compiled_graph.ainvoke(initial)
    return result


async def run_pipeline_stream(request_dict: dict) -> AsyncGenerator[dict[str, Any], None]:
    """
    Run the graph and yield SSE-compatible event dicts.

    The heavy-path generation is done via ``generate_stream_node`` for true
    token-by-token streaming.  All other nodes use the standard graph path.

    Yields dicts with keys: ``event``, ``data``.
    """
    response_id = request_dict.get("response_id") or str(uuid.uuid4())
    t_start = time.time()

    initial = RAGState(
        query=request_dict["query"],
        user_type=request_dict.get("user_type", "citizen"),
        language=request_dict.get("language", "ar"),
        mode=request_dict.get("mode", "concise"),
        session_id=request_dict.get("session_id", ""),
        response_id=response_id,
        user_id=request_dict.get("user_id"),
        sector_hint=request_dict.get("sector_hint"),
        agent_id=request_dict.get("agent_id"),
        conversation_history=request_dict.get("conversation_history", []),
        t_total_start=t_start,
    )

    # ── Phase 1: pre-generation nodes ────────────────────────────────
    state = RAGState(**vars(initial))

    # 1-a  Input guardrail
    yield _event("status", {"step": "input_guardrail", "label_en": "Checking content safety", "label_ar": "فحص سلامة المحتوى"})
    updates = await input_guardrail_node(state)
    _apply(state, updates)
    if state.blocked:
        yield _event("blocked", {
            "response_id": response_id,
            "governance_input": state.governance_input,
        })
        return

    # 1-b  Intent clarity (LLM classifier: greeting / handoff / ambiguous / clear)
    yield _event("status", {"step": "intent_clarity", "label_en": "Classifying intent", "label_ar": "تصنيف نية الاستفسار"})
    clarity_updates = await intent_clarity_node(state)
    _apply(state, clarity_updates)
    if state.is_greeting:
        yield _event("greeting", {
            "response_id": response_id,
            "text": state.greeting_response,
        })
        return
    if state.handoff_requested:
        yield _event("handoff", {"response_id": response_id})
        return
    if state.needs_clarification:
        yield _event("clarification", {
            "response_id": response_id,
            "question": state.clarification_question,
            "original_query": state.query,
        })
        return

    # 1-c  A2A Transfer check
    yield _event("status", {"step": "transfer_check", "label_en": "Checking agent routing", "label_ar": "فحص التوجيه بين الوكلاء"})
    transfer_updates = await transfer_check_node(state)
    _apply(state, transfer_updates)
    if state.transfer_occurred:
        yield _event("transfer", {
            "response_id": response_id,
            "from_agent": state.transfer_from,
            "to_agent": state.transfer_to,
            "reason": state.transfer_reason,
            "confidence": state.transfer_confidence,
        })

    # 1-d  Embed + rewrite
    yield _event("status", {"step": "embed_and_rewrite", "label_en": "Embedding and rewriting query", "label_ar": "تضمين السؤال وإعادة صياغته"})
    embed_updates = await embed_and_rewrite_node(state)
    _apply(state, embed_updates)

    # 1-e  Workflow match
    yield _event("status", {"step": "workflow_match", "label_en": "Searching previous tickets", "label_ar": "البحث في التذاكر السابقة"})
    wf_updates = await workflow_match_node(state)
    _apply(state, wf_updates)
    if state.answered_from_workflow:
        yield _event("status", {"step": "generate", "label_en": "Generating answer", "label_ar": "صياغة الإجابة"})
        answer_text = state.answered_match.get("resolution_answer", "")
        if state.language == "ar":
            attribution = "\n\n📋 *هذه الإجابة مستمدة من تذكرة سابقة تمت مراجعتها من قبل فريق الدعم المختص.*"
        else:
            attribution = "\n\n📋 *This answer is based on a previously reviewed support ticket by our experts.*"

        full_response = answer_text + attribution
        yield _event("token", {"text": full_response})

        state.answer = full_response
        state.streamed_parts = [full_response]
        state.timings["generation"] = 0.0
        yield _event("answer_done", {"response_id": response_id})

        total_ms = int((time.time() - t_start) * 1000)
        state.timings["total"] = total_ms / 1000.0

        yield _event("done", _build_final_payload(state, response_id, total_ms))
        return

    # ── Phase 2: retrieval ───────────────────────────────────────────
    yield _event("status", {"step": "retrieve", "label_en": "Retrieving evidence", "label_ar": "استرجاع الأدلة"})
    ret_updates = await retrieve_node(state)
    _apply(state, ret_updates)

    yield _event("retrieval_done", {
        "chunk_count": len(state.chunks),
        "retrieval_ms": int(state.timings.get("retrieval", 0) * 1000),
        "full_doc_fetched": state.full_doc_fetched,
        "full_doc_source_id": state.full_doc_source_id,
        "full_doc_reason": state.full_doc_reason,
    })

    # ── Phase 3: streaming generation ────────────────────────────────
    yield _event("status", {"step": "generate", "label_en": "Generating answer", "label_ar": "صياغة الإجابة"})
    gen_params = prepare_generation(state)
    if gen_params is None:
        answer = _no_evidence_response(state.language)
        yield _event("token", {"text": answer})
        state.answer = answer
        state.streamed_parts = [answer]
    else:
        streamed_parts: list[str] = []
        t_gen = time.time()
        try:
            async for chunk in stream_generate(gen_params):
                if chunk.is_thinking:
                    yield _event("thinking", {"text": chunk.text})
                else:
                    streamed_parts.append(chunk.text)
                    yield _event("token", {"text": chunk.text})
        except Exception as exc:
            logger.error("Streaming generation failed: %s", exc)
            answer = _error_response(state.language)
            yield _event("token", {"text": answer})
            state.answer = answer
            state.streamed_parts = [answer]
        else:
            raw = "".join(streamed_parts).strip()
            state.answer = _stabilize_answer_tail(raw, state.language)
            state.streamed_parts = streamed_parts
        state.timings["generation"] = round(time.time() - t_gen, 3)

    yield _event("answer_done", {"response_id": response_id})

    # ── Phase 4: output guardrail ────────────────────────────────────
    yield _event("status", {"step": "output_guardrail", "label_en": "Checking output safety", "label_ar": "فحص سلامة المخرجات"})
    og_updates = await output_guardrail_node(state)
    _apply(state, og_updates)

    # ── Phase 5: post-generation  ────────────────────────────────────
    yield _event("status", {"step": "post_generation", "label_en": "Reviewing and scoring", "label_ar": "المراجعة والتقييم"})
    pg_updates = await post_generation_node(state)
    _apply(state, pg_updates)

    # ── Phase 6: escalation check ────────────────────────────────────
    yield _event("status", {"step": "escalation_check", "label_en": "Checking escalation need", "label_ar": "فحص الحاجة للتصعيد"})
    esc_updates = await escalation_check_node(state)
    _apply(state, esc_updates)

    # ── Phase 7: suggestions ──────────────────────────────────────────
    yield _event("status", {"step": "suggestions", "label_en": "Generating suggestions", "label_ar": "توليد الاقتراحات"})
    sug_updates = await suggestions_node(state)
    _apply(state, sug_updates)

    # ── Final event ──────────────────────────────────────────────────
    total_ms = int((time.time() - t_start) * 1000)
    state.timings["total"] = total_ms / 1000.0

    yield _event("done", _build_final_payload(state, response_id, total_ms))


# ──────────────────────────────────────────────────────────────────────────────
#  Internal helpers
# ──────────────────────────────────────────────────────────────────────────────

def _apply(state: RAGState, updates: dict):
    """Merge partial dict into state object."""
    for k, v in (updates or {}).items():
        if hasattr(state, k):
            setattr(state, k, v)


def _event(event: str, data: Any) -> dict:
    return {"event": event, "data": data}


def _build_final_payload(state: RAGState, response_id: str, total_ms: int) -> dict:
    return {
        "response_id": response_id,
        "answer": state.answer,
        "language": state.language,
        "mode": state.mode,
        "citations": state.citations,
        "amendments": state.amendments,
        "review": state.review,
        "confidence": state.confidence_result,
        "escalation": _serialise_escalation(state.escalation_result),
        "escalation_confirmation_required": state.escalation_confirmation_required,
        "escalation_confirmation_reason": state.escalation_confirmation_reason,
        "governance_input": state.governance_input,
        "governance_output": state.governance_output,
        "agent_id": state.agent_id,
        "transfer": {
            "occurred": state.transfer_occurred,
            "from_agent": state.transfer_from,
            "to_agent": state.transfer_to,
            "reason": state.transfer_reason,
        } if state.transfer_occurred else None,
        "chunks_used": len(state.chunks),
        "full_doc_fetched": state.full_doc_fetched,
        "full_doc_source_id": state.full_doc_source_id,
        "full_doc_reason": state.full_doc_reason,
        "timings": state.timings,
        "total_ms": total_ms,
        "suggestions": state.suggestions,
        "query_embedding": state.query_embedding,
    }


def _serialise_escalation(esc) -> dict | None:
    if esc is None:
        return None
    if isinstance(esc, dict):
        return esc
    return {
        "should_escalate": getattr(esc, "escalated", False) or getattr(esc, "should_escalate", False),
        "escalation_type": str(getattr(esc, "escalation_type", "")),
        "reason": getattr(esc, "reason", ""),
        "confidence_score": getattr(esc, "confidence_score", None),
    }
