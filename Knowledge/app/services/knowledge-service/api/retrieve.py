"""
Knowledge Service — Retrieve API
POST /retrieve — Semantic search across embedded documents.
"""
import logging

from fastapi import APIRouter, HTTPException
from models.schemas import RetrieveRequest, RetrieveResponse, ChunkResult

router = APIRouter(tags=["Retrieval"])
logger = logging.getLogger("knowledge-service.retrieve")


def get_retrieval_engine():
    from main import retrieval_engine
    return retrieval_engine


@router.post("/retrieve", response_model=RetrieveResponse,
             summary="Semantic search",
             description="Search across all ingested documents using natural language. Filter by source IDs or tags. Returns ranked results with source references.")
async def retrieve(req: RetrieveRequest):
    engine = get_retrieval_engine()

    try:
        raw = engine.retrieve(
            query=req.query,
            query_embedding=req.query_embedding,
            top_k=req.top_k,
            source_ids=req.source_ids,
            tags=req.tags,
            doc_type=req.doc_type,
            sector=req.sector,
            ministry_name=req.ministry_name,
            visibility=req.visibility,
            min_score=req.min_score,
        )

        results = [ChunkResult(**r) for r in raw["results"]]

        return RetrieveResponse(
            results=results,
            query=raw["query"],
            total_searched=raw["total_searched"],
            embedding_dim=raw["embedding_dim"],
        )

    except Exception as e:
        logger.exception("/retrieve failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Retrieval failed: {str(e)}")
