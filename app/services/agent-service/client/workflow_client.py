"""
Workflow Service — Python SDK Client
Used by agent-service to create tickets for in-scope escalated cases.
"""
import httpx
import logging

logger = logging.getLogger("agent-service.workflow_client")


class WorkflowClient:
    def __init__(self, base_url: str = "http://workflow-service:8400", timeout: float = 5.0):
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

    async def create_case(self, payload: dict) -> dict | None:
        try:
            client = self._get_client()
            resp = await client.post(f"{self.base_url}/cases", json=payload)
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:
            logger.warning(f"Workflow case creation failed: {exc}")
            return None

    async def health(self) -> dict:
        try:
            client = self._get_client()
            resp = await client.get(f"{self.base_url}/health")
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:
            return {"status": "unreachable", "error": str(exc)}

    async def find_answered_match(
        self,
        query: str,
        user_id: str | None = None,
        session_id: str | None = None,
        query_embedding: list[float] | None = None,
    ) -> dict | None:
        try:
            payload = {"query": query}
            if user_id:
                payload["user_id"] = user_id
            if session_id:
                payload["session_id"] = session_id
            if query_embedding:
                payload["query_embedding"] = query_embedding
            client = self._get_client()
            resp = await client.post(f"{self.base_url}/cases/answered/match", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data if data.get("found") else None
        except Exception as exc:
            logger.warning(f"Workflow answered-case lookup failed: {exc}")
            return None
