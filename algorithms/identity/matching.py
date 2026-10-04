from shared.models import Detection, Incident


def match_detection(current: Detection, previous: Detection) -> float:
    """Heuristic same-event score; never identifies a person or biometric."""
    if current.type != previous.type:
        return 0.0
    if current.observation_id == previous.observation_id:
        return 1.0
    return 0.75 if current.metadata.get("camera_id") == previous.metadata.get("camera_id") else 0.5


def match_incident(detection: Detection, incident: Incident, location_id: str) -> float:
    event_type = "traffic_congestion" if detection.type == "heavy_traffic" else detection.type
    if event_type != incident.type:
        return 0.0
    return 0.9 if incident.location.id == location_id else 0.0
