# Phase 2 Build Plan — Execution Strategy

This document outlines the step-by-step roadmap for building the Phase 2 prototype. The order is designed to resolve dependencies early and focus on the highest technical risks.

---

## 1. Recommended Build Order

### **Step 1: Architecture & Data Contracts**
- **Action**: Finalize the module interaction logic and update schemas if necessary.
- **Why**: Prevents "integration hell" later by ensuring every module developer knows exactly what their inputs and outputs look like.

### **Step 2: Data Acquisition Layer (DAL)**
- **Action**: Build the service that ingests video, detector logs, and signal logs.
- **Why**: This is the foundation. Without clean, normalized data flowing, the AI and Optimization modules cannot function.

### **Step 3: Real-Time Incident Detection (RTID)**
- **Action**: Implement the CV pipeline (YOLO + Tracking) and the heuristic incident logic.
- **Why**: CV is the highest risk area for performance and precision. It needs the most tuning time.

### **Step 4: Traffic Flow Forecasting (TFF)**
- **Action**: Develop the demand forecasting model using the Phase 1 historical dataset.
- **Why**: Dependent on clean DAL output, but independent of the RTID visual module.

### **Step 5: Signal Optimization Support (SOS)**
- **Action**: Build the recommendation engine that combines RTID events and TFF forecasts.
- **Why**: This is the "brain" that depends on outputs from all previous modules.

### **Step 6: Dashboard & Visualization**
- **Action**: Upgrade the Phase 1 viewer into a full-featured operator dashboard.
- **Why**: The visual shell for the demo. Best built once the data APIs are stable.

### **Step 7: Benchmarking & Validation**
- **Action**: Run the benchmark suite and document performance.
- **Why**: Provides the objective proof of feasibility needed for the hackathon judges.

---

## 2. Implementation Methodology
Phase 2 follows a **"Quick Build"** approach:
- **Reuse**: Maximize reuse of Phase 1 metadata and schemas.
- **Mocking**: If one module is delayed, use Phase 1 "Fault Samples" or mock data to keep other modules moving.
- **Iterative Tuning**: Focus on getting the end-to-end flow working (even with low accuracy), then iterate to improve model precision.

---

## 3. Technology Stack Selection
| Layer | Recommended Technology |
|---|---|
| **Language** | Python 3.9+ (Core logic), Node.js (Dashboard) |
| **CV Engine** | Ultralytics YOLOv8 (Inference), ByteTrack (Tracking) |
| **Forecasting** | Prophet or XGBoost (Time-series) |
| **API Framework** | FastAPI (High-performance async) |
| **Frontend** | React + Vite + Tailwind (Current Stack) |
| **Communication** | REST API (Phase 2), preparing for WebSockets (Phase 3) |
