"""Expose the shared transport adapter through the application's same-origin API."""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from ingestion.transport_adapter import server as adapter

router = APIRouter(prefix="/api/v1", tags=["Transport providers"])


@router.get("/cameras")
def cameras():
    return adapter.camera_catalog()


@router.get("/nearby")
def nearby(lat: float = Query(ge=-90, le=90), lon: float = Query(ge=-180, le=180), radius_m: int = Query(default=1500, ge=100, le=5000)):
    return adapter.nearby_data(lat, lon, radius_m)


@router.get("/cameras/{camera_id}/snapshot")
def snapshot(camera_id: str):
    try:
        image, content_type, status = adapter.camera_snapshot(camera_id)
    except LookupError as exc:
        raise HTTPException(404, "Camera or snapshot not found") from exc
    return Response(image, media_type=content_type, headers={
        "X-Snapshot-Status": status, "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
    })
