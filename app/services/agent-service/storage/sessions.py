"""
Agent Service — Session Store
SQLite-backed or Supabase Postgres conversation memory for multi-turn queries.
"""
import json
import logging
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
import config

try:
    import psycopg
    from psycopg.rows import dict_row
except Exception:  # pragma: no cover
    psycopg = None
    dict_row = None

logger = logging.getLogger("agent-service.sessions")


class SessionStore:
    """
    Session store for conversation memory backed by SQLite or Postgres.
    Stores messages as JSON array, with TTL-based cleanup.
    """

    def __init__(self, db_path: str = None):
        self.db_path = db_path or str(config.DB_PATH)
        self.use_supabase = config.USE_SUPABASE
        self.database_url = config.DATABASE_URL

        if self.use_supabase:
            if not self.database_url:
                raise RuntimeError("USE_SUPABASE=true but DATABASE_URL is empty")
            if psycopg is None:
                raise RuntimeError("psycopg is required when USE_SUPABASE=true")

        self._init_db()

    def _conn(self) -> sqlite3.Connection:
        """Get SQLite connection."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _pg_conn(self):
        """Get Postgres connection."""
        url = self.database_url
        if "sslmode=" not in url:
            url = f"{url}?sslmode=require" if "?" not in url else f"{url}&sslmode=require"
        return psycopg.connect(url, row_factory=dict_row)

    def _init_db(self):
        """Create the sessions table if it doesn't exist."""
        if self.use_supabase:
            self._init_postgres()
            return

        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                session_id   TEXT PRIMARY KEY,
                messages     TEXT NOT NULL DEFAULT '[]',
                user_type    TEXT NOT NULL DEFAULT 'citizen',
                created_at   TEXT NOT NULL,
                updated_at   TEXT NOT NULL
            )
        """)
        conn.commit()
        conn.close()

    def _init_postgres(self):
        """Create sessions table in Postgres if it doesn't exist."""
        with self._pg_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS sessions (
                        session_id TEXT PRIMARY KEY,
                        messages JSONB NOT NULL DEFAULT '[]'::jsonb,
                        user_type TEXT NOT NULL DEFAULT 'citizen',
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
                cur.execute("CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at)")
            conn.commit()

    def get_session(self, session_id: str) -> dict:
        """
        Get a session by ID. Returns None if not found.

        Returns:
            dict with session_id, messages (list), user_type, created_at, updated_at.
        """
        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT session_id, messages, user_type, created_at, updated_at FROM sessions WHERE session_id = %s",
                        (session_id,),
                    )
                    row = cur.fetchone()
            if not row:
                return None
            return {
                "session_id": row["session_id"],
                "messages": row["messages"] if isinstance(row["messages"], list) else json.loads(row["messages"] or "[]"),
                "user_type": row["user_type"],
                "created_at": row["created_at"].isoformat() if hasattr(row["created_at"], "isoformat") else str(row["created_at"]),
                "updated_at": row["updated_at"].isoformat() if hasattr(row["updated_at"], "isoformat") else str(row["updated_at"]),
            }

        conn = sqlite3.connect(self.db_path)
        row = conn.execute(
            "SELECT session_id, messages, user_type, created_at, updated_at FROM sessions WHERE session_id = ?",
            (session_id,),
        ).fetchone()
        conn.close()

        if not row:
            return None

        return {
            "session_id": row[0],
            "messages": json.loads(row[1]),
            "user_type": row[2],
            "created_at": row[3],
            "updated_at": row[4],
        }

    def create_session(self, session_id: str, user_type: str = "citizen") -> dict:
        """Create a new session."""
        now = datetime.utcnow().isoformat()

        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO sessions (session_id, messages, user_type, created_at, updated_at) VALUES (%s, %s, %s, %s, %s) ON CONFLICT DO NOTHING",
                        (session_id, json.dumps([], ensure_ascii=False), user_type, now, now),
                    )
                conn.commit()
        else:
            conn = sqlite3.connect(self.db_path)
            conn.execute(
                "INSERT OR IGNORE INTO sessions (session_id, messages, user_type, created_at, updated_at) VALUES (?, '[]', ?, ?, ?)",
                (session_id, user_type, now, now),
            )
            conn.commit()
            conn.close()

        return {"session_id": session_id, "messages": [], "user_type": user_type}

    def add_message(self, session_id: str, role: str, content: str, user_type: str = "citizen"):
        """
        Add a message to a session. Creates the session if it doesn't exist.
        Trims to MAX_CONVERSATION_DEPTH.

        Args:
            session_id: Session ID.
            role: Message role ('user' or 'assistant').
            content: Message content.
            user_type: User type (for new sessions).
        """
        now = datetime.utcnow().isoformat()

        session = self.get_session(session_id)
        if not session:
            self.create_session(session_id, user_type)
            session = {"messages": []}

        messages = session["messages"]
        messages.append({
            "role": role,
            "content": content,
            "timestamp": now,
        })

        # Trim to max depth
        max_depth = config.MAX_CONVERSATION_DEPTH
        if len(messages) > max_depth:
            messages = messages[-max_depth:]

        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE sessions SET messages = %s, updated_at = %s WHERE session_id = %s",
                        (json.dumps(messages, ensure_ascii=False), now, session_id),
                    )
                conn.commit()
        else:
            conn = sqlite3.connect(self.db_path)
            conn.execute(
                "UPDATE sessions SET messages = ?, updated_at = ? WHERE session_id = ?",
                (json.dumps(messages, ensure_ascii=False), now, session_id),
            )
            conn.commit()
            conn.close()

    def get_conversation_context(self, session_id: str, max_messages: int = 10) -> list[dict]:
        """
        Get recent conversation history for context injection.

        Args:
            session_id: Session ID.
            max_messages: Maximum messages to return.

        Returns:
            List of {role, content} dicts (most recent last).
        """
        session = self.get_session(session_id)
        if not session:
            return []

        messages = session["messages"][-max_messages:]
        return [{"role": m["role"], "content": m["content"]} for m in messages]

    def cleanup_expired(self):
        """Remove sessions older than SESSION_TTL_HOURS."""
        cutoff = (datetime.utcnow() - timedelta(hours=config.SESSION_TTL_HOURS)).isoformat()

        if self.use_supabase:
            with self._pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "DELETE FROM sessions WHERE updated_at < %s",
                        (cutoff,),
                    )
                    deleted = cur.rowcount
                conn.commit()
            if deleted > 0:
                logger.info(f"Cleaned up {deleted} expired sessions")
            return deleted
        else:
            conn = sqlite3.connect(self.db_path)
            result = conn.execute(
                "DELETE FROM sessions WHERE updated_at < ?",
                (cutoff,),
            )
            deleted = result.rowcount
            conn.commit()
            conn.close()
            if deleted > 0:
                logger.info(f"Cleaned up {deleted} expired sessions")
            return deleted
