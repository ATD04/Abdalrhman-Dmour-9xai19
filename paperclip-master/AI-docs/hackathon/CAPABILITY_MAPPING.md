# Capability Mapping — 7 Ministerial Capabilities on Paperclip

> **Purpose**: Detailed mapping of each hackathon capability to concrete Paperclip entities, org structures, API calls, and workflows.

---

## Capability 1: Executive Radar

### What It Does
High-level situational awareness for the Minister. Monitors modernization initiatives, detects slippage, generates executive briefs.

### Paperclip Mapping

```yaml
Company: "Minister Digital Twin"  # (or a dedicated team)
Goal:
  title: "Provide Minister with real-time situational awareness"
  level: company
  status: active

Project:
  name: "Executive Radar"
  description: "Monitoring, alerting, and briefing system"

Agents:
  - name: "Radar Chief"
    role: ceo
    title: "Chief Intelligence Analyst"
    capabilities: "Orchestrates intelligence gathering, prioritizes alerts, produces morning brief"
    
  - name: "Initiative Monitor"
    role: researcher
    reportsTo: Radar Chief
    capabilities: "Tracks modernization initiative timelines, detects slippage"
    
  - name: "Risk Analyst"
    role: researcher
    reportsTo: Radar Chief
    capabilities: "Identifies emerging risks and cross-entity patterns"
    
  - name: "Brief Writer"
    role: general
    reportsTo: Radar Chief
    capabilities: "Synthesizes intelligence into bilingual executive briefs"

Routines:
  - title: "Morning Ministerial Brief"
    trigger: schedule, cron "0 7 * * *"
    assignee: Radar Chief
    
  - title: "Hourly Slippage Scan"
    trigger: schedule, cron "0 * * * *"
    assignee: Initiative Monitor

Issues (initial):
  - "Create modernization initiative tracking framework"
  - "Build risk pattern detection pipeline"
  - "Design morning brief template (AR/EN)"
  - "Create alert threshold system"

Outputs:
  key: "brief"      # Morning brief as issue document
  key: "watchlist"   # Top issues watchlist
  key: "alert"       # Early warning alerts
```

### Key API Calls for This Capability
```bash
# Routine creates daily brief issue automatically
# Agent wakes, gathers data, produces brief:
POST /api/issues/{issueId}/documents/brief
  { "body": "## Morning Brief / الملخص الصباحي\n\n..." }

# Alert creation
POST /api/companies/{companyId}/issues
  { "title": "⚠️ Initiative X slipping", "priority": "critical", "status": "todo" }
```

---

## Capability 2: Service Friction Intelligence

### What It Does
Identifies where public services are painful, slow, or bureaucratic for citizens.

### Paperclip Mapping

```yaml
Project:
  name: "Service Friction Intelligence"
  description: "Analyze and map service delivery pain points"

Agents:
  - name: "Friction Chief"
    role: pm
    title: "Service Quality Lead"
    capabilities: "Orchestrates service analysis, prioritizes friction points"
    
  - name: "Journey Mapper"
    role: researcher
    reportsTo: Friction Chief
    capabilities: "Maps citizen service journeys, identifies handoff failures"
    
  - name: "Root Cause Analyst"
    role: researcher
    reportsTo: Friction Chief
    capabilities: "Analyzes friction root causes: policy, process, system, governance"
    
  - name: "Simplification Planner"
    role: engineer
    reportsTo: Friction Chief
    capabilities: "Designs quick-win simplification plans"

Issues (initial):
  - "Map top 10 high-volume citizen services"
  - "Identify approval-heavy service bottlenecks"
  - "Analyze digital-to-manual fallback patterns"
  - "Create service pain map visualization"
  - "Generate friction diagnosis by service journey"

Outputs:
  key: "pain-map"       # Service pain map document
  key: "diagnosis"      # Friction diagnosis
  key: "shortlist"      # Services to redesign first
  key: "quick-wins"     # Quick-win simplification plan
```

---

## Capability 3: Institutional Readiness Analyzer

### Paperclip Mapping

