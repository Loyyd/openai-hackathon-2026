"""Synthetic DEMO DATA, not live feeds or real incident reports."""
from shared.models import Camera, CameraObservation, Incident, Location, TransportObservation

TIMESTAMP = "2026-10-04T10:00:00Z"
LOCATIONS = [
    Location(id="custom_house", name="Custom House Quay", latitude=53.348, longitude=-6.248),
    Location(id="oconnell", name="O'Connell Street", latitude=53.350, longitude=-6.260),
    Location(id="airport", name="Dublin Airport", latitude=53.427, longitude=-6.243),
    Location(id="dcu", name="DCU Glasnevin", latitude=53.385, longitude=-6.257),
    Location(id="m50", name="M50", latitude=53.365, longitude=-6.374),
]
CAMERAS = [Camera(id=f"demo_cam_{i}", provider="TII DEMO", name=f"{loc.name} — DEMO", location=loc, image_url="/demo-camera.svg", last_updated=TIMESTAMP) for i, loc in enumerate(LOCATIONS)]
OBSERVATIONS = [CameraObservation(id=f"demo_obs_{i}", camera_id=cam.id, timestamp=TIMESTAMP, image_url=cam.image_url, location=cam.location) for i, cam in enumerate(CAMERAS)]
TRANSPORT = [TransportObservation(id="demo_bus_41", provider="transport_for_ireland DEMO", type="bus", route="41", vehicle_id="demo_vehicle", location=LOCATIONS[1], timestamp=TIMESTAMP, speed=18.4, delay_seconds=240, metadata={"demo": True})]
INCIDENTS = [Incident(id="demo_incident", type="traffic_congestion", title="DEMO: Congestion at Custom House Quay", description="Synthetic traffic scenario for development.", severity="medium", confidence=0.87, location=LOCATIONS[0], camera_ids=[CAMERAS[0].id], related_observation_ids=[OBSERVATIONS[0].id], first_seen=TIMESTAMP, last_seen=TIMESTAMP, status="active", metadata={"demo": True})]
