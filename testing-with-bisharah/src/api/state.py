"""
Shared in-process state between the detection thread and FastAPI.
Both modules import this so they share the same live frame and counts.
"""
import threading
from datetime import datetime

# Latest annotated frame (numpy array), updated by detection loop
latest_frame = None

# Live vehicle counts per direction, updated on every crossing
live_counts = {"North": 0, "South": 0, "East": 0, "West": 0}

# Per-frame live stats: visible, moving, stopped, types, confidence
live_stats = {
    "visible_now":    0,
    "moving":         0,
    "stopped":        0,
    "cars":           0,
    "trucks":         0,
    "buses":          0,
    "motos":          0,
    "session_tracks": 0,
    "avg_confidence": 0.0,
}

# Whether the detection loop is currently running
detection_running = False

# When detection started — used by the smart forecaster to compute elapsed time
# and therefore the current detection rate (vehicles/min per direction).
detection_start_time: datetime | None = None

# Current video position in seconds (frame_num / fps), reset on each loop.
# Used to drive signal phase in sync with video instead of wall clock.
frame_time = 0.0

# Single lock that guards all shared state
lock = threading.Lock()
