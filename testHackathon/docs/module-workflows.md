# Module Workflows

## Overview

Each of the 7 capabilities follows a consistent workflow pattern:

```
INPUT → PROCESSING → GUARDRAILS → OUTPUT
```

---

## 1. Executive Radar

### Purpose
High-level ministerial visibility into what matters most right now.

### Inputs
- Initiative statuses from all entities
- Readiness scores from Readiness Analyzer
- Active blockers from Coordination Engine
- High-priority citizen signals from Citizen Voice
- Pending decisions from Chief of Staff
- Policy risks from Policy Impact

### Processing Logic
1. **Priority Scoring Algorithm**
   - Weight factors: urgency (0.3), impact (0.3), visibility (0.2), escalation (0.2)
   - Score = Σ(factor × weight)
   - Top 10 items surface to radar

2. **Early Warning Detection**
   - Compare progress vs. expected timeline
   - Flag items where (actual_progress / expected_progress) < 0.8
   - Identify patterns: 3+ entities with similar slippage = systemic issue

3. **Intervention Classification**
   - LOW: informational only
   - MEDIUM: minister awareness needed
   - HIGH: minister action required
   - CRITICAL: immediate escalation

### Guardrails
- Maximum 10 items on daily radar
- Items must have actionable next step
- No stale data (>7 days old) on radar
- Duplicate signals merged

### Outputs
- Morning Brief (summary document)
- Priority Issues List (ranked)
- Early Warning Alerts (flagged items)
- Momentum Snapshot (trend indicators)
- Intervention Queue (action items)

### Linked Modules
- Receives from: All other modules
- Sends to: Chief of Staff (for scheduling)

---

## 2. Service Friction Intelligence

### Purpose
Identify and analyze where public services create pain for citizens.

### Inputs
- Service definitions from Services module
- Citizen complaints from Feedback module
- Service journey step data
- Processing time metrics
- Document requirements data

### Processing Logic
1. **Friction Detection**
   - Complaint frequency per service
   - Average processing time vs. benchmark
   - Number of required documents vs. peers
   - Digital vs. manual step ratio

2. **Root Cause Analysis**
   - Categorize friction: POLICY | PROCESS | HANDOFF | DESIGN | TECHNICAL
   - Map to resolution owner
   - Estimate fix complexity

3. **Prioritization Matrix**
   - Impact = (volume × severity)
   - Effort = fix complexity score
   - Priority = Impact / Effort
   - Quick wins: high impact, low effort

### Guardrails
- Friction score normalized to 0-100
- Root cause must be assigned
- At least one recommendation per friction
- Link to source complaints required

### Outputs
- Service Pain Map (visual)
- Friction Diagnosis Report (per service)
- Redesign Priority List (ranked)
- Quick-Win Opportunities (actionable)
- Root Cause Summary (for leadership)

### Linked Modules
- Receives from: Citizen Voice (complaints), Services (definitions)
- Sends to: Executive Radar (top friction alerts)

---

## 3. Institutional Readiness Analyzer

### Purpose
Assess whether entities can execute modernization effectively.

### Inputs
- Entity profiles
- Governance structure data
- HR/capability assessments
- Past initiative performance
- Decision-making speed metrics
- Technology infrastructure status

### Processing Logic
1. **Dimension Scoring**
   - GOVERNANCE: clarity, accountability, decision rights
   - CAPABILITIES: skills, staffing, expertise
   - TECHNOLOGY: systems, integration, digitization
   - CULTURE: change readiness, innovation, adaptability
   - LEADERSHIP: sponsorship, vision, commitment
   - Each dimension: 0-100 score

2. **Maturity Level Assignment**
   - LEVEL 1 (0-20): Initial
   - LEVEL 2 (21-40): Developing
   - LEVEL 3 (41-60): Defined
   - LEVEL 4 (61-80): Managed
   - LEVEL 5 (81-100): Optimizing

3. **Gap Analysis**
   - Compare current vs. required for initiative
   - Identify critical gaps blocking progress
   - Generate improvement recommendations

### Guardrails
- All 5 dimensions required for assessment
- Historical data minimum: 6 months
- Assessment refresh: quarterly
- Peer comparison normalized by entity size

### Outputs
- Readiness Scorecard (per entity)
- Maturity Heatmap (cross-entity)
- Capability Gap Report (detailed)
- Improvement Roadmap (prioritized actions)
- Ready-to-Execute List (entities cleared)

### Linked Modules
- Receives from: Entities, Initiatives (performance data)
- Sends to: Executive Radar (low readiness alerts), Policy Impact (implementation feasibility)

---

## 4. Policy Impact Assistant

### Purpose
Evaluate policy choices before implementation and track actual impact.

### Inputs
- Policy proposals
- Historical policy outcomes
- Stakeholder mapping
- Implementation resource estimates
- Regulatory constraints
- Readiness scores of affected entities

### Processing Logic
1. **Options Comparison**
   - Define 2-4 policy options
   - Score each on: effectiveness, equity, cost, speed, risk
   - Normalize to comparable scale

2. **Impact Projection**
   - Identify affected stakeholders
   - Estimate positive/negative impacts per group
   - Calculate net impact score
   - Flag unintended consequences

3. **Tradeoff Analysis**
   - Map option A vs. option B across dimensions
   - Identify where options conflict
   - Surface hidden costs

