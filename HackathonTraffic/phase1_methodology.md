# Phase 1 Technical Methodology
### Traffic Data Sandbox — Dual-Source Architecture

---

## Overview

This document describes the rigorous dual-source architecture of the **Phase 1 Traffic Data Sandbox**. To ensure the highest level of technical honesty and professional accuracy, the system strictly separates **localized vehicle intelligence** from **external traffic context**.

We do not use mapping APIs to hallucinate car counts, nor do we use localized tracking to assume city-wide routing conditions. 

---

## 1. Video / CV Source of Truth (The "What Is")

The primary traffic video is the **only** source of truth for intersection-level metrics. 

- **Detection & Tracking Engine:** YOLO26m (Medium) + ByteTrack.
- **Counting Logic (Virtual Trip-Zone):** To prevent track-switching double counts, vehicles are only logged into the cumulative session count when their centroid enters a designated central core area (30% to 70% of the frame).
- **Incident Feed:** All incidents are grounded. For example, a "Stalled Vehicle" alert is only generated when a tracked bounding box maintains a velocity near zero over a sustained window of frames. No external data is used to fabricate localized incidents.

---

## 2. Google Maps Traffic-Status Source (The "What Might Be")

We leverage the modern **Google Maps Platform (Routes API)** strictly as an external contextual signal, completely independent of the car count logic.

- **Routing Preference:** `TRAFFIC_AWARE` requests utilizing future departure times.
- **Route Probe:** A primary origin-destination vector (North-West to South-East) intersecting Wadi Saqra is probed across a 12-hour window (8:00 AM to 8:00 PM).
- **Congestion Proxy:** The resulting ratio between `duration_in_traffic` and `staticDuration` yields a continuous Same-Day Traffic Status Profile.

---

## 3. Near-Term Traffic Outlook

By comparing the 10:00 AM visual context of the video with the slope of the Google Maps congestion profile, the dashboard projects a 15, 30, and 60-minute **Near-Term Traffic Outlook**. 

- **Honesty Declaration:** This panel provides a directional trend (e.g., "Increasing Congestion: +0.05x"). It is presented honestly as an external route-level assumption, *not* an exact predictive vehicle count model.

---

*Phase 1 Technical Methodology — 9XAI Hackathon, AI-Based Traffic Monitoring and Forecasting*
