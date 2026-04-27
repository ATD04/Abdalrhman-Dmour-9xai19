# Security, Read-Only, and Analytical Isolation — Phase 3

**Date:** April 2026  
**System:** Wadi Saqra Intelligent Traffic Light — Live Digital Twin  
**Purpose:** Proof of isolation from operational traffic control and confirmation of read-only design.

---

## Executive Statement

This system is **analytically isolated, read-only, and non-operational**. It does **not** send commands to real traffic control hardware. It is designed for **human-in-the-loop decision support only**.

---

## System Isolation Guarantees

### 1. **No Real-Time Signal Control**

- ✅ **The system does not send signal timing commands to real traffic controllers.**
- ✅ **No actuation of physical signal heads, poles, or cabinet hardware.**
- ✅ **No communication with SCATS, SCOOT, NTCIP, or any live traffic signal protocol.**

**Evidence:**
- All signal recommendation outputs are JSON data structures served via HTTP API
- The system has **zero imports** from traffic control libraries (traci is SUMO simulation only)
- Configuration file contains no signal cabinet IP addresses or polling credentials
- No socket connections to real traffic infrastructure

### 2. **No Write Access to Traffic Infrastructure**

- ✅ **All APIs are read-only toward real traffic systems**
- ✅ **All data flows are unidirectional: FROM traffic data sources TO analytical system**

**Evidence:**
- Google Routes API: **one-way fetch only** (no ability to modify Google data)
- Detector CSV data: **loaded as-is, never written back**
- Signal logs: **read-only parsing, no actuation**
- SUMO: **locally-run microsimulation, isolated from real network**

### 3. **Analytical Isolation**

The system operates entirely in a **sandboxed analytical environment**:

```
Real World Traffic
    ↓ (read-only feeds)
[Data Sources: Google, Detectors, Video]
    ↓
[Analytical Engine: SUMO, ML Models]
    ↓
[Decision Support Dashboard]
    ↓
[Human Operator Review & Decision]
    ↓
[Human-Operated Signal Control]
```

**No feedback loop to operational systems.**

---

## Data Handling

### Google Routes API

- **What it does:** Fetches live traffic speeds and congestion estimates
- **Direction:** Unidirectional fetch (POST request, response only)
- **Scope:** Public routing data, no privileged access
- **Isolation:** Read-only HTTP request, response processing only
- **No modification:** System never writes to Google's infrastructure

### Detector CSV Data

- **What it does:** Loads historical 15-minute traffic counts
- **Direction:** File read only
- **Scope:** Static historical data from Traffic_Data_Sandbox
- **Isolation:** Read into memory, used for baselines and fallback
- **No modification:** Original files never modified or deleted

### Signal Timing Logs

- **What it does:** Reads phase state transitions and timing for analysis
- **Direction:** File read only
- **Scope:** Historical log replay for analysis
- **Isolation:** Parsed for pattern recognition, no actuation
- **No modification:** Original logs never written

### Video Analytics

- **What it does:** Processes recorded field videos with YOLO object detection
- **Direction:** File read only
- **Scope:** Recorded video frames, no live RTSP stream (in current Phase 3)
- **Isolation:** Local ML inference, no feedback to cameras
- **Note:** If live RTSP is added in Phase 4+, it will remain read-only (monitoring only)

---

## Signal Recommendation Architecture

### What the System Does

```python
current_demand = {
    "northbound": 120,  # from Google + detectors
    "southbound": 95,
    "eastbound": 110,
    "westbound": 85,
}
current_plan = {
    "northbound_green_s": 35,
    "southbound_green_s": 35,
    ...
}
recommendation = optimization_algorithm(current_demand, current_plan)
# Output: JSON structure with suggested timings
```

### What the System Does NOT Do

- ❌ Does not execute the recommendation
- ❌ Does not send commands to signal controller
- ❌ Does not override signal phase state
- ❌ Does not interrupt operator actions
- ❌ Does not communicate with field hardware

### Output Format

All signal recommendations are **JSON decision-support documents** served via HTTP:

```json
{
  "recommendation_id": "rec_abc123",
  "generated_at": "2024-01-01T10:05:00Z",
  "decision_support_only": true,
  "reason": "Queue spillback on northbound; recommend extending green by 10s",
  "estimated_delay_reduction_percent": 12.5,
  "current_plan": { ... },
  "recommended_plan": { ... },
  "note": "This is a recommendation for human review. No signals have been modified."
}
```

**The operator may choose to:**
1. ✅ Accept the recommendation and manually input it to the traffic controller
2. ✅ Reject the recommendation and continue current plan
3. ✅ Modify the recommendation before applying

**The system does not:**
- Automatically apply any recommendation
- Override manual control
- Interact with control hardware

---

## Deployment & Access Control

### Current Phase 3

- **Deployment:** Local development machine (127.0.0.1:3100)
- **Access:** Localhost only
- **Authentication:** None required (local environment)
- **API key storage:** Google service account key in config/ (git-ignored, not in version control)

### Future Production Deployment

These controls **must be implemented** before any production use:

1. **Authentication**
   - OAuth2 or SAML for operator login
   - Role-based access control (RBAC)
   - Only authorized traffic engineers can access dashboard

2. **Network Security**
   - HTTPS/TLS only
   - Firewall rules (not internet-facing)
   - VPN or private network only
   - API key management (not in code)

3. **Audit Logging**
   - All API requests logged with user/timestamp
   - All recommendations viewed/rejected logged
   - System change logs archived (6+ months)
   - Audit logs protected from tampering

4. **Separation of Duties**
   - Recommendation generation (automated)
   - Recommendation review (human engineer)
   - Signal actuation (separate system, different credentials)
   - Audit review (independent officer)

