"""
Governance Service — Input Guardrails Engine
Rule-based pre-screening + LLM classification for security threats.
Focused on: prompt injection, system extraction, and policy violations.
Off-topic / greeting detection is handled downstream by the intent classifier.
"""
import re
import time
import logging
from core.llm import GeminiClient
from prompts.input_guardrail_prompt import build_input_guardrail_prompt

logger = logging.getLogger("governance-service.input_guardrails")

# ─── Rule-Based Patterns (fast, no LLM) ──────────────────────────────────────
# These catch obvious injection/extraction attempts instantly.
# The LLM fallback handles subtle or creative attacks.
INJECTION_PATTERNS = [
    # --- Instruction override / ignore ---
    r"ignore\s+(all\s+)?(previous|prior|above|earlier|system)",
    r"disregard\s+(all\s+)?(previous|prior|above|earlier|system)",
    r"forget\s+(all\s+)?(previous|prior|above|earlier|your)\s+(instructions|rules|prompt)",
    r"override\s+(all\s+)?(previous|prior|system|safety|your)",
    r"تجاهل\s+(كل\s+)?(التعليمات|الأوامر|القواعد)",
    r"انسَ?\s+(كل\s+)?(التعليمات|الأوامر)",
    # --- System prompt extraction ---
    r"system\s*prompt",
    r"تعليمات\s*النظام",
    r"(print|show|display|reveal|output|repeat|tell\s+me)\s+(your|the|all)?\s*(system|initial|original|hidden)?\s*(prompt|instructions|rules|configuration)",
    r"(اطبع|اعرض|أظهر|كرر|اكتب)\s+(تعليمات|أوامر|قواعد)",
    r"what\s+(are|were)\s+your\s+(initial|original|system|hidden)?\s*(instructions|rules|prompt)",
    r"(translate|copy|paste|write\s+out)\s+your\s+(instructions|prompt|rules)",
    r"repeat\s+everything\s+(above|before)",
    r"everything\s+(above|before)\s+this",
    # --- Jailbreak / mode switch ---
    r"DAN\s*mode",
    r"jailbreak",
    r"developer\s*mode",
    r"god\s*mode",
    r"unrestricted\s*mode",
    r"(pretend|imagine|act|behave|roleplay|role.play)\s+(you\s+are|to\s+be|as\s+(if|a|an|though))",
    r"(تخيل|تظاهر|تصرف)\s+(أنك|كأنك|بأنك|انك)",
    r"you\s+are\s+now\s+(a|an|no\s+longer)",
    r"أنت\s+الآن\s+(مساعد|لست)",
    r"from\s+now\s+on\s+(you|ignore|forget|act)",
    r"new\s+rule:?\s",
    r"in\s+this\s+conversation\s+you\s+(are|will|must|should)",
    # --- Encoded / obfuscation attacks ---
    r"base64[:\s]",
    r"decode\s+(this|the\s+following)",
    r"\\x[0-9a-f]{2}",
    r"&#x?[0-9a-f]+;",
    # --- XSS / HTML injection ---
    r"<script",
    r"javascript:",
    r"<iframe",
    r"on(load|error|click)\s*=",
    # --- SQL injection ---
    r"SELECT\s+.+\s+FROM\s+",
    r"DROP\s+TABLE",
    r"INSERT\s+INTO",
    r";\s*--",
    r"UNION\s+SELECT",
    r"OR\s+1\s*=\s*1",
    r"'\s*OR\s+'",
]

COMPILED_PATTERNS = [re.compile(p, re.IGNORECASE) for p in INJECTION_PATTERNS]


class InputGuardrails:
    """Input guardrail engine: rule-based screening + LLM classification."""

    def __init__(self):
        self.llm = GeminiClient()

    def _rule_based_check(self, text: str) -> dict | None:
        """
        Fast rule-based pre-screening. Returns a result dict if blocked, None if passed.
        """
        # Empty or whitespace-only
        if not text or not text.strip():
            return {
                "passed": False,
                "category": "policy_violation",
                "reason": "الاستعلام فارغ / Empty query",
            }

        # Too long (>2000 chars — likely injection payload)
        if len(text) > 2000:
            return {
                "passed": False,
                "category": "prompt_injection",
                "reason": "الاستعلام طويل جداً ويتجاوز الحد المسموح / Query exceeds maximum length",
            }

        # Known injection patterns
        for pattern in COMPILED_PATTERNS:
            if pattern.search(text):
                return {
                    "passed": False,
                    "category": "prompt_injection",
                    "reason": "تم اكتشاف نمط حقن محتمل / Potential injection pattern detected",
                }

        return None  # Passed rule-based checks

    async def check(self, text: str, language: str = "ar", use_llm: bool = True) -> dict:
        """
        Full input guardrail check: rule-based → LLM classification.

        Returns:
            {
                "passed": bool,
                "category": str | None,
                "reason": str | None,
                "check_type": "input",
                "latency_ms": float
            }
        """
        t0 = time.time()

        # Step 1: Rule-based pre-screening (fast)
        rule_result = self._rule_based_check(text)
        if rule_result:
            rule_result["check_type"] = "input"
            rule_result["latency_ms"] = round((time.time() - t0) * 1000, 1)
            logger.info(f"Input blocked by rule: {rule_result['category']}")
            return rule_result

        if not use_llm:
            return {
                "passed": True,
                "category": None,
                "reason": "Rule-only mode enabled",
                "check_type": "input",
                "latency_ms": round((time.time() - t0) * 1000, 1),
            }

        # Step 2: LLM classification (security threats only)
        try:
            system_instruction, user_prompt = build_input_guardrail_prompt(text, language)
            result = await self.llm.generate_json(user_prompt, system_instruction)

            category = result.get("category", "safe")
            # Only block on genuine security threats
            blocked_categories = {"prompt_injection", "policy_violation"}
            passed = category not in blocked_categories

            response = {
                "passed": passed,
                "category": category if not passed else None,
                "reason": result.get("reason") if not passed else None,
                "check_type": "input",
                "latency_ms": round((time.time() - t0) * 1000, 1),
            }

            if not passed:
                logger.info(f"Input blocked by LLM: {category} — {result.get('reason', '')}")

            return response

        except Exception as e:
            # LLM failure → pass through (false negative better than blocking legitimate queries)
            logger.error(f"Input guardrail LLM check failed: {e}")
            return {
                "passed": True,
                "category": None,
                "reason": f"Guardrail check failed, passing through: {str(e)}",
                "check_type": "input",
                "latency_ms": round((time.time() - t0) * 1000, 1),
            }
