"""
Retrieval Adequacy — Post-retrieval sufficiency check for detailed mode.

Two-tier decision system:
  1. **LLM adequacy judge** (primary) — A fast LLM call that reads the actual
     Arabic/English chunk text and decides whether the retrieved evidence is
     sufficient or whether the full document should be fetched.  This is
     critical because Arabic embeddings produce optimistically high cosine
     similarity, so scores alone are unreliable.
  2. **Rule-based heuristics** (fallback) — Fires instantly when the LLM judge
     is disabled, times out, or errors.  Uses query intent patterns and
     source-concentration analysis.

The LLM judge is the differentiator: it can catch cases like a user asking
about "قانون الجنسية" where the embedding returns high-scoring but scattered
chunks from multiple laws — the LLM reads the text and says "this is not
about nationality law, fetch the real document."
"""

import asyncio
import json
import logging
import re
from collections import Counter
from typing import Optional

import config

logger = logging.getLogger("agent-service.retrieval_adequacy")


# ─────────────────────────────────────────────────────────────────────────────
#  TIER 1: LLM ADEQUACY JUDGE
# ─────────────────────────────────────────────────────────────────────────────

_ADEQUACY_SYSTEM = (
    "You are a retrieval quality judge for a Jordanian government policy assistant. "
    "You evaluate whether retrieved document chunks are sufficient to answer a user's "
    "query, or whether the system should fetch the full document for a comprehensive answer. "
    "Reply ONLY with valid JSON."
)


def _build_adequacy_prompt(query: str, chunks: list[dict], concentration: dict) -> str:
    """Build the LLM prompt with chunk summaries and structural metadata."""
    chunk_summaries = []
    for i, c in enumerate(chunks[:8], 1):
        text = (c.get("text", "") or "")[:300]
        source = c.get("source_name", "Unknown")
        page = c.get("page", "?")
        score = float(c.get("score", 0) or 0)
        chunk_summaries.append(
            f"  Chunk {i}: [source: {source}] [page: {page}] [score: {score:.3f}]\n"
            f"  Text preview: {text}"
        )
    chunks_text = "\n".join(chunk_summaries)

    dominant = concentration.get("dominant_source_name", "N/A")
    dom_ratio = concentration.get("dominant_ratio", 0)
    source_count = concentration.get("source_count", 0)

    return (
        f'User query: "{query}"\n\n'
        f"Retrieved {len(chunks)} chunks from {source_count} source(s).\n"
        f"Dominant source: {dominant} ({dom_ratio:.0%} of chunks)\n\n"
        f"Chunk previews:\n{chunks_text}\n\n"
        "Evaluate the retrieval quality. Consider:\n"
        "1. Do the chunks actually answer what the user is asking? (Arabic embeddings can match unrelated legal text)\n"
        "2. Is the user asking about a specific law/regulation comprehensively (e.g., all articles, summary, key points)?\n"
        "3. Are the chunks scattered fragments that would benefit from the full document context?\n"
        "4. Would having the complete document significantly improve the answer quality?\n\n"
        "Reply with this JSON:\n"
        "{\n"
        '  "adequate": true/false,          // true = chunks are sufficient, false = need full document\n'
        '  "fetch_full_doc": true/false,     // true = should fetch the entire dominant document\n'
        '  "reason": "...",                  // brief explanation (1 sentence)\n'
        '  "confidence": 0.0-1.0            // how confident you are in this decision\n'
        "}"
    )


