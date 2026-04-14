-- =============================================================================
-- Ministry Partitioning Migration
-- =============================================================================
-- Migrates from single-table schema to Postgres LIST-partitioned per-ministry
-- tables for: source_groups, sources, chunks, pdf_pages, versions, file_hashes,
-- and chunk_embeddings.
--
-- Partition values:
--   civil_status_agent, civil_service_agent, labor_agent,
--   justice_agent, digital_economy_agent
--   DEFAULT partition catches 'general' and any unlisted values.
--
-- Strategy per table:
--   1. Normalize NULLs → 'general'
--   2. Add ministry_name to child tables, populate via sources join
--   3. Rename old table → {table}_old
--   4. Create partitioned replacement + per-ministry partitions
--   5. Bulk-copy data
--   6. Re-create indexes and composite foreign keys
--   7. Drop old tables
--   8. Verify row counts
--
-- Prerequisites: PostgreSQL 14+ (Supabase), pgvector extension
-- =============================================================================

-- Disable statement timeout for large data moves
SET statement_timeout = '0';

-- Ensure pgvector is available before we reference the vector type
CREATE EXTENSION IF NOT EXISTS vector;

BEGIN;

-- =============================================================================
-- PHASE 1: Capture pre-migration row counts for verification
-- =============================================================================
DROP TABLE IF EXISTS _migration_counts_before;
CREATE TEMP TABLE _migration_counts_before AS
    SELECT 'source_groups'    AS tbl, COUNT(*) AS cnt FROM public.source_groups
    UNION ALL
    SELECT 'sources',           COUNT(*) FROM public.sources
    UNION ALL
    SELECT 'chunks',            COUNT(*) FROM public.chunks
    UNION ALL
    SELECT 'pdf_pages',         COUNT(*) FROM public.pdf_pages
    UNION ALL
    SELECT 'versions',          COUNT(*) FROM public.versions
    UNION ALL
    SELECT 'file_hashes',       COUNT(*) FROM public.file_hashes
    UNION ALL
    SELECT 'chunk_embeddings',  COUNT(*) FROM public.chunk_embeddings;

-- =============================================================================
-- PHASE 2: Normalize NULL ministry_name → 'general' in parent tables
-- =============================================================================
UPDATE public.source_groups
   SET ministry_name = 'general'
 WHERE ministry_name IS NULL;

UPDATE public.sources
   SET ministry_name = 'general'
 WHERE ministry_name IS NULL;

-- =============================================================================
-- PHASE 3: Add ministry_name to child tables and populate from sources join
-- =============================================================================

-- ---- chunks ----
ALTER TABLE public.chunks
    ADD COLUMN IF NOT EXISTS ministry_name TEXT;

UPDATE public.chunks AS c
   SET ministry_name = COALESCE(s.ministry_name, 'general')
  FROM public.sources AS s
 WHERE c.source_id = s.source_id
   AND c.ministry_name IS NULL;

-- Fallback: orphan rows or any remaining NULLs
UPDATE public.chunks
   SET ministry_name = 'general'
 WHERE ministry_name IS NULL;

-- ---- pdf_pages ----
ALTER TABLE public.pdf_pages
    ADD COLUMN IF NOT EXISTS ministry_name TEXT;

UPDATE public.pdf_pages AS p
   SET ministry_name = COALESCE(s.ministry_name, 'general')
  FROM public.sources AS s
 WHERE p.source_id = s.source_id
   AND p.ministry_name IS NULL;

UPDATE public.pdf_pages
   SET ministry_name = 'general'
 WHERE ministry_name IS NULL;

-- ---- versions ----
ALTER TABLE public.versions
    ADD COLUMN IF NOT EXISTS ministry_name TEXT;

UPDATE public.versions AS v
   SET ministry_name = COALESCE(s.ministry_name, 'general')
  FROM public.sources AS s
 WHERE v.source_id = s.source_id
   AND v.ministry_name IS NULL;

UPDATE public.versions
   SET ministry_name = 'general'
 WHERE ministry_name IS NULL;

-- ---- file_hashes ----
ALTER TABLE public.file_hashes
    ADD COLUMN IF NOT EXISTS ministry_name TEXT;

