"""Stored-image processing, restart identity continuity and provider deduplication."""
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import numpy as np
from fastapi.testclient import TestClient

from backend.app.database.repository import SQLAlchemyRepository
from backend.app.main import create_app
from backend.app.services.camera_pipeline import CameraPipeline
from algorithms.vehicles.models import VehicleDetection, ColorResult
from shared.models import Camera, Location
from backend.tests.test_integration import PNG


class Processor:
    def __init__(self):
        self.config = SimpleNamespace(weights='test-model')
        self.encoder = SimpleNamespace(backend='test-embedding')
        self.registry = None
        self.calls = 0

    def process_snapshot(self, image, camera_id, timestamp):
        self.calls += 1
        assert image.shape == (1, 1, 3)  # The actual stored file was decoded.
        detection = VehicleDetection((0, 0, 1, 1), 'car', .9)
        fp, explanation = self.registry.assign(None, detection, np.array([1., 0.]), color=ColorResult('white', .8), timestamp=timestamp)
        item = fp.to_dict()
        item.update(class_name='car', bbox=[0, 0, 1, 1], detection_confidence=.9, identity_confidence=explanation['confidence'], decision=explanation['decision'])
        return {'vehicles': [item]}


def setup(tmp_path, monkeypatch):
    monkeypatch.setenv('SNAPSHOT_STORAGE_DIR', str(tmp_path / 'images'))
    monkeypatch.setenv('CAMERA_WORKER_ENABLED', 'false')
    url = f'sqlite:///{tmp_path}/cameras.db'
    repo = SQLAlchemyRepository(url, seed=False)
    app = create_app(repo)
    processor = Processor()
    pipeline = CameraPipeline(app.state.service, lambda: processor)
    app.state.pipeline = pipeline
    camera = Camera(id='camera_a', name='Camera A', provider='manual', location=Location(id='a', name='A', latitude=53, longitude=-6), image_url='', last_updated=datetime(1970, 1, 1, tzinfo=timezone.utc))
    repo.upsert('cameras', camera)
    return url, repo, app, pipeline, processor


def upload(client, camera_id='camera_a', captured='2026-10-04T12:00:00Z'):
    result = client.post(f'/api/cameras/{camera_id}/snapshots', data={'captured_at': captured}, files={'file': ('snapshot.png', PNG, 'image/png')})
    assert result.status_code == 201
    return result.json()


def test_processing_is_durable_idempotent_and_camera_scoped(tmp_path, monkeypatch):
    url, repo, app, pipeline, processor = setup(tmp_path, monkeypatch)
    client = TestClient(app)
    first = upload(client)
    assert client.get(f'/api/observations/{first["id"]}/analysis').json()['status'] == 'queued'
    assert pipeline.process(first['id'])['status'] == 'completed'
    detected = client.get(f'/api/observations/{first["id"]}/detections').json()[0]
    vehicle_id = detected['metadata']['vehicle_id']
    assert vehicle_id.startswith('VX-')
    assert detected['metadata']['identity_scope'] == 'camera'
    pipeline.process(first['id'])
    assert processor.calls == 1
    assert client.get(f'/api/vehicles/{vehicle_id}/sightings').json() == [detected]
    assert 'embedding' not in client.get('/api/vehicles').json()[0]
    reopened = create_app(SQLAlchemyRepository(url, seed=False))
    resumed = CameraPipeline(reopened.state.service, Processor)
    second = upload(TestClient(reopened), captured='2026-10-04T12:05:00Z')
    assert resumed.process(second['id'])['status'] == 'completed'
    detection = reopened.state.repository.list('detections')[-1]
    assert detection['metadata']['vehicle_id'] == vehicle_id
    assert detection['metadata']['decision'] == 'MATCH'
    camera_b = Camera.model_validate(repo.get('cameras', 'camera_a')).model_copy(update={'id': 'camera_b'})
    reopened.state.repository.upsert('cameras', camera_b)
    third = upload(TestClient(reopened), 'camera_b', '2026-10-04T12:05:00Z')
    resumed.process(third['id'])
    assert reopened.state.repository.list('detections')[-1]['metadata']['vehicle_id'] != vehicle_id
    assert TestClient(reopened).get(first['image_url']).content == PNG


def test_capture_stores_images_and_skips_unchanged_bytes(tmp_path, monkeypatch):
    _, repo, app, pipeline, _ = setup(tmp_path, monkeypatch)
    import backend.app.services.camera_pipeline as module
    raw = {'id': '123', 'name': 'Public camera', 'location': {'latitude': 53, 'longitude': -6}}
    monkeypatch.setattr(module, 'catalog', lambda: [raw])
    monkeypatch.setattr(module, 'snapshots', lambda items: [(raw, PNG, None)])
    pipeline.capture_once()
    pipeline.capture_once()
    observations = repo.list('observations')
    assert len(observations) == 1
    assert observations[0]['image_url'].startswith('/api/snapshots/')
    assert TestClient(app).get(observations[0]['image_url']).content == PNG
    assert pipeline.state['last_capture']['unchanged'] == 1
    assert repo.get_record('capture', 'tii_123')['timestamp_source'].startswith('retrieval')


def test_failures_remain_visible_and_retryable_without_partial_results(tmp_path, monkeypatch):
    _, repo, app, pipeline, processor = setup(tmp_path, monkeypatch)
    client = TestClient(app)
    observation = upload(client)
    original = processor.process_snapshot
    def failed(*args):
        raise RuntimeError('model unavailable')
    processor.process_snapshot = failed
    assert pipeline.process(observation['id'])['status'] == 'failed'
    assert repo.list('detections') == []
    assert client.get('/api/processing').json()['failed'] == 1
    assert client.post(f'/api/observations/{observation["id"]}/analyze').status_code == 202
    processor.process_snapshot = original
    assert pipeline.process(observation['id'])['status'] == 'completed'
    assert client.get('/api/processing').json()['failed'] == 0


def test_density_incident_is_explicit_heuristic_and_resolution_persists(tmp_path, monkeypatch):
    url, _, app, pipeline, _ = setup(tmp_path, monkeypatch)
    monkeypatch.setenv('CONGESTION_REVIEW_THRESHOLD', '1')
    client = TestClient(app)
    observation = upload(client)
    pipeline.process(observation['id'])
    incident = client.get('/api/incidents').json()[0]
    assert incident['metadata']['heuristic'] is True
    assert incident['related_observation_ids'] == [observation['id']]
    assert client.patch('/api/incidents/' + incident['id'], json={'status': 'resolved'}).json()['status'] == 'resolved'
    assert SQLAlchemyRepository(url, seed=False).get('incidents', incident['id'])['status'] == 'resolved'
    assert 'transport' not in client.get('/api/map').json()
    assert client.get('/api/transport').status_code == 404
