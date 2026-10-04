'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient, errorMessage, request } from '../lib/api';
import { sortIncidents } from '../lib/presentation';
import type { MapData, Selection } from '../types';
import { MapPanel } from './MapPanel';
import { IncidentList, defaultFilters, type IncidentFilters } from './IncidentList';
import { CameraGallery } from './CameraGallery';
import { DetailDialog } from './DetailDialog';
import { CameraDetails } from './CameraDetails';
import { IncidentDetails } from './IncidentDetails';
import { TopBar, navIcons } from './TopBar';

type Processing = { running: boolean; capturing: boolean; stored_snapshots: number; completed: number; pending: number; failed: number; vehicles: number; error: string | null };
export function Dashboard({ view = 'overview' }: { view?: 'overview' | 'cameras' }) {
  const client = useMemo(() => createClient(), []);
  const [data, setData] = useState<MapData | null>(null);
  const [processing, setProcessing] = useState<Processing | null>(null);
  const [error, setError] = useState('');
  const [selection, setSelection] = useState<Selection>(null);
  const [filters, setFilters] = useState<IncidentFilters>(defaultFilters);
  const [expandedIncidents, setExpandedIncidents] = useState(false);
  const [refreshKey, setRefreshKey] = useState<string | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const [map, state] = await Promise.all([client.map(signal), request<Processing>('/api/processing', { signal })]);
      if (signal?.aborted) return;
      setData(map); setProcessing(state); setError(''); setRefreshKey(new Date().toISOString());
    } catch (cause) { if (!signal?.aborted) setError(errorMessage(cause)); }
  }, [client]);
  useEffect(() => {
    const controller = new AbortController();
    const run = () => { if (!document.hidden) void refresh(controller.signal); };
    run(); const timer = setInterval(run, 5000);
    document.addEventListener('visibilitychange', run);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', run); };
  }, [refresh]);
  const cameras = data?.cameras ?? [];
  const incidents = data?.incidents ?? [];
  const matching = incidents.filter((item) =>
    (filters.status === 'all' || item.status === filters.status) &&
    (filters.severity === 'all' || item.severity === filters.severity) &&
    (filters.type === 'all' || item.type === filters.type) &&
    (item.title + ' ' + item.description + ' ' + item.location.name).toLowerCase().includes(filters.query.toLowerCase())
  ).sort(sortIncidents);
  const camera = selection?.kind === 'camera' ? cameras.find((item) => item.id === selection.id) : undefined;
  const incident = selection?.kind === 'incident' ? incidents.find((item) => item.id === selection.id) : undefined;
  async function capture() {
    try { await request('/api/cameras/capture', { method: 'POST' }); await refresh(); }
    catch (cause) { setError(errorMessage(cause)); }
  }
  return <main className="shell">
    <TopBar active={view} items={[
      { key: 'overview', label: 'Map', icon: navIcons.map, href: '#overview' },
      { key: 'incidents', label: 'Incidents', icon: navIcons.map, href: '#incidents' },
      { key: 'cameras', label: 'Cameras', icon: navIcons.camera, href: '/cameras' },
      { key: 'ai', label: 'Tracking demo', icon: navIcons.ai, href: '/ai' },
    ]} />
    <div className="case-band"><div><div className="eyebrow">CAMERAS &amp; INCIDENTS</div><h1>{view === 'cameras' ? 'Camera gallery' : 'Camera monitoring'}</h1></div>
      <button className="secondary-button" disabled={!processing?.running || processing.capturing} onClick={() => void capture()}>{processing?.capturing ? 'Collecting snapshots…' : 'Collect snapshots'}</button>
    </div>
    <div className="page-content" id="overview">
      {error && <p role="alert">{error} <button onClick={() => void refresh()}>Retry</button></p>}
      {processing && <div className="pipeline-summary" role="status"><span>{processing.stored_snapshots} stored snapshots</span><span>{processing.completed} scanned</span><span>{processing.pending} pending</span><span>{processing.vehicles} vehicle IDs</span>{processing.failed > 0 && <span>{processing.failed} failed scans</span>}{!processing.running && <span>Camera worker stopped</span>}{processing.error && <span>{processing.error}</span>}</div>}
      {data ? view === 'cameras' ? <CameraGallery cameras={cameras} standalone expanded onExpand={() => undefined} onSelect={(id) => setSelection({ kind: 'camera', id })} /> : <div className="content-grid">
        <MapPanel cameras={cameras} incidents={matching} selection={selection} onSelect={setSelection} />
        <IncidentList incidents={matching} total={incidents.length} types={[...new Set(incidents.map((item) => item.type))]} filters={filters} onFilters={setFilters} expanded={expandedIncidents} onExpand={() => setExpandedIncidents(!expandedIncidents)} onSelect={(id) => setSelection({ kind: 'incident', id })} selectedId={incident?.id} />
      </div> : <p role="status">Loading cameras…</p>}
    </div>
    {selection && <DetailDialog title={camera?.name ?? incident?.title ?? 'Details'} eyebrow={camera ? 'CAMERA' : 'INCIDENT'} onClose={() => setSelection(null)}>
      {camera && <CameraDetails camera={camera} observationId={selection.observationId} client={client} refreshKey={refreshKey} onRefresh={() => void refresh()} />}
      {incident && <IncidentDetails incident={incident} cameras={cameras} client={client} refreshKey={refreshKey} onRefresh={() => void refresh()} onCamera={(id, observationId) => setSelection({ kind: 'camera', id, observationId })} />}
    </DetailDialog>}
  </main>;
}
