"""
Agent Service — Tool Abstraction Layer
All Knowledge Service interactions go through this layer.
Security: user_type -> visibility mapping is enforced here.
"""
import asyncio
import hashlib
import inspect
import json
import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Coroutine, Optional

import config
from cache import get_redis
from client.knowledge_client import KnowledgeClient

logger = logging.getLogger("agent-service.tools")

# Security mapping
VISIBILITY_MAP = {
    "citizen": "public",
    "employee": "internal",
    "admin": "confidential",
}


class KnowledgeTools:
    """
    Typed tool layer for Knowledge Service interactions.
    Enforces visibility mapping on every call.
    """

    def __init__(self, client: Optional[KnowledgeClient] = None):
        self.client = client or KnowledgeClient(base_url=config.KNOWLEDGE_SERVICE_URL)

    @staticmethod
    def _normalize_query_for_cache(query: str) -> str:
        lowered = (query or "").strip().lower()
        lowered = re.sub(r"[^\w\u0600-\u06FF\s]", " ", lowered)
        return " ".join(lowered.split())

    @staticmethod
    def _semantic_rank_chunks(chunks: list[dict]) -> list[dict]:
        if not chunks:
            return []
        ranked = sorted(
            chunks,
            key=lambda c: float(c.get("score", 0.0) or 0.0),
            reverse=True,
        )
        return ranked

    @staticmethod
    def _evidence_concentration(chunks: list[dict]) -> float:
        if not chunks:
            return 0.0
        ranked = sorted((float(c.get("score", 0.0) or 0.0) for c in chunks), reverse=True)
        top = ranked[0]
        denom = sum(ranked[: min(4, len(ranked))])
        if denom <= 0.0:
            return 0.0
        return max(0.0, min(1.0, top / denom))

    @staticmethod
    def _mean_top_score(chunks: list[dict], top_n: int = 3) -> float:
        if not chunks:
            return 0.0
        ranked = sorted((float(c.get("score", 0.0) or 0.0) for c in chunks), reverse=True)
        top_scores = ranked[: min(top_n, len(ranked))]
        return sum(top_scores) / len(top_scores)

    @staticmethod
    def _prefer_text_chunks(chunks: list[dict]) -> list[dict]:
        """
        For each (source_id, page), keep the best text chunk if available;
        otherwise keep the top chunk for that page.
        """
        if not chunks:
            return []

        grouped: dict[tuple[str, int], list[dict]] = {}
        for chunk in chunks:
            key = (chunk.get("source_id", ""), int(chunk.get("page", 0) or 0))
            grouped.setdefault(key, []).append(chunk)

        selected = []
        for _, group in grouped.items():
            text_candidates = [
                c
                for c in group
                if (c.get("metadata", {}) or {}).get("retrieval_chunk_type") == "pdf_page_text"
                or (c.get("text", "") or "").strip()
            ]
            pool = text_candidates or group
            best = max(pool, key=lambda c: float(c.get("score", 0.0) or 0.0))
            selected.append(best)

        selected.sort(key=lambda c: float(c.get("score", 0.0) or 0.0), reverse=True)
        return selected

    def _is_semantically_weak(self, chunks: list[dict]) -> bool:
        if not chunks:
            return True
        max_score = max(float(c.get("score", 0.0) or 0.0) for c in chunks)
        mean_top = self._mean_top_score(chunks)
        concentration = self._evidence_concentration(chunks)
        return (
            max_score < config.SEMANTIC_PRIMARY_MIN_SCORE
            or mean_top < config.SEMANTIC_PRIMARY_MIN_AVG_SCORE
            or concentration < config.SEMANTIC_PRIMARY_MIN_CONCENTRATION
        )

    @staticmethod
    def _resolve_maybe_awaitable(value):
        """Resolve sync values and awaitables from mixed client implementations."""
        if not inspect.isawaitable(value):
            return value

        if inspect.iscoroutine(value):
            coroutine: Coroutine = value
        else:
            async def _await_wrapped():
                return await value

            coroutine = _await_wrapped()

        try:
            asyncio.get_running_loop()
            has_running_loop = True
        except RuntimeError:
            has_running_loop = False

        if not has_running_loop:
            return asyncio.run(coroutine)

        # Defensive path for accidental sync calls inside an active event loop.
        with ThreadPoolExecutor(max_workers=1) as executor:
            return executor.submit(lambda: asyncio.run(coroutine)).result()

    @staticmethod
    async def _await_maybe(value):
        """Resolve sync values and awaitables while staying on the current event loop."""
        if inspect.isawaitable(value):
            return await value
        return value

    def search_knowledge(
        self,
        query: str,
        sector: Optional[str] = None,
        ministry_name: Optional[str] = None,
        user_type: str = "citizen",
        doc_type: Optional[str] = None,
        top_k: int = 5,
        tags: Optional[list[str]] = None,
        min_score: float = 0.0,
        query_embedding: list[float] | None = None,
    ) -> list[dict]:
        """Search Knowledge Service with semantic ranking and bounded filter widening."""
        visibility = VISIBILITY_MAP.get(user_type, "public")
        strict_scope = bool(getattr(config, "ENFORCE_STRICT_SCOPE_FILTERS", False))
        effective_sector = sector if strict_scope and sector and sector != "general" else None
        effective_ministry = (ministry_name or "").strip() or None
        if not strict_scope and not ministry_name:
            effective_ministry = None

        r = get_redis()
        cache_key = None
        if r:
            normalized_query = self._normalize_query_for_cache(query)
            emb_fingerprint = "no_emb"
            if query_embedding:
                emb_fingerprint = hashlib.sha256(
                    ",".join(f"{x:.4f}" for x in query_embedding[:64]).encode("utf-8")
                ).hexdigest()
            key_parts = (
                f"{normalized_query}|{effective_sector}|{effective_ministry}|{doc_type}|{visibility}|{top_k}|{min_score}|"
                f"{sorted(tags or [])}|{emb_fingerprint}"
            )
            cache_key = f"search:{hashlib.sha256(key_parts.encode('utf-8')).hexdigest()}"
            try:
                cached = r.get(cache_key)
                if isinstance(cached, (str, bytes, bytearray)) and cached:
                    logger.info(f"[CACHE HIT] search '{query[:50]}'")
                    payload = cached.decode("utf-8") if isinstance(cached, (bytes, bytearray)) else cached
                    return json.loads(payload)
            except Exception:
                pass

        logger.info(
            "search_knowledge: query='%s...' sector=%s ministry=%s effective_sector=%s effective_ministry=%s strict_scope=%s visibility=%s doc_type=%s top_k=%s",
            query[:60],
            sector,
            ministry_name,
            effective_sector,
            effective_ministry,
            strict_scope,
            visibility,
            doc_type,
            top_k,
        )

        try:
            t_total = time.time()
            candidate_multiplier = max(1, int(config.RETRIEVAL_CANDIDATE_MULTIPLIER))
            candidate_cap = max(top_k, int(config.RETRIEVAL_CANDIDATE_CAP))
            if config.ENABLE_SERIAL_RETRIEVAL_FALLBACK:
                # Preserve higher recall when fallback retrieval is active.
                candidate_multiplier = max(candidate_multiplier, 4)
                candidate_cap = max(candidate_cap, 25)
            candidate_k = max(top_k, min(top_k * candidate_multiplier, candidate_cap))

            t_primary = time.time()
            primary = self._resolve_maybe_awaitable(self.client.retrieve(
                query=query,
                top_k=candidate_k,
                sector=effective_sector,
                ministry_name=effective_ministry,
                doc_type=doc_type,
                visibility=visibility,
                tags=tags,
                min_score=min_score,
                query_embedding=query_embedding,
            ))
            primary_elapsed = round(time.time() - t_primary, 3)
            primary_chunks = self._semantic_rank_chunks(primary.get("results", []))
            primary_chunks = self._prefer_text_chunks(primary_chunks)[:top_k]

            fallback_used = False
            fallback_elapsed = 0.0
            final_chunks = primary_chunks

            primary_weak = self._is_semantically_weak(primary_chunks)
            should_widen = (
                config.ENABLE_SERIAL_RETRIEVAL_FALLBACK
                and not strict_scope
                and (effective_sector or effective_ministry)
                and primary_weak
            )
            if should_widen:
                fallback_used = True
                t_fallback = time.time()
                fallback = self._resolve_maybe_awaitable(self.client.retrieve(
                    query=query,
                    top_k=candidate_k,
                    sector=None,
                    ministry_name=None,
                    doc_type=doc_type,
                    visibility=visibility,
                    tags=tags,
                    min_score=min_score,
                    query_embedding=query_embedding,
                ))
                fallback_elapsed = round(time.time() - t_fallback, 3)
                fallback_chunks = self._semantic_rank_chunks(fallback.get("results", []))
                fallback_chunks = self._prefer_text_chunks(fallback_chunks)[:top_k]

                primary_max = max((float(c.get("score", 0.0) or 0.0) for c in primary_chunks), default=0.0)
                fallback_max = max((float(c.get("score", 0.0) or 0.0) for c in fallback_chunks), default=0.0)
                primary_conc = self._evidence_concentration(primary_chunks)
                fallback_conc = self._evidence_concentration(fallback_chunks)

                if fallback_chunks and (
                    primary_weak
                    or fallback_max > primary_max + 0.01
                    or fallback_conc > primary_conc + 0.03
                ):
                    final_chunks = fallback_chunks
            elif primary_weak and (effective_sector or effective_ministry):
                logger.info(
                    "search_knowledge: weak scoped evidence but fallback is disabled (single-pass mode)"
                )

            logger.info(
                "search_knowledge timings: total=%ss primary=%ss fallback_used=%s fallback=%ss candidate_k=%s",
                round(time.time() - t_total, 3),
                primary_elapsed,
                fallback_used,
                fallback_elapsed,
                candidate_k,
            )

            if r and cache_key and final_chunks:
                try:
                    r.setex(cache_key, 7200, json.dumps(final_chunks))
                    logger.info(f"[CACHE SET] search '{query[:50]}' -> {len(final_chunks)} chunks")
                except Exception:
                    pass

            return final_chunks
        except Exception as exc:
            logger.error(f"Knowledge Service search failed: {exc}")
            return []

    async def search_knowledge_async(
        self,
        query: str,
        sector: Optional[str] = None,
        ministry_name: Optional[str] = None,
        user_type: str = "citizen",
        doc_type: Optional[str] = None,
        top_k: int = 5,
        tags: Optional[list[str]] = None,
        min_score: float = 0.0,
        query_embedding: list[float] | None = None,
    ) -> list[dict]:
        """Async-native retrieval path that avoids cross-event-loop client usage."""
        visibility = VISIBILITY_MAP.get(user_type, "public")
        strict_scope = bool(getattr(config, "ENFORCE_STRICT_SCOPE_FILTERS", False))
        effective_sector = sector if strict_scope and sector and sector != "general" else None
        effective_ministry = (ministry_name or "").strip() or None
        if not strict_scope and not ministry_name:
            effective_ministry = None

        r = get_redis()
        cache_key = None
        if r:
            normalized_query = self._normalize_query_for_cache(query)
            emb_fingerprint = "no_emb"
            if query_embedding:
                emb_fingerprint = hashlib.sha256(
                    ",".join(f"{x:.4f}" for x in query_embedding[:64]).encode("utf-8")
                ).hexdigest()
            key_parts = (
                f"{normalized_query}|{effective_sector}|{effective_ministry}|{doc_type}|{visibility}|{top_k}|{min_score}|"
                f"{sorted(tags or [])}|{emb_fingerprint}"
            )
            cache_key = f"search:{hashlib.sha256(key_parts.encode('utf-8')).hexdigest()}"
            try:
                cached = r.get(cache_key)
                if isinstance(cached, (str, bytes, bytearray)) and cached:
                    logger.info(f"[CACHE HIT] search '{query[:50]}'")
                    payload = cached.decode("utf-8") if isinstance(cached, (bytes, bytearray)) else cached
                    return json.loads(payload)
            except Exception:
                pass

        logger.info(
            "search_knowledge_async: query='%s...' sector=%s ministry=%s effective_sector=%s effective_ministry=%s strict_scope=%s visibility=%s doc_type=%s top_k=%s",
            query[:60],
            sector,
            ministry_name,
            effective_sector,
            effective_ministry,
            strict_scope,
            visibility,
            doc_type,
            top_k,
        )

        try:
            t_total = time.time()
            candidate_multiplier = max(1, int(config.RETRIEVAL_CANDIDATE_MULTIPLIER))
            candidate_cap = max(top_k, int(config.RETRIEVAL_CANDIDATE_CAP))
            if config.ENABLE_SERIAL_RETRIEVAL_FALLBACK:
                # Preserve higher recall when fallback retrieval is active.
                candidate_multiplier = max(candidate_multiplier, 4)
                candidate_cap = max(candidate_cap, 25)
            candidate_k = max(top_k, min(top_k * candidate_multiplier, candidate_cap))

            t_primary = time.time()
            primary = await self._await_maybe(
                self.client.retrieve(
                    query=query,
                    top_k=candidate_k,
                    sector=effective_sector,
                    ministry_name=effective_ministry,
                    doc_type=doc_type,
                    visibility=visibility,
                    tags=tags,
                    min_score=min_score,
                    query_embedding=query_embedding,
                )
            )
            primary_elapsed = round(time.time() - t_primary, 3)
            primary_chunks = self._semantic_rank_chunks(primary.get("results", []))
            primary_chunks = self._prefer_text_chunks(primary_chunks)[:top_k]

            fallback_used = False
            fallback_elapsed = 0.0
            final_chunks = primary_chunks

            primary_weak = self._is_semantically_weak(primary_chunks)
            should_widen = (
                config.ENABLE_SERIAL_RETRIEVAL_FALLBACK
                and not strict_scope
                and (effective_sector or effective_ministry)
                and primary_weak
            )
            if should_widen:
                fallback_used = True
                t_fallback = time.time()
                fallback = await self._await_maybe(
                    self.client.retrieve(
                        query=query,
                        top_k=candidate_k,
                        sector=None,
                        ministry_name=None,
                        doc_type=doc_type,
                        visibility=visibility,
                        tags=tags,
                        min_score=min_score,
                        query_embedding=query_embedding,
                    )
                )
                fallback_elapsed = round(time.time() - t_fallback, 3)
                fallback_chunks = self._semantic_rank_chunks(fallback.get("results", []))
                fallback_chunks = self._prefer_text_chunks(fallback_chunks)[:top_k]

                primary_max = max((float(c.get("score", 0.0) or 0.0) for c in primary_chunks), default=0.0)
                fallback_max = max((float(c.get("score", 0.0) or 0.0) for c in fallback_chunks), default=0.0)
                primary_conc = self._evidence_concentration(primary_chunks)
                fallback_conc = self._evidence_concentration(fallback_chunks)

                if fallback_chunks and (
                    primary_weak
                    or fallback_max > primary_max + 0.01
                    or fallback_conc > primary_conc + 0.03
                ):
                    final_chunks = fallback_chunks
            elif primary_weak and (effective_sector or effective_ministry):
                logger.info(
                    "search_knowledge_async: weak scoped evidence but fallback is disabled (single-pass mode)"
                )

            logger.info(
                "search_knowledge_async timings: total=%ss primary=%ss fallback_used=%s fallback=%ss candidate_k=%s",
                round(time.time() - t_total, 3),
                primary_elapsed,
                fallback_used,
                fallback_elapsed,
                candidate_k,
            )

            if r and cache_key and final_chunks:
                try:
                    r.setex(cache_key, 7200, json.dumps(final_chunks))
                    logger.info(f"[CACHE SET] search '{query[:50]}' -> {len(final_chunks)} chunks")
                except Exception:
                    pass

            return final_chunks
        except Exception as exc:
            logger.error(f"Knowledge Service search failed: {exc}")
            return []

    def get_source_details(self, source_id: str) -> dict:
        try:
            result = self._resolve_maybe_awaitable(self.client.get_source(source_id))
            return result if isinstance(result, dict) else {}
        except Exception as exc:
            logger.error(f"Failed to get source {source_id}: {exc}")
            return {}

    def get_page_image_url(self, source_id: str, page: int) -> str:
        return self.client.get_page_image_url(source_id, page)

    def list_sources(self) -> list[dict]:
        try:
            result = self._resolve_maybe_awaitable(self.client.list_sources())
            return result.get("sources", [])
        except Exception as exc:
            logger.error(f"Failed to list sources: {exc}")
            return []
