from typing import Protocol

from shared.models import Camera, CameraObservation, TransportObservation


class CameraProvider(Protocol):
    async def get_cameras(self) -> list[Camera]: ...

    async def get_latest_observation(self, camera_id: str) -> CameraObservation: ...


class TransportProvider(Protocol):
    async def get_observations(self) -> list[TransportObservation]: ...
