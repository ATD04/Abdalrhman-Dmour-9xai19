from fastapi import FastAPI

app = FastAPI(
    title="9XAI Hackathon Traffic Logic API",
    description="Backend API for Data Ingestion, Logic, and Real-Time Event Dashboard",
    version="0.1.0"
)

@app.get("/")
def root():
    return {"status": "ok", "message": "Traffic Intelligence Backend is running. Phase 0 successful."}
