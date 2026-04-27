# Open Source Components & Licenses

**Project:** Wadi Saqra Intelligent Traffic Light v3.0  
**Date:** April 2026  
**Purpose:** Full disclosure of dependencies and licensing compliance

---

## Python Core Dependencies

### Runtime Environment
- **Python 3.9+** — [PSF License](https://www.python.org/psf/licenses/)
  - Used for: Backend scripting, data processing, server
  - Version tested: Python 3.11

### Web Framework & HTTP
- **Flask 2.3+** — [BSD 3-Clause](https://github.com/pallets/flask/blob/main/LICENSE.rst)
  - Used for: REST API endpoints, web server basics
  - Alternative: Could use FastAPI in Phase 4

- **Werkzeug** (Flask dependency) — [BSD 3-Clause](https://github.com/pallets/werkzeug/blob/main/LICENSE.rst)
  - Used for: WSGI utilities, HTTP handling

### Data Processing & ML

- **Pandas 1.5+** — [BSD 3-Clause](https://pandas.pydata.org/about/license.html)
  - Used for: Time series data loading, detector CSV processing
  - Classes: DataFrame, Series, read_csv

- **NumPy 1.23+** — [BSD 3-Clause](https://numpy.org/license.html)
  - Used for: Numerical arrays, statistical calculations
  - Dependency of Pandas & scikit-learn

- **scikit-learn 1.1+** — [BSD 3-Clause](https://github.com/scikit-learn/scikit-learn/blob/main/COPYING)
  - Used for: HistGradientBoosting forecasting model, Isolation Forest anomaly detection
  - Classes: HistGradientBoostingRegressor, IsolationForest

### Database

- **SQLite 3** — [Public Domain](https://www.sqlite.org/copyright.html)
  - Used for: Persistent event/observation logging
  - File format: Standard SQLite, portable across platforms

### Traffic Simulation

- **SUMO (Simulation of Urban Mobility)** — [EPL 2.0](https://github.com/eclipse-sumo/sumo/blob/main/LICENSE)
  - Used for: Microsimulation engine, vehicle positions, traffic dynamics
  - Version: 1.26+
  - Interface: TraCI (Python bindings)

- **libsumo** (SUMO Python bindings) — [EPL 2.0](https://github.com/eclipse-sumo/sumo/blob/main/LICENSE)
  - Used for: Remote control of SUMO simulation
  - Installation: Included with SUMO binary distribution

### Computer Vision

- **OpenCV 4.5+** — [Apache 2.0](https://github.com/opencv/opencv/blob/master/LICENSE)
  - Used for: Video file handling, frame extraction, image processing
  - Classes: cv2.VideoCapture, cv2.cvtColor, cv2.resize

- **Ultralytics YOLOv8** — [AGPL 3.0](https://github.com/ultralytics/ultralytics/blob/main/LICENSE)
  - Used for: Object detection in video analytics
  - Model: yolo26x.pt (113 MB pre-trained weights)
  - Note: AGPL requires source disclosure for modified derivatives

- **PyYAML 6.0+** — [MIT](https://github.com/yaml/pyyaml/blob/master/LICENSE)
  - Used for: Configuration file parsing
  - Dependency of Ultralytics YOLO

### External APIs

- **Google Routes API v2** — [Google Terms of Service](https://cloud.google.com/maps-platform/terms)
  - Used for: Real-time traffic speed data
  - Authentication: API key in config/google_service_account.local.json
  - Fallback: Detector data used if API unavailable

- **Requests 2.28+** — [Apache 2.0](https://github.com/psf/requests/blob/main/LICENSE)
  - Used for: HTTP requests to Google Routes API
  - Classes: requests.get, requests.post

### Utilities

- **Logging (stdlib)** — [PSF License](https://www.python.org/psf/licenses/)
  - Used for: Application logging

- **JSON (stdlib)** — [PSF License](https://www.python.org/psf/licenses/)
  - Used for: API serialization

- **Datetime (stdlib)** — [PSF License](https://www.python.org/psf/licenses/)
  - Used for: Timestamp handling

- **UUID (stdlib)** — [PSF License](https://www.python.org/psf/licenses/)
  - Used for: Event ID generation

---

## Frontend Dependencies

### JavaScript (Browser)

- **Vanilla JavaScript (ES6+)** — No license required
  - Used for: Dashboard logic, API calls, real-time updates
  - No external JS frameworks (intentionally lightweight)

- **Server-Sent Events (SSE)** — [W3C Standard](https://html.spec.whatwg.org/multipage/server-sent-events.html)
  - Used for: Real-time streaming of system state

- **Fetch API** — [W3C Standard](https://fetch.spec.whatwg.org/)
  - Used for: HTTP requests to backend APIs

- **HTML5 Canvas API** — [W3C Standard](https://html.spec.whatwg.org/multipage/canvas.html)
  - Used for: Map rendering, vehicle visualization

### CSS

- **CSS3** — [W3C Standard](https://www.w3.org/Style/CSS/)
  - Used for: Dashboard styling, responsive design
  - No external CSS framework (inline styles in index.css)

### Browser APIs

- **LocalStorage** — [W3C Standard](https://html.spec.whatwg.org/multipage/webstorage.html)
  - Used for: Dashboard preferences (theme, zoom level)

---

## Development & Testing

### Test Framework (Phase 3 Validation)
- **unittest (stdlib)** — [PSF License](https://www.python.org/psf/licenses/)
  - Used for: Test case structure and assertions

### Build & Packaging

- **pip** — [MIT](https://github.com/pypa/pip/blob/main/LICENSE.txt)
  - Used for: Python package installation

- **setuptools (stdlib)** — [MIT](https://github.com/pypa/setuptools/blob/main/LICENSE)
  - Used for: Package metadata

---

## Optional Phase 4+ Dependencies

### Real-Time Video Streaming
- **FFMPEG** — [LGPL 2.1](https://ffmpeg.org/legal.html) + [Proprietary codecs](https://en.wikipedia.org/wiki/Comparison_of_video_container_formats)
  - Used for: RTSP stream decoding
  - Not yet integrated (Phase 4)

### Cloud Deployment
- **FastAPI** — [MIT](https://github.com/tiangolo/fastapi/blob/master/LICENSE)
  - Planned alternative to Flask for Phase 4
  
- **SQLAlchemy** — [MIT](https://github.com/sqlalchemy/sqlalchemy/blob/main/LICENSE)
  - Planned ORM for cloud database (PostgreSQL)

- **PostgreSQL** — [PostgreSQL License](https://www.postgresql.org/about/licence/) (permissive, BSD-like)
  - Planned for Phase 4 cloud deployment

### Container & Orchestration (Phase 4+)
- **Docker** — [Apache 2.0](https://www.docker.com/legal/docker-software-license)
  - Planned for containerization

- **Kubernetes** — [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0)
  - Planned for orchestration in Phase 4+

---

## License Compatibility Analysis

### Permissive Licenses (No Restrictions on Proprietary Use)
- ✅ Python (PSF License)
- ✅ SQLite (Public Domain)
- ✅ NumPy, Pandas, scikit-learn (BSD 3-Clause)
- ✅ Flask, Werkzeug (BSD 3-Clause)
- ✅ OpenCV (Apache 2.0)
- ✅ Requests (Apache 2.0)
- ✅ SUMO/libsumo (EPL 2.0 — permissive copyleft, compatible with most licenses)

### Copyleft Licenses (Source Sharing Required for Modifications)
- ⚠️ **Ultralytics YOLO (AGPL 3.0)** — Requires source disclosure if modified
  - **Current Use:** Unmodified pre-trained model, no source required
  - **If Modified:** Must release modified source code under AGPL
  - **Recommendation for Phase 4:** Document any YOLO modifications under AGPL or replace with MIT-licensed alternative

### Google APIs (Cloud Services)
- 📋 **Google Routes API** — Subject to Google Cloud Terms
  - Requires API key authentication
  - Usage-based billing
  - No source code requirement

---

## Dependency Tree

```
Wadi Saqra v3.0
├── Python 3.11 (PSF)
├── Flask 2.3+ (BSD)
│   └── Werkzeug (BSD)
├── Data Processing
│   ├── Pandas 1.5+ (BSD)
│   │   └── NumPy 1.23+ (BSD)
│   └── scikit-learn 1.1+ (BSD)
├── Database
│   └── SQLite 3 (Public Domain)
├── Traffic Simulation
│   ├── SUMO 1.26+ (EPL 2.0)
│   └── libsumo (EPL 2.0)
├── Computer Vision
│   ├── OpenCV 4.5+ (Apache 2.0)
│   ├── Ultralytics YOLO (AGPL 3.0)
│   └── PyYAML 6.0+ (MIT)
├── APIs
│   ├── Google Routes v2 (Google ToS)
│   └── Requests 2.28+ (Apache 2.0)
├── Frontend
│   ├── HTML5 Canvas (W3C)
│   ├── Fetch API (W3C)
│   ├── SSE (W3C)
│   └── LocalStorage (W3C)
└── Testing
    └── unittest (PSF)
```

---

## License Compliance Summary

| License Type | Count | Projects | Commercial Use |
|---|---|---|---|
| **Permissive (BSD/Apache/MIT/PSF)** | 12 | Python, Flask, NumPy, Pandas, scikit-learn, OpenCV, Requests, SUMO, SQLite | ✅ Allowed |
| **Public Domain** | 1 | SQLite | ✅ Allowed |
| **Copyleft (EPL 2.0)** | 2 | SUMO, libsumo | ✅ Allowed with disclosure |
| **Copyleft (AGPL)** | 1 | Ultralytics YOLO | ⚠️ Check if modified |

**Verdict:** ✅ **COMPLIANT for Phase 3 commercial deployment**
- All core dependencies allow commercial use
- YOLO AGPL applies only if model weights are modified
- Recommend documenting all dependencies in production release

---

## Installation Verification

All dependencies installed via `requirements-live.txt`:

```bash
# Python dependencies
pip install -r requirements-live.txt

# SUMO must be installed separately (macOS):
# Download from https://sumo.dlr.de/docs/Downloads.php
# Or via Homebrew: brew install sumo
```

**Verification:**
```bash
python3 -c "import pandas, sklearn, cv2, yaml; print('All deps OK')"
sumo --version  # Should show SUMO 1.26+
```

---

## Attribution & Credits

### Core Contributors
- **SUMO Team** (DLR Institute of Transportation) — Microsimulation engine
- **OpenCV Team** (Intel & community) — Computer vision
- **Ultralytics** — YOLOv8 pre-trained models
- **Scikit-learn Team** — ML algorithms
- **Pandas Team** — Data processing

### Data Sources
- **Wadi Saqra Detector Network** — Historical traffic counts (22 sensors)
- **Google Routes API** — Real-time traffic speeds
- **Field Video Footage** — YOLO training/validation data

---

## Recommendations for Production

1. **License Review:** Have legal counsel review AGPL compliance before deployment
2. **Dependency Pinning:** Pin versions in `requirements-live.txt` for reproducibility
3. **Vulnerability Scanning:** Regular scans with `pip-audit` or similar
4. **Bill of Materials:** Maintain this document as dependencies change
5. **Open Source Policy:** Establish internal policy on AGPL use

---

**Last Updated:** April 2026  
**Compliance Status:** ✅ Phase 3 Ready  
**Next Review:** Before Phase 4 deployment
