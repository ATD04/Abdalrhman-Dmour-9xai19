"""
Workflow Service — Database (SQLite or Supabase Postgres)
"""
from __future__ import annotations
import json
import hashlib
import sqlite3
import math
import logging
from datetime import datetime, timezone
from pathlib import Path
from config import DB_PATH, USE_SUPABASE, DATABASE_URL

logger = logging.getLogger("workflow-service.database")

try:
    import psycopg
    from psycopg.rows import dict_row
except Exception:  # pragma: no cover
    psycopg = None
    dict_row = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Database:
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
        return psycopg.connect(url, row_factory=dict_row)

    def _init_db(self):
        if self.use_supabase:
            self._init_postgres()
            return

        with self._conn() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS cases (
                    case_id              TEXT PRIMARY KEY,
                    request_id           TEXT NOT NULL,
                    session_id           TEXT,
                    user_id              TEXT,
                    query                TEXT NOT NULL,
                    query_hash           TEXT NOT NULL,
                    user_type            TEXT NOT NULL DEFAULT 'citizen',
                    sector_primary       TEXT NOT NULL DEFAULT 'general',
                    sector_labels        TEXT NOT NULL DEFAULT '[]',
                    priority             TEXT NOT NULL DEFAULT 'medium',
                    status               TEXT NOT NULL DEFAULT 'open',
                    assigned_to          TEXT,
                    escalation_reason    TEXT NOT NULL,
                    confidence           REAL,
                    source_response_id   TEXT,
                    query_embedding      TEXT,
                    resolution_answer    TEXT,
                    resolution_note      TEXT,
                    is_faq_candidate     INTEGER NOT NULL DEFAULT 0,
                    created_at           TEXT NOT NULL,
                    updated_at           TEXT NOT NULL,
                    resolved_at          TEXT
                );

                CREATE TABLE IF NOT EXISTS case_timeline (
                    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
                    case_id              TEXT NOT NULL,
                    event_type           TEXT NOT NULL,
                    actor                TEXT NOT NULL,
                    note                 TEXT,
                    metadata             TEXT NOT NULL DEFAULT '{}',
                    created_at           TEXT NOT NULL,
                    FOREIGN KEY(case_id) REFERENCES cases(case_id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
                CREATE INDEX IF NOT EXISTS idx_cases_sector ON cases(sector_primary);
                CREATE INDEX IF NOT EXISTS idx_cases_assigned ON cases(assigned_to);
                CREATE INDEX IF NOT EXISTS idx_cases_user ON cases(user_id);
                CREATE INDEX IF NOT EXISTS idx_cases_created ON cases(created_at);
                CREATE INDEX IF NOT EXISTS idx_cases_request ON cases(request_id);
                CREATE INDEX IF NOT EXISTS idx_timeline_case ON case_timeline(case_id);

                CREATE TABLE IF NOT EXISTS users (
                    user_id UUID PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    full_name TEXT,
                    role TEXT NOT NULL DEFAULT 'user',
                    is_active INTEGER DEFAULT 1,
                    created_at TEXT NOT NULL,
                    last_login TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
                """
            )
            self._ensure_sqlite_optional_columns(conn)

    def _init_postgres(self):
        """Create tables in Postgres if they don't exist."""
        with self._pg_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS cases (
                        case_id TEXT PRIMARY KEY,
                        request_id TEXT NOT NULL,
                        session_id TEXT,
                        user_id TEXT,
                        query TEXT NOT NULL,
                        query_hash TEXT NOT NULL,
                        user_type TEXT NOT NULL DEFAULT 'citizen',
                        sector_primary TEXT NOT NULL DEFAULT 'general',
                        sector_labels JSONB NOT NULL DEFAULT '[]'::jsonb,
                        priority TEXT NOT NULL DEFAULT 'medium',
                        status TEXT NOT NULL DEFAULT 'open',
                        assigned_to TEXT,
                        escalation_reason TEXT NOT NULL,
                        confidence DOUBLE PRECISION,
                        source_response_id TEXT,
                        query_embedding JSONB,
                        resolution_answer TEXT,
                        resolution_note TEXT,
                        is_faq_candidate BOOLEAN NOT NULL DEFAULT FALSE,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        resolved_at TIMESTAMPTZ
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS case_timeline (
                        id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        case_id TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
                        event_type TEXT NOT NULL,
                        actor TEXT NOT NULL,
                        note TEXT,
                        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
                cur.execute("CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_cases_sector ON cases(sector_primary)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_cases_assigned ON cases(assigned_to)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_cases_user ON cases(user_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_cases_created ON cases(created_at)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_cases_request ON cases(request_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_timeline_case ON case_timeline(case_id)")
                cur.execute("ALTER TABLE cases ADD COLUMN IF NOT EXISTS query_embedding JSONB")

                # New Users Table for Registration
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS users (
                        user_id UUID PRIMARY KEY,
                        email TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        full_name TEXT,
                        role TEXT NOT NULL DEFAULT 'user',
                        is_active BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        last_login TIMESTAMPTZ
                    )
                    """
                )
                cur.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
            conn.commit()

    @staticmethod
    def _ensure_sqlite_optional_columns(conn: sqlite3.Connection):
        rows = conn.execute("PRAGMA table_info(cases)").fetchall()
        columns = {r[1] for r in rows}
        if "query_embedding" not in columns:
            conn.execute("ALTER TABLE cases ADD COLUMN query_embedding TEXT")

    def create_case(self, payload: dict) -> dict:
        now = _now()
        query_hash = hashlib.sha256(payload["query"].strip().lower().encode("utf-8")).hexdigest()
        case = {
            "case_id": payload.get("case_id"),
            "request_id": payload["request_id"],
            "session_id": payload.get("session_id"),
            "user_id": payload.get("user_id"),
            "query": payload["query"],
            "query_hash": query_hash,
            "user_type": payload.get("user_type", "citizen"),
            "sector_primary": payload.get("sector_primary", "general"),
            "sector_labels": payload.get("sector_labels", []),
            "priority": payload.get("priority", "medium"),
            "status": "open",
            "assigned_to": payload.get("assigned_to"),
            "escalation_reason": payload.get("escalation_reason", "low_confidence"),
            "confidence": payload.get("confidence"),
            "source_response_id": payload.get("source_response_id"),
            "query_embedding": payload.get("query_embedding"),
            "resolution_answer": None,
            "resolution_note": None,
            "is_faq_candidate": False,
            "created_at": now,
            "updated_at": now,
            "resolved_at": None,
        }

        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """INSERT INTO cases (
                            case_id, request_id, session_id, user_id, query, query_hash, user_type,
                            sector_primary, sector_labels, priority, status, assigned_to,
                            escalation_reason, confidence, source_response_id,
                            query_embedding,
                            resolution_answer, resolution_note, is_faq_candidate,
                            created_at, updated_at, resolved_at
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s, %s,
                            %s, %s::jsonb, %s, %s, %s,
                            %s, %s, %s,
                            %s::jsonb,
                            %s, %s, %s,
                            %s, %s, %s
                        )""",
                        (
                            case["case_id"], case["request_id"], case["session_id"], case["user_id"],
                            case["query"], case["query_hash"], case["user_type"], case["sector_primary"],
                            json.dumps(case["sector_labels"], ensure_ascii=False), case["priority"],
                            case["status"], case["assigned_to"], case["escalation_reason"],
                            case["confidence"], case["source_response_id"],
                            json.dumps(case["query_embedding"]) if case["query_embedding"] is not None else None,
                            case["resolution_answer"], case["resolution_note"], case["is_faq_candidate"], case["created_at"],
                            case["updated_at"], case["resolved_at"],
                        ),
                    )
                conn.commit()
        else:
            sqlite_case = {
                **case,
                "sector_labels": json.dumps(case["sector_labels"], ensure_ascii=False),
                "is_faq_candidate": 1 if case["is_faq_candidate"] else 0,
                "query_embedding": json.dumps(case["query_embedding"]) if case["query_embedding"] is not None else None,
            }
            with self._conn() as conn:
                conn.execute(
                    """INSERT INTO cases (
                        case_id, request_id, session_id, user_id, query, query_hash, user_type,
                        sector_primary, sector_labels, priority, status, assigned_to,
                        escalation_reason, confidence, source_response_id,
                        query_embedding,
                        resolution_answer, resolution_note, is_faq_candidate,
                        created_at, updated_at, resolved_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        sqlite_case["case_id"], sqlite_case["request_id"], sqlite_case["session_id"], sqlite_case["user_id"],
                        sqlite_case["query"], sqlite_case["query_hash"], sqlite_case["user_type"], sqlite_case["sector_primary"],
                        sqlite_case["sector_labels"], sqlite_case["priority"], sqlite_case["status"], sqlite_case["assigned_to"],
                        sqlite_case["escalation_reason"], sqlite_case["confidence"], sqlite_case["source_response_id"],
                        sqlite_case["query_embedding"], sqlite_case["resolution_answer"], sqlite_case["resolution_note"], sqlite_case["is_faq_candidate"],
                        sqlite_case["created_at"], sqlite_case["updated_at"], sqlite_case["resolved_at"],
                    ),
                )

        self.add_timeline_event(
            case_id=case["case_id"],
            event_type="created",
            actor="system",
            note="Case created from escalated in-scope query",
            metadata={"request_id": case["request_id"], "escalation_reason": case["escalation_reason"]},
        )
        return self.get_case(case["case_id"])

    def add_timeline_event(self, case_id: str, event_type: str, actor: str, note: str | None = None, metadata: dict | None = None):
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """INSERT INTO case_timeline (case_id, event_type, actor, note, metadata, created_at)
                           VALUES (%s, %s, %s, %s, %s::jsonb, %s)""",
                        (case_id, event_type, actor, note, json.dumps(metadata or {}, ensure_ascii=False), _now()),
                    )
                conn.commit()
        else:
            with self._conn() as conn:
                conn.execute(
                    """INSERT INTO case_timeline (case_id, event_type, actor, note, metadata, created_at)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (case_id, event_type, actor, note, json.dumps(metadata or {}, ensure_ascii=False), _now()),
                )

    def get_case(self, case_id: str) -> dict | None:
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT * FROM cases WHERE case_id = %s", (case_id,))
                    row = cur.fetchone()
            if row is None:
                return None
            case = self._normalize_case(dict(row))
            case["timeline"] = self.get_timeline(case_id)
            return case

        with self._conn() as conn:
            row = conn.execute("SELECT * FROM cases WHERE case_id = ?", (case_id,)).fetchone()
            if row is None:
                return None
            case = self._normalize_case(dict(row))
            case["timeline"] = self.get_timeline(case_id)
            return case

    def get_timeline(self, case_id: str) -> list[dict]:
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT * FROM case_timeline WHERE case_id = %s ORDER BY id ASC",
                        (case_id,),
                    )
                    rows = cur.fetchall()
            return [self._normalize_timeline(dict(r)) for r in rows]

        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM case_timeline WHERE case_id = ? ORDER BY id ASC", (case_id,)
            ).fetchall()
        return [self._normalize_timeline(dict(r)) for r in rows]

    def list_cases(self, filters: dict) -> tuple[list[dict], int]:
        if self.use_supabase:
            conditions = []
            params: list = []

            if filters.get("status"):
                conditions.append("status = %s")
                params.append(filters["status"])
            if filters.get("sector"):
                conditions.append("sector_primary = %s")
                params.append(filters["sector"])
            if filters.get("priority"):
                conditions.append("priority = %s")
                params.append(filters["priority"])
            if filters.get("assignee"):
                conditions.append("assigned_to = %s")
                params.append(filters["assignee"])
            if filters.get("user_id"):
                conditions.append("user_id = %s")
                params.append(filters["user_id"])

            where = " AND ".join(conditions) if conditions else "TRUE"
            page = max(1, int(filters.get("page", 1)))
            page_size = max(1, min(200, int(filters.get("page_size", 50))))
            offset = (page - 1) * page_size

            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(f"SELECT COUNT(*) AS total FROM cases WHERE {where}", params)
                    total_row = cur.fetchone() or {"total": 0}
                    total = int(total_row["total"])

                    cur.execute(
                        f"SELECT * FROM cases WHERE {where} ORDER BY updated_at DESC LIMIT %s OFFSET %s",
                        params + [page_size, offset],
                    )
                    rows = cur.fetchall()

            return [self._normalize_case(dict(r)) for r in rows], total

        conditions = []
        params: list = []

        if filters.get("status"):
            conditions.append("status = ?")
            params.append(filters["status"])
        if filters.get("sector"):
            conditions.append("sector_primary = ?")
            params.append(filters["sector"])
        if filters.get("priority"):
            conditions.append("priority = ?")
            params.append(filters["priority"])
        if filters.get("assignee"):
            conditions.append("assigned_to = ?")
            params.append(filters["assignee"])
        if filters.get("user_id"):
            conditions.append("user_id = ?")
            params.append(filters["user_id"])

        where = " AND ".join(conditions) if conditions else "1=1"
        page = max(1, int(filters.get("page", 1)))
        page_size = max(1, min(200, int(filters.get("page_size", 50))))
        offset = (page - 1) * page_size

        with self._conn() as conn:
            total = conn.execute(f"SELECT COUNT(*) FROM cases WHERE {where}", params).fetchone()[0]
            rows = conn.execute(
                f"SELECT * FROM cases WHERE {where} ORDER BY updated_at DESC LIMIT ? OFFSET ?",
                params + [page_size, offset],
            ).fetchall()

        return [self._normalize_case(dict(r)) for r in rows], total

    def update_case(self, case_id: str, updates: dict, actor: str = "admin") -> dict | None:
        allowed = ["status", "priority", "assigned_to", "sector_primary", "sector_labels"]
        fields = []
        params = []
        for key in allowed:
            if key not in updates or updates[key] is None:
                continue
            value = updates[key]
            if key == "sector_labels":
                if self.use_supabase:
                    fields.append(f"{key} = %s::jsonb")
                    params.append(json.dumps(value, ensure_ascii=False))
                else:
                    fields.append(f"{key} = ?")
                    params.append(json.dumps(value, ensure_ascii=False))
            else:
                fields.append(f"{key} = {'%s' if self.use_supabase else '?'}")
                params.append(value)

        if not fields:
            return self.get_case(case_id)

        if self.use_supabase:
            fields.append("updated_at = %s")
            params.append(_now())
            params.append(case_id)
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(f"UPDATE cases SET {', '.join(fields)} WHERE case_id = %s", params)
                conn.commit()
        else:
            fields.append("updated_at = ?")
            params.append(_now())
            params.append(case_id)
            with self._conn() as conn:
                conn.execute(f"UPDATE cases SET {', '.join(fields)} WHERE case_id = ?", params)

        self.add_timeline_event(
            case_id=case_id,
            event_type="updated",
            actor=actor,
            note="Case fields updated",
            metadata={k: v for k, v in updates.items() if v is not None},
        )
        return self.get_case(case_id)

    def resolve_case(self, case_id: str, resolution_answer: str, resolution_note: str | None, actor: str) -> dict | None:
        now = _now()
        
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """UPDATE cases
                           SET status = 'closed', resolution_answer = %s, resolution_note = %s,
                                resolved_at = %s, updated_at = %s, is_faq_candidate = TRUE
                           WHERE case_id = %s""",
                        (resolution_answer, resolution_note, now, now, case_id),
                    )
                conn.commit()
        else:
            with self._conn() as conn:
                conn.execute(
                    """UPDATE cases
                       SET status = 'closed', resolution_answer = ?, resolution_note = ?,
                           resolved_at = ?, updated_at = ?, is_faq_candidate = 1
                       WHERE case_id = ?""",
                    (resolution_answer, resolution_note, now, now, case_id),
                )

        self.add_timeline_event(
            case_id=case_id,
            event_type="resolved",
            actor=actor,
            note=resolution_note or "Case resolved",
            metadata={"resolution_answer_preview": resolution_answer[:300]},
        )
        return self.get_case(case_id)

    def delete_case(self, case_id: str) -> bool:
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM cases WHERE case_id = %s", (case_id,))
                conn.commit()
            return True

        with self._conn() as conn:
            conn.execute("DELETE FROM cases WHERE case_id = ?", (case_id,))
        return True

    def mark_faq_candidate(self, case_id: str, actor: str = "admin") -> dict | None:
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE cases SET is_faq_candidate = TRUE, updated_at = %s WHERE case_id = %s",
                        (_now(), case_id),
                    )
                conn.commit()
        else:
            with self._conn() as conn:
                conn.execute("UPDATE cases SET is_faq_candidate = 1, updated_at = ? WHERE case_id = ?", (_now(), case_id))

        self.add_timeline_event(
            case_id=case_id,
            event_type="faq_candidate",
            actor=actor,
            note="Marked as FAQ candidate",
            metadata={},
        )
        return self.get_case(case_id)

    def find_resolved_answer(
        self,
        query: str,
        user_id: str | None = None,
        session_id: str | None = None,
        query_embedding: list[float] | None = None,
    ) -> dict | None:
        if not query_embedding:
            # Fallback for exact/hash matches if embedding is missing entirely
            query_hash = hashlib.sha256(query.strip().lower().encode("utf-8")).hexdigest()
            if self.use_supabase:
                with self._pg_conn() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "SELECT * FROM cases WHERE query_hash = %s AND status = 'closed' AND resolution_answer IS NOT NULL ORDER BY resolved_at DESC LIMIT 1",
                            (query_hash,)
                        )
                        row = cur.fetchone()
                        if row:
                            normalized = self._normalize_case(dict(row))
                            normalized["match_score"] = 1.0
                            normalized["match_scope"] = "exact_match_fallback"
                            return normalized
            else:
                with self._conn() as conn:
                    row = conn.execute(
                        "SELECT * FROM cases WHERE query_hash = ? AND status = 'closed' AND resolution_answer IS NOT NULL ORDER BY resolved_at DESC LIMIT 1",
                        (query_hash,)
                    ).fetchone()
                    if row:
                        normalized = self._normalize_case(dict(row))
                        normalized["match_score"] = 1.0
                        normalized["match_scope"] = "exact_match_fallback"
                        return normalized
            return None

        query_vec = [float(v) for v in query_embedding]
        thresholds = {
            "same_session": 0.82,
            "same_user": 0.86,
            "faq": 0.90,
            "global": 0.88,
        }

        scope_checks: list[tuple[str, str | None]] = []
        if session_id:
            scope_checks.append(("same_session", session_id))
        if user_id:
            scope_checks.append(("same_user", user_id))
        scope_checks.append(("faq", None))
        scope_checks.append(("global", None))

        for scope, scope_value in scope_checks:
            candidates = self._fetch_semantic_candidates(scope, scope_value)
            if not candidates:
                continue

            best_case = None
            best_score = -1.0
            for case in candidates:
                candidate_vec = self._parse_embedding(case.get("query_embedding"))
                if not candidate_vec or len(candidate_vec) != len(query_vec):
                    continue
                score = self._cosine_similarity(query_vec, candidate_vec)
                if score > best_score:
                    best_case = case
                    best_score = score

            if best_case is None:
                continue

            threshold = thresholds[scope]
            if best_score < threshold:
                continue

            normalized = self._normalize_case(dict(best_case))
            normalized["match_score"] = round(best_score, 6)
            normalized["match_scope"] = scope
            return normalized

        # Fallback for exact/hash matches (useful for cases missing embeddings)
        query_hash = hashlib.sha256(query.strip().lower().encode("utf-8")).hexdigest()
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT * FROM cases WHERE query_hash = %s AND status = 'closed' AND resolution_answer IS NOT NULL ORDER BY resolved_at DESC LIMIT 1",
                        (query_hash,)
                    )
                    row = cur.fetchone()
                    if row:
                        normalized = self._normalize_case(dict(row))
                        normalized["match_score"] = 1.0
                        normalized["match_scope"] = "exact_match_fallback"
                        return normalized
        else:
            with self._conn() as conn:
                row = conn.execute(
                    "SELECT * FROM cases WHERE query_hash = ? AND status = 'closed' AND resolution_answer IS NOT NULL ORDER BY resolved_at DESC LIMIT 1",
                    (query_hash,)
                ).fetchone()
                if row:
                    normalized = self._normalize_case(dict(row))
                    normalized["match_score"] = 1.0
                    normalized["match_scope"] = "exact_match_fallback"
                    return normalized

        return None

    def _fetch_semantic_candidates(self, scope: str, scope_value: str | None) -> list[dict]:
        if self.use_supabase:
            where = [
                "status = 'closed'",
                "resolution_answer IS NOT NULL",
                "TRIM(resolution_answer) != ''",
                "query_embedding IS NOT NULL",
            ]
            params: list = []
            if scope == "same_session" and scope_value:
                where.append("session_id = %s")
                params.append(scope_value)
            elif scope == "same_user" and scope_value:
                where.append("user_id = %s")
                params.append(scope_value)
            elif scope == "faq":
                where.append("is_faq_candidate = TRUE")
            elif scope == "global":
                # Fallback to any closed case if no FAQ match
                pass
            else:
                return []

            where_sql = " AND ".join(where)
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        f"""
                        SELECT * FROM cases
                        WHERE {where_sql}
                        ORDER BY resolved_at DESC, updated_at DESC
                        LIMIT 250
                        """,
                        params,
                    )
                    rows = cur.fetchall()
            return [dict(r) for r in rows]

        where = [
            "status = 'closed'",
            "resolution_answer IS NOT NULL",
            "TRIM(resolution_answer) != ''",
            "query_embedding IS NOT NULL",
        ]
        params: list = []
        if scope == "same_session" and scope_value:
            where.append("session_id = ?")
            params.append(scope_value)
        elif scope == "same_user" and scope_value:
            where.append("user_id = ?")
            params.append(scope_value)
        elif scope == "faq":
            where.append("is_faq_candidate = 1")
        elif scope == "global":
            # Fallback to any closed case if no FAQ match
            pass
        else:
            return []

        where_sql = " AND ".join(where)
        with self._conn() as conn:
            rows = conn.execute(
                f"""
                SELECT * FROM cases
                WHERE {where_sql}
                ORDER BY resolved_at DESC, updated_at DESC
                LIMIT 250
                """,
                params,
            ).fetchall()
        return [dict(r) for r in rows]

    @staticmethod
    def _parse_embedding(raw) -> list[float]:
        if raw is None:
            return []
        if isinstance(raw, list):
            return [float(v) for v in raw]
        if isinstance(raw, str):
            text = raw.strip()
            if not text:
                return []
            try:
                decoded = json.loads(text)
                if isinstance(decoded, list):
                    return [float(v) for v in decoded]
            except Exception:
                return []
        return []

    @staticmethod
    def _cosine_similarity(a: list[float], b: list[float]) -> float:
        if not a or not b or len(a) != len(b):
            return 0.0
        dot = sum(x * y for x, y in zip(a, b))
        mag_a = math.sqrt(sum(x * x for x in a))
        mag_b = math.sqrt(sum(y * y for y in b))
        if mag_a == 0.0 or mag_b == 0.0:
            return 0.0
        return dot / (mag_a * mag_b)

    def count_cases(self) -> int:
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT COUNT(*) AS total FROM cases")
                    row = cur.fetchone() or {"total": 0}
            return int(row["total"])

        with self._conn() as conn:
            return conn.execute("SELECT COUNT(*) FROM cases").fetchone()[0]

    @staticmethod
    def _normalize_case(case: dict) -> dict:
        for key in ("created_at", "updated_at", "resolved_at"):
            value = case.get(key)
            if value is not None and not isinstance(value, str):
                case[key] = value.isoformat()

        raw_sector_labels = case.get("sector_labels")
        if isinstance(raw_sector_labels, str):
            case["sector_labels"] = json.loads(raw_sector_labels or "[]")
        elif isinstance(raw_sector_labels, list):
            case["sector_labels"] = raw_sector_labels
        else:
            case["sector_labels"] = []

        raw_query_embedding = case.get("query_embedding")
        if isinstance(raw_query_embedding, str):
            try:
                case["query_embedding"] = [float(v) for v in json.loads(raw_query_embedding or "[]")]
            except Exception:
                case["query_embedding"] = None
        elif isinstance(raw_query_embedding, list):
            case["query_embedding"] = [float(v) for v in raw_query_embedding]
        else:
            case["query_embedding"] = None

        case["is_faq_candidate"] = bool(case.get("is_faq_candidate", 0))
        return case

    @staticmethod
    def _normalize_timeline(event: dict) -> dict:
        created_at = event.get("created_at")
        if created_at is not None and not isinstance(created_at, str):
            event["created_at"] = created_at.isoformat()

        raw_metadata = event.get("metadata")
        if isinstance(raw_metadata, str):
            event["metadata"] = json.loads(raw_metadata or "{}")
        elif isinstance(raw_metadata, dict):
            event["metadata"] = raw_metadata
        else:
            event["metadata"] = {}
        return event

    def create_user(self, email: str, password_hash: str, full_name: str | None = None, role: str = "user") -> dict | None:
        """Securely creates a new user record."""
        import uuid
        user_id = str(uuid.uuid4())
        now = _now()
        
        if self.use_supabase:
            try:
                with self._pg_conn() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            """INSERT INTO users (user_id, email, password_hash, full_name, role)
                               VALUES (%s, %s, %s, %s, %s)
                               RETURNING user_id, email, full_name, role, created_at""",
                            (user_id, email, password_hash, full_name, role),
                        )
                        row = cur.fetchone()
                    conn.commit()
                    return dict(row) if row else None
            except Exception as e:
                print(f"ERROR in create_user (Postgres): {e}")
                return None
        else:
            try:
                with self._conn() as conn:
                    conn.execute(
                        """INSERT INTO users (user_id, email, password_hash, full_name, role, created_at)
                           VALUES (?, ?, ?, ?, ?, ?)""",
                        (user_id, email, password_hash, full_name, role, now),
                    )
                    conn.commit()
                return {
                    "user_id": user_id,
                    "email": email,
                    "full_name": full_name,
                    "role": role,
                    "created_at": now
                }
            except Exception as e:
                print(f"ERROR in create_user (SQLite): {e}")
                return None

    def get_user_by_email(self, email: str) -> dict | None:
        """Retrieves a user by their email for authentication."""
        if self.use_supabase:
            try:
                with self._pg_conn() as conn:
                    with conn.cursor() as cur:
                        cur.execute("SELECT * FROM users WHERE email = %s", (email,))
                        row = cur.fetchone()
                    return dict(row) if row else None
            except Exception as e:
                print(f"ERROR in get_user_by_email (Postgres): {e}")
                return None
        else:
            try:
                with self._conn() as conn:
                    row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
                    return dict(row) if row else None
            except Exception as e:
                print(f"ERROR in get_user_by_email (SQLite): {e}")
                return None