```yaml
Project:
  name: "Institutional Readiness"
  description: "Assess entity readiness for modernization"

Agents:
  - name: "Readiness Chief"
    role: pm
    title: "Institutional Assessment Lead"
    
  - name: "Governance Assessor"
    role: researcher
    reportsTo: Readiness Chief
    capabilities: "Evaluates governance structures, decision speed, accountability"
    
  - name: "Capability Assessor"
    role: researcher
    reportsTo: Readiness Chief
    capabilities: "Assesses talent, skills, organizational capacity"
    
  - name: "Scorecard Builder"
    role: engineer
    reportsTo: Readiness Chief
    capabilities: "Produces readiness scorecards and maturity heatmaps"

Outputs:
  key: "scorecard"       # Institutional readiness scorecard
  key: "heatmap"         # Maturity heatmap
  key: "gap-analysis"    # Capability gap diagnosis
  key: "comparison"      # Readiness-by-entity comparison
  key: "plan"            # Readiness improvement plan
```

---

## Capability 4: Policy Impact Assistant

### Paperclip Mapping

```yaml
Project:
  name: "Policy Impact Analysis"

Agents:
  - name: "Policy Chief"
    role: pm
    title: "Policy Impact Lead"
    
  - name: "Impact Modeler"
    role: researcher
    reportsTo: Policy Chief
    capabilities: "Models policy consequences, stakeholder impact, compliance burden"
    
  - name: "Options Analyst"
    role: researcher
    reportsTo: Policy Chief
    capabilities: "Compares policy alternatives, analyzes tradeoffs"
    
  - name: "Brief Writer"
    role: general
    reportsTo: Policy Chief
    capabilities: "Produces bilingual policy briefs and impact summaries"

Outputs:
  key: "options"         # Policy options comparison
  key: "impact"          # Impact summary
  key: "tradeoffs"       # Tradeoff brief
  key: "risk-note"       # Implementation risk note
  key: "recommendation"  # Recommended course of action
```

---

## Capability 5: Cross-Entity Coordination Engine

### Paperclip Mapping

```yaml
Project:
  name: "Cross-Entity Coordination"

Agents:
  - name: "Coordination Chief"
    role: pm
    title: "Cross-Entity Coordination Lead"
    
  - name: "Dependency Tracker"
    role: engineer
    reportsTo: Coordination Chief
    capabilities: "Maps inter-entity dependencies, tracks handoffs"
    
  - name: "Blocker Monitor"
    role: researcher
    reportsTo: Coordination Chief
    capabilities: "Detects unresolved blockers, escalation needs"
    
  - name: "Ownership Mapper"
    role: researcher
    reportsTo: Coordination Chief
    capabilities: "Clarifies ownership when work spans multiple entities"

# This capability maps perfectly to Paperclip's native features:
# - Issues with blockedByIssueIds for dependency tracking
# - Issue parent/child hierarchy for coordination breakdown
# - Agent @-mention for cross-team communication
# - Routines for periodic coordination health checks

Outputs:
  key: "dependency-map"   # Entity dependency map
  key: "blocker-report"   # Blocker and escalation dashboard
  key: "action-tracker"   # Cross-entity action tracker
  key: "ownership-matrix" # Shared ownership matrix
  key: "health-summary"   # Coordination health summary
```

---

## Capability 6: Citizen Voice Translator

### Paperclip Mapping

```yaml
Project:
  name: "Citizen Voice Intelligence"

Agents:
  - name: "Voice Chief"
    role: pm
    title: "Citizen Intelligence Lead"
    
  - name: "Sentiment Analyst"
    role: researcher
    reportsTo: Voice Chief
    capabilities: "Analyzes citizen feedback sentiment (AR/EN), detects patterns"
    
  - name: "Pattern Extractor"
    role: researcher  
    reportsTo: Voice Chief
    capabilities: "Identifies recurring themes across feedback channels"
    
  - name: "Voice Synthesizer"
    role: general
    reportsTo: Voice Chief
    capabilities: "Produces citizen voice briefs and trust pulse reports"

Routines:
  - title: "Weekly Public Voice Brief"
    trigger: schedule, cron "0 9 * * 1"  # Every Monday 9am
    
  - title: "Daily Sentiment Pulse"
    trigger: schedule, cron "0 18 * * *"  # Every day 6pm

Outputs:
  key: "voice-brief"      # Public voice brief
  key: "recurring-issues"  # Recurring issues summary
  key: "trust-pulse"       # Citizen trust pulse
  key: "synthesis"         # "What the public is telling us"
  key: "recommendations"   # Action recommendations
```

