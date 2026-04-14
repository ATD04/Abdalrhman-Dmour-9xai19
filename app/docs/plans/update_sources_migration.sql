-- Migration script for manual source labels and source groups
-- Matches the latest knowledge-service schema and Supabase bootstrap
-- Date: 2026-03-26

begin;

create table if not exists public.source_groups (
    group_id text primary key,
    group_name text not null,
    normalized_name text not null unique,
    doc_type text not null default 'regulation',
    ministry_name text,
    constitution_date text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.sources add column if not exists doc_type text not null default 'general';
alter table public.sources add column if not exists tags jsonb not null default '[]'::jsonb;
alter table public.sources add column if not exists language text not null default 'auto';
alter table public.sources add column if not exists visibility text not null default 'public';
alter table public.sources add column if not exists approval_status text not null default 'approved';
alter table public.sources add column if not exists date_of_the_constitution text;
alter table public.sources add column if not exists ministry_name text;
alter table public.sources add column if not exists ministry_type text not null default 'general';
alter table public.sources add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.sources add column if not exists current_version integer not null default 1;
alter table public.sources add column if not exists source_group_id text;
alter table public.sources add column if not exists group_role text not null default 'primary';
alter table public.sources add column if not exists created_at timestamptz not null default now();
alter table public.sources add column if not exists updated_at timestamptz not null default now();

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'sources_source_group_id_fkey'
    ) then
        alter table public.sources
            add constraint sources_source_group_id_fkey
            foreign key (source_group_id)
            references public.source_groups(group_id)
            on delete set null;
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'sources_ministry_name_check'
    ) then
        alter table public.sources
            add constraint sources_ministry_name_check
            check (
                ministry_name is null
                or ministry_name in ('civil_status_agent', 'civil_service_agent', 'labor_agent', 'justice_agent')
            );
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'sources_ministry_type_check'
    ) then
        alter table public.sources
            add constraint sources_ministry_type_check
            check (
                ministry_type in ('civil_status_agent', 'civil_service_agent', 'labor_agent', 'justice_agent', 'general')
            );
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'source_groups_ministry_name_check'
    ) then
        alter table public.source_groups
            add constraint source_groups_ministry_name_check
            check (
                ministry_name is null
                or ministry_name in ('civil_status_agent', 'civil_service_agent', 'labor_agent', 'justice_agent')
            );
    end if;
end $$;

-- Normalize legacy ministry labels into the new controlled ministry-agent vocabulary.
update public.sources
set ministry_name = case
    when lower(trim(coalesce(ministry_name, ''))) in ('civil_status_agent', 'civil_service_agent', 'labor_agent', 'justice_agent')
        then lower(trim(ministry_name))
    when lower(trim(coalesce(ministry_type, ''))) in ('civil_status_agent', 'civil_service_agent', 'labor_agent', 'justice_agent')
        then lower(trim(ministry_type))
    else null
end;

update public.sources
set ministry_type = case
    when lower(trim(coalesce(ministry_type, ''))) in ('civil_status_agent', 'civil_service_agent', 'labor_agent', 'justice_agent', 'general')
        then lower(trim(ministry_type))
    when lower(trim(coalesce(ministry_name, ''))) in ('civil_status_agent', 'civil_service_agent', 'labor_agent', 'justice_agent')
        then lower(trim(ministry_name))
    else 'general'
end;

update public.source_groups
set ministry_name = case
    when lower(trim(coalesce(ministry_name, ''))) in ('civil_status_agent', 'civil_service_agent', 'labor_agent', 'justice_agent')
        then lower(trim(ministry_name))
    else null
end;

-- Seed source groups for existing regulation rows that do not belong to a group yet.
insert into public.source_groups (
    group_id,
    group_name,
    normalized_name,
    doc_type,
    ministry_name,
    constitution_date,
    created_at,
    updated_at
)
select
    substr(md5(lower(trim(source_name))), 1, 12) as group_id,
    source_name as group_name,
    lower(trim(source_name)) as normalized_name,
    coalesce(doc_type, 'regulation') as doc_type,
    ministry_name,
    date_of_the_constitution,
    coalesce(created_at, now()),
    coalesce(updated_at, now())
from public.sources
where coalesce(doc_type, 'general') = 'regulation'
on conflict (normalized_name) do update
set ministry_name = coalesce(public.source_groups.ministry_name, excluded.ministry_name),
    constitution_date = coalesce(public.source_groups.constitution_date, excluded.constitution_date),
    updated_at = now();

update public.sources s
set source_group_id = g.group_id
from public.source_groups g
where s.source_group_id is null
  and coalesce(s.doc_type, 'general') = 'regulation'
  and g.normalized_name = lower(trim(s.source_name));

create index if not exists idx_sources_visibility on public.sources(visibility);
create index if not exists idx_sources_approval on public.sources(approval_status);
create index if not exists idx_sources_ministry_name on public.sources(ministry_name);
create index if not exists idx_sources_ministry_type on public.sources(ministry_type);
create index if not exists idx_sources_group on public.sources(source_group_id);
create index if not exists idx_source_groups_name on public.source_groups(normalized_name);
create index if not exists idx_source_groups_ministry_name on public.source_groups(ministry_name);

commit;
