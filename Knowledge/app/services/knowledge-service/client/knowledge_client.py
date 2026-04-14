"""
Knowledge Service — Python SDK Client
======================================
A reusable client for integrating the Knowledge Service into other projects.

Usage:
    from client.knowledge_client import KnowledgeClient

    ks = KnowledgeClient("http://localhost:8100")

    # Ingest a document
    result = ks.ingest("report.pdf", source_name="Q4 Report", tags=["finance", "2024"])

    # Search
    results = ks.retrieve("What was the revenue?", top_k=3)

    # List sources
    sources = ks.list_sources()

    # Delete a source
    ks.delete_source("a3b8c1d2")
"""
import requests
from pathlib import Path


class KnowledgeClient:
    """
    Python SDK for the Knowledge & Retrieval Microservice.
    Drop this file into any project to integrate with the knowledge layer.
    """

    def __init__(self, base_url: str = "http://localhost:8100", timeout: int = 300):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    # ─── Ingest ───────────────────────────────────────────────────────

    def ingest(self, file_path: str,
               source_name: str = "",
               tags: list[str] = None,
               language: str = "auto",
               chunk_strategy: str = "page") -> dict:
        """
        Upload and embed a document.

        Args:
            file_path: Path to the file (PDF, image, text, HTML).
            source_name: Human-readable label. Defaults to filename.
            tags: List of tags for filtering (e.g., ["health", "2024"]).
            language: Language hint ("ar", "en"). Default: "auto".
            chunk_strategy: How to chunk the file: "page", "fixed", "paragraph".

        Returns:
            dict with source_id, filename, chunks_created, version, status.
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        with open(path, "rb") as f:
            files = {"file": (path.name, f)}
            data = {
                "source_name": source_name or path.name,
                "tags": ",".join(tags) if tags else "",
                "language": language,
                "chunk_strategy": chunk_strategy,
            }
            resp = requests.post(
                f"{self.base_url}/ingest",
                files=files,
                data=data,
                timeout=self.timeout,
            )
        resp.raise_for_status()
        return resp.json()

    # ─── Retrieve ─────────────────────────────────────────────────────

    def retrieve(self, query: str,
                 top_k: int = 5,
                 source_ids: list[str] = None,
                 tags: list[str] = None,
                 min_score: float = 0.0,
                 ministry_name: str = None) -> dict:
        """
        Semantic search across all or filtered sources.

        Args:
            query: Natural language query (any language).
            top_k: Number of results to return.
            source_ids: Filter by specific source IDs.
            tags: Filter by tags.
            min_score: Minimum similarity score threshold (0.0–1.0).

        Returns:
            dict with results (list of matches), query, total_searched, embedding_dim.
        """
        payload = {
            "query": query,
            "top_k": top_k,
            "min_score": min_score,
        }
        if source_ids:
            payload["source_ids"] = source_ids
        if tags:
            payload["tags"] = tags
        if ministry_name:
            payload["ministry_name"] = ministry_name

        resp = requests.post(
            f"{self.base_url}/retrieve",
            json=payload,
            timeout=self.timeout,
        )
        resp.raise_for_status()
        return resp.json()

    # ─── Sources ──────────────────────────────────────────────────────

    def list_sources(self) -> dict:
        """List all ingested sources with metadata."""
        resp = requests.get(f"{self.base_url}/sources", timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    def get_source(self, source_id: str) -> dict:
        """Get details for a specific source."""
        resp = requests.get(f"{self.base_url}/sources/{source_id}", timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    def delete_source(self, source_id: str) -> dict:
        """Delete a source and all its data."""
        resp = requests.delete(f"{self.base_url}/sources/{source_id}", timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    def get_page_image_url(self, source_id: str, page_num: int) -> str:
        """Get the URL for a rendered page image."""
        return f"{self.base_url}/sources/{source_id}/page/{page_num}"

    # ─── Versions ─────────────────────────────────────────────────────

    def list_versions(self, source_id: str) -> dict:
        """List version history for a source."""
        resp = requests.get(f"{self.base_url}/versions/{source_id}", timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    # ─── Health ───────────────────────────────────────────────────────

    def health(self) -> dict:
        """Check service health."""
        resp = requests.get(f"{self.base_url}/health", timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    # ─── Helpers ──────────────────────────────────────────────────────

    def ingest_directory(self, dir_path: str,
                         extensions: list[str] = None,
                         tags: list[str] = None,
                         language: str = "auto") -> list[dict]:
        """
        Ingest all files from a directory.

        Args:
            dir_path: Path to the directory.
            extensions: File extensions to include (e.g., [".pdf", ".png"]).
            tags: Tags to apply to all files.
            language: Language hint.

        Returns:
            List of ingestion results.
        """
        extensions = extensions or [".pdf", ".png", ".jpg", ".jpeg", ".txt", ".html"]
        dir_p = Path(dir_path)
        if not dir_p.is_dir():
            raise NotADirectoryError(f"Not a directory: {dir_path}")

        results = []
        for f in sorted(dir_p.iterdir()):
            if f.suffix.lower() in extensions and f.is_file():
                result = self.ingest(
                    str(f),
                    source_name=f.stem,
                    tags=tags,
                    language=language,
                )
                results.append(result)
        return results
