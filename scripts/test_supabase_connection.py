#!/usr/bin/env python3
"""
Supabase Connection & Schema Test Script
Tests connection to Supabase and all tables defined in supabase_bootstrap.sql.
Cleans up all test data after verification.
"""

import os
import sys
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Add parent dirs to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "app"))

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:
    print("❌ psycopg not installed. Install with: pip install psycopg[binary]")
    sys.exit(1)


def load_env():
    """Load DATABASE_URL from .env.shared"""
    env_file = Path(__file__).parent.parent / "app" / ".env.shared"
    if not env_file.exists():
        print(f"❌ {env_file} not found")
        sys.exit(1)
    
    database_url = None
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line.startswith("DATABASE_URL="):
                database_url = line.split("=", 1)[1].strip()
                break
    
    if not database_url:
        print("❌ DATABASE_URL not found in .env.shared")
        sys.exit(1)
    
    # Add SSL mode if missing
    if "sslmode=" not in database_url:
        database_url = f"{database_url}?sslmode=require" if "?" not in database_url else f"{database_url}&sslmode=require"
    
    return database_url


def connect(database_url: str):
    """Establish connection to Supabase."""
    try:
        conn = psycopg.connect(database_url, row_factory=dict_row)
        return conn
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        sys.exit(1)


def test_tables(conn):
    """Test all tables with insert, verify, and cleanup."""
    tests_passed = 0
    tests_failed = 0
    inserted_ids = {
        "sources": [],
        "chunks": [],
        "versions": [],
        "file_hashes": [],
        "cases": [],
        "case_timeline": [],
        "audit_log": [],
        "sessions": [],
    }
    
    print("\n" + "="*70)
    print("SUPABASE SCHEMA TESTING")
    print("="*70)
    
    with conn.cursor() as cur:
        # ═════════════════════════════════════════════════════════════
        # 1. TEST: sources TABLE
        # ═════════════════════════════════════════════════════════════
        print("\n[1/8] Testing sources table...")
        try:
            source_id = f"test_source_{uuid.uuid4().hex[:8]}"
            test_ministry = "labor_agent"
            cur.execute("""
                INSERT INTO sources (source_id, source_name, filename, file_type,
                    doc_type, tags, language, visibility, approval_status,
                    ministry_name, metadata, current_version, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 1, NOW(), NOW())
            """, (source_id, "Test Source", "test.pdf", "pdf",
                  "general", json.dumps(["test", "demo"]), "en",
                  "public", "approved", test_ministry,
                  json.dumps({"test": "metadata"})))
            
            cur.execute("SELECT * FROM sources WHERE source_id = %s", (source_id,))
            row = cur.fetchone()
            
            if row:
                print(f"  ✅ INSERT & SELECT successful")
                print(f"     source_id: {row['source_id']}")
                inserted_ids["sources"].append(source_id)
                tests_passed += 1
            else:
                print(f"  ❌ SELECT failed after INSERT")
                tests_failed += 1
        except Exception as e:
            print(f"  ❌ Error: {e}")
            tests_failed += 1
        
        # ═════════════════════════════════════════════════════════════
        # 2. TEST: chunks TABLE
        # ═════════════════════════════════════════════════════════════
        print("\n[2/8] Testing chunks table...")
        try:
            chunk_id = f"test_chunk_{uuid.uuid4().hex[:8]}"
            source_id = inserted_ids["sources"][0] if inserted_ids["sources"] else "dummy_source"
            
            cur.execute("""
                INSERT INTO chunks (chunk_id, source_id, ministry_name, version, page,
                    chunk_type, metadata, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            """, (chunk_id, source_id, test_ministry, 1, 1, "text", json.dumps({"chunk": "test"})))
            
            cur.execute("SELECT * FROM chunks WHERE chunk_id = %s", (chunk_id,))
            row = cur.fetchone()
            
            if row:
                print(f"  ✅ INSERT & SELECT successful")
                print(f"     chunk_id: {row['chunk_id']}")
                inserted_ids["chunks"].append(chunk_id)
                tests_passed += 1
            else:
                print(f"  ❌ SELECT failed after INSERT")
                tests_failed += 1
        except Exception as e:
            print(f"  ❌ Error: {e}")
            tests_failed += 1
        
        # ═════════════════════════════════════════════════════════════
        # 3. TEST: versions TABLE
        # ═════════════════════════════════════════════════════════════
        print("\n[3/8] Testing versions table...")
        try:
            source_id = inserted_ids["sources"][0] if inserted_ids["sources"] else "dummy_source"
            
            cur.execute("""
                INSERT INTO versions (source_id, ministry_name, version, chunks_created,
                    is_active, created_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
            """, (source_id, test_ministry, 1, 5, True))
            
            cur.execute("SELECT * FROM versions WHERE source_id = %s", (source_id,))
            row = cur.fetchone()
            
            if row:
                print(f"  ✅ INSERT & SELECT successful")
                print(f"     version: {row['version']}, chunks_created: {row['chunks_created']}")
                inserted_ids["versions"].append(row["id"])
                tests_passed += 1
            else:
                print(f"  ❌ SELECT failed after INSERT")
                tests_failed += 1
        except Exception as e:
            print(f"  ❌ Error: {e}")
            tests_failed += 1
        
        # ═════════════════════════════════════════════════════════════
        # 4. TEST: file_hashes TABLE
        # ═════════════════════════════════════════════════════════════
        print("\n[4/8] Testing file_hashes table...")
        try:
            file_hash = f"test_hash_{uuid.uuid4().hex[:16]}"
            source_id = inserted_ids["sources"][0] if inserted_ids["sources"] else "dummy_source"
            
            cur.execute("""
                INSERT INTO file_hashes (hash, source_id, ministry_name, version, filename, created_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
            """, (file_hash, source_id, test_ministry, 1, "test.pdf"))
            
            cur.execute("SELECT * FROM file_hashes WHERE hash = %s", (file_hash,))
            row = cur.fetchone()
            
            if row:
                print(f"  ✅ INSERT & SELECT successful")
                print(f"     hash: {row['hash']}")
                inserted_ids["file_hashes"].append(file_hash)
                tests_passed += 1
            else:
                print(f"  ❌ SELECT failed after INSERT")
                tests_failed += 1
        except Exception as e:
            print(f"  ❌ Error: {e}")
            tests_failed += 1
        
        # ═════════════════════════════════════════════════════════════
        # 5. TEST: cases TABLE
        # ═════════════════════════════════════════════════════════════
        print("\n[5/8] Testing cases table...")
        try:
            case_id = f"test_case_{uuid.uuid4().hex[:8]}"
            request_id = f"req_{uuid.uuid4().hex[:8]}"
            query_hash = f"qh_{uuid.uuid4().hex[:16]}"
            
            cur.execute("""
                INSERT INTO cases (case_id, request_id, session_id, user_id,
                    query, query_hash, user_type, sector_primary, sector_labels,
                    priority, status, assigned_to, escalation_reason, confidence,
                    source_response_id, resolution_answer, resolution_note,
                    is_faq_candidate, created_at, updated_at, resolved_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, NOW(), NOW(), NULL)
            """, (case_id, request_id, "sess_123", "user_123", "What is X?",
                  query_hash, "citizen", "education", json.dumps(["education"]),
                  "high", "open", "admin_1", "test escalation", 0.95,
                  "resp_123", None, None, False))
            
            cur.execute("SELECT * FROM cases WHERE case_id = %s", (case_id,))
            row = cur.fetchone()
            
            if row:
                print(f"  ✅ INSERT & SELECT successful")
                print(f"     case_id: {row['case_id']}, status: {row['status']}")
                inserted_ids["cases"].append(case_id)
                tests_passed += 1
            else:
                print(f"  ❌ SELECT failed after INSERT")
                tests_failed += 1
        except Exception as e:
            print(f"  ❌ Error: {e}")
            tests_failed += 1
        
        # ═════════════════════════════════════════════════════════════
        # 6. TEST: case_timeline TABLE
        # ═════════════════════════════════════════════════════════════
        print("\n[6/8] Testing case_timeline table...")
        try:
            case_id = inserted_ids["cases"][0] if inserted_ids["cases"] else "dummy_case"
            
            cur.execute("""
                INSERT INTO case_timeline (case_id, event_type, actor, note,
                    metadata, created_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
            """, (case_id, "status_change", "system", "Case created",
                  json.dumps({"from": "pending", "to": "open"})))
            
            cur.execute("SELECT * FROM case_timeline WHERE case_id = %s", (case_id,))
            row = cur.fetchone()
            
            if row:
                print(f"  ✅ INSERT & SELECT successful")
                print(f"     event_type: {row['event_type']}, actor: {row['actor']}")
                inserted_ids["case_timeline"].append(row["id"])
                tests_passed += 1
            else:
                print(f"  ❌ SELECT failed after INSERT")
                tests_failed += 1
        except Exception as e:
            print(f"  ❌ Error: {e}")
            tests_failed += 1
        
        # ═════════════════════════════════════════════════════════════
        # 7. TEST: audit_log TABLE
        # ═════════════════════════════════════════════════════════════
        print("\n[7/8] Testing audit_log table...")
        try:
            request_id = f"audit_req_{uuid.uuid4().hex[:8]}"
            
            cur.execute("""
                INSERT INTO audit_log (request_id, session_id, query, user_type,
                    intent, sector, agent_used, answer, confidence,
                    has_amendments, escalated, escalation_reason,
                    input_passed, input_category, input_reason,
                    output_passed, output_category, output_reason,
                    total_latency_ms, routing_latency_ms, retrieval_latency_ms,
                    generation_latency_ms, citations_count, chunks_used, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """, (request_id, "sess_audit", "Test query", "citizen",
                  "info_request", "education", "retrieval_agent",
                  "Test answer", 0.85, False, False, None,
                  True, None, None, True, None, None,
                  1234.5, 100.2, 450.3, 684.0, 3, 5))
            
            cur.execute("SELECT * FROM audit_log WHERE request_id = %s", (request_id,))
            row = cur.fetchone()
            
            if row:
                print(f"  ✅ INSERT & SELECT successful")
                print(f"     request_id: {row['request_id']}, confidence: {row['confidence']}")
                inserted_ids["audit_log"].append(request_id)
                tests_passed += 1
            else:
                print(f"  ❌ SELECT failed after INSERT")
                tests_failed += 1
        except Exception as e:
            print(f"  ❌ Error: {e}")
            tests_failed += 1
        
        # ═════════════════════════════════════════════════════════════
        # 8. TEST: sessions TABLE
        # ═════════════════════════════════════════════════════════════
        print("\n[8/8] Testing sessions table...")
        try:
            session_id = f"test_session_{uuid.uuid4().hex[:8]}"
            messages = [
                {"role": "user", "content": "Hello"},
                {"role": "assistant", "content": "Hi there!"}
            ]
            
            cur.execute("""
                INSERT INTO sessions (session_id, messages, user_type,
                    created_at, updated_at)
                VALUES (%s, %s, %s, NOW(), NOW())
            """, (session_id, json.dumps(messages), "citizen"))
            
            cur.execute("SELECT * FROM sessions WHERE session_id = %s", (session_id,))
            row = cur.fetchone()
            
            if row:
                print(f"  ✅ INSERT & SELECT successful")
                print(f"     session_id: {row['session_id']}, messages count: {len(row['messages']) if isinstance(row['messages'], list) else 'N/A'}")
                inserted_ids["sessions"].append(session_id)
                tests_passed += 1
            else:
                print(f"  ❌ SELECT failed after INSERT")
                tests_failed += 1
        except Exception as e:
            print(f"  ❌ Error: {e}")
            tests_failed += 1
    
    # ═════════════════════════════════════════════════════════════
    # CLEANUP PHASE
    # ═════════════════════════════════════════════════════════════
    print("\n" + "="*70)
    print("CLEANUP PHASE - Removing all test data")
    print("="*70)
    
    conn.commit()  # Commit inserts first
    
    with conn.cursor() as cur:
        cleanup_order = [
            ("case_timeline", "id", inserted_ids["case_timeline"]),
            ("cases", "case_id", inserted_ids["cases"]),
            ("sessions", "session_id", inserted_ids["sessions"]),
            ("audit_log", "request_id", inserted_ids["audit_log"]),
            ("file_hashes", "hash", inserted_ids["file_hashes"]),
            ("versions", "id", inserted_ids["versions"]),
            ("chunks", "chunk_id", inserted_ids["chunks"]),
            ("sources", "source_id", inserted_ids["sources"]),
        ]
        
        for table_name, pk_col, ids in cleanup_order:
            if ids:
                try:
                    placeholders = ",".join(["%s"] * len(ids))
                    cur.execute(f"DELETE FROM {table_name} WHERE {pk_col} IN ({placeholders})", ids)
                    rows_deleted = cur.rowcount
                    print(f"  ✅ {table_name}: Deleted {rows_deleted} row(s)")
                except Exception as e:
                    print(f"  ❌ {table_name}: Cleanup failed - {e}")
    
    conn.commit()
    
    # ═════════════════════════════════════════════════════════════
    # FINAL REPORT
    # ═════════════════════════════════════════════════════════════
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    print(f"Tests Passed: {tests_passed}")
    print(f"Tests Failed: {tests_failed}")
    print(f"Total Tests:  {tests_passed + tests_failed}")
    
    if tests_failed == 0:
        print("\n✅ All tests passed! Supabase schema is ready.")
        return 0
    else:
        print(f"\n❌ {tests_failed} test(s) failed. Please review errors above.")
        return 1


def main():
    print("🔄 Loading environment configuration...")
    database_url = load_env()
    print(f"✅ Database URL loaded (host: {database_url.split('@')[1].split(':')[0] if '@' in database_url else 'unknown'})")
    
    print("\n🔗 Connecting to Supabase...")
    conn = connect(database_url)
    print("✅ Connection established!")
    
    try:
        exit_code = test_tables(conn)
    finally:
        conn.close()
    
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
