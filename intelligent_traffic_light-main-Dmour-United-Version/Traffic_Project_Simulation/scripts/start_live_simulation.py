#!/usr/bin/env python3
"""Compatibility wrapper for the live simulation server entrypoint."""

from __future__ import annotations

import sys
from pathlib import Path

SCRIPTS_ROOT = Path(__file__).resolve().parent
if str(SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_ROOT))

from core.start_live_simulation import main  # noqa: E402


if __name__ == "__main__":
    main()
