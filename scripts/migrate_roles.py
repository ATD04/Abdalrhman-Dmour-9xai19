#!/usr/bin/env python3
"""
Role Consolidation Migration Script

Migrates existing user roles from 5-role system to 3-role system:
- user → citizen
- expert, curator → operator
- admin, executive → admin

Supports both SQLite and PostgreSQL databases.
"""

import sqlite3
import sys
import os
from pathlib import Path

def migrate_sqlite_database(db_path: str):
    """Execute role migration on SQLite database."""
    print(f"Migrating SQLite database: {db_path}")

    try:
        with sqlite3.connect(db_path) as conn:
            conn.execute("BEGIN TRANSACTION;")

            # Update users table
            cursor = conn.execute("""
                UPDATE users SET role = CASE
                  WHEN role = 'user' THEN 'citizen'
                  WHEN role IN ('expert', 'curator') THEN 'operator'
                  WHEN role IN ('admin', 'executive') THEN 'admin'
                  ELSE 'citizen'
                END
                WHERE role IN ('user', 'expert', 'curator', 'executive');
            """)
            users_updated = cursor.rowcount
            print(f"✓ Updated {users_updated} user roles")

            # Update audit_log table if exists
            try:
                cursor = conn.execute("""
                    UPDATE audit_log SET user_type = CASE
                      WHEN user_type = 'user' THEN 'citizen'
                      WHEN user_type IN ('expert', 'curator') THEN 'operator'
                      WHEN user_type IN ('admin', 'executive') THEN 'admin'
                      ELSE 'citizen'
                    END
                    WHERE user_type IN ('user', 'expert', 'curator', 'executive');
                """)
                audit_updated = cursor.rowcount
                print(f"✓ Updated {audit_updated} audit log entries")
            except sqlite3.Error:
                print("- No audit_log table found (skipping)")

            # Update cases table if exists
            try:
                cursor = conn.execute("""
                    UPDATE cases SET user_type = CASE
                      WHEN user_type = 'user' THEN 'citizen'
                      WHEN user_type IN ('expert', 'curator') THEN 'operator'
                      WHEN user_type IN ('admin', 'executive') THEN 'admin'
                      ELSE 'citizen'
                    END
                    WHERE user_type IN ('user', 'expert', 'curator', 'executive');
                """)
                cases_updated = cursor.rowcount
                print(f"✓ Updated {cases_updated} case user types")

                # Update assigned_to field
                cursor = conn.execute("""
                    UPDATE cases SET assigned_to = CASE
                      WHEN assigned_to = 'expert' THEN 'operator'
                      WHEN assigned_to = 'curator' THEN 'operator'
                      WHEN assigned_to = 'executive' THEN 'admin'
                      ELSE assigned_to
                    END
                    WHERE assigned_to IN ('expert', 'curator', 'executive');
                """)
                assigned_updated = cursor.rowcount
                print(f"✓ Updated {assigned_updated} case assignments")
            except sqlite3.Error:
                print("- No cases table found (skipping)")

            # Update sessions table if exists
            try:
                cursor = conn.execute("""
                    UPDATE sessions SET user_type = CASE
                      WHEN user_type = 'user' THEN 'citizen'
                      WHEN user_type IN ('expert', 'curator') THEN 'operator'
                      WHEN user_type IN ('admin', 'executive') THEN 'admin'
                      ELSE 'citizen'
                    END
                    WHERE user_type IN ('user', 'expert', 'curator', 'executive');
                """)
                sessions_updated = cursor.rowcount
                print(f"✓ Updated {sessions_updated} session user types")
            except sqlite3.Error:
                print("- No sessions table found (skipping)")

            conn.execute("COMMIT;")
            print("✓ Migration completed successfully")

            # Verification
            print("\n--- Verification ---")
            cursor = conn.execute("SELECT role, COUNT(*) FROM users GROUP BY role;")
            for role, count in cursor.fetchall():
                print(f"Role '{role}': {count} users")

    except sqlite3.Error as e:
        print(f"✗ SQLite error: {e}")
        return False
    except Exception as e:
        print(f"✗ Unexpected error: {e}")
        return False

    return True

