"""Tests for data source abstraction layer — factory, composite, mock."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))


CENTER = {"lat": 31.96387, "lon": 35.88957}


def test_factory_builds_detector_primary():
    from data_sources import build_data_source

    config = {
        "data_sources": {"primary": "detector", "fallback_chain": []},
        "paths": {"google_service_account": None},
    }
    source = build_data_source(config)
    assert source is not None
    assert source.is_healthy()


def test_factory_builds_mock_primary():
    from data_sources import build_data_source

    config = {
        "data_sources": {"primary": "mock", "fallback_chain": ["detector"]},
        "paths": {"google_service_account": None},
    }
    source = build_data_source(config)
    assert source is not None
    desc = source.describe()
    assert "primary" in desc


def test_factory_fallback_on_bad_primary():
    from data_sources import build_data_source

    config = {
        "data_sources": {"primary": "nonexistent_source", "fallback_chain": ["detector"]},
        "paths": {"google_service_account": None},
    }
    source = build_data_source(config)
    # Should fall back to detector
    assert source is not None


def test_mock_source_fetch_snapshot():
    from data_sources.mock_source import MockDataSource

    mock = MockDataSource(seed=7)
    snap = mock.fetch_snapshot(CENTER)
    assert snap.source == "mock"
    assert len(snap.approaches) == 4
    for d in ("northbound", "southbound", "eastbound", "westbound"):
        a = snap.approaches[d]
        assert "speed_ratio" in a
        assert "congestion_level" in a
        assert "delay_s" in a
        assert a["delay_s"] >= 0


def test_mock_source_deterministic():
    from data_sources.mock_source import MockDataSource

    m1 = MockDataSource(seed=42)
    m2 = MockDataSource(seed=42)
    s1 = m1.fetch_snapshot(CENTER)
    s2 = m2.fetch_snapshot(CENTER)
    # Same seed → same speed_ratio (approximately, since they share the same datetime)
    for d in ("northbound", "southbound", "eastbound", "westbound"):
        assert abs(s1.approaches[d]["speed_ratio"] - s2.approaches[d]["speed_ratio"]) < 0.01


def test_composite_fallback_chain():
    from data_sources.composite import CompositeDataSource
    from data_sources.mock_source import MockDataSource

    primary = MockDataSource(seed=1)
    fallback = MockDataSource(seed=2)
    composite = CompositeDataSource(primary=primary, fallbacks=[fallback])

    snap = composite.fetch_snapshot(CENTER)
    assert snap is not None
    assert snap.source == "mock"


def test_composite_fusion():
    from data_sources.composite import CompositeDataSource
    from data_sources.mock_source import MockDataSource

    primary = MockDataSource(seed=1)
    fallback = MockDataSource(seed=2)
    composite = CompositeDataSource(
        primary=primary,
        fallbacks=[fallback],
        fusion_enabled=True,
        fusion_weights={"mock": 0.5},
    )

    snap = composite.fetch_snapshot(CENTER)
    assert snap is not None
    # Fused source should combine both
    for d in ("northbound", "southbound", "eastbound", "westbound"):
        assert "speed_ratio" in snap.approaches[d]
