from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import os
from dotenv import load_dotenv
from database import init_db, get_db
from data_generator import generate_all_data

load_dotenv()

app = FastAPI(title="Voice of Citizen 360", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/")
def root():
    return {"message": "Voice of Citizen 360 API is running"}


@app.get("/health")
def health():
    return {"status": "ok", "database": "connected", "ai_model": "gemma4:31b"}


@app.post("/api/seed")
def seed(db: Session = Depends(get_db)):
    result = generate_all_data(db)
    return result
