"""Cross-component regressions for the transport and persistence PR integration."""
import base64
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.database.repository import MemoryRepository, SQLAlchemyRepository
from backend.app.main import create_app
from backend.app.models import JSONRecord
from shared.demo import CAMERAS, OBSERVATIONS, INCIDENTS, TRANSPORT
from shared.models import Detection

PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC')


def test_legacy_database_migrates_without_resetting_updated_records(tmp_path):
    url = f"sqlite:///{tmp_path}/legacy.db"
    engine = create_engine(url)
    JSONRecord.__table__.create(engine)
    detection = Detection(id='legacy-detection', observation_id=OBSERVATIONS[0].id, type='vehicle', confidence=.8, label='Vehicle')
    with Session(engine) as session, session.begin():
        for kind, records in [('cameras', CAMERAS), ('observations', OBSERVATIONS), ('detections', [detection]), ('incidents', INCIDENTS), ('transport', TRANSPORT)]:
            for record in records:
                session.add(JSONRecord(kind=kind, id=record.id, payload=record.model_dump(mode='json')))
    repo = SQLAlchemyRepository(url)
    assert repo.get('observations', OBSERVATIONS[0].id) == OBSERVATIONS[0].model_dump(mode='json')
    assert repo.get('detections', detection.id) == detection.model_dump(mode='json')
    assert repo.get('incidents', INCIDENTS[0].id) == INCIDENTS[0].model_dump(mode='json')
    assert repo.get('transport', TRANSPORT[0].id) == TRANSPORT[0].model_dump(mode='json')
    updated = CAMERAS[0].model_copy(update={'name': 'Updated after migration'})
    repo.upsert('cameras', updated)
    reopened = SQLAlchemyRepository(url)
    assert reopened.get('cameras', updated.id)['name'] == updated.name
    assert len(reopened.list('cameras')) == len(CAMERAS)


@pytest.mark.parametrize('storage', ['memory', 'sqlite'])
def test_snapshot_history_detection_and_portable_urls(tmp_path, monkeypatch, storage):
    monkeypatch.setenv('SNAPSHOT_STORAGE_DIR', str(tmp_path / 'uploads'))
    url = f"sqlite:///{tmp_path}/snapshots.db"
    repo = MemoryRepository() if storage == 'memory' else SQLAlchemyRepository(url)
    camera = CAMERAS[0].model_copy(update={'last_updated': datetime(2025, 1, 1, tzinfo=timezone.utc)})
    repo.upsert('cameras', camera)
    client = TestClient(create_app(repo))
    def upload(at):
        return client.post(f'/api/cameras/{camera.id}/snapshots', data={'captured_at': at}, files={'file': ('snapshot.png', PNG, 'image/png')})
    result = upload('2026-10-04T14:00:00Z')
    assert result.status_code == 201, result.text
    newest = result.json()
    assert newest['image_url'].startswith('/api/snapshots/')
    assert client.get(newest['image_url']).content == PNG
    older = upload('2026-10-03T14:00:00Z').json()
    assert client.get(f'/api/cameras/{camera.id}').json()['image_url'] == newest['image_url']
    assert older['id'] in {item['id'] for item in client.get(f'/api/cameras/{camera.id}/observations').json()}
    detection = {'id':'uploaded-detection','observation_id':newest['id'],'type':'vehicle','confidence':.9,'label':'Vehicle','metadata':{}}
    assert client.post('/api/detections', json=detection).status_code == 201
    assert client.get(f'/api/observations/{newest["id"]}/detections').json() == [detection]
    assert detection in client.get('/api/detections').json()
    assert client.get('/api/observations/missing/detections').status_code == 404
    if storage == 'sqlite':
        reopened = TestClient(create_app(SQLAlchemyRepository(url)))
        assert reopened.get(newest['image_url']).content == PNG
        assert reopened.get(f'/api/observations/{newest["id"]}/detections').json() == [detection]
    invalid = client.post(f'/api/cameras/{camera.id}/snapshots', data={'captured_at':'2026-10-04T14:00:00Z'}, files={'file':('bad.png',b'not an image','image/png')})
    assert invalid.status_code == 415
    truncated = client.post(f'/api/cameras/{camera.id}/snapshots', data={'captured_at':'2026-10-04T14:00:00Z'}, files={'file':('bad.png',PNG[:20],'image/png')})
    assert truncated.status_code == 415

