'use client';

import { useEffect, useState } from 'react';
import { errorMessage, request, type ApiClient } from '../lib/api';
import { dateTime } from '../lib/presentation';
import { useObservations } from '../hooks/useDashboard';
import type { Camera, Detection } from '../types';
import { Snapshot } from './Snapshot';

export function CameraDetails({ camera, observationId, client, refreshKey, onBack, onRefresh }: { camera: Camera; observationId?: string; client: ApiClient; refreshKey: string | null; onBack?: () => void; onRefresh?: () => void }) {
  const history = useObservations(client, [camera.id], refreshKey);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
  const [detections, setDetections] = useState<Detection[]>([]);
  const [detectionError, setDetectionError] = useState('');
  const [sightings, setSightings] = useState<Detection[]>([]);
  const [selected, setSelected] = useState(observationId ?? 'latest');
  const [analysis, setAnalysis] = useState<{ status: string; error?: string; vehicle_count?: number } | null>(null);
  const newest = history.observations[0];
  const observation = selected === 'latest' ? newest : history.observations.find((item) => item.id === selected);
  const missing = selected !== 'latest' && !observation;
  const imageTime = observation?.timestamp ?? camera.last_updated;
  const evidenceId = observation?.id ?? (selected === 'latest' && newest?.image_url === camera.image_url ? newest.id : undefined);
  useEffect(() => {
    const controller = new AbortController();
    setDetections([]); setDetectionError('');
    setAnalysis(null);
    if (evidenceId) void request<{ status: string; error?: string }>('/api/observations/' + encodeURIComponent(evidenceId) + '/analysis', { signal: controller.signal }).then((value) => { if (!controller.signal.aborted) setAnalysis(value); }).catch((error) => { if (!controller.signal.aborted) setDetectionError(errorMessage(error)); });
    if (evidenceId) void client.detections(evidenceId, controller.signal).then((items) => {
      if (!controller.signal.aborted) setDetections(items);
    }).catch((error) => { if (!controller.signal.aborted) setDetectionError(errorMessage(error)); });
    return () => controller.abort();
  }, [client, evidenceId, refreshKey]);
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get('snapshot') as File;
    const capturedAt = String(data.get('captured_at'));
    if (!file?.size || !capturedAt) { setUploadError('Choose an image and its capture time.'); return; }
    if (file.size > 10 * 1024 * 1024) { setUploadError('Choose an image smaller than 10 MB.'); return; }
    setUploading(true); setUploadError(''); setUploadMessage('');
    try {
      const saved = await client.uploadSnapshot(camera.id, file, new Date(capturedAt).toISOString());
      setSelected(saved.id); history.retry(); onRefresh?.(); form.reset();
      setUploadMessage('Snapshot stored and queued for automatic AI scanning.');
    } catch (error) { setUploadError(errorMessage(error)); }
    finally { setUploading(false); }
  }
  return <>
    {onBack && <button className="text-button back-button" onClick={onBack}>← Back to incident</button>}
    <div className="detail-tags"><span className="badge">{camera.provider}</span><span className="badge">{camera.location.name}</span></div>
    {missing ? <div className="empty-state">{history.loading ? 'Loading evidence…' : 'Evidence unavailable. This observation is not in the camera history.'}</div> :
      <><Snapshot key={imageTime} src={observation?.image_url ?? camera.image_url} name={camera.name} className="detail-snapshot" />
        <p className="image-caption">Snapshot timestamp <time dateTime={imageTime}>{dateTime(imageTime)}</time>{camera.provider === 'TII' ? ' · provider capture times unknown; uploads use the supplied time' : ''}</p></>}
    <section className="detail-section"><h3>Vehicle detections</h3>
      {analysis && <p role="status">Analysis: {analysis.status}{analysis.error && ' · ' + analysis.error}</p>}
      <p className="muted">IDs persist per camera. Appearance matches are heuristic.</p>
      {analysis?.status === 'failed' && evidenceId && <button onClick={() => void request('/api/observations/' + encodeURIComponent(evidenceId) + '/analyze', { method: 'POST' }).then(() => onRefresh?.()).catch((error) => setDetectionError(errorMessage(error)))}>Retry scan</button>}
      {detectionError ? <p role="status">{detectionError}</p> : detections.length ? <ul>{detections.map((item) => <li key={item.id}>{typeof item.metadata.vehicle_id === 'string' ? <button className="text-button" onClick={() => void request<Detection[]>('/api/vehicles/' + encodeURIComponent(String(item.metadata.vehicle_id)) + '/sightings').then(setSightings).catch((error) => setDetectionError(errorMessage(error)))}>{item.label}</button> : item.label} · {Math.round(item.confidence * 100)}% detection confidence{typeof item.metadata.identity_confidence === 'number' && <> · {Math.round(item.metadata.identity_confidence * 100)}% identity confidence</>}</li>)}</ul> : <p className="muted">No vehicles detected, or analysis is pending.</p>}
    </section>
    {sightings.length > 0 && <section className="detail-section"><h3>Vehicle sightings</h3><p className="muted">{String(sightings[0].metadata.vehicle_id)} · {sightings.length} stored sightings on this camera</p>{sightings.map((item) => <button key={item.id} className="observation-row" onClick={() => setSelected(item.observation_id)}>Open snapshot {item.observation_id}</button>)}</section>}
    {client.source === 'api' && <form className="detail-section snapshot-upload" onSubmit={(event) => void upload(event)}><h3>Upload snapshot</h3>
      <label>Snapshot image<input name="snapshot" type="file" accept="image/jpeg,image/png,image/webp" required disabled={uploading} /></label>
      <label>Captured at (your local time)<input name="captured_at" type="datetime-local" required disabled={uploading} /></label>
      <p className="muted">JPEG, PNG or WebP, up to 10 MB and 20 megapixels. Older snapshots remain in history.</p>
      <button className="secondary-button" disabled={uploading}>{uploading ? 'Saving snapshot…' : 'Save snapshot'}</button>
      {uploadError && <p role="alert">{uploadError}</p>}{uploadMessage && <p role="status">{uploadMessage}</p>}
    </form>}
    <section className="detail-section"><h3>Observation history <span className="heading-count">{history.observations.length}</span></h3><p className="muted">Newest first. Select an observation to inspect an earlier snapshot.</p>
      {history.error && <div className="notice notice-warning" role="status">{history.error}<button className="text-button" onClick={history.retry}>Retry history</button></div>}
      <div className="observation-list">
        <button className={'observation-row' + (selected === 'latest' ? ' selected' : '')} aria-pressed={selected === 'latest'} onClick={() => { setSelected('latest'); }}><span>Latest available snapshot</span><span>↗</span></button>
        {history.observations.map((item) => <button key={item.id} className={'observation-row' + (selected === item.id ? ' selected' : '')} aria-pressed={selected === item.id} onClick={() => { setSelected(item.id); }}><span><time dateTime={item.timestamp}>{dateTime(item.timestamp)}</time><small>{item.id}</small></span><span aria-hidden="true">↗</span></button>)}
      </div>
      {!history.loading && !history.observations.length && <p className="muted">No observations available.</p>}
      {history.loading && <p role="status" className="muted">Loading observation history…</p>}
    </section>
  </>;
}
