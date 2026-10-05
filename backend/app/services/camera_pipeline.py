"""One serialized worker owns inference and camera-scoped identity registries.

Stored bytes are the source of inference. Analysis state, fingerprints and
results are committed atomically so restart/retry cannot duplicate identities.
"""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import logging
import os
import threading
import time
from uuid import uuid4
from urllib.parse import urlsplit

from shared.models import Camera, CameraObservation, Detection, Incident, Location
from ingestion.providers.live_cameras import catalog, snapshots

logger = logging.getLogger(__name__)


def now():
    return datetime.now(timezone.utc).isoformat()


class CameraPipeline:
    def __init__(self, service, processor_factory=None):
        self.service = service
        self.repo = service.repository
        self.factory = processor_factory
        self.processor = None
        self.stop_event = threading.Event()
        self.wake = threading.Event()
        self.capture_requested = threading.Event()
        self.lock = threading.RLock()
        self.process_lock = threading.Lock()
        self.state = {'running': False, 'capturing': False, 'processing': None, 'last_capture': None, 'error': None}
        self.thread = None
        self.capture_thread = None
        self.retry_requested = set()

    def start(self):
        self.thread = threading.Thread(target=self.run, name='camera-pipeline', daemon=True)
        self.thread.start()
        self.capture_thread = threading.Thread(target=self.capture_loop, name="camera-collector", daemon=True)
        self.capture_thread.start()

    def stop(self):
        self.stop_event.set()
        self.wake.set()
        self.capture_requested.set()
        if self.capture_thread:
            self.capture_thread.join()
        if self.thread:
            self.thread.join()

    def status(self):
        with self.lock:
            result = dict(self.state)
        states = self.repo.records('analysis')
        stored = self.stored_observations()
        analysis_by_id = {item['observation_id']: item for item in states}
        result.update(stored_snapshots=len(stored), completed=sum(item.get('status') == 'completed' for item in states),
                      failed=sum(item.get('status') == 'failed' for item in states),
                      pending=sum(analysis_by_id.get(item['id'], {}).get('status', 'queued') == 'queued' for item in stored),
                      vehicles=self.repo.count_records('vehicle'), poll_seconds=max(30, int(os.getenv('CAMERA_POLL_SECONDS', '60'))))
        return result

    def stored_observations(self):
        return sorted([item for item in self.repo.list('observations') if urlsplit(item['image_url']).path.startswith('/api/snapshots/')], key=lambda item: (item['timestamp'], item['id']))

    def queue(self, observation_id):
        self.service.get('observations', observation_id, 'Observation')
        with self.lock:
            state = self.repo.get_record('analysis', observation_id)
            if not state or state.get('status') != 'completed':
                self.retry_requested.add(observation_id)
        self.wake.set()
        return state or {'observation_id': observation_id, 'status': 'queued'}

    def capture(self):
        self.capture_requested.set()
        self.wake.set()
        return {'status': 'queued'}

    def capture_once(self):
        self.state.update(capturing=True, error=None)
        saved = skipped = failed = 0
        try:
            items = catalog()
            for raw, data, error in snapshots(items):
                if self.stop_event.is_set():
                    break
                camera_id = 'tii_' + str(raw['id'])
                location = raw.get('location') or {}
                if location.get('latitude') is None or location.get('longitude') is None:
                    continue
                current = self.repo.get('cameras', camera_id)
                camera = Camera(id=camera_id, provider='TII', name=raw.get('name') or camera_id,
                                location=Location(id=camera_id, name=raw.get('name') or camera_id, latitude=location['latitude'], longitude=location['longitude']),
                                image_url=current['image_url'] if current else '',
                                last_updated=current['last_updated'] if current else datetime(1970, 1, 1, tzinfo=timezone.utc))
                if current is None:
                    self.repo.upsert('cameras', camera)
                if error:
                    failed += 1
                    self.repo.put_record('capture', camera_id, {**(self.repo.get_record('capture', camera_id) or {}), 'camera_id': camera_id, 'status': 'failed', 'error': error, 'retrieved_at': now()})
                    continue
                digest = hashlib.sha256(data).hexdigest()
                previous = self.repo.get_record('capture', camera_id)
                if previous and previous.get('sha256') == digest:
                    if previous.get('status') == 'failed':
                        self.repo.put_record('capture', camera_id, {**previous, 'status': 'stored', 'error': None, 'retrieved_at': now()})
                    skipped += 1
                    continue
                try:
                    observation = self.service.upload_snapshot(camera_id, datetime.now(timezone.utc), data, '/api/snapshots/' + uuid4().hex)
                    self.repo.put_record('capture', camera_id, {'camera_id': camera_id, 'status': 'stored', 'sha256': digest, 'observation_id': observation['id'], 'retrieved_at': now(), 'timestamp_source': 'retrieval; provider capture time unknown'})
                    saved += 1
                except ValueError as exc:
                    failed += 1
                    self.repo.put_record('capture', camera_id, {'camera_id': camera_id, 'status': 'failed', 'error': str(exc), 'retrieved_at': now()})
            self.state['last_capture'] = {'at': now(), 'stored': saved, 'unchanged': skipped, 'failed': failed}
            self.wake.set()
        finally:
            self.state['capturing'] = False

    def _processor(self):
        if self.processor is None:
            if self.factory:
                self.processor = self.factory()
            else:
                from algorithms.vehicles.config import VideoConfig
                from algorithms.vehicles.processor import VehicleProcessor
                self.processor = VehicleProcessor(VideoConfig(weights=os.getenv('VEHICLE_WEIGHTS', 'yolo11m.pt'), device=os.getenv('VEHICLE_DEVICE', 'auto'),
                                                               ocr=False, confidence=.25, recognition_interval=0))
        return self.processor

    def process(self, observation_id):
        with self.process_lock:
            state = self.repo.get_record('analysis', observation_id)
            if state and state.get('status') == 'completed':
                return state
            self.state['processing'] = observation_id
            observation = CameraObservation.model_validate(self.service.get('observations', observation_id, 'Observation'))
            snapshot_id = observation.image_url.rsplit('/', 1)[-1]
            old_registry = None
            processor = None
            try:
                _, path = self.service.snapshot_file(snapshot_id)
                processor = self._processor()
                from algorithms.vehicles.matcher import IdentityRegistry, MatchConfig
                from algorithms.vehicles.models import VehicleFingerprint
                import cv2
                import numpy as np
                registry = IdentityRegistry(MatchConfig(match_threshold=.94, ambiguity_margin=.1))
                for payload in self.repo.records('vehicle', observation.camera_id):
                    fp = VehicleFingerprint(payload['vehicle_id'])
                    fp.embedding = np.asarray(payload['embedding'], dtype=np.float32) if payload.get('embedding') is not None else None
                    fp.first_seen, fp.last_seen = payload.get('first_seen'), payload.get('last_seen')
                    fp.observation_count = payload.get('observation_count', 0)
                    fp._colors.update(payload.get('colors', {})); fp._color_counts.update(payload.get('color_counts', {}))
                    # Five-minute snapshots offer no continuous tracker evidence.
                    if fp.last_seen is not None and abs(observation.timestamp.timestamp() - fp.last_seen) <= 600:
                        registry.fingerprints[fp.vehicle_id] = fp
                old_registry = processor.registry
                processor.registry = registry
                image = cv2.imread(str(path))
                if image is None:
                    raise ValueError('Stored image could not be decoded')
                # UUID namespace prevents new IDs colliding after expired candidates.
                namespace = hashlib.sha256(observation.camera_id.encode()).hexdigest()[:8]
                registry._next_id = 1
                result = processor.process_snapshot(image, observation.camera_id, observation.timestamp.timestamp())
                detections, records = [], []
                for index, vehicle in enumerate(result['vehicles']):
                    old_id = vehicle['vehicle_id']
                    if old_id.startswith('VX-') and len(old_id.split('-')) == 2:
                        fp = registry.fingerprints.pop(old_id)
                        new_id = f'VX-{namespace}-{uuid4().hex[:12]}'
                        fp.vehicle_id = new_id
                        registry.fingerprints[new_id] = fp
                        vehicle['vehicle_id'] = new_id
                    fp = registry.fingerprints[vehicle['vehicle_id']]
                    payload = fp.to_dict()
                    payload.update(camera_id=observation.camera_id, embedding=fp.embedding.tolist() if fp.embedding is not None else None,
                                   colors=dict(fp._colors), color_counts=dict(fp._color_counts))
                    records.append(('vehicle', fp.vehicle_id, payload))
                    vehicle.update(identity_scope='camera', matching='heuristic appearance; not verified identity', model=processor.config.weights,
                                   embedding_backend=processor.encoder.backend)
                    detections.append(Detection(id=f'{observation.id}_vehicle_{index}', observation_id=observation.id, type='vehicle',
                                                label=f"{vehicle['class_name']} · {vehicle['vehicle_id']}", confidence=vehicle['detection_confidence'], metadata=vehicle))
                incidents = []
                # Counts flag a review candidate, never assert an accident from vehicles alone.
                if len(detections) >= int(os.getenv('CONGESTION_REVIEW_THRESHOLD', '12')):
                    incident_id = 'congestion_' + observation.camera_id
                    previous = self.repo.get('incidents', incident_id)
                    incidents.append(Incident(id=incident_id, type='traffic_density', title='High vehicle density · review required',
                                              description=f'{len(detections)} vehicles detected in a stored snapshot. This is a density heuristic; congestion and collisions are not confirmed.',
                                              severity='low', confidence=min(item.confidence for item in detections), location=observation.location,
                                              camera_ids=[observation.camera_id], related_observation_ids=([*previous.get('related_observation_ids', []), observation.id][-20:] if previous else [observation.id]),
                                              first_seen=previous['first_seen'] if previous else observation.timestamp,
                                              last_seen=observation.timestamp, status='active', metadata={'heuristic': True, 'vehicle_count': len(detections)}))
                state = {'observation_id': observation.id, 'status': 'completed', 'vehicle_count': len(detections), 'completed_at': now(), 'model': processor.config.weights}
                records.append(('analysis', observation.id, state))
                self.repo.complete_analysis(detections, incidents, records)
                return state
            except Exception as exc:
                logger.exception('Snapshot processing failed: %s', observation_id)
                state = {'observation_id': observation_id, 'status': 'failed', 'error': str(exc), 'updated_at': now()}
                self.repo.put_record('analysis', observation_id, state)
                return state
            finally:
                if processor and old_registry is not None:
                    processor.registry = old_registry
                self.state['processing'] = None

    def capture_loop(self):
        next_capture = 0.0
        while not self.stop_event.is_set():
            automatic = os.getenv('CAMERA_INGESTION_ENABLED', 'true').lower() == 'true'
            if (automatic and time.monotonic() >= next_capture) or self.capture_requested.is_set():
                self.capture_requested.clear()
                try:
                    self.capture_once()
                except Exception as exc:
                    self.state['error'] = str(exc)
                    logger.exception('Camera ingestion failed')
                next_capture = time.monotonic() + max(30, int(os.getenv('CAMERA_POLL_SECONDS', '60')))
            self.capture_requested.wait(1)

    def run(self):
        self.state['running'] = True
        try:
            while not self.stop_event.is_set():
                for item in self.stored_observations():
                    if self.stop_event.is_set():
                        break
                    state = self.repo.get_record('analysis', item['id'])
                    with self.lock:
                        retry = item['id'] in self.retry_requested
                        self.retry_requested.discard(item['id'])
                    if not state or state.get('status') == 'queued' or (retry and state.get('status') != 'completed'):
                        self.process(item['id'])
                self.wake.wait(2)
                self.wake.clear()
        finally:
            self.state['running'] = False
