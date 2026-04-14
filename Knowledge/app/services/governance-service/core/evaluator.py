"""
Governance Service — Evaluation Engine
Three modes: single (LLM-as-judge), batch (test suite), aggregate (from audit logs).
"""
import time
import logging
import httpx
from core.llm import GeminiClient
from storage.database import Database
from datetime import datetime, timezone, timedelta

logger = logging.getLogger("governance-service.evaluator")


class Evaluator:
    """Evaluation engine for measuring agent answer quality."""

    def __init__(self):
        self.llm = GeminiClient()
        self.db = Database()

    async def evaluate_single(self, query: str, expected: str, actual: str) -> dict:
        """
        LLM-as-judge: compare expected vs actual answer.
        Returns accuracy score 0.0-1.0 with explanation.
        """
        t0 = time.time()
        prompt = f"""You are an evaluation judge for a government AI platform.
Compare the expected answer with the actual answer for the given query.

Query: {query}

Expected Answer: {expected}

Actual Answer: {actual}

Rate the actual answer on these dimensions:
1. accuracy: Does it convey the same factual information? (0.0-1.0)
2. completeness: Does it cover all key points from the expected answer? (0.0-1.0)
3. relevance: Is it directly relevant to the query? (0.0-1.0)
4. tone: Is it appropriate for a government platform? (0.0-1.0)

Return JSON:
{{"accuracy": 0.0, "completeness": 0.0, "relevance": 0.0, "tone": 0.0, "overall": 0.0, "explanation": "brief explanation"}}

The overall score should be a weighted average: accuracy(40%) + completeness(30%) + relevance(20%) + tone(10%).
"""
        try:
            result = await self.llm.generate_json(prompt)
            result["latency_ms"] = round((time.time() - t0) * 1000, 1)
            result["mode"] = "single"
            return result
        except Exception as e:
            logger.error(f"Single evaluation failed: {e}")
            return {
                "accuracy": 0.0, "completeness": 0.0, "relevance": 0.0,
                "tone": 0.0, "overall": 0.0,
                "explanation": f"Evaluation failed: {e}",
                "latency_ms": round((time.time() - t0) * 1000, 1),
                "mode": "single",
            }

    async def evaluate_batch(self, test_suite: list[dict],
                             agent_service_url: str = "http://localhost:8200") -> dict:
        """
        Run a batch of test cases against the live agent service.
        Each item: {"query": str, "expected": str, "user_type": "citizen", "language": "ar"}
        """
        t0 = time.time()
        results = []

        for i, test_case in enumerate(test_suite):
            try:
                # Call agent service
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(
                        f"{agent_service_url}/query",
                        json={
                            "query": test_case["query"],
                            "user_type": test_case.get("user_type", "citizen"),
                            "language": test_case.get("language", "ar"),
                        },
                    )
                    resp.raise_for_status()
                    agent_response = resp.json()

                actual = agent_response.get("answer", "")
                expected = test_case.get("expected", "")

                # Evaluate if expected answer provided
                if expected:
                    eval_result = await self.evaluate_single(
                        test_case["query"], expected, actual
                    )
                else:
                    eval_result = {"overall": None, "explanation": "No expected answer provided"}

                results.append({
                    "index": i,
                    "query": test_case["query"],
                    "expected": expected[:200] if expected else None,
                    "actual": actual[:200],
                    "confidence": agent_response.get("confidence", 0),
                    "agent_used": agent_response.get("agent_used"),
                    "evaluation": eval_result,
                    "status": "success",
                })
            except Exception as e:
                results.append({
                    "index": i,
                    "query": test_case["query"],
                    "status": "error",
                    "error": str(e),
                })

        # Compute summary
        scored = [r for r in results if r.get("status") == "success" and r.get("evaluation", {}).get("overall") is not None]
        avg_score = sum(r["evaluation"]["overall"] for r in scored) / len(scored) if scored else 0

        return {
            "mode": "batch",
            "total_tests": len(test_suite),
            "passed": len([r for r in results if r.get("status") == "success"]),
            "failed": len([r for r in results if r.get("status") == "error"]),
            "avg_score": round(avg_score, 3),
            "results": results,
            "latency_ms": round((time.time() - t0) * 1000, 1),
        }

    def evaluate_aggregate(self, period: str = "24h") -> dict:
        """
        Compute aggregate evaluation metrics from audit logs.
        Period: 1h, 24h, 7d, 30d
        """
        since = self._period_to_timestamp(period)
        metrics = self.db.get_metrics(since)

        total = metrics.get("total_queries", 0)
        escalated = metrics.get("escalated_count", 0)
        rejected = metrics.get("rejected_count", 0)

        return {
            "mode": "aggregate",
            "period": period,
            "total_queries": total,
            "avg_latency_ms": round(metrics.get("avg_latency_ms") or 0, 1),
            "p95_latency_ms": round(metrics.get("p95_latency_ms") or 0, 1),
            "avg_confidence": round(metrics.get("avg_confidence") or 0, 3),
            "escalation_rate": round(escalated / total, 3) if total > 0 else 0,
            "guardrail_rejection_rate": round(rejected / total, 3) if total > 0 else 0,
            "sector_distribution": metrics.get("sector_distribution", {}),
            "agent_distribution": metrics.get("agent_distribution", {}),
        }

    @staticmethod
    def _period_to_timestamp(period: str) -> str:
        """Convert a period string to an ISO timestamp."""
        now = datetime.now(timezone.utc)
        mapping = {
            "1h": timedelta(hours=1),
            "24h": timedelta(hours=24),
            "7d": timedelta(days=7),
            "30d": timedelta(days=30),
        }
        delta = mapping.get(period, timedelta(hours=24))
        return (now - delta).isoformat()
