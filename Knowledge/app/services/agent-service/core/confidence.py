"""
Agent Service — Confidence Scoring Engine
Computes confidence from semantic evidence quality, metadata alignment,
routing certainty, and post-answer review outcome.
"""
import logging

import config
from models.schemas import Citation

logger = logging.getLogger("agent-service.confidence")


async def score(
    response: dict,
    citations: list[Citation],
    scorer: "ConfidenceScorer | None" = None,
) -> dict:
    """
    Async post-generation confidence stage entrypoint.

    Args:
        response: Post-generation payload with `chunks`/`raw_chunks`, `routed_sector`,
            `routing_confidence`, and optional `review` payload.
        citations: Citations produced by citation stage.
    """
    stage_scorer = scorer or ConfidenceScorer()
    chunks = response.get("chunks") or response.get("raw_chunks") or []
    routed_sector = str(response.get("routed_sector") or "general")
    routing_confidence = float(
        response.get(
            "pipeline_signal_confidence",
            response.get("routing_confidence", 0.5),
        )
        or 0.0
    )
    review = response.get("review")
    return stage_scorer.score(
        chunks=chunks,
        citations=citations,
        routed_sector=routed_sector,
        routing_confidence=routing_confidence,
        review=review,
    )


class ConfidenceScorer:
    WEIGHT_EVIDENCE_QUALITY = 0.45
    WEIGHT_EVIDENCE_CONCENTRATION = 0.15
    WEIGHT_METADATA_ALIGNMENT = 0.20
    WEIGHT_ROUTING_CONFIDENCE = 0.10
    WEIGHT_REVIEW_OUTCOME = 0.10

    def score(
        self,
        chunks: list[dict],
        citations: list[Citation],
        routed_sector: str,
        routing_confidence: float = 0.5,
        review: dict | None = None,
    ) -> dict:
        num_chunks = len(chunks)
        semantic_scores = [float(c.get("score", 0.0) or 0.0) for c in chunks]
        semantic_scores.sort(reverse=True)

        top_scores = semantic_scores[: min(3, len(semantic_scores))]
        avg_top_similarity = sum(top_scores) / len(top_scores) if top_scores else 0.0
        chunk_support = min(num_chunks / 4.0, 1.0)
        evidence_quality = (0.7 * avg_top_similarity) + (0.3 * chunk_support)

        concentration = self._evidence_concentration(semantic_scores)
        metadata_alignment = self._metadata_alignment(chunks, routed_sector)
        routing_confidence = max(0.0, min(1.0, float(routing_confidence or 0.0)))
        review_outcome = self._review_outcome_score(review)

        final_score = (
            self.WEIGHT_EVIDENCE_QUALITY * evidence_quality
            + self.WEIGHT_EVIDENCE_CONCENTRATION * concentration
            + self.WEIGHT_METADATA_ALIGNMENT * metadata_alignment
            + self.WEIGHT_ROUTING_CONFIDENCE * routing_confidence
            + self.WEIGHT_REVIEW_OUTCOME * review_outcome
        )

        review_penalty = float((review or {}).get("confidence_penalty", 0.0) or 0.0)
        review_penalty = max(0.0, min(0.5, review_penalty))
        final_score = max(0.0, final_score - review_penalty)

        support_quality = str((review or {}).get("support_quality", "")).strip().lower()
        if support_quality == "unsupported" or bool((review or {}).get("no_answer", False)):
            final_score = min(final_score, 0.25)
        elif support_quality == "weak":
            # Weak evidence should never surface as medium/high confidence in UI.
            final_score = min(final_score, 0.39)

        strict_scope_enabled = bool(getattr(config, "ENFORCE_STRICT_SCOPE_FILTERS", False))
        severe_mismatch = (
            strict_scope_enabled
            and routed_sector != "general"
            and metadata_alignment < 0.3
        )
        if severe_mismatch:
            final_score *= 0.65

        if num_chunks == 0:
            final_score = min(final_score, 0.25)

        final_score = max(0.0, min(1.0, round(final_score, 4)))

        breakdown = {
            "evidence_quality": round(evidence_quality, 4),
            "avg_top_similarity": round(avg_top_similarity, 4),
            "chunk_support": round(chunk_support, 4),
            "evidence_concentration": round(concentration, 4),
            "metadata_alignment": round(metadata_alignment, 4),
            "routing_confidence": round(routing_confidence, 4),
            "review_outcome": round(review_outcome, 4),
            "review_penalty": round(review_penalty, 4),
            "support_quality": support_quality or None,
            "num_chunks": num_chunks,
            "num_citations": len(citations or []),
            "routed_sector": routed_sector,
            "severe_metadata_mismatch_penalty": severe_mismatch,
        }

        logger.info(f"Confidence: {final_score} | breakdown: {breakdown}")
        return {"score": final_score, "breakdown": breakdown}

    @staticmethod
    def _evidence_concentration(scores: list[float]) -> float:
        if not scores:
            return 0.0
        top = scores[0]
        denom = sum(scores[: min(4, len(scores))])
        if denom <= 0.0:
            return 0.0
        return max(0.0, min(1.0, top / denom))

    @staticmethod
    def _metadata_alignment(chunks: list[dict], routed_sector: str) -> float:
        if not chunks:
            return 0.0

        routed = (routed_sector or "general").strip().lower()
        if routed == "general":
            return 1.0

        def _norm(value: str | None) -> str:
            return " ".join(str(value or "").strip().lower().split())

        total = 0.0
        for chunk in chunks:
            metadata = chunk.get("metadata", {}) or {}
            chunk_sector = _norm(metadata.get("sector") or metadata.get("ministry_sector"))
            chunk_ministry_type = _norm(metadata.get("ministry_type"))
            tags = {_norm(tag) for tag in (metadata.get("tags") or []) if str(tag).strip()}

            has_scope_metadata = bool(chunk_sector or chunk_ministry_type or tags)

            if chunk_sector == routed:
                total += 1.0
            elif chunk_ministry_type == routed:
                total += 0.9
            elif routed in tags:
                total += 0.8
            elif not has_scope_metadata:
                # Neutral score when metadata is sparse to avoid false severe mismatch.
                total += 0.55
            else:
                total += 0.0

        return max(0.0, min(1.0, total / len(chunks)))

    @staticmethod
    def _review_outcome_score(review: dict | None) -> float:
        if not review:
            return 0.7

        status = str(review.get("status", "warning"))
        mapping = {
            "passed": 1.0,
            "warning": 0.6,
            "corrected": 0.5,
            "escalate": 0.2,
        }
        base = mapping.get(status, 0.6)

        contradiction_risk = float(review.get("contradiction_risk", 0.0) or 0.0)
        contradiction_risk = max(0.0, min(1.0, contradiction_risk))

        return max(0.0, min(1.0, base * (1.0 - 0.45 * contradiction_risk)))