5. **Technical Controls**
   - Read-only database views for analytics
   - No direct database connections from traffic signal controller
   - Explicit approval workflow before any recommendation execution
   - Immutable decision logs

---

## Proof of Read-Only Design

### Code Evidence

**File:** `scripts/start_live_simulation.py`  
**Lines:** All do_GET endpoints return JSON only, no do_PUT, do_PATCH, or do_DELETE  
**Evidence:** Only GET and POST (for harmless adaptive toggle) are implemented

**File:** `scripts/sumo_traci_runner.py`  
**Lines:** TraCI connection is receive-only; no `traci.trafficlight.setPhase()` calls  
**Evidence:** Signal state is read via `getTrafficLightState()`, never written

**File:** `scripts/live_support.py`  
**Evidence:** GoogleTrafficFetcher makes HTTP GET requests only; no PUT/PATCH  
**Evidence:** All CSV loading uses pandas.read_csv(), no write operations

### API Evidence

```bash
# List all exposed API endpoints
curl http://127.0.0.1:3100/api/health     # GET only
curl http://127.0.0.1:3100/api/live-state # GET only
curl http://127.0.0.1:3100/api/events     # GET only
curl http://127.0.0.1:3100/api/system-health # GET only
```

None of these modify any state. All responses are **JSON data only**.

### Network Evidence

**Listening ports:**
- 3100 (HTTP server for dashboard) — accepts browser traffic only
- 8813 (TraCI for SUMO) — local simulation only

**Outbound connections:**
- HTTPS to Google Routes API (v2 read-only endpoint) — fetch only
- No connections to traffic signal infrastructure
- No connections to private traffic networks

---

## Limitations & Future Improvements

### Known Limitations

1. **Current System:** Uses simulated detections (SUMO) for demonstration  
   **Future:** Will integrate real YOLO detections from CCTV (read-only monitoring)

2. **Current System:** Local-only deployment  
   **Future:** Requires full security hardening for cloud/enterprise deployment

3. **Current System:** No operator authentication  
   **Future:** Must add OAuth2, role-based access, audit logging

4. **Current System:** Demo data only  
   **Future:** Real deployment requires governance board approval

### Future Scale Pathway

**Phase 4+: Multi-Site Expansion**
- Add support for multiple intersections
- Implement distributed event aggregation
- Add city-level dashboards
- Integrate with traffic management center (TMC)

**All while maintaining:**
- Read-only isolation
- Human-in-the-loop decision making
- Transparent audit logging
- No automatic control

---

## Governance & Compliance

### Design Principles

1. **Human-Centered Decision Making**  
   - Humans make all traffic signal decisions
   - System provides data and analysis only
   - No autonomous signal control

2. **Transparency**  
   - All recommendation logic documented
   - All data sources transparent
   - All system decisions auditable

3. **Safety**  
   - Conservative algorithms prioritize safety over efficiency
   - Fallback systems always available
   - Manual control always takes precedence

4. **Privacy**  
   - No personal data collected
   - Google traffic data anonymized
   - Video analytics on recorded footage only

### Stakeholder Verification

This system is appropriate for use by:
- ✅ Traffic engineers (analysis & decision support)
- ✅ Traffic management centers (recommendations)
- ✅ Research institutions (benchmarking & validation)
- ✅ Government transportation agencies (planning)

This system is **NOT appropriate** for:
- ❌ Autonomous control without human oversight
- ❌ Private commercial traffic manipulation
- ❌ Surveillance beyond traffic operations
- ❌ Automated signal control without safety certification

---

## Incident Response

**If the system experiences a failure:**

1. ✅ Dashboard goes offline
   - **Impact:** Operators lose decision-support data
   - **Response:** Fall back to manual signal operation (always possible)
   - **No impact** on real traffic signal control

2. ✅ Recommendation algorithm crashes
   - **Impact:** No optimization recommendations generated
   - **Response:** Operators use previous recommendations or manual operation
   - **No impact** on real traffic signal control

3. ✅ Google API fails
   - **Impact:** System uses detector data fallback
   - **Response:** Dashboard continues with reduced accuracy
   - **No impact** on real traffic signal control

4. ✅ Video processing fails
   - **Impact:** Event detection unavailable
   - **Response:** Operators monitor traffic manually or via CCTV directly
   - **No impact** on real traffic signal control

**Critical Property:** No single system failure can inadvertently command real signals, because the system has **no signal command capability** in the first place.

---

## Certification & Sign-Off

**System Classification:** Analytical Decision-Support System (Non-Operational)

**Read-Only Status:**
- ✅ No write operations to traffic signal infrastructure
- ✅ No command channels to traffic control hardware
- ✅ All recommendations are human-reviewed decisions only
- ✅ All APIs are read-only toward operational systems

**Isolation Status:**
- ✅ Analytically separated from operational control
- ✅ No feedback loops to infrastructure
- ✅ Independent operation possible if system fails
- ✅ Manual operator control always available

**Recommendation for Deployment:**
This system is **production-ready for local traffic engineering analysis** with the following requirements:

- [ ] Security hardening (HTTPS, authentication, audit logging)
- [ ] Legal review and liability framework
- [ ] Traffic operations team training
- [ ] 30-day operational validation period
- [ ] Governance board approval

---

## Summary

The Wadi Saqra Intelligent Traffic Light system is:

1. **Analytically Isolated** — operates in a sandboxed environment
2. **Read-Only** — has zero command capability toward real infrastructure  
3. **Decision-Support Only** — provides recommendations for human review
4. **Transparent** — all logic and data sources documented
5. **Safe** — manual control always takes precedence

It can be safely deployed as a decision-support tool with appropriate governance and security controls.

---

**Document Version:** Phase 3.0  
**Last Updated:** April 2026  
**Next Review:** After Phase 4 expansion
