-- Supabase bootstrap schema for JNPI services
-- Uses Postgres LIST partitioning by ministry_name for knowledge tables.
-- Each ministry gets its own physical partition → per-partition HNSW indexes.
-- Date: 2026-04-07

begin;

-- Keep all tables in public for simplest migration path.
-- You can later split into schemas (knowledge, workflow, governance, agent) if desired.

-- -----------------------------------------------------------------------------
-- knowledge-service  (PARTITIONED BY ministry_name)
-- -----------------------------------------------------------------------------

-- Helper: list of known ministry partition values.
-- Adding a new ministry = add a new partition line below + add to the registry.
-- The DEFAULT partition catches 'general' and any unlisted values.

create table if not exists public.source_groups (
    group_id text not null,
    group_name text not null,
    normalized_name text not null,
    doc_type text not null default 'regulation',
    ministry_name text not null default 'general',
    constitution_date text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (group_id, ministry_name)
) partition by list (ministry_name);

create table if not exists source_groups_civil_status
    partition of public.source_groups for values in ('civil_status_agent');
create table if not exists source_groups_civil_service
    partition of public.source_groups for values in ('civil_service_agent');
create table if not exists source_groups_labor
    partition of public.source_groups for values in ('labor_agent');
create table if not exists source_groups_justice
    partition of public.source_groups for values in ('justice_agent');
create table if not exists source_groups_digital_economy
    partition of public.source_groups for values in ('digital_economy_agent');
create table if not exists source_groups_general
    partition of public.source_groups default;

create unique index if not exists idx_source_groups_normalized
    on public.source_groups (normalized_name);


create table if not exists public.sources (
    source_id text not null,
    source_name text not null,
    filename text not null,
    file_type text not null,
    doc_type text not null default 'general',
    tags jsonb not null default '[]'::jsonb,
    language text not null default 'auto',
    visibility text not null default 'public',
    approval_status text not null default 'approved',
    date_of_the_constitution text,
    ministry_name text not null default 'general',
    ministry_type text not null default 'general',
    source_group_id text,
    group_role text not null default 'primary',
    metadata jsonb not null default '{}'::jsonb,
    current_version integer not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (source_id, ministry_name)
) partition by list (ministry_name);

create table if not exists sources_civil_status
    partition of public.sources for values in ('civil_status_agent');
create table if not exists sources_civil_service
    partition of public.sources for values in ('civil_service_agent');
create table if not exists sources_labor
    partition of public.sources for values in ('labor_agent');
create table if not exists sources_justice
    partition of public.sources for values in ('justice_agent');
create table if not exists sources_digital_economy
    partition of public.sources for values in ('digital_economy_agent');
create table if not exists sources_general
    partition of public.sources default;


create table if not exists public.chunks (
    chunk_id text not null,
    source_id text not null,
    ministry_name text not null default 'general',
    version integer not null,
    page integer not null,
    chunk_type text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    primary key (chunk_id, ministry_name)
) partition by list (ministry_name);

create table if not exists chunks_civil_status
    partition of public.chunks for values in ('civil_status_agent');
create table if not exists chunks_civil_service
    partition of public.chunks for values in ('civil_service_agent');
create table if not exists chunks_labor
    partition of public.chunks for values in ('labor_agent');
create table if not exists chunks_justice
    partition of public.chunks for values in ('justice_agent');
create table if not exists chunks_digital_economy
    partition of public.chunks for values in ('digital_economy_agent');
create table if not exists chunks_general
    partition of public.chunks default;


create table if not exists public.pdf_pages (
    source_id text not null,
    ministry_name text not null default 'general',
    version integer not null,
    page integer not null,
    page_key text,
    text_chunk_id text,
    image_mime_type text not null default 'image/png',
    image_data bytea not null,
    width integer,
    height integer,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    primary key (source_id, ministry_name, version, page)
) partition by list (ministry_name);

create table if not exists pdf_pages_civil_status
    partition of public.pdf_pages for values in ('civil_status_agent');
create table if not exists pdf_pages_civil_service
    partition of public.pdf_pages for values in ('civil_service_agent');
