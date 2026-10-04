from fastapi.testclient import TestClient

from backend.app.database.repository import MemoryRepository
from backend.app.main import create_app

client = TestClient(create_app(MemoryRepository()))


def test_demo_reads_and_map():
    assert client.get("/health").json() == {"status": "ok"}
    assert len(client.get("/api/cameras").json()) == 5
    assert len(client.get("/api/map").json()["incidents"]) == 1


def test_not_found_and_parent_validation():
    assert client.get("/api/cameras/missing").status_code == 404
    observation = {
        "id": "orphan", "camera_id": "missing", "timestamp": "2026-10-04T10:00:00Z",
        "image_url": "image.jpg", "location": {"id": "loc", "name": "Dublin", "latitude": 53.3, "longitude": -6.2},
    }
    assert client.post("/api/observations", json=observation).status_code == 404


def test_posts_upsert_and_enforce_contracts():
    camera = client.get("/api/cameras").json()[0]
    observation = client.get(f"/api/cameras/{camera['id']}/observations").json()[0]
    detection = {"id": "test_detection", "observation_id": observation["id"], "type": "heavy_traffic", "confidence": 0.8, "label": "Heavy traffic", "metadata": {}}
    assert client.post("/api/detections", json=detection).status_code == 201
    assert client.post("/api/detections", json=detection).status_code == 201
    invalid = {**detection, "id": "bad", "confidence": 2}
    assert client.post("/api/detections", json=invalid).status_code == 422


def test_sqlite_repository_persists_records(tmp_path):
    from backend.app.database.repository import SQLAlchemyRepository
    from shared.demo import CAMERAS, INCIDENTS, OBSERVATIONS

    database_url = f"sqlite:///{tmp_path / 'test.db'}"
    first = SQLAlchemyRepository(database_url)
    assert len(first.list("cameras")) == 5
    incident = INCIDENTS[0].model_copy(update={"id": "sqlite_reopen_check"})
    first.upsert("incidents", incident)

    camera = CAMERAS[0].model_copy(update={"id": "sqlite_camera_check"})
    observation = OBSERVATIONS[0].model_copy(
        update={"id": "sqlite_observation_check", "camera_id": camera.id}
    )
    first.upsert("cameras", camera)
    first.upsert("observations", observation)

    reopened = SQLAlchemyRepository(database_url)
    assert reopened.get("incidents", "sqlite_reopen_check") == incident.model_dump(mode="json")
    assert reopened.get("cameras", camera.id) == camera.model_dump(mode="json")
    assert reopened.get("observations", observation.id) == observation.model_dump(mode="json")


def test_api_writes_camera_and_observation_to_sqlite(tmp_path):
    from backend.app.database.repository import SQLAlchemyRepository

    database_url = f"sqlite:///{tmp_path / 'api.db'}"
    repository = SQLAlchemyRepository(database_url)
    database_client = TestClient(create_app(repository))

    camera = {
        "id": "api_camera_persisted",
        "provider": "manual",
        "name": "Persistence test camera",
        "location": {
            "id": "api_location_persisted",
            "name": "Dublin",
            "latitude": 53.3498,
            "longitude": -6.2603,
        },
        "image_url": "/demo-camera.svg",
        "last_updated": "2026-10-04T12:00:00Z",
    }
    observation = {
        "id": "api_observation_persisted",
        "camera_id": camera["id"],
        "timestamp": "2026-10-04T12:01:00Z",
        "image_url": "/demo-camera.svg",
        "location": camera["location"],
    }

    assert database_client.post("/api/cameras", json=camera).status_code == 201
    assert database_client.post("/api/observations", json=observation).status_code == 201
    assert database_client.get(
        f"/api/cameras/{camera['id']}/observations"
    ).json() == [observation]

    reopened = SQLAlchemyRepository(database_url)
    assert reopened.get("cameras", camera["id"]) == camera
    assert reopened.get("observations", observation["id"]) == observation
