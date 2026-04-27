# Phase 3 Risk Register

**Date:** April 2026  
**Project:** Wadi Saqra Intelligent Traffic Light  
**Status:** 10 identified risks, all with mitigation strategies

---

## RISK ASSESSMENT SUMMARY

| Risk ID | Risk | Severity | Probability | Priority | Status |
|---|---|---|---|---|---|
| **R-001** | Google API outage | HIGH | MEDIUM | 🔴 CRITICAL | Monitored |
| **R-002** | Forecast accuracy drift | MEDIUM | HIGH | 🟡 HIGH | Monitored |
| **R-003** | Video processing failure | MEDIUM | LOW | 🟢 MEDIUM | Mitigated |
| **R-004** | Database corruption | HIGH | LOW | 🟡 HIGH | Mitigated |
| **R-005** | Single-point failure (SUMO) | HIGH | LOW | 🟡 HIGH | Accepted |
| **R-006** | Operator misinterpretation | MEDIUM | MEDIUM | 🟡 HIGH | Mitigated |
| **R-007** | Cybersecurity vulnerabilities | HIGH | LOW | 🟡 HIGH | Mitigated |
| **R-008** | Scalability bottleneck | MEDIUM | MEDIUM | 🟢 MEDIUM | Deferred |
| **R-009** | Data quality degradation | MEDIUM | MEDIUM | 🟢 MEDIUM | Monitored |
| **R-010** | Forecasting bias (time-shift) | LOW | LOW | 🟢 LOW | Deferred |

---

## DETAILED RISK ANALYSIS

### R-001: Google Routes API Outage

**Description:** Google Routes API becomes unavailable due to:
- Network connectivity loss
- Google service disruption
- API quota exceeded
- Authentication failure

**Impact:** Traffic speeds unavailable, system reverts to detector fallback; accuracy degraded

**Probability:** MEDIUM (industry average: 0.1% downtime/month = ~3 hours/year)

**Severity:** HIGH (speed data is primary input)

**Current Mitigation:**
- ✅ Automatic fallback to detector CSV data
- ✅ Health monitoring with `/api/system-health`
- ✅ Alert on dashboard when source switches
- ✅ Graceful degradation (operates on detector data alone)

**Residual Risk:** LOW (system continues operating with reduced accuracy)

**Phase 4 Mitigation:**
- Add backup provider (HERE Maps, TomTom)
- Implement circuit breaker with exponential backoff
- Cache recent data for 30-minute fallback window

**Monitoring:**
- Track API success rate in `/api/system-health`
- Alert operator if Google unavailable >2 hours
- Log all switches to detector fallback

---

### R-002: Forecast Accuracy Drift

**Description:** Forecast accuracy degrades over time due to:
- Traffic pattern changes (new infrastructure, population growth)
- Seasonal shifts (weather, school calendars)
- Model aging without retraining
- External events (construction, special events)

**Impact:** Signal optimization recommendations become stale; decisions less effective

**Probability:** HIGH (expected ~15% drift per year)

**Severity:** MEDIUM (still provides baseline guidance)

**Current Mitigation:**
- ✅ Documented accuracy boundaries (12-25% MAPE)
- ✅ Comparison against seasonal-naive baseline available
- ✅ Manual override capability for operators
- ✅ Fallback to rule-based Webster method

**Residual Risk:** MEDIUM (accuracy degrades but system still usable)

**Phase 4 Mitigation:**
- Monthly automated retraining on new data
- A/B testing framework for model updates
- Feedback loop: track actual vs predicted for continuous learning
- Retrain if MAPE exceeds 35%

**Monitoring:**
- Track forecast accuracy monthly
- Alert if MAPE increases >5% from baseline
- Flag unusual prediction patterns

---

### R-003: Video Processing Failure

**Description:** YOLO video analytics fails due to:
- Insufficient GPU memory
- Corrupted video files
- Inference timeout
- Model loading failure

**Impact:** No video-based event detection (but system continues via detector data)

**Probability:** LOW (robust error handling in place)

**Severity:** MEDIUM (video analytics is enhancement, not core function)

**Current Mitigation:**
- ✅ Try/except error handling in video processing
- ✅ Fallback to detector-based anomaly detection
- ✅ Separate video processing from main loop
- ✅ Logging of all video processing failures

**Residual Risk:** LOW (graceful degradation to detector-only)

**Phase 4 Mitigation:**
- Multi-camera redundancy
- Edge GPU deployment
- Real-time video streaming (RTSP) instead of batch processing

**Monitoring:**
- Track video processing uptime
- Alert if no YOLO detections for 30+ minutes
- Monitor inference latency (should stay <100ms)

---

### R-004: Database Corruption

**Description:** SQLite database becomes corrupted due to:
- Unexpected power loss during write
- Concurrent write conflicts
- Disk I/O errors
- Filesystem corruption

**Impact:** Loss of historical event data, potential system crash

**Probability:** LOW (~0.1% per year on modern hardware)

