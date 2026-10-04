"""Application service boundary between HTTP routes and persistence."""
from __future__ import annotations

from typing import Any

from shared.models import Camera, CameraObservation, Detection, Incident, TransportObservation

from backend.app.database.repository import Repository
from backend.app.services.images import ImageMetadataStore


class ResourceNotFound(Exception):
    """Raised when a requested record or required parent is absent."""


class SentinelXService:
    def __init__(self, repository: Repository, images: ImageMetadataStore) -> None:
        self.repository = repository
        self.images = images

    def list(self, kind: str) -> list[dict[str, Any]]:
        return self.repository.list(kind)

    def get(self, kind: str, item_id: str, label: str) -> dict[str, Any]:
        item = self.repository.get(kind, item_id)
        if item is None:
            raise ResourceNotFound(f"{label} not found")
        return item

    def camera_observations(self, camera_id: str) -> list[dict[str, Any]]:
        self.get("cameras", camera_id, "Camera")
        return [item for item in self.list("observations") if item["camera_id"] == camera_id]

    def map_data(self) -> dict[str, list[dict[str, Any]]]:
        return {kind: self.list(kind) for kind in ("cameras", "incidents", "transport")}

    def save(self, kind: str, item: Camera | CameraObservation | Detection | Incident | TransportObservation) -> dict[str, Any]:
        if isinstance(item, CameraObservation):
            self.get("cameras", item.camera_id, "Camera")
            self.images.put(item.id, {"image_url": item.image_url, "timestamp": item.timestamp.isoformat(), "camera_id": item.camera_id})
        elif isinstance(item, Detection):
            self.get("observations", item.observation_id, "Observation")
        return self.repository.upsert(kind, item)
