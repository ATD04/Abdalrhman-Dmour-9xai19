"""
Workflow Service — Health API
"""
from fastapi import APIRouter
from models.schemas import HealthResponse
from storage.database import Database

router = APIRouter(tags=["health"])
db = Database()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(total_cases=db.count_cases())
