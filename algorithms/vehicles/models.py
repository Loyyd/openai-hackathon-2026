"""Data models for vehicle observations and persistent fingerprints."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

import numpy as np


@dataclass
class VehicleDetection:
    bbox: tuple[int, int, int, int]
    class_name: str
    confidence: float
    tracker_id: int | None = None


@dataclass
class PlateResult:
    text: str
    confidence: float
    bbox: tuple[int, int, int, int] | None = None


@dataclass
class ColorResult:
    color: str
    confidence: float


@dataclass
class VehicleAttributes:
    make: str | None = None
    model: str | None = None
    confidence: float = 0.0


@dataclass
class VehicleFingerprint:
    vehicle_id: str
    embedding: np.ndarray | None = None
    observation_count: int = 0
    first_seen: float | None = None
    last_seen: float | None = None
    last_bbox: tuple[int, int, int, int] | None = None
    _colors: dict[str, float] = field(default_factory=lambda: defaultdict(float), repr=False)
    _plates: dict[str, float] = field(default_factory=lambda: defaultdict(float), repr=False)
    _color_counts: dict[str, int] = field(default_factory=lambda: defaultdict(int), repr=False)
    _plate_counts: dict[str, int] = field(default_factory=lambda: defaultdict(int), repr=False)
    _attributes: dict[tuple[str | None, str | None], float] = field(default_factory=lambda: defaultdict(float), repr=False)

    @property
    def color(self) -> str | None:
        return max(self._colors, key=self._colors.get) if self._colors else None

    @property
    def color_confidence(self) -> float:
        count = sum(self._color_counts.values())
        return self._colors.get(self.color, 0.0) / count if count else 0.0

    @property
    def plate_text(self) -> str | None:
        return max(self._plates, key=self._plates.get) if self._plates else None

    @property
    def plate_confidence(self) -> float:
        count = sum(self._plate_counts.values())
        return self._plates.get(self.plate_text, 0.0) / count if count else 0.0

    @property
    def attributes(self) -> VehicleAttributes:
        if not self._attributes:
            return VehicleAttributes()
        (make, model), weight = max(self._attributes.items(), key=lambda item: item[1])
        return VehicleAttributes(make, model, weight / sum(self._attributes.values()))

    def update(self, embedding: np.ndarray | None, plate: PlateResult | None,
               color: ColorResult | None, attributes: VehicleAttributes | None,
               timestamp: float, *, ema: float = 0.2) -> None:
        self.observation_count += 1
        self.first_seen = timestamp if self.first_seen is None else min(self.first_seen, timestamp)
        self.last_seen = timestamp if self.last_seen is None else max(self.last_seen, timestamp)
        vector = normalize_embedding(embedding)
        if vector is not None:
            if self.embedding is None or self.embedding.shape != vector.shape:
                self.embedding = vector
            else:
                self.embedding = normalize_embedding((1 - ema) * self.embedding + ema * vector)
        if plate and plate.text and plate.confidence > 0:
            normalized = normalize_plate(plate.text)
            if normalized:
                self._plates[normalized] += plate.confidence
                self._plate_counts[normalized] += 1
        if color and color.color and color.confidence > 0:
            self._colors[color.color.lower()] += color.confidence
            self._color_counts[color.color.lower()] += 1
        if attributes and (attributes.make or attributes.model) and attributes.confidence > 0:
            self._attributes[(attributes.make, attributes.model)] += attributes.confidence

    def to_dict(self, store_raw_plates: bool = False) -> dict[str, Any]:
        attributes = self.attributes
        result: dict[str, Any] = {
            "vehicle_id": self.vehicle_id, "color": self.color,
            "color_confidence": self.color_confidence,
            "make": attributes.make, "model": attributes.model,
            "attribute_confidence": attributes.confidence,
            "first_seen": self.first_seen, "last_seen": self.last_seen,
            "observation_count": self.observation_count,
        }
        if store_raw_plates:
            result.update(plate_text=self.plate_text, plate_confidence=self.plate_confidence)
        return result


def normalize_embedding(embedding: np.ndarray | None) -> np.ndarray | None:
    if embedding is None:
        return None
    vector = np.asarray(embedding, dtype=np.float32).reshape(-1)
    norm = float(np.linalg.norm(vector))
    if not np.isfinite(vector).all() or norm <= 1e-12:
        return None
    return vector / norm


def normalize_plate(text: str) -> str:
    return "".join(character for character in text.upper() if character.isalnum())
