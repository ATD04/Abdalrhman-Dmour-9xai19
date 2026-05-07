# Citizen Voice Intelligence Platform (CVIP)
## "بخدمتكم" — Problem Statement & System Requirements

**Document Version:** 2.0  
**Prepared By:** Digital Transformation Unit  
**Classification:** Private & Confidential  
**Date:** May 2026

---

# PART 1: PROBLEM STATEMENT

---

## 1.1 Background & Context

The Hashemite Kingdom of Jordan's Ministry of Health operates a citizen-facing complaints platform — "بخدمتكم" — that receives thousands of complaints annually across its network of hospitals, health centers, and administrative units. The platform successfully captures citizen grievances and demonstrates strong operational performance, with a 99.3% SLA compliance rate on response time and an average resolution of 2.96 days across 1,535 complaints in Q1 2026 alone.

However, beneath this operational efficiency lies a deeper structural failure: **the platform processes complaints in isolation**. Complaints arrive, are responded to, and are closed — yet the same problems recur the following month. There is no mechanism to group related complaints together, no intelligence layer to surface the root cause driving them, and no system to prescribe solutions that address those causes at their origin.

The result is a perpetual reactive loop: citizens keep complaining, staff keep responding, and nothing fundamentally changes.

---

## 1.2 Core Problem

> **The Ministry of Health lacks the infrastructure to automatically aggregate related citizen complaints, identify the root causes driving them, and prescribe targeted solutions — leaving decision-makers blind to the systemic failures that generate recurring complaints, and locking the organization in an endless cycle of symptom treatment rather than cause elimination.**

---

## 1.3 Problem Decomposition

The problem breaks down into four interconnected and sequentially dependent failures:

---

### Problem 1 — Complaints Are Collected But Never Connected

Complaints arrive through multiple channels — web portal, mobile application, call center — and are stored as isolated records. A citizen in Irbid complaining about medication stockouts and a citizen in Amman filing the same complaint are processed as two separate, unrelated cases. No mechanism exists to automatically recognize that these complaints share an identical root cause and belong to the same problem cluster.

The consequence is that the system sees 1,535 individual problems when in reality there may be only 15 underlying issues generating all of them.

---

### Problem 2 — Categories Exist But Root Causes Do Not

The platform categorizes complaints by surface topic — "procedures," "service quality," "employee behavior" — but categorization is not diagnosis. Knowing that 79% of complaints fall under "procedural issues" tells a manager nothing about *why* those procedural issues exist. Is it a policy gap? A staffing deficit? A digital infrastructure failure? An unclear regulation? A communication breakdown?

Without root cause identification, every intervention is a guess. Resources are spent treating the visible symptom — the complaint — while the underlying condition continues to generate new ones.

---

### Problem 3 — Decision-Makers Receive Data, Not Intelligence

Leadership currently receives periodic reports showing complaint volumes, resolution rates, and category distributions. These are data outputs, not decision inputs. A minister or director-general looking at a dashboard showing "295 open complaints" cannot determine what action to take, which problem to prioritize, or what investment will have the highest return.

What decision-makers need is not more data — it is a diagnosis: *"These 295 complaints trace back to 3 root causes. Here is what they are. Here is what to do about them."*

---

### Problem 4 — Solutions Are Reactive and Unstructured

When interventions do occur, they are initiated based on individual judgment, political pressure, or escalated cases — not based on systematic analysis of what is causing the most citizen harm. There is no structured process to generate, evaluate, prioritize, and track solutions against the root causes they are meant to address. Interventions are launched, but their impact is never measured against the complaint patterns that should have declined as a result.

---

## 1.4 Impact of the Problem

| Dimension | Current Impact |
|-----------|----------------|
| **Operational** | Staff time consumed responding to preventable, recurring complaints |
| **Financial** | Cost of reactive case management far exceeds cost of proactive root cause intervention |
| **Citizen Experience** | Frustration and trust erosion — only 5.1% of citizens engage after resolution |
| **Institutional** | Leadership making investment decisions without causal intelligence |
| **Strategic** | No measurable, evidence-based path from complaint management to service excellence |

---

## 1.5 Desired Outcome

A platform that operates as a **Citizen Voice Intelligence System** — one that:

