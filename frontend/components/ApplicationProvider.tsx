'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '../lib/api';
import { useDashboard, useSession, useVisiblePolling } from '../hooks/useDashboard';
import { resolved, sortIncidents } from '../lib/presentation';
import type { DataSource, Selection } from '../types';
import { defaultFilters, type IncidentFilters } from '../lib/filters';
import { DetailDialog } from './DetailDialog';
import { CameraDetails } from './CameraDetails';
import { IncidentDetails } from './IncidentDetails';
import { LoginDialog } from './LoginDialog';

export type MapView = { center: [number, number]; zoom: number };
export type MapLayers = { cameras: boolean; incidents: boolean; transport: boolean };

function useApplicationState(source: DataSource, onSource: (source: DataSource) => void) {
  const client = useMemo(() => createClient(source), [source]);
  const dashboard = useDashboard(client);
  const session = useSession(client);
  const refresh = dashboard.refresh;
  const check = session.check;
  const poll = useCallback(async () => { await Promise.allSettled([refresh(), check()]); }, [refresh, check]);
  // One scheduler for the whole application, including session checks.
  useVisiblePolling(poll);
  const [selection, setSelection] = useState<Selection>(null);
  const [returnIncident, setReturnIncident] = useState<string | null>(null);
  const [login, setLogin] = useState(false);
  const [filters, setFilters] = useState<IncidentFilters>(defaultFilters);
  const [cameraQuery, setCameraQuery] = useState('');
  const [mapView, setMapView] = useState<MapView>({ center: [53.374, -6.285], zoom: 11 });
  const [mapLayers, setMapLayers] = useState<MapLayers>({ cameras: true, incidents: true, transport: true });
  const { data, workflows, workflowStatus } = dashboard;
  const cameras = data?.cameras ?? [];
  const incidents = data?.incidents ?? [];
  const active = incidents.filter((item) => !resolved(item, workflows[item.id])).sort(sortIncidents);
  const matching = incidents.filter((incident) => {
    const workflow = workflows[incident.id];
    const isResolved = resolved(incident, workflow);
    if (filters.status !== 'all' && (filters.status === 'resolved') !== isResolved) return false;
    if (filters.severity !== 'all' && incident.severity !== filters.severity) return false;
    if (filters.type !== 'all' && incident.type !== filters.type) return false;
    if (!(incident.title + ' ' + incident.description + ' ' + incident.location.name + ' ' + incident.type).toLowerCase().includes(filters.query.trim().toLowerCase())) return false;
    if (filters.assignee === 'unassigned' && (workflowStatus !== 'ready' || workflow?.assignee)) return false;
    if (filters.assignee === 'me' && (!session.user || workflow?.assignee?.id !== session.user.id)) return false;
    if (!['all', 'unassigned', 'me'].includes(filters.assignee) && workflow?.assignee?.id !== filters.assignee) return false;
    return true;
  }).sort(sortIncidents);
  const operators = [...new Map([...session.users, ...Object.values(workflows).flatMap((workflow) => workflow.assignee ? [workflow.assignee] : [])].map((user) => [user.id, user])).values()];
  const select = (next: Selection) => { setReturnIncident(null); setSelection(next); };
  return { source, onSource, client, dashboard, session, cameras, incidents, active, matching, operators, selection, select, setSelection, returnIncident, setReturnIncident, login, setLogin, filters, setFilters, cameraQuery, setCameraQuery, mapView, setMapView, mapLayers, setMapLayers };
}

const ApplicationContext = createContext<ReturnType<typeof useApplicationState> | null>(null);
export function useApplication() {
  const value = useContext(ApplicationContext);
  if (!value) throw new Error('Workspace must be inside ApplicationProvider');
  return value;
}

function ApplicationState({ children, source, onSource }: { children: ReactNode; source: DataSource; onSource: (source: DataSource) => void }) {
  const value = useApplicationState(source, onSource);
  return <ApplicationContext.Provider value={value}>{children}<DialogHost /></ApplicationContext.Provider>;
}

function DialogHost() {
  const app = useApplication();
  const pathname = usePathname();
  const { selection, setSelection, setLogin } = app;
  useEffect(() => { setSelection(null); setLogin(false); }, [pathname, setSelection, setLogin]);
  const incident = selection?.kind === 'incident' ? app.incidents.find((item) => item.id === selection.id) : undefined;
  const camera = selection?.kind === 'camera' ? app.cameras.find((item) => item.id === selection.id) : undefined;
  return <>
    {selection && <DetailDialog focusKey={selection.kind + selection.id} title={incident?.title ?? camera?.name ?? 'Record unavailable'} eyebrow={selection.kind === 'incident' ? 'INCIDENT DETAILS' : 'CAMERA DETAILS'} onClose={() => setSelection(null)}>
      {incident ? <IncidentDetails key={incident.id} incident={incident} workflow={app.dashboard.workflows[incident.id]} workflowStatus={app.dashboard.workflowStatus} cameras={app.cameras} client={app.client} session={app.session} source={app.source} refreshKey={app.dashboard.lastSuccess} onLogin={() => setLogin(true)} onCamera={(id, observationId) => { app.setReturnIncident(incident.id); setSelection({ kind: 'camera', id, observationId }); }} onSave={app.dashboard.saveWorkflow} /> :
        camera ? <CameraDetails onRefresh={() => void app.dashboard.refresh()} key={camera.id} camera={camera} observationId={selection.observationId} client={app.client} refreshKey={app.dashboard.lastSuccess} onBack={app.returnIncident ? () => setSelection({ kind: 'incident', id: app.returnIncident! }) : undefined} /> : <p>This record is no longer in the current dataset.</p>}
    </DetailDialog>}
    {app.login && <LoginDialog source={app.source} session={app.session} onClose={() => setLogin(false)} />}
  </>;
}

export function ApplicationProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = useState<DataSource>(process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' ? 'demo' : 'api');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { const saved = sessionStorage.getItem('sentinelx.source'); if (saved === 'demo' || saved === 'api') setSource(saved); } catch { /* Storage is optional. */ }
    setReady(true);
  }, []);
  const changeSource = (value: DataSource) => {
    try { sessionStorage.setItem('sentinelx.source', value); } catch { /* In-memory preference still works. */ }
    setSource(value);
  };
  if (!ready) return <div className="initial-loading" role="status">Loading SentinelX…</div>;
  return <ApplicationState key={source} source={source} onSource={changeSource}>{children}</ApplicationState>;
}