UPDATE public.file_hashes AS fh
   SET ministry_name = COALESCE(s.ministry_name, 'general')
  FROM public.sources AS s
 WHERE fh.source_id = s.source_id
   AND fh.ministry_name IS NULL;

UPDATE public.file_hashes
   SET ministry_name = 'general'
 WHERE ministry_name IS NULL;

-- ---- chunk_embeddings ----
ALTER TABLE public.chunk_embeddings
    ADD COLUMN IF NOT EXISTS ministry_name TEXT;

UPDATE public.chunk_embeddings AS ce
   SET ministry_name = COALESCE(s.ministry_name, 'general')
  FROM public.sources AS s
 WHERE ce.source_id = s.source_id
   AND ce.ministry_name IS NULL;

UPDATE public.chunk_embeddings
   SET ministry_name = 'general'
 WHERE ministry_name IS NULL;

-- =============================================================================
-- PHASE 4: Drop all foreign-key constraints (required before rename)
-- =============================================================================
-- chunk_embeddings → chunks, sources
ALTER TABLE public.chunk_embeddings DROP CONSTRAINT IF EXISTS chunk_embeddings_chunk_id_fkey;
ALTER TABLE public.chunk_embeddings DROP CONSTRAINT IF EXISTS chunk_embeddings_source_id_fkey;

-- pdf_pages → sources, chunks
ALTER TABLE public.pdf_pages DROP CONSTRAINT IF EXISTS pdf_pages_source_id_fkey;
ALTER TABLE public.pdf_pages DROP CONSTRAINT IF EXISTS pdf_pages_text_chunk_id_fkey;

-- chunks → sources
ALTER TABLE public.chunks DROP CONSTRAINT IF EXISTS chunks_source_id_fkey;

-- versions → sources
ALTER TABLE public.versions DROP CONSTRAINT IF EXISTS versions_source_id_fkey;

-- file_hashes → sources
ALTER TABLE public.file_hashes DROP CONSTRAINT IF EXISTS file_hashes_source_id_fkey;

-- sources → source_groups
ALTER TABLE public.sources DROP CONSTRAINT IF EXISTS sources_source_group_id_fkey;

-- Drop CHECK constraints that restrict ministry_name values (partitioning handles this)
ALTER TABLE public.source_groups DROP CONSTRAINT IF EXISTS source_groups_ministry_name_check;
ALTER TABLE public.sources       DROP CONSTRAINT IF EXISTS sources_ministry_name_check;
ALTER TABLE public.sources       DROP CONSTRAINT IF EXISTS sources_ministry_type_check;

-- =============================================================================
-- PHASE 5: Rename old tables
-- =============================================================================
ALTER TABLE public.chunk_embeddings RENAME TO chunk_embeddings_old;
ALTER TABLE public.pdf_pages        RENAME TO pdf_pages_old;
ALTER TABLE public.file_hashes      RENAME TO file_hashes_old;
ALTER TABLE public.versions         RENAME TO versions_old;
ALTER TABLE public.chunks           RENAME TO chunks_old;
ALTER TABLE public.sources          RENAME TO sources_old;
ALTER TABLE public.source_groups    RENAME TO source_groups_old;

-- =============================================================================
-- PHASE 6: Create partitioned tables and partitions
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 6a. source_groups  (PK now includes ministry_name)
-- ---------------------------------------------------------------------------
CREATE TABLE public.source_groups (
    group_id          TEXT        NOT NULL,
    group_name        TEXT        NOT NULL,
    normalized_name   TEXT        NOT NULL,
    doc_type          TEXT        NOT NULL DEFAULT 'regulation',
    ministry_name     TEXT        NOT NULL DEFAULT 'general',
    constitution_date TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, ministry_name)
) PARTITION BY LIST (ministry_name);

-- Unique on normalized_name must include partition key
CREATE UNIQUE INDEX uq_source_groups_normalized_ministry
    ON public.source_groups (normalized_name, ministry_name);

CREATE TABLE public.source_groups_civil_status
    PARTITION OF public.source_groups FOR VALUES IN ('civil_status_agent');
CREATE TABLE public.source_groups_civil_service
    PARTITION OF public.source_groups FOR VALUES IN ('civil_service_agent');
