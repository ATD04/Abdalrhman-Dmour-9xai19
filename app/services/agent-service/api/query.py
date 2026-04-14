"""
/query endpoint — thin HTTP adapter.
Uses LangGraph-based pipeline (agent_graph) for all intelligence.
This module owns only:
  - response_id / session_id assignment
  - pending no-answer escalation confirmation flow (Redis-backed)
  - session load / save
  - response cache population (Redis-backed via api.confidence)
  - background audit log dispatch
  - SSE event formatting
"""

import json
import logging
import re
import time
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Request, HTTPException
from fastapi.responses import StreamingResponse

import config
from agent_graph.graph import run_pipeline_stream
from agent_graph.nodes import get_governance_client
from api.confidence import cache_response
from models.schemas import QueryRequest
from session_manager import get_session, save_session
from cache import get_redis


def check_rate_limit(ip: str, limit: int = 30, window: int = 60) -> bool:
    r = get_redis()
    if not r:
        return True
    try:
        key = f"ratelimit:{ip}"
        count = r.incr(key)
        if count == 1:
            r.expire(key, window)
        return count <= limit
    except Exception:
        return True


logger = logging.getLogger("agent-service.query")
router = APIRouter(tags=["query"])

# ─── Redis-backed pending escalation helpers ──────────────────────────────────
_ESCALATION_PREFIX = "esc_pending:"
_ESCALATION_TTL = 600  # 10 minutes
_CLARIFICATION_PREFIX = "clar_pending:"
_CLARIFICATION_TTL = 300  # 5 minutes


def _get_pending_escalation(session_id: str) -> dict | None:
    r = get_redis()
    if not r:
        logger.warning("[escalation] Redis unavailable — cannot retrieve pending escalation for %s", session_id)
        return None
    try:
        raw = r.get(f"{_ESCALATION_PREFIX}{session_id}")
        if raw:
            logger.info("[escalation] Found pending escalation for session %s", session_id)
            return json.loads(raw)
        else:
            logger.debug("[escalation] No pending escalation for session %s", session_id)
    except Exception as exc:
        logger.error("[escalation] Failed to retrieve pending escalation for %s: %s", session_id, exc)
    return None


def _set_pending_escalation(session_id: str, data: dict) -> None:
    r = get_redis()
    if not r:
        logger.warning("[escalation] Redis unavailable — cannot store pending escalation for %s", session_id)
        return
    try:
        r.setex(
            f"{_ESCALATION_PREFIX}{session_id}",
            _ESCALATION_TTL,
            json.dumps(data, ensure_ascii=False, default=str),
        )
        logger.info("[escalation] Stored pending escalation for session %s (reason=%s)", session_id, data.get('escalation_reason'))
    except Exception as exc:
        logger.error("[escalation] Failed to store pending escalation for %s: %s", session_id, exc)


def _clear_pending_escalation(session_id: str) -> None:
    r = get_redis()
    if not r:
        return
    try:
        r.delete(f"{_ESCALATION_PREFIX}{session_id}")
        logger.info("[escalation] Cleared pending escalation for session %s", session_id)
    except Exception as exc:
        logger.error("[escalation] Failed to clear pending escalation for %s: %s", session_id, exc)


# ─── Redis-backed pending clarification helpers ──────────────────────────────

def _get_pending_clarification(session_id: str) -> dict | None:
    r = get_redis()
    if not r:
        return None
    try:
        raw = r.get(f"{_CLARIFICATION_PREFIX}{session_id}")
        return json.loads(raw) if raw else None
    except Exception:
        return None


def _set_pending_clarification(session_id: str, data: dict) -> None:
    r = get_redis()
    if not r:
        return
    try:
        r.setex(
            f"{_CLARIFICATION_PREFIX}{session_id}",
            _CLARIFICATION_TTL,
            json.dumps(data, ensure_ascii=False, default=str),
        )
    except Exception as exc:
        logger.error("[clarification] Failed to store pending clarification for %s: %s", session_id, exc)


def _clear_pending_clarification(session_id: str) -> None:
    r = get_redis()
    if not r:
        return
    try:
        r.delete(f"{_CLARIFICATION_PREFIX}{session_id}")
    except Exception:
        pass


