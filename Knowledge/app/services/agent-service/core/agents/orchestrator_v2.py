"""
Post-generation pipeline for RAG answers.
Runs citations, amendments, and review in parallel, then confidence → escalation sequentially.
"""
from __future__ import annotations

import asyncio
import copy
import logging
import time
from typing import Any, Awaitable, Callable

from core import amendments as amendments_stage
from core import citations as citations_stage
from core import confidence as confidence_stage
from core import escalation as escalation_stage
from core import review as review_stage
from core.escalation import EscalationResult

logger = logging.getLogger("agent-service.orchestrator.v2")

PostGenStageFn = Callable[..., Awaitable[Any]]
POST_GEN_STAGE_ORDER = ("citations", "amendments", "review", "confidence", "escalation")


def _safe_default_review(answer: str) -> dict[str, Any]:
    has_answer = bool((answer or "").strip())
    return {
        "status": "passed" if has_answer else "warning",
        "support_quality": "moderate",
        "contradiction_risk": 0.0,
        "no_answer": not has_answer,
        "escalation_recommended": not has_answer,
        "issues": ["empty_answer"] if not has_answer else [],
        "review_warning": None,
        "correction": None,
        "confidence_penalty": 0.0,
    }


def _post_gen_defaults(answer: str) -> dict[str, Any]:
    return {
        "citations": [],
        "amendments": {
            "has_amendments": False,
            "amendment_note": None,
            "amendment_sources": [],
            "amendment_lookup_total": 0.0,
            "amendment_lookup_count": 0,
        },
        "review": _safe_default_review(answer),
        "confidence": {
            "score": 0.0,
            "breakdown": {
                "fallback": True,
                "reason": "post_generation_default",
            },
        },
        "escalation": EscalationResult(escalated=False),
    }


async def _run_stage_safe(
    stage_name: str,
    stage_call: Awaitable[Any],
    default_value: Any,
    response_id: str,
) -> dict[str, Any]:
    started = time.perf_counter()
    try:
        value = await stage_call
        status = "ok"
    except asyncio.CancelledError:
        value = copy.deepcopy(default_value)
        status = "timeout"
        logger.warning("[%s] Post-generation stage cancelled: %s", response_id, stage_name)
    except Exception:
        value = copy.deepcopy(default_value)
        status = "error"
        logger.exception("[%s] Post-generation stage failed: %s", response_id, stage_name)

    return {
        "value": value,
        "status": status,
        "duration": round(time.perf_counter() - started, 6),
    }


def _critical_path_bottleneck_flags(stage_durations: dict[str, float]) -> dict[str, bool]:
    branch_totals = {
        "citations_path": (
            stage_durations.get("citations", 0.0)
            + stage_durations.get("confidence", 0.0)
            + stage_durations.get("escalation", 0.0)
        ),
        "amendments_path": stage_durations.get("amendments", 0.0),
        "review_path": stage_durations.get("review", 0.0),
    }

    critical_branch = max(branch_totals.items(), key=lambda item: item[1])[0]
    branch_stages = {
        "citations_path": ["citations", "confidence", "escalation"],
        "amendments_path": ["amendments"],
        "review_path": ["review"],
    }[critical_branch]

    branch_stage_max = max(stage_durations.get(stage, 0.0) for stage in branch_stages)
    eps = 1e-9
    flags = {stage: False for stage in POST_GEN_STAGE_ORDER}
    for stage in branch_stages:
        if abs(stage_durations.get(stage, 0.0) - branch_stage_max) <= eps:
            flags[stage] = True
    return flags


