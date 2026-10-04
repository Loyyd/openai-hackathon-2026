"""Typed relational persistence models for SentinelX backend data."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.models.base import Base


class LocationModel(Base):
    __tablename__ = "locations"
    __table_args__ = (
        CheckConstraint("latitude >= -90 AND latitude <= 90", name="ck_locations_latitude"),
        CheckConstraint("longitude >= -180 AND longitude <= 180", name="ck_locations_longitude"),
    )

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)

    cameras: Mapped[list[CameraModel]] = relationship(back_populates="location")
    observations: Mapped[list[ObservationModel]] = relationship(back_populates="location")
    events: Mapped[list[EventModel]] = relationship(back_populates="location")


class CameraModel(Base):
    __tablename__ = "cameras"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    provider: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    location_id: Mapped[str] = mapped_column(ForeignKey("locations.id"), nullable=False, index=True)
    image_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    last_updated: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    location: Mapped[LocationModel] = relationship(back_populates="cameras")
    observations: Mapped[list[ObservationModel]] = relationship(
        back_populates="camera", cascade="all, delete-orphan"
    )


class ObservationModel(Base):
    __tablename__ = "observations"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    camera_id: Mapped[str] = mapped_column(ForeignKey("cameras.id"), nullable=False, index=True)
    location_id: Mapped[str] = mapped_column(ForeignKey("locations.id"), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    # Keep the current API's image_url contract for existing demo/remote image URLs.
    image_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    camera: Mapped[CameraModel] = relationship(back_populates="observations")
    location: Mapped[LocationModel] = relationship(back_populates="observations")
    snapshot: Mapped[SnapshotModel | None] = relationship(
        back_populates="observation", cascade="all, delete-orphan", uselist=False
    )
    detections: Mapped[list[DetectionModel]] = relationship(
        back_populates="observation", cascade="all, delete-orphan"
    )


class SnapshotModel(Base):
    __tablename__ = "snapshots"
    __table_args__ = (UniqueConstraint("observation_id", name="uq_snapshots_observation_id"),)

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    observation_id: Mapped[str] = mapped_column(
        ForeignKey("observations.id"), nullable=False, index=True
    )
    storage_key: Mapped[str] = mapped_column(String(1024), nullable=False, unique=True)
    content_type: Mapped[str] = mapped_column(String(127), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    observation: Mapped[ObservationModel] = relationship(back_populates="snapshot")


class DetectionModel(Base):
    __tablename__ = "detections"
    __table_args__ = (
        CheckConstraint("confidence >= 0 AND confidence <= 1", name="ck_detections_confidence"),
    )

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    observation_id: Mapped[str] = mapped_column(
        ForeignKey("observations.id"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(String(255), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    label: Mapped[str] = mapped_column(String(512), nullable=False)
    details: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, nullable=False, default=dict)

    observation: Mapped[ObservationModel] = relationship(back_populates="detections")


class EventModel(Base):
    """Persisted event; exposed through the existing API's Incident contract."""

    __tablename__ = "events"
    __table_args__ = (
        CheckConstraint("confidence >= 0 AND confidence <= 1", name="ck_events_confidence"),
        CheckConstraint(
            "severity IN ('low', 'medium', 'high', 'critical')", name="ck_events_severity"
        ),
        CheckConstraint("status IN ('active', 'resolved')", name="ck_events_status"),
    )

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    type: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str] = mapped_column(String(4096), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    location_id: Mapped[str] = mapped_column(ForeignKey("locations.id"), nullable=False, index=True)
    # Preserve the current Incident API's ID arrays until join-table migration is needed.
    camera_ids: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    related_observation_ids: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    details: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, nullable=False, default=dict)

    location: Mapped[LocationModel] = relationship(back_populates="events")
