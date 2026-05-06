"""Data source abstraction layer.

Each source implements `fetch_snapshot()` returning the same approach-level schema
that GoogleTrafficFetcher already produces. Sources can be swapped or fused without
touching the simulation engine.
"""

from .base import DataSource, SnapshotPayload
from .composite import CompositeDataSource
from .detector_source import DetectorDataSource
from .google_source import GoogleDataSource
from .mock_source import MockDataSource
from .video_source import VideoDataSource
from .factory import build_data_source

__all__ = [
    "DataSource",
    "SnapshotPayload",
    "CompositeDataSource",
    "DetectorDataSource",
    "GoogleDataSource",
    "MockDataSource",
    "VideoDataSource",
    "build_data_source",
]
