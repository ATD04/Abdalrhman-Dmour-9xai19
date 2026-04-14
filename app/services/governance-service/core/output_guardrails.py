"""
Governance Service — Output Guardrails Engine
Rule-based screening + LLM compliance check for generated answers.
"""
import re
import time
import logging
from core.llm import GeminiClient
from prompts.output_guardrail_prompt import build_output_guardrail_prompt

logger = logging.getLogger("governance-service.output_guardrails")

# ─── Rule-Based Patterns ─────────────────────────────────────────────────────
# Visibility leak markers that should never appear in citizen-facing responses
INTERNAL_MARKERS = [
    r"\binternal\s+use\s+only\b",
    r"\bconfidential\b",
    r"\bسري\b",
    r"\bللاستخدام\s+الداخلي\b",
    r"\bمسودة\b",  # draft
    r"\bclassified\b",
]

FORBIDDEN_PHRASES = [
    r"\bkill\b.*\byourself\b",
    r"\bsuicide\b",
    r"\bانتحار\b",
]

COMPILED_INTERNAL = [re.compile(p, re.IGNORECASE) for p in INTERNAL_MARKERS]
COMPILED_FORBIDDEN = [re.compile(p, re.IGNORECASE) for p in FORBIDDEN_PHRASES]


class OutputGuardrails:
    """Output guardrail engine: rule-based screening + LLM compliance check."""

    def __init__(self):
        self.llm = GeminiClient()

    def _rule_based_check(self, answer: str, user_type: str) -> dict | None:
        """Fast rule-based screening. Returns result if blocked, None if passed."""
        # Empty response
        if not answer or not answer.strip():
            return {
                "passed": False,
                "category": "compliance_issue",
                "reason": "الإجابة فارغة / Empty response",
            }

        # Forbidden phrases
        for pattern in COMPILED_FORBIDDEN:
            if pattern.search(answer):
                return {
                    "passed": False,
                    "category": "harmful_content",
                    "reason": "تم اكتشاف محتوى محظور / Forbidden content detected",
                }

        # Visibility leak: internal markers in citizen responses
        if user_type == "citizen":
            for pattern in COMPILED_INTERNAL:
                if pattern.search(answer):
                    return {
                        "passed": False,
                        "category": "visibility_leak",
                        "reason": "الإجابة تتضمن معلومات داخلية غير مصرح للمواطن الاطلاع عليها / Response contains internal information not authorized for citizen access",
                    }

        return None

    async def check(self, answer: str, query: str, user_type: str = "citizen",
                    language: str = "ar", use_llm: bool = True) -> dict:
        """
        Full output guardrail check: rule-based → LLM compliance.

        Returns:
            {
                "passed": bool,
                "category": str | None,
                "reason": str | None,
                "check_type": "output",
                "latency_ms": float
            }
        """
        t0 = time.time()

        # Step 1: Rule-based screening
        rule_result = self._rule_based_check(answer, user_type)
        if rule_result:
            rule_result["check_type"] = "output"
            rule_result["latency_ms"] = round((time.time() - t0) * 1000, 1)
            logger.info(f"Output blocked by rule: {rule_result['category']}")
            return rule_result

        if not use_llm:
            return {
                "passed": True,
                "category": None,
                "reason": "Rule-only mode enabled",
                "check_type": "output",
                "latency_ms": round((time.time() - t0) * 1000, 1),
            }

        # Step 2: LLM compliance check
        try:
            system_instruction, user_prompt = build_output_guardrail_prompt(
                answer, query, user_type
            )
            result = await self.llm.generate_json(user_prompt, system_instruction)

            category = result.get("category", "compliant")
            passed = category == "compliant"

            response = {
                "passed": passed,
                "category": category if not passed else None,
                "reason": result.get("reason") if not passed else None,
                "check_type": "output",
                "latency_ms": round((time.time() - t0) * 1000, 1),
            }

            if not passed:
                logger.info(f"Output blocked by LLM: {category} — {result.get('reason', '')}")

            return response

        except Exception as e:
            logger.error(f"Output guardrail LLM check failed: {e}")
            return {
                "passed": True,
                "category": None,
                "reason": f"Output guardrail check failed, passing through: {str(e)}",
                "check_type": "output",
                "latency_ms": round((time.time() - t0) * 1000, 1),
            }