@router.post("/query", deprecated=True)
async def handle_query(http_req: Request, request: QueryRequest):
    """Non-stream mode is disabled. Use /query/stream for concise and detailed requests."""
    client_ip = http_req.client.host if http_req.client else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    raise HTTPException(
        status_code=410,
        detail={
            "message": "Non-stream mode is disabled. Use /query/stream with mode=concise or mode=detailed.",
            "supported_modes": ["concise", "detailed"],
            "supported_delivery": "stream",
            "stream_endpoint": "/query/stream",
        },
    )


@router.post("/query/stream")
async def handle_query_stream(http_req: Request, request: QueryRequest, background_tasks: BackgroundTasks):
    """Streaming version of /query endpoint using Server-Sent Events (SSE)."""
    client_ip = http_req.client.host if http_req.client else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    response_id = str(uuid.uuid4())[:8]
    session_id = request.session_id or str(uuid.uuid4())[:12]

    async def event_generator():
        logger.info("[query] New stream request: user_type=%s, language=%s, session_id=%s", request.user_type, request.language, session_id)
        audit_dispatched = False

        def dispatch_audit_once(final_data: dict[str, Any]):
            nonlocal audit_dispatched
            if audit_dispatched:
                return
            _queue_audit_log(
                background_tasks=background_tasks,
                request=request,
                session_id=session_id,
                response_id=response_id,
                final_data=final_data,
            )
            audit_dispatched = True

        try:
            t_total = time.time()

            yield (
                "event: metadata\n"
                f"data: {json.dumps({'session_id': session_id, 'response_id': response_id}, ensure_ascii=False)}\n\n"
            )

            # ── Pending escalation confirmation flow ──────────────────
            pending_case = _get_pending_escalation(session_id)
            if pending_case:
                normalized = request.query.strip().lower()
                if _is_confirmation_yes(normalized):
                    if request.user_type == "guest":
                        msg = _signup_required_for_escalation_message(request.language)
                        complete_payload = {
                            "confidence": 0.0,
                            "escalated": False,
                            "escalation_reason": "signup_required",
                            "escalation_confirmation_required": False,
                            "sector": "general",
                            "agent_used": "system",
                            "answer": msg,
                            "timings": {"total": round(time.time() - t_total, 3)},
                        }
                        yield f"event: chunk\ndata: {json.dumps({'text': msg}, ensure_ascii=False)}\n\n"
                        yield f"event: complete\ndata: {json.dumps(complete_payload, ensure_ascii=False)}\n\n"
                        dispatch_audit_once(complete_payload)
                        return

                    from client.workflow_client import WorkflowClient
                    wf_client = WorkflowClient(config.WORKFLOW_SERVICE_URL) if config.WORKFLOW_ENABLED else None
                    created_case = None
                    if wf_client:
                        try:
                            created_case = await wf_client.create_case(pending_case)
                        finally:
                            await wf_client.close()
                    ticket_created = bool(created_case)
                    _clear_pending_escalation(session_id)

                    msg = (
                        _ticket_created_message(request.language)
                        if ticket_created
                        else _ticket_create_failed_message(request.language)
                    )
                    confirmed_reason = (
                        f"{pending_case.get('escalation_reason', 'manual_review')}_confirmed"
                        if ticket_created
                        else "ticket_creation_failed"
                    )
                    complete_payload = {
                        "confidence": 0.0,
                        "escalated": ticket_created,
                        "escalation_reason": confirmed_reason,
                        "sector": pending_case.get("sector_primary") or "general",
                        "agent_used": "workflow" if ticket_created else "system",
                        "answer": msg,
                        "timings": {"total": round(time.time() - t_total, 3)},
                    }
                    yield f"event: chunk\ndata: {json.dumps({'text': msg}, ensure_ascii=False)}\n\n"
                    yield f"event: complete\ndata: {json.dumps(complete_payload, ensure_ascii=False)}\n\n"
                    dispatch_audit_once(complete_payload)
                    return

                if _is_confirmation_no(normalized):
                    declined_reason = f"{pending_case.get('escalation_reason', 'manual_review')}_declined"
                    _clear_pending_escalation(session_id)
                    msg = _ticket_declined_message(request.language)
                    complete_payload = {
                        "confidence": 0.0,
                        "escalated": False,
                        "escalation_reason": declined_reason,
                        "sector": pending_case.get("sector_primary") or "general",
                        "agent_used": "system",
                        "answer": msg,
                        "timings": {"total": round(time.time() - t_total, 3)},
                    }
                    yield f"event: chunk\ndata: {json.dumps({'text': msg}, ensure_ascii=False)}\n\n"
                    yield f"event: complete\ndata: {json.dumps(complete_payload, ensure_ascii=False)}\n\n"
                    dispatch_audit_once(complete_payload)
                    return

            # ── Load session history ──────────────────────────────────
            session_state = get_session(session_id) if session_id else None
            conversation_history = session_state.get("history", []) if session_state else []

            # ── Pending clarification flow ───────────────────────────
            pending_clar = _get_pending_clarification(session_id)
            if pending_clar:
                _clear_pending_clarification(session_id)
                # User's reply is the clarified query — run the full pipeline with it

            # ── Run LangGraph pipeline (streaming) ────────────────────
            answer_chunks: list[str] = []
            final_data: dict[str, Any] = {}

            request_dict = {
                "query": request.query,
                "user_type": request.user_type,
                "language": request.language,
                "mode": request.mode,
                "session_id": session_id,
                "response_id": response_id,
                "user_id": request.user_id,
                "sector_hint": request.sector_hint,
                "agent_id": request.agent_id,
                "conversation_history": conversation_history,
            }

            async for evt in run_pipeline_stream(request_dict):
                event_type = evt.get("event", "")
                data = evt.get("data", {})

                if event_type == "blocked":
                    blocked_msg = "Your query was blocked by content policy."
                    governance = data.get("governance_input") or {}
                    if governance.get("message"):
                        blocked_msg = governance["message"]
                    complete_payload = {
                        "confidence": 0.0,
                        "escalated": False,
                        "escalation_reason": "input_guardrail",
                        "sector": "general",
                        "agent_used": "guardrail",
                        "answer": blocked_msg,
                        "timings": {"total": round(time.time() - t_total, 3)},
                    }
                    yield f"event: chunk\ndata: {json.dumps({'text': blocked_msg}, ensure_ascii=False)}\n\n"
                    yield f"event: complete\ndata: {json.dumps(complete_payload, ensure_ascii=False)}\n\n"
                    dispatch_audit_once(complete_payload)
                    return

                elif event_type == "handoff":
                    handoff_msg = _handoff_message(request.language)
                    complete_payload = {
                        "confidence": 0.0,
                        "escalated": True,
                        "escalation_reason": "human_handoff",
                        "sector": "general",
                        "agent_used": "handoff",
                        "answer": handoff_msg,
                        "escalation_confirmation_required": True,
                        "timings": {"total": round(time.time() - t_total, 3)},
                    }
                    _set_pending_escalation(session_id, {
                        "request_id": response_id,
                        "session_id": session_id,
                        "user_id": request.user_id or session_id,
                        "query": request.query,
                        "user_type": request.user_type,
                        "sector_primary": "general",
                        "sector_labels": ["general"],
                        "priority": "high",
                        "escalation_reason": "human_handoff",
                        "confidence": 0.0,
                        "source_response_id": response_id,
                        "query_embedding": final_data.get("query_embedding") if 'final_data' in locals() else None,
                    })
                    yield f"event: chunk\ndata: {json.dumps({'text': handoff_msg}, ensure_ascii=False)}\n\n"
                    yield f"event: complete\ndata: {json.dumps(complete_payload, ensure_ascii=False)}\n\n"
                    dispatch_audit_once(complete_payload)
                    return

                elif event_type == "workflow_answer":
                    match = data.get("answered_match") or {}
                    wf_answer = match.get("resolution_answer", "")
                    complete_payload = {
                        "confidence": 1.0,
                        "escalated": False,
                        "sector": "general",
                        "agent_used": "workflow_match",
                        "answer": wf_answer,
                        "timings": {"total": round(time.time() - t_total, 3)},
                    }
                    yield f"event: chunk\ndata: {json.dumps({'text': wf_answer}, ensure_ascii=False)}\n\n"
                    yield f"event: complete\ndata: {json.dumps(complete_payload, ensure_ascii=False)}\n\n"
                    dispatch_audit_once(complete_payload)
                    return

                elif event_type == "transfer":
                    yield f"event: transfer\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

                elif event_type == "greeting":
                    greeting_text = data.get("text", "")
                    complete_payload = {
                        "response_id": response_id,
                        "answer": greeting_text,
                        "confidence": 1.0,
                        "escalated": False,
                        "sector": "general",
                        "agent_used": "greeting",
                        "timings": {"total": round(time.time() - t_total, 3)},
                    }
                    yield f"event: chunk\ndata: {json.dumps({'text': greeting_text}, ensure_ascii=False)}\n\n"
                    yield f"event: complete\ndata: {json.dumps(complete_payload, ensure_ascii=False)}\n\n"
                    dispatch_audit_once(complete_payload)
                    return

                elif event_type == "clarification":
                    question = data.get("question", "")
                    original_query = data.get("original_query", request.query)
                    # Store pending clarification in Redis
                    _set_pending_clarification(session_id, {
                        "original_query": original_query,
                        "session_id": session_id,
                    })
                    # Emit the clarification question as a chunk + dedicated event
                    yield f"event: chunk\ndata: {json.dumps({'text': question}, ensure_ascii=False)}\n\n"
                    clarification_payload = {
                        "response_id": response_id,
                        "answer": question,
                        "confidence": 0.0,
                        "escalated": False,
                        "sector": "general",
                        "agent_used": "intent_clarity",
                        "clarification_requested": True,
                        "original_query": original_query,
                        "timings": {"total": round(time.time() - t_total, 3)},
                    }
                    dispatch_audit_once(clarification_payload)
                    yield f"event: complete\ndata: {json.dumps(clarification_payload, ensure_ascii=False)}\n\n"
                    return

                elif event_type == "token":
                    text = data.get("text", "")
                    if text:
                        answer_chunks.append(text)
                        yield f"event: chunk\ndata: {json.dumps({'text': text}, ensure_ascii=False)}\n\n"

                elif event_type == "thinking":
                    text = data.get("text", "")
                    if text:
                        yield f"event: thinking\ndata: {json.dumps({'text': text}, ensure_ascii=False)}\n\n"

                elif event_type == "status":
                    yield f"event: status\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

                elif event_type == "done":
                    final_data = data

            # ── Post-stream: build complete event ─────────────────────
            if not final_data:
                final_data = {"answer": "".join(answer_chunks), "timings": {}}

            answer_text = str(final_data.get("answer") or "").strip() or "".join(answer_chunks)
            final_data["answer"] = answer_text
            timings = dict(final_data.get("timings") or {})
            timings["total"] = round(time.time() - t_total, 3)
            final_data["timings"] = timings

            # Escalation confirmation
            if session_id and final_data.get("escalation_confirmation_required"):
                confirmation_reason = final_data.get("escalation_confirmation_reason") or "no_answer"
                _set_pending_escalation(session_id, {
                    "request_id": response_id,
                    "session_id": session_id,
                    "user_id": request.user_id or session_id,
                    "query": request.query,
                    "user_type": request.user_type,
                    "sector_primary": "general",
                    "sector_labels": ["general"],
                    "priority": "high",
                    "escalation_reason": confirmation_reason,
                    "confidence": final_data.get("confidence", {}).get("score"),
                    "source_response_id": response_id,
                    "query_embedding": final_data.get("query_embedding"),
                })

            # Session save
            if session_id and not final_data.get("escalation_confirmation_required"):
                if not session_state:
                    session_state = get_session(session_id)
                session_state["user_type"] = request.user_type
                session_state["history"].append({"role": "user", "content": request.query})
                session_state["history"].append({"role": "assistant", "content": answer_text})
                if len(session_state["history"]) > 10:
                    session_state["history"] = session_state["history"][-10:]
                save_session(session_id, session_state)

            # Redis response cache
            cache_response(response_id, {
                "confidence": final_data.get("confidence", {}),
                "review": final_data.get("review", {}),
                "amendments": final_data.get("amendments", {}),
                "verification_issues": final_data.get("verification_issues", []),
            })

            # Emit citations
            citations = final_data.get("citations") or []
            if citations:
                for citation in citations:
                    cit_data = citation if isinstance(citation, dict) else citation.dict() if hasattr(citation, "dict") else {}
                    yield f"event: citation\ndata: {json.dumps(cit_data, ensure_ascii=False, default=str)}\n\n"

            # Emit suggestions
            suggestions = final_data.get("suggestions") or []
            if suggestions:
                yield f"event: suggestions\ndata: {json.dumps({'suggestions': suggestions}, ensure_ascii=False)}\n\n"

            # Build complete payload for SSE
            _review = final_data.get("review") or {}
            _confidence_score = float((final_data.get("confidence") or {}).get("score", 0.0) or 0.0)
            _wants_escalation = bool((final_data.get("escalation") or {}).get("should_escalate", False))
            _needs_confirmation = bool(final_data.get("escalation_confirmation_required", False))
            complete_payload = {
                "response_id": response_id,
                "answer": answer_text,
                "confidence": _confidence_score,
                "final_confidence": _confidence_score,
                "confidence_breakdown": (final_data.get("confidence") or {}).get("breakdown", {}),
                "escalated": _wants_escalation and not _needs_confirmation,
                "escalation_reason": str((final_data.get("escalation") or {}).get("escalation_type", "") or ""),
                "escalation_confirmation_required": _needs_confirmation,
                "escalation_confirmation_reason": final_data.get("escalation_confirmation_reason"),
                "has_amendments": bool((final_data.get("amendments") or {}).get("has_amendments", False)),
                "amendment_note": (final_data.get("amendments") or {}).get("amendment_note"),
                "sector": "general",
                "agent_used": final_data.get("agent_id") or "langgraph_rag",
                "path": "langgraph_rag",
                "transfer": final_data.get("transfer"),
                "review": _review,
                "review_status": _review.get("status"),
                "review_issues": _review.get("issues", []),
                "citations": [c if isinstance(c, dict) else (c.dict() if hasattr(c, "dict") else {}) for c in (final_data.get("citations") or [])],
                "chunks_used": final_data.get("chunks_used", 0),
                "timings": timings,
                "suggestions": final_data.get("suggestions", []),
            }
            dispatch_audit_once(complete_payload)
            yield f"event: complete\ndata: {json.dumps(complete_payload, ensure_ascii=False, default=str)}\n\n"

        except Exception as exc:
            logger.error(f"[{response_id}] Streaming error: {exc}", exc_info=True)
            yield f"event: error\ndata: {json.dumps({'error': str(exc)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _is_confirmation_yes(text: str) -> bool:
    normalized = _normalize_confirmation_text(text)
    yes_tokens = {
        "نعم",
        "اي",
        "ايوه",
        "أيوه",
        "موافق",
        "تمام",
        "أكيد",
        "اكيد",
        "حسنا",
        "حسنًا",
        "ok",
        "okay",
        "yes",
        "y",
        "sure",
        "confirm",
    }
    if normalized in yes_tokens:
        return True
    first_token = normalized.split(" ", 1)[0] if normalized else ""
    return first_token in yes_tokens


