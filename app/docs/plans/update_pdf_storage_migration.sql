-- Migration script for DB-backed PDF page storage and text-only PDF embeddings
-- Matches the latest knowledge-service runtime schema
-- Date: 2026-03-26

begin;

create table if not exists public.pdf_pages (
    source_id text not null references public.sources(source_id) on delete cascade,
    version integer not null,
    page integer not null,
    page_key text,
    text_chunk_id text references public.chunks(chunk_id) on delete set null,
    image_mime_type text not null default 'image/png',
    image_data bytea not null,
    width integer,
    height integer,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    primary key (source_id, version, page)
);

create index if not exists idx_pdf_pages_source on public.pdf_pages(source_id, version);
create index if not exists idx_pdf_pages_text_chunk on public.pdf_pages(text_chunk_id);

-- PDF page image vectors are no longer used. Keep the text chunks, but remove
-- image embeddings so retrieval becomes text-only for PDFs.
delete from public.chunk_embeddings
where chunk_type = 'pdf_page_image';

commit;

-- Follow-up required outside SQL:
-- Existing rendered page images that currently live on the application filesystem
-- are not backfilled by this migration. Re-ingest affected PDFs or run an
-- application-level backfill job to populate public.pdf_pages from stored files.