create table if not exists pdf_pages_labor
    partition of public.pdf_pages for values in ('labor_agent');
create table if not exists pdf_pages_justice
    partition of public.pdf_pages for values in ('justice_agent');
create table if not exists pdf_pages_digital_economy
    partition of public.pdf_pages for values in ('digital_economy_agent');
create table if not exists pdf_pages_general
    partition of public.pdf_pages default;


create table if not exists public.versions (
    id bigint generated by default as identity,
    source_id text not null,
    ministry_name text not null default 'general',
    version integer not null,
    chunks_created integer not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    primary key (id, ministry_name),
    unique (source_id, ministry_name, version)
) partition by list (ministry_name);

create table if not exists versions_civil_status
    partition of public.versions for values in ('civil_status_agent');
create table if not exists versions_civil_service
    partition of public.versions for values in ('civil_service_agent');
create table if not exists versions_labor
    partition of public.versions for values in ('labor_agent');
create table if not exists versions_justice
    partition of public.versions for values in ('justice_agent');
create table if not exists versions_digital_economy
    partition of public.versions for values in ('digital_economy_agent');
create table if not exists versions_general
    partition of public.versions default;


create table if not exists public.file_hashes (
    hash text not null,
    source_id text not null,
    ministry_name text not null default 'general',
    version integer not null,
    filename text not null,
    created_at timestamptz not null default now(),
    primary key (hash, ministry_name)
) partition by list (ministry_name);

create table if not exists file_hashes_civil_status
    partition of public.file_hashes for values in ('civil_status_agent');
create table if not exists file_hashes_civil_service
    partition of public.file_hashes for values in ('civil_service_agent');
create table if not exists file_hashes_labor
    partition of public.file_hashes for values in ('labor_agent');
create table if not exists file_hashes_justice
    partition of public.file_hashes for values in ('justice_agent');
create table if not exists file_hashes_digital_economy
    partition of public.file_hashes for values in ('digital_economy_agent');
create table if not exists file_hashes_general
    partition of public.file_hashes default;


-- Indexes on partitioned tables (inherited by each partition automatically)
create index if not exists idx_chunks_source on public.chunks(source_id);
create index if not exists idx_chunks_version on public.chunks(source_id, version);
create index if not exists idx_pdf_pages_source on public.pdf_pages(source_id, version);
create index if not exists idx_pdf_pages_text_chunk on public.pdf_pages(text_chunk_id);
create index if not exists idx_versions_source on public.versions(source_id);
create index if not exists idx_sources_visibility on public.sources(visibility);
create index if not exists idx_sources_approval on public.sources(approval_status);
create index if not exists idx_sources_ministry_name on public.sources(ministry_name);
create index if not exists idx_sources_ministry_type on public.sources(ministry_type);
create index if not exists idx_sources_group on public.sources(source_group_id);
create index if not exists idx_source_groups_ministry on public.source_groups(ministry_name);

-- -----------------------------------------------------------------------------
-- workflow-service (unchanged — not partitioned)
-- -----------------------------------------------------------------------------
create table if not exists public.cases (
    case_id text primary key,
    request_id text not null,
    session_id text,
    user_id text,
    query text not null,
    query_hash text not null,
    user_type text not null default 'citizen',
    sector_primary text not null default 'general',
    sector_labels jsonb not null default '[]'::jsonb,
    priority text not null default 'medium',
    status text not null default 'open',
    assigned_to text,
    escalation_reason text not null,
    confidence double precision,
    source_response_id text,
    resolution_answer text,
    resolution_note text,
    is_faq_candidate boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    resolved_at timestamptz
);

