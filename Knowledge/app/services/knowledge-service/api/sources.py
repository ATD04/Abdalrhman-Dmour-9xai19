"""
Knowledge Service — Sources API
GET  /sources          — List all ingested sources.
GET  /sources/{id}     — Get a single source.
DELETE /sources/{id}   — Delete a source and its embeddings.
GET  /sources/{id}/page/{page_num} — Serve a page image.
"""
import mimetypes
from urllib.parse import quote

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, Response
from pathlib import Path
from models.schemas import SourceInfo, SourceListResponse, SourceLabelsUpdateRequest, SourceChunksResponse
from config import PAGES_DIR, FILES_DIR
from ministries import ALLOWED_MINISTRY_NAMES

router = APIRouter(tags=["Sources"])


def get_db():
    from main import db
    return db


def get_vector_store():
    from main import vector_store
    return vector_store


@router.get("/sources", response_model=SourceListResponse,
            summary="List all sources",
            description="Returns all ingested documents with metadata, tags, and chunk counts.")
async def list_sources():
    database = get_db()
    sources = database.list_sources()
    items = [
        SourceInfo(
            source_id=s["source_id"],
            source_name=s["source_name"],
            filename=s["filename"],
            file_type=s["file_type"],
            doc_type=s.get("doc_type", "general"),
            total_chunks=s.get("total_chunks", 0),
            current_version=s["current_version"],
            tags=s.get("tags", []),
            language=s.get("language", "auto"),
            visibility=s.get("visibility", "public"),
            approval_status=s.get("approval_status", "approved"),
            date_of_the_constitution=s.get("date_of_the_constitution"),
            ministry_name=s.get("ministry_name"),
            ministry_type=s.get("ministry_type", "general"),
            source_group_id=s.get("source_group_id"),
            source_group_name=s.get("source_group_name"),
            group_role=s.get("group_role", "primary"),
            created_at=s["created_at"].isoformat() if hasattr(s.get("created_at"), "isoformat") else str(s.get("created_at", "")),
            updated_at=s["updated_at"].isoformat() if hasattr(s.get("updated_at"), "isoformat") else str(s.get("updated_at", "")),
            metadata=s.get("metadata", {}),
        )
        for s in sources
    ]
    return SourceListResponse(sources=items, total=len(items))


@router.get("/sources/{source_id}",
            summary="Get source details")
