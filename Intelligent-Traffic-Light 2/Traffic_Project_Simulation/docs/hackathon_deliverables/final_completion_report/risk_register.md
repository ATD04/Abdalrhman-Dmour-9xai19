# Risk Register — Wadi Saqra Intelligent Traffic Light

| Risk ID | Category     | Risk Description                                         | Likelihood | Impact | Mitigation Strategy                                      | Owner         | Status    |
|---------|-------------|---------------------------------------------------------|------------|--------|----------------------------------------------------------|---------------|-----------|
| R1      | Data        | Google API rate limits may block live data              | M          | H      | Fallback to detector data, cache results                 | Tech Lead     | Open      |
| R2      | Data        | Synthetic data may not match real-world variability     | H          | M      | Integrate real detector/camera data as available         | Data Eng      | Open      |
| R3      | Data        | Annotation gaps for rare events                         | M          | M      | Use SUMO simulation to generate rare event samples       | Data Eng      | Open      |
| R4      | Technical   | YOLO inference speed slow on CPU-only hardware          | H          | M      | Use GPU/MPS if available, optimize batch size            | ML Eng        | Open      |
| R5      | Technical   | Video stream instability (packet loss, disconnects)     | M          | H      | Auto-reconnect, log errors, robust error handling        | DevOps        | Open      |
| R6      | Technical   | Model drift over time without retraining                | M          | M      | Schedule periodic retraining, monitor accuracy           | ML Eng        | Open      |
| R7      | Technical   | Database performance degrades at N sites                | L          | H      | Partition by site, optimize queries, monitor load        | Backend Eng   | Open      |
| R8      | Technical   | Corrupted JSONL audit trail                             | L          | M      | Skip bad entries, log errors, maintain redundancy        | Backend Eng   | Open      |
| R9      | Operational | Intersection geometry assumptions may be invalid        | M          | M      | Validate with field survey, update config as needed      | Project Lead  | Open      |
| R10     | Operational | Single camera blind spots/occlusions                    | H          | M      | Add more cameras, multi-view fusion                     | Project Lead  | Open      |
| R11     | Operational | Operator misinterpretation of advisory recommendations  | M          | M      | Clear UI labeling, operator training                    | UI/UX Lead    | Open      |
| R12     | Scale       | Config management complexity at multi-site scale         | M          | H      | Use config templates, automate deployment               | DevOps        | Open      |
| R13     | Scale       | Database write contention at high event rates           | L          | M      | Use write queues, monitor, scale up hardware            | Backend Eng   | Open      |
| R14     | Scale       | Model generalization to new intersections               | M          | M      | Fine-tune on new site data, monitor performance         | ML Eng        | Open      |
| R15     | Scale       | System monitoring gaps at scale                         | M          | H      | Centralized logging/monitoring, alerting                | DevOps        | Open      |