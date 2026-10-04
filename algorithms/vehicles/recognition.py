"""Optional local crop analysis; OCR is best-effort and has no plate detector."""

from __future__ import annotations

import re
import logging
from typing import Protocol

import cv2
import numpy as np

from .models import ColorResult, PlateResult, VehicleAttributes

logger = logging.getLogger(__name__)


class PlateRecognizer(Protocol):
    def recognize(self, vehicle_crop: np.ndarray) -> PlateResult | None: ...


class VehicleClassifier(Protocol):
    def classify(self, vehicle_crop: np.ndarray) -> VehicleAttributes: ...


class UnknownClassifier:
    def classify(self, vehicle_crop: np.ndarray) -> VehicleAttributes:
        return VehicleAttributes()


class EasyOCRPlateRecognizer:
    """OCRs the whole vehicle crop heuristically; it does not detect plates."""

    _valid = re.compile(r"^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{5,12}$")

    def __init__(self, reader=None, max_attempts: int | None = None):
        self.reader = reader
        self._initialization_failed = False

    def recognize(self, vehicle_crop: np.ndarray) -> PlateResult | None:
        if self._initialization_failed or vehicle_crop is None or vehicle_crop.size == 0:
            return None
        try:
            if self.reader is None:
                import easyocr
                self.reader = easyocr.Reader(["en"], gpu=False)
            results = self.reader.readtext(vehicle_crop)
            valid = []
            for box, text, confidence in results:
                normalized = re.sub(r"[^A-Z0-9]", "", text.upper())
                if self._valid.fullmatch(normalized):
                    points = np.asarray(box, dtype=int)
                    x0, y0 = points.min(axis=0)
                    x1, y1 = points.max(axis=0)
                    valid.append(PlateResult(normalized, float(confidence), (int(x0), int(y0), int(x1), int(y1))))
            return max(valid, key=lambda result: result.confidence, default=None)
        except Exception as exc:
            if self.reader is None:
                self._initialization_failed = True
                logger.warning("EasyOCR initialization failed; plate OCR disabled: %s", exc)
            return None


def dominant_color(vehicle_crop: np.ndarray) -> ColorResult:
    if vehicle_crop is None or vehicle_crop.size == 0:
        return ColorResult("unknown", 0.0)
    height, width = vehicle_crop.shape[:2]
    body = vehicle_crop[int(height * 0.35):int(height * 0.82), int(width * 0.12):int(width * 0.88)]
    if body.size == 0:
        return ColorResult("unknown", 0.0)
    hsv = cv2.cvtColor(body, cv2.COLOR_BGR2HSV)
    hue, saturation, value = cv2.split(hsv)
    # Exclude low-value tyres/shadows and near-white window glare.
    mask = (value > 45) & (value < 245) & ((saturation > 30) | (value > 170))
    pixels = hsv[mask]
    if len(pixels) < max(8, body.shape[0] * body.shape[1] // 30):
        pixels = hsv.reshape(-1, 3)
    h, s, v = np.median(pixels, axis=0)
    if v < 55:
        color = "black"
    elif s < 35:
        color = "white" if v > 190 else "silver" if v > 125 else "grey"
    elif h < 10 or h >= 170:
        color = "red"
    elif h < 25:
        color = "orange"
    elif h < 35:
        color = "yellow"
    elif h < 85:
        color = "green"
    elif h < 135:
        color = "blue"
    else:
        color = "other"
    if color in {"orange", "red"} and v < 150 and s < 150:
        color = "brown"
    color_support = _color_mask(pixels.reshape(-1, 1, 3), color)
    confidence = float(np.clip(np.count_nonzero(color_support) / len(pixels), 0.0, 1.0))
    return ColorResult(color, confidence)


def _color_mask(hsv: np.ndarray, color: str) -> np.ndarray:
    hue, saturation, value = (hsv[..., 0], hsv[..., 1], hsv[..., 2])
    if color == "black":
        return value < 55
    if color in {"white", "silver", "grey"}:
        low, high = {"white": (190, 256), "silver": (125, 191), "grey": (55, 126)}[color]
        return (saturation < 35) & (value >= low) & (value < high)
    if color == "red":
        return (hue < 10) | (hue >= 170)
    limits = {"orange": (10, 25), "yellow": (25, 35), "green": (35, 85),
              "blue": (85, 135), "brown": (5, 25)}
    low, high = limits.get(color, (0, 180))
    return (hue >= low) & (hue < high) & (saturation >= 30)