def _is_confirmation_no(text: str) -> bool:
    normalized = _normalize_confirmation_text(text)
    no_tokens = {
        "لا",
        "كلا",
        "مش",
        "لا شكرا",
        "لا شكرًا",
        "مو",
        "رفض",
        "إلغاء",
        "الغاء",
        "no",
        "n",
        "nope",
        "cancel",
    }
    if normalized in no_tokens:
        return True
    first_token = normalized.split(" ", 1)[0] if normalized else ""
    return first_token in no_tokens


def _normalize_confirmation_text(text: str) -> str:
    normalized = re.sub(r"[^\w\s\u0600-\u06FF]", " ", (text or "").strip().lower())
    return " ".join(normalized.split())


def _ticket_created_message(language: str) -> str:
    if language == "ar":
        return "تم إنشاء تذكرة وتحويل طلبك إلى موظف مختص."
    return "A ticket has been created and your request was escalated to a specialist."


def _ticket_declined_message(language: str) -> str:
    if language == "ar":
        return "تم إلغاء التصعيد. يمكنك متابعة الأسئلة بشكل طبيعي في أي وقت."
    return "Escalation was canceled. You can continue asking questions normally anytime."


def _ticket_create_failed_message(language: str) -> str:
    if language == "ar":
        return "تم تأكيد التصعيد، لكن تعذر إنشاء التذكرة حالياً. حاول مرة أخرى بعد قليل."
    return "Escalation was confirmed, but ticket creation failed right now. Please try again shortly."


