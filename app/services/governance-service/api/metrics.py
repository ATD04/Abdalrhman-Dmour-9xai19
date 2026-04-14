"""
Governance Service — Metrics API Endpoint
GET /metrics — returns aggregated performance metrics.
"""
import logging
from fastapi import APIRouter, Query
from models.schemas import MetricsResult
from core.metrics_collector import MetricsCollector

logger = logging.getLogger("governance-service.metrics")
router = APIRouter(tags=["metrics"])

metrics_collector = MetricsCollector()


@router.get("/metrics", response_model=MetricsResult)
async def get_metrics(period: str = Query("24h", description="1h | 24h | 7d | 30d")):
    """Get aggregated performance metrics for the specified period."""
    if period not in ("1h", "24h", "7d", "30d"):
        period = "24h"
    result = metrics_collector.collect(period)
    return MetricsResult(**result)
