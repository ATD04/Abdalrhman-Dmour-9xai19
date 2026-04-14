"""
Agent Service — Semantic Post-Answer Review
Runs one semantic review pass to assess support quality, contradictions,
no-answer status, and escalation recommendation.
"""
from __future__ import annotations

import logging
from typing import Any

import config
from core.llm import GeminiClient

logger = logging.getLogger("agent-service.review")

REVIEW_RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": [
        "status",
        "support_quality",
        "contradiction_risk",
        "no_answer",
        "escalation_recommended",
        "issues",
        "review_warning",
        "correction",
        "confidence_penalty",
    ],
    "properties": {
        "status": {
            "type": "string",
            "enum": ["passed", "warning", "corrected", "escalate"],
        },
        "support_quality": {
            "type": "string",
            "enum": ["strong", "moderate", "weak", "unsupported"],
        },
        "contradiction_risk": {"type": "number"},
        "no_answer": {"type": "boolean"},
        "escalation_recommended": {"type": "boolean"},
        "issues": {
            "type": "array",
            "items": {"type": "string"},
        },
        "review_warning": {"type": "string"},
        "correction": {"type": "string"},
        "confidence_penalty": {"type": "number"},
    },
    "additionalProperties": False,
}


async def score(response: dict, engine: "SemanticReviewEngine | None" = None) -> dict[str, Any]:
    """
    Async post-generation semantic review stage entrypoint.

    Args:
        response: Post-generation payload with `query`, `answer`, `chunks`/`raw_chunks`,
            `verification_issues`, and `language`.
    """
    stage_engine = engine or SemanticReviewEngine()
    chunks = response.get("chunks") or response.get("raw_chunks") or []
    mode = str(response.get("mode") or "concise").strip().lower()
    allow_llm = bool(response.get("allow_llm_semantic_review", True))
    if mode == "concise" and not bool(getattr(config, "ENABLE_LLM_SEMANTIC_REVIEW_IN_CONCISE", False)):
        allow_llm = False

    return await stage_engine.review(
        query=str(response.get("query") or ""),
        answer=str(response.get("answer") or ""),
        chunks=chunks,
        verification_issues=response.get("verification_issues") or [],
        language=str(response.get("language") or "ar"),
        use_llm=allow_llm,
    )


