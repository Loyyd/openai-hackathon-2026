from dataclasses import dataclass
from typing import Protocol

from shared.models import CameraObservation


@dataclass(frozen=True)
class ModelSignal:
    type: str
    label: str
    confidence: float
    metadata: dict


class VisionAnalyzer(Protocol):
    def analyze(self, observation: CameraObservation) -> list[ModelSignal]: ...


class DemoVisionAnalyzer:
    """Returns synthetic signals; this does not inspect the referenced image."""

    def analyze(self, observation: CameraObservation) -> list[ModelSignal]:
        if observation.camera_id in {"demo_cam_0", "demo_cam_1"}:
            return [ModelSignal("heavy_traffic", "Heavy traffic (DEMO)", 0.87, {"demo": True})]
        return [ModelSignal("road_clear", "Road clear (DEMO)", 0.76, {"demo": True})]
