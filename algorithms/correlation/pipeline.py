import re

from shared.models import CameraObservation, Detection, Incident, TransportObservation

from algorithms.confidence.scoring import final_confidence
from algorithms.identity.matching import match_incident


def _nearby(left_lat: float, left_lon: float, right_lat: float, right_lon: float) -> bool:
    return abs(left_lat - right_lat) <= 0.01 and abs(left_lon - right_lon) <= 0.01


def _incident_id(kind: str, location_id: str) -> str:
    safe = re.sub(r"[^a-z0-9]+", "_", f"{kind}_{location_id}".lower()).strip("_")
    return f"demo_event_{safe}"


def correlate_detections(
    detections: list[Detection],
    observation: CameraObservation,
    previous_incidents: list[Incident] | None = None,
    transport: list[TransportObservation] | None = None,
) -> list[Incident]:
    """Build one active incident per event/location, merging prior evidence."""
    previous_incidents = previous_incidents or []
    transport = transport or []
    incidents: list[Incident] = []
    for detection in detections:
        if detection.type == "road_clear":
            continue
        prior = next(
            (item for item in previous_incidents if match_incident(detection, item, observation.location.id) >= 0.9),
            None,
        )
        related = list(dict.fromkeys((prior.related_observation_ids if prior else []) + [observation.id]))
        camera_ids = list(dict.fromkeys((prior.camera_ids if prior else []) + [observation.camera_id]))
        corroboration = any(
            _nearby(
                observation.location.latitude,
                observation.location.longitude,
                item.location.latitude,
                item.location.longitude,
            )
            and (item.delay_seconds or 0) >= 120
            for item in transport
        )
        consistency = min(1.0, 0.8 + 0.1 * (len(related) - 1) + (0.05 if corroboration else 0.0))
        confidence = final_confidence(detection.confidence, consistency, 1.0)
        timestamp = observation.timestamp
        first_seen = min(prior.first_seen, timestamp) if prior else timestamp
        last_seen = max(prior.last_seen, timestamp) if prior else timestamp
        severity = "high" if corroboration and confidence >= 0.6 else "medium"
        title = f"DEMO: {detection.label} at {observation.location.name}"
        description = "Synthetic traffic signal; nearby delayed transport corroborates this demo event." if corroboration else "Synthetic camera analysis indicates heavy traffic."
        detection_ids = list(dict.fromkeys((prior.metadata.get("detection_ids", []) if prior else []) + [detection.id]))
        metadata = {"demo": True, "detection_ids": detection_ids, "transport_corroboration": corroboration}
        incidents.append(Incident(
            id=prior.id if prior else _incident_id(detection.type, observation.location.id),
            type="traffic_congestion" if detection.type == "heavy_traffic" else detection.type,
            title=title,
            description=description,
            severity=severity,
            confidence=confidence,
            location=observation.location,
            camera_ids=camera_ids,
            related_observation_ids=related,
            first_seen=first_seen,
            last_seen=last_seen,
            status="active",
            metadata=metadata,
        ))
    return incidents
