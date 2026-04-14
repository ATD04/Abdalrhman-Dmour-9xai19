"""
Knowledge Service — Ingest API
POST /ingest — Upload a file, chunk it, embed it, store everything.
"""
import os
import tempfile
import shutil
import logging
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from starlette.concurrency import run_in_threadpool
from models.schemas import IngestResponse
from core.ingestion import IngestionEngine
from ministries import ALLOWED_MINISTRY_NAMES

router = APIRouter(tags=["Ingestion"])
logger = logging.getLogger("knowledge-service.api.ingest")


def get_ingestion_engine() -> IngestionEngine:
    """Lazy import to avoid circular dependencies."""
    from main import ingestion_engine
    return ingestion_engine


@router.post("/ingest", response_model=IngestResponse,
             summary="Ingest a document",
             description="Upload a file (PDF, image, text, HTML), store PDF page images in the database, embed retrievable text chunks, and persist everything for retrieval.")
async def ingest(
    file: UploadFile = File(..., description="The file to ingest"),
    source_name: str = Form(default="", description="Human-readable source label. If empty, uses filename."),
    tags: str = Form(default="", description="Comma-separated tags for filtering (e.g., 'health,2024,strategy')"),
    language: str = Form(default="auto", description="Language hint (e.g., 'ar', 'en'). Default: auto"),
    chunk_strategy: str = Form(default="page", description="Chunking strategy: page | fixed | paragraph"),
    visibility: str = Form(default="", description="Override visibility: public | internal | confidential. Empty = auto-detect."),
    approval_status: str = Form(default="approved", description="Approval status: approved | draft | revoked"),
    constitution_date: str = Form(default="", description="Optional manual constitution/effective date label"),
    ministry_name: str = Form(default="", description="Optional manual ministry/entity label"),
    source_group_name: str = Form(default="", description="Optional manual law/source group name"),
    group_role: str = Form(default="", description="Optional group role: primary | amendment | related"),
):
    engine = get_ingestion_engine()

    # Parse tags
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []

    # Use filename as source_name if not provided
    if not source_name:
        source_name = file.filename or "unnamed"
    if ministry_name and ministry_name not in ALLOWED_MINISTRY_NAMES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid ministry_name. Allowed values: {', '.join(sorted(ALLOWED_MINISTRY_NAMES))}",
        )

    # Save uploaded file to a temp location
    tmp_dir = tempfile.mkdtemp()
    try:
        tmp_path = Path(tmp_dir) / file.filename
        with open(tmp_path, "wb") as f:
            content = await file.read()
            f.write(content)

        result = await run_in_threadpool(
            engine.ingest,
            file_path=tmp_path,
            source_name=source_name,
            tags=tag_list,
            language=language,
            chunk_strategy=chunk_strategy,
            visibility=visibility if visibility else None,
            approval_status=approval_status,
            constitution_date=constitution_date or None,
            ministry_name=ministry_name or None,
            group_name=source_group_name or None,
            group_role=group_role or None,
        )
        return IngestResponse(**result)

    except ValueError as e:
        detail = str(e)
        logger.warning("Ingest rejected: %s", detail)
        if "duplicate file detected" in detail.lower():
            raise HTTPException(status_code=409, detail=detail)
        raise HTTPException(status_code=400, detail=detail)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

@router.post("/ingest/batch",
             summary="Batch ingest documents",
             description="Upload multiple files at once. Processes sequentially and returns success/fail stats.")
async def ingest_batch(
    files: list[UploadFile] = File(..., description="List of files to ingest"),
    tags: str = Form(default="", description="Comma-separated tags applied to ALL files"),
    language: str = Form(default="auto", description="Language hint"),
    chunk_strategy: str = Form(default="page", description="Chunking strategy"),
    visibility: str = Form(default="", description="Override visibility: public | internal | confidential. Empty = auto-detect."),
    approval_status: str = Form(default="approved", description="Approval status: approved | draft | revoked"),
):
    engine = get_ingestion_engine()
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    
    successful = []
    failed = []
    
    tmp_dir = tempfile.mkdtemp()
    try:
        for file in files:
            try:
                tmp_path = Path(tmp_dir) / file.filename
                with open(tmp_path, "wb") as f:
                    content = await file.read()
                    f.write(content)
                    
                result = await run_in_threadpool(
                    engine.ingest,
                    file_path=tmp_path,
                    source_name=file.filename,
                    tags=tag_list.copy(),
                    language=language,
                    chunk_strategy=chunk_strategy,
                    visibility=visibility if visibility else None,
                    approval_status=approval_status,
                )
                successful.append({
                    "filename": file.filename,
                    "source_id": result["source_id"],
                    "version": result["version"],
                    "doc_type": result["doc_type"]
                })
            except Exception as e:
                failed.append({
                    "filename": file.filename,
                    "error": str(e)
                })
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        
    return {
        "successful": successful,
        "failed": failed,
        "total_processed": len(files)
    }
