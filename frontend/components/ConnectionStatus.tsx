import type { DataSource, MapData, WorkflowStatus } from '../types';
import { dateTime, knownDemo, newestTimestamp } from '../lib/presentation';

export function ConnectionStatus({ source, data, error, workflowStatus, workflowError, lastSuccess, refreshing, onRetry, onSource }: {
  source: DataSource; data: MapData | null; error: string | null; workflowStatus: WorkflowStatus; workflowError: string | null; lastSuccess: string | null;
  refreshing: boolean; onRetry: () => void; onSource: (source: DataSource) => void;
}) {
  return <div className="connection-area">
    <div className="connection-line"><span className={'connection-dot ' + (error ? 'offline' : '')} /><strong>{source === 'demo' ? 'Local demo · simulated actions' : error ? 'Backend unavailable' : data ? 'Backend connected' : 'Connecting to backend…'}</strong><span>Last successful refresh: {lastSuccess ? dateTime(lastSuccess) : 'Waiting'}</span><button className="text-button" onClick={() => onSource(source === 'demo' ? 'api' : 'demo')}>{source === 'demo' ? 'Connect to backend' : 'Use demo data'}</button></div>
    {error && <div className="notice notice-error" role="alert"><div><strong>{data ? 'Showing the last successful data.' : 'Unable to load the dashboard.'}</strong><p>{error}</p></div><button className="secondary-button" onClick={onRetry} disabled={refreshing}>Retry connection</button></div>}
    {(source === 'demo' || data && knownDemo(data)) && <div className="demo-notice"><span className="badge">SYNTHETIC DATA</span>{source === 'demo' ? 'Snapshots and incidents are simulated. Demo changes persist in this tab only.' : 'This backend dataset contains labeled demo records. Connectivity does not establish live ingestion.'}</div>}
    {workflowStatus !== 'ready' && workflowStatus !== 'loading' && <div className="notice notice-warning" role="status"><div><strong>{workflowStatus === 'stale' ? 'Workflow data is stale.' : 'Workflow data is unavailable.'}</strong><p>{workflowError} Assignments and operator resolutions cannot be confirmed; counts may be incomplete.</p></div><button className="text-button" onClick={onRetry} disabled={refreshing}>Retry workflows</button></div>}
    {data && <details className="source-times"><summary>Source timestamps · polling every 15 seconds while this tab is visible</summary><dl><dt>Latest camera image</dt><dd>{dateTime(newestTimestamp(data.cameras.map((item) => item.last_updated)))}</dd><dt>Latest incident observation</dt><dd>{dateTime(newestTimestamp(data.incidents.map((item) => item.last_seen)))}</dd><dt>Latest transport signal</dt><dd>{dateTime(newestTimestamp(data.transport.map((item) => item.timestamp)))}</dd></dl></details>}
  </div>;
}
