'use client';

import { useState } from 'react';
import { request, type ApiClient, errorMessage } from '../lib/api';
import { dateTime, humanize } from '../lib/presentation';
import { useObservations } from '../hooks/useDashboard';
import type { Camera, Incident } from '../types';
import { Snapshot } from './Snapshot';

export function IncidentDetails({ incident, cameras, client, refreshKey, onCamera, onRefresh }: {
  incident: Incident; cameras: Camera[]; client: ApiClient; refreshKey: string | null;
  onCamera: (id: string, observationId?: string) => void; onRefresh: () => void;
}) {
  const history = useObservations(client, incident.camera_ids, refreshKey);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isResolved = incident.status === 'resolved';
  async function update() {
    setPending(true); setError(null);
    try { await request('/api/incidents/' + encodeURIComponent(incident.id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: isResolved ? 'active' : 'resolved' }) }); onRefresh(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setPending(false); }
  }
  return <>
    <div className="detail-tags"><span className={'severity-tag tag-' + incident.severity}>{incident.severity}</span><span className="badge">{isResolved ? 'Resolved' : 'Active'}</span><span className="badge">{humanize(incident.type)}</span></div>
    <p className="incident-full-description">{incident.description}</p>
    <dl className="detail-facts"><dt>Location</dt><dd>{incident.location.name}</dd><dt>Confidence</dt><dd>{Math.round(incident.confidence * 100)}%</dd><dt>First seen</dt><dd>{dateTime(incident.first_seen)}</dd><dt>Last observed</dt><dd>{dateTime(incident.last_seen)}</dd></dl>
    <div className="button-row"><button className="secondary-button" disabled={pending} onClick={() => void update()}>{pending ? 'Saving…' : isResolved ? 'Reopen incident' : 'Resolve incident'}</button></div>
    {error && <p role="alert">{error}</p>}
    <section className="detail-section"><h3>Linked cameras</h3><div className="linked-cameras">{incident.camera_ids.map((id) => {
      const camera = cameras.find((item) => item.id === id);
      return camera ? <button key={id} className="secondary-button" onClick={() => onCamera(id)}>{camera.name} ↗</button> : <p key={id} className="muted">Camera unavailable · {id}</p>;
    })}</div>{!incident.camera_ids.length && <p className="muted">No linked cameras.</p>}</section>
    <section className="detail-section"><h3>Observation evidence</h3>
      {history.error && <p className="notice notice-warning">{history.error} <button className="text-button" onClick={history.retry}>Retry evidence</button></p>}
      {!incident.related_observation_ids.length && <p className="empty-state">Evidence unavailable. No observations were linked.</p>}
      <div className="evidence-grid">{incident.related_observation_ids.map((id) => {
        const observation = history.observations.find((item) => item.id === id);
        const camera = cameras.find((item) => item.id === observation?.camera_id);
        return observation ? <article className="evidence-card" key={id}><Snapshot src={observation.image_url} name={camera?.name ?? observation.camera_id} /><time dateTime={observation.timestamp}>{dateTime(observation.timestamp)}</time>{camera ? <button className="text-button" onClick={() => onCamera(camera.id, id)}>Open camera evidence ↗</button> : <span className="muted">Camera unavailable</span>}</article> :
          <div className="empty-evidence" key={id}>{history.loading ? 'Loading evidence…' : 'Evidence unavailable'}<small>{id}</small></div>;
      })}</div>
    </section>
  </>;
}