CREATE TABLE public.source_groups_labor
    PARTITION OF public.source_groups FOR VALUES IN ('labor_agent');
CREATE TABLE public.source_groups_justice
    PARTITION OF public.source_groups FOR VALUES IN ('justice_agent');
CREATE TABLE public.source_groups_digital_economy
    PARTITION OF public.source_groups FOR VALUES IN ('digital_economy_agent');
CREATE TABLE public.source_groups_general
    PARTITION OF public.source_groups DEFAULT;

-- ---------------------------------------------------------------------------
-- 6b. sources  (PK now includes ministry_name)
-- ---------------------------------------------------------------------------
CREATE TABLE public.sources (
    source_id              TEXT        NOT NULL,
    source_name            TEXT        NOT NULL,
    filename               TEXT        NOT NULL,
    file_type              TEXT        NOT NULL,
    doc_type               TEXT        NOT NULL DEFAULT 'general',
    tags                   JSONB       NOT NULL DEFAULT '[]'::jsonb,
    language               TEXT        NOT NULL DEFAULT 'auto',
    visibility             TEXT        NOT NULL DEFAULT 'public',
    approval_status        TEXT        NOT NULL DEFAULT 'approved',
    date_of_the_constitution TEXT,
    ministry_name          TEXT        NOT NULL DEFAULT 'general',
    ministry_type          TEXT        NOT NULL DEFAULT 'general',
    source_group_id        TEXT,
    group_role             TEXT        NOT NULL DEFAULT 'primary',
    metadata               JSONB       NOT NULL DEFAULT '{}'::jsonb,
    current_version        INTEGER     NOT NULL DEFAULT 1,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (source_id, ministry_name)
) PARTITION BY LIST (ministry_name);

CREATE TABLE public.sources_civil_status
    PARTITION OF public.sources FOR VALUES IN ('civil_status_agent');
CREATE TABLE public.sources_civil_service
    PARTITION OF public.sources FOR VALUES IN ('civil_service_agent');
CREATE TABLE public.sources_labor
    PARTITION OF public.sources FOR VALUES IN ('labor_agent');
CREATE TABLE public.sources_justice
    PARTITION OF public.sources FOR VALUES IN ('justice_agent');
CREATE TABLE public.sources_digital_economy
    PARTITION OF public.sources FOR VALUES IN ('digital_economy_agent');
CREATE TABLE public.sources_general
    PARTITION OF public.sources DEFAULT;

-- ---------------------------------------------------------------------------
-- 6c. chunks  (PK now includes ministry_name)
-- ---------------------------------------------------------------------------
CREATE TABLE public.chunks (
    chunk_id      TEXT        NOT NULL,
    source_id     TEXT        NOT NULL,
    ministry_name TEXT        NOT NULL DEFAULT 'general',
    version       INTEGER     NOT NULL,
    page          INTEGER     NOT NULL,
    chunk_type    TEXT        NOT NULL,
    metadata      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (chunk_id, ministry_name)
) PARTITION BY LIST (ministry_name);

CREATE TABLE public.chunks_civil_status
    PARTITION OF public.chunks FOR VALUES IN ('civil_status_agent');
CREATE TABLE public.chunks_civil_service
    PARTITION OF public.chunks FOR VALUES IN ('civil_service_agent');
CREATE TABLE public.chunks_labor
    PARTITION OF public.chunks FOR VALUES IN ('labor_agent');
CREATE TABLE public.chunks_justice
    PARTITION OF public.chunks FOR VALUES IN ('justice_agent');
CREATE TABLE public.chunks_digital_economy
    PARTITION OF public.chunks FOR VALUES IN ('digital_economy_agent');
CREATE TABLE public.chunks_general
    PARTITION OF public.chunks DEFAULT;

