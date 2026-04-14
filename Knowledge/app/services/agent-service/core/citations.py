"""
Agent Service — Citation Extraction & Enforcement
Ensures every response includes properly structured citations
that map to actual retrieved chunks (no fabricated citations).
"""
import logging

from models.schemas import Citation

logger = logging.getLogger("agent-service.citations")


def _extract_from_chunks(chunks: list[dict]) -> list[Citation]:
    citations = []
    seen = set()

    for chunk in chunks:
        source_id = chunk.get("source_id", "")
        page = chunk.get("page", 0)
        key = f"{source_id}_{page}"

        if key in seen:
            continue
        seen.add(key)

        metadata = chunk.get("metadata", {})
        citations.append(
            Citation(
                source_name=chunk.get("source_name", "Unknown"),
                source_id=source_id,
                page=page,
                document_year=metadata.get("document_year"),
                is_amendment=metadata.get("is_amendment", False),
                relevance_score=round(chunk.get("score", 0), 4),
            )
        )

    return citations


async def extract(response: dict) -> list[Citation]:
    """
    Async post-generation citation extractor entrypoint.

    Args:
        response: Post-generation payload containing `chunks` or `raw_chunks`.
    """
    chunks = response.get("chunks") or response.get("raw_chunks") or []
    return _extract_from_chunks(chunks)


class CitationExtractor:
    """
    Extracts structured citations from retrieved chunks.
    Validates that citations correspond to actual evidence.
    """

    def extract(self, chunks: list[dict]) -> list[Citation]:
        """
        Convert raw retrieved chunks into structured Citation objects.
        Deduplicates by source_id + page.

        Args:
            chunks: Raw chunk results from the Knowledge Service.

        Returns:
            List of Citation objects.
        """
        return _extract_from_chunks(chunks)

    def has_amendments(self, citations: list[Citation]) -> bool:
        """Check if any citation is an amendment."""
        return any(c.is_amendment for c in citations)

    def get_amendment_sources(self, chunks: list[dict]) -> list[dict]:
        """Get chunks that are from amendment documents."""
        return [c for c in chunks if c.get("metadata", {}).get("is_amendment", False)]

    def get_original_sources(self, chunks: list[dict]) -> list[dict]:
        """Get chunks that are from original (non-amendment) documents."""
        return [c for c in chunks if not c.get("metadata", {}).get("is_amendment", False)]