def migrate_postgresql_database(connection_string: str):
    """Execute role migration on PostgreSQL database."""
    try:
        import psycopg2
    except ImportError:
        print("✗ psycopg2 not installed. Install with: pip install psycopg2-binary")
        return False

    print(f"Migrating PostgreSQL database")

    try:
        with psycopg2.connect(connection_string) as conn:
            with conn.cursor() as cur:
                # Update users table
                cur.execute("""
                    UPDATE users SET role = CASE
                      WHEN role = 'user' THEN 'citizen'
                      WHEN role IN ('expert', 'curator') THEN 'operator'
                      WHEN role IN ('admin', 'executive') THEN 'admin'
                      ELSE 'citizen'
                    END
                    WHERE role IN ('user', 'expert', 'curator', 'executive');
                """)
                users_updated = cur.rowcount
                print(f"✓ Updated {users_updated} user roles")

                # Update audit_log table if exists
                try:
                    cur.execute("""
                        UPDATE audit_log SET user_type = CASE
                          WHEN user_type = 'user' THEN 'citizen'
                          WHEN user_type IN ('expert', 'curator') THEN 'operator'
                          WHEN user_type IN ('admin', 'executive') THEN 'admin'
                          ELSE 'citizen'
                        END
                        WHERE user_type IN ('user', 'expert', 'curator', 'executive');
                    """)
                    audit_updated = cur.rowcount
                    print(f"✓ Updated {audit_updated} audit log entries")
                except psycopg2.Error:
                    print("- No audit_log table found (skipping)")

                # Update cases table if exists
                try:
                    cur.execute("""
                        UPDATE cases SET user_type = CASE
                          WHEN user_type = 'user' THEN 'citizen'
                          WHEN user_type IN ('expert', 'curator') THEN 'operator'
                          WHEN user_type IN ('admin', 'executive') THEN 'admin'
                          ELSE 'citizen'
                        END
                        WHERE user_type IN ('user', 'expert', 'curator', 'executive');
                    """)
                    cases_updated = cur.rowcount
                    print(f"✓ Updated {cases_updated} case user types")

                    cur.execute("""
                        UPDATE cases SET assigned_to = CASE
                          WHEN assigned_to = 'expert' THEN 'operator'
                          WHEN assigned_to = 'curator' THEN 'operator'
                          WHEN assigned_to = 'executive' THEN 'admin'
                          ELSE assigned_to
                        END
                        WHERE assigned_to IN ('expert', 'curator', 'executive');
                    """)
                    assigned_updated = cur.rowcount
                    print(f"✓ Updated {assigned_updated} case assignments")
                except psycopg2.Error:
                    print("- No cases table found (skipping)")

                # Update sessions table if exists
                try:
                    cur.execute("""
                        UPDATE sessions SET user_type = CASE
                          WHEN user_type = 'user' THEN 'citizen'
                          WHEN user_type IN ('expert', 'curator') THEN 'operator'
                          WHEN user_type IN ('admin', 'executive') THEN 'admin'
                          ELSE 'citizen'
                        END
                        WHERE user_type IN ('user', 'expert', 'curator', 'executive');
                    """)
                    sessions_updated = cur.rowcount
                    print(f"✓ Updated {sessions_updated} session user types")
                except psycopg2.Error:
                    print("- No sessions table found (skipping)")

                conn.commit()
                print("✓ Migration completed successfully")

                # Verification
                print("\n--- Verification ---")
                cur.execute("SELECT role, COUNT(*) FROM users GROUP BY role;")
                for role, count in cur.fetchall():
                    print(f"Role '{role}': {count} users")

    except psycopg2.Error as e:
        print(f"✗ PostgreSQL error: {e}")
        return False
    except Exception as e:
        print(f"✗ Unexpected error: {e}")
        return False

    return True

def main():
    print("JNPI Role Consolidation Migration")
    print("=" * 40)

    # Check for SQLite databases
    sqlite_paths = [
        "app/services/workflow-service/storage/workflow.db",
        "app/services/governance-service/storage/governance.db",
        "app/services/agent-service/storage/agent.db",
        "app/services/knowledge-service/storage/knowledge.db"
    ]

    migrated_any = False

    for path in sqlite_paths:
        if os.path.exists(path):
            success = migrate_sqlite_database(path)
            migrated_any = migrated_any or success
            print()

    # Check for PostgreSQL environment
    pg_url = os.getenv("SUPABASE_DATABASE_URL") or os.getenv("DATABASE_URL")
    if pg_url:
        success = migrate_postgresql_database(pg_url)
        migrated_any = migrated_any or success

    if not migrated_any:
        print("✗ No databases found to migrate")
        print("Make sure you're running this from the project root directory")
        print("Or set SUPABASE_DATABASE_URL environment variable for PostgreSQL")
        sys.exit(1)

    print("\n🎉 Role migration completed!")
    print("\nNext steps:")
    print("1. Test the application with the new role system")
    print("2. Update any hardcoded role references in the backend services")
    print("3. Clear browser localStorage for existing users to refresh their cached roles")

if __name__ == "__main__":
    main()