-- ---------------------------------------------------------------------------
-- 6d. pdf_pages  (PK now includes ministry_name)
-- ---------------------------------------------------------------------------
CREATE TABLE public.pdf_pages (
    source_id       TEXT        NOT NULL,
    version         INTEGER     NOT NULL,
    page            INTEGER     NOT NULL,
    ministry_name   TEXT        NOT NULL DEFAULT 'general',
    page_key        TEXT,
    text_chunk_id   TEXT,
    image_mime_type TEXT        NOT NULL DEFAULT 'image/png',
    image_data      BYTEA       NOT NULL,
    width           INTEGER,
    height          INTEGER,
    metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (source_id, version, page, ministry_name)
) PARTITION BY LIST (ministry_name);

CREATE TABLE public.pdf_pages_civil_status
    PARTITION OF public.pdf_pages FOR VALUES IN ('civil_status_agent');
CREATE TABLE public.pdf_pages_civil_service
    PARTITION OF public.pdf_pages FOR VALUES IN ('civil_service_agent');
CREATE TABLE public.pdf_pages_labor
    PARTITION OF public.pdf_pages FOR VALUES IN ('labor_agent');
CREATE TABLE public.pdf_pages_justice
    PARTITION OF public.pdf_pages FOR VALUES IN ('justice_agent');
CREATE TABLE public.pdf_pages_digital_economy
    PARTITION OF public.pdf_pages FOR VALUES IN ('digital_economy_agent');
CREATE TABLE public.pdf_pages_general
    PARTITION OF public.pdf_pages DEFAULT;

-- ---------------------------------------------------------------------------
-- 6e. versions  (PK now includes ministry_name; preserves IDENTITY)
-- ---------------------------------------------------------------------------
CREATE TABLE public.versions (
    id             BIGINT      GENERATED BY DEFAULT AS IDENTITY,
    source_id      TEXT        NOT NULL,
    ministry_name  TEXT        NOT NULL DEFAULT 'general',
    version        INTEGER     NOT NULL,
    chunks_created INTEGER     NOT NULL,
    is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, ministry_name),
    UNIQUE (source_id, version, ministry_name)
) PARTITION BY LIST (ministry_name);

CREATE TABLE public.versions_civil_status
    PARTITION OF public.versions FOR VALUES IN ('civil_status_agent');
CREATE TABLE public.versions_civil_service
    PARTITION OF public.versions FOR VALUES IN ('civil_service_agent');
CREATE TABLE public.versions_labor
    PARTITION OF public.versions FOR VALUES IN ('labor_agent');
CREATE TABLE public.versions_justice
    PARTITION OF public.versions FOR VALUES IN ('justice_agent');
CREATE TABLE public.versions_digital_economy
    PARTITION OF public.versions FOR VALUES IN ('digital_economy_agent');
CREATE TABLE public.versions_general
    PARTITION OF public.versions DEFAULT;

-- ---------------------------------------------------------------------------
-- 6f. file_hashes  (PK now includes ministry_name)
-- ---------------------------------------------------------------------------
CREATE TABLE public.file_hashes (
    hash          TEXT        NOT NULL,
    source_id     TEXT        NOT NULL,
    ministry_name TEXT        NOT NULL DEFAULT 'general',
    version       INTEGER     NOT NULL,
    filename      TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (hash, ministry_name)
) PARTITION BY LIST (ministry_name);

CREATE TABLE public.file_hashes_civil_status
    PARTITION OF public.file_hashes FOR VALUES IN ('civil_status_agent');
CREATE TABLE public.file_hashes_civil_service
    PARTITION OF public.file_hashes FOR VALUES IN ('civil_service_agent');
CREATE TABLE public.file_hashes_labor
    PARTITION OF public.file_hashes FOR VALUES IN ('labor_agent');
CREATE TABLE public.file_hashes_justice
    PARTITION OF public.file_hashes FOR VALUES IN ('justice_agent');
CREATE TABLE public.file_hashes_digital_economy
    PARTITION OF public.file_hashes FOR VALUES IN ('digital_economy_agent');
CREATE TABLE public.file_hashes_general
    PARTITION OF public.file_hashes DEFAULT;

