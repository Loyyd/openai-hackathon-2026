import json
from pathlib import Path

from shared.models import TransportObservation

from .base import TransportProvider
from .tii import FIXTURES


class BusProvider:
    """Fixture-only transport adapter, ready for provider-specific parsing."""

    def __init__(self, fixture_dir: Path = FIXTURES) -> None:
        self.fixture_dir = fixture_dir

    async def get_observations(self) -> list[TransportObservation]:
        payload = json.loads((self.fixture_dir / "transport.json").read_text())
        return [TransportObservation.model_validate(item) for item in payload]
