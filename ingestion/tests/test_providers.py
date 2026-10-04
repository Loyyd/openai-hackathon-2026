import asyncio

from ingestion.providers.buses import BusProvider
from ingestion.providers.locations import LocationProvider
from ingestion.providers.tii import TIIProvider


def test_fixture_providers_return_validated_models():
    async def load():
        tii = TIIProvider()
        cameras = await tii.get_cameras()
        observations = [await tii.get_latest_observation(camera.id) for camera in cameras]
        buses = await BusProvider().get_observations()
        locations = await LocationProvider().get_locations()
        return cameras, observations, buses, locations

    cameras, observations, buses, locations = asyncio.run(load())
    assert len(cameras) == len(observations) == len(locations) == 5
    assert buses[0].route == "41"
    assert all(item.camera_id == camera.id for item, camera in zip(observations, cameras))
