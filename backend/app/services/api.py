"""Application service boundary between HTTP routes and persistence."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from shared.models import Camera, CameraObservation, Detection, Incident, Location, TransportObservation

from backend.app.database.repository import Repository
from backend.app.services.images import ImageMetadataStore, SnapshotFileStore


class ResourceNotFound(Exception):
    """Raised when a requested record or required parent is absent."""


class SentinelXService:
    def __init__(
        self,
        repository: Repository,
        images: ImageMetadataStore,
        snapshot_files: SnapshotFileStore,
    ) -> None:
        self.repository = repository
        self.images = images
        self.snapshot_files = snapshot_files

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

    def upload_snapshot(
        self,
        camera_id: str,
        captured_at: datetime,
        contents: bytes,
        image_url: str,
    ) -> dict[str, Any]:
        camera = self.get("cameras", camera_id, "Camera")
        if captured_at.tzinfo is None or captured_at.utcoffset() is None:
            raise ValueError("captured_at must include a timezone")

        observation_id = f"obs_{uuid4().hex}"
        snapshot_id = image_url.rstrip("/").rsplit("/", 1)[-1]
        observation = CameraObservation(
            id=observation_id,
            camera_id=camera_id,
            timestamp=captured_at,
            image_url=image_url,
            location=Location.model_validate(camera["location"]),
        )

        stored_file = self.snapshot_files.save(snapshot_id, contents)
        snapshot = {
            "id": snapshot_id,
            "observation_id": observation_id,
            **stored_file,
            "image_url": image_url,
            "uploaded_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }
        try:
            self.repository.save_snapshot(observation, snapshot)
        except Exception:
            self.snapshot_files.delete(stored_file["storage_key"])
            raise
        return observation.model_dump(mode="json")

    def snapshot_file(self, snapshot_id: str) -> tuple[dict[str, Any], Path]:
        snapshot = self.repository.get_snapshot(snapshot_id)
        if snapshot is None:
            raise ResourceNotFound("Snapshot not found")
        path = self.snapshot_files.path_for(snapshot["storage_key"])
        if path is None:
            raise ResourceNotFound("Snapshot file not found")
        return snapshot, path

    def save(self, kind: str, item: Camera | CameraObservation | Detection | Incident | TransportObservation) -> dict[str, Any]:
        if isinstance(item, CameraObservation):
            self.get("cameras", item.camera_id, "Camera")
            self.images.put(item.id, {"image_url": item.image_url, "timestamp": item.timestamp.isoformat(), "camera_id": item.camera_id})
        elif isinstance(item, Detection):
            self.get("observations", item.observation_id, "Observation")
        return self.repository.upsert(kind, item)