-- ---------------------------------------------------------------------------
-- 6g. chunk_embeddings  (PK now includes ministry_name; uses pgvector)
-- ---------------------------------------------------------------------------
CREATE TABLE public.chunk_embeddings (
    chunk_id      TEXT           NOT NULL,
    source_id     TEXT           NOT NULL,
    ministry_name TEXT           NOT NULL DEFAULT 'general',
    version       INTEGER        NOT NULL,
    page          INTEGER        NOT NULL,
    chunk_type    TEXT           NOT NULL,
    modality      TEXT           NOT NULL,
    page_key      TEXT,
    metadata      JSONB          NOT NULL DEFAULT '{}'::jsonb,
    embedding     vector(768)    NOT NULL,
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT now(),
    PRIMARY KEY (chunk_id, ministry_name)
) PARTITION BY LIST (ministry_name);

CREATE TABLE public.chunk_embeddings_civil_status
    PARTITION OF public.chunk_embeddings FOR VALUES IN ('civil_status_agent');
CREATE TABLE public.chunk_embeddings_civil_service
    PARTITION OF public.chunk_embeddings FOR VALUES IN ('civil_service_agent');
CREATE TABLE public.chunk_embeddings_labor
    PARTITION OF public.chunk_embeddings FOR VALUES IN ('labor_agent');
CREATE TABLE public.chunk_embeddings_justice
    PARTITION OF public.chunk_embeddings FOR VALUES IN ('justice_agent');
CREATE TABLE public.chunk_embeddings_digital_economy
    PARTITION OF public.chunk_embeddings FOR VALUES IN ('digital_economy_agent');
CREATE TABLE public.chunk_embeddings_general
    PARTITION OF public.chunk_embeddings DEFAULT;

-- =============================================================================
-- PHASE 7: Bulk-copy data from old tables into partitioned tables
--           Order: parent tables first so FK targets exist
-- =============================================================================

-- ---- source_groups ----
INSERT INTO public.source_groups
       (group_id, group_name, normalized_name, doc_type, ministry_name,
        constitution_date, created_at, updated_at)
SELECT  group_id, group_name, normalized_name, doc_type, ministry_name,
        constitution_date, created_at, updated_at
  FROM  public.source_groups_old;

-- ---- sources ----
INSERT INTO public.sources
       (source_id, source_name, filename, file_type, doc_type, tags, language,
        visibility, approval_status, date_of_the_constitution, ministry_name,
        ministry_type, source_group_id, group_role, metadata, current_version,
        created_at, updated_at)
SELECT  source_id, source_name, filename, file_type, doc_type, tags, language,
        visibility, approval_status, date_of_the_constitution, ministry_name,
        ministry_type, source_group_id, group_role, metadata, current_version,
        created_at, updated_at
  FROM  public.sources_old;

-- ---- chunks ----
INSERT INTO public.chunks
       (chunk_id, source_id, ministry_name, version, page, chunk_type,
        metadata, created_at)
SELECT  chunk_id, source_id, ministry_name, version, page, chunk_type,
        metadata, created_at
  FROM  public.chunks_old;

-- ---- pdf_pages ----
INSERT INTO public.pdf_pages
       (source_id, version, page, ministry_name, page_key, text_chunk_id,
        image_mime_type, image_data, width, height, metadata, created_at)
SELECT  source_id, version, page, ministry_name, page_key, text_chunk_id,
        image_mime_type, image_data, width, height, metadata, created_at
  FROM  public.pdf_pages_old;

-- ---- versions (explicit id to preserve identity values) ----
INSERT INTO public.versions
       (id, source_id, ministry_name, version, chunks_created, is_active,
        created_at)
SELECT  id, source_id, ministry_name, version, chunks_created, is_active,
        created_at
  FROM  public.versions_old;

-- Reset the identity sequence so future inserts get correct next value
DO $$
DECLARE
    _seqname TEXT;
    _maxid   BIGINT;
BEGIN
    SELECT pg_get_serial_sequence('public.versions', 'id') INTO _seqname;
    SELECT COALESCE(MAX(id), 0) INTO _maxid FROM public.versions;
    IF _seqname IS NOT NULL AND _maxid > 0 THEN
        PERFORM setval(_seqname, _maxid);
    END IF;
END $$;

-- ---- file_hashes ----
INSERT INTO public.file_hashes
       (hash, source_id, ministry_name, version, filename, created_at)
SELECT  hash, source_id, ministry_name, version, filename, created_at
  FROM  public.file_hashes_old;

