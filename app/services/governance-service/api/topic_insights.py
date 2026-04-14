"""
Governance Service — Topic Insights API
GET /topic-insights — topic demand trends and recommendation signals.
"""
from fastapi import APIRouter, Query

from core.topic_insights import TopicInsightsCollector
from models.schemas import TopicInsightsResult

router = APIRouter(tags=["topic-insights"])
collector = TopicInsightsCollector()


@router.get("/topic-insights", response_model=TopicInsightsResult)
async def get_topic_insights(
    period: str = Query("30d", description="7d | 30d | 90d"),
    top_k: int = Query(8, ge=3, le=20),
):
    normalized_period = period if period in {"7d", "30d", "90d"} else "30d"
    result = collector.collect(period=normalized_period, top_k=top_k)
    return TopicInsightsResult(**result)