---

## Capability 7: Ministerial Chief of Staff Office

### Paperclip Mapping

```yaml
Project:
  name: "Chief of Staff Office"

Agents:
  - name: "Chief of Staff"
    role: ceo
    title: "Digital Chief of Staff"
    capabilities: "Manages Minister's agenda, tracks commitments, prepares briefings"
    
  - name: "Daily Brief Compiler"
    role: general
    reportsTo: Chief of Staff
    capabilities: "Compiles daily briefing from all capabilities"
    
  - name: "Meeting Prep Agent"
    role: pm
    reportsTo: Chief of Staff
    capabilities: "Prepares meeting packs with relevant data from all capabilities"
    
  - name: "Follow-up Tracker"
    role: engineer
    reportsTo: Chief of Staff
    capabilities: "Tracks decisions, commitments, and follow-up across stakeholders"

Routines:
  - title: "Daily Ministerial Brief"
    trigger: schedule, cron "0 6 * * *"  # 6am daily
    
  - title: "Weekly Priorities Review"
    trigger: schedule, cron "0 8 * * 0"  # Sunday 8am
    
  - title: "End-of-Day Decision Digest"
    trigger: schedule, cron "0 17 * * *"  # 5pm daily

# This is the "hub" capability — it pulls from all other capabilities.
# Use Paperclip's cross-project features:
# - Create issues that reference other projects
# - @-mention agents from other capabilities
# - Use blockedByIssueIds to link to outputs from other capabilities

Outputs:
  key: "daily-brief"       # Ministerial daily brief
  key: "meeting-prep"      # Meeting prep pack
  key: "decision-memo"     # Decision memo
  key: "follow-up"         # Follow-up tracker
  key: "priorities"        # Weekly priorities view
```

---

## Cross-Capability Integration Pattern

```
                    ┌─────────────────────┐
                    │   Chief of Staff    │
                    │   (Hub Capability)   │
                    └─────────┬───────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
    ┌─────▼──────┐   ┌───────▼────────┐   ┌──────▼───────┐
    │ Executive  │   │ Cross-Entity   │   │ Citizen      │
    │ Radar      │   │ Coordination   │   │ Voice        │
    └─────┬──────┘   └───────┬────────┘   └──────┬───────┘
          │                   │                   │
    ┌─────▼──────┐   ┌───────▼────────┐   ┌──────▼───────┐
    │ Service    │   │ Institutional  │   │ Policy       │
    │ Friction   │   │ Readiness      │   │ Impact       │
    └────────────┘   └────────────────┘   └──────────────┘
```

Integration mechanisms in Paperclip:
1. **Shared company** — All capabilities in one company, different projects
2. **Cross-project issues** — Create issues in one project that reference another
3. **Agent @-mentions** — `@AgentName` in comments triggers wakeup across capabilities
4. **Goal hierarchy** — All capabilities share the same company-level goal tree
5. **Dashboard** — Single dashboard shows status across all capabilities
6. **Activity log** — Unified audit trail across all capability work

---

## Bilingual Output Template

Every output should follow this structure:

```markdown
## Executive Summary / الملخص التنفيذي

[English content here]

[Arabic content here / المحتوى العربي هنا]

---

## Details / التفاصيل

### Finding 1 / النتيجة ١
...

### Finding 2 / النتيجة ٢
...

---

## Recommendations / التوصيات

1. [English] / [عربي]
2. [English] / [عربي]
```

---

## Guardrails Checklist

Each capability must implement:

- [ ] **Input validation** — Verify data sources before analysis
- [ ] **Confidence scoring** — Mark outputs with confidence levels
- [ ] **Source attribution** — Cite data sources for all claims
- [ ] **Bias detection** — Flag when analysis may be skewed by data gaps
- [ ] **Escalation triggers** — Auto-flag when findings exceed threshold severity
- [ ] **Bilingual consistency** — Ensure AR/EN outputs convey the same information
- [ ] **Error handling** — Graceful degradation when data is unavailable
- [ ] **Audit trail** — All analysis steps logged via Paperclip activity log