async def run_post_generation_pipeline(
    response: dict[str, Any],
    response_id: str,
    timeout_seconds: float,
    stage_impl: dict[str, PostGenStageFn] | None = None,
) -> dict[str, Any]:
    defaults = _post_gen_defaults(str(response.get("answer") or ""))
    implementations: dict[str, PostGenStageFn] = {
        "citations": citations_stage.extract,
        "amendments": amendments_stage.check,
        "review": review_stage.score,
        "confidence": confidence_stage.score,
        "escalation": escalation_stage.evaluate,
    }
    if stage_impl:
        implementations.update(stage_impl)

    parallel_tasks = {
        "citations": asyncio.create_task(
            _run_stage_safe(
                "citations",
                implementations["citations"](response),
                defaults["citations"],
                response_id,
            )
        ),
        "amendments": asyncio.create_task(
            _run_stage_safe(
                "amendments",
                implementations["amendments"](response),
                defaults["amendments"],
                response_id,
            )
        ),
        "review": asyncio.create_task(
            _run_stage_safe(
                "review",
                implementations["review"](response),
                defaults["review"],
                response_id,
            )
        ),
    }

    try:
        await asyncio.wait_for(
            asyncio.shield(asyncio.gather(*parallel_tasks.values())),
            timeout=timeout_seconds,
        )
    except asyncio.TimeoutError:
        logger.warning(
            "[%s] Post-generation parallel stages timed out after %.2fs; returning partial results",
            response_id,
            timeout_seconds,
        )
        for task in parallel_tasks.values():
            if not task.done():
                task.cancel()
        await asyncio.gather(*parallel_tasks.values(), return_exceptions=True)

    parallel_values: dict[str, Any] = {}
    stage_timings: dict[str, float] = {}
    stage_status: dict[str, str] = {}

    for stage_name, task in parallel_tasks.items():
        result_payload: dict[str, Any]
        if task.done() and not task.cancelled():
            try:
                result_payload = task.result()
            except Exception:
                logger.exception("[%s] Stage result retrieval failed: %s", response_id, stage_name)
                result_payload = {
                    "value": copy.deepcopy(defaults[stage_name]),
                    "status": "error",
                    "duration": timeout_seconds,
                }
        else:
            result_payload = {
                "value": copy.deepcopy(defaults[stage_name]),
                "status": "timeout",
                "duration": timeout_seconds,
            }

        parallel_values[stage_name] = result_payload["value"]
        stage_timings[stage_name] = float(result_payload.get("duration", 0.0) or 0.0)
        stage_status[stage_name] = str(result_payload.get("status") or "unknown")

    response_with_review = dict(response)
    response_with_review["review"] = parallel_values["review"]

    confidence_payload = await _run_stage_safe(
        "confidence",
        implementations["confidence"](response_with_review, parallel_values["citations"]),
        defaults["confidence"],
        response_id,
    )
    stage_timings["confidence"] = float(confidence_payload.get("duration", 0.0) or 0.0)
    stage_status["confidence"] = str(confidence_payload.get("status") or "unknown")

    escalation_payload = await _run_stage_safe(
        "escalation",
        implementations["escalation"](response_with_review, confidence_payload["value"]),
        defaults["escalation"],
        response_id,
    )
    stage_timings["escalation"] = float(escalation_payload.get("duration", 0.0) or 0.0)
    stage_status["escalation"] = str(escalation_payload.get("status") or "unknown")

    bottleneck_flags = _critical_path_bottleneck_flags(stage_timings)
    for stage_name in POST_GEN_STAGE_ORDER:
        logger.info(
            "[%s] Post-generation stage=%s duration_s=%.4f status=%s critical_path_bottleneck=%s",
            response_id,
            stage_name,
            stage_timings.get(stage_name, 0.0),
            stage_status.get(stage_name, "unknown"),
            bottleneck_flags.get(stage_name, False),
        )

    return {
        "citations": parallel_values["citations"],
        "amendments": parallel_values["amendments"],
        "review": parallel_values["review"],
        "confidence": confidence_payload["value"],
        "escalation": escalation_payload["value"],
        "timings": stage_timings,
        "status": stage_status,
        "bottleneck": bottleneck_flags,
    }


