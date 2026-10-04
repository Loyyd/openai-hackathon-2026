"""Stateful per-camera processor; create one instance per video stream."""
import logging

import cv2
import numpy as np

from algorithms.vehicles.config import VideoConfig
from algorithms.vehicles.detector import VehicleDetector
from algorithms.vehicles.embeddings import EmbeddingEncoder
from algorithms.vehicles.matcher import IdentityRegistry, MatchConfig
from algorithms.vehicles.recognition import EasyOCRPlateRecognizer, UnknownClassifier, dominant_color

logger = logging.getLogger(__name__)


class VehicleProcessor:
    def __init__(self, config: VideoConfig | None = None, match_config: MatchConfig | None = None):
        self.config = config or VideoConfig()
        self.detector = VehicleDetector(self.config)
        self.encoder = EmbeddingEncoder(device=self.detector.device, backend=self.config.embedding_backend)
        self.registry = IdentityRegistry(match_config)
        self.plate_recognizer = EasyOCRPlateRecognizer() if self.config.ocr else None
        self.classifier = UnknownClassifier()
        self.last_recognition: dict[int, float] = {}

    def process_frame(self, image: np.ndarray, camera_id: str = "DEMO_CAM_01",
                      timestamp: float = 0.0) -> dict:
        detections = self.detector.detect(image)
        vehicles = []
        occupied: set[str] = set()
        for detection in detections:
            x1, y1, x2, y2 = detection.bbox
            crop = image[y1:y2, x1:x2]
            if not crop.size:
                continue
            tracker_id = detection.tracker_id
            due = tracker_id is None or timestamp - self.last_recognition.get(tracker_id, -float("inf")) >= self.config.recognition_interval
            embedding = plate = color = attributes = None
            if due:
                try:
                    embedding = self.encoder.encode(crop)
                except Exception:
                    logger.warning("Embedding unavailable for crop; continuing with other evidence", exc_info=True)
                color = dominant_color(crop)
                attributes = self.classifier.classify(crop)
                if self.plate_recognizer and embedding is not None:
                    plate = self.plate_recognizer.recognize(crop)
                if tracker_id is not None:
                    self.last_recognition[tracker_id] = timestamp
            fingerprint, explanation = self.registry.assign(tracker_id, detection, embedding, plate, color, attributes, timestamp, occupied=occupied)
            item = fingerprint.to_dict(store_raw_plates=self.config.store_raw_plates)
            item.update(tracker_id=tracker_id, bbox=list(detection.bbox), class_name=detection.class_name,
                        detection_confidence=detection.confidence, identity_confidence=explanation["confidence"],
                        decision=explanation["decision"], evidence=explanation["evidence"],
                        candidate_score=explanation.get("candidate_score"),
                        has_embedding=fingerprint.embedding is not None)
            vehicles.append(item)
        return {"camera_id": camera_id, "timestamp": timestamp, "vehicles": vehicles}


def annotate(image: np.ndarray, result: dict) -> np.ndarray:
    canvas = image.copy()
    scale = max(0.5, image.shape[1] / 1920)
    for vehicle in result["vehicles"]:
        x1, y1, x2, y2 = vehicle["bbox"]
        color = (50, 210, 100) if vehicle["decision"] in {"MATCH", "TRACKED"} else (20, 170, 255)
        cv2.rectangle(canvas, (x1, y1), (x2, y2), color, max(2, round(2 * scale)))
        state = "RE-IDENTIFIED" if vehicle["decision"] == "MATCH" else vehicle["decision"]
        text = f'{vehicle["vehicle_id"]} {state} {vehicle["identity_confidence"]:.0%}'
        details = f'{vehicle.get("color") or "unknown"} {vehicle["class_name"]} | plate: {vehicle.get("plate_text") or "hidden/unavailable"}'
        for offset, line in enumerate((text, details)):
            y = max(round(25 * scale), y1 - round((40 - offset * 20) * scale))
            cv2.putText(canvas, line, (x1, y), cv2.FONT_HERSHEY_SIMPLEX, 0.45 * scale, (0, 0, 0), max(3, round(4 * scale)))
            cv2.putText(canvas, line, (x1, y), cv2.FONT_HERSHEY_SIMPLEX, 0.45 * scale, color, max(1, round(scale)))
    return canvas
