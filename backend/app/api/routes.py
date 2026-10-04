from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse

from backend.app.schemas import Camera, CameraObservation, Detection, Incident, MapData, TransportObservation
from backend.app.services.api import SentinelXService

router = APIRouter()
MAX_SNAPSHOT_BYTES = 10 * 1024 * 1024


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


@router.get("/api/detections", response_model=list[Detection])
def detections(request: Request):
    return _service(request).list("detections")


@router.get(
    "/api/observations/{observation_id}/detections", response_model=list[Detection]
)
def observation_detections(observation_id: str, request: Request):
    return _service(request).observation_detections(observation_id)


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


@router.post(
    "/api/cameras/{camera_id}/snapshots",
    response_model=CameraObservation,
    status_code=201,
)
async def upload_camera_snapshot(
    camera_id: str,
    request: Request,
    file: UploadFile = File(...),
    captured_at: datetime = Form(...),
):
    contents = await file.read(MAX_SNAPSHOT_BYTES + 1)
    if len(contents) > MAX_SNAPSHOT_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds the 10 MB upload limit")
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded image is empty")
    if captured_at.tzinfo is None or captured_at.utcoffset() is None:
        raise HTTPException(status_code=422, detail="captured_at must include a timezone")

    snapshot_id = uuid4().hex
    image_url = str(request.url_for("get_snapshot", snapshot_id=snapshot_id))
    try:
        return _service(request).upload_snapshot(
            camera_id, captured_at, contents, image_url
        )
    except ValueError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc


@router.get("/api/snapshots/{snapshot_id}", name="get_snapshot")
def get_snapshot(snapshot_id: str, request: Request):
    metadata, path = _service(request).snapshot_file(snapshot_id)
    return FileResponse(path, media_type=metadata["content_type"])


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