-- ---- chunk_embeddings ----
INSERT INTO public.chunk_embeddings
       (chunk_id, source_id, ministry_name, version, page, chunk_type,
        modality, page_key, metadata, embedding, created_at)
SELECT  chunk_id, source_id, ministry_name, version, page, chunk_type,
        modality, page_key, metadata, embedding, created_at
  FROM  public.chunk_embeddings_old;

-- =============================================================================
-- PHASE 8: Re-create indexes
-- =============================================================================

-- Drop old indexes first (old tables still exist as *_old, and Postgres does NOT
-- rename indexes when you rename a table, so the old index names collide).
DROP INDEX IF EXISTS public.idx_source_groups_name;
DROP INDEX IF EXISTS public.idx_source_groups_ministry;
DROP INDEX IF EXISTS public.idx_sources_visibility;
DROP INDEX IF EXISTS public.idx_sources_approval;
DROP INDEX IF EXISTS public.idx_sources_ministry_name;
DROP INDEX IF EXISTS public.idx_sources_ministry_type;
DROP INDEX IF EXISTS public.idx_sources_group;
DROP INDEX IF EXISTS public.idx_chunks_source;
DROP INDEX IF EXISTS public.idx_chunks_version;
DROP INDEX IF EXISTS public.idx_chunks_type;
DROP INDEX IF EXISTS public.idx_chunks_source_page;
DROP INDEX IF EXISTS public.idx_chunks_ministry;
DROP INDEX IF EXISTS public.idx_pdf_pages_source;
DROP INDEX IF EXISTS public.idx_pdf_pages_text_chunk;
DROP INDEX IF EXISTS public.idx_pdf_pages_ministry;
DROP INDEX IF EXISTS public.idx_versions_source;
DROP INDEX IF EXISTS public.idx_versions_ministry;
DROP INDEX IF EXISTS public.idx_file_hashes_source;
DROP INDEX IF EXISTS public.idx_file_hashes_ministry;
DROP INDEX IF EXISTS public.idx_chunk_embeddings_source;
DROP INDEX IF EXISTS public.idx_chunk_embeddings_page;
DROP INDEX IF EXISTS public.idx_chunk_embeddings_type;
DROP INDEX IF EXISTS public.idx_chunk_embeddings_page_key;
DROP INDEX IF EXISTS public.idx_chunk_embeddings_ministry;
DROP INDEX IF EXISTS public.idx_ce_hnsw_civil_status;
DROP INDEX IF EXISTS public.idx_ce_hnsw_civil_service;
DROP INDEX IF EXISTS public.idx_ce_hnsw_labor;
DROP INDEX IF EXISTS public.idx_ce_hnsw_justice;
DROP INDEX IF EXISTS public.idx_ce_hnsw_digital_economy;
DROP INDEX IF EXISTS public.idx_ce_hnsw_general;

-- ---- source_groups ----
CREATE INDEX idx_source_groups_name
    ON public.source_groups (normalized_name);
CREATE INDEX idx_source_groups_ministry
    ON public.source_groups (ministry_name);

-- ---- sources ----
CREATE INDEX idx_sources_visibility
    ON public.sources (visibility);
CREATE INDEX idx_sources_approval
    ON public.sources (approval_status);
CREATE INDEX idx_sources_ministry_name
    ON public.sources (ministry_name);
CREATE INDEX idx_sources_ministry_type
    ON public.sources (ministry_type);
CREATE INDEX idx_sources_group
    ON public.sources (source_group_id);

-- ---- chunks ----
CREATE INDEX idx_chunks_source
    ON public.chunks (source_id);
CREATE INDEX idx_chunks_version
    ON public.chunks (source_id, version);
CREATE INDEX idx_chunks_type
    ON public.chunks (chunk_type);
CREATE INDEX idx_chunks_source_page
    ON public.chunks (source_id, page);
CREATE INDEX idx_chunks_ministry
    ON public.chunks (ministry_name);

-- ---- pdf_pages ----
CREATE INDEX idx_pdf_pages_source
    ON public.pdf_pages (source_id, version);
CREATE INDEX idx_pdf_pages_text_chunk
    ON public.pdf_pages (text_chunk_id);
