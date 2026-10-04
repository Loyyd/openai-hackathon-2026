"""Read-only local demo artifacts; no model inference in HTTP requests."""
import json
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter(prefix="/api/ai-demo")


def directory() -> Path:
    return Path(os.getenv("AI_DEMO_DIR", "output/highway"))


@router.get("")
def summary():
    root = directory()
    try:
        run = json.loads((root / "run.json").read_text())
        vehicles = json.loads((root / "vehicles.json").read_text())
    except (OSError, ValueError):
        raise HTTPException(404, "No processed AI demo. Run the vehicle pipeline first.")
    allowed = {"vehicle_id", "color", "color_confidence", "make", "model", "first_seen", "last_seen", "observation_count", "identity_confidence", "decision", "evidence"}
    return {"run": {k: run.get(k) for k in ("width", "height", "frames", "sample_fps", "embedding_backend", "device", "ocr_status")},
            "vehicles": [{k: v for k, v in item.items() if k in allowed} for item in vehicles],
            "video_available": (root / "browser.mp4").is_file()}


@router.get("/media/{name}")
def media(name: str):
    if name not in {"browser.mp4", "latest.jpg"}:
        raise HTTPException(404, "Unknown demo asset")
    path = directory() / name
    if not path.is_file():
        raise HTTPException(404, "Demo asset unavailable")
    return FileResponse(path, media_type="video/mp4" if name.endswith("mp4") else "image/jpeg")
