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

    def detect(self, frame: np.ndarray) -> list[VehicleDetection]:
        height, width = frame.shape[:2]
        small_width = min(width, self.config.detection_width)
        small_height = round(height * small_width / width)
        small = cv2.resize(frame, (small_width, small_height))
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
        return detections
