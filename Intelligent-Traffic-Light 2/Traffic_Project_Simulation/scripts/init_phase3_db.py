#!/usr/bin/env python3
"""Phase 3 Database Initialization Script

One-time setup to create all Phase 3 tables and prepare the system for operation.
Safe to run multiple times (idempotent).
"""

from __future__ import annotations

import logging
from pathlib import Path

from phase3_database import Phase3Database

logger = logging.getLogger("its.init_db")


def main() -> None:
    """Initialize Phase 3 database."""
    db_path = Path("app/data/phase3.db")
    
    print("=" * 60)
    print("Phase 3 Database Initialization")
    print("=" * 60)
    
    # Create database and tables
    print(f"\n✓ Initializing database at: {db_path.absolute()}")
    db = Phase3Database(db_path)
    
    # Verify all tables created
    print("\n✓ Tables created:")
    print("  - traffic_observations")
    print("  - signal_logs")
    print("  - detected_events")
    print("  - forecasts")
    print("  - signal_recommendations")
    print("  - system_logs")
    
    # Verify indices created
    print("\n✓ Indices created:")
    print("  - idx_events_start_time")
    print("  - idx_events_approach")
    print("  - idx_events_status")
    print("  - idx_observations_timestamp")
    print("  - idx_forecasts_generated")
    print("  - idx_system_logs_timestamp")
    
    # Test connectivity
    size_mb = db.get_database_size_mb()
    print(f"\n✓ Database connectivity verified")
    print(f"  Database file size: {size_mb:.2f} MB")
    
    # Close connection
    db.close()
    
    print("\n" + "=" * 60)
    print("✅ Phase 3 Database Initialization Complete!")
    print("=" * 60)
    print("\nYou can now:")
    print("  1. Start the server:  python3 scripts/start_live_simulation.py --open")
    print("  2. Query the database: sqlite3 app/data/phase3.db")
    print("  3. Monitor events via: curl http://127.0.0.1:3100/api/events")
    print("\n")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
