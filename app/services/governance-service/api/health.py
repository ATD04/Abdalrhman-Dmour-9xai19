"""
Governance Service — Health Check Endpoint
Reports own status + reachability of sibling services.
"""
import time
import httpx
from fastapi import APIRouter
from config import AGENT_SERVICE_URL, KNOWLEDGE_SERVICE_URL
from models.schemas import HealthResponse, ServiceHealth
from storage.database import Database

router = APIRouter(tags=["health"])
db = Database()


async def _check_service(name: str, url: str) -> ServiceHealth:
    """Ping a sibling service's health endpoint."""
    try:
        t0 = time.time()
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{url}/health")
        latency = (time.time() - t0) * 1000
        status = "healthy" if resp.status_code == 200 else "unhealthy"
        return ServiceHealth(status=status, url=url, latency_ms=round(latency, 1))
    except Exception:
        return ServiceHealth(status="unreachable", url=url)


@router.get("/health", response_model=HealthResponse)
async def health():
    agent = await _check_service("agent-service", AGENT_SERVICE_URL)
    knowledge = await _check_service("knowledge-service", KNOWLEDGE_SERVICE_URL)

    return HealthResponse(
        status="healthy",
        audit_records=db.count_audit_records(),
        services={
            "agent-service": agent,
            "knowledge-service": knowledge,
        },
    )
