"""
Knowledge Service — Database (SQLite or Supabase Postgres)
Stores source metadata, chunk records, and version history.
"""
import sqlite3
import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from config import DB_PATH, USE_SUPABASE, DATABASE_URL
from cache import get_redis

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


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Database:
    """Metadata store backed by SQLite or Postgres."""

    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self.use_supabase = USE_SUPABASE
        self.database_url = DATABASE_URL

        if self.use_supabase:
            if not self.database_url:
                raise RuntimeError("USE_SUPABASE=true but DATABASE_URL is empty")
            if psycopg is None:
                raise RuntimeError("psycopg is required when USE_SUPABASE=true")

        self._init_db()

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    def _pg_conn(self):
        """Get Postgres connection."""
        url = self.database_url
        if "sslmode=" not in url:
            url = f"{url}?sslmode=require" if "?" not in url else f"{url}&sslmode=require"
        # Supabase pooler (PgBouncer transaction mode) is incompatible with
        # server-side prepared statements.
        return psycopg.connect(url, row_factory=dict_row, prepare_threshold=None)

    def _init_db(self):
        if self.use_supabase:
            self._init_postgres()
            return

        with self._conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS source_groups (
                    group_id        TEXT PRIMARY KEY,
                    group_name      TEXT NOT NULL,
                    normalized_name TEXT NOT NULL UNIQUE,
                    doc_type        TEXT DEFAULT 'regulation',
                    ministry_name   TEXT,
                    constitution_date TEXT,
                    created_at      TEXT NOT NULL,
                    updated_at      TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS sources (
                    source_id       TEXT PRIMARY KEY,
                    source_name     TEXT NOT NULL,
                    filename        TEXT NOT NULL,
                    file_type       TEXT NOT NULL,
                    doc_type        TEXT DEFAULT 'general',
                    tags            TEXT DEFAULT '[]',
                    language        TEXT DEFAULT 'auto',
                    visibility      TEXT DEFAULT 'public',
                    approval_status TEXT DEFAULT 'approved',
                    date_of_the_constitution TEXT,
                    ministry_name TEXT,
                    ministry_type TEXT DEFAULT 'general',
                    source_group_id TEXT,
                    group_role TEXT DEFAULT 'primary',
                    metadata        TEXT DEFAULT '{}',
                    current_version INTEGER DEFAULT 1,
                    created_at      TEXT NOT NULL,
                    updated_at      TEXT NOT NULL,
                    FOREIGN KEY (source_group_id) REFERENCES source_groups(group_id) ON DELETE SET NULL
                );

                CREATE TABLE IF NOT EXISTS chunks (
                    chunk_id    TEXT PRIMARY KEY,
                    source_id   TEXT NOT NULL,
                    version     INTEGER NOT NULL,
                    page        INTEGER NOT NULL,
                    chunk_type  TEXT NOT NULL,
                    metadata    TEXT DEFAULT '{}',
                    created_at  TEXT NOT NULL,
                    FOREIGN KEY (source_id) REFERENCES sources(source_id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS pdf_pages (
                    source_id      TEXT NOT NULL,
                    version        INTEGER NOT NULL,
                    page           INTEGER NOT NULL,
                    page_key       TEXT,
                    text_chunk_id  TEXT,
                    image_mime_type TEXT NOT NULL DEFAULT 'image/png',
                    image_data     BLOB NOT NULL,
                    width          INTEGER,
                    height         INTEGER,
                    metadata       TEXT DEFAULT '{}',
                    created_at     TEXT NOT NULL,
                    PRIMARY KEY (source_id, version, page),
                    FOREIGN KEY (source_id) REFERENCES sources(source_id) ON DELETE CASCADE,
                    FOREIGN KEY (text_chunk_id) REFERENCES chunks(chunk_id) ON DELETE SET NULL
                );

                CREATE TABLE IF NOT EXISTS versions (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_id   TEXT NOT NULL,
                    version     INTEGER NOT NULL,
                    chunks_created INTEGER NOT NULL,
                    is_active   INTEGER DEFAULT 1,
                    created_at  TEXT NOT NULL,
                    FOREIGN KEY (source_id) REFERENCES sources(source_id) ON DELETE CASCADE,
                    UNIQUE(source_id, version)
                );

                CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source_id);
                CREATE INDEX IF NOT EXISTS idx_chunks_version ON chunks(source_id, version);
                CREATE INDEX IF NOT EXISTS idx_pdf_pages_source ON pdf_pages(source_id, version);
                CREATE INDEX IF NOT EXISTS idx_pdf_pages_text_chunk ON pdf_pages(text_chunk_id);
                CREATE INDEX IF NOT EXISTS idx_versions_source ON versions(source_id);

                CREATE TABLE IF NOT EXISTS file_hashes (
                    hash        TEXT PRIMARY KEY,
                    source_id   TEXT NOT NULL,
                    version     INTEGER NOT NULL,
                    filename    TEXT NOT NULL,
                    created_at  TEXT NOT NULL,
                    FOREIGN KEY (source_id) REFERENCES sources(source_id) ON DELETE CASCADE
                );
            """)
            # Migrations for sqlite
            try:
                conn.execute("ALTER TABLE sources ADD COLUMN doc_type TEXT DEFAULT 'general'")
            except sqlite3.OperationalError:
                pass
            try:
                conn.execute("ALTER TABLE sources ADD COLUMN metadata TEXT DEFAULT '{}'")
            except sqlite3.OperationalError:
                pass
            try:
                conn.execute("ALTER TABLE sources ADD COLUMN visibility TEXT DEFAULT 'public'")
            except sqlite3.OperationalError:
                pass
            try:
                conn.execute("ALTER TABLE sources ADD COLUMN approval_status TEXT DEFAULT 'approved'")
            except sqlite3.OperationalError:
                pass
            try:
                conn.execute("ALTER TABLE sources ADD COLUMN date_of_the_constitution TEXT")
            except sqlite3.OperationalError:
                pass
            try:
                conn.execute("ALTER TABLE sources ADD COLUMN ministry_name TEXT")
            except sqlite3.OperationalError:
                pass
            try:
                conn.execute("ALTER TABLE sources ADD COLUMN ministry_type TEXT DEFAULT 'general'")
            except sqlite3.OperationalError:
                pass
            try:
                conn.execute("ALTER TABLE sources ADD COLUMN source_group_id TEXT")
            except sqlite3.OperationalError:
                pass
            try:
                conn.execute("ALTER TABLE sources ADD COLUMN group_role TEXT DEFAULT 'primary'")
            except sqlite3.OperationalError:
                pass
            conn.execute("CREATE INDEX IF NOT EXISTS idx_sources_visibility ON sources(visibility)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_sources_approval ON sources(approval_status)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_sources_ministry ON sources(ministry_type)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_sources_group ON sources(source_group_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_source_groups_name ON source_groups(normalized_name)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_pdf_pages_source ON pdf_pages(source_id, version)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_pdf_pages_text_chunk ON pdf_pages(text_chunk_id)")

    def _init_postgres(self):
        """Create partitioned tables in Postgres if they don't exist."""
        with self._pg_conn() as conn:
            with conn.cursor() as cur:
                # ── source_groups (partitioned by ministry_name) ──
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS source_groups (
                        group_id TEXT NOT NULL,
                        group_name TEXT NOT NULL,
                        normalized_name TEXT NOT NULL,
                        doc_type TEXT NOT NULL DEFAULT 'regulation',
                        ministry_name TEXT NOT NULL DEFAULT 'general',
                        constitution_date TEXT,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        PRIMARY KEY (group_id, ministry_name)
                    ) PARTITION BY LIST (ministry_name)
                    """
                )
                cur.execute(
                    """
                    CREATE UNIQUE INDEX IF NOT EXISTS idx_source_groups_normalized
                    ON source_groups (normalized_name, ministry_name)
                    """
                )

                # ── sources (partitioned by ministry_name) ──
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS sources (
                        source_id TEXT NOT NULL,
                        source_name TEXT NOT NULL,
                        filename TEXT NOT NULL,
                        file_type TEXT NOT NULL,
                        doc_type TEXT NOT NULL DEFAULT 'general',
                        tags JSONB NOT NULL DEFAULT '[]'::jsonb,
                        language TEXT NOT NULL DEFAULT 'auto',
                        visibility TEXT NOT NULL DEFAULT 'public',
                        approval_status TEXT NOT NULL DEFAULT 'approved',
                        date_of_the_constitution TEXT,
                        ministry_name TEXT NOT NULL DEFAULT 'general',
                        ministry_type TEXT NOT NULL DEFAULT 'general',
                        source_group_id TEXT,
                        group_role TEXT NOT NULL DEFAULT 'primary',
                        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                        current_version INTEGER NOT NULL DEFAULT 1,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        PRIMARY KEY (source_id, ministry_name)
                    ) PARTITION BY LIST (ministry_name)
                    """
                )

                # ── chunks (partitioned by ministry_name) ──
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS chunks (
                        chunk_id TEXT NOT NULL,
                        source_id TEXT NOT NULL,
                        ministry_name TEXT NOT NULL DEFAULT 'general',
                        version INTEGER NOT NULL,
                        page INTEGER NOT NULL,
                        chunk_type TEXT NOT NULL,
                        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        PRIMARY KEY (chunk_id, ministry_name)
                    ) PARTITION BY LIST (ministry_name)
                    """
                )

                # ── pdf_pages (partitioned by ministry_name) ──
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS pdf_pages (
                        source_id TEXT NOT NULL,
                        ministry_name TEXT NOT NULL DEFAULT 'general',
                        version INTEGER NOT NULL,
                        page INTEGER NOT NULL,
                        page_key TEXT,
                        text_chunk_id TEXT,
                        image_mime_type TEXT NOT NULL DEFAULT 'image/png',
                        image_data BYTEA NOT NULL,
                        width INTEGER,
                        height INTEGER,
                        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        PRIMARY KEY (source_id, ministry_name, version, page)
                    ) PARTITION BY LIST (ministry_name)
                    """
                )

                # ── versions (partitioned by ministry_name) ──
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS versions (
                        id BIGINT GENERATED BY DEFAULT AS IDENTITY,
                        source_id TEXT NOT NULL,
                        ministry_name TEXT NOT NULL DEFAULT 'general',
                        version INTEGER NOT NULL,
                        chunks_created INTEGER NOT NULL,
                        is_active BOOLEAN NOT NULL DEFAULT TRUE,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        PRIMARY KEY (id, ministry_name),
                        UNIQUE (source_id, ministry_name, version)
                    ) PARTITION BY LIST (ministry_name)
                    """
                )

                # ── file_hashes (partitioned by ministry_name) ──
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS file_hashes (
                        hash TEXT NOT NULL,
                        source_id TEXT NOT NULL,
                        ministry_name TEXT NOT NULL DEFAULT 'general',
                        version INTEGER NOT NULL,
                        filename TEXT NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        PRIMARY KEY (hash, ministry_name)
                    ) PARTITION BY LIST (ministry_name)
                    """
                )

                # ── Create partitions for each ministry + default ──
                self._ensure_partitions(cur)

                # ── Indexes (inherited by each partition automatically) ──
                cur.execute("CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_chunks_version ON chunks(source_id, version)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_pdf_pages_source ON pdf_pages(source_id, version)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_pdf_pages_text_chunk ON pdf_pages(text_chunk_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_versions_source ON versions(source_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_sources_visibility ON sources(visibility)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_sources_approval ON sources(approval_status)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_sources_ministry_type ON sources(ministry_type)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_sources_group ON sources(source_group_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_sources_ministry_name ON sources(ministry_name)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_source_groups_ministry ON source_groups(ministry_name)")
            conn.commit()

    @staticmethod
    def _ensure_partitions(cur):
        """Create a partition per ministry + a DEFAULT partition for each partitioned table."""
        tables = ["source_groups", "sources", "chunks", "pdf_pages", "versions", "file_hashes"]
        for table in tables:
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
            # DEFAULT partition for 'general' and unlisted values
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

    # ─── Sources ──────────────────────────────────────────────────────

    def _invalidate_source_metadata(self, source_id: str = None):
        r = get_redis()
        if r:
            try:
                r.delete("sources:list")
                for key in r.scan_iter("sources:retrieval:*"):
                    r.delete(key)
                if source_id:
                    r.delete(f"sources:{source_id}")
            except Exception:
                pass

    @staticmethod
    def _normalize_group_name(group_name: str) -> str:
        return " ".join((group_name or "").strip().lower().split())

    def get_source_group(self, group_id: str) -> dict | None:
        if not group_id:
            return None
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT * FROM source_groups WHERE group_id = %s",
                        (group_id,),
                    )
                    row = cur.fetchone()
        else:
            with self._conn() as conn:
                row = conn.execute(
                    "SELECT * FROM source_groups WHERE group_id = ?",
                    (group_id,),
                ).fetchone()
        return dict(row) if row is not None else None

    def find_source_group_by_name(self, group_name: str) -> dict | None:
        normalized_name = self._normalize_group_name(group_name)
        if not normalized_name:
            return None
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT * FROM source_groups WHERE normalized_name = %s",
                        (normalized_name,),
                    )
                    row = cur.fetchone()
        else:
            with self._conn() as conn:
                row = conn.execute(
                    "SELECT * FROM source_groups WHERE normalized_name = ?",
                    (normalized_name,),
                ).fetchone()
        return dict(row) if row is not None else None

    def ensure_source_group(
        self,
        group_name: str,
        doc_type: str = "regulation",
        ministry_name: str | None = None,
        constitution_date: str | None = None,
    ) -> dict | None:
        normalized_name = self._normalize_group_name(group_name)
        if not normalized_name:
            return None
        # Partitioned tables require a non-NULL ministry_name.
        effective_ministry = ministry_name or DEFAULT_MINISTRY

        existing = self.find_source_group_by_name(group_name)
        now = _now()
        if existing:
            updates = []
            params = []
            if ministry_name and not existing.get("ministry_name"):
                updates.append("ministry_name = {p}")
                params.append(ministry_name)
            if constitution_date and not existing.get("constitution_date"):
                updates.append("constitution_date = {p}")
                params.append(constitution_date)
            if updates:
                updates.append("updated_at = {p}")
                params.append(now)
                placeholder = "%s" if self.use_supabase else "?"
                set_clause = ", ".join(u.format(p=placeholder) for u in updates)
                params.append(existing["group_id"])
                if self.use_supabase:
                    with self._pg_conn() as conn:
                        with conn.cursor() as cur:
                            cur.execute(
                                f"UPDATE source_groups SET {set_clause} WHERE group_id = %s",
                                params,
                            )
                        conn.commit()
                else:
                    with self._conn() as conn:
                        conn.execute(
                            f"UPDATE source_groups SET {set_clause} WHERE group_id = ?",
                            params,
                        )
                existing = self.get_source_group(existing["group_id"])
            return existing

        group_id = hashlib.sha256(normalized_name.encode("utf-8")).hexdigest()[:12]
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """INSERT INTO source_groups (
                            group_id, group_name, normalized_name, doc_type,
                            ministry_name, constitution_date, created_at, updated_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                        (
                            group_id,
                            group_name.strip(),
                            normalized_name,
                            doc_type or "regulation",
                            effective_ministry,
                            constitution_date,
                            now,
                            now,
                        ),
                    )
                conn.commit()
        else:
            with self._conn() as conn:
                conn.execute(
                    """INSERT INTO source_groups (
                        group_id, group_name, normalized_name, doc_type,
                        ministry_name, constitution_date, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        group_id,
                        group_name.strip(),
                        normalized_name,
                        doc_type or "regulation",
                        effective_ministry,
                        constitution_date,
                        now,
                        now,
                    ),
                )
        return self.get_source_group(group_id)


    def create_source(self, source_id: str, source_name: str, filename: str,
                      file_type: str, tags: list[str], language: str,
                      doc_type: str = "general", metadata: dict = None,
                      visibility: str = "public",
                      approval_status: str = "approved",
                      date_of_the_constitution: str = None,
                      ministry_name: str | None = None,
                      ministry_type: str = "general",
                      source_group_id: str = None,
                      group_role: str = "primary") -> dict:
        now = _now()
        meta_str = json.dumps(metadata or {}, ensure_ascii=False)
        tags_str = json.dumps(tags, ensure_ascii=False)
        # Partitioned tables require a non-NULL ministry_name.
        effective_ministry = ministry_name or DEFAULT_MINISTRY

        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """INSERT INTO sources (source_id, source_name, filename, file_type,
                           doc_type, tags, language, visibility, approval_status,
                           date_of_the_constitution, ministry_name, ministry_type,
                           source_group_id, group_role,
                           current_version, created_at, updated_at, metadata)
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 1, %s, %s, %s)""",
                        (source_id, source_name, filename, file_type, doc_type,
                                 Jsonb(tags), language, visibility, approval_status,
                                 date_of_the_constitution, effective_ministry, ministry_type,
                                 source_group_id, group_role, now, now, Jsonb(metadata or {}))
                    )
                conn.commit()
        else:
            with self._conn() as conn:
                conn.execute(
                    """INSERT INTO sources (source_id, source_name, filename, file_type,
                       doc_type, tags, language, visibility, approval_status,
                       date_of_the_constitution, ministry_name, ministry_type,
                       source_group_id, group_role,
                       current_version, created_at, updated_at, metadata)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)""",
                    (source_id, source_name, filename, file_type, doc_type,
                     tags_str, language, visibility, approval_status,
                     date_of_the_constitution, ministry_name, ministry_type,
                     source_group_id, group_role, now, now, meta_str)
                )
        self._invalidate_source_metadata(source_id)
        return {"source_id": source_id, "version": 1}

    def get_source(self, source_id: str) -> dict | None:
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT * FROM sources WHERE source_id = %s", (source_id,)
                    )
                    row = cur.fetchone()
        else:
            with self._conn() as conn:
                row = conn.execute(
                    "SELECT * FROM sources WHERE source_id = ?", (source_id,)
                ).fetchone()
        
        if row is None:
            return None
        
        if self.use_supabase:
            d = dict(row) if not isinstance(row, dict) else row
            d["tags"] = d.get("tags") if isinstance(d.get("tags"), list) else []
            d["metadata"] = d.get("metadata") if isinstance(d.get("metadata"), dict) else {}
        else:
            d = dict(row)
            d["tags"] = json.loads(d["tags"]) if d.get("tags") else []
            d["metadata"] = json.loads(d["metadata"]) if d.get("metadata") else {}
        group = self.get_source_group(d.get("source_group_id"))
        d["source_group_name"] = group.get("group_name") if group else None
        return d

    def get_sources_by_ids(self, source_ids: list[str]) -> dict[str, dict]:
        """Batch-fetch source metadata keyed by source_id."""
        unique_ids = [sid for sid in dict.fromkeys(source_ids) if sid]
        if not unique_ids:
            return {}

        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT * FROM sources WHERE source_id = ANY(%s)",
                        (unique_ids,),
                    )
                    rows = cur.fetchall()
        else:
            placeholders = ",".join("?" for _ in unique_ids)
            with self._conn() as conn:
                rows = conn.execute(
                    f"SELECT * FROM sources WHERE source_id IN ({placeholders})",
                    unique_ids,
                ).fetchall()

        raw_sources = [dict(r) for r in rows]
        group_ids = sorted({s.get("source_group_id") for s in raw_sources if s.get("source_group_id")})
        group_map: dict[str, dict] = {}
        if group_ids:
            if self.use_supabase:
                with self._pg_conn() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "SELECT * FROM source_groups WHERE group_id = ANY(%s)",
                            (group_ids,),
                        )
                        group_rows = cur.fetchall()
            else:
                placeholders = ",".join("?" for _ in group_ids)
                with self._conn() as conn:
                    group_rows = conn.execute(
                        f"SELECT * FROM source_groups WHERE group_id IN ({placeholders})",
                        group_ids,
                    ).fetchall()
            group_map = {str(dict(g).get("group_id")): dict(g) for g in group_rows}

        result: dict[str, dict] = {}
        for row in raw_sources:
            if self.use_supabase:
                row["tags"] = row.get("tags") if isinstance(row.get("tags"), list) else []
                row["metadata"] = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
            else:
                row["tags"] = json.loads(row["tags"]) if row.get("tags") else []
                row["metadata"] = json.loads(row["metadata"]) if row.get("metadata") else {}

            group = group_map.get(str(row.get("source_group_id"))) if row.get("source_group_id") else None
            row["source_group_name"] = group.get("group_name") if group else None
            result[row["source_id"]] = row

        return result

    def list_sources_for_retrieval(self, visibility: str = "public",
                                   ministry_name: str | None = None) -> list[dict]:
        """
        Lightweight source listing for retrieval filters.
        Applies approval and visibility boundaries in SQL and avoids expensive joins.
        When ministry_name is provided, Postgres LIST partitioning prunes to that partition only.
        """
        visibility_hierarchy = {"public": 0, "internal": 1, "confidential": 2}
        max_level = visibility_hierarchy.get(visibility, 0)
        allowed_visibility = [
            level_name
            for level_name, level_value in visibility_hierarchy.items()
            if level_value <= max_level
        ]

        cache_key = f"sources:retrieval:{visibility}:{ministry_name or 'all'}"
        r = get_redis()
        if r:
            try:
                cached = r.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception:
                pass

        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    if ministry_name:
                        cur.execute(
                            """
                            SELECT source_id, doc_type, tags, ministry_name, ministry_type, metadata
                            FROM sources
                            WHERE approval_status = 'approved'
                              AND visibility = ANY(%s)
                              AND ministry_name = %s
                            """,
                            (allowed_visibility, ministry_name),
                        )
                    else:
                        cur.execute(
                            """
                            SELECT source_id, doc_type, tags, ministry_name, ministry_type, metadata
                            FROM sources
                            WHERE approval_status = 'approved'
                              AND visibility = ANY(%s)
                            """,
                            (allowed_visibility,),
                        )
                    rows = cur.fetchall()
        else:
            placeholders = ",".join("?" for _ in allowed_visibility)
            with self._conn() as conn:
                rows = conn.execute(
                    f"""
                    SELECT source_id, doc_type, tags, ministry_name, ministry_type, metadata
                    FROM sources
                    WHERE approval_status = 'approved'
                      AND visibility IN ({placeholders})
                    """,
                    allowed_visibility,
                ).fetchall()

        results: list[dict] = []
        for row in rows:
            d = dict(row)
            if self.use_supabase:
                d["tags"] = d.get("tags") if isinstance(d.get("tags"), list) else []
                d["metadata"] = d.get("metadata") if isinstance(d.get("metadata"), dict) else {}
            else:
                d["tags"] = json.loads(d["tags"]) if d.get("tags") else []
                d["metadata"] = json.loads(d["metadata"]) if d.get("metadata") else {}
            results.append(d)

        if r:
            try:
                r.setex(cache_key, 120, json.dumps(results, default=str))
            except Exception:
                pass

        return results

    def find_source_by_name(self, source_name: str) -> dict | None:
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT * FROM sources WHERE source_name = %s", (source_name,)
                    )
                    row = cur.fetchone()
        else:
            with self._conn() as conn:
                row = conn.execute(
                    "SELECT * FROM sources WHERE source_name = ?", (source_name,)
                ).fetchone()
        if row is None:
            return None
        d = dict(row)
        if self.use_supabase:
            d["tags"] = d.get("tags") if isinstance(d.get("tags"), list) else []
            d["metadata"] = d.get("metadata") if isinstance(d.get("metadata"), dict) else {}
        else:
            d["tags"] = json.loads(d["tags"]) if d.get("tags") else []
            d["metadata"] = json.loads(d["metadata"]) if d.get("metadata") else {}
        return d

    def list_sources(self) -> list[dict]:
        r = get_redis()
        if r:
            try:
                cached = r.get("sources:list")
                if cached:
                    return json.loads(cached)
            except Exception:
                pass

        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT s.*, COALESCE(c.total_chunks, 0) AS total_chunks
                        FROM sources s
                        LEFT JOIN (
                            SELECT source_id, version, COUNT(*) AS total_chunks
                            FROM chunks
                            GROUP BY source_id, version
                        ) c ON c.source_id = s.source_id AND c.version = s.current_version
                        ORDER BY s.updated_at DESC
                        """
                    )
                    rows = cur.fetchall()
        else:
            with self._conn() as conn:
                rows = conn.execute(
                    """
                    SELECT s.*, COALESCE(c.total_chunks, 0) AS total_chunks
                    FROM sources s
                    LEFT JOIN (
                        SELECT source_id, version, COUNT(*) AS total_chunks
                        FROM chunks
                        GROUP BY source_id, version
                    ) c ON c.source_id = s.source_id AND c.version = s.current_version
                    ORDER BY s.updated_at DESC
                    """
                ).fetchall()

        results = []
        group_cache: dict[str, dict | None] = {}
        for row in rows:
            d = dict(row)
            if self.use_supabase:
                d["tags"] = d.get("tags") if isinstance(d.get("tags"), list) else []
                d["metadata"] = d.get("metadata") if isinstance(d.get("metadata"), dict) else {}
                d["total_chunks"] = int(d.get("total_chunks") or 0)
            else:
                d["tags"] = json.loads(d["tags"]) if d.get("tags") else []
                d["metadata"] = json.loads(d["metadata"]) if d.get("metadata") else {}
                d["total_chunks"] = int(d.get("total_chunks") or 0)
            group_id = d.get("source_group_id")
            if group_id not in group_cache:
                group_cache[group_id] = self.get_source_group(group_id) if group_id else None
            group = group_cache.get(group_id)
            d["source_group_name"] = group.get("group_name") if group else None
            results.append(d)

        if r:
            try:
                r.setex("sources:list", 300, json.dumps(results, default=str))
            except Exception:
                pass

        return results

    def bump_version(self, source_id: str, tags: list[str] | None = None) -> int:
        now = _now()
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT current_version FROM sources WHERE source_id = %s",
                        (source_id,),
                    )
                    row = cur.fetchone()
                    if row is None:
                        raise ValueError(f"Source not found: {source_id}")
                    new_version = int(row["current_version"]) + 1
                    if tags is not None:
                        cur.execute(
                            """
                            UPDATE sources
                            SET current_version = %s, updated_at = %s, tags = %s
                            WHERE source_id = %s
                            """,
                            (new_version, now, Jsonb(tags), source_id),
                        )
                    else:
                        cur.execute(
                            """
                            UPDATE sources
                            SET current_version = %s, updated_at = %s
                            WHERE source_id = %s
                            """,
                            (new_version, now, source_id),
                        )
                    cur.execute(
                        "UPDATE versions SET is_active = FALSE WHERE source_id = %s",
                        (source_id,),
                    )
                conn.commit()
        else:
            with self._conn() as conn:
                source = dict(conn.execute(
                    "SELECT * FROM sources WHERE source_id = ?", (source_id,)
                ).fetchone())
                new_version = source["current_version"] + 1
                updates = {"current_version": new_version, "updated_at": now}
                if tags is not None:
                    updates["tags"] = json.dumps(tags, ensure_ascii=False)
                set_clause = ", ".join(f"{k} = ?" for k in updates)
                conn.execute(
                    f"UPDATE sources SET {set_clause} WHERE source_id = ?",
                    (*updates.values(), source_id)
                )
                # Deactivate old versions
                conn.execute(
                    "UPDATE versions SET is_active = 0 WHERE source_id = ?",
                    (source_id,)
                )
        self._invalidate_source_metadata(source_id)
        return new_version

    def update_source_labels(
        self,
        source_id: str,
        *,
        date_of_the_constitution: str | None = None,
        ministry_name: str | None = None,
        source_group_id: str | None = None,
        group_role: str | None = None,
    ) -> dict | None:
        existing = self.get_source(source_id)
        if existing is None:
            return None

        updates: dict[str, object] = {"updated_at": _now()}
        if date_of_the_constitution is not None:
            updates["date_of_the_constitution"] = date_of_the_constitution.strip() or None
        if ministry_name is not None:
            updates["ministry_name"] = ministry_name.strip() or None
        if source_group_id is not None:
            updates["source_group_id"] = source_group_id
        if group_role is not None:
            normalized_role = (group_role or "").strip().lower() or "primary"
            if normalized_role not in {"primary", "amendment", "related"}:
                normalized_role = "primary"
            updates["group_role"] = normalized_role

        if self.use_supabase:
            # Changing ministry_name on a partitioned table triggers a partition
            # move (Postgres DELETE + INSERT internally).  We need to update all
            # child tables that carry ministry_name as part of their PK so they
            # move to the same partition.
            old_ministry = existing.get("ministry_name") or DEFAULT_MINISTRY
            new_ministry = (updates.get("ministry_name") or old_ministry)
            ministry_changing = (
                ministry_name is not None
                and new_ministry != old_ministry
            )

            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    if ministry_changing:
                        # Move child rows first (they reference source's PK
                        # which includes ministry_name).
                        for child_table in ("chunks", "pdf_pages", "versions", "file_hashes"):
                            cur.execute(
                                f"UPDATE {child_table} SET ministry_name = %s "
                                f"WHERE source_id = %s AND ministry_name = %s",
                                (new_ministry, source_id, old_ministry),
                            )
                    fields = ", ".join(f"{key} = %s" for key in updates)
                    cur.execute(
                        f"UPDATE sources SET {fields} WHERE source_id = %s",
                        [*updates.values(), source_id],
                    )
                conn.commit()
        else:
            with self._conn() as conn:
                fields = ", ".join(f"{key} = ?" for key in updates)
                conn.execute(
                    f"UPDATE sources SET {fields} WHERE source_id = ?",
                    [*updates.values(), source_id],
                )

        self._invalidate_source_metadata(source_id)
        return self.get_source(source_id)

    def delete_source(self, source_id: str) -> bool:
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM sources WHERE source_id = %s", (source_id,))
                    deleted = cur.rowcount
                conn.commit()
            self._invalidate_source_metadata(source_id)
            return deleted > 0
        with self._conn() as conn:
            cursor = conn.execute(
                "DELETE FROM sources WHERE source_id = ?", (source_id,)
            )
        self._invalidate_source_metadata(source_id)
        return cursor.rowcount > 0

    # ─── PDF Pages ───────────────────────────────────────────────────

    def create_pdf_pages(self, pages: list[dict], ministry_name: str | None = None):
        if not pages:
            return
        now = _now()
        effective_ministry = ministry_name or DEFAULT_MINISTRY
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.executemany(
                        """INSERT INTO pdf_pages (
                               source_id, ministry_name, version, page, page_key, text_chunk_id,
                               image_mime_type, image_data, width, height, metadata, created_at
                           )
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                           ON CONFLICT (source_id, ministry_name, version, page) DO UPDATE
                           SET page_key = EXCLUDED.page_key,
                               text_chunk_id = EXCLUDED.text_chunk_id,
                               image_mime_type = EXCLUDED.image_mime_type,
                               image_data = EXCLUDED.image_data,
                               width = EXCLUDED.width,
                               height = EXCLUDED.height,
                               metadata = EXCLUDED.metadata""",
                        [
                            (
                                p["source_id"],
                                p.get("ministry_name", effective_ministry),
                                p["version"],
                                p["page"],
                                p.get("page_key"),
                                p.get("text_chunk_id"),
                                p.get("image_mime_type", "image/png"),
                                p["image_data"],
                                p.get("width"),
                                p.get("height"),
                                Jsonb(p.get("metadata", {})),
                                now,
                            )
                            for p in pages
                        ],
                    )
                conn.commit()
            return

        with self._conn() as conn:
            conn.executemany(
                """INSERT OR REPLACE INTO pdf_pages (
                       source_id, version, page, page_key, text_chunk_id,
                       image_mime_type, image_data, width, height, metadata, created_at
                   )
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                [
                    (
                        p["source_id"],
                        p["version"],
                        p["page"],
                        p.get("page_key"),
                        p.get("text_chunk_id"),
                        p.get("image_mime_type", "image/png"),
                        p["image_data"],
                        p.get("width"),
                        p.get("height"),
                        json.dumps(p.get("metadata", {}), ensure_ascii=False),
                        now,
                    )
                    for p in pages
                ],
            )

    def get_pdf_page(self, source_id: str, page: int, version: int | None = None) -> dict | None:
        effective_version = version
        if effective_version is None:
            source = self.get_source(source_id)
            if source is None:
                return None
            effective_version = source["current_version"]

        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT * FROM pdf_pages
                        WHERE source_id = %s AND version = %s AND page = %s
                        """,
                        (source_id, effective_version, page),
                    )
                    row = cur.fetchone()
        else:
            with self._conn() as conn:
                row = conn.execute(
                    """
                    SELECT * FROM pdf_pages
                    WHERE source_id = ? AND version = ? AND page = ?
                    """,
                    (source_id, effective_version, page),
                ).fetchone()

        if row is None:
            return None

        d = dict(row)
        if self.use_supabase:
            d["metadata"] = d.get("metadata") if isinstance(d.get("metadata"), dict) else {}
        else:
            d["metadata"] = json.loads(d["metadata"]) if d.get("metadata") else {}
        return d

    def list_pdf_pages(self, source_id: str, version: int | None = None) -> list[dict]:
        effective_version = version
        if effective_version is None:
            source = self.get_source(source_id)
            if source is None:
                return []
            effective_version = source["current_version"]

        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT source_id, version, page, page_key, text_chunk_id,
                               image_mime_type, width, height, metadata, created_at
                        FROM pdf_pages
                        WHERE source_id = %s AND version = %s
                        ORDER BY page
                        """,
                        (source_id, effective_version),
                    )
                    rows = cur.fetchall()
        else:
            with self._conn() as conn:
                rows = conn.execute(
                    """
                    SELECT source_id, version, page, page_key, text_chunk_id,
                           image_mime_type, width, height, metadata, created_at
                    FROM pdf_pages
                    WHERE source_id = ? AND version = ?
                    ORDER BY page
                    """,
                    (source_id, effective_version),
                ).fetchall()

        results = []
        for row in rows:
            d = dict(row)
            if self.use_supabase:
                d["metadata"] = d.get("metadata") if isinstance(d.get("metadata"), dict) else {}
            else:
                d["metadata"] = json.loads(d["metadata"]) if d.get("metadata") else {}
            results.append(d)
        return results

    def delete_pdf_pages_for_version(self, source_id: str, version: int):
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "DELETE FROM pdf_pages WHERE source_id = %s AND version = %s",
                        (source_id, version),
                    )
                conn.commit()
            return

        with self._conn() as conn:
            conn.execute(
                "DELETE FROM pdf_pages WHERE source_id = ? AND version = ?",
                (source_id, version),
            )

    # ─── Chunks ───────────────────────────────────────────────────────

    def create_chunks(self, chunks: list[dict], ministry_name: str | None = None):
        now = _now()
        effective_ministry = ministry_name or DEFAULT_MINISTRY
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.executemany(
                        """INSERT INTO chunks (chunk_id, source_id, ministry_name, version, page,
                           chunk_type, metadata, created_at)
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                        [
                            (
                                c["chunk_id"],
                                c["source_id"],
                                c.get("ministry_name", effective_ministry),
                                c["version"],
                                c["page"],
                                c["chunk_type"],
                                Jsonb(c.get("metadata", {})),
                                now,
                            )
                            for c in chunks
                        ],
                    )
                conn.commit()
            return
        with self._conn() as conn:
            conn.executemany(
                """INSERT INTO chunks (chunk_id, source_id, version, page,
                   chunk_type, metadata, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                [(c["chunk_id"], c["source_id"], c["version"], c["page"],
                  c["chunk_type"], json.dumps(c.get("metadata", {}), ensure_ascii=False), now)
                 for c in chunks]
            )

    def get_chunks_for_source(self, source_id: str, version: int | None = None) -> list[dict]:
        effective_version = version
        if effective_version is None:
            source = self.get_source(source_id)
            if source is None:
                return []
            effective_version = source["current_version"]

        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT * FROM chunks WHERE source_id = %s AND version = %s ORDER BY page",
                        (source_id, effective_version),
                    )
                    rows = cur.fetchall()
            return [dict(r) for r in rows]

        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM chunks WHERE source_id = ? AND version = ? ORDER BY page",
                (source_id, effective_version)
            ).fetchall()
        return [dict(r) for r in rows]

    def get_chunks_by_ids(self, chunk_ids: list[str]) -> dict[str, dict]:
        """Get chunk metadata for a list of chunk IDs. Returns {chunk_id: chunk_dict}."""
        if not chunk_ids:
            return {}
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT * FROM chunks WHERE chunk_id = ANY(%s)",
                        (chunk_ids,),
                    )
                    rows = cur.fetchall()
        else:
            with self._conn() as conn:
                placeholders = ",".join("?" for _ in chunk_ids)
                rows = conn.execute(
                    f"SELECT * FROM chunks WHERE chunk_id IN ({placeholders})", chunk_ids
                ).fetchall()
        result = {}
        for row in rows:
            d = dict(row)
            if self.use_supabase:
                d["metadata"] = d.get("metadata") if isinstance(d.get("metadata"), dict) else {}
            else:
                d["metadata"] = json.loads(d["metadata"]) if d.get("metadata") else {}
            result[d["chunk_id"]] = d
        return result

    def get_chunk_enrichment_rows(self, chunk_ids: list[str]) -> dict[str, dict]:
        """
        Batch-load chunk + source fields needed by retrieval enrichment in a single query.
        Returns: {chunk_id: row_dict}
        """
        unique_ids = [cid for cid in dict.fromkeys(chunk_ids) if cid]
        if not unique_ids:
            return {}

        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT
                            c.chunk_id,
                            c.source_id,
                            c.chunk_type,
                            c.metadata AS chunk_metadata,
                            s.source_name,
                            s.filename,
                            s.file_type,
                            s.current_version,
                            s.tags,
                            s.language,
                            s.ministry_name,
                            s.ministry_type,
                            s.metadata AS source_metadata
                        FROM chunks c
                        JOIN sources s ON s.source_id = c.source_id
                                      AND s.ministry_name = c.ministry_name
                        WHERE c.chunk_id = ANY(%s)
                        """,
                        (unique_ids,),
                    )
                    rows = cur.fetchall()
        else:
            placeholders = ",".join("?" for _ in unique_ids)
            with self._conn() as conn:
                rows = conn.execute(
                    f"""
                    SELECT
                        c.chunk_id,
                        c.source_id,
                        c.chunk_type,
                        c.metadata AS chunk_metadata,
                        s.source_name,
                        s.filename,
                        s.file_type,
                        s.current_version,
                        s.tags,
                        s.language,
                        s.ministry_name,
                        s.ministry_type,
                        s.metadata AS source_metadata
                    FROM chunks c
                    JOIN sources s ON s.source_id = c.source_id
                    WHERE c.chunk_id IN ({placeholders})
                    """,
                    unique_ids,
                ).fetchall()

        result: dict[str, dict] = {}
        for row in rows:
            d = dict(row)
            if self.use_supabase:
                d["chunk_metadata"] = (
                    d.get("chunk_metadata") if isinstance(d.get("chunk_metadata"), dict) else {}
                )
                d["tags"] = d.get("tags") if isinstance(d.get("tags"), list) else []
                d["source_metadata"] = (
                    d.get("source_metadata") if isinstance(d.get("source_metadata"), dict) else {}
                )
            else:
                d["chunk_metadata"] = json.loads(d["chunk_metadata"]) if d.get("chunk_metadata") else {}
                d["tags"] = json.loads(d["tags"]) if d.get("tags") else []
                d["source_metadata"] = json.loads(d["source_metadata"]) if d.get("source_metadata") else {}
            result[d["chunk_id"]] = d

        return result

    def delete_chunks_for_version(self, source_id: str, version: int):
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "DELETE FROM chunks WHERE source_id = %s AND version = %s",
                        (source_id, version),
                    )
                conn.commit()
            return
        with self._conn() as conn:
            conn.execute(
                "DELETE FROM chunks WHERE source_id = ? AND version = ?",
                (source_id, version)
            )

    # ─── Versions ─────────────────────────────────────────────────────

    def create_version(self, source_id: str, version: int, chunks_created: int,
                       ministry_name: str | None = None):
        now = _now()
        effective_ministry = ministry_name or DEFAULT_MINISTRY
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """INSERT INTO versions (source_id, ministry_name, version, chunks_created, is_active, created_at)
                           VALUES (%s, %s, %s, %s, TRUE, %s)""",
                        (source_id, effective_ministry, version, chunks_created, now),
                    )
                conn.commit()
            return
        with self._conn() as conn:
            conn.execute(
                """INSERT INTO versions (source_id, version, chunks_created, is_active, created_at)
                   VALUES (?, ?, ?, 1, ?)""",
                (source_id, version, chunks_created, now)
            )

    def get_versions(self, source_id: str) -> list[dict]:
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT * FROM versions WHERE source_id = %s ORDER BY version DESC",
                        (source_id,),
                    )
                    rows = cur.fetchall()
            return [dict(r) for r in rows]
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM versions WHERE source_id = ? ORDER BY version DESC",
                (source_id,)
            ).fetchall()
        return [dict(r) for r in rows]

    # ─── Stats ────────────────────────────────────────────────────────

    def count_sources(self) -> int:
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT COUNT(*) AS n FROM sources")
                    row = cur.fetchone()
            return int(row["n"])
        with self._conn() as conn:
            return conn.execute("SELECT COUNT(*) FROM sources").fetchone()[0]

    def count_chunks(self) -> int:
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT COUNT(*) AS n FROM chunks")
                    row = cur.fetchone()
            return int(row["n"])
        with self._conn() as conn:
            return conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]

    # ─── File Hashes (Duplicate Detection) ────────────────────────────

    def check_duplicate(self, file_hash: str) -> dict | None:
        """Check if a file with this hash was already ingested. Returns source info or None."""
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT * FROM file_hashes WHERE hash = %s", (file_hash,)
                    )
                    row = cur.fetchone()
        else:
            with self._conn() as conn:
                row = conn.execute(
                    "SELECT * FROM file_hashes WHERE hash = ?", (file_hash,)
                ).fetchone()
        if row is None:
            return None
        d = dict(row)
        # Enrich with source info
        source = self.get_source(d["source_id"])
        if source:
            d["source_name"] = source["source_name"]
            d["doc_type"] = source.get("doc_type", "general")
        return d

    def store_hash(self, file_hash: str, source_id: str, version: int, filename: str,
                   ministry_name: str | None = None):
        """Store a file hash for duplicate detection."""
        now = _now()
        effective_ministry = ministry_name or DEFAULT_MINISTRY
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO file_hashes (hash, source_id, ministry_name, version, filename, created_at)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        ON CONFLICT (hash, ministry_name) DO UPDATE
                        SET source_id = EXCLUDED.source_id,
                            version = EXCLUDED.version,
                            filename = EXCLUDED.filename,
                            created_at = EXCLUDED.created_at
                        """,
                        (file_hash, source_id, effective_ministry, version, filename, now),
                    )
                conn.commit()
            return
        with self._conn() as conn:
            conn.execute(
                """INSERT OR REPLACE INTO file_hashes (hash, source_id, version, filename, created_at)
                   VALUES (?, ?, ?, ?, ?)""",
                (file_hash, source_id, version, filename, now)
            )
