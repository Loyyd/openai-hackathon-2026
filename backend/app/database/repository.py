"""Repository implementations; routes depend only on the storage protocol."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Protocol
from pathlib import Path

from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

# Import entities so their tables are registered before Base.metadata.create_all().
from backend.app.models import (
    Base,
    CameraModel,
    DetectionModel,
    EventModel,
    JSONRecord,
    LocationModel,
    ObservationModel,
    SnapshotModel,
)
from shared.demo import CAMERAS, INCIDENTS, OBSERVATIONS, TRANSPORT
from shared.models import Camera, CameraObservation, Detection, Incident, TransportObservation

Model = Camera | CameraObservation | Detection | Incident | TransportObservation


class Repository(Protocol):
    def list(self, kind: str) -> list[dict[str, Any]]: ...
    def get(self, kind: str, item_id: str) -> dict[str, Any] | None: ...
    def upsert(self, kind: str, item: Model) -> dict[str, Any]: ...
    def save_snapshot(self, observation: CameraObservation, snapshot: dict[str, Any]) -> None: ...
    def get_snapshot(self, snapshot_id: str) -> dict[str, Any] | None: ...
    def get_record(self, kind: str, item_id: str) -> dict | None: ...
    def records(self, kind: str, camera_id: str | None = None) -> list[dict]: ...
    def count_records(self, kind: str) -> int: ...
    def put_record(self, kind: str, item_id: str, payload: dict) -> None: ...
    def complete_analysis(self, detections: list[Detection], incidents: list[Incident], records: list[tuple[str, str, dict]]) -> None: ...


class MemoryRepository:
    def __init__(self, seed: bool = True) -> None:
        self._items: dict[str, dict[str, dict[str, Any]]] = {}
        self._snapshots: dict[str, dict[str, Any]] = {}
        self._records: dict[tuple[str, str], dict] = {}
        if seed:
            for kind, records in (("cameras", CAMERAS), ("observations", OBSERVATIONS), ("incidents", INCIDENTS), ("transport", TRANSPORT)):
                for record in records:
                    self.upsert(kind, record)

    def list(self, kind: str) -> list[dict[str, Any]]:
        return list(self._items.get(kind, {}).values())

    def get(self, kind: str, item_id: str) -> dict[str, Any] | None:
        return self._items.get(kind, {}).get(item_id)

    def upsert(self, kind: str, item: Model) -> dict[str, Any]:
        payload = item.model_dump(mode="json")
        self._items.setdefault(kind, {})[payload["id"]] = payload
        return payload

    def save_snapshot(self, observation: CameraObservation, snapshot: dict[str, Any]) -> None:
        self.upsert("observations", observation)
        camera = self._items["cameras"][observation.camera_id]
        if observation.timestamp >= datetime.fromisoformat(camera["last_updated"].replace("Z", "+00:00")):
            camera["image_url"] = snapshot["image_url"]
            camera["last_updated"] = observation.timestamp.isoformat().replace("+00:00", "Z")
        self._snapshots[snapshot["id"]] = dict(snapshot)

    def get_snapshot(self, snapshot_id: str) -> dict[str, Any] | None:
        return self._snapshots.get(snapshot_id)


    def get_record(self, kind, item_id):
        return self._records.get((kind, item_id))

    def records(self, kind, camera_id=None):
        return [value for (key, _), value in self._records.items() if key == kind and (camera_id is None or value.get("camera_id") == camera_id)]

    def count_records(self, kind):
        return len(self.records(kind))

    def put_record(self, kind, item_id, payload):
        self._records[(kind, item_id)] = payload

    def complete_analysis(self, detections, incidents, records):
        for item in detections:
            self.upsert("detections", item)
        for item in incidents:
            self.upsert("incidents", item)
        for kind, item_id, payload in records:
            self.put_record(kind, item_id, payload)


class SQLAlchemyRepository:
    def __init__(self, database_url: str, seed: bool = True) -> None:
        options: dict[str, Any] = {"pool_pre_ping": True}
        if database_url in ("sqlite://", "sqlite:///:memory:"):
            options.update(connect_args={"check_same_thread": False}, poolclass=StaticPool)
        self.engine = create_engine(database_url, **options)
        Base.metadata.create_all(self.engine)
        self._migrate_legacy()
        if seed:
            self._seed()

    def _migrate_legacy(self) -> None:
        """Copy pre-PR7 JSON rows once, without overwriting newer typed records."""
        contracts = {"cameras": Camera, "observations": CameraObservation,
                     "detections": Detection, "incidents": Incident}
        with Session(self.engine) as session, session.begin():
            for kind, contract in contracts.items():
                for legacy in session.scalars(select(JSONRecord).where(JSONRecord.kind == kind)).all():
                    if session.get(self._model_for(kind), legacy.id) is None:
                        payload = contract.model_validate(legacy.payload).model_dump(mode="json")
                        if "location" in payload:
                            location = session.get(LocationModel, payload["location"]["id"])
                            if location is not None:
                                payload["location"] = self._location_payload(location)
                        self._upsert_typed(session, kind, payload)
                session.flush()

    def _seed(self) -> None:
        with Session(self.engine) as session:
            record_models = (
                CameraModel,
                ObservationModel,
                DetectionModel,
                EventModel,
                JSONRecord,
            )
            has_records = any(
                session.scalar(select(model.id).limit(1)) is not None
                for model in record_models
            )
            if has_records:
                return
        for kind, records in (
            ("cameras", CAMERAS),
            ("observations", OBSERVATIONS),
            ("incidents", INCIDENTS),
            ("transport", TRANSPORT),
        ):
            for record in records:
                self.upsert(kind, record)

    def list(self, kind: str) -> list[dict[str, Any]]:
        with Session(self.engine) as session:
            if kind == "transport":
                rows = session.scalars(
                    select(JSONRecord).where(JSONRecord.kind == kind)
                ).all()
                return [row.payload for row in rows]

            model = self._model_for(kind)
            rows = session.scalars(select(model)).all()
            return [self._to_payload(kind, row) for row in rows]

    def get(self, kind: str, item_id: str) -> dict[str, Any] | None:
        with Session(self.engine) as session:
            if kind == "transport":
                row = session.get(JSONRecord, (kind, item_id))
                return row.payload if row else None

            model = self._model_for(kind)
            row = session.get(model, item_id)
            return self._to_payload(kind, row) if row else None

    def upsert(self, kind: str, item: Model) -> dict[str, Any]:
        payload = item.model_dump(mode="json")
        with Session(self.engine) as session, session.begin():
            if kind == "transport":
                row = session.get(JSONRecord, (kind, payload["id"]))
                if row is None:
                    row = JSONRecord(kind=kind, id=payload["id"], payload=payload)
                    session.add(row)
                else:
                    row.payload = payload
            else:
                row = self._upsert_typed(session, kind, payload)
        return payload

    def save_snapshot(self, observation: CameraObservation, snapshot: dict[str, Any]) -> None:
        observation_payload = observation.model_dump(mode="json")
        with Session(self.engine) as session, session.begin():
            self._upsert_typed(session, "observations", observation_payload)
            camera = session.get(CameraModel, observation.camera_id)
            if camera is None:
                raise ValueError("Camera must exist before storing a snapshot")
            if observation.timestamp >= self._as_aware(camera.last_updated):
                camera.image_url = snapshot["image_url"]
                camera.last_updated = observation.timestamp
            row = session.get(SnapshotModel, snapshot["id"])
            is_new = row is None
            if row is None:
                row = SnapshotModel(id=snapshot["id"])
            row.observation_id = snapshot["observation_id"]
            row.storage_key = snapshot["storage_key"]
            row.content_type = snapshot["content_type"]
            row.size_bytes = snapshot["size_bytes"]
            row.uploaded_at = datetime.fromisoformat(snapshot["uploaded_at"].replace("Z", "+00:00"))
            if is_new:
                session.add(row)

    def get_snapshot(self, snapshot_id: str) -> dict[str, Any] | None:
        with Session(self.engine) as session:
            row = session.get(SnapshotModel, snapshot_id)
            if row is None:
                return None
            return {
                "id": row.id,
                "observation_id": row.observation_id,
                "storage_key": row.storage_key,
                "content_type": row.content_type,
                "size_bytes": row.size_bytes,
                "uploaded_at": self._as_iso_utc(row.uploaded_at),
            }

    def get_record(self, kind, item_id):
        with Session(self.engine) as session:
            row = session.get(JSONRecord, (kind, item_id))
            return row.payload if row else None

    def records(self, kind, camera_id=None):
        with Session(self.engine) as session:
            query = select(JSONRecord).where(JSONRecord.kind == kind)
            if camera_id is not None:
                query = query.where(JSONRecord.payload["camera_id"].as_string() == camera_id)
            return [row.payload for row in session.scalars(query).all()]

    def count_records(self, kind):
        with Session(self.engine) as session:
            return session.scalar(select(func.count()).select_from(JSONRecord).where(JSONRecord.kind == kind))

    @staticmethod
    def _put_record(session, kind, item_id, payload):
        row = session.get(JSONRecord, (kind, item_id))
        if row is None:
            session.add(JSONRecord(kind=kind, id=item_id, payload=payload))
        else:
            row.payload = payload

    def put_record(self, kind, item_id, payload):
        with Session(self.engine) as session, session.begin():
            self._put_record(session, kind, item_id, payload)

    def complete_analysis(self, detections, incidents, records):
        # Results, fingerprints and the completion marker commit together.
        with Session(self.engine) as session, session.begin():
            for item in detections:
                self._upsert_typed(session, "detections", item.model_dump(mode="json"))
            for item in incidents:
                self._upsert_typed(session, "incidents", item.model_dump(mode="json"))
            for kind, item_id, payload in records:
                self._put_record(session, kind, item_id, payload)

    @staticmethod
    def _model_for(kind: str):
        models = {
            "cameras": CameraModel,
            "observations": ObservationModel,
            "detections": DetectionModel,
            "incidents": EventModel,
        }
        try:
            return models[kind]
        except KeyError as exc:
            raise ValueError(f"Unsupported repository resource: {kind}") from exc

    @staticmethod
    def _save_location(session: Session, payload: dict[str, Any]) -> LocationModel:
        row = session.get(LocationModel, payload["id"])
        if row is None:
            row = LocationModel(id=payload["id"])
            session.add(row)
        row.name = payload["name"]
        row.latitude = payload["latitude"]
        row.longitude = payload["longitude"]
        return row

    def _upsert_typed(self, session: Session, kind: str, payload: dict[str, Any]):
        model = self._model_for(kind)
        row = session.get(model, payload["id"])
        is_new = row is None
        if row is None:
            row = model(id=payload["id"])

        if kind == "cameras":
            location = self._save_location(session, payload["location"])
            row.provider = payload["provider"]
            row.name = payload["name"]
            row.location = location
            row.image_url = payload["image_url"]
            row.last_updated = datetime.fromisoformat(payload["last_updated"].replace("Z", "+00:00"))
        elif kind == "observations":
            location = self._save_location(session, payload["location"])
            row.camera_id = payload["camera_id"]
            row.location = location
            row.timestamp = datetime.fromisoformat(payload["timestamp"].replace("Z", "+00:00"))
            row.image_url = payload["image_url"]
        elif kind == "detections":
            row.observation_id = payload["observation_id"]
            row.type = payload["type"]
            row.confidence = payload["confidence"]
            row.label = payload["label"]
            row.details = payload["metadata"]
        elif kind == "incidents":
            location = self._save_location(session, payload["location"])
            row.type = payload["type"]
            row.title = payload["title"]
            row.description = payload["description"]
            row.severity = payload["severity"]
            row.confidence = payload["confidence"]
            row.location = location
            row.camera_ids = payload["camera_ids"]
            row.related_observation_ids = payload["related_observation_ids"]
            row.first_seen = datetime.fromisoformat(payload["first_seen"].replace("Z", "+00:00"))
            row.last_seen = datetime.fromisoformat(payload["last_seen"].replace("Z", "+00:00"))
            row.status = payload["status"]
            row.details = payload["metadata"]
        if is_new:
            session.add(row)
        return row

    @staticmethod
    def _as_aware(value: datetime) -> datetime:
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

    @classmethod
    def _as_iso_utc(cls, value: datetime) -> str:
        return cls._as_aware(value).isoformat().replace("+00:00", "Z")

    def _to_payload(self, kind: str, row: Any) -> dict[str, Any]:
        if kind == "cameras":
            return {
                "id": row.id,
                "provider": row.provider,
                "name": row.name,
                "location": self._location_payload(row.location),
                "image_url": row.image_url,
                "last_updated": self._as_iso_utc(row.last_updated),
            }
        if kind == "observations":
            return {
                "id": row.id,
                "camera_id": row.camera_id,
                "timestamp": self._as_iso_utc(row.timestamp),
                "image_url": row.image_url,
                "location": self._location_payload(row.location),
            }
        if kind == "detections":
            return {
                "id": row.id,
                "observation_id": row.observation_id,
                "type": row.type,
                "confidence": row.confidence,
                "label": row.label,
                "metadata": row.details,
            }
        if kind == "incidents":
            return {
                "id": row.id,
                "type": row.type,
                "title": row.title,
                "description": row.description,
                "severity": row.severity,
                "confidence": row.confidence,
                "location": self._location_payload(row.location),
                "camera_ids": row.camera_ids,
                "related_observation_ids": row.related_observation_ids,
                "first_seen": self._as_iso_utc(row.first_seen),
                "last_seen": self._as_iso_utc(row.last_seen),
                "status": row.status,
                "metadata": row.details,
            }
        raise ValueError(f"Unsupported repository resource: {kind}")

    @staticmethod
    def _location_payload(location: LocationModel) -> dict[str, Any]:
        return {
            "id": location.id,
            "name": location.name,
            "latitude": location.latitude,
            "longitude": location.longitude,
        }


def make_repository(database_url: str | None = None) -> Repository:
    """Use persistent storage without inserting fixture data into the application."""
    if not database_url:
        Path("output").mkdir(exist_ok=True)
        database_url = "sqlite:///./output/cameras.db"
    return SQLAlchemyRepository(database_url, seed=False)
