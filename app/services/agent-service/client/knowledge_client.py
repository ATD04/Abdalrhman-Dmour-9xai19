"""
Knowledge Service — Python SDK Client (Extended)
==================================================
Extended from the Knowledge Service's original client to include
sector, doc_type, and visibility parameters for agent-service integration.

Usage:
    from client.knowledge_client import KnowledgeClient

    ks = KnowledgeClient("http://localhost:8100")

    # Retrieve with security filtering
    results = ks.retrieve(
        "ما هي شروط التقاعد المبكر",
        top_k=5,
        sector="labor",
        visibility="public",
        doc_type="regulation",
    )
"""
import logging
from pathlib import Path
from typing import Optional

import aiofiles
import httpx

logger = logging.getLogger("agent-service.knowledge_client")


class KnowledgeClient:
    """
    Python SDK for the Knowledge & Retrieval Microservice.
    Extended with sector, doc_type, and visibility support for agent integration.
    """

    _shared_client: httpx.AsyncClient | None = None

    def __init__(self, base_url: str = "http://localhost:8100", timeout: float = 300):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    @classmethod
    async def startup_shared_client(
        cls,
        base_url: str,
        timeout: float = 300,
    ) -> None:
        """Initialize one pooled AsyncClient for service lifetime."""
        if cls._shared_client is not None:
            return
        limits = httpx.Limits(max_connections=100, max_keepalive_connections=20)
        cls._shared_client = httpx.AsyncClient(timeout=timeout, limits=limits)
        logger.info("KnowledgeClient shared AsyncClient started for %s", base_url.rstrip("/"))

    @classmethod
    async def shutdown_shared_client(cls) -> None:
        """Close pooled AsyncClient at shutdown."""
        if cls._shared_client is None:
            return
        await cls._shared_client.aclose()
        cls._shared_client = None
        logger.info("KnowledgeClient shared AsyncClient closed")

    def _get_client(self) -> httpx.AsyncClient:
        if self._shared_client is None:
            # Fallback for test and ad-hoc contexts where startup hooks are not used.
            limits = httpx.Limits(max_connections=100, max_keepalive_connections=20)
            self.__class__._shared_client = httpx.AsyncClient(timeout=self.timeout, limits=limits)
        return self._shared_client

    async def close(self) -> None:
        """Instance close delegates to shared pool shutdown for compatibility."""
        await self.shutdown_shared_client()

    # ─── Ingest ───────────────────────────────────────────────────────

    async def ingest(self, file_path: str,
                     source_name: str = "",
                     tags: list[str] = None,
                     language: str = "auto",
                     chunk_strategy: str = "page") -> dict:
        """
        Upload and embed a document.

        Args:
            file_path: Path to the file (PDF, image, text, HTML, DOCX, PPTX).
            source_name: Human-readable label. Defaults to filename.
            tags: List of tags for filtering.
            language: Language hint ("ar", "en"). Default: "auto".
            chunk_strategy: How to chunk the file: "page", "fixed", "paragraph".

        Returns:
            dict with source_id, filename, chunks_created, version, status.
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        async with aiofiles.open(path, "rb") as f:
            file_bytes = await f.read()

        files = {"file": (path.name, file_bytes, "application/octet-stream")}
        data = {
            "source_name": source_name or path.name,
            "tags": ",".join(tags) if tags else "",
            "language": language,
            "chunk_strategy": chunk_strategy,
        }
        client = self._get_client()
        resp = await client.post(
            f"{self.base_url}/ingest",
            files=files,
            data=data,
        )
        resp.raise_for_status()
        return resp.json()

    # ─── Retrieve ─────────────────────────────────────────────────────

    async def retrieve(self, query: str,
                       top_k: int = 5,
                       source_ids: Optional[list[str]] = None,
                       tags: Optional[list[str]] = None,
                       min_score: float = 0.0,
                       sector: Optional[str] = None,
                       doc_type: Optional[str] = None,
                       ministry_name: Optional[str] = None,
                       visibility: str = "public",
                       query_embedding: list[float] | None = None) -> dict:
        """
        Semantic search across all or filtered sources.

        Args:
            query: Natural language query (any language).
            top_k: Number of results to return.
            source_ids: Filter by specific source IDs.
            tags: Filter by tags.
            min_score: Minimum similarity score threshold (0.0-1.0).
            sector: Filter by government sector (e.g. 'labor', 'health').
            doc_type: Filter by document type ('regulation' or 'general').
            visibility: Max visibility level: 'public' | 'internal' | 'confidential'.
                        CRITICAL: Must be set based on user_type for security.

        Returns:
            dict with results (list of matches), query, total_searched, embedding_dim.
        """
        payload = {
            "query": query,
            "top_k": top_k,
            "min_score": min_score,
            "visibility": visibility,
        }
        if source_ids:
            payload["source_ids"] = source_ids
        if tags:
            payload["tags"] = tags
        if sector:
            payload["sector"] = sector
        if doc_type:
            payload["doc_type"] = doc_type
        if ministry_name:
            payload["ministry_name"] = ministry_name
        if query_embedding:
            payload["query_embedding"] = query_embedding

        client = self._get_client()
        resp = await client.post(
            f"{self.base_url}/retrieve",
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()

    # ─── Sources ──────────────────────────────────────────────────────

    async def list_sources(self) -> dict:
        """List all ingested sources with metadata."""
        client = self._get_client()
        resp = await client.get(f"{self.base_url}/sources")
        resp.raise_for_status()
        return resp.json()

    async def get_source(self, source_id: str) -> dict:
        """Get details for a specific source."""
        client = self._get_client()
        resp = await client.get(f"{self.base_url}/sources/{source_id}")
        resp.raise_for_status()
        return resp.json()

    async def get_source_chunks(self, source_id: str) -> dict:
        """Get all text chunks for a source, ordered by page."""
        client = self._get_client()
        resp = await client.get(f"{self.base_url}/sources/{source_id}/chunks")
        resp.raise_for_status()
        return resp.json()

    async def delete_source(self, source_id: str) -> dict:
        """Delete a source and all its data."""
        client = self._get_client()
        resp = await client.delete(f"{self.base_url}/sources/{source_id}")
        resp.raise_for_status()
        return resp.json()

    def get_page_image_url(self, source_id: str, page_num: int) -> str:
        """Get the URL for a rendered page image."""
        return f"{self.base_url}/sources/{source_id}/page/{page_num}"

    # ─── Versions ─────────────────────────────────────────────────────

    async def list_versions(self, source_id: str) -> dict:
        """List version history for a source."""
        client = self._get_client()
        resp = await client.get(f"{self.base_url}/versions/{source_id}")
        resp.raise_for_status()
        return resp.json()

    # ─── Health ───────────────────────────────────────────────────────

    async def health(self) -> dict:
        """Check service health."""
        client = self._get_client()
        resp = await client.get(f"{self.base_url}/health")
        resp.raise_for_status()
        return resp.json()

    # ─── Helpers ──────────────────────────────────────────────────────

    async def ingest_directory(self, dir_path: str,
                               extensions: list[str] = None,
                               tags: list[str] = None,
                               language: str = "auto") -> list[dict]:
        """
        Ingest all files from a directory.

        Args:
            dir_path: Path to the directory.
            extensions: File extensions to include.
            tags: Tags to apply to all files.
            language: Language hint.

        Returns:
            List of ingestion results.
        """
        extensions = extensions or [".pdf", ".png", ".jpg", ".jpeg", ".txt", ".html", ".docx", ".pptx"]
        dir_p = Path(dir_path)
        if not dir_p.is_dir():
            raise NotADirectoryError(f"Not a directory: {dir_path}")

        results = []
        for f in sorted(dir_p.iterdir()):
            if f.suffix.lower() in extensions and f.is_file():
                result = await self.ingest(
                    str(f),
                    source_name=f.stem,
                    tags=tags,
                    language=language,
                )
                results.append(result)
        return results
