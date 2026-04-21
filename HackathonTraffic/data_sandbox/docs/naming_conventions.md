# Naming Conventions — AMM-WS-01 Traffic Data Sandbox

All identifiers and file names across the sandbox must follow these conventions to ensure internal consistency across all modules and phases.

---

## 1. Site Identifier
| Pattern | Example |
|---|---|
| `{CITY_CODE}-{SITE_CODE}-{INDEX}` | `AMM-WS-01` |

## 2. Camera IDs
| Pattern | Example |
|---|---|
| `CAM-{INDEX}-{CARDINAL}` | `CAM-01-N`, `CAM-02-S` |

Valid cardinals: `N`, `S`, `E`, `W`

## 3. Detector IDs
| Pattern | Example |
|---|---|
| `det_{CARDINAL}_{LANE_INDEX}` | `det_N_0`, `det_E_3` |

- CARDINAL: `N`, `S`, `E`, `W`
- LANE_INDEX: 0-based (0 = leftmost through lane from driver perspective)

## 4. Lane IDs
| Pattern | Example |
|---|---|
| `{CARDINAL}_{LANE_INDEX}` | `N_0`, `W_3` |

## 5. Phase IDs
| Pattern | Example |
|---|---|
| Integer string `"1"` through `"4"` | `"1"`, `"2"`, `"3"`, `"4"` |

## 6. Zone / ROI IDs
| Pattern | Example |
|---|---|
| `ROI-{INDEX}-{LABEL}` | `ROI-01-ROAD`, `ROI-02-QUEUING` |

## 7. Event IDs
| Pattern | Example |
|---|---|
| `EVT-{YYYY-MM-DD}-{INDEX}` | `EVT-2026-04-21-001` |

## 8. Clip IDs
| Pattern | Example |
|---|---|
| `CLB-{INDEX}` | `CLB-001`, `CLB-007` |

## 9. Fault Sample IDs
| Pattern | Example |
|---|---|
| `FLT-{TYPE_CODE}-{INDEX}` | `FLT-VID-01`, `FLT-DET-02` |

---

> **Important**: All schema files, metadata files, detector logs, and event annotations must use IDs drawn from this naming table. Inconsistencies must be treated as validation errors and flagged in the fault sample set.
