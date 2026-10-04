from shared.models import CameraObservation, Detection

from algorithms.confidence.scoring import final_confidence
from algorithms.vision.analyzer import DemoVisionAnalyzer, VisionAnalyzer


def analyze_observation(
    observation: CameraObservation, analyzer: VisionAnalyzer | None = None
) -> list[Detection]:
    analyzer = analyzer or DemoVisionAnalyzer()
    return [
        Detection(
            id=f"{observation.id}_{signal.type}",
            observation_id=observation.id,
            type=signal.type,
            confidence=final_confidence(signal.confidence, data_quality=0.8),
            label=signal.label,
            metadata={**signal.metadata, "camera_id": observation.camera_id},
        )
        for signal in analyzer.analyze(observation)
    ]
