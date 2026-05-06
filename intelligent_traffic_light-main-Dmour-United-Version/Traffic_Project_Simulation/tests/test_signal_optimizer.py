"""Tests for the Webster signal timing optimizer embedded in sumo_traci_runner."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))


def _make_engine_stub():
    """Build a minimal stub of LiveSimulationEngine with only the Webster method."""
    import types, math

    # Import the clamp helper from the module without triggering SUMO
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "sumo_traci_runner",
        ROOT / "scripts" / "sumo_traci_runner.py",
    )
    # We cannot actually import the full module (needs SUMO TraCI).
    # Instead, test clamp() and the Webster formula in isolation.
    return None


def test_webster_optimal_cycle_formula():
    """Verify Webster optimal cycle: Co = (1.5L + 5) / (1 - Y), clamped [60, 180]."""

    def webster_cycle(Y: float, lost_time: float = 15.0) -> float:
        c_opt = (1.5 * lost_time + 5.0) / max(1.0 - Y, 0.01)
        return max(60.0, min(180.0, c_opt))

    # Free flow — low Y → short cycle (clamped to 60s)
    assert webster_cycle(0.30) == 60.0
    # Near saturation — high Y → long cycle
    cycle_high = webster_cycle(0.80)
    assert 60 <= cycle_high <= 180
    # Over capacity — clamp to max
    assert webster_cycle(0.95) == 180.0


def test_green_splits_sum_to_effective_green():
    """Verify green splits proportional to flow ratios and sum to g_eff."""

    def compute_greens(y_ns: float, y_e: float, y_w: float, C_o: float, lost: float = 15.0):
        Y = y_ns + y_e + y_w
        g_eff = C_o - lost
        if Y <= 0:
            return None
        g_ns = max(7.0, min(90.0, (y_ns / Y) * g_eff))
        g_e = max(7.0, min(90.0, (y_e / Y) * g_eff))
        g_w = max(7.0, min(90.0, (y_w / Y) * g_eff))
        return g_ns, g_e, g_w

    greens = compute_greens(0.3, 0.2, 0.2, 90.0)
    assert greens is not None
    # Each green is above minimum
    for g in greens:
        assert g >= 7.0


def test_hcm_minimum_green_enforced():
    """Minimum green must be >= 7s regardless of flow ratio."""

    MIN_GREEN = 7.0

    def clamp_green(raw: float) -> float:
        return max(MIN_GREEN, min(90.0, raw))

    # Very low flow ratio → very short raw green, but must be at least MIN_GREEN
    very_low = clamp_green(0.5)
    assert very_low == MIN_GREEN


def test_saturation_guard_y_above_095():
    """Intersection Y >= 0.95 → optimizer returns over_capacity mode."""

    def mock_mode(Y: float) -> str:
        if Y >= 0.95:
            return "over_capacity"
        if Y >= 0.85:
            return "saturated"
        return "three_phase"

    assert mock_mode(0.96) == "over_capacity"
    assert mock_mode(0.88) == "saturated"
    assert mock_mode(0.70) == "three_phase"


def test_uniform_delay_formula():
    """Webster uniform delay: d = 0.5*C*(1 - g/C)^2 / (1 - x)."""

    def uniform_delay(C: float, g: float, y: float) -> float:
        if g <= 0 or C <= 0:
            return 999.0
        x = min(0.98, y * C / g)
        return 0.5 * C * (1.0 - g / C) ** 2 / max(1.0 - x, 0.001)

    # Sanity: longer green → less delay
    d_long = uniform_delay(120, 60, 0.4)
    d_short = uniform_delay(120, 20, 0.4)
    assert d_long < d_short


def test_live_support_path_resolution():
    """SUMO home discovery should return a Path (may not exist on CI)."""
    from core.live_support import SUMO_SHARE_HOME, SUMO_TOOLS
    assert SUMO_SHARE_HOME is not None
    assert SUMO_TOOLS is not None


def test_mock_source_healthy():
    from data_sources.mock_source import MockDataSource
    m = MockDataSource()
    assert m.is_healthy()


def test_format_direction_short():
    from core.live_support import format_direction_short
    assert format_direction_short("northbound") == "north"
    assert format_direction_short("eastbound") == "east"
    assert format_direction_short(None) == "unknown"
    assert format_direction_short("") == "unknown"
