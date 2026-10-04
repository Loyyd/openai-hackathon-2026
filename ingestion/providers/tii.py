import json
from pathlib import Path

from shared.models import Camera, CameraObservation

from .base import CameraProvider

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"


class TIIProvider:
    """Fixture-only TII adapter; no undocumented live URL is assumed."""

    def __init__(self, fixture_dir: Path = FIXTURES) -> None:
        self.fixture_dir = fixture_dir

    async def get_cameras(self) -> list[Camera]:
        payload = json.loads((self.fixture_dir / "tii_cameras.json").read_text())
        return [Camera.model_validate(item) for item in payload]

    async def get_latest_observation(self, camera_id: str) -> CameraObservation:
        payload = json.loads((self.fixture_dir / "tii_observations.json").read_text())
        for item in payload:
            if item["camera_id"] == camera_id:
                return CameraObservation.model_validate(item)
        raise KeyError(f"No fixture observation for camera {camera_id!r}")