async def llm_adequacy_judge(
    query: str,
    chunks: list[dict],
    concentration: dict,
    llm_client,
) -> dict | None:
    """Ask the LLM whether the retrieval is adequate.

    Returns the parsed JSON decision, or None on failure/timeout.
    """
    if not getattr(config, "ENABLE_LLM_ADEQUACY_JUDGE", False):
        return None

    prompt = _build_adequacy_prompt(query, chunks, concentration)
    timeout = getattr(config, "LLM_ADEQUACY_TIMEOUT_SECONDS", 3.0)

    try:
        raw = await asyncio.wait_for(
            llm_client.generate(
                prompt=prompt,
                system_instruction=_ADEQUACY_SYSTEM,
                model=config.FAST_GEMINI_MODEL,
                max_output_tokens=200,
            ),
            timeout=timeout,
        )
        raw = (raw or "").strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```\w*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw)
        result = json.loads(raw)
        logger.info(
            "LLM adequacy judge: adequate=%s fetch_full_doc=%s confidence=%.2f reason=%s",
            result.get("adequate"),
            result.get("fetch_full_doc"),
            result.get("confidence", 0),
            result.get("reason", ""),
        )
        return result
    except asyncio.TimeoutError:
        logger.debug("LLM adequacy judge timed out after %.1fs", timeout)
        return None
    except (json.JSONDecodeError, Exception) as exc:
        logger.debug("LLM adequacy judge failed: %s", exc)
        return None


# ─────────────────────────────────────────────────────────────────────────────
#  TIER 2: RULE-BASED HEURISTICS (fallback)
# ─────────────────────────────────────────────────────────────────────────────

_FULL_DOC_INTENT_AR = [
    r"اهم مواد",
    r"أهم مواد",
    r"جميع مواد",
    r"جميع بنود",
    r"كل مواد",
    r"كل بنود",
    r"كامل القانون",
    r"نص القانون",
    r"ملخص.*قانون",
    r"ملخص.*نظام",
    r"اشرح.*قانون",
    r"اشرحلي.*قانون",
    r"ما هي مواد",
    r"ما هي بنود",
    r"المواد الرئيسية",
    r"البنود الرئيسية",
    r"محتوى.*قانون",
    r"محتويات.*قانون",
    r"تلخيص.*قانون",
    r"عرض.*قانون",
    r"القانون كاملا",
    r"القانون بالكامل",
]

_FULL_DOC_INTENT_EN = [
    r"all articles",
    r"all clauses",
    r"all provisions",
    r"full (?:law|regulation|document)",
    r"entire (?:law|regulation|document)",
    r"complete (?:law|regulation|document)",
    r"summarize? the (?:law|regulation)",
    r"summary of the (?:law|regulation)",
    r"main articles",
    r"key (?:articles|provisions|clauses)",
    r"most important (?:articles|provisions|clauses)",
    r"what does the .* law (?:say|contain|include)",
    r"explain the .* law",
    r"overview of",
]

_COMPILED_INTENT_AR = [re.compile(p, re.IGNORECASE) for p in _FULL_DOC_INTENT_AR]
_COMPILED_INTENT_EN = [re.compile(p, re.IGNORECASE) for p in _FULL_DOC_INTENT_EN]


def has_full_doc_intent(query: str) -> bool:
    """Check if the query expresses intent to see a full document / all articles."""
    q = (query or "").strip()
    if not q:
        return False
    for pattern in _COMPILED_INTENT_AR:
        if pattern.search(q):
            return True
    for pattern in _COMPILED_INTENT_EN:
        if pattern.search(q):
            return True
    return False


# ─────────────────────────────────────────────────────────────────────────────
#  SHARED HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def compute_source_concentration(chunks: list[dict]) -> dict:
    """Analyze how concentrated the retrieved chunks are around specific sources."""
    if not chunks:
        return {
            "dominant_source_id": None,
            "dominant_source_name": None,
            "dominant_ratio": 0.0,
            "source_count": 0,
            "dominant_chunk_count": 0,
            "total_chunks": 0,
        }

    source_counter = Counter(c.get("source_id", "") for c in chunks)
    dominant_source_id, dominant_count = source_counter.most_common(1)[0]

    dominant_name = None
    for c in chunks:
        if c.get("source_id") == dominant_source_id:
            dominant_name = c.get("source_name")
            break

    return {
        "dominant_source_id": dominant_source_id,
        "dominant_source_name": dominant_name,
        "dominant_ratio": dominant_count / len(chunks),
        "source_count": len(source_counter),
        "dominant_chunk_count": dominant_count,
        "total_chunks": len(chunks),
    }


# ─────────────────────────────────────────────────────────────────────────────
#  MAIN ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

async def should_fetch_full_document(
    query: str,
    chunks: list[dict],
    mode: str = "detailed",
    llm_client=None,
) -> dict:
    """Decide whether to fetch the full document instead of using scattered chunks.

    Two-tier decision:
      1. LLM judge (if enabled + llm_client provided) — reads actual chunk text
      2. Rule-based fallback — intent patterns + source concentration

    Returns:
        {
            "fetch_full_doc": bool,
            "reason": str,
            "target_source_id": str | None,
            "target_source_name": str | None,
            "intent_match": bool,
            "concentration": dict,
            "judge": "llm" | "rules",
        }
    """
    result = {
        "fetch_full_doc": False,
        "reason": "not_applicable",
        "target_source_id": None,
        "target_source_name": None,
        "intent_match": False,
        "concentration": {},
        "judge": "rules",
    }

    if mode != "detailed":
        result["reason"] = "concise_mode"
        return result

    if not getattr(config, "ENABLE_FULL_DOC_RETRIEVAL", False):
        result["reason"] = "feature_disabled"
        return result

    if not chunks:
        result["reason"] = "no_chunks"
        return result

    # Compute structural signals (shared by both tiers)
    intent_match = has_full_doc_intent(query)
    concentration = compute_source_concentration(chunks)
    result["intent_match"] = intent_match
    result["concentration"] = concentration

    # ── Tier 1: LLM judge ──
    if llm_client and getattr(config, "ENABLE_LLM_ADEQUACY_JUDGE", False):
        llm_decision = await llm_adequacy_judge(query, chunks, concentration, llm_client)
        if llm_decision is not None:
            should_fetch = llm_decision.get("fetch_full_doc", False)
            if should_fetch and concentration["dominant_source_id"]:
                result["fetch_full_doc"] = True
                result["reason"] = f"llm_judge: {llm_decision.get('reason', 'full doc needed')}"
                result["target_source_id"] = concentration["dominant_source_id"]
                result["target_source_name"] = concentration["dominant_source_name"]
                result["judge"] = "llm"
                logger.info(
                    "LLM judge decided: fetch_full_doc=True source=%s confidence=%.2f",
                    concentration["dominant_source_name"],
                    llm_decision.get("confidence", 0),
                )
                return result
            elif not should_fetch:
                # LLM explicitly says chunks are adequate
                result["reason"] = f"llm_judge_adequate: {llm_decision.get('reason', 'chunks sufficient')}"
                result["judge"] = "llm"
                logger.info(
                    "LLM judge decided: adequate=True confidence=%.2f",
                    llm_decision.get("confidence", 0),
                )
                return result
        # LLM failed or timed out → fall through to rules

    # ── Tier 2: Rule-based fallback ──
    min_concentration = getattr(config, "FULL_DOC_MIN_SOURCE_CONCENTRATION", 0.5)
    min_chunks_from_source = getattr(config, "FULL_DOC_MIN_CHUNKS_FROM_SOURCE", 3)

    high_concentration = (
        concentration["dominant_ratio"] >= min_concentration
        and concentration["dominant_chunk_count"] >= min_chunks_from_source
    )

    # Decision logic:
    # 1. Intent match + any source concentration → fetch the dominant source
    # 2. Very high concentration (>=75%) even without explicit intent
    if intent_match and concentration["dominant_source_id"]:
        result["fetch_full_doc"] = True
        result["reason"] = "intent_match"
        result["target_source_id"] = concentration["dominant_source_id"]
        result["target_source_name"] = concentration["dominant_source_name"]
    elif high_concentration and concentration["dominant_ratio"] >= 0.75:
        result["fetch_full_doc"] = True
        result["reason"] = "high_concentration"
        result["target_source_id"] = concentration["dominant_source_id"]
        result["target_source_name"] = concentration["dominant_source_name"]

    if result["fetch_full_doc"]:
        logger.info(
            "Rule-based fallback triggered: reason=%s source=%s (%s) concentration=%.2f intent=%s",
            result["reason"],
            result["target_source_id"],
            result["target_source_name"],
            concentration["dominant_ratio"],
            intent_match,
        )

    return result


def merge_full_doc_chunks(
    original_chunks: list[dict],
    full_doc_chunks: list[dict],
    target_source_id: str,
    max_pages: Optional[int] = None,
) -> list[dict]:
    """Merge full document chunks with the original retrieval.

    Strategy: replace the scattered chunks from `target_source_id` with the
    full document's ordered pages. Keep chunks from other sources as
    supplementary context at the end.
    """
    effective_max = max_pages or getattr(config, "FULL_DOC_MAX_PAGES", 50)

    ordered_doc = []
    for c in full_doc_chunks[:effective_max]:
        ordered_doc.append({
            "chunk_id": c.get("chunk_id", ""),
            "source_id": target_source_id,
            "source_name": c.get("source_name", ""),
            "page": c.get("page", 0),
            "text": c.get("text", ""),
            "score": 1.0,
            "chunk_type": c.get("chunk_type", "pdf_page_text"),
            "metadata": c.get("metadata", {}),
        })

    other_chunks = [
        c for c in original_chunks
        if c.get("source_id") != target_source_id
    ]

    return ordered_doc + other_chunks
