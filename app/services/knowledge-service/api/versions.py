"""
Knowledge Service — Versions API
GET /versions/{source_id} — List version history for a source.
"""
from fastapi import APIRouter, HTTPException
from models.schemas import VersionInfo, VersionListResponse

router = APIRouter(tags=["Versions"])


def get_db():
    from main import db
    return db


@router.get("/versions/{source_id}", response_model=VersionListResponse,
            summary="List source versions",
            description="Returns the version history for a source. Re-ingesting the same source_name creates a new version.")
async def list_versions(source_id: str):
    database = get_db()
    source = database.get_source(source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Source not found")

    versions = database.get_versions(source_id)
    items = [
        VersionInfo(
            version=v["version"],
            chunks_created=v["chunks_created"],
            created_at=v["created_at"],
            is_active=bool(v["is_active"]),
        )
        for v in versions
    ]

    return VersionListResponse(
        source_id=source_id,
        source_name=source["source_name"],
        source_group_id=source.get("source_group_id"),
        source_group_name=source.get("source_group_name"),
        versions=items,
    )
