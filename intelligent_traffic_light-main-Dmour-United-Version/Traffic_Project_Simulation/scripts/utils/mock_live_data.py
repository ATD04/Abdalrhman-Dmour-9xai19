"""Mock live-data generator for demo / pre-deployment.

Produces a synthetic stream of `SnapshotPayload` rows that mimic Wadi Saqra rush-hour
behaviour. Useful when:
  • The actual live camera/detector feed isn't connected yet.
  • You want repeatable demos for the hackathon judges.
  • You want to test fallback behaviour when Google API is unavailable.

Usage:
    python3 scripts/mock_live_data.py --duration 600 --out app/data/mock_snapshots.json
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

UTC = timezone.utc


def synthetic_snapshot(t: float, seed: int = 7) -> dict:
    """Create a snapshot with realistic diurnal variation."""
    rng = random.Random(seed + int(t))
    # Sinusoidal load with peaks at "rush hours" (8am, 5pm relative to t=0)
    hour_offset = (t % 86400) / 3600.0
    load = 0.4 + 0.45 * math.exp(-((hour_offset - 8) ** 2) / 6) \
                + 0.5 * math.exp(-((hour_offset - 17) ** 2) / 4)
    load = max(0.15, min(1.05, load + rng.uniform(-0.05, 0.05)))

    approaches = {}
    for direction, weight in (
        ("northbound", 1.0),
        ("southbound", 1.1),
        ("eastbound", 0.85),
        ("westbound", 1.15),
    ):
        speed_ratio = max(0.18, 1.0 - load * weight * 0.7)
        delay = round((1.0 - speed_ratio) * 120, 1)
        congestion = (
            "free" if speed_ratio >= 0.85 else
            "light" if speed_ratio >= 0.65 else
            "moderate" if speed_ratio >= 0.45 else
            "heavy" if speed_ratio >= 0.25 else "severe"
        )
        approaches[direction] = {
            "speed_ratio": round(speed_ratio, 2),
            "avg_speed_kmh": round(35 * speed_ratio, 1),
            "free_flow_speed_kmh": 35.0,
            "delay_s": delay,
            "delay_ratio": round(1.0 - speed_ratio, 2),
            "congestion_level": congestion,
            "polyline": [],
            "traffic_segments": [],
            "normal_share": round(speed_ratio, 2),
            "slow_share": round(min(0.4, (1 - speed_ratio) * 0.6), 2),
            "jam_share": round(min(0.4, (1 - speed_ratio) * 0.4), 2),
        }
    return {
        "timestamp": (datetime.now(UTC) + timedelta(seconds=t)).isoformat(timespec="seconds"),
        "source": "mock_live",
        "center": {"lat": 31.96387, "lon": 35.88957},
        "approaches": approaches,
        "metadata": {"load_factor": round(load, 2)},
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--duration", type=int, default=600, help="seconds to generate")
    parser.add_argument("--step", type=int, default=30, help="snapshot interval (seconds)")
    parser.add_argument("--out", default="app/data/mock_snapshots.json")
    args = parser.parse_args()

    snapshots = []
    for t in range(0, args.duration, args.step):
        snapshots.append(synthetic_snapshot(float(t)))

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(snapshots, indent=2))
    print(f"Wrote {len(snapshots)} mock snapshots to {out_path}")


if __name__ == "__main__":
    main()
