"""
Workflow Service — FastAPI Application
Port 8400 | Ticketing workflow for escalated in-scope cases
"""
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from api import health, cases, auth
from config import HOST, PORT

app = FastAPI(
    title="JNPI Workflow Service",
    description="Ticket workflow service for escalated in-scope cases",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(cases.router)
app.include_router(auth.router)

static_dir = Path(__file__).parent / "static"

@app.get("/", include_in_schema=False)
async def serve_ui():
    index = static_dir / "index.html"
    if index.exists():
        return FileResponse(index)
    return {"message": "Workflow Service is running. Visit /docs for API docs."}

app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
