"""
Governance Service — Guardrail API Endpoint
POST /guardrail_check — validates input or output text.
"""
import logging
from fastapi import APIRouter
from models.schemas import GuardrailRequest, GuardrailResult
from core.input_guardrails import InputGuardrails
from core.output_guardrails import OutputGuardrails
from config import INPUT_GUARDRAIL_ENABLED, OUTPUT_GUARDRAIL_ENABLED

logger = logging.getLogger("governance-service.guardrail")
router = APIRouter(tags=["guardrails"])

input_guardrails = InputGuardrails()
output_guardrails = OutputGuardrails()


@router.post("/guardrail_check", response_model=GuardrailResult)
async def guardrail_check(request: GuardrailRequest):
    """
    Check text against guardrails.
    - check_type="input": validates user query before processing
    - check_type="output": validates answer before returning (Phase 3)
    """
    if request.check_type == "input":
        if not INPUT_GUARDRAIL_ENABLED:
            return GuardrailResult(
                passed=True, check_type="input", latency_ms=0.0,
                reason="Input guardrail disabled",
            )
        result = await input_guardrails.check(
            request.text,
            request.language,
            use_llm=not request.rule_only,
        )
        return GuardrailResult(**result)

    elif request.check_type == "output":
        if not OUTPUT_GUARDRAIL_ENABLED:
            return GuardrailResult(
                passed=True, check_type="output", latency_ms=0.0,
                reason="Output guardrail disabled",
            )
        if not request.query:
            return GuardrailResult(
                passed=False, check_type="output", latency_ms=0.0,
                category="policy_violation",
                reason="Original query is required for output guardrail checks",
            )
        result = await output_guardrails.check(
            answer=request.text,
            query=request.query,
            user_type=request.user_type,
            language=request.language,
            use_llm=not request.rule_only,
        )
        return GuardrailResult(**result)

    else:
        return GuardrailResult(
            passed=False,
            check_type=request.check_type,
            category="policy_violation",
            reason=f"Unknown check_type: {request.check_type}. Use 'input' or 'output'.",
            latency_ms=0.0,
        )
