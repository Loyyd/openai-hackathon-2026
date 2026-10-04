import json
from pathlib import Path

from shared.models import Location

from .tii import FIXTURES


class LocationProvider:
    """Loads normalized demo locations; replace loading with a real adapter."""

    def __init__(self, fixture_dir: Path = FIXTURES) -> None:
        self.fixture_dir = fixture_dir

    async def get_locations(self) -> list[Location]:
        payload = json.loads((self.fixture_dir / "locations.json").read_text())
        return [Location.model_validate(item) for item in payload]
