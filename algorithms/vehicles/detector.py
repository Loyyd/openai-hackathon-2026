import logging
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO

from algorithms.vehicles.config import VideoConfig, resolve_device
from algorithms.vehicles.models import VehicleDetection
from algorithms.vehicles.geometry import original_bbox

logger = logging.getLogger(__name__)


class VehicleDetector:
    """ByteTrack coordinates are scaled back before original-frame crops."""
    def __init__(self, config: VideoConfig):
        self.config = config
        self.device = resolve_device(config.device)
        self.model = YOLO(config.weights)
        self.raw_detections: list[VehicleDetection] = []
        # Register before Ultralytics installs its tracking callback: tracking
        # replaces results with associated tracks and can discard real detections.
        self.model.add_callback("on_predict_postprocess_end", self._capture_detections)

    def _capture_detections(self, predictor) -> None:
        self.raw_detections = [
            VehicleDetection(
                bbox=tuple(box.xyxy[0].cpu().tolist()),
                class_name=result.names[int(box.cls.item())],
                confidence=float(box.conf.item()),
            )
            for result in predictor.results for box in result.boxes
        ]

    def detect(self, frame: np.ndarray) -> list[VehicleDetection]:
        height, width = frame.shape[:2]
        small_width = min(width, self.config.detection_width)
        small_height = round(height * small_width / width)
        small = cv2.resize(frame, (small_width, small_height))
        self.raw_detections = []
        kwargs = dict(persist=True, tracker=str(Path(__file__).with_name("bytetrack.yaml")), classes=[2, 3, 5, 7],
                      conf=self.config.confidence, imgsz=small_width, verbose=False)
        try:
            result = self.model.track(small, device=self.device, **kwargs)[0]
        except (RuntimeError, NotImplementedError):
            if self.device == "cpu":
                raise
            logger.warning("Detector device %s failed; retrying on CPU", self.device, exc_info=True)
            self.device = "cpu"
            result = self.model.track(small, device="cpu", **kwargs)[0]
        detections = []
        for box in result.boxes:
            bbox = original_bbox(box.xyxy[0].cpu().tolist(), (width, height), (small_width, small_height))
            tracker_id = int(box.id.item()) if box.id is not None else None
            detections.append(VehicleDetection(bbox=bbox, class_name=result.names[int(box.cls.item())],
                                               confidence=float(box.conf.item()), tracker_id=tracker_id))
        # Keep detections that ByteTrack could not associate. Identity matching
        # handles tracker_id=None without inventing tracker continuity.
        for raw in self.raw_detections:
            bbox = original_bbox(list(raw.bbox), (width, height), (small_width, small_height))
            if not any(self._iou(bbox, item.bbox) >= 0.5 for item in detections):
                detections.append(VehicleDetection(bbox=bbox, class_name=raw.class_name,
                                                   confidence=raw.confidence))
        return detections

    @staticmethod
    def _iou(a, b) -> float:
        intersection = max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(0, min(a[3], b[3]) - max(a[1], b[1]))
        union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - intersection
        return intersection / union if union > 0 else 0.0
