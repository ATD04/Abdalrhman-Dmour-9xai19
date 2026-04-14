"""
Governance Service — Metrics Collector
Aggregates performance metrics from audit logs with rolling windows.
"""
import logging
from datetime import datetime, timezone, timedelta
from storage.database import Database

logger = logging.getLogger("governance-service.metrics")


class MetricsCollector:
    """Collects and aggregates performance metrics from the audit database."""

    def __init__(self):
        self.db = Database()

    def collect(self, period: str = "24h") -> dict:
        """
        Collect metrics for a given period.
        Periods: 1h, 24h, 7d, 30d
        """
        since = self._period_to_timestamp(period)
        raw = self.db.get_metrics(since)

        total = raw.get("total_queries", 0)
        escalated = raw.get("escalated_count", 0)
        rejected = raw.get("rejected_count", 0)

        return {
            "period": period,
            "total_queries": total,
            "avg_latency_ms": round(raw.get("avg_latency_ms") or 0, 1),
            "p95_latency_ms": round(raw.get("p95_latency_ms") or 0, 1),
            "avg_confidence": round(raw.get("avg_confidence") or 0, 3),
            "escalation_rate": round(escalated / total, 3) if total > 0 else 0,
            "guardrail_rejection_rate": round(rejected / total, 3) if total > 0 else 0,
            "sector_distribution": raw.get("sector_distribution", {}),
            "agent_distribution": raw.get("agent_distribution", {}),
        }

    @staticmethod
    def _period_to_timestamp(period: str) -> str:
        now = datetime.now(timezone.utc)
        mapping = {
            "1h": timedelta(hours=1),
            "24h": timedelta(hours=24),
            "7d": timedelta(days=7),
            "30d": timedelta(days=30),
        }
        delta = mapping.get(period, timedelta(hours=24))
        return (now - delta).isoformat()
