"""Read-only local demo artifacts; no model inference in HTTP requests."""
import json
import math
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter(prefix="/api/ai-demo")


def directory() -> Path:
    return Path(os.getenv("AI_DEMO_DIR", "output/highway"))


def _positive_fps(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    try:
        return float(value) if math.isfinite(value) and value > 0 else None
    except OverflowError:
        return None


def _timeline(root: Path):
    try:
        observations = []
        with (root / "observations.jsonl").open() as log:
            for line in log:
                frame = json.loads(line)
                if not isinstance(frame, dict):
                    return []
                timestamp = frame["timestamp"]
                if (isinstance(timestamp, bool) or not isinstance(timestamp, (int, float))
                        or not math.isfinite(timestamp)):
                    return []
                vehicles = frame["vehicles"]
                if not isinstance(vehicles, list):
                    return []
                sanitized_vehicles = []
                for vehicle in vehicles:
                    if not isinstance(vehicle, dict) or not isinstance(vehicle.get("vehicle_id"), str):
                        return []
                    sanitized = {"vehicle_id": vehicle["vehicle_id"]}
                    confidence = vehicle.get("identity_confidence")
                    if (isinstance(confidence, (int, float)) and not isinstance(confidence, bool)
                            and math.isfinite(confidence)):
                        sanitized["identity_confidence"] = confidence
                    if isinstance(vehicle.get("decision"), str):
                        sanitized["decision"] = vehicle["decision"]
                    if "evidence" in vehicle and isinstance(vehicle["evidence"], dict):
                        evidence = {
                            key: value for key, value in vehicle["evidence"].items()
                            if key in {"tracker_id", "identity_confidence", "plate_similarity", "plate_confidence",
                                       "visual_similarity", "color_similarity", "make_model_similarity",
                                       "temporal_plausibility"}
                            and isinstance(value, (int, float)) and not isinstance(value, bool)
                            and math.isfinite(value)
                        }
                        sanitized["evidence"] = evidence
                    sanitized_vehicles.append(sanitized)
                observations.append({"timestamp": timestamp, "vehicles": sanitized_vehicles})
        return observations
    except (OSError, ValueError, KeyError, TypeError, OverflowError):
        return []


@router.get("")
def summary():
    root = directory()
    try:
        run = json.loads((root / "run.json").read_text())
        vehicles = json.loads((root / "vehicles.json").read_text())
    except (OSError, ValueError):
        raise HTTPException(404, "No processed AI demo. Run the vehicle pipeline first.")
    allowed = {"vehicle_id", "color", "color_confidence", "make", "model", "first_seen", "last_seen", "observation_count", "identity_confidence", "decision", "evidence"}
    source_fps, sample_fps = _positive_fps(run.get("source_fps")), _positive_fps(run.get("sample_fps"))
    replay_fps = min(source_fps, sample_fps) if source_fps and sample_fps else source_fps or sample_fps
    return {"run": {k: run.get(k) for k in ("width", "height", "frames", "sample_fps", "embedding_backend", "device", "ocr_status", "detector", "detection_width")}
                    | {"replay_fps": replay_fps},
            "vehicles": [{k: v for k, v in item.items() if k in allowed} for item in vehicles],
            "timeline": _timeline(root),
            "video_available": (root / "browser.mp4").is_file()}


@router.get("/media/{name}")
def media(name: str):
    if name not in {"browser.mp4", "latest.jpg"}:
        raise HTTPException(404, "Unknown demo asset")
    path = directory() / name
    if not path.is_file():
        raise HTTPException(404, "Demo asset unavailable")
    return FileResponse(path, media_type="video/mp4" if name.endswith("mp4") else "image/jpeg")