1. **Collects** complaints from all channels into a unified, structured dataset
2. **Clusters** related complaints together automatically using AI
3. **Diagnoses** the root cause driving each complaint cluster and surfaces it to decision-makers in plain, actionable language
4. **Prescribes** targeted, prioritized solutions linked directly to each identified root cause
5. **Measures** the real-world impact of those solutions on complaint volumes over time

The end state is a shift from managing complaints to **preventing them** — from a system that reacts to citizens to one that anticipates and eliminates the conditions that drive them to complain.

---
---

# PART 2: SYSTEM REQUIREMENTS

---

## 2.1 System Overview

The **Citizen Voice Intelligence Platform (CVIP)** is a four-layer AI-powered system built around a linear intelligence pipeline:

```
COLLECT → CLUSTER → DIAGNOSE → PRESCRIBE
```

Each layer feeds the next. Raw complaint data flows in at the collection layer and exits at the prescription layer as structured, actionable intelligence delivered to decision-makers through an executive dashboard. The system serves two primary user classes: **citizens** who submit complaints, and **government officials and analysts** who consume the intelligence generated from them.

---

## 2.2 Stakeholders

| Stakeholder | Role | Interaction with System |
|-------------|------|------------------------|
| Citizens | Complaint submitters | Submit, track, and provide feedback on complaints |
| Front-line Staff | First responders | Receive assignments, process, and resolve complaints |
| Data Analysts | Intelligence operators | Review AI outputs, validate clusters, refine classifications |
| Ministry Management | Decision-makers | View root cause diagnoses, approve and track interventions |
| IT / DevOps Team | System operators | Maintain infrastructure, pipelines, and integrations |
| Digital Transformation Unit | System owners | Govern framework, configure for new ministries, oversee rollout |

---

## 2.3 Functional Requirements

Organized by the four layers of the intelligence pipeline, plus two supporting modules for citizen interaction and executive reporting.

---

### LAYER 1 — Complaint Collection

**FR-01** The system shall accept complaint submissions through four channels: web portal, mobile application (iOS and Android), call center agent interface, and a REST API for future third-party integrations.

**FR-02** Upon submission, the system shall automatically assign a unique tracking ID to every complaint, capture the submission timestamp, channel, geographic location (governorate/district level), and citizen identifier — and deliver a confirmation to the citizen via SMS or email.

**FR-03** The system shall support complaint intake in both Arabic and English, with full Unicode compliance and right-to-left (RTL) rendering for all Arabic-language interfaces.

**FR-04** The system shall automatically tag every incoming complaint with a preliminary surface category (e.g., procedures, service quality, employee behavior, access to service) based on keyword detection at intake — prior to AI analysis.

**FR-05** The system shall detect and flag likely duplicate submissions from the same citizen for the same issue within a 72-hour window, routing them to analyst review before processing.

**FR-06** The system shall maintain a permanent, append-only complaint archive with no deletion policy, ensuring full historical data is available for longitudinal analysis and pattern detection.

---

### LAYER 2 — AI Clustering (Grouping Related Complaints)

**FR-07** The system shall apply Natural Language Processing (NLP) to the full text of every complaint to extract: core issue topic, named entities (location, service type, department), sentiment, urgency signal, and writing style.

**FR-08** The system shall automatically group complaints into thematic clusters based on semantic similarity of their extracted features. Complaints describing the same underlying issue — regardless of how differently they are worded, what channel they arrived through, or which governorate they originated from — shall be grouped into a single cluster.

**FR-09** The system shall assign a confidence score to every cluster assignment. Complaints below a defined confidence threshold shall be flagged for human analyst review rather than automatically assigned.

**FR-10** The system shall support dynamic cluster evolution — as new complaints arrive, they are either absorbed into existing clusters or trigger the creation of new ones. Cluster sizes, trends, and composition shall update in real time.

**FR-11** Authorized analysts shall be able to review cluster contents, split clusters that contain heterogeneous issues, merge clusters that share the same root cause, and override any AI-generated grouping — with all manual corrections fed back into the model as training data.

**FR-12** The system shall generate an automated alert to the assigned analyst and relevant management when any cluster grows by more than 20% within a 7-day window, signaling an emerging issue.

---

### LAYER 3 — AI Root Cause Diagnosis

**FR-13** For every active complaint cluster meeting a minimum threshold of complaints (configurable, default: 10), the system's AI engine shall generate a root cause diagnosis — identifying the underlying systemic condition responsible for generating the complaints in that cluster.