def _signup_required_for_escalation_message(language: str) -> str:
    if language == "ar":
        return "لإنشاء تذكرة تصعيد، يرجى تسجيل الدخول أو إنشاء حساب أولاً. سيتم الاحتفاظ بمحادثتك الحالية."
    return "To create an escalation ticket, please sign in or create an account first. Your current chat will be kept."


def _handoff_message(language: str) -> str:
    if language == "ar":
        return "هل تريد تحويلك إلى موظف مختص؟ أجب بـ \"نعم\" للتأكيد أو \"لا\" للإلغاء."
    return 'Would you like to be connected to a specialist? Reply "yes" to confirm or "no" to cancel.'


def _queue_audit_log(
    background_tasks: BackgroundTasks,
    request: QueryRequest,
    session_id: str,
    response_id: str,
    final_data: dict[str, Any],
):
    governance_client = get_governance_client()
    if governance_client is None:
        return

    entry = _build_audit_entry(
        request=request,
        session_id=session_id,
        response_id=response_id,
        final_data=final_data,
    )
    background_tasks.add_task(governance_client.log_audit, entry)


def _build_audit_entry(
    request: QueryRequest,
    session_id: str,
    response_id: str,
    final_data: dict[str, Any],
) -> dict[str, Any]:
    timings = dict(final_data.get("timings") or {})
    review_issues = [str(x) for x in (final_data.get("review_issues") or [])]
    escalation_reason = str(final_data.get("escalation_reason") or "")
    input_blocked = "input_guardrail" in review_issues or escalation_reason.startswith("input_guardrail")
    output_blocked = "output_guardrail" in review_issues

    citations = final_data.get("citations") or []
    confidence = _safe_float(final_data.get("confidence"))

    retrieval_seconds = _first_number(
        timings,
        [
            "workflow_lookup",
            "retrieve_total",
            "search_knowledge",
            "search_knowledge_async",
        ],
    )

    return {
        "request_id": response_id,
        "session_id": session_id,
        "query": request.query,
        "user_type": request.user_type,
        "intent": None,
        "sector": final_data.get("sector") or request.sector_hint or "general",
        "agent_used": final_data.get("agent_used") or "unknown",
        "answer": (final_data.get("answer") or "")[:4000],
        "confidence": confidence,
        "has_amendments": bool(final_data.get("has_amendments", False)),
        "escalated": bool(final_data.get("escalated", False)),
        "escalation_reason": final_data.get("escalation_reason"),
        "input_passed": not input_blocked,
        "input_category": "input_guardrail" if input_blocked else None,
        "input_reason": escalation_reason if input_blocked else None,
        "output_passed": not output_blocked,
        "output_category": "output_guardrail" if output_blocked else None,
        "output_reason": "output blocked or flagged in review" if output_blocked else None,
        "total_latency_ms": _safe_float(timings.get("total"), scale=1000.0),
        "routing_latency_ms": _safe_float(timings.get("route"), scale=1000.0),
        "retrieval_latency_ms": retrieval_seconds * 1000.0 if retrieval_seconds is not None else None,
        "generation_latency_ms": _safe_float(timings.get("agent_process"), scale=1000.0),
        "citations_count": len(citations) if isinstance(citations, list) else 0,
        "chunks_used": int(final_data.get("chunks_used") or 0),
    }


def _safe_float(value: Any, scale: float = 1.0) -> float | None:
    if value is None:
        return None
    try:
        return float(value) * scale
    except Exception:
        return None


def _first_number(values: dict[str, Any], keys: list[str]) -> float | None:
    for key in keys:
        if key not in values:
            continue
        as_float = _safe_float(values.get(key))
        if as_float is not None:
            return as_float
    return None
