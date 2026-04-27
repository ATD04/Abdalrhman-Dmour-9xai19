@echo off
REM Wadi Saqra Live Digital Twin — one-click launcher (Windows)

cd /d "%~dp0"

REM Activate venv if present, otherwise fall back to system Python
IF EXIST ".venv\Scripts\python.exe" (
    echo Using virtualenv: .venv\Scripts\python.exe
    .venv\Scripts\python.exe scripts\start_live_simulation.py --open
) ELSE IF EXIST "..\venv\Scripts\python.exe" (
    echo Using virtualenv: ..\venv\Scripts\python.exe
    ..\venv\Scripts\python.exe scripts\start_live_simulation.py --open
) ELSE (
    echo No virtualenv found -- using system Python.
    echo Run: pip install -r requirements-live.txt  if dependencies are missing.
    python scripts\start_live_simulation.py --open
)