async def get_source(source_id: str):
    database = get_db()
    source = database.get_source(source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Source not found")
    return source


@router.patch("/sources/{source_id}/labels",
              summary="Update source labels",
              description="Manually update constitution date, ministry, and grouping metadata for an ingested source.")
async def update_source_labels(source_id: str, req: SourceLabelsUpdateRequest):
    database = get_db()
    source = database.get_source(source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Source not found")
    if req.ministry_name is not None and req.ministry_name.strip() and req.ministry_name not in ALLOWED_MINISTRY_NAMES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid ministry_name. Allowed values: {', '.join(sorted(ALLOWED_MINISTRY_NAMES))}",
        )

    source_group_id = source.get("source_group_id")
    if req.source_group_name is not None:
        stripped = req.source_group_name.strip()
        if stripped:
            group = database.ensure_source_group(
                group_name=stripped,
                doc_type=source.get("doc_type", "regulation"),
                ministry_name=req.ministry_name or source.get("ministry_name"),
                constitution_date=req.date_of_the_constitution or source.get("date_of_the_constitution"),
            )
            source_group_id = group["group_id"] if group else None
        else:
            source_group_id = None

    updated = database.update_source_labels(
        source_id,
        date_of_the_constitution=req.date_of_the_constitution,
        ministry_name=req.ministry_name,
        source_group_id=source_group_id,
        group_role=req.group_role,
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Source not found")
    return updated


@router.delete("/sources/{source_id}",
               summary="Delete a source",
               description="Permanently removes a source and all its chunks, versions, and embeddings.")
async def delete_source(source_id: str):
    database = get_db()
    vs = get_vector_store()

    source = database.get_source(source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Source not found")

    # Delete embeddings
    vs.delete_embeddings(source_id)

    # Delete metadata
    database.delete_source(source_id)

    # Delete page images
    page_dir = PAGES_DIR / source_id
    if page_dir.exists():
        import shutil
        shutil.rmtree(page_dir, ignore_errors=True)

    return {"status": "deleted", "source_id": source_id}


@router.get("/sources/{source_id}/page/{page_num}",
            summary="Get page image",
            description="Returns the rendered page image for preview.")
async def get_page_image(source_id: str, page_num: int):
    database = get_db()
    page_record = database.get_pdf_page(source_id, page_num)
    if page_record is not None:
        return Response(
            content=page_record["image_data"],
            media_type=page_record.get("image_mime_type", "image/png"),
        )

    # Legacy fallback for page images stored on disk before the DB-backed migration.
    page_path = PAGES_DIR / source_id / f"page_{page_num}.png"
    if page_path.exists():
        return FileResponse(str(page_path), media_type="image/png")

    raise HTTPException(status_code=404, detail="Page image not found")


@router.get("/sources/{source_id}/pages",
            summary="List available page images for a source")
async def list_page_images(source_id: str):
    """
    Returns the list of available page images and their URLs for a source.
    Useful for building simple document viewers in the UI.
    """
    database = get_db()
    page_rows = database.list_pdf_pages(source_id)
    if page_rows:
        pages = [
            {
                "page": row["page"],
                "image_url": f"/sources/{source_id}/page/{row['page']}",
                "text_chunk_id": row.get("text_chunk_id"),
            }
            for row in page_rows
        ]
        return {
            "source_id": source_id,
            "pages": pages,
            "page_count": len(pages),
        }

    page_dir = PAGES_DIR / source_id
    if not page_dir.exists():
        return {"source_id": source_id, "pages": [], "page_count": 0}

    pages = []
    for p in sorted(page_dir.glob("page_*.png")):
        try:
            num = int(p.stem.split("_")[1])
        except (IndexError, ValueError):
            continue
        pages.append({
            "page": num,
            "image_url": f"/sources/{source_id}/page/{num}",
        })

    return {
        "source_id": source_id,
        "pages": pages,
        "page_count": len(pages),
    }


@router.get("/sources/{source_id}/file",
            summary="Download original file",
            description="Serves the original uploaded file for a source, if available.")
async def get_original_file(source_id: str):
    # Files are stored as FILES_DIR / f\"{source_id}_{filename}\"
    database = get_db()
    source = database.get_source(source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Source not found")

    filename = source["filename"]
    stored_path = FILES_DIR / f"{source_id}_{filename}"
    if not stored_path.exists():
        raise HTTPException(status_code=404, detail="Original file not found")

    media_type, _ = mimetypes.guess_type(str(stored_path))
    content_disposition = f"inline; filename*=UTF-8''{quote(filename)}"

    return FileResponse(
        str(stored_path),
        media_type=media_type or "application/octet-stream",
        headers={"Content-Disposition": content_disposition},
    )


@router.get("/sources/{source_id}/chunks",
            response_model=SourceChunksResponse,
            summary="Get all text chunks for a source",
            description="Returns all chunk texts for a document ordered by page. Used for full-document retrieval in detailed mode.")
async def get_source_chunks(source_id: str):
    database = get_db()
    source = database.get_source(source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Source not found")

    raw_chunks = database.get_chunks_for_source(source_id)
    chunks = []
    for c in raw_chunks:
        meta = c.get("metadata", {})
        if isinstance(meta, str):
            import json
            try:
                meta = json.loads(meta)
            except (json.JSONDecodeError, TypeError):
                meta = {}
        text = meta.get("text", "")
        if not text:
            continue
        chunks.append({
            "chunk_id": c["chunk_id"],
            "page": c["page"],
            "chunk_type": c.get("chunk_type", ""),
            "text": text,
        })

    return SourceChunksResponse(
        source_id=source_id,
        source_name=source.get("source_name", ""),
        total_chunks=len(chunks),
        chunks=chunks,
    )
