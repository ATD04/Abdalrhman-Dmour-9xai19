# Phase 3: Technical Handover Package

## 1. System Components
The following core modules constitute the Phase 3 Intelligence Build:
- **`sumo_traci_runner.py`**: The central orchestration engine.
- **`stream_processor.py`**: Video ingestion with auto-reconnect.
- **`acquisition.py`**: Data normalization and validation.
- **`flow_forecaster.py`**: Multi-horizon predictive engine.
- **`storage_manager.py`**: Relational and JSONL logging.
- **`app/`**: Bilingual web dashboard (HTML/JS/CSS).

## 2. Installation & Execution
1. Ensure SUMO and Python 3.10+ are installed.
2. Run `./start_simulation.command` to initialize the engine and server.
3. Access the dashboard at `http://localhost:8000`.

## 3. Configuration
- Signal timings: `scripts/data_sources/signal_source.py`
- Google API keys: (Optional) Configured in `config.py`
- Forecast horizons: Hardcoded to 15, 30, and 60 minutes.

## 4. Operational Protocols
- **Decision Support**: Signal recommendations (Webster) must be verified by a human operator before implementation.
- **Incident Response**: Critical alerts (Red) in the dashboard trigger an event log entry in `traffic_data.db`.
- **System Health**: If FPS drops below 5.0, check network connectivity to field cameras.

## 5. Technical Support
This system was built for the 9XAI Hackathon. All code is documented within the source files. For database access, use any SQLite viewer on `traffic_data.db`.