**FR-14** Each root cause diagnosis shall be presented to decision-makers in plain, non-technical language in both Arabic and English. It shall include: a concise diagnosis statement, the supporting evidence (complaint excerpts, patterns, frequencies), affected citizen segments, geographic concentration, and a severity classification (Critical / High / Medium / Low).

**FR-15** The AI diagnosis engine shall distinguish between five root cause categories: Policy Gap (missing or unclear regulations), Process Failure (broken operational workflow), Infrastructure Deficit (physical or digital resource shortage), Communication Breakdown (citizens lack information or guidance), and Staff Capacity Issue (training, staffing, or behavior gap).

**FR-16** The system shall display a causal chain visualization for each diagnosis — showing the link from individual complaints → cluster → root cause category — enabling decision-makers to trace the evidence behind every diagnosis.

**FR-17** Authorized analysts shall be able to review, annotate, accept, or override AI-generated root cause diagnoses before they are surfaced to executive decision-makers.

**FR-18** The system shall track the status of each root cause over time — marking it as Active, Under Intervention, Resolved, or Recurring — based on complaint volume trends in the associated cluster.

---

### LAYER 4 — AI Solution Prescription

**FR-19** For every confirmed root cause, the system's AI engine shall generate a ranked list of prescribed solutions — each linked directly to the specific root cause it addresses and the citizen cluster most affected by it.

**FR-20** Each prescribed solution shall include the following structured attributes:
- Solution title and description
- Root cause(s) addressed
- Target citizen segment(s)
- Implementation type: Gold (high impact, higher cost), Silver (moderate impact, lower cost), or Quick Win (immediate, minimal resources)
- Estimated implementation timeline (in days)
- Estimated cost level (Low / Medium / High)
- Expected complaint reduction percentage (AI-projected)
- Responsible owner (department/role)

**FR-21** The system shall support a full solution lifecycle: Proposed → Under Review → Approved → In Progress → Completed → Impact Evaluated.

**FR-22** Field officers and department heads shall be able to log implementation updates against approved solutions, attach supporting evidence (documents, photos, reports), and mark completion milestones within the system.

**FR-23** The system shall automatically link each implemented solution to its target complaint cluster and continuously monitor whether complaint volumes in that cluster decline following implementation — generating a post-implementation impact report at 30, 60, and 90 days.

**FR-24** The system shall support scenario modeling — allowing analysts to simulate the projected complaint volume reduction of implementing different combinations of solutions before committing to execution.

---

### MODULE 5 — Citizen Interaction Layer

**FR-25** The citizen-facing interface shall allow any citizen to submit a complaint in under 2 minutes with no required account registration, using a guided intake form that prompts for the minimum required information.

**FR-26** Citizens shall be able to track the real-time status of their complaint using their tracking ID, without needing to log in or contact a call center.

**FR-27** Upon complaint resolution, the system shall send the citizen an automated follow-up message asking for a satisfaction rating (1–5) and an optional comment. This feedback shall feed directly into the impact measurement layer.

**FR-28** The system shall support proactive outreach to citizens whose complaints belong to a cluster where a solution has been approved — notifying them that their issue has been identified as a systemic problem and that action is being taken.

---

### MODULE 6 — Executive Intelligence Dashboard

**FR-29** The system shall provide a real-time executive dashboard displaying: total complaints received, active complaint clusters, top root causes by severity, solutions in progress, and projected complaint reduction — all filterable by time period, governorate, ministry department, and citizen segment.

**FR-30** The dashboard shall include a dedicated **Root Cause Command View** — a single-screen interface showing all active root causes ranked by severity, their associated complaint volumes, solution status, and time since first detection. This is the primary decision-making interface for ministry leadership.

**FR-31** The system shall support drill-down navigation from any executive-level metric to the underlying cluster, individual complaints, or AI diagnosis in no more than 3 clicks.

**FR-32** The system shall generate automated periodic intelligence reports (weekly, monthly, quarterly) in both Arabic and English, covering: top root causes, solution progress, complaint volume trends, and projected impact — exportable as PDF and Excel.

**FR-33** The system shall provide role-based dashboard views — citizens, front-line staff, analysts, and executives each see only the interface and data relevant to their function, enforced through role-based access control.

---

## 2.4 Non-Functional Requirements

