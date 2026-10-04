"""SQLAlchemy persistence models owned by the backend."""
from backend.app.models.base import Base
from backend.app.models.entities import (
    CameraModel,
    DetectionModel,
    EventModel,
    LocationModel,
    ObservationModel,
    SnapshotModel,
)
from backend.app.models.legacy import JSONRecord

__all__ = [
    "Base",
    "CameraModel",
    "DetectionModel",
    "EventModel",
    "JSONRecord",
    "LocationModel",
    "ObservationModel",
    "SnapshotModel",
]
