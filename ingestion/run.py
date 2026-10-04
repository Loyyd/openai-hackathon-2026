"""Load fixture feeds, run the local demo pipeline, and optionally POST."""
import argparse
import asyncio
import os

import httpx
from shared.models import Incident

from algorithms.correlation.pipeline import correlate_detections
from algorithms.detection.pipeline import analyze_observation
from ingestion.providers.buses import BusProvider
from ingestion.providers.locations import LocationProvider
from ingestion.providers.tii import TIIProvider


async def run(post: bool = True) -> None:
    tii, buses, locations = TIIProvider(), BusProvider(), LocationProvider()
    cameras = await tii.get_cameras()
    observations = [await tii.get_latest_observation(camera.id) for camera in cameras]
    transport = await buses.get_observations()
    await locations.get_locations()
    async with httpx.AsyncClient(base_url=os.getenv("BACKEND_URL", "http://localhost:8000")) as client:
        previous_incidents = []
        if post:
            response = await client.get("/api/incidents")
            response.raise_for_status()
            previous_incidents = [Incident.model_validate(item) for item in response.json()]
            for path, items in (("/api/cameras", cameras), ("/api/transport", transport)):
                for item in items:
                    response = await client.post(path, json=item.model_dump(mode="json"))
                    response.raise_for_status()
        for observation in observations:
            if post:
                response = await client.post("/api/observations", json=observation.model_dump(mode="json"))
                response.raise_for_status()
            detections = analyze_observation(observation)
            incidents = correlate_detections(detections, observation, previous_incidents, transport=transport)
            previous_incidents = [item for item in previous_incidents if item.id not in {event.id for event in incidents}] + incidents
            print(f"{observation.id}: {len(detections)} detection(s), {len(incidents)} incident(s)")
            if post:
                for endpoint, models in (("/api/detections", detections), ("/api/incidents", incidents)):
                    for model in models:
                        response = await client.post(endpoint, json=model.model_dump(mode="json"))
                        response.raise_for_status()
    print(f"DEMO DATA: {len(cameras)} cameras, {len(transport)} transport records, {len(observations)} observations" + (" posted" if post else " (offline)"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--post", action="store_true", help="POST data to backend (default)")
    mode.add_argument("--dry-run", action="store_true", help="Run offline")
    args = parser.parse_args()
    asyncio.run(run(post=not args.dry_run))


if __name__ == "__main__":
    main()
