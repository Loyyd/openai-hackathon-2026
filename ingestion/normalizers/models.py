from shared.models import Camera, CameraObservation, Location, TransportObservation


def normalize_camera(payload: dict) -> Camera:
    return Camera.model_validate(payload)


def normalize_observation(payload: dict) -> CameraObservation:
    return CameraObservation.model_validate(payload)


def normalize_transport(payload: dict) -> TransportObservation:
    return TransportObservation.model_validate(payload)


def normalize_location(payload: dict) -> Location:
    return Location.model_validate(payload)
