"""
Agent Service — Amendment Reasoning
Detects when cited clauses may be superseded by amendments.
Cross-references original laws with amending laws in the Knowledge Service.
"""
import asyncio
import logging
import time
from core.tools import KnowledgeTools

logger = logging.getLogger("agent-service.amendments")


class AmendmentChecker:
    """
    Checks whether cited sources have amendments that may supersede them.
    Uses the Knowledge Service to find related amendment documents.
    """

    def __init__(self, tools: KnowledgeTools = None):
        self.tools = tools or KnowledgeTools()

    async def check(
        self,
        chunks: list[dict],
        user_type: str = "citizen",
        allow_lookup: bool = True,
    ) -> dict:
        """
        Check for amendments related to the retrieved chunks.

        Args:
            chunks: Raw retrieved chunks from the Knowledge Service.
            user_type: User role for visibility filtering.

        Returns:
            dict with:
                has_amendments (bool): Whether any amendments were found.
                amendment_note (str|None): Arabic/English note about amendments.
                amendment_sources (list): Source names of amendments found.
                amendment_lookup_total (float): Time spent in external amendment lookups.
                amendment_lookup_count (int): Number of lookup calls performed.
        """
        if not chunks:
            return {
                "has_amendments": False,
                "amendment_note": None,
                "amendment_sources": [],
                "amendment_lookup_total": 0.0,
                "amendment_lookup_count": 0,
            }

        # Identify original (non-amendment) sources
        original_sources = {}
        amendment_sources_in_results = []

        for chunk in chunks:
            metadata = chunk.get("metadata", {})
            source_name = chunk.get("source_name", "")
            source_id = chunk.get("source_id", "")
            is_amendment = metadata.get("is_amendment", False)

            if is_amendment:
                amendment_sources_in_results.append({
                    "source_name": source_name,
                    "amends_target": metadata.get("amends_target", ""),
                    "document_year": metadata.get("document_year", ""),
                })
            elif source_id not in original_sources:
                original_sources[source_id] = {
                    "source_name": source_name,
                    "document_year": metadata.get("document_year", ""),
                    "sector": metadata.get("sector", "general"),
                }

        # If we already have amendments in the retrieved chunks, note them
        if amendment_sources_in_results:
            note = self._build_amendment_note(amendment_sources_in_results)
            return {
                "has_amendments": True,
                "amendment_note": note,
                "amendment_sources": [a["source_name"] for a in amendment_sources_in_results],
                "amendment_lookup_total": 0.0,
                "amendment_lookup_count": 0,
            }

        if not allow_lookup:
            return {
                "has_amendments": False,
                "amendment_note": None,
                "amendment_sources": [],
                "amendment_lookup_total": 0.0,
                "amendment_lookup_count": 0,
            }

        # Search for amendments to the original sources we cited (parallel)
        found_amendments = []
        lookup_total = 0.0
        lookup_count = len(original_sources)

        async def _lookup_one(source_id: str, info: dict) -> tuple[float, list[dict]]:
            t0 = time.time()
            result = await self._find_amendments_for(
                source_name=info["source_name"],
                sector=info["sector"],
                user_type=user_type,
            )
            return time.time() - t0, result

        tasks = [_lookup_one(sid, info) for sid, info in original_sources.items()]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for res in results:
            if isinstance(res, Exception):
                logger.warning("Amendment lookup error: %s", res)
                continue
            elapsed, amendments = res
            lookup_total += elapsed
            found_amendments.extend(amendments)

        if found_amendments:
            note = self._build_amendment_note(found_amendments)
            return {
                "has_amendments": True,
                "amendment_note": note,
                "amendment_sources": [a["source_name"] for a in found_amendments],
                "amendment_lookup_total": round(lookup_total, 3),
                "amendment_lookup_count": lookup_count,
            }

        return {
            "has_amendments": False,
            "amendment_note": None,
            "amendment_sources": [],
            "amendment_lookup_total": round(lookup_total, 3),
            "amendment_lookup_count": lookup_count,
        }

    async def _find_amendments_for(self, source_name: str, sector: str,
                                   user_type: str) -> list[dict]:
        """Search the Knowledge Service for amendments that target this source."""
        try:
            chunks = await self.tools.search_knowledge_async(
                query=source_name,
                sector=sector,
                user_type=user_type,
                doc_type="regulation",
                top_k=3,
            )

            amendments = []
            for chunk in chunks:
                metadata = chunk.get("metadata", {})
                if metadata.get("is_amendment", False):
                    amends_target = metadata.get("amends_target", "")
                    # Check if this amendment targets our source
                    if amends_target and (
                        amends_target in source_name or source_name in amends_target
                    ):
                        amendments.append({
                            "source_name": chunk.get("source_name", ""),
                            "amends_target": amends_target,
                            "document_year": metadata.get("document_year", ""),
                        })
            return amendments
        except Exception as e:
            logger.warning(f"Amendment search failed for '{source_name}': {e}")
            return []

    def _build_amendment_note(self, amendments: list[dict]) -> str:
        """Build a human-readable amendment note."""
        if not amendments:
            return None

        if len(amendments) == 1:
            a = amendments[0]
            return (
                f"تنبيه: هذا القانون تم تعديله بموجب {a['source_name']}"
                f"{' لسنة ' + a['document_year'] if a.get('document_year') else ''}. "
                f"يرجى مراجعة التعديل للتأكد من الأحكام السارية."
            )

        amendment_list = "، ".join(
            f"{a['source_name']}"
            f"{' (' + a['document_year'] + ')' if a.get('document_year') else ''}"
            for a in amendments
        )
        return (
            f"تنبيه: هناك تعديلات على التشريعات المذكورة: {amendment_list}. "
            f"يرجى مراجعة التعديلات للتأكد من الأحكام السارية."
        )


async def check(response: dict, checker: AmendmentChecker | None = None) -> dict:
    """
    Async post-generation amendment stage entrypoint.

    Args:
        response: Post-generation payload with `chunks`/`raw_chunks`, `user_type`, and
            optional `allow_amendment_lookup` flag.
    """
    stage_checker = checker or AmendmentChecker()
    chunks = response.get("chunks") or response.get("raw_chunks") or []
    user_type = str(response.get("user_type") or "citizen")
    allow_lookup = bool(response.get("allow_amendment_lookup", True))
    return await stage_checker.check(chunks=chunks, user_type=user_type, allow_lookup=allow_lookup)
