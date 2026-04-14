"""
Governance Service — Python SDK Client
Used by the Agent Service to call governance guardrails and audit logging.
Implements graceful degradation — agent continues working if governance is down.
"""
import httpx
import logging

logger = logging.getLogger("agent-service.governance_client")


class GovernanceUnavailableError(RuntimeError):
    """Raised when governance service cannot be reached."""


class GovernanceClient:
    """
    SDK for calling the Governance Service from the Agent Service.
    Three integration points:
        1. check_input()  — before routing (sync gate)
        2. check_output() — after generation (sync gate)
        3. log_audit()    — after response (async fire-and-forget)
    """

    def __init__(self, base_url: str = "http://localhost:8300", timeout: float = 5.0):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._client: httpx.AsyncClient | None = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self.timeout)
        return self._client

    async def close(self):
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def check_input(self, text: str, user_type: str = "citizen",
                          language: str = "ar", rule_only: bool = False) -> dict:
        """
        Input guardrail: check if query is safe to process.
        Returns: {"passed": bool, "category": str|None, "reason": str|None, ...}
        On failure: returns passed=True with governance_available=False (graceful degradation).
        """
        try:
            client = self._get_client()
            resp = await client.post(
                f"{self.base_url}/guardrail_check",
                json={
                    "check_type": "input",
                    "text": text,
                    "user_type": user_type,
                    "language": language,
                    "rule_only": rule_only,
                },
            )
            resp.raise_for_status()
            result = resp.json()
            result["governance_available"] = True
            return result
        except Exception as e:
            logger.warning(f"Governance input check failed (passing through): {e}")
            return {
                "passed": True,
                "category": None,
                "reason": f"Governance service unavailable: {e}",
                "check_type": "input",
                "latency_ms": 0.0,
                "governance_available": False,
            }

    async def check_output(self, answer: str, query: str,
                           user_type: str = "citizen",
                           language: str = "ar", rule_only: bool = False) -> dict:
        """
        Output guardrail: check if answer is compliant before returning.
        Returns: {"passed": bool, "category": str|None, "reason": str|None, ...}
        On failure: returns passed=True with governance_available=False.
        """
        try:
            client = self._get_client()
            resp = await client.post(
                f"{self.base_url}/guardrail_check",
                json={
                    "check_type": "output",
                    "text": answer,
                    "query": query,
                    "user_type": user_type,
                    "language": language,
                    "rule_only": rule_only,
                },
            )
            resp.raise_for_status()
            result = resp.json()
            result["governance_available"] = True
            return result
        except Exception as e:
            logger.warning(f"Governance output check failed (passing through): {e}")
            return {
                "passed": True,
                "category": None,
                "reason": f"Governance service unavailable: {e}",
                "check_type": "output",
                "latency_ms": 0.0,
                "governance_available": False,
            }

    async def log_audit(self, entry: dict) -> dict | None:
        """
        Fire-and-forget audit log. Called via BackgroundTasks.
        Returns the response or None if failed.
        """
        try:
            client = self._get_client()
            resp = await client.post(
                f"{self.base_url}/audit",
                json=entry,
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.warning(f"Governance audit log failed: {e}")
            return None

    async def health(self) -> dict:
        """Check governance service health."""
        try:
            client = self._get_client()
            resp = await client.get(f"{self.base_url}/health")
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            return {"status": "unreachable", "error": str(e)}