create table if not exists public.case_timeline (
    id bigint generated by default as identity primary key,
    case_id text not null references public.cases(case_id) on delete cascade,
    event_type text not null,
    actor text not null,
    note text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_cases_status on public.cases(status);
create index if not exists idx_cases_sector on public.cases(sector_primary);
create index if not exists idx_cases_assigned on public.cases(assigned_to);
create index if not exists idx_cases_user on public.cases(user_id);
create index if not exists idx_cases_created on public.cases(created_at);
create index if not exists idx_cases_request on public.cases(request_id);
create index if not exists idx_timeline_case on public.case_timeline(case_id);

-- -----------------------------------------------------------------------------
-- governance-service (unchanged)
-- -----------------------------------------------------------------------------
create table if not exists public.audit_log (
    id bigint generated by default as identity primary key,
    request_id text not null unique,
    session_id text,
    query text not null,
    user_type text not null default 'citizen',
    intent text,
    sector text,
    agent_used text,
    answer text,
    confidence double precision,
    has_amendments boolean not null default false,
    escalated boolean not null default false,
    escalation_reason text,
    input_passed boolean not null default true,
    input_category text,
    input_reason text,
    output_passed boolean not null default true,
    output_category text,
    output_reason text,
    total_latency_ms double precision,
    routing_latency_ms double precision,
    retrieval_latency_ms double precision,
    generation_latency_ms double precision,
    citations_count integer not null default 0,
    chunks_used integer not null default 0,
    created_at timestamptz not null default now()
);

create index if not exists idx_audit_session on public.audit_log(session_id);
create index if not exists idx_audit_created on public.audit_log(created_at);
create index if not exists idx_audit_user_type on public.audit_log(user_type);
create index if not exists idx_audit_sector on public.audit_log(sector);
create index if not exists idx_audit_escalated on public.audit_log(escalated);
create index if not exists idx_audit_input_passed on public.audit_log(input_passed);
create index if not exists idx_audit_output_passed on public.audit_log(output_passed);

-- -----------------------------------------------------------------------------
-- agent-service (unchanged)
-- -----------------------------------------------------------------------------
create table if not exists public.sessions (
    session_id text primary key,
    messages jsonb not null default '[]'::jsonb,
    user_type text not null default 'citizen',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_sessions_updated_at on public.sessions(updated_at);

-- -----------------------------------------------------------------------------
-- pgvector extension + partitioned chunk_embeddings
-- -----------------------------------------------------------------------------
create extension if not exists vector;

-- NOTE: Set vector dimension to match EMBEDDING_DIMENSIONS in runtime env.
-- Current service template uses 768; change to 3072 if you run full-size vectors.
create table if not exists public.chunk_embeddings (
    chunk_id text not null,
    source_id text not null,
    ministry_name text not null default 'general',
    version integer not null,
    page integer not null,
    chunk_type text not null,
    modality text not null,
    page_key text,
    metadata jsonb not null default '{}'::jsonb,
    embedding vector(768) not null,
    created_at timestamptz not null default now(),
    primary key (chunk_id, ministry_name)
) partition by list (ministry_name);

create table if not exists chunk_embeddings_civil_status
    partition of public.chunk_embeddings for values in ('civil_status_agent');
create table if not exists chunk_embeddings_civil_service
    partition of public.chunk_embeddings for values in ('civil_service_agent');
create table if not exists chunk_embeddings_labor
    partition of public.chunk_embeddings for values in ('labor_agent');
create table if not exists chunk_embeddings_justice
    partition of public.chunk_embeddings for values in ('justice_agent');
create table if not exists chunk_embeddings_digital_economy
    partition of public.chunk_embeddings for values in ('digital_economy_agent');
create table if not exists chunk_embeddings_general
    partition of public.chunk_embeddings default;

create index if not exists idx_chunk_embeddings_source
    on public.chunk_embeddings(source_id, version);

create index if not exists idx_chunk_embeddings_page
    on public.chunk_embeddings(source_id, page);

create index if not exists idx_chunk_embeddings_type
    on public.chunk_embeddings(chunk_type, modality);

create index if not exists idx_chunk_embeddings_page_key
    on public.chunk_embeddings(page_key)
    where page_key is not null;

create index if not exists idx_chunk_embeddings_ministry
    on public.chunk_embeddings(ministry_name);

-- HNSW Index — defined on parent, each partition gets its own copy.
-- Per-partition HNSW indexes are smaller and faster than a single global index.
create index if not exists idx_chunk_embeddings_hnsw
    on public.chunk_embeddings using hnsw (embedding vector_cosine_ops)
    with (m = 16, ef_construction = 64);

commit;
