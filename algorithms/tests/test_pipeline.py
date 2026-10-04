from datetime import datetime, timezone

from algorithms.confidence.scoring import final_confidence
from algorithms.correlation.pipeline import correlate_detections
from algorithms.detection.pipeline import analyze_observation
from shared.demo import OBSERVATIONS, TRANSPORT
from shared.models import Detection


def test_confidence_clamped_and_rejects_invalid_factor():
    assert final_confidence(0.8, 0.5, 0.5) == 0.2
    assert final_confidence(1.0) == 1.0
    try:
        final_confidence(1.1)
    except ValueError:
        pass
    else:
        raise AssertionError("out-of-range factors must be rejected")


def test_demo_pipeline_builds_incident_and_ignores_clear_road():
    observation, transport = OBSERVATIONS[0], TRANSPORT
    detections = analyze_observation(observation)
    incidents = correlate_detections(detections, observation, transport=transport)
    assert detections[0].type == "heavy_traffic"
    assert len(incidents) == 1
    assert incidents[0].metadata["demo"] is True
    assert incidents[0].related_observation_ids == [observation.id]

    repeated = observation.model_copy(update={
        "id": "repeat-frame",
        "timestamp": datetime(2026, 10, 4, 10, 1, tzinfo=timezone.utc),
    })
    repeated_incidents = correlate_detections(
        analyze_observation(repeated), repeated, previous_incidents=incidents
    )
    assert repeated_incidents[0].id == incidents[0].id
    assert repeated_incidents[0].related_observation_ids == [observation.id, repeated.id]

    clear = Detection(id="clear", observation_id=observation.id, type="road_clear", confidence=0.8, label="Clear")
    assert correlate_detections([clear], observation) == []
