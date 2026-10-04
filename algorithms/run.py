"""Run the fixture-backed algorithms pipeline; use --post to send results."""
import argparse
import asyncio
import os

import httpx

from algorithms.correlation.pipeline import correlate_detections
from algorithms.detection.pipeline import analyze_observation
from shared.demo import OBSERVATIONS, TRANSPORT
from shared.models import Incident


async def run(post: bool = False) -> tuple[int, int]:
    observations = OBSERVATIONS
    transport = TRANSPORT
    detections_count = incidents_count = 0
    async with httpx.AsyncClient(base_url=os.getenv("BACKEND_URL", "http://localhost:8000")) as client:
        previous_incidents = []
        if post:
            response = await client.get("/api/incidents")
            response.raise_for_status()
            previous_incidents = [Incident.model_validate(item) for item in response.json()]
        for observation in observations:
            detections = analyze_observation(observation)
            incidents = correlate_detections(detections, observation, previous_incidents, transport=transport)
            previous_incidents = [item for item in previous_incidents if item.id not in {event.id for event in incidents}] + incidents
            detections_count += len(detections)
            incidents_count += len(incidents)
            print(f"{observation.id}: {len(detections)} detection(s), {len(incidents)} incident(s)")
            if post:
                for payload, path in [
                    *((item, "/api/detections") for item in detections),
                    *((item, "/api/incidents") for item in incidents),
                ]:
                    response = await client.post(path, json=payload.model_dump(mode="json"))
                    response.raise_for_status()
    print(f"DEMO DATA: {detections_count} detections; {incidents_count} incidents" + (" posted" if post else " (offline)"))
    return detections_count, incidents_count


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--post", action="store_true", help="POST to backend; default is offline")
    mode.add_argument("--dry-run", action="store_true", help="Run without backend calls (default)")
    args = parser.parse_args()
    asyncio.run(run(post=args.post))


if __name__ == "__main__":
    main()
