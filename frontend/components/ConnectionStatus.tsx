'use client';

import { useState } from 'react';
import { ChevronDown, Database } from 'lucide-react';
import type { DataSource, MapData, WorkflowStatus } from '../types';
import { dateTime, knownDemo, newestTimestamp, timestamp } from '../lib/presentation';

export function ConnectionStatus({ source, data, error, workflowStatus, workflowError, lastSuccess, refreshing, onRetry, onSource, sessionError }: {
  source: DataSource; data: MapData | null; error: string | null; workflowStatus: WorkflowStatus; workflowError: string | null; lastSuccess: string | null;
  refreshing: boolean; onRetry: () => void; onSource: (source: DataSource) => void; sessionError?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const synthetic = source === 'demo' || Boolean(data && knownDemo(data));
  const newest = data && newestTimestamp([...data.cameras.map((item) => item.last_updated), ...data.incidents.map((item) => item.last_seen), ...data.transport.map((item) => item.timestamp)]);
  const stale = Boolean(newest && timestamp(newest) < Date.now() - 300_000);
  return <section className="connection-area" aria-label="Data connection">
    <div className="connection-line"><span className={'connection-dot' + (error ? ' offline' : !data ? ' pending' : '')} /><strong>{source === 'demo' ? 'Local demo · simulated actions' : error ? 'Backend unavailable' : data ? 'Backend connected' : 'Connecting to backend…'}</strong>{synthetic && <span className="badge synthetic-badge">SYNTHETIC DATA</span>}{stale && <span className="status-warning">Source observations over 5 minutes old</span>}<div className="connection-actions"><button className="text-button source-switch" onClick={() => onSource(source === 'demo' ? 'api' : 'demo')}><Database size={14} aria-hidden="true" />{source === 'demo' ? 'Connect to backend' : 'Use demo data'}</button><button className="text-button diagnostics-toggle" aria-expanded={expanded} aria-controls="connection-diagnostics" onClick={() => setExpanded(!expanded)}>Diagnostics <ChevronDown size={15} aria-hidden="true" /></button></div></div>
    {(error || workflowStatus === 'stale' || workflowStatus === 'unavailable') && <div className={'connection-summary ' + (error ? 'notice-error' : 'notice-warning')} role={error ? 'alert' : 'status'}><div>{error && <strong>{data ? 'Showing the last successful data.' : 'Unable to load the dashboard.'}</strong>}{workflowStatus === 'stale' && <span>Workflow data is stale.</span>}{workflowStatus === 'unavailable' && <span>Workflow data is unavailable.</span>}<span>Assignments and operator resolutions cannot be confirmed.</span></div><button className="text-button" onClick={onRetry} disabled={refreshing}>{error ? 'Retry connection' : 'Retry workflows'}</button></div>}
    {expanded && <div className="connection-diagnostics" id="connection-diagnostics"><p>{source === 'demo' ? 'Snapshots and incidents are simulated. Demo changes persist in this tab only.' : synthetic ? 'This backend dataset contains labeled demo records. Connectivity does not establish live ingestion.' : 'Displaying the records supplied by the backend.'}</p><p>Polling every 15 seconds while this tab is visible. Old source observations are not a live feed.</p>{error && <p className="inline-error">{error}</p>}{workflowError && <p>Workflow: {workflowError} Counts may be incomplete.</p>}{sessionError && <p>Operator access: {sessionError}</p>}<dl><dt>Last successful refresh</dt><dd>{dateTime(lastSuccess)}</dd><dt>Latest camera image</dt><dd>{dateTime(data && newestTimestamp(data.cameras.map((item) => item.last_updated)))}</dd><dt>Latest incident observation</dt><dd>{dateTime(data && newestTimestamp(data.incidents.map((item) => item.last_seen)))}</dd><dt>Latest transport signal</dt><dd>{dateTime(data && newestTimestamp(data.transport.map((item) => item.timestamp)))}</dd></dl></div>}
  </section>;
}
