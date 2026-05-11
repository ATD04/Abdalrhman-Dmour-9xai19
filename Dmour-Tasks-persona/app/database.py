"""
database.py — SQLite engine, session factory, and table initialization.

The SQLite file is stored at ./data/persona.db, relative to the project root.
The ./data directory is created automatically if it does not exist.
All text is written and read as UTF-8 to preserve Arabic content.
"""

import os
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# ---------------------------------------------------------------------------
# Path resolution
# ---------------------------------------------------------------------------

# Project root = one level above this file (app/../)
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "persona.db"


def _ensure_data_dir() -> None:
    """Create ./data directory if it does not already exist."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

_ensure_data_dir()

DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    # SQLite requires this flag for multi-threaded FastAPI usage
    connect_args={"check_same_thread": False},
    # Emit the SQL DDL/DML to stdout during development; set to False in prod
    echo=False,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragmas(dbapi_connection, connection_record):
    """
    Apply SQLite pragmas on every new connection.

    - PRAGMA encoding ensures UTF-8 for Arabic text stored in TEXT columns.
    - PRAGMA foreign_keys enforces FK constraints (off by default in SQLite).
    - PRAGMA journal_mode WAL improves concurrent read performance.
    """
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA encoding = 'UTF-8'")
    cursor.execute("PRAGMA foreign_keys = ON")
    cursor.execute("PRAGMA journal_mode = WAL")
    cursor.close()


# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


# ---------------------------------------------------------------------------
# Declarative base
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    """All ORM models inherit from this base."""
    pass


# ---------------------------------------------------------------------------
# Dependency for FastAPI route handlers
# ---------------------------------------------------------------------------

def get_db():
    """
    FastAPI dependency that yields a SQLAlchemy session and guarantees
    the session is closed after the request completes.

    Usage in a route:
        from app.database import get_db
        from sqlalchemy.orm import Session
        from fastapi import Depends

        @router.get("/example")
        def example(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Table creation
# ---------------------------------------------------------------------------

def init_db() -> None:
    """
    Create all tables defined in app/models.py if they do not already exist.

    Call this once at application startup (see app/main.py lifespan handler).
    Safe to call multiple times — SQLAlchemy uses CREATE TABLE IF NOT EXISTS.
    """
    # Import models here so that Base.metadata is populated before create_all
    import app.models  # noqa: F401  (side-effect import)
    Base.metadata.create_all(bind=engine)