class SemanticReviewEngine:
    """Single-pass semantic reviewer for answer quality and escalation hints."""

    def __init__(self, llm: GeminiClient | None = None):
        self.llm = llm or GeminiClient()

    async def review(
        self,
        query: str,
        answer: str,
        chunks: list[dict],
        verification_issues: list[str],
        language: str = "ar",
        use_llm: bool = True,
    ) -> dict[str, Any]:
        evidence_excerpt = self._format_evidence(chunks)
        prompt = (
            "Assess the assistant answer using semantic meaning and evidence quality.\n"
            "Do not use keyword spotting rules.\n"
            "Return JSON with keys exactly:\n"
            "status ('passed'|'warning'|'corrected'|'escalate'),\n"
            "support_quality ('strong'|'moderate'|'weak'|'unsupported'),\n"
            "contradiction_risk (0..1),\n"
            "no_answer (boolean),\n"
            "escalation_recommended (boolean),\n"
            "issues (array of short strings),\n"
            "review_warning (string, use empty string if none),\n"
            "correction (string, use empty string if none),\n"
            "confidence_penalty (0..0.5).\n"
            "If evidence is thin, state uncertainty in warning and keep correction null unless answer is materially wrong.\n\n"
            f"Language: {language}\n"
            f"User query: {query}\n\n"
            f"Assistant answer:\n{answer}\n\n"
            f"Verification issues:\n{verification_issues or []}\n\n"
            f"Evidence excerpts:\n{evidence_excerpt}"
        )

        fallback = self._fallback_review(chunks, verification_issues)

        if not use_llm:
            return fallback

        try:
            raw = await self.llm.generate_json(
                prompt=prompt,
                system_instruction="You are a strict semantic reviewer. Output valid JSON only.",
                max_output_tokens=384,
                temperature=0.0,
            )
            return self._normalize_review(raw, fallback)
        except Exception as exc:
            logger.warning(f"Semantic review failed, using fallback: {exc}")
            return fallback

    @staticmethod
    def _to_bool(value: Any, default: bool = False) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in {"true", "1", "yes", "y"}:
                return True
            if lowered in {"false", "0", "no", "n", ""}:
                return False
        if value is None:
            return default
        return bool(value)

    def _normalize_review(self, raw: dict, fallback: dict[str, Any]) -> dict[str, Any]:
        status = str(raw.get("status", fallback["status"]))
        if status not in {"passed", "warning", "corrected", "escalate"}:
            status = fallback["status"]

        support_quality = str(raw.get("support_quality", fallback["support_quality"]))
        if support_quality not in {"strong", "moderate", "weak", "unsupported"}:
            support_quality = fallback["support_quality"]

        try:
            contradiction_risk = float(raw.get("contradiction_risk", fallback["contradiction_risk"]))
        except Exception:
            contradiction_risk = fallback["contradiction_risk"]
        contradiction_risk = max(0.0, min(1.0, contradiction_risk))

        try:
            confidence_penalty = float(raw.get("confidence_penalty", fallback["confidence_penalty"]))
        except Exception:
            confidence_penalty = fallback["confidence_penalty"]
        confidence_penalty = max(0.0, min(0.5, confidence_penalty))

        issues = raw.get("issues", [])
        if not isinstance(issues, list):
            issues = []
        issues = [str(i) for i in issues if str(i).strip()]

        review_warning = raw.get("review_warning")
        review_warning = str(review_warning).strip() if review_warning else None

        correction = raw.get("correction")
        correction = str(correction).strip() if correction else None

        no_answer = self._to_bool(raw.get("no_answer", fallback["no_answer"]), fallback["no_answer"])
        escalation_recommended = self._to_bool(
            raw.get("escalation_recommended", fallback["escalation_recommended"]),
            fallback["escalation_recommended"],
        )

        # Guardrails to reduce false-positive corrections.
        if correction and status == "passed":
            correction = None
        if support_quality in {"weak", "unsupported"} and status == "passed":
            status = "warning"
        if contradiction_risk >= 0.8 and status in {"passed", "warning"}:
            status = "corrected" if correction else "escalate"
            escalation_recommended = True
        if no_answer and status == "passed":
            status = "warning"
            escalation_recommended = True

        return {
            "status": status,
            "support_quality": support_quality,
            "contradiction_risk": contradiction_risk,
            "no_answer": no_answer,
            "escalation_recommended": escalation_recommended,
            "issues": issues,
            "review_warning": review_warning,
            "correction": correction,
            "confidence_penalty": confidence_penalty,
        }

    def _fallback_review(self, chunks: list[dict], verification_issues: list[str]) -> dict[str, Any]:
        scores = [float(c.get("score", 0.0) or 0.0) for c in chunks]
        avg_score = sum(scores) / len(scores) if scores else 0.0
        has_evidence = bool(chunks)
        has_verification_issues = bool(verification_issues)

        support_quality = "strong"
        if not has_evidence:
            support_quality = "unsupported"
        elif avg_score < 0.66:
            support_quality = "weak"
        elif avg_score < 0.75:
            support_quality = "moderate"

        contradiction_risk = 0.85 if has_verification_issues else (0.35 if support_quality == "weak" else 0.1)
        no_answer = not has_evidence
        escalation_recommended = no_answer or has_verification_issues

        status = "passed"
        if has_verification_issues:
            status = "escalate"
        elif support_quality in {"weak", "unsupported"}:
            status = "warning"

        return {
            "status": status,
            "support_quality": support_quality,
            "contradiction_risk": contradiction_risk,
            "no_answer": no_answer,
            "escalation_recommended": escalation_recommended,
            "issues": [str(i) for i in verification_issues],
            "review_warning": "Evidence support is limited; treat this as guidance." if support_quality in {"weak", "unsupported"} else None,
            "correction": None,
            "confidence_penalty": 0.18 if support_quality in {"weak", "unsupported"} else 0.0,
        }

    @staticmethod
    def _format_evidence(chunks: list[dict], max_items: int = 6, excerpt_len: int = 320) -> str:
        if not chunks:
            return "(no evidence)"

        rows: list[str] = []
        for idx, chunk in enumerate(chunks[:max_items], 1):
            text = (chunk.get("text", "") or "").strip().replace("\n", " ")
            if len(text) > excerpt_len:
                text = text[:excerpt_len] + "..."
            metadata = chunk.get("metadata", {}) or {}
            rows.append(
                f"[{idx}] score={float(chunk.get('score', 0.0) or 0.0):.3f} "
                f"source={chunk.get('source_name', 'Unknown')} page={chunk.get('page', '?')} "
                f"ministry={metadata.get('ministry_name', metadata.get('ministry_type', 'n/a'))}\n"
                f"Excerpt: {text or '(empty excerpt)'}"
            )
        return "\n\n".join(rows)
