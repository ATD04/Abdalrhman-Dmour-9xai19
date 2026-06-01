# Person 4 — Data Foundation Report

**Owner:** Person 4 — External Data Research, Sourcing & Case Library
**Project:** Jordan Crisis Intelligence Platform (rebuild phase — see `rebuild.md` §15)
**Date:** 2026-06-01
**Status:** Foundation complete & verified; case-volume targets in progress (~60%)

> This is a research-grade, fully provenanced first pass — **not** verified ground truth. Every incident/case row is flagged `needs_human_review` and must be human-signed-off before it drives any recommendation.

---

## Table of contents
1. [Purpose & scope](#1-purpose--scope)
2. [Methodology — how the data was collected](#2-methodology--how-the-data-was-collected)
3. [Standards & conventions](#3-standards--conventions)
4. [Deliverables — the six data products](#4-deliverables--the-six-data-products)
5. [What the data is about](#5-what-the-data-is-about)
6. [How it feeds the platform](#6-how-it-feeds-the-platform)
7. [Data quality, limitations & honesty log](#7-data-quality-limitations--honesty-log)
8. [Status vs. done-criteria](#8-status-vs-done-criteria)
9. [Remaining tasks](#9-remaining-tasks)
10. [File inventory](#10-file-inventory)
11. [Coordination notes (Person 1 import)](#11-coordination-notes-person-1-import)

---

## 1. Purpose & scope

Person 4 builds the platform's **real-world evidence base** — the only non-coding lane. The job: find, vet, document, and structure **public** data and **real crisis cases** so the system reasons from reality (hybrid data with clear provenance), not synthetic signals alone.

**In scope:** public-source research, news/report research, case curation, source registry, licensing notes, reliability scoring, scenario & intervention pattern libraries, data-quality reporting.

**Out of scope (must avoid):** backend code (`app/`), frontend, DB migrations, LLM prompts; and any scraping of personal, private, or login-only data.

---

## 2. Methodology — how the data was collected

A single repeatable loop was applied to **every** row:

1. **Find** — live web search across official Jordanian, international-organization, academic, and reputable-news sources.
2. **Verify** — open the source and confirm it resolves. **Only URLs actually retrieved were recorded** — zero fabricated links.
3. **Score** — assign a trust level on the plan's 5-point rubric (§3 below).
4. **Structure** — write a CSV row carrying the three mandatory provenance fields (URL + reliability + license) plus a `human_review_status` flag.
5. **Separate symptom from cause** — every incident/case explicitly splits observed *symptoms* from *suspected root causes* (the project's core discipline).
6. **Sort raw vs. clean** — raw downloads → `data/external_raw/` (git-ignored); vetted, scored rows → `data/curated/` (shareable).

**Verification was real, not nominal.** Example: a teammate research note stated the 2021 Texas blackout was "58% gas failures / 87% gas-related outages." The **official FERC/NERC final report** instead reports **75.6% of unplanned outages from freezing (44.2%) + fuel (31.4%)**. The curated row uses the **official FERC figures**, and the discrepancy is logged. This is the difference between collecting data and verifying it.

---

## 3. Standards & conventions

### Reliability rubric (rebuild plan §15.7)
| Score | Meaning |
|---|---|
| 1.0 | National statistics / open-data authority (official primary) |
| 0.8 | Line ministry/utility, recognized intl org, or peer-reviewed |
| 0.6 | Reputable news with clear detail |
| 0.4 | Single-source / tertiary (e.g. Wikipedia — leads only) |
| 0.2 | Unverified anecdote (none included) |

**Rule:** anything **below 0.6** must not drive a final recommendation without corroboration. Incident/case rows are built from **multiple** sources where possible.

### Settled scoring rule (2026-06-01)
- **1.0** only for the national statistics authority (DoS) and the national open-data hub (`opendata.gov.jo`).
- **0.8** for individual line ministries/utilities (MWI, MoH, JMD, NEPCO, PSD) and their reports, and for recognized international orgs / peer-reviewed sources.
- Applied consistently across the registry and incident rows.

### CSV / import conventions (aligned with the MVP `data/seeds/`)
- Pipe-delimited multi-value fields (`a|b|c`)
- `YYYY-MM-DD` dates
- Prefixed IDs (`SRC-`, `INC-JO-`, `CASE-INT-`, `PAT-SCN-`, `INTV-`)
- UTF-8; quoted fields where commas appear
- Extra trailing column `human_review_status` (`verified_url` | `needs_human_review`)

---

## 4. Deliverables — the six data products

| # | File | Rows | Target |
|---|---|---|---|
| DP1 | `data/curated/source_registry.csv` | **38** | ≥20 ✅ |
| DP2 | `data/curated/jordan_incident_library.csv` | **9** | ≥15 ⏳ |
| DP3 | `data/curated/international_case_library.csv` | **6** | ≥15 ⏳ |
| DP4 | `data/curated/scenario_pattern_library.csv` | **7** | — |
| DP5 | `data/curated/intervention_pattern_library.csv` | **8** | — |
| DP6 | `docs/data_sources.md` (Data Quality Report) | — | — |

### DP1 — Source Registry (38)
Columns: `source_id, source_name, source_type, country, domain, url, access_method, license_note, reliability_score, update_frequency, owner_contact_if_public, notes, human_review_status`

Trust distribution: **4 × 1.0**, **25 × 0.8**, **8 × 0.6**, **1 × 0.4**.

Key sources by tier:
- **1.0:** Dept. of Statistics (portal, data portal, health), Open Government Data portal (`opendata.gov.jo`).
- **0.8 — Jordanian:** Ministry of Water & Irrigation (+ National Water Strategy 2023–2040), Ministry of Health, Jordan Meteorological Dept, NEPCO (grid), Public Security Directorate / Civil Defense.
- **0.8 — international/academic:** ReliefWeb, HDX, EM-DAT, World Bank (Open Data + Climate Portal + Data360), UNICEF, WHO EMRO, UNDRR, RCRC Climate Centre, ThinkHazard!, WMO, FERC, geoBoundaries, FAOLEX, GHDx, MDPI Water, ACS Environmental Science & Technology.
- **0.6 — news:** Jordan Times, Al Jazeera, Arab News, CNN, Gulf News, Middle East Eye, Texas Tribune, NPR.
- **0.4:** Wikipedia (leads only).

### DP2 — Jordan Incident Library (9)
Columns: `incident_id, date, governorate, location, crisis_type, summary, symptoms, known_or_suspected_root_causes, agencies_involved, interventions, outcome, source_url, reliability_score, notes, human_review_status`

| ID | Event | Type |
|---|---|---|
| INC-JO-001 | 2018 Dead Sea school-trip flash flood (~21 dead) | flash_flood |
| INC-JO-002 | 2021 Al-Salt hospital oxygen failure (7–10 dead) | hospital_infrastructure_failure |
| INC-JO-003 | 2023 multi-governorate floods/hail | flash_flood |
| INC-JO-004 | 2025 nationwide flash floods | flash_flood |
| INC-JO-005 | Chronic national water scarcity (~61 m³/capita, ~25% leaks) | water_scarcity |
| INC-JO-006 | Recurring summer heatwaves (+4–5 °C, ~41 °C+) | heatwave |
| INC-JO-007 | Petra/Wadi Musa floods Nov 2018 (12 dead, ~3,762 evacuated) | flash_flood |
| INC-JO-008 | Petra floods Dec 2022 (~1,700 evacuated) | flash_flood |
| INC-JO-009 | Aqaba port chlorine leak 2022 (13 dead, 265+ injured) | industrial_hazmat_accident |

### DP3 — International Case Library (6)
Columns: `case_id, country, location, date, crisis_type, root_causes, symptoms, cascades, agencies_involved, interventions, outcomes, lessons_learned, source_url, reliability_score, human_review_status`

| ID | Case | Why it matters |
|---|---|---|
| CASE-INT-001 | Cape Town "Day Zero" (2018) | drought + unmanaged demand; demand-side levers |
| CASE-INT-002 | Texas Winter Storm Uri (2021) | power→water→health cascade; power↔gas dependency loop (FERC) |
| CASE-INT-003 | France heatwave (2003) | hospital overload = symptom; heat = cause |
| CASE-INT-004 | Flint, Michigan (2014) | skipped corrosion-control decision, not the river |
| CASE-INT-005 | Chennai "Day Zero" (2019) | reservoir depletion; supply diversification |
| CASE-INT-006 | Broad Street cholera, London (1854) | the founding case: water crisis misread as airborne disease |

### DP4 — Scenario Pattern Library (7)
Columns: `pattern_id, crisis_type, trigger, affected_services, misleading_symptoms, likely_root_causes, cascade_paths, data_needed, example_cases`

`infrastructure_failure_cascade` · `heatwave_health_surge` · `drought_water_scarcity` · `flash_flood` · `water_contamination` · `industrial_hazmat_accident` · `waterborne_disease_outbreak`

### DP5 — Intervention Pattern Library (8)
Columns: `intervention_id, crisis_type, intervention_name, responsible_agency, required_resources, expected_effect, time_to_effect, side_effects, failure_modes, example_cases`

`deploy_water_tankers` · `activate_backup_supply` · `demand_restriction_campaign` · `heat_health_action_plan` · `early_warning_and_evacuation` · `traffic_control_near_distribution` · `restore_corrosion_control_and_safe_source` · `emergency_supply_diversification`

### DP6 — Data Quality Report
Lives in `docs/data_sources.md`: strong vs. weak sources, access limits, figure discrepancies, stale-data notes, and recommended synthetic gap-fill. A companion narrative lives in `docs/case_library.md`.

---

## 5. What the data is about

**Jordan's real risk profile** (from DP2): flash floods, chronic water scarcity, extreme heat, and infrastructure/industrial failures — frequently **interacting** (heat + scarcity + power demand at once).

**The world shows the same cascades** (from DP3): a single upstream failure propagating across power → water → health, with the loudest downstream symptom masking the real cause.

### The one story all of it tells
**The loudest symptom is almost never the root cause.**

| Case | Looked like | Actually was |
|---|---|---|
| Broad Street 1854 | airborne disease | contaminated water pump |
| Texas 2021 | frozen wind turbines | gas-supply freeze + power↔gas loop |
| Flint 2014 | bad river water | skipped corrosion-control treatment |
| Cape Town 2018 | just a drought | drought + unmanaged demand |
| France 2003 | hospital overload | extreme heat + weak response |
| Al-Salt 2021 (JO) | hospital deaths | oxygen-supply failure |

### The investigative moves that cracked every case
Map cases spatially · use a control group · order events in time (what changed first) · follow the dependency chain upstream · demand evidence and distrust the loud symptom. These map almost one-to-one onto the platform's Root-Cause scoring dimensions (`spatial_overlap`, `temporal_precedence`, `dependency_path_strength`, `data_quality`/`source_trust`). **The data doesn't just feed the system — it validates the system's design.**

---

## 6. How it feeds the platform

- **Root-Cause v2** — the cases + scenario patterns provide *precedent similarity* and the symptom≠cause prior, replacing any hardcoded golden answer.
- **What-If / Intervention v2** — DP5 supplies real expected-effects, time-to-effect, side effects, and **failure modes** (e.g. "backup not monitored" — the Al-Salt lesson).
- **Synthetic generators** — seed parameters from real figures (heatwave +4–5 °C, water ~61 m³/capita, oxygen-backup failure mode) so synthetic data stays realistic.
- **Map (Person 3)** — geoBoundaries provides governorate boundaries; DoS provides population weighting.

---

## 7. Data quality, limitations & honesty log

**Known access limits:**
- HDX returned HTTP 403 to automated fetch → manual browser download required.
- EM-DAT requires a free account → manual export.
- Some MoH document links are unreliable (access-denied).
- Several official Jordanian docs are PDF and/or Arabic-only → human extraction needed.

**Figure discrepancies flagged for reconciliation (`needs_human_review`):**
- 2018 Dead Sea flood toll: 18–22 across sources/time.
- Al-Salt deaths: 7 (initial) vs 10 (court ruling).
- Aqaba: 12–13 dead, 251–265+ injured.
- Jordan per-capita water: 61 m³ (MWI) vs ~97 m³ (others) — different definitions/years.
- Texas Uri: corrected to official FERC figures (see §2).

**Missing data → recommended synthetic gap-fill:** operational sensor streams, asset-level water-network topology, sub-daily hospital occupancy, tick-level event timing. None are public; they stay synthetic, seeded with the real parameters above.

---

## 8. Status vs. done-criteria

| Done-criterion (§15.8) | Status |
|---|---|
| ≥20 sources registered | ✅ 38 |
| ≥15 Jordan incidents | ⏳ 9 |
| ≥15 international cases | ⏳ 6 |
| Every row has a source URL | ✅ |
| Every row has a reliability score | ✅ |
| Every row has a license/usage note | ✅ (per-source in registry; inherited via `source_url`) |
| Clean enough for Person 1 to import | ✅ (machine-validated, 0 rows missing provenance) |

**Honest framing:** the foundation and methodology are complete and verified; case volume is ~60% of target with a clear, listed path to finish.

---

## 9. Remaining tasks

1. **Jordan incidents 9 → 15:** 2019/2021 urban floods (Zarqa/Amman), summer water-rationing episodes (MWI notices), a COVID-19 hospital-overload wave (MoH/WHO), winter storms closing Amman (Civil Defense).
2. **International cases 6 → 15:** 2021 Pacific NW heat dome, Walkerton (Canada) waterborne outbreak, São Paulo 2015 "Day Zero", a major power-blackout cascade (e.g. 2003 NE US/Canada), plus more analogues.
3. **Arabic-language primary figures** — pull figures directly from the Arabic DoS/MWI/MoH/NEPCO PDFs and attach to existing rows.
4. **Reconcile flagged figures** (§7) against the most authoritative source.
5. **Fetch access-limited data** (HDX, EM-DAT, dead MoH links) into `data/external_raw/`, then curate.
6. **Fetch the map boundary file** — download the geoBoundaries ADM1 GeoJSON for Person 3's map.
7. **Register remaining candidate sources** once verified: Ministry of Energy (MEMR), Greater Amman Municipality, ACLED, WHO-Jordan country page, GADM.
8. **Confirm schema with Person 1** (`source_url` vs `source_id` FK; date + delimiter conventions).

---

## 10. File inventory

```
data/curated/
  source_registry.csv              38 rows  (DP1)
  jordan_incident_library.csv       9 rows  (DP2)
  international_case_library.csv     6 rows  (DP3)
  scenario_pattern_library.csv      7 rows  (DP4)
  intervention_pattern_library.csv  8 rows  (DP5)
data/external_raw/                  raw dumps (git-ignored)
docs/
  data_sources.md                  Data Quality Report (DP6)
  case_library.md                  narrative + investigative-methods
  person4_data_report.md           this report
research/                          working notes
tools/data_acquisition/            acquisition helpers
```

All five CSVs are machine-validated: correct column counts, **0 rows missing URL or reliability**.

---

## 11. Coordination notes (Person 1 import)

- Files follow MVP CSV conventions so they import cleanly (P1-3).
- **Open question:** link incidents/cases to sources by **`source_url`** (current) or by a **`source_id`** foreign key into the registry? Registry IDs are ready if the FK is preferred — and it would also satisfy the per-row license requirement by inheritance.
- Provenance is enforceable: every external fact traces to a scored source (supports plan task P1-5).

---

