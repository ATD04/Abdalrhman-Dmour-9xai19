# Supabase Migration Guide (JNPI)

This guide maps the existing SQLite data model to Supabase PostgreSQL and provides a low-risk rollout order.

## What exists today

Current storage is SQLite-per-service plus file-based vectors:

- knowledge-service metadata DB in [app/services/knowledge-service/storage/database.py](app/services/knowledge-service/storage/database.py)
- workflow-service DB in [app/services/workflow-service/storage/database.py](app/services/workflow-service/storage/database.py)
- governance-service DB in [app/services/governance-service/storage/database.py](app/services/governance-service/storage/database.py)
- agent-service sessions DB in [app/services/agent-service/storage/sessions.py](app/services/agent-service/storage/sessions.py)
- file-based vectors in [app/services/knowledge-service/storage/vector_store.py](app/services/knowledge-service/storage/vector_store.py)

No migration framework currently exists (no Alembic, no SQL migration files).

## Recommended decision

Use Supabase now for relational data, but keep vectors file-based in phase 1.

Why this is the best first move:

- minimal code risk: all four services can move from SQLite to Postgres without redesigning retrieval
- immediate reliability gain: managed backups, observability, and concurrent write handling
- staged complexity: defer pgvector until you complete a controlled retrieval benchmark

Then, in phase 2, migrate vectors to pgvector only if needed for scale/latency.

## SQL bootstrap

Run this in the Supabase SQL editor:

- [app/docs/plans/supabase_bootstrap.sql](app/docs/plans/supabase_bootstrap.sql)

It creates all currently required tables and indexes, and includes optional commented pgvector DDL.

## Rollout plan

1. Create Supabase project and run bootstrap SQL.
2. Add service env vars for Postgres DSN and branch runtime by backend.
3. Migrate one service at a time in this order:
   1. governance-service (append-heavy, low coupling)
   2. agent-service sessions
   3. workflow-service
   4. knowledge-service metadata
4. Keep knowledge vectors on disk during phase 1.
5. Validate parity with API-level smoke tests.
6. Optional phase 2: move vectors into pgvector and swap retrieval path.

## Code changes required

You will need to replace direct sqlite3 usage with a Postgres client layer in these files:

- [app/services/governance-service/storage/database.py](app/services/governance-service/storage/database.py)
- [app/services/agent-service/storage/sessions.py](app/services/agent-service/storage/sessions.py)
- [app/services/workflow-service/storage/database.py](app/services/workflow-service/storage/database.py)
- [app/services/knowledge-service/storage/database.py](app/services/knowledge-service/storage/database.py)

Important compatibility notes:

- booleans are currently stored as INTEGER in SQLite; in Postgres they should be BOOLEAN
- JSON text fields should be migrated to JSONB (`tags`, `metadata`, `messages`, `sector_labels`)
- timestamps are currently ISO strings; Postgres uses TIMESTAMPTZ
- `INSERT OR REPLACE` in SQLite should be rewritten as `INSERT ... ON CONFLICT ... DO UPDATE`

## Data migration approach

If you have existing SQLite data worth preserving:

1. export each SQLite DB to CSV or JSON per table
2. transform JSON text columns into valid JSON values
3. load into Supabase with COPY/import
4. verify row counts and selected records per table

## Security baseline in Supabase

Since microservices are server-side and trusted, start with:

- service-role key only on backend services
- RLS disabled initially on these internal tables

If frontend direct access is added later, enable RLS per table and split access policies by role.

## What not to do first

- do not migrate vectors and relational metadata at the same time
- do not change table names unless you also refactor all SQL call sites
- do not enforce strict enum/check constraints until current runtime values are audited in production

## Next implementation step

After schema creation, implement a shared Postgres adapter (one module per service or one shared package) and switch one service first (governance-service) behind an env flag.
