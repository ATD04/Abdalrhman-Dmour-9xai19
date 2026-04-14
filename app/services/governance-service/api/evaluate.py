"""
Governance Service — Evaluation API Endpoint
POST /evaluate — run single, batch, or aggregate evaluations.
"""
import logging
from fastapi import APIRouter
from models.schemas import EvaluateRequest, EvaluateResult
from core.evaluator import Evaluator
from config import AGENT_SERVICE_URL

logger = logging.getLogger("governance-service.evaluate")
router = APIRouter(tags=["evaluation"])

evaluator = Evaluator()


@router.post("/evaluate", response_model=EvaluateResult)
async def evaluate(request: EvaluateRequest):
    """
    Run evaluation.
    - mode="single": compare expected vs actual for a query
    - mode="batch": run test suite against live agent service
    - mode="aggregate": compute metrics from audit logs
    """
    if request.mode == "single":
        if not all([request.query, request.expected, request.actual]):
            return EvaluateResult(
                mode="single",
                results={"error": "query, expected, and actual are required for single mode"},
            )
        result = await evaluator.evaluate_single(
            request.query, request.expected, request.actual
        )
        return EvaluateResult(mode="single", results=result)

    elif request.mode == "batch":
        if not request.test_suite:
            return EvaluateResult(
                mode="batch",
                results={"error": "test_suite is required for batch mode"},
            )
        result = await evaluator.evaluate_batch(
            request.test_suite, AGENT_SERVICE_URL
        )
        return EvaluateResult(mode="batch", results=result)

    elif request.mode == "aggregate":
        result = evaluator.evaluate_aggregate(request.period or "24h")
        return EvaluateResult(mode="aggregate", results=result)

    else:
        return EvaluateResult(
            mode=request.mode,
            results={"error": f"Unknown mode: {request.mode}. Use 'single', 'batch', or 'aggregate'."},
        )
