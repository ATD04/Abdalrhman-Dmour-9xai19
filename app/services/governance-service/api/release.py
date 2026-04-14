"""
Governance Service — Release Status API
GET /release_status — health of all 3 services + version info.
"""
import time
import httpx
from fastapi import APIRouter
from config import AGENT_SERVICE_URL, KNOWLEDGE_SERVICE_URL
from storage.database import Database

router = APIRouter(tags=["release"])

db = Database()


@router.get("/release_status")
async def release_status():
    """Check health and version of all JNPI platform services."""
    services = {}

    for name, url in [
        ("knowledge-service", KNOWLEDGE_SERVICE_URL),
        ("agent-service", AGENT_SERVICE_URL),
        ("governance-service", "self"),
    ]:
        if url == "self":
            services[name] = {
                "status": "healthy",
                "version": "1.0.0",
                "port": 8300,
                "audit_records": db.count_audit_records(),
            }
            continue

        try:
            t0 = time.time()
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{url}/health")
            latency = round((time.time() - t0) * 1000, 1)
            data = resp.json() if resp.status_code == 200 else {}
            services[name] = {
                "status": "healthy" if resp.status_code == 200 else "unhealthy",
                "url": url,
                "latency_ms": latency,
                "version": data.get("version", "unknown"),
            }
        except Exception as e:
            services[name] = {
                "status": "unreachable",
                "url": url,
                "error": str(e),
            }

    all_healthy = all(s.get("status") == "healthy" for s in services.values())

    return {
        "platform": "JNPI — Jordan National Policy Intelligence",
        "status": "operational" if all_healthy else "degraded",
        "services": services,
    }
