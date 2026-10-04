"""Regenerate JSON Schema and demo payloads from canonical Python models."""
import json
from pathlib import Path

from shared import demo, models

ROOT = Path(__file__).resolve().parents[1]


def export() -> None:
    schemas = ROOT / "shared/schemas"
    examples = ROOT / "shared/examples"
    schemas.mkdir(exist_ok=True)
    examples.mkdir(exist_ok=True)
    for name in ("Location", "Camera", "CameraObservation", "Detection", "Incident", "TransportObservation", "MapData"):
        model = getattr(models, name)
        (schemas / f"{name}.json").write_text(json.dumps(model.model_json_schema(), indent=2) + "\n")
    detection = models.Detection(id="demo_detection", observation_id=demo.OBSERVATIONS[0].id, type="heavy_traffic", confidence=0.87, label="DEMO: Heavy traffic", metadata={"demo": True})
    for name, values in {"locations": demo.LOCATIONS, "cameras": demo.CAMERAS, "observations": demo.OBSERVATIONS, "detections": [detection], "transport": demo.TRANSPORT, "incidents": demo.INCIDENTS}.items():
        (examples / f"{name}.json").write_text(json.dumps([v.model_dump(mode="json") for v in values], indent=2) + "\n")
    payload = models.MapData(cameras=demo.CAMERAS, incidents=demo.INCIDENTS, transport=demo.TRANSPORT)
    (examples / "map.json").write_text(payload.model_dump_json(indent=2) + "\n")


if __name__ == "__main__":
    export()
