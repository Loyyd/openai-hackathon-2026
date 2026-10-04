from fastapi import APIRouter, Request

from backend.app.schemas import Camera, CameraObservation, Detection, Incident, MapData, TransportObservation
from backend.app.services.api import SentinelXService

router = APIRouter()


def _service(request: Request) -> SentinelXService:
    return request.app.state.service


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/api/cameras", response_model=list[Camera])
def cameras(request: Request):
    return _service(request).list("cameras")


@router.get("/api/cameras/{camera_id}", response_model=Camera)
def camera(camera_id: str, request: Request):
    return _service(request).get("cameras", camera_id, "Camera")


@router.get("/api/cameras/{camera_id}/observations", response_model=list[CameraObservation])
def camera_observations(camera_id: str, request: Request):
    return _service(request).camera_observations(camera_id)


@router.get("/api/incidents", response_model=list[Incident])
def incidents(request: Request):
    return _service(request).list("incidents")


@router.get("/api/incidents/{incident_id}", response_model=Incident)
def incident(incident_id: str, request: Request):
    return _service(request).get("incidents", incident_id, "Incident")


@router.get("/api/transport", response_model=list[TransportObservation])
def transport(request: Request):
    return _service(request).list("transport")


@router.get("/api/map", response_model=MapData)
def map_data(request: Request):
    return _service(request).map_data()


@router.post("/api/cameras", response_model=Camera, status_code=201)
def save_camera(item: Camera, request: Request):
    return _service(request).save("cameras", item)


@router.post("/api/observations", response_model=CameraObservation, status_code=201)
def save_observation(item: CameraObservation, request: Request):
    return _service(request).save("observations", item)


@router.post("/api/detections", response_model=Detection, status_code=201)
def save_detection(item: Detection, request: Request):
    return _service(request).save("detections", item)


@router.post("/api/incidents", response_model=Incident, status_code=201)
def save_incident(item: Incident, request: Request):
    return _service(request).save("incidents", item)


@router.post("/api/transport", response_model=TransportObservation, status_code=201)
def save_transport(item: TransportObservation, request: Request):
    return _service(request).save("transport", item)
