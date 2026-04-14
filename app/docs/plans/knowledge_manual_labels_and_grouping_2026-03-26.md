# Knowledge Manual Labels And Grouping

Date: 2026-03-26
Scope: knowledge-service schema, ingestion flow, source management UI, Supabase SQL
Status: in progress

## Problem

The knowledge engine already auto-classifies uploaded documents, but the current model has three practical gaps:

1. Operators cannot manually correct core labels from the dashboard after ingest.
2. `date_of_the_constitution` and "Ministry" are partially present in the schema, but the ministry value was drifting between classifier output, owner metadata, and free-text edits.
3. Versioning works only for re-ingesting the exact same legal title under one `source_id`, while amendment laws remain detached from the law family they modify.

These gaps contribute directly to retrieval drift, sector mismatch, and weak confidence behavior for legal and constitutional material.

## Goal

Introduce a minimal but durable knowledge-model upgrade that:

1. lets curators add and edit manual labels for constitution/effective date and ministry/entity,
2. introduces source grouping so an original law and its amendments can belong to the same family,
3. preserves the existing `versions` table behavior for re-ingested source revisions,
4. standardizes ministry labels to the four active ministry agents,
5. updates Supabase bootstrap and migration SQL so the runtime and infra docs stay aligned.

## Implemented In This Pass

### 1. Manual labels

Added support for:

- `constitution_date` on ingest
- `ministry_name` on ingest
- editing those labels later through `PATCH /sources/{source_id}/labels`

The static knowledge dashboard on `localhost:9100` now exposes:

- optional manual label inputs during single-document ingest,
- an `Edit Labels` action in the sources table for post-ingest correction,
- dropdown-backed ministry editing for the controlled ministry list.

Controlled ministry values in this pass:

- `civil_status_agent`
- `civil_service_agent`
- `labor_agent`
- `justice_agent`

### 2. Source grouping

Added a new `source_groups` model plus source-level linkage:

- `source_groups.group_id`
- `source_groups.group_name`
- `source_groups.normalized_name`
- `sources.source_group_id`
- `sources.group_role`

Grouping behavior in this first pass:

- if the operator provides a group name, it is used,
- otherwise regulations default to a group derived from the effective law title,
- amendment laws default to the `amends_target` group when available,
- re-ingesting the same non-amending regulation still bumps the existing source version.

This means we now have two distinct concepts:

- `version`: revisions of the same stored source record
- `group`: legal family membership across original law, amendments, and related documents

## Files Changed

- `app/services/knowledge-service/core/ingestion.py`
- `app/services/knowledge-service/storage/database.py`
- `app/services/knowledge-service/api/ingest.py`
- `app/services/knowledge-service/api/sources.py`
- `app/services/knowledge-service/api/versions.py`
- `app/services/knowledge-service/models/schemas.py`
- `app/services/knowledge-service/static/index.html`
- `app/services/agent-service/core/agents/__init__.py`
- `app/services/agent-service/core/agents/orchestrator.py`
- `app/services/agent-service/core/delegation.py`
- `app/services/agent-service/core/router.py`
- `app/services/agent-service/prompts/router_prompt.py`
- `app/services/agent-service/static/index.html`
- `app/docs/plans/supabase_bootstrap.sql`
- `app/docs/plans/update_sources_migration.sql`

## Notes On Design

### Why not replace the current versions model?

Because the existing `versions` table already solves one useful case: multiple ingests of the same law title under one source identity. Replacing it now would create unnecessary migration risk.

Instead, this pass adds `source_groups` as the missing relation layer that connects:

- the base law,
- later versions of that law,
- amendment laws,
- related legal material.

### Why keep both `ministry_name` and `ministry_type`?

This pass intentionally makes both fields converge on the same controlled vocabulary:

- `civil_status_agent`
- `civil_service_agent`
- `labor_agent`
- `justice_agent`

`ministry_name` remains the operator-controlled label used for retrieval filtering.
`ministry_type` remains the classifier/output field, but it is now validated and normalized into the same vocabulary so routing and retrieval do not drift apart.

### Why move routing to ministry agents?

The old agent split (`legal_affairs`, `public_services`, `policy_analysis`, `general_knowledge`) did not match how the knowledge base is now being labeled. The runtime now routes into ministry-scoped agents so:

- each agent retrieves from its own ministry first,
- retrieval can widen to other ministries only when needed,
- ministry curation in the ingest UI directly affects runtime routing behavior.

## Remaining Work

1. Use `source_groups` and `constitution_date` to pick the latest applicable law version during retrieval.
2. Surface source group metadata and ministry labels in the main Next.js knowledge pages.
3. Decide whether batch ingest also needs ministry/group controls.
4. Backfill production data carefully and review duplicate group-name edge cases.
5. Revisit confidence scoring so ministry fallback retrieval is not punished as a hard sector mismatch.

## Risk Watch

1. Existing rows may have noisy or legacy ministry labels, so migration normalization should be reviewed on staging first.
2. Amendment classifiers may not always populate `amends_target`, so some amendments will still need manual grouping.
3. Ministry-based routing is now aligned with the new vocabulary, but confidence scoring still relies on sector metadata and needs a follow-up pass.