---

### Performance

**NFR-01** The system shall complete NLP processing, cluster assignment, and preliminary root cause flagging for any incoming complaint within 90 seconds of submission.

**NFR-02** Any dashboard view shall load within 3 seconds under standard operating load.

**NFR-03** The system shall support a minimum of 500 concurrent users without performance degradation.

---

### AI Model Quality

**NFR-04** The complaint clustering model shall achieve a minimum precision of 85% on inter-cluster similarity as evaluated on quarterly validation datasets.

**NFR-05** The root cause diagnosis engine shall be validated by domain analysts on a monthly basis, with model accuracy tracked and reported as a system health KPI.

**NFR-06** All AI outputs — clusters, root cause diagnoses, and solution prescriptions — shall display a confidence score visible to analysts, ensuring human oversight is informed at every review stage.

---

### Security & Privacy

**NFR-07** All citizen personal data shall be encrypted at rest (AES-256) and in transit (TLS 1.3).

**NFR-08** The system shall comply with Jordanian data protection regulations and all applicable government cybersecurity standards issued by the National Cybersecurity Center (NCC).

**NFR-09** Role-based access control (RBAC) shall be enforced across all system layers — no user shall access data, AI outputs, or functions beyond their defined role permissions.

**NFR-10** All user actions within the system shall be logged in a tamper-proof audit trail, retained for a minimum of 3 years.

---

### Availability & Reliability

**NFR-11** The system shall maintain 99.5% uptime on a monthly basis, measured across all citizen-facing and analyst-facing interfaces.

**NFR-12** The system shall support automated daily backups with a Recovery Point Objective (RPO) of 24 hours and a Recovery Time Objective (RTO) of 4 hours.

---

### Scalability

**NFR-13** The system architecture shall support horizontal scaling to onboard additional government ministries without core re-engineering — each ministry operating as an isolated tenant within the shared platform infrastructure.

**NFR-14** The AI pipeline — clustering, diagnosis, and prescription engines — shall be configurable per ministry, allowing each entity to define its own complaint taxonomy and root cause categories while sharing the underlying model infrastructure.

---

### Usability

**NFR-15** The citizen complaint submission interface shall require no technical literacy and shall be completable in under 2 minutes on any device.

**NFR-16** All system interfaces shall be fully responsive across desktop, tablet, and mobile devices.

**NFR-17** Arabic RTL layout shall be the primary interface language across all citizen-facing and analyst-facing screens, with English available as a secondary language.

---

## 2.5 System Constraints

- The system must operate within Jordan's national cloud infrastructure or government-approved hosting environments
- Arabic NLP capability is a hard requirement from Day 1, not a future phase enhancement
- Initial release scope is limited to the Ministry of Health; the architecture must support multi-ministry expansion in Phase 2 without re-platforming
- The system must integrate with the Ministry of Health's existing identity and authentication systems for staff and analyst access

---

## 2.6 Out of Scope — Phase 1

- Automated complaint resolution without mandatory human review at the diagnosis and prescription stages
- Real-time voice and call recording analysis (call center transcripts entered manually by agents)
- Public-facing analytics portal for citizens showing aggregate complaint trends
- Integration with non-Jordanian government systems or regional platforms

---

## 2.7 Summary — The Intelligence Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    CITIZEN SUBMITS COMPLAINT                     │
│              (Web / Mobile / Call Center / API)                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     LAYER 1 — COLLECT                            │
│   Standardize · Tag · Deduplicate · Archive · Confirm to Citizen │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     LAYER 2 — CLUSTER                            │
│        NLP Analysis · Semantic Grouping · Analyst Review         │
│         "These 47 complaints are about the same issue"           │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 3 — DIAGNOSE                            │
│      AI Root Cause Engine · Severity Classification              │
│    "The cause is: medication stockout due to no early warning"   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 4 — PRESCRIBE                           │
│    Ranked Solutions · Impact Projection · Lifecycle Tracking     │
│     "Implement a 7-day proactive refill alert system (60 days)"  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              EXECUTIVE DASHBOARD — DECISION-MAKER                │
│    Root Cause Command View · Solution Tracker · Impact KPIs      │
└─────────────────────────────────────────────────────────────────┘
```

---

*Document Version: 2.0 | Prepared: May 2026 | Digital Transformation Unit | Classification: Private & Confidential*