**Severity:** HIGH (loss of audit trail)

**Current Mitigation:**
- ✅ SQLite automatic transaction management
- ✅ PRAGMA integrity_check available
- ✅ Read-only many queries (reduces write contention)
- ✅ Database file on local SSD (lower failure rate)
- ✅ Backup strategy documented (manual daily backups)

**Residual Risk:** VERY LOW (mitigations reduce to ~0.01%)

**Phase 4 Mitigation:**
- Automated hourly backups to cloud storage
- Real-time replication to backup database
- Cloud database (PostgreSQL) instead of SQLite
- Automated integrity checks every 6 hours

**Monitoring:**
- Run PRAGMA integrity_check daily
- Monitor database file size growth
- Alert on database access latency >50ms

---

### R-005: Single-Point Failure (SUMO Microsimulation)

**Description:** SUMO process crashes, making vehicle positions unavailable:
- Process segfault
- Out of memory condition
- Configuration file corruption
- TraCI connection loss

**Impact:** Dashboard shows last known state; new vehicle positions not available; but system stays operational

**Probability:** LOW (SUMO is stable, crashes rare)

**Severity:** HIGH (core component)

**Current Mitigation:**
- ✅ Graceful degradation (dashboard stays live with last state)
- ✅ Error logging and alerting
- ✅ Manual restart procedure documented
- ✅ State persistence (can load from saved scenario)

**Residual Risk:** MEDIUM (requires manual restart)

**Phase 4 Mitigation:**
- Automated SUMO restart on crash
- Systemd service wrapper with auto-recovery
- Multi-process SUMO for network-wide simulation
- Kubernetes pod restart policy

**Monitoring:**
- Health check on SUMO process every 10 seconds
- Alert operator if SUMO unavailable >5 minutes
- Log all SUMO errors and crashes

---

### R-006: Operator Misinterpretation

**Description:** Traffic operator misunderstands system output and makes poor decisions:
- Misreads signal recommendation numbers
- Doesn't understand confidence scores
- Ignores fallback status indicators
- Makes changes without understanding consequences

**Impact:** Suboptimal or harmful signal timing decisions

**Probability:** MEDIUM (operator training & UI clarity critical)

**Severity:** MEDIUM (system is decision-support, not autonomous)

**Current Mitigation:**
- ✅ Professional dashboard with clear labels
- ✅ "How to Read Numbers" help text on dashboard
- ✅ Color coding (red=severe, yellow=caution, green=ok)
- ✅ Explicit "decision-support only" labels
- ✅ Operator training documentation
- ✅ System health clearly visible
- ✅ Source indication (Google vs Detector)

**Residual Risk:** LOW (good UI design and training)

**Phase 4 Mitigation:**
- Operator certification program
- Interactive tutorials on dashboard
- Recommended action priority ranking
- Audit trail of decisions with reasoning

**Monitoring:**
- Log all operator actions
- Feedback system for decision outcomes
- Regular operator competency checks

---

### R-007: Cybersecurity Vulnerabilities

**Description:** System is attacked or compromised via:
- API injection attacks
- Unauthorized signal modifications
- Data exfiltration
- Denial of service

**Impact:** Potential false signal recommendations, data breach, service unavailability

**Probability:** LOW (current deployment is localhost only)

**Severity:** HIGH (critical infrastructure)

**Current Mitigation:**
- ✅ Read-only API (no write endpoints exposed)
- ✅ No direct signal actuation code
- ✅ No remote code execution paths
- ✅ Local network only (no public internet exposure)
- ✅ API key not exposed in logs
- ✅ Code reviewed for security issues

**Residual Risk:** VERY LOW (localhost deployment)

**Phase 4 Mitigation:**
- HTTPS/TLS encryption
- OAuth2 operator authentication
- API rate limiting
- Web Application Firewall (WAF)
- Regular penetration testing
- Audit logging for all API calls
- ISO 27001 compliance for cloud deployment

**Monitoring:**
- Monitor for unusual API access patterns
- Alert on failed authentication attempts
- Review audit logs weekly

---

### R-008: Scalability Bottleneck

**Description:** System performance degrades when scaled to:
- 10+ concurrent operators
- Multiple intersections (network-wide)
- Real-time video from 4+ cameras
- 100,000+ daily events

**Impact:** Latency increases, dashboard becomes sluggish, forecasting slows

**Probability:** MEDIUM (expected during Phase 4 expansion)

**Severity:** MEDIUM (affects user experience, not safety)

**Current Mitigation:**
- ✅ Load testing up to 5x expected capacity
- ✅ Database indices for fast queries
- ✅ Asynchronous SSE streaming
- ✅ Performance monitoring built in

**Residual Risk:** MEDIUM (known limitation of Phase 3)

**Phase 4+ Mitigation:**
- Migrate to cloud (AWS/Azure)
- Use managed database (RDS/CosmosDB)
- Add CDN for dashboard assets
- Distribute forecasting to worker processes
- Implement caching layer (Redis)
- Horizontal scaling via Kubernetes

