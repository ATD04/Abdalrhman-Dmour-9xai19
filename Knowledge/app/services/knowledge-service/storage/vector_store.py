"""
Knowledge Service — Vector Store
Stores embeddings on disk as JSON files (one per source), or in Supabase pgvector.
Provides cosine similarity search across all or filtered sources.
"""
import json
import logging
import math
from pathlib import Path
from config import VECTORS_DIR, USE_SUPABASE, DATABASE_URL, EMBEDDING_DIMENSIONS

try:
    from ministries import MINISTRY_PARTITION_NAMES, DEFAULT_MINISTRY
except ImportError:
    MINISTRY_PARTITION_NAMES = [
        "civil_status_agent", "civil_service_agent",
        "labor_agent", "justice_agent", "digital_economy_agent",
    ]
    DEFAULT_MINISTRY = "general"

try:
    import psycopg
    from psycopg.rows import dict_row
    from psycopg.types.json import Jsonb
except Exception:  # pragma: no cover
    psycopg = None
    dict_row = None
    Jsonb = None


logger = logging.getLogger("knowledge-service.vector_store")


class VectorStore:
    """File-based or Supabase-backed vector store."""

    def __init__(self, vectors_dir: Path = VECTORS_DIR):
        self.vectors_dir = vectors_dir
        self.vectors_dir.mkdir(parents=True, exist_ok=True)
        self.use_supabase = USE_SUPABASE
        self.database_url = DATABASE_URL
        self._cached_pg_embedding_dim: int | None = None

        if self.use_supabase:
            if not self.database_url:
                raise RuntimeError("USE_SUPABASE=true but DATABASE_URL is empty")
            if psycopg is None:
                raise RuntimeError("psycopg is required when USE_SUPABASE=true")
            self._init_postgres()

    def _pg_conn(self):
        url = self.database_url
        if "sslmode=" not in url:
            url = f"{url}?sslmode=require" if "?" not in url else f"{url}&sslmode=require"
        # Supabase pooler (PgBouncer transaction mode) is incompatible with
        # server-side prepared statements.
        return psycopg.connect(url, row_factory=dict_row, prepare_threshold=None)

    def _init_postgres(self):
        with self._pg_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
                cur.execute(
                    f"""
                    CREATE TABLE IF NOT EXISTS chunk_embeddings (
                        chunk_id TEXT NOT NULL,
                        source_id TEXT NOT NULL,
                        ministry_name TEXT NOT NULL DEFAULT 'general',
                        version INTEGER NOT NULL,
                        page INTEGER NOT NULL,
                        chunk_type TEXT NOT NULL,
                        modality TEXT NOT NULL,
                        page_key TEXT,
                        metadata JSONB NOT NULL DEFAULT '{{}}'::jsonb,
                        embedding vector({EMBEDDING_DIMENSIONS}) NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        PRIMARY KEY (chunk_id, ministry_name)
                    ) PARTITION BY LIST (ministry_name)
                    """
                )
                # Create per-ministry partitions + default
                self._ensure_partitions(cur)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_source ON chunk_embeddings(source_id, version)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_page ON chunk_embeddings(source_id, page)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_type ON chunk_embeddings(chunk_type, modality)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_page_key ON chunk_embeddings(page_key) WHERE page_key IS NOT NULL")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_ministry ON chunk_embeddings(ministry_name)")
                cur.execute("DROP INDEX IF EXISTS idx_chunk_embeddings_ivfflat")
                # HNSW index defined on the parent — each partition inherits its own copy.
                cur.execute(
                    """
                    CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_hnsw
                    ON chunk_embeddings USING hnsw (embedding vector_cosine_ops)
                    WITH (m = 16, ef_construction = 64)
                    """
                )
            conn.commit()

    @staticmethod
    def _ensure_partitions(cur):
        """Create a partition per ministry + DEFAULT for chunk_embeddings."""
        table = "chunk_embeddings"
        for ministry in MINISTRY_PARTITION_NAMES:
            safe_suffix = ministry.replace("_agent", "")
            partition_name = f"{table}_{safe_suffix}"
            cur.execute(
                f"""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_class WHERE relname = '{partition_name}'
                    ) THEN
                        EXECUTE format(
                            'CREATE TABLE %I PARTITION OF {table} FOR VALUES IN (%L)',
                            '{partition_name}', '{ministry}'
                        );
                    END IF;
                END $$;
                """
            )
        default_name = f"{table}_general"
        cur.execute(
            f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_class WHERE relname = '{default_name}'
                ) THEN
                    EXECUTE 'CREATE TABLE {default_name} PARTITION OF {table} DEFAULT';
                END IF;
            END $$;
            """
        )

    @staticmethod
    def _vector_literal(values: list[float]) -> str:
        return "[" + ",".join(str(float(v)) for v in values) + "]"

    def _get_pg_embedding_dim(self) -> int | None:
        if self._cached_pg_embedding_dim is not None:
            return self._cached_pg_embedding_dim

        if not self.use_supabase:
            return None

        query = """
            SELECT ((regexp_match(format_type(a.atttypid, a.atttypmod), 'vector\\((\\d+)\\)'))[1])::int AS dim
            FROM pg_attribute a
            WHERE a.attrelid = 'chunk_embeddings'::regclass
              AND a.attname = 'embedding'
              AND NOT a.attisdropped
            LIMIT 1
        """
        try:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(query)
                    row = cur.fetchone()
            if row and row.get("dim"):
                self._cached_pg_embedding_dim = int(row["dim"])
        except Exception as exc:
            logger.warning("Unable to inspect pgvector embedding dimension: %s", exc)
            self._cached_pg_embedding_dim = None

        return self._cached_pg_embedding_dim

    @staticmethod
    def _resize_vector(values: list[float], target_dim: int) -> list[float]:
        if target_dim <= 0:
            return values
        if len(values) == target_dim:
            return values
        if len(values) > target_dim:
            return values[:target_dim]
        return values + ([0.0] * (target_dim - len(values)))

    def _source_path(self, source_id: str, version: int) -> Path:
        return self.vectors_dir / f"{source_id}_v{version}.json"

    # ─── Write ────────────────────────────────────────────────────────

    def save_embeddings(self, source_id: str, version: int,
                        embeddings: list[dict],
                        ministry_name: str | None = None):
        """
        Save embeddings for a source version.
        Each item: {"chunk_id": str, "page": int, "embedding": list[float]}
        """
        if self.use_supabase:
            effective_ministry = ministry_name or DEFAULT_MINISTRY
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    for item in embeddings:
                        chunk_type = item.get("chunk_type", "text")
                        modality = item.get("modality") or ("image" if "image" in chunk_type else "text")
                        cur.execute(
                            """
                            INSERT INTO chunk_embeddings (
                                chunk_id, source_id, ministry_name, version, page, chunk_type,
                                modality, page_key, metadata, embedding
                            )
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::vector)
                            ON CONFLICT (chunk_id, ministry_name) DO UPDATE
                            SET source_id = EXCLUDED.source_id,
                                version = EXCLUDED.version,
                                page = EXCLUDED.page,
                                chunk_type = EXCLUDED.chunk_type,
                                modality = EXCLUDED.modality,
                                page_key = EXCLUDED.page_key,
                                metadata = EXCLUDED.metadata,
                                embedding = EXCLUDED.embedding
                            """,
                            (
                                item["chunk_id"],
                                source_id,
                                item.get("ministry_name", effective_ministry),
                                int(item.get("version", version)),
                                item["page"],
                                chunk_type,
                                modality,
                                item.get("page_key"),
                                Jsonb(item.get("metadata", {})),
                                self._vector_literal(item["embedding"]),
                            ),
                        )
                conn.commit()
            return

        path = self._source_path(source_id, version)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(embeddings, f, ensure_ascii=False)

    def delete_embeddings(self, source_id: str, version: int | None = None):
        """Delete embedding files for a source (specific version or all)."""
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    if version is not None:
                        cur.execute(
                            "DELETE FROM chunk_embeddings WHERE source_id = %s AND version = %s",
                            (source_id, version),
                        )
                    else:
                        cur.execute(
                            "DELETE FROM chunk_embeddings WHERE source_id = %s",
                            (source_id,),
                        )
                conn.commit()
            return

        if version is not None:
            path = self._source_path(source_id, version)
            if path.exists():
                path.unlink()
        else:
            # Delete all versions
            for f in self.vectors_dir.glob(f"{source_id}_v*.json"):
                f.unlink()

    # ─── Read ─────────────────────────────────────────────────────────

    def load_embeddings(self, source_id: str, version: int) -> list[dict]:
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT chunk_id, page, source_id
                        FROM chunk_embeddings
                        WHERE source_id = %s AND version = %s
                        ORDER BY page
                        """,
                        (source_id, version),
                    )
                    return [dict(r) for r in cur.fetchall()]

        path = self._source_path(source_id, version)
        if not path.exists():
            return []
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def load_all_embeddings(self, source_filter: list[str] | None = None) -> list[dict]:
        """
        Load embeddings from all (or filtered) sources.
        Returns a flat list with source_id attached.
        """
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    if source_filter:
                        cur.execute(
                            """
                            SELECT chunk_id, source_id, page
                            FROM chunk_embeddings
                            WHERE source_id = ANY(%s)
                            """,
                            (source_filter,),
                        )
                    else:
                        cur.execute("SELECT chunk_id, source_id, page FROM chunk_embeddings")
                    return [dict(r) for r in cur.fetchall()]

        results = []
        for f in sorted(self.vectors_dir.glob("*.json")):
            parts = f.stem.rsplit("_v", 1)
            if len(parts) != 2:
                continue
            sid = parts[0]
            if source_filter and sid not in source_filter:
                continue
            with open(f, "r", encoding="utf-8") as fh:
                items = json.load(fh)
            for item in items:
                item["source_id"] = sid
            results.extend(items)
        return results

    # ─── Search ───────────────────────────────────────────────────────

    @staticmethod
    def cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
        dot = sum(a * b for a, b in zip(vec1, vec2))
        mag1 = math.sqrt(sum(a * a for a in vec1))
        mag2 = math.sqrt(sum(b * b for b in vec2))
        if mag1 == 0 or mag2 == 0:
            return 0.0
        return dot / (mag1 * mag2)

    def search(self, query_embedding: list[float],
               source_ids: list[str] | None = None,
               top_k: int = 5,
               min_score: float = 0.0,
               ministry_name: str | None = None) -> list[dict]:
        """
        Search all loaded embeddings against a query vector.
        Returns top_k results sorted by descending similarity.
        When ministry_name is provided, Postgres prunes to that partition's HNSW index.
        """
        if self.use_supabase:
            if source_ids == ["__none__"]:
                return []
            expected_dim = self._get_pg_embedding_dim()
            if expected_dim and len(query_embedding) != expected_dim:
                logger.warning(
                    "Query embedding dimension (%d) differs from pgvector column dimension (%d); resizing query vector.",
                    len(query_embedding),
                    expected_dim,
                )
                query_embedding = self._resize_vector(query_embedding, expected_dim)
            query_vec = self._vector_literal(query_embedding)

            # Build WHERE clause dynamically for partition pruning
            conditions = []
            params: list = [query_vec]
            if source_ids:
                conditions.append("source_id = ANY(%s)")
                params.append(source_ids)
            if ministry_name:
                conditions.append("ministry_name = %s")
                params.append(ministry_name)
            conditions.append("1 - (embedding <=> %s::vector) >= %s")
            params.extend([query_vec, min_score])

            where_clause = " AND ".join(conditions)
            params.extend([query_vec, top_k])

            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        f"""
                        SELECT
                            chunk_id,
                            source_id,
                            page,
                            1 - (embedding <=> %s::vector) AS score
                        FROM chunk_embeddings
                        WHERE {where_clause}
                        ORDER BY embedding <=> %s::vector ASC
                        LIMIT %s
                        """,
                        params,
                    )
                    rows = cur.fetchall()
            return [
                {
                    "chunk_id": r["chunk_id"],
                    "source_id": r["source_id"],
                    "page": r["page"],
                    "score": round(float(r["score"]), 6),
                }
                for r in rows
            ]

        all_embeddings = self.load_all_embeddings(source_filter=source_ids)
        results = []
        for item in all_embeddings:
            score = self.cosine_similarity(query_embedding, item["embedding"])
            if score >= min_score:
                results.append({
                    "chunk_id": item["chunk_id"],
                    "source_id": item["source_id"],
                    "page": item["page"],
                    "score": round(score, 6),
                })
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]

    # ─── Stats ────────────────────────────────────────────────────────

    def total_vectors(self) -> int:
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT COUNT(*) AS n FROM chunk_embeddings")
                    row = cur.fetchone()
            return int(row["n"])

        total = 0
        for f in self.vectors_dir.glob("*.json"):
            with open(f, "r") as fh:
                total += len(json.load(fh))
        return total