CREATE INDEX idx_pdf_pages_ministry
    ON public.pdf_pages (ministry_name);

-- ---- versions ----
CREATE INDEX idx_versions_source
    ON public.versions (source_id);
CREATE INDEX idx_versions_ministry
    ON public.versions (ministry_name);

-- ---- file_hashes ----
CREATE INDEX idx_file_hashes_source
    ON public.file_hashes (source_id);
CREATE INDEX idx_file_hashes_ministry
    ON public.file_hashes (ministry_name);

-- ---- chunk_embeddings: scalar indexes on parent (propagate to partitions) ----
CREATE INDEX idx_chunk_embeddings_source
    ON public.chunk_embeddings (source_id, version);
CREATE INDEX idx_chunk_embeddings_page
    ON public.chunk_embeddings (source_id, page);
CREATE INDEX idx_chunk_embeddings_type
    ON public.chunk_embeddings (chunk_type, modality);
CREATE INDEX idx_chunk_embeddings_page_key
    ON public.chunk_embeddings (page_key)
    WHERE page_key IS NOT NULL;
CREATE INDEX idx_chunk_embeddings_ministry
    ON public.chunk_embeddings (ministry_name);

-- ---- chunk_embeddings: per-partition HNSW vector indexes ----
CREATE INDEX idx_ce_hnsw_civil_status
    ON public.chunk_embeddings_civil_status
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_ce_hnsw_civil_service
    ON public.chunk_embeddings_civil_service
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_ce_hnsw_labor
    ON public.chunk_embeddings_labor
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_ce_hnsw_justice
    ON public.chunk_embeddings_justice
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_ce_hnsw_digital_economy
    ON public.chunk_embeddings_digital_economy
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_ce_hnsw_general
    ON public.chunk_embeddings_general
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- =============================================================================
-- PHASE 9: Re-create composite foreign-key constraints
-- =============================================================================
-- sources → source_groups  (composite: group_id + ministry_name)
-- NOTE: This FK is omitted because source_group_id may reference a group in a
-- different ministry partition.  Referential integrity for source groups is
-- enforced at the application layer instead.
-- ALTER TABLE public.sources
--     ADD CONSTRAINT fk_sources_source_group
--     FOREIGN KEY (source_group_id, ministry_name)
--     REFERENCES public.source_groups (group_id, ministry_name)
--     ON DELETE SET NULL;

-- chunks → sources  (composite: source_id + ministry_name)
ALTER TABLE public.chunks
    ADD CONSTRAINT fk_chunks_source
    FOREIGN KEY (source_id, ministry_name)
    REFERENCES public.sources (source_id, ministry_name)
    ON DELETE CASCADE;

-- pdf_pages → sources  (composite: source_id + ministry_name)
ALTER TABLE public.pdf_pages
    ADD CONSTRAINT fk_pdf_pages_source
    FOREIGN KEY (source_id, ministry_name)
    REFERENCES public.sources (source_id, ministry_name)
    ON DELETE CASCADE;

-- pdf_pages → chunks  (composite: text_chunk_id + ministry_name)
ALTER TABLE public.pdf_pages
    ADD CONSTRAINT fk_pdf_pages_text_chunk
    FOREIGN KEY (text_chunk_id, ministry_name)
    REFERENCES public.chunks (chunk_id, ministry_name)
    ON DELETE SET NULL;

-- versions → sources  (composite: source_id + ministry_name)
ALTER TABLE public.versions
    ADD CONSTRAINT fk_versions_source
    FOREIGN KEY (source_id, ministry_name)
    REFERENCES public.sources (source_id, ministry_name)
    ON DELETE CASCADE;

-- file_hashes → sources  (composite: source_id + ministry_name)
ALTER TABLE public.file_hashes
    ADD CONSTRAINT fk_file_hashes_source
    FOREIGN KEY (source_id, ministry_name)
    REFERENCES public.sources (source_id, ministry_name)
    ON DELETE CASCADE;

-- chunk_embeddings → chunks  (composite: chunk_id + ministry_name)
ALTER TABLE public.chunk_embeddings
    ADD CONSTRAINT fk_chunk_embeddings_chunk
    FOREIGN KEY (chunk_id, ministry_name)
    REFERENCES public.chunks (chunk_id, ministry_name)
    ON DELETE CASCADE;

