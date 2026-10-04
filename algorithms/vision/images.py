"""Local demo image loading boundary; live image fetching belongs in an adapter."""
from pathlib import Path
from typing import Protocol

from shared.models import CameraObservation


class ImageLoader(Protocol):
    def load(self, observation: CameraObservation) -> bytes: ...


class DemoImageLoader:
    def load(self, observation: CameraObservation) -> bytes:
        if observation.image_url != "/demo-camera.svg":
            raise ValueError("Demo loader accepts only the bundled synthetic image")
        return (Path(__file__).resolve().parents[1] / "fixtures/demo-camera.svg").read_bytes()
