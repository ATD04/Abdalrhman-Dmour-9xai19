"""
Agent Service — Escalation Engine
Uses semantic routing and post-answer review signals for escalation decisions.
"""
import logging
from dataclasses import dataclass
from typing import Optional

import config

logger = logging.getLogger("agent-service.escalation")


async def evaluate(
    response: dict,
    confidence_result: dict,
    engine: "EscalationEngine | None" = None,
) -> "EscalationResult":
    """
    Async post-generation escalation stage entrypoint.

    Args:
        response: Post-generation payload with semantic intent/review flags.
        confidence_result: Output from confidence stage with a numeric `score`.
    """
    stage_engine = engine or EscalationEngine()
    confidence_score = float((confidence_result or {}).get("score", 0.0) or 0.0)
    user_type = str(response.get("user_type", "citizen") or "citizen").strip().lower()
    return stage_engine.check(
        intent=str(response.get("intent") or "general_inquiry"),
        confidence=confidence_score,
        wants_human_handoff=bool(response.get("wants_human_handoff", False)),
        review=response.get("review"),
        user_type=user_type,
    )


@dataclass
class EscalationResult:
    escalated: bool = False
    reason: Optional[str] = None
    escalation_type: Optional[str] = None  # handoff_request, low_confidence, out_of_scope, contradiction, no_answer


class EscalationEngine:
    def __init__(self, confidence_threshold: float | None = None):
        self.threshold = confidence_threshold or config.CONFIDENCE_THRESHOLD

    def check(
        self,
        intent: str,
        confidence: float,
        wants_human_handoff: bool = False,
        review: dict | None = None,
        user_type: str = "citizen",
    ) -> EscalationResult:
        if wants_human_handoff:
            logger.info("Escalation: semantic router detected human handoff request")
            return EscalationResult(
                escalated=True,
                reason="طلب المستخدم التحويل إلى موظف مختص.",
                escalation_type="handoff_request",
            )

        # Do not automatically escalate for admins/operators unless they explicitly ask for handoff
        admin_roles = {
            "admin", "system admin", "system_admin", "مسؤول النظام", "مسؤول",
            "operator", "system operator", "مشغل النظام", "مشغل"
        }
        is_admin = user_type in admin_roles

        logger.info(
            "EscalationEngine.check: user_type=%s, is_admin=%s, intent=%s, confidence=%.3f, threshold=%.3f",
            user_type, is_admin, intent, confidence, self.threshold
        )

        if intent == "out_of_scope":
            if is_admin:
                return EscalationResult(escalated=False)
            logger.info("Escalation: query out of scope")
            return EscalationResult(
                escalated=True,
                reason="السؤال خارج نطاق المنصة.",
                escalation_type="out_of_scope",
            )

        if review and bool(review.get("no_answer", False)):
            if is_admin:
                return EscalationResult(escalated=False)
            logger.info("Escalation: semantic review classified response as no-answer")
            return EscalationResult(
                escalated=True,
                reason="الإجابة غير مدعومة بشكل كافٍ وتحتاج متابعة بشرية.",
                escalation_type="no_answer",
            )

        if review and float(review.get("contradiction_risk", 0.0) or 0.0) >= 0.8:
            if is_admin:
                return EscalationResult(escalated=False)
            logger.info("Escalation: high contradiction risk from semantic review")
            return EscalationResult(
                escalated=True,
                reason="تم رصد خطر تناقض عالٍ في الإجابة، يُنصح بالمراجعة البشرية.",
                escalation_type="contradiction",
            )

        if review and bool(review.get("escalation_recommended", False)):
            if is_admin:
                return EscalationResult(escalated=False)
            logger.info("Escalation: semantic review recommended escalation")
            return EscalationResult(
                escalated=True,
                reason="التقييم الدلالي أوصى بمراجعة بشرية للجودة.",
                escalation_type="review_recommended",
            )

        if confidence < self.threshold:
            if is_admin:
                return EscalationResult(escalated=False)
            logger.info("Escalation: confidence %.3f below threshold %.3f", confidence, self.threshold)
            return EscalationResult(
                escalated=True,
                reason=f"مستوى الثقة في الإجابة منخفض ({confidence:.0%}). يُنصح بمراجعة موظف مختص.",
                escalation_type="low_confidence",
            )

        return EscalationResult(escalated=False)
