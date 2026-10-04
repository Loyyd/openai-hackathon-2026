'use client';

import { useState } from 'react';
import { ApiError, type ApiClient, errorMessage } from '../lib/api';
import { dateTime, humanize, resolved } from '../lib/presentation';
import { useObservations, type Session } from '../hooks/useDashboard';
import type { Camera, DataSource, Incident, IncidentWorkflow, WorkflowPatch, WorkflowStatus } from '../types';
import { Snapshot } from './Snapshot';

export function IncidentDetails({ incident, workflow, workflowStatus, cameras, client, session, source, refreshKey, onLogin, onCamera, onSave }: {
  incident: Incident; workflow?: IncidentWorkflow; workflowStatus: WorkflowStatus; cameras: Camera[]; client: ApiClient; session: Session; source: DataSource; refreshKey: string | null;
  onLogin: () => void; onCamera: (id: string, observationId?: string) => void; onSave: (id: string, patch: WorkflowPatch) => Promise<IncidentWorkflow>;
}) {
  const history = useObservations(client, incident.camera_ids, refreshKey);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const isResolved = resolved(incident, workflow);
  const available = workflowStatus === 'ready';
  const save = async (patch: WorkflowPatch) => {
    setPending(true); setError(null); setSaved(null);
    try {
      await onSave(incident.id, patch);
      setSaved(source === 'demo' ? 'Simulated change saved for this tab.' : 'Change saved.');
    } catch (cause) {
      setError(errorMessage(cause));
      if (cause instanceof ApiError && cause.status === 401) session.expire();
    } finally { setPending(false); }
  };
  const assignee = workflow?.assignee;
  return <>
    <div className="detail-tags"><span className={'severity-tag tag-' + incident.severity}>{incident.severity}</span><span className="badge">{isResolved ? 'Resolved' : workflow?.acknowledged_at ? 'Acknowledged' : 'Active'}</span><span className="badge">{humanize(incident.type)}</span></div>
    <p className="incident-full-description">{incident.description}</p>
    <dl className="detail-facts"><dt>Location</dt><dd>{incident.location.name}</dd><dt>Confidence</dt><dd>{Math.round(incident.confidence * 100)}%</dd><dt>First seen</dt><dd>{dateTime(incident.first_seen)}</dd><dt>Last observed</dt><dd>{dateTime(incident.last_seen)}</dd></dl>
    <section className="detail-section"><h3>Operator workflow</h3>
      {source === 'demo' && <p className="simulation-label">SIMULATED · saved in this browser tab</p>}
      {!available && <p className="notice notice-warning" role="status">{workflowStatus === 'stale' ? 'Workflow is stale. Last known details are shown; refresh before saving.' : 'Workflow unavailable. Assignment and operator actions cannot be confirmed.'}</p>}
      <dl className="detail-facts"><dt>Assignee</dt><dd>{assignee?.display_name ?? (available ? 'Unassigned' : 'Unavailable')}</dd><dt>Acknowledged</dt><dd>{workflow?.acknowledged_at ? (workflow.acknowledged_by?.display_name ?? 'Operator') + ' · ' + dateTime(workflow.acknowledged_at) : available ? 'Not yet acknowledged' : 'Unavailable'}</dd><dt>Resolved</dt><dd>{workflow?.resolved_at ? (workflow.resolved_by?.display_name ?? 'Operator') + ' · ' + dateTime(workflow.resolved_at) : incident.status === 'resolved' ? 'Resolved by source analysis' : available ? 'Not resolved' : 'Unavailable'}</dd></dl>
      {!session.user ? <div className="notice"><span>Public viewing. Sign in to manage this incident.</span><button className="secondary-button" onClick={onLogin}>Sign in to manage</button></div> : <div className="workflow-form">
        <label>Assign operator<select aria-label="Assign operator" value={assignee?.id ?? ''} disabled={pending || !available || Boolean(session.rosterError) || !session.users.length} onChange={(event) => void save({ assignee_id: event.target.value || null })}><option value="">Unassigned</option>{assignee && !session.users.some((item) => item.id === assignee.id) && <option value={assignee.id}>{assignee.display_name}</option>}{session.users.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select></label>
        {session.rosterError && <p className="inline-error">Assignee roster unavailable. <button className="text-button" onClick={() => void session.check()}>Retry operators</button></p>}
        <div className="button-row"><button className="secondary-button" disabled={pending || !available || Boolean(workflow?.acknowledged_at) || isResolved} onClick={() => void save({ action: 'acknowledge' })}>Acknowledge</button><button className="primary-button" disabled={pending || !available || isResolved} onClick={() => void save({ action: 'resolve' })}>{isResolved ? 'Resolved' : 'Resolve incident'}</button></div>
      </div>}
      {pending && <p role="status" className="muted">Saving change…</p>}{error && <p role="alert" className="inline-error">{error} Your change was not saved.</p>}{saved && <p role="status" className="save-success">{saved}</p>}
    </section>
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