4. **Implementation Complexity**
   - Dependencies on other reforms
   - Regulatory changes required
   - Entity readiness alignment
   - Timeline realism

### Guardrails
- Minimum 2 options analyzed
- All stakeholder groups considered
- Implementation timeline required
- Risk mitigation for high-risk items

### Outputs
- Policy Options Comparison (table)
- Impact Summary (narrative)
- Tradeoff Brief (visual)
- Implementation Risk Note (flags)
- Recommended Action (with reasoning)

### Linked Modules
- Receives from: Readiness Analyzer (entity capability), Citizen Voice (public sentiment)
- Sends to: Executive Radar (high-risk policies), Chief of Staff (decision items)

---

## 5. Cross-Entity Coordination Engine

### Purpose
Track and manage dependencies between institutions.

### Inputs
- Initiative requirements (cross-entity)
- Entity capability data
- Existing blockers and escalations
- Communication logs
- Timeline commitments

### Processing Logic
1. **Dependency Mapping**
   - Parse initiative requirements
   - Identify entity-to-entity dependencies
   - Build dependency graph
   - Calculate critical path

2. **Blocker Detection**
   - Track commitment vs. delivery
   - Flag overdue items
   - Identify bottleneck entities
   - Pattern detection: recurring blockers

3. **Escalation Logic**
   - Days overdue → escalation level
   - 7 days: working level
   - 14 days: director level
   - 21 days: secretary general level
   - 30 days: ministerial level

4. **Ownership Clarification**
   - Assign primary/secondary owners
   - Define handoff points
   - Track accountability chain

### Guardrails
- Dependencies must have owner
- Blocker must have resolution plan
- Escalation requires documentation
- Max 30 days before ministerial escalation

### Outputs
- Dependency Map (visual)
- Blocker Dashboard (status view)
- Escalation Queue (action needed)
- Ownership Matrix (accountability)
- Coordination Health Score (metric)

### Linked Modules
- Receives from: Initiatives (requirements), Entities (status)
- Sends to: Executive Radar (critical blockers), Chief of Staff (escalation items)

---

## 6. Citizen Voice Translator

### Purpose
Convert citizen feedback into actionable intelligence.

### Inputs
- Complaint records (multiple channels)
- Survey responses
- Social media signals
- Service ratings
- Correspondence

### Processing Logic
1. **Theme Extraction**
   - Categorize feedback by topic
   - Identify recurring patterns
   - Group similar complaints
   - Assign service/entity linkage

2. **Sentiment Analysis**
   - Score: POSITIVE | NEUTRAL | NEGATIVE
   - Track sentiment trends over time
   - Detect sentiment shifts

3. **Trust Pulse Calculation**
   - Composite score from:
     - Complaint volume trend
     - Sentiment ratio
     - Resolution satisfaction
     - Repeat complaint rate

4. **Action Mapping**
   - Link patterns to responsible service
   - Identify addressable vs. structural issues
   - Generate recommendation stubs

### Guardrails
- Privacy: no personal data in outputs
- Minimum 10 signals before pattern claim
- Sentiment must be validated
- Recommendations must be actionable

### Outputs
- Public Voice Brief (summary)
- Recurring Issues Report (patterns)
- Trust Pulse Dashboard (trend)
- Theme Analysis (breakdown)
- Action Recommendations (prioritized)

### Linked Modules
- Receives from: Feedback (raw data)
- Sends to: Service Friction (complaints), Executive Radar (trust alerts)

---

## 7. Ministerial Chief of Staff Office

### Purpose
Support ministerial execution and continuity.

### Inputs
- Calendar events
- Meeting agendas
- Decision records
- Commitment tracking
- Executive Radar outputs
- Cross-entity escalations

### Processing Logic
1. **Brief Generation**
   - Aggregate top items from Radar
   - Include pending decisions
   - Surface follow-up items
   - Preview day's meetings

2. **Meeting Preparation**
   - Pull relevant context
   - List key discussion points
   - Include stakeholder profiles
   - Suggest talking points

3. **Decision Tracking**
   - Log decisions made
   - Assign owners
   - Set deadlines
   - Track completion

4. **Follow-Up Management**
   - Parse meeting outputs
   - Create action items
   - Set reminders
   - Track resolution

### Guardrails
- Brief ready by 7:00 AM daily
- Meeting prep 2 hours before event
- Decisions must have owner + deadline
- Follow-ups reviewed weekly

### Outputs
- Daily Ministerial Brief
- Meeting Prep Pack (per meeting)
- Decision Memo (record)
- Follow-Up Tracker (status)
- Weekly Priorities View (summary)

### Linked Modules
- Receives from: All modules (context)
- Sends to: All modules (decisions, priorities)

---

## Cross-Module Integration Points

| From Module | To Module | Data Flow |
|-------------|-----------|-----------|
| Citizen Voice | Service Friction | Complaints → friction incidents |
| Readiness | Executive Radar | Low scores → alerts |
| Readiness | Policy Impact | Capability data → implementation feasibility |
| Cross-Entity | Executive Radar | Blockers → attention items |
| Cross-Entity | Chief of Staff | Escalations → meeting agenda |
| Policy Impact | Executive Radar | High-risk policies → alerts |
| Service Friction | Executive Radar | Critical friction → attention items |
| Executive Radar | Chief of Staff | Priority items → daily brief |
| All Modules | Chief of Staff | Context → meeting prep |
