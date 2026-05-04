# Traffic Intelligence System — Team Roles & Structure

> **Project:** Wadi Saqra Intersection — AI Traffic Monitoring System
> **Team Size:** 20 Members
> **Date:** May 2026

---

## Overview

The system is divided into **7 specialized teams**, each owning a distinct layer of the architecture — from raw video detection to the live analytics dashboard.

---

## Team 1 — Computer Vision & Detection
> *The eyes of the system. Responsible for detecting and counting vehicles in real time.*

| # | Role | Responsibilities |
|---|------|-----------------|
| 1 | CV Engineer Lead | YOLO model tuning, ByteTrack tracker configuration, detection pipeline |
| 2 | CV Engineer | Line-crossing logic, direction classification (North / South / East / West) |
| 3 | Video Processing Engineer | Video pipeline, frame preprocessing, loop handling |
| 4 | Data Labeler / QA | Vehicle count validation, annotation accuracy, ground truth comparison |

**Key Files:** `src/detection/step3_line_count.py`, `yolo26s.pt`

---

## Team 2 — Backend & API
> *The brain of the system. Serves all data to the dashboard and external integrations.*

| # | Role | Responsibilities |
|---|------|-----------------|
| 5 | Backend Lead | FastAPI architecture, endpoint design, database schema |
| 6 | API Engineer | `/signal/advisor`, `/analytics/capacity`, `/analytics/cost`, `/analytics/heatmap`, `/analytics/comparison`, `/incidents` |
| 7 | Data Engineer | SQLite management, DB migrations, typical-data seeding |
| 8 | Integration Engineer | Google Maps Distance Matrix API, Anthropic Claude chatbot integration |

**Key Files:** `src/api/main.py`, `src/api/state.py`, `Data/traffic.db`

---

## Team 3 — Frontend & Dashboard
> *The face of the system. Everything the operator sees and interacts with.*

| # | Role | Responsibilities |
|---|------|-----------------|
| 9 | Frontend Lead | Dashboard layout, Chart.js charts (counts, forecast, heatmap, comparison) |
| 10 | UI Developer | Alert banner, incident form, signal advisor cards, bilingual Arabic/English labels |
| 11 | UX Designer | Wireframes, color system, SVG intersection map, mobile responsiveness |

**Key Files:** `dashboard/index.html`

---

## Team 4 — Forecasting & Analytics
> *The intelligence layer. Turns raw counts into actionable insights.*

| # | Role | Responsibilities |
|---|------|-----------------|
| 12 | ML Engineer | Hybrid smart forecast model (live data + historical + Google Maps) |
| 13 | Data Analyst | Heatmap analytics, capacity utilization (vs 1500 veh/hr), economic cost model (JOD/fils) |
| 14 | Research Engineer | Typical traffic pattern seeding, historical baselines, Sunday/Monday patterns |

**Key Files:** `src/forecasting/smart_forecast.py`, `src/acquisition/seed_typical_data.py`

---

## Team 5 — Infrastructure & DevOps
> *The foundation. Keeps the system running reliably.*

| # | Role | Responsibilities |
|---|------|-----------------|
| 15 | DevOps Engineer | Server startup scripts, port management, process supervision, environment variables |
| 16 | Systems Engineer | Dependency management, Python environment, deployment configuration |

**Key Files:** `src/detection/step3_line_count.py` (`__main__` block), `.env`

---

## Team 6 — QA & Testing
> *The gatekeepers. Nothing ships without their sign-off.*

| # | Role | Responsibilities |
|---|------|-----------------|
| 17 | QA Lead | End-to-end system testing, API endpoint testing, regression suites |
| 18 | QA Engineer | Dashboard UI testing, detection accuracy validation, smoke tests |

**Key Files:** `smoke_test.py`, `google_maps_diagnostic.py`, `docs/`

---

## Team 7 — Project Management & Documentation
> *The compass. Keeps everyone aligned and the project on track.*

| # | Role | Responsibilities |
|---|------|-----------------|
| 19 | Project Manager | Sprint planning, task tracking, cross-team coordination, checklist |
| 20 | Technical Writer | API documentation, system architecture docs, README, checklist maintenance |

**Key Files:** `Data/checklist.md`, `README.md`, `docs/`

---

## Summary

| Team | Members | Core Focus |
|------|---------|------------|
| Computer Vision & Detection | 4 | YOLO, ByteTrack, vehicle counting |
| Backend & API | 4 | FastAPI, SQLite, integrations |
| Frontend & Dashboard | 3 | Dashboard, charts, bilingual UI |
| Forecasting & Analytics | 3 | ML forecast, heatmaps, cost models |
| Infrastructure & DevOps | 2 | Deployment, environment |
| QA & Testing | 2 | Validation, smoke tests |
| Project Management & Docs | 2 | Coordination, documentation |
| **Total** | **20** | |

---

## System Architecture Map

```
Video Feed (YOLO)
      │
      ▼
Detection Engine ──► SQLite DB
      │                  │
      ▼                  ▼
 State Layer ◄──── API Layer (FastAPI)
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
         Dashboard   Chatbot    Analytics
         (Chart.js)  (Claude)   Endpoints
```
