"""Canonical JSON contracts; coordinate changes with all four owners."""
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, AwareDatetime


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Location(Contract):
    id: str
    name: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class Camera(Contract):
    id: str
    provider: str
    name: str
    location: Location
    image_url: str
    last_updated: AwareDatetime


class CameraObservation(Contract):
    id: str
    camera_id: str
    timestamp: AwareDatetime
    image_url: str
    location: Location


class Detection(Contract):
    id: str
    observation_id: str
    type: str
    confidence: float = Field(ge=0, le=1)
    label: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class Incident(Contract):
    id: str
    type: str
    title: str
    description: str
    severity: Literal["low", "medium", "high", "critical"]
    confidence: float = Field(ge=0, le=1)
    location: Location
    camera_ids: list[str] = Field(default_factory=list)
    related_observation_ids: list[str] = Field(default_factory=list)
    first_seen: AwareDatetime
    last_seen: AwareDatetime
    status: Literal["active", "resolved"]
    metadata: dict[str, Any] = Field(default_factory=dict)


class TransportObservation(Contract):
    id: str
    provider: str
    type: str
    route: str
    vehicle_id: str | None = None
    location: Location
    timestamp: AwareDatetime
    speed: float | None = Field(default=None, ge=0)
    delay_seconds: int | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class MapData(Contract):
    cameras: list[Camera]
    incidents: list[Incident]