**Monitoring:**
- Track API response times
- Monitor CPU/memory usage
- Database query latency trending

---

### R-009: Data Quality Degradation

**Description:** Input data becomes stale or inaccurate due to:
- Detector sensor failures
- GPS drift in Google data
- Timestamp synchronization issues
- Missing or delayed updates

**Impact:** Inaccurate dashboards, poor forecasts, bad recommendations

**Probability:** MEDIUM (common in traffic systems)

**Severity:** MEDIUM (reduces decision quality)

**Current Mitigation:**
- ✅ Data validation (reject negatives, impossibly high values)
- ✅ Timestamp normalization
- ✅ Multi-source redundancy
- ✅ Staleness detection (alert if >30s without update)
- ✅ Health monitoring shows source status

**Residual Risk:** LOW (good validation in place)

**Phase 4 Mitigation:**
- Real-time data quality checks
- Automated outlier detection & removal
- Sensor health monitoring dashboard
- Data imputation for missing values
- Continuous data lineage tracking

**Monitoring:**
- Track update frequency per source
- Alert on missing data >30 seconds
- Log all data validation rejections

---

### R-010: Forecasting Bias (Time-Shift)

**Description:** Historical data used for training may have systematic bias:
- Training data from winter (different patterns than summer)
- Time shift between detector install and current operations
- Trend shifts due to economic or demographic changes
- Day-of-week effects not captured

**Impact:** Forecasts slightly biased, recommendations miss optimality

**Probability:** LOW (documented in validation notes)

**Severity:** LOW (bias small, baseline acceptable)

**Current Mitigation:**
- ✅ Awareness and documentation of bias
- ✅ Comparison against seasonal naive baseline
- ✅ Manual adjustment capability for operators
- ✅ Validation on multiple time periods

**Residual Risk:** VERY LOW (small impact, acceptable)

**Phase 4 Mitigation:**
- Continuous retraining on rolling window
- Separate models for weekday/weekend/special events
- External feature incorporation (weather, events, holidays)
- Bias detection and correction algorithms

**Monitoring:**
- Track forecast bias (systematic over/under prediction)
- Alert if bias exceeds 10% MAPE
- Monthly bias analysis reports

---

## RISK MATRIX

```
Severity
   ↑
   │
   HIGH │  R-001    R-004    R-005    R-007
        │  (Google  (DB      (SUMO)   (Security)
        │   API)    Corrupt)
        │
   MED  │                           R-002      R-003    R-008    R-009
        │                           (Forecast  (Video)  (Scale)  (Data
        │                            Drift)                      Quality)
        │
   LOW  │                                                         R-010
        │                                                         (Bias)
        │
        └─────────────────────────────────────────→
             LOW        MEDIUM         HIGH
                      Probability
```

---

## RISK RESPONSE SUMMARY

| Risk | Current Status | Owner | Review Freq |
|---|---|---|---|
| R-001 | Monitored | Ops Team | Daily (via health API) |
| R-002 | Monitored | ML Team | Monthly (retraining review) |
| R-003 | Mitigated | Dev Team | N/A (good error handling) |
| R-004 | Mitigated | DevOps | Daily (backup check) |
| R-005 | Accepted | Ops Team | Per incident |
| R-006 | Mitigated | Ops Training | Quarterly (refresher) |
| R-007 | Mitigated | Security Team | Per deployment |
| R-008 | Deferred | Arch Team | Phase 4 planning |
| R-009 | Monitored | Data Team | Weekly (quality checks) |
| R-010 | Deferred | ML Team | Phase 4+ retraining |

---

## RISK DECISION RECORD

### Accepted Risks

✅ **R-005 (SUMO Single Point of Failure):**
- **Rationale:** Phase 3 scope limitation, acceptable for single intersection, graceful degradation adequate
- **Decision Date:** April 2026
- **Review Date:** Phase 4 (add redundancy for network)

### Deferred Risks

🔄 **R-008 (Scalability):**
- **Rationale:** Phase 3 design target is single intersection, <100 daily events, <5 concurrent users
- **Deferral:** Phase 4 expansion work
- **Trigger:** When scaling to multiple intersections

🔄 **R-010 (Forecasting Bias):**
- **Rationale:** Small impact, mitigated by baseline comparison and operator override
- **Deferral:** Phase 4 retraining pipeline
- **Trigger:** After 90-day validation period

---

## SIGN-OFF

| Role | Assessment |
|---|---|
| **Project Lead** | ✅ Risk register complete, all risks addressed |
| **Ops Lead** | ✅ Monitoring plan in place, team trained |
| **Security Lead** | ✅ Security mitigations verified, localhost deployment low-risk |
| **DevOps Lead** | ✅ Backup & recovery procedures documented |

---

**Register Date:** April 2026  
**Next Review:** Post-Phase 3 field validation (30 days operation)  
**Update Frequency:** Monthly (or as triggered by incidents)
