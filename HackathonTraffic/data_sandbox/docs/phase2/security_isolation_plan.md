# Security, Read-Only, and Isolation Plan — Phase 2

Ensuring the non-intrusiveness of the Traffic Intelligence system is a core requirement (Hackathon Requirement 7.7). Phase 2 must prove that the design is safe for deployment in a real municipal environment.

---

## 1. Physical and Logical Isolation
### **A. Read-Only Ingestion**
- **Action**: All data ingestion drivers (Video, Signal Logs, Detector CSVs) must use **Read-Only file descriptors**.
- **Proof**: The code must explicitly catch and fail on any attempt to open a source file with `w` or `a` flags.

### **B. Network Air-Gapping (Simulation)**
- **Action**: The Phase 2 build will operate on a local network bridge. 
- **Proof**: Intelligence modules will communicate with the DAL via a local loopback (`127.0.0.1`), ensuring no external traffic can influence the signal recommendation logic.

---

## 2. Non-Intrusive Design
- **No Direct Signal Control**: The SOS module is strictly "Advisory." The recommendation output is a JSON log, not a command sent to a Signal Controller.
- **Processing Overhead**: In a real-world scenario, processing would happen on an Edge Node (e.g., Jetson Orin). Phase 2 will simulate this by capping the CPU/GPU utilization of the IDM module to 70% to ensure stability of the host system.

---

## 3. Data Privacy & Anonymization
- **Video Privacy**: All video processing for detection is "In-Memory." No raw video containing identifiable faces or license plates should be stored long-term.
- **Output Anonymization**: Bounding boxes and counts are aggregated. No tracking of individual vehicles across multiple city sites is permitted in the Phase 2 scope.

---

## 4. Security Verification
| Security Goal | Implementation Proof |
|---|---|
| **Data Integrity** | Use of Phase 1 `schemas` to validate all internal data packets. |
| **System Isolation** | Use of the Phase 1 `isolation_note.md` as the mandatory design boundary. |
| **Unauthorized Access** | Basic token-based authentication for the Phase 2 Dashboard API. |
| **Fail-Safe** | In case of IDM failure, the system falls back to "Historical Mode" (showing only historical averages, no live AI overlays). |
