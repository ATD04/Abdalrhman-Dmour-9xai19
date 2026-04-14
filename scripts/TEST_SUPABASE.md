# Supabase Connection & Schema Test Script

## Overview

The `test_supabase_connection.py` script tests the connectivity to Supabase and validates all tables defined in the schema. It automatically **cleans up all test data after verification**, ensuring no test artifacts remain in the database.

## Features

✅ **Connection Testing** — Validates Supabase PostgreSQL connectivity  
✅ **Full Schema Coverage** — Tests all 8 tables (sources, chunks, versions, file_hashes, cases, case_timeline, audit_log, sessions)  
✅ **INSERT Verification** — Inserts test data into each table  
✅ **SELECT Validation** — Verifies data can be retrieved  
✅ **Automatic Cleanup** — Removes all test data in correct dependency order  
✅ **Detailed Reporting** — Shows per-table test results and cleanup status  

## Tested Tables

1. **sources** — Document metadata store
2. **chunks** — Document chunk records
3. **versions** — Version history
4. **file_hashes** — Duplicate detection hashes
5. **cases** — Case management records
6. **case_timeline** — Case event audit trail
7. **audit_log** — Request/response audit logs
8. **sessions** — Agent conversation sessions

## Prerequisites

- Python 3.9+
- `psycopg[binary]` (PostgreSQL driver)
- Network access to Supabase
- `.env.shared` with `DATABASE_URL` configured

## Installation

```bash
# Activate your virtual environment
source /Users/ezz/Documents/GitHub/Knowledge2/.venv/bin/activate

# Install psycopg if not already installed
pip install 'psycopg[binary]>=3.2.1'
```

## Usage

```bash
# From the Knowledge2 directory
cd /Users/ezz/Documents/GitHub/Knowledge2

# Activate venv
source .venv/bin/activate

# Run the test script
python scripts/test_supabase_connection.py
```

## Expected Output

```
🔄 Loading environment configuration...
✅ Database URL loaded (host: db.ygyfzexjrhtoicacocfa.supabase.co)

🔗 Connecting to Supabase...
✅ Connection established!

======================================================================
SUPABASE SCHEMA TESTING
======================================================================

[1/8] Testing sources table...
  ✅ INSERT & SELECT successful
     source_id: test_source_a1b2c3d4
...

[8/8] Testing sessions table...
  ✅ INSERT & SELECT successful
     session_id: test_session_x9y8z7w6

======================================================================
CLEANUP PHASE - Removing all test data
======================================================================
  ✅ case_timeline: Deleted 1 row(s)
  ✅ cases: Deleted 1 row(s)
  ✅ sessions: Deleted 1 row(s)
  ✅ audit_log: Deleted 1 row(s)
  ✅ file_hashes: Deleted 1 row(s)
  ✅ versions: Deleted 1 row(s)
  ✅ chunks: Deleted 1 row(s)
  ✅ sources: Deleted 1 row(s)

======================================================================
TEST SUMMARY
======================================================================
Tests Passed: 8
Tests Failed: 0
Total Tests:  8

✅ All tests passed! Supabase schema is ready.
```

## How It Works

### Phase 1: Testing
1. Loads `DATABASE_URL` from `.env.shared`
2. Establishes SSL connection to Supabase
3. For each table:
   - Generates unique test IDs (UUIDs)
   - Inserts test record
   - Verifies SELECT returns the record
   - Stores PK for later cleanup

### Phase 2: Cleanup
Deletes all test records in reverse dependency order:
1. Foreign key tables first (case_timeline, sessions, audit_log)
2. Then primary key tables (cases, file_hashes, versions, chunks, sources)

### Error Handling
- If connection fails, exits with error message
- If any INSERT/SELECT fails, reports the specific table and error
- Partial failures don't block cleanup of other tables
- Returns exit code 0 on success, 1 on failure

## Troubleshooting

### "psycopg not installed"
```bash
pip install 'psycopg[binary]>=3.2.1'
```

### "failed to resolve host"
- Check network connectivity to Supabase
- Verify `DATABASE_URL` in `.env.shared` is correct
- Ensure Supabase project is active and not paused

### "UNIQUE constraint violation" or similar
- The script uses UUIDs for test IDs, so conflicts are rare
- Run the cleanup phase manually if tables are left in inconsistent state:
  ```sql
  DELETE FROM public.case_timeline WHERE created_at > NOW() - INTERVAL '1 minute';
  DELETE FROM public.cases WHERE created_at > NOW() - INTERVAL '1 minute';
  -- etc...
  ```

### "SSL certificate verification failed"
- The script automatically adds `sslmode=require` if missing
- Verify `.env.shared` `DATABASE_URL` doesn't have conflicting SSL settings

## Integration with CI/CD

The script can be used in CI/CD pipelines to validate Supabase readiness before deployments:

```bash
#!/bin/bash
set -e

source .venv/bin/activate
python scripts/test_supabase_connection.py

if [ $? -eq 0 ]; then
  echo "✅ Supabase schema validation passed"
  exit 0
else
  echo "❌ Supabase schema validation failed"
  exit 1
fi
```

## Environment Variables

**From `.env.shared`:**
- `DATABASE_URL` — Supabase PostgreSQL connection string (required)

Example:
```
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
```

## Notes

- All test data uses unique IDs (UUIDs), safe for concurrent runs
- Cleanup is atomic per table (all-or-nothing)
- Script uses ISO format for timestamps
- JSON columns (JSONB) are tested with valid JSON payloads
- Foreign key relationships are validated through successful inserts
- Script is idempotent — safe to run multiple times

## Related Files

- [supabase_bootstrap.sql](../docs/plans/supabase_bootstrap.sql) — Complete schema
- [supabase_migration_guide.md](../docs/plans/supabase_migration_guide.md) — Migration strategy
- [.env.shared](../.env.shared) — Environment configuration

---

**Last Updated:** March 17, 2026  
**Author:** Generated for JNPI Knowledge Platform  
**Status:** Production-ready