-- chunk_embeddings → sources  (composite: source_id + ministry_name)
ALTER TABLE public.chunk_embeddings
    ADD CONSTRAINT fk_chunk_embeddings_source
    FOREIGN KEY (source_id, ministry_name)
    REFERENCES public.sources (source_id, ministry_name)
    ON DELETE CASCADE;

-- =============================================================================
-- PHASE 10: Drop old (renamed) tables  —  leaf tables first to avoid deps
-- =============================================================================
DROP TABLE IF EXISTS public.chunk_embeddings_old CASCADE;
DROP TABLE IF EXISTS public.pdf_pages_old        CASCADE;
DROP TABLE IF EXISTS public.file_hashes_old      CASCADE;
DROP TABLE IF EXISTS public.versions_old         CASCADE;
DROP TABLE IF EXISTS public.chunks_old           CASCADE;
DROP TABLE IF EXISTS public.sources_old          CASCADE;
DROP TABLE IF EXISTS public.source_groups_old    CASCADE;

-- =============================================================================
-- PHASE 11: Row-count verification
-- =============================================================================
-- Compare pre-migration counts against the new partitioned tables.
-- Any mismatch indicates data loss; inspect before committing in production.

DROP TABLE IF EXISTS _migration_counts_after;
CREATE TEMP TABLE _migration_counts_after AS
    SELECT 'source_groups'    AS tbl, COUNT(*) AS cnt FROM public.source_groups
    UNION ALL
    SELECT 'sources',           COUNT(*) FROM public.sources
    UNION ALL
    SELECT 'chunks',            COUNT(*) FROM public.chunks
    UNION ALL
    SELECT 'pdf_pages',         COUNT(*) FROM public.pdf_pages
    UNION ALL
    SELECT 'versions',          COUNT(*) FROM public.versions
    UNION ALL
    SELECT 'file_hashes',       COUNT(*) FROM public.file_hashes
    UNION ALL
    SELECT 'chunk_embeddings',  COUNT(*) FROM public.chunk_embeddings;

-- Show comparison (run manually or check in migration log)
SELECT
    b.tbl                       AS table_name,
    b.cnt                       AS before_count,
    a.cnt                       AS after_count,
    CASE WHEN b.cnt = a.cnt
         THEN 'OK'
         ELSE 'MISMATCH'
    END                         AS status
  FROM _migration_counts_before b
  JOIN _migration_counts_after  a USING (tbl)
 ORDER BY b.tbl;

-- Show per-partition row distribution for visibility
SELECT 'source_groups'   AS tbl, ministry_name, COUNT(*) FROM public.source_groups   GROUP BY ministry_name
UNION ALL
SELECT 'sources',          ministry_name, COUNT(*) FROM public.sources          GROUP BY ministry_name
UNION ALL
SELECT 'chunks',           ministry_name, COUNT(*) FROM public.chunks           GROUP BY ministry_name
UNION ALL
SELECT 'pdf_pages',        ministry_name, COUNT(*) FROM public.pdf_pages        GROUP BY ministry_name
UNION ALL
SELECT 'versions',         ministry_name, COUNT(*) FROM public.versions         GROUP BY ministry_name
UNION ALL
SELECT 'file_hashes',      ministry_name, COUNT(*) FROM public.file_hashes      GROUP BY ministry_name
UNION ALL
SELECT 'chunk_embeddings', ministry_name, COUNT(*) FROM public.chunk_embeddings GROUP BY ministry_name
ORDER BY 1, 2;

-- Clean up temp tables
DROP TABLE IF EXISTS _migration_counts_before;
DROP TABLE IF EXISTS _migration_counts_after;

COMMIT;

-- =============================================================================
-- Post-migration: ANALYZE all new tables so the query planner has fresh stats
-- (must run outside the transaction)
-- =============================================================================
ANALYZE public.source_groups;
ANALYZE public.sources;
ANALYZE public.chunks;
ANALYZE public.pdf_pages;
ANALYZE public.versions;
ANALYZE public.file_hashes;
ANALYZE public.chunk_embeddings;
