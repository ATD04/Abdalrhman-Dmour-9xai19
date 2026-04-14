"""
Governance Microservice — FastAPI Application
Port 8300 | Guardrails, Audit, Evaluation, Metrics
"""
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from api import health, guardrail, audit, evaluate, metrics, release, logs, topic_insights
from config import HOST, PORT

app = FastAPI(
    title="JNPI Governance Service",
    description="Guardrails, audit logging, evaluation, and metrics for the JNPI platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(guardrail.router)
app.include_router(audit.router)
app.include_router(evaluate.router)
app.include_router(metrics.router)
app.include_router(topic_insights.router)
app.include_router(release.router)
app.include_router(logs.router)

# ─── Static UI ────────────────────────────────────────────────────────────────
static_dir = Path(__file__).parent / "static"


@app.get("/", include_in_schema=False)
async def serve_ui():
    index = static_dir / "index.html"
    if index.exists():
        return FileResponse(index)
    return {"message": "Governance Service is running. Visit /docs for API docs."}


app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# ─── Entry Point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
