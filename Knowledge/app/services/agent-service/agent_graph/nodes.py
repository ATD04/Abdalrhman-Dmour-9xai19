"""
LangGraph node implementations for the Unified RAG pipeline.
Each function receives the full RAGState and returns a partial dict
of updated fields.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import re
import time
from typing import Any, Optional

import config
from agent_graph.state import RAGState
from cache import get_redis
from client.governance_client import GovernanceClient, GovernanceUnavailableError
from client.workflow_client import WorkflowClient
from core import amendments as amendments_stage
from core import citations as citations_stage
from core import confidence as confidence_stage
from core import escalation as escalation_stage
from core import review as review_stage
from core.escalation import EscalationResult
from core.llm import GeminiClient, StreamChunk
from core.retrieval_adequacy import should_fetch_full_document, merge_full_doc_chunks
from core.tools import KnowledgeTools
from models.schemas import QueryRequest
from prompts.unified_rag_prompt import build_unified_prompt, get_unified_system_prompt

logger = logging.getLogger("agent-service.graph.nodes")

# ─── Shared singletons (initialised once at module level) ────────────────────
_llm = GeminiClient()
_tools = KnowledgeTools()
_governance_client: GovernanceClient | None = (
    GovernanceClient(config.GOVERNANCE_SERVICE_URL) if config.GOVERNANCE_ENABLED else None
)
_workflow_client: WorkflowClient | None = (
    WorkflowClient(config.WORKFLOW_SERVICE_URL) if config.WORKFLOW_ENABLED else None
)

# ─── In-process TTL caches (minor per-request dedup within a single pod) ────
_embedding_cache: dict[str, tuple[float, list[float]]] = {}
_input_guardrail_cache: dict[str, tuple[float, dict]] = {}
_output_guardrail_cache: dict[str, tuple[float, dict]] = {}
_workflow_match_cache: dict[str, tuple[float, object]] = {}

CACHE_TTL = int(getattr(config, "REQUEST_CACHE_TTL_SECONDS", 300))


def _cache_get(cache: dict, key: str, ttl: int = CACHE_TTL):
    item = cache.get(key)
    if not item:
        return None
    if time.time() - item[0] > ttl:
        cache.pop(key, None)
        return None
    return item[1]


def _cache_set(cache: dict, key: str, value):
    cache[key] = (time.time(), value)


def _normalize(query: str) -> str:
    lowered = (query or "").strip().lower()
    lowered = re.sub(r"[^\w\u0600-\u06FF\s]", " ", lowered)
    return " ".join(lowered.split())


# ──────────────────────────────────────────────────────────────────────────────
#  1. INPUT GUARDRAIL
# ──────────────────────────────────────────────────────────────────────────────
async def input_guardrail_node(state: RAGState) -> dict:
    """Check the query against governance input guardrails."""
    if not _governance_client:
        return {"governance_input": None}

    rule_only = state.mode == "concise" and config.FAST_MODE_RULE_ONLY_GUARDRAILS
    key = hashlib.sha256(
        f"{state.query}|{state.user_type}|{state.language}".encode()
    ).hexdigest()

    cached = _cache_get(_input_guardrail_cache, key)
    if cached is not None:
        passed = cached.get("passed", True)
        return {"governance_input": cached, "blocked": not passed}

    t0 = time.time()
    try:
        result = await _governance_client.check_input(
            text=state.query,
            user_type=state.user_type,
            language=state.language,
            rule_only=rule_only,
        )
        _cache_set(_input_guardrail_cache, key, result)
    except GovernanceUnavailableError:
        result = {"passed": True, "governance_available": False}

    elapsed = round(time.time() - t0, 3)
    passed = result.get("passed", True)
    return {
        "governance_input": result,
        "blocked": not passed,
        "timings": {**state.timings, "input_guardrail": elapsed},
    }


# ──────────────────────────────────────────────────────────────────────────────
#  2b. AGENT-TO-AGENT TRANSFER CHECK
# ──────────────────────────────────────────────────────────────────────────────
async def transfer_check_node(state: RAGState) -> dict:
    """Check if the query should be transferred to a different specialist agent.

    Only runs when a specific agent is selected.  Uses the A2A protocol
    to classify the query and compare against the current agent.
    """
    from core.a2a_protocol import check_transfer, get_agent_display_name

    if not state.agent_id:
        return {}

    t0 = time.time()
    decision = await check_transfer(state.query, state.agent_id, _llm)
    elapsed = round(time.time() - t0, 3)

    if decision.should_transfer:
        logger.info(
            "A2A transfer: %s → %s (conf=%.2f reason=%s)",
            decision.source_agent, decision.target_agent,
            decision.confidence, decision.reason,
        )
        return {
            "transfer_occurred": True,
            "transfer_from": decision.source_agent,
            "transfer_to": decision.target_agent,
            "transfer_reason": decision.reason,
            "transfer_confidence": decision.confidence,
            "agent_id": decision.target_agent,
            "timings": {**state.timings, "a2a_transfer": elapsed},
        }

    return {"timings": {**state.timings, "a2a_transfer": elapsed}}


# ──────────────────────────────────────────────────────────────────────────────
#  3. QUERY EMBEDDING + RETRIEVAL QUERY REWRITE
# ──────────────────────────────────────────────────────────────────────────────
async def embed_and_rewrite_node(state: RAGState) -> dict:
    """Embed the query and optionally rewrite it from conversation history."""
    timings = dict(state.timings)

    # Build retrieval query (expand with history if context-dependent)
    retrieval_query = _build_retrieval_query(state.query, state.conversation_history)

    # Embed original query
    query_embedding = await _embed_query(state.query, timings, "query_embedding")

    # Only re-embed if retrieval query is materially different
    retrieval_embedding = query_embedding
    if _normalize(retrieval_query) != _normalize(state.query):
        retrieval_embedding = await _embed_query(retrieval_query, timings, "retrieval_query_embedding")
        timings["retrieval_query_rewritten"] = 1.0

    return {
        "retrieval_query": retrieval_query,
        "query_embedding": query_embedding,
        "retrieval_embedding": retrieval_embedding,
        "timings": timings,
    }


# ──────────────────────────────────────────────────────────────────────────────
#  3b. INTENT CLARITY CHECK (heuristic fast-path + LLM fallback)
# ──────────────────────────────────────────────────────────────────────────────

# Fast-path sets: catch the obvious cases instantly (0ms) so the LLM
# call is only needed for borderline or unusual phrasings.
_GREETING_FAST = {
    "hi", "hello", "hey", "yo", "sup", "howdy", "greetings",
    "good morning", "good evening", "good afternoon", "good day",
    "thanks", "thank you", "bye", "goodbye", "see you",
    "مرحبا", "مرحبًا", "أهلا", "أهلًا", "اهلا", "السلام عليكم",
    "سلام", "صباح الخير", "مساء الخير", "شكرا", "شكرًا",
    "مع السلامة", "هلا", "هاي", "الو", "كيف الحال", "كيفك",
    "وعليكم السلام",
}

_HANDOFF_FAST = {
    "human", "operator", "specialist", "agent", "talk to someone",
    "real person", "connect me", "transfer me",
    "موظف", "بشري", "تحويل", "مختص", "أريد موظف", "كلم موظف",
}

_META_FAST = {
    "what can you do", "what do you do", "how do you work",
    "what topics", "what are your capabilities", "help me",
    "شو بتعرف تعمل", "شو بتقدر تساوي", "كيف بتشتغل",
    "ما هي قدراتك", "ما المواضيع", "ساعدني",
}

_INTENT_CLASSIFIER_SYSTEM = (
    "You are an intent classifier for Shahem, a Jordanian government policy assistant. "
    "Classify the user's message into exactly one category. Reply ONLY with valid JSON."
)


def _build_intent_classifier_prompt(query: str, language: str, has_history: bool) -> str:
    lang_name = "Arabic" if language == "ar" else "English"
    return (
        f'User message: "{query}"\n'
        f"Conversation history exists: {has_history}\n\n"
        "Classify this message into exactly ONE of these intents:\n"
        '- "greeting": casual greeting, hello, thanks, goodbye, small talk, or any non-policy chitchat\n'
        '- "handoff": user explicitly wants to talk to a human agent, specialist, or operator\n'
        '- "meta": user is asking about the bot itself — what it can do, what topics it covers, how to use it\n'
        '- "ambiguous": too vague to answer usefully — a single generic word or topic with no clear question\n'
        '- "clear": a real question or request about government policy, law, or services\n\n'
        "Rules:\n"
        "- If the user has conversation history and sends a short follow-up, classify as 'clear' (they have context)\n"
        "- Only classify as 'ambiguous' if there's truly no way to know what the user wants\n"
        "- When ambiguous, write a short friendly clarification question\n"
        "- When greeting or meta, write a warm friendly response introducing yourself as Shahem\n"
        "- For meta, briefly list the main topics you can help with: labor law, civil service, justice, civil status\n\n"
        f"Reply in {lang_name}. Use ONLY this JSON format:\n"
        '{"intent": "greeting|handoff|meta|ambiguous|clear", "response": "...friendly text or null for clear/handoff"}'
    )


def _heuristic_intent(query: str) -> str | None:
    """Fast heuristic check for obvious intents. Returns intent string or None."""
    normalized = re.sub(r"[^\w\s\u0600-\u06FF]", " ", query.lower()).strip()
    normalized = " ".join(normalized.split())
    if not normalized:
        return None
    if normalized in _GREETING_FAST:
        return "greeting"
    if normalized in _HANDOFF_FAST or any(t in normalized for t in _HANDOFF_FAST if len(t) > 4):
        return "handoff"
    if normalized in _META_FAST or any(t in normalized for t in _META_FAST if len(t) > 8):
        return "meta"
    return None


async def intent_clarity_node(state: RAGState) -> dict:
    """Hybrid intent classifier: fast heuristic for obvious cases,
    LLM fallback for ambiguous/unusual phrasings.
    """
    if not config.ENABLE_INTENT_CLARITY_CHECK:
        return {}

    query = (state.query or "").strip()
    if not query:
        return {}

    # ── Fast-path: heuristic check (0ms) ──
    fast_intent = _heuristic_intent(query)
    if fast_intent == "greeting":
        return {
            "is_greeting": True,
            "greeting_response": _greeting_response(state.language),
        }
    if fast_intent == "handoff":
        return {"handoff_requested": True}
    if fast_intent == "meta":
        return {
            "is_greeting": True,  # reuse greeting path for meta (skip RAG)
            "greeting_response": _meta_response(state.language),
        }

    # ── LLM fallback for non-obvious cases ──
    has_history = len(state.conversation_history) >= 2

    t0 = time.time()
    prompt = _build_intent_classifier_prompt(query, state.language, has_history)
    timeout_s = config.INTENT_CLARITY_TIMEOUT_MS / 1000.0

    try:
        raw = await asyncio.wait_for(
            _llm.generate(
                prompt=prompt,
                system_instruction=_INTENT_CLASSIFIER_SYSTEM,
                model=config.FAST_GEMINI_MODEL,
                max_output_tokens=200,
            ),
            timeout=timeout_s,
        )
        raw = (raw or "").strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```\w*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw)
        result = json.loads(raw)
        intent = result.get("intent", "clear")
        response_text = result.get("response")
    except (asyncio.TimeoutError, json.JSONDecodeError, Exception) as exc:
        logger.debug("Intent classifier skipped (error/timeout): %s", exc)
        # On failure, assume clear and let the pipeline continue
        return {"timings": {**state.timings, "intent_clarity": round(time.time() - t0, 3)}}

    elapsed = round(time.time() - t0, 3)
    timings = {**state.timings, "intent_clarity": elapsed}

    if intent == "greeting" or intent == "meta":
        return {
            "is_greeting": True,
            "greeting_response": str(response_text or _greeting_response(state.language)),
            "timings": timings,
        }

    if intent == "handoff":
        return {
            "handoff_requested": True,
            "timings": timings,
        }

    if intent == "ambiguous" and response_text:
        return {
            "needs_clarification": True,
            "clarification_question": str(response_text),
            "timings": timings,
        }

    return {"timings": timings}


# ──────────────────────────────────────────────────────────────────────────────
#  4. WORKFLOW ANSWERED-MATCH
# ──────────────────────────────────────────────────────────────────────────────
async def workflow_match_node(state: RAGState) -> dict:
    """Check if the query matches a previously resolved workflow ticket."""
    if not _workflow_client or not state.query_embedding:
        return {"answered_match": None, "answered_from_workflow": False}

    t0 = time.time()
    scope_user = state.user_id or state.session_id
    cache_key = hashlib.sha256(
        f"{_normalize(state.query)}|{scope_user}|{state.session_id}|{len(state.query_embedding)}".encode()
    ).hexdigest()

    cached = _cache_get(
        _workflow_match_cache, cache_key,
        ttl=config.WORKFLOW_LOOKUP_NEGATIVE_CACHE_TTL_SECONDS,
    )
    if cached is not None:
        elapsed = round(time.time() - t0, 3)
        if cached is False:
            return {"answered_match": None, "answered_from_workflow": False,
                    "timings": {**state.timings, "workflow_lookup": elapsed}}
        return {"answered_match": cached, "answered_from_workflow": bool(cached.get("resolution_answer")),
                "timings": {**state.timings, "workflow_lookup": elapsed}}

    budget_ms = config.WORKFLOW_LOOKUP_BACKGROUND_BUDGET_MS
    try:
        result = await asyncio.wait_for(
            _workflow_client.find_answered_match(
                query=state.query,
                user_id=scope_user,
                session_id=state.session_id,
                query_embedding=state.query_embedding,
            ),
            timeout=max(0.05, budget_ms / 1000.0),
        )
    except (asyncio.TimeoutError, Exception):
        result = None

    _cache_set(_workflow_match_cache, cache_key, result if result else False)
    elapsed = round(time.time() - t0, 3)
    has_answer = bool(result and result.get("resolution_answer"))
    ret = {
        "answered_match": result,
        "answered_from_workflow": has_answer,
        "timings": {**state.timings, "workflow_lookup": elapsed},
    }
    if has_answer:
        answer_text = result.get("resolution_answer", "")
        if state.language == "ar":
            attribution = "\n\n📋 *هذه الإجابة مستمدة من تذكرة سابقة تمت مراجعتها من قبل فريق الدعم المختص.*"
        else:
            attribution = "\n\n📋 *This answer is based on a previously reviewed support ticket by our experts.*"
        ret["answer"] = answer_text + attribution
    return ret


# ──────────────────────────────────────────────────────────────────────────────
#  5. KNOWLEDGE RETRIEVAL
# ──────────────────────────────────────────────────────────────────────────────
async def retrieve_node(state: RAGState) -> dict:
    """Retrieve relevant document chunks from the Knowledge Service.

    In detailed mode, performs a post-retrieval adequacy check: if the chunks
    are heavily concentrated on one source or the query expresses full-document
    intent, fetches the entire document for comprehensive context.
    """
    t0 = time.time()
    top_k = config.CONCISE_TOP_K if state.mode == "concise" else config.DETAILED_TOP_K
    ministry_name = config.AGENT_MINISTRY_MAP.get(state.agent_id or "") if state.agent_id else None
    chunks = await _tools.search_knowledge_async(
        query=state.retrieval_query or state.query,
        sector=None,
        ministry_name=ministry_name,
        user_type=state.user_type,
        doc_type=None,
        top_k=top_k,
        tags=None,
        min_score=0.0,
        query_embedding=state.retrieval_embedding or state.query_embedding,
    )
    elapsed_retrieval = round(time.time() - t0, 3)

    # ── Post-retrieval adequacy check (detailed mode only) ──
    full_doc_fetched = False
    full_doc_source_id = None
    full_doc_reason = None

    if state.mode == "detailed" and chunks:
        decision = await should_fetch_full_document(
            query=state.query,
            chunks=chunks,
            mode=state.mode,
            llm_client=_llm,
        )
        if decision["fetch_full_doc"] and decision["target_source_id"]:
            full_doc_source_id = decision["target_source_id"]
            full_doc_reason = decision["reason"]
            t_full = time.time()
            try:
                full_doc = await asyncio.wait_for(
                    _tools.client.get_source_chunks(full_doc_source_id),
                    timeout=config.FULL_DOC_FETCH_TIMEOUT_SECONDS,
                )
                full_doc_chunks_raw = full_doc.get("chunks", [])
                if full_doc_chunks_raw:
                    # Carry source_name from the original chunks
                    source_name = decision.get("target_source_name", "")
                    for fc in full_doc_chunks_raw:
                        fc["source_name"] = source_name
                    chunks = merge_full_doc_chunks(
                        original_chunks=chunks,
                        full_doc_chunks=full_doc_chunks_raw,
                        target_source_id=full_doc_source_id,
                    )
                    full_doc_fetched = True
                    logger.info(
                        "Full-doc fetch succeeded: source=%s pages=%d reason=%s elapsed=%.3fs",
                        full_doc_source_id,
                        len(full_doc_chunks_raw),
                        full_doc_reason,
                        time.time() - t_full,
                    )
            except (asyncio.TimeoutError, Exception) as exc:
                logger.warning("Full-doc fetch failed for %s: %s", full_doc_source_id, exc)

    elapsed = round(time.time() - t0, 3)
    return {
        "chunks": chunks or [],
        "full_doc_fetched": full_doc_fetched,
        "full_doc_source_id": full_doc_source_id,
        "full_doc_reason": full_doc_reason,
        "timings": {**state.timings, "retrieval": elapsed, "retrieval_search": elapsed_retrieval},
    }


# ──────────────────────────────────────────────────────────────────────────────
#  6. LLM GENERATION (streaming via callback)
# ──────────────────────────────────────────────────────────────────────────────
async def generate_node(state: RAGState) -> dict:
    """Generate the answer from evidence. Non-streaming for graph execution.
    (Streaming is handled at the API layer by iterating the graph with callbacks.)
    """
    t0 = time.time()
    if not state.chunks:
        answer = _no_evidence_response(state.language)
        return {
            "answer": answer,
            "timings": {**state.timings, "generation": 0.0},
        }

    evidence = _format_evidence(state.chunks, state.mode, full_doc_fetched=state.full_doc_fetched)
    prompt = build_unified_prompt(
        query=state.query,
        evidence=evidence,
        language=state.language,
        mode=state.mode,
        conversation_history=state.conversation_history,
        full_doc_fetched=state.full_doc_fetched,
    )
    system_prompt = get_unified_system_prompt(state.mode, full_doc_fetched=state.full_doc_fetched)
    model = config.FAST_GEMINI_MODEL if state.mode == "concise" else config.GEMINI_MODEL
    max_tokens = (
        config.CONCISE_MAX_OUTPUT_TOKENS if state.mode == "concise"
        else config.DETAILED_MAX_OUTPUT_TOKENS
    )

    try:
        answer = await _llm.generate(
            prompt=prompt,
            system_instruction=system_prompt,
            model=model,
            max_output_tokens=max_tokens,
        )
    except Exception as exc:
        logger.error("LLM generation failed: %s", exc)
        answer = _error_response(state.language)

    answer = _stabilize_answer_tail((answer or "").strip(), state.language)
    elapsed = round(time.time() - t0, 3)
    return {
        "answer": answer,
        "timings": {**state.timings, "generation": elapsed},
    }


# ──────────────────────────────────────────────────────────────────────────────
#  7. OUTPUT GUARDRAIL
# ──────────────────────────────────────────────────────────────────────────────
async def output_guardrail_node(state: RAGState) -> dict:
    """Check generated answer against governance output guardrails."""
    if not _governance_client or not config.ENABLE_V2_OUTPUT_GUARDRAIL:
        return {"governance_output": None}

    rule_only = state.mode == "concise" and config.FAST_MODE_RULE_ONLY_GUARDRAILS
    payload = json.dumps({
        "answer": state.answer, "query": state.query,
        "user_type": state.user_type, "language": state.language,
    }, ensure_ascii=False, sort_keys=True)
    key = hashlib.sha256(payload.encode()).hexdigest()

    cached = _cache_get(_output_guardrail_cache, key)
    if cached is not None:
        issues = list(state.verification_issues)
        if not cached.get("passed", True):
            issues.append("output_guardrail")
        return {"governance_output": cached, "verification_issues": issues}

    t0 = time.time()
    try:
        result = await _governance_client.check_output(
            answer=state.answer, query=state.query,
            user_type=state.user_type, language=state.language,
            rule_only=rule_only,
        )
        _cache_set(_output_guardrail_cache, key, result)
    except GovernanceUnavailableError:
        result = {"passed": True, "governance_available": False}

    elapsed = round(time.time() - t0, 3)
    issues = list(state.verification_issues)
    if not result.get("passed", True):
        issues.append("output_guardrail")
    return {
        "governance_output": result,
        "verification_issues": issues,
        "timings": {**state.timings, "output_guardrail": elapsed},
    }


# ──────────────────────────────────────────────────────────────────────────────
#  8. POST-GENERATION PIPELINE (citations, amendments, review, confidence, escalation)
# ──────────────────────────────────────────────────────────────────────────────
async def post_generation_node(state: RAGState) -> dict:
    """Run the post-generation pipeline: citations, amendments, review → confidence → escalation."""
    from core.agents.orchestrator_v2 import run_post_generation_pipeline

    pipeline_confidence = _estimate_pipeline_signal_confidence(state.chunks)
    post_gen_input = {
        "query": state.query,
        "answer": state.answer,
        "chunks": state.chunks,
        "user_type": state.user_type,
        "language": state.language,
        "mode": state.mode,
        "allow_llm_semantic_review": state.mode != "concise" or config.ENABLE_LLM_SEMANTIC_REVIEW_IN_CONCISE,
        "allow_amendment_lookup": config.ENABLE_V2_AMENDMENT_LOOKUP,
        "routed_sector": "general",
        "routing_confidence": pipeline_confidence,
        "pipeline_signal_confidence": pipeline_confidence,
        "intent": "general_inquiry",
        "wants_human_handoff": False,
        "verification_issues": state.verification_issues,
    }

    timeout = _post_gen_timeout_for_mode(state.mode)
    post_gen = await run_post_generation_pipeline(
        response=post_gen_input,
        response_id=state.response_id,
        timeout_seconds=timeout,
    )

    timings = dict(state.timings)
    timings.update({k: round(v, 3) for k, v in post_gen["timings"].items()})
    amend = post_gen["amendments"]
    timings["amendment_lookup_total"] = float(amend.get("amendment_lookup_total", 0.0))
    timings["amendment_lookup_count"] = float(amend.get("amendment_lookup_count", 0))

    return {
        "citations": post_gen["citations"],
        "amendments": post_gen["amendments"],
        "review": post_gen["review"],
        "confidence_result": post_gen["confidence"],
        "escalation_result": post_gen["escalation"],
        "timings": timings,
    }


# ──────────────────────────────────────────────────────────────────────────────
#  9. ESCALATION CHECK
# ──────────────────────────────────────────────────────────────────────────────
async def escalation_check_node(state: RAGState) -> dict:
    """Determine if escalation confirmation is required based on review + escalation results.

    Always asks the user before creating a ticket, regardless of escalation type.
    """
    review = state.review or {}
    escalation = state.escalation_result

    confirmation_required = False
    confirmation_reason: Optional[str] = None

    is_admin = str(state.user_type or "citizen").strip().lower() in {
        "admin", "system admin", "system_admin", "مسؤول النظام", "مسؤول",
        "operator", "system operator", "مشغل النظام", "مشغل"
    }

    if review.get("no_answer") and not is_admin:
        confirmation_required = True
        confirmation_reason = "no_answer"
    else:
        should_escalate = (
            escalation.get("escalated", False) or escalation.get("should_escalate", False)
            if isinstance(escalation, dict)
            else getattr(escalation, "escalated", False) or getattr(escalation, "should_escalate", False)
        ) if escalation else False

        if should_escalate and not is_admin:
            esc_type = (
                escalation.get("escalation_type", "") if isinstance(escalation, dict)
                else str(getattr(escalation, "escalation_type", "") or "")
            )
            confirmation_required = True
            confirmation_reason = esc_type or "escalation"

    logger.info(
        "[escalation_check] user_type=%s, is_admin=%s, review_no_answer=%s, should_escalate=%s -> confirmation_required=%s",
        state.user_type, is_admin, bool(review.get("no_answer")), should_escalate if 'should_escalate' in locals() else 'N/A', confirmation_required
    )

    return {
        "escalation_confirmation_required": confirmation_required,
        "escalation_confirmation_reason": confirmation_reason,
    }


# ──────────────────────────────────────────────────────────────────────────────
#  10. SUGGESTIONS (follow-up advice)
# ──────────────────────────────────────────────────────────────────────────────
async def suggestions_node(state: RAGState) -> dict:
    """Generate 2-3 follow-up question suggestions based on the query and answer."""
    if not state.answer or not state.query:
        return {"suggestions": []}

    lang_name = "Arabic" if state.language == "ar" else "English"
    answer_snippet = (state.answer or "")[:300]

    suggestions_prompt = (
        f"A user asked a Jordanian government policy assistant:\n"
        f"Query: {state.query}\n"
        f"Answer (excerpt): {answer_snippet}\n\n"
        f"Suggest 2-3 short, natural follow-up questions the user might find helpful. "
        f"Write them in {lang_name}. Keep each under 60 characters. "
        f"Reply ONLY with a JSON array of strings, e.g. [\"...\", \"...\"]"
    )

    t0 = time.time()
    try:
        raw = await asyncio.wait_for(
            _llm.generate(
                prompt=suggestions_prompt,
                system_instruction="You generate helpful follow-up question suggestions. Reply only with a JSON array.",
                model=config.FAST_GEMINI_MODEL,
                max_output_tokens=200,
            ),
            timeout=1.5,
        )
        raw = (raw or "").strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```\w*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw)
        suggestions = json.loads(raw)
        if not isinstance(suggestions, list):
            suggestions = []
        suggestions = [str(s).strip() for s in suggestions[:3] if s]
    except (asyncio.TimeoutError, json.JSONDecodeError, Exception) as exc:
        logger.debug("Suggestions generation skipped: %s", exc)
        suggestions = []

    elapsed = round(time.time() - t0, 3)
    return {
        "suggestions": suggestions,
        "timings": {**state.timings, "suggestions": elapsed},
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Streaming-specific generation helpers (for /query/stream endpoint)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def prepare_generation(state: RAGState) -> dict | None:
    """Build the LLM call parameters from state.
    Returns None when there are no chunks (caller should use the no-evidence fallback).
    """
    if not state.chunks:
        return None

    evidence = _format_evidence(state.chunks, state.mode, full_doc_fetched=state.full_doc_fetched)
    prompt = build_unified_prompt(
        query=state.query,
        evidence=evidence,
        language=state.language,
        mode=state.mode,
        conversation_history=state.conversation_history,
        full_doc_fetched=state.full_doc_fetched,
    )
    system_prompt = get_unified_system_prompt(state.mode, full_doc_fetched=state.full_doc_fetched)
    model = config.FAST_GEMINI_MODEL if state.mode == "concise" else config.GEMINI_MODEL
    max_tokens = (
        config.CONCISE_MAX_OUTPUT_TOKENS if state.mode == "concise"
        else config.DETAILED_MAX_OUTPUT_TOKENS
    )
    return {
        "prompt": prompt,
        "system_instruction": system_prompt,
        "model": model,
        "max_output_tokens": max_tokens,
    }


async def stream_generate(params: dict):
    """True async generator — yields StreamChunk objects as they arrive from the LLM."""
    async for chunk in _llm.generate_stream(
        prompt=params["prompt"],
        system_instruction=params["system_instruction"],
        model=params["model"],
        max_output_tokens=params["max_output_tokens"],
    ):
        if chunk.text:
            yield chunk


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  HELPER FUNCTIONS (migrated from unified_rag.py)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def _embed_query(query: str, timings: dict, timing_key: str) -> list[float]:
    normalized = _normalize(query)
    if not normalized:
        timings[timing_key] = 0.0
        return []
    key = hashlib.sha256(normalized.encode()).hexdigest()
    cached = _cache_get(_embedding_cache, key)
    if cached is not None:
        timings[timing_key] = 0.0
        return cached
    t0 = time.time()
    try:
        embedding = await _llm.embed(normalized)
        _cache_set(_embedding_cache, key, embedding)
    except Exception as exc:
        logger.warning("Query embedding failed: %s", exc)
        embedding = []
    timings[timing_key] = round(time.time() - t0, 3)
    return embedding


def _build_retrieval_query(query: str, conversation_history: list[dict]) -> str:
    base = (query or "").strip()
    if not base:
        return ""
    if not _is_context_dependent(base):
        return base
    prev = _last_user_query(conversation_history, base)
    if not prev:
        return base
    return f"{prev}\n{base}".strip()


def _is_context_dependent(query: str) -> bool:
    normalized = re.sub(r"[^\w\s\u0600-\u06FF]", " ", (query or "").strip().lower())
    normalized = " ".join(normalized.split())
    if not normalized:
        return False
    if len(normalized) <= 24:
        return True
    generic = {
        "ما اهم البنود", "ما أهم البنود", "اهم البنود", "أهم البنود",
        "what are the key points", "key points", "main points",
        "the main clauses", "those clauses", "these clauses",
        "details", "التفاصيل",
    }
    return normalized in {m.lower() for m in generic}


def _last_user_query(history: list[dict], current: str) -> Optional[str]:
    norm_cur = " ".join((current or "").strip().lower().split())
    for msg in reversed(history or []):
        if str(msg.get("role", "")).strip().lower() != "user":
            continue
        content = str(msg.get("content") or "").strip()
        if not content:
            continue
        if " ".join(content.lower().split()) == norm_cur:
            continue
        return content[:240]
    return None


def _format_evidence(chunks: list[dict], mode: str = "concise", full_doc_fetched: bool = False) -> str:
    if not chunks:
        return "No information retrieved."
    if full_doc_fetched:
        # Full document mode: no truncation, pages in order
        limit = 0
    else:
        limit = 1600 if mode == "detailed" else 750
    parts = []
    for idx, chunk in enumerate(chunks, 1):
        metadata = chunk.get("metadata", {}) or {}
        text = (chunk.get("text", "") or "").strip()
        if limit and len(text) > limit:
            text = text[:limit] + "..."
        parts.append(
            f"-- Source {idx} (score: {float(chunk.get('score', 0.0) or 0.0):.3f}) --\n"
            f"Document: {chunk.get('source_name', 'Unknown')}\n"
            f"Source ID: {chunk.get('source_id', 'N/A')}\n"
            f"Page: {chunk.get('page', '?')} | Year: {metadata.get('document_year', 'N/A')}\n"
            f"Ministry: {metadata.get('ministry_name', metadata.get('ministry_type', 'N/A'))}\n"
            f"Content:\n{text}"
        )
    return "\n\n".join(parts)


def _stabilize_answer_tail(answer: str, language: str) -> str:
    text = (answer or "").strip()
    if not text:
        return text
    if text[-1] in {",", ":", ";", "،", "؛"}:
        text = text[:-1].rstrip()
    if not text:
        return answer.strip()
    if text[-1] in {".", "؟", "!", "…", "]", "}", "'", '"'}:
        return text
    return f"{text}."


def _no_evidence_response(language: str) -> str:
    if language == "ar":
        return "لم أتمكن من العثور على معلومات كافية حول هذا الموضوع في قاعدة المعرفة الحالية. هل يمكنك إعادة صياغة سؤالك أو تحديد الجانب الذي تريد الاستفسار عنه بشكل أدق؟ سأبذل قصارى جهدي لمساعدتك."
    return "I wasn't able to find enough information on this topic in the current knowledge base. Could you try rephrasing your question or specifying which aspect you'd like to know more about? I'll do my best to help."


def _greeting_response(language: str) -> str:
    if language == "ar":
        return (
            "أهلاً وسهلاً! أنا شهم، مساعدك للسياسات الحكومية الأردنية. "
            "كيف يمكنني مساعدتك اليوم؟ يمكنك سؤالي عن أي قانون أو إجراء أو خدمة حكومية."
        )
    return (
        "Hello! I'm Shahem, your Jordanian government policy assistant. "
        "How can I help you today? Feel free to ask me about any law, procedure, or government service."
    )


def _meta_response(language: str) -> str:
    if language == "ar":
        return (
            "أنا شهم، مساعدك المتخصص في السياسات الحكومية الأردنية. يمكنني مساعدتك في:\n\n"
            "• قانون العمل والعقود والأجور وتصاريح العمل\n"
            "• ديوان الخدمة المدنية والرواتب والترقيات والتقاعد\n"
            "• وزارة العدل والإجراءات القضائية وقانون الأسرة\n"
            "• الأحوال المدنية والهوية الوطنية وشهادات الميلاد والزواج\n\n"
            "اسألني أي سؤال يتعلق بهذه المواضيع وسأبذل قصارى جهدي لمساعدتك!"
        )
    return (
        "I'm Shahem, your specialist in Jordanian government policies. I can help you with:\n\n"
        "• Labor law — contracts, wages, work permits, social security\n"
        "• Civil service — government employment, salaries, promotions, retirement\n"
        "• Justice — courts, legal procedures, family law, arbitration\n"
        "• Civil status — national ID, birth/death certificates, marriage, nationality\n\n"
        "Ask me anything about these topics and I'll do my best to help!"
    )


def _error_response(language: str) -> str:
    if language == "ar":
        return "عذرًا، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى بعد قليل."
    return "Sorry, something went wrong while processing your request. Please try again in a moment."


def _estimate_pipeline_signal_confidence(chunks: list[dict]) -> float:
    if not chunks:
        return 0.0
    scores = sorted((float(c.get("score", 0.0) or 0.0) for c in chunks), reverse=True)
    top_scores = scores[:min(3, len(scores))]
    mean_top = sum(top_scores) / len(top_scores) if top_scores else 0.0
    max_score = scores[0] if scores else 0.0
    denom = sum(scores[:min(4, len(scores))])
    concentration = (max_score / denom) if denom > 0 else 0.0
    signal = (0.5 * mean_top) + (0.25 * max_score) + (0.25 * concentration)
    return max(0.0, min(1.0, round(signal, 4)))


def _post_gen_timeout_for_mode(mode: str) -> float:
    fallback = float(getattr(config, "POST_GEN_TIMEOUT_SECONDS", 3.0) or 3.0)
    if mode == "detailed":
        return float(getattr(config, "POST_GEN_TIMEOUT_DETAILED_SECONDS", fallback) or fallback)
    return float(getattr(config, "POST_GEN_TIMEOUT_CONCISE_SECONDS", fallback) or fallback)


# ── Expose singletons for startup/shutdown ────────────────────────────────────
def get_governance_client() -> GovernanceClient | None:
    return _governance_client


def get_workflow_client() -> WorkflowClient | None:
    return _workflow_client


def get_llm() -> GeminiClient:
    return _llm
