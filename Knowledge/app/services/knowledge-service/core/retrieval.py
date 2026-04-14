"""
Knowledge Service — Retrieval Engine
Semantic search with source filtering, tag matching, and evidence ranking.
"""
import logging
import re
import time
from core.embedding import EmbeddingEngine
from storage.database import Database
from storage.vector_store import VectorStore
from config import DEFAULT_TOP_K, DEFAULT_MIN_SCORE, EXTRACT_PDF_TEXT, RETRIEVE_OVERSAMPLE_FACTOR

logger = logging.getLogger("knowledge-service.retrieval")


class RetrievalEngine:
    """
    Handles semantic retrieval queries:
    1. Embeds the query text.
    2. Resolves source filter with HARD security boundaries (visibility, approval).
    3. Searches the vector store.
    4. Enriches results with metadata from the database.
    5. Filters by source IDs and tags.
    6. Returns ranked evidence.
    """

    def __init__(self, db: Database, vector_store: VectorStore,
                 embedding_engine: EmbeddingEngine):
        self.db = db
        self.vs = vector_store
        self.ee = embedding_engine

    @staticmethod
    def _parse_dimension_mismatch(error: Exception) -> tuple[int, int] | None:
        """Parse pgvector mismatch messages like: 'different vector dimensions 768 and 3072'."""
        msg = str(error)
        match = re.search(r"different vector dimensions\s+(\d+)\s+and\s+(\d+)", msg)
        if not match:
            return None
        return int(match.group(1)), int(match.group(2))

    @staticmethod
    def _resize_vector(vector: list[float], target_dim: int) -> list[float]:
        """Resize by truncating high dimensions or zero-padding short vectors."""
        if target_dim <= 0:
            return vector
        if len(vector) == target_dim:
            return vector
        if len(vector) > target_dim:
            return vector[:target_dim]
        return vector + ([0.0] * (target_dim - len(vector)))

    def _search_with_dimension_fallback(
        self,
        query_embedding: list[float],
        source_ids: list[str] | None,
        top_k: int,
        min_score: float,
        ministry_name: str | None = None,
    ) -> tuple[list[dict], list[float]]:
        """
        Execute vector search and retry once with resized query vector when dimensions drift.
        """
        try:
            return (
                self.vs.search(
                    query_embedding=query_embedding,
                    source_ids=source_ids,
                    top_k=top_k,
                    min_score=min_score,
                    ministry_name=ministry_name,
                ),
                query_embedding,
            )
        except Exception as error:
            dims = self._parse_dimension_mismatch(error)
            if dims is None:
                raise

            target_dim = min(dims)
            resized = self._resize_vector(query_embedding, target_dim)
            logger.warning(
                "Vector dimension mismatch detected (%s). Retrying with resized query embedding to %d dims.",
                error,
                len(resized),
            )
            return (
                self.vs.search(
                    query_embedding=resized,
                    source_ids=source_ids,
                    top_k=top_k,
                    min_score=min_score,
                    ministry_name=ministry_name,
                ),
                resized,
            )

    def retrieve(self, query: str,
                 query_embedding: list[float] | None = None,
                 top_k: int = DEFAULT_TOP_K,
                 source_ids: list[str] | None = None,
                 tags: list[str] | None = None,
                 doc_type: str | None = None,
                 sector: str | None = None,
                 ministry_name: str | None = None,
                 visibility: str = "public",
                 min_score: float = DEFAULT_MIN_SCORE) -> dict:
        """
        Execute a semantic search with hard security filtering.
        visibility and approval_status are enforced at the SQL level
        BEFORE any embeddings are loaded.
        """
        t_total = time.time()

        # Step 1: Embed the query (or reuse provided embedding)
        t0 = time.time()
        if query_embedding:
            query_embedding = [float(v) for v in query_embedding]
            logger.info("Using precomputed query embedding")
        else:
            logger.info(f"Embedding query: '{query[:80]}...'")
            query_embedding = self.ee.embed(query)
        t_embed = round(time.time() - t0, 3)

        # Step 2: Determine source filter (with hard security)
        t0 = time.time()
        effective_source_ids = self._resolve_source_filter(
            source_ids, tags, doc_type, sector, ministry_name, visibility
        )
        t_source_filter = round(time.time() - t0, 3)

        # Step 3: Vector search
        t0 = time.time()
        oversample_factor = max(1, int(RETRIEVE_OVERSAMPLE_FACTOR or 1))
        vector_top_k = max(top_k, top_k * oversample_factor)
        raw_results, effective_embedding = self._search_with_dimension_fallback(
            query_embedding=query_embedding,
            source_ids=effective_source_ids,
            top_k=vector_top_k,
            min_score=min_score,
            ministry_name=ministry_name,
        )
        t_vector_search = round(time.time() - t0, 3)

        # Step 4: Enrich with metadata
        t0 = time.time()
        enriched = self._enrich_results(raw_results)
        t_enrich = round(time.time() - t0, 3)

        # Step 5: Post-filter by tags if needed
        t0 = time.time()
        if tags:
            enriched = [
                r for r in enriched
                if any(t in (r.get("metadata", {}).get("tags", [])) for t in tags)
            ]
        t_post_filter = round(time.time() - t0, 3)

        # Step 6: Trim to top_k
        enriched = enriched[:top_k]

        t_total_elapsed = round(time.time() - t_total, 3)
        logger.info(
            "Retrieve timings: total=%ss embed=%ss source_filter=%ss vector_search=%ss enrich=%ss post_filter=%ss top_k=%s searched=%s returned=%s",
            t_total_elapsed,
            t_embed,
            t_source_filter,
            t_vector_search,
            t_enrich,
            t_post_filter,
            top_k,
            len(raw_results),
            len(enriched),
        )

        return {
            "results": enriched,
            "query": query,
            "total_searched": len(raw_results),
            "embedding_dim": len(effective_embedding),
        }

    def _resolve_source_filter(self, source_ids: list[str] | None,
                               tags: list[str] | None,
                               doc_type: str | None,
                               sector: str | None,
                               ministry_name: str | None,
                               visibility: str = "public") -> list[str] | None:
        """
        Resolve source_ids from filters with HARD security boundaries.
        visibility + approval_status are always enforced at the SQL level.
        """
        # If available, use lightweight source listing that enforces security in SQL.
        source_lister = getattr(self.db, "list_sources_for_retrieval", None)
        if callable(source_lister):
            all_sources = source_lister(
                visibility=visibility,
                ministry_name=ministry_name,
            )
        else:
            # Backward-compatible fallback used by tests/stubs.
            all_sources = self.db.list_sources()

            # ── HARD SECURITY FILTERS (always applied) ──
            # 1. Approval gate: only approved sources are ever searched
            all_sources = [s for s in all_sources
                           if s.get("approval_status", "approved") == "approved"]

            # 2. Visibility gate: only sources at or below the requested level
            visibility_hierarchy = {"public": 0, "internal": 1, "confidential": 2}
            max_level = visibility_hierarchy.get(visibility, 0)
            all_sources = [s for s in all_sources
                           if visibility_hierarchy.get(
                               s.get("visibility", "public"), 0) <= max_level]

        # If specific source_ids were requested, intersect with security
        if source_ids:
            allowed_ids = {s["source_id"] for s in all_sources}
            return [sid for sid in source_ids if sid in allowed_ids] or ["__none__"]

        # ── SOFT FILTERS (optional, applied after security) ──
        matching = all_sources

        if tags:
            matching = [s for s in matching
                        if any(t in s.get("tags", []) for t in tags)]

        if doc_type:
            matching = [s for s in matching
                        if s.get("doc_type", "general") == doc_type]

        if sector:
            matching = [s for s in matching
                        if s.get("metadata", {}).get("sector") == sector
                        or sector in s.get("tags", [])]

        if ministry_name:
            normalized_ministry = " ".join((ministry_name or "").strip().lower().split())
            matching = [
                s for s in matching
                if " ".join(str(s.get("ministry_name") or "").strip().lower().split()) == normalized_ministry
                or " ".join(str(s.get("ministry_type") or "").strip().lower().split()) == normalized_ministry
            ]

        if tags or doc_type or sector or ministry_name:
            return [s["source_id"] for s in matching] if matching else ["__none__"]

        # No soft filters: return all approved+visible source IDs
        return [s["source_id"] for s in all_sources] if all_sources else ["__none__"]

    def _enrich_results(self, raw_results: list[dict]) -> list[dict]:
        """Add source metadata and chunk text to each result."""
        if not raw_results:
            return []

        # Single joined payload minimizes DB round trips and JSON parsing overhead.
        enrichment_rows = self.db.get_chunk_enrichment_rows([r["chunk_id"] for r in raw_results])
        enriched = []

        for r in raw_results:
            row = enrichment_rows.get(r["chunk_id"])
            if row is None:
                continue

            sid = row["source_id"]
            chunk_metadata = row.get("chunk_metadata") or {}
            chunk_type = row.get("chunk_type") or row["file_type"]
            # Backward compatibility: older ingestions stored PDF chunks as "pdf".
            if chunk_type == "pdf":
                chunk_type = "pdf_page_image"
            page_text = chunk_metadata.get("text", "")
            if chunk_type in ("pdf_page", "pdf_page_image") and not EXTRACT_PDF_TEXT:
                page_text = ""

            page = r["page"]
            image_url = f"/sources/{sid}/page/{page}"
            # Keep viewer behavior stable: any PDF page retrieval result is represented as pdf_page.
            response_chunk_type = (
                "pdf_page" if chunk_type in ("pdf_page", "pdf_page_image", "pdf_page_text") else chunk_type
            )

            enriched.append({
                "chunk_id": r["chunk_id"],
                "source_id": sid,
                "source_name": row["source_name"],
                "filename": row["filename"],
                "page": page,
                "text": page_text,
                "score": r["score"],
                "version": row["current_version"],
                "chunk_type": response_chunk_type,
                "metadata": {
                    "retrieval_chunk_type": chunk_type,
                    "image_url": image_url,
                    "tags": row.get("tags", []),
                    "language": row.get("language", "auto"),
                    "ministry_name": row.get("ministry_name"),
                    "ministry_type": row.get("ministry_type", "general"),
                    **(row.get("source_metadata") or {}),
                },
            })

        return enriched
