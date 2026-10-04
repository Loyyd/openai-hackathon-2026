'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '../lib/api';
import { useDashboard, useSession } from '../hooks/useDashboard';
import { resolved, sortIncidents } from '../lib/presentation';
import type { DataSource, Selection } from '../types';
import { MapPanel } from './MapPanel';
import { IncidentList, defaultFilters, type IncidentFilters } from './IncidentList';
import { CameraGallery } from './CameraGallery';
import { DetailDialog } from './DetailDialog';
import { CameraDetails } from './CameraDetails';
import { IncidentDetails } from './IncidentDetails';
import { LoginDialog } from './LoginDialog';
import { ConnectionStatus } from './ConnectionStatus';

export function Dashboard() {
  const [source, setSource] = useState<DataSource>(process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' ? 'demo' : 'api');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('sentinelx.source');
      if (saved === 'demo' || saved === 'api') setSource(saved);
    } catch { /* Browsing is still available without session storage. */ }
    setReady(true);
  }, []);
  const changeSource = (value: DataSource) => {
    try { sessionStorage.setItem('sentinelx.source', value); } catch { /* Selection lasts for this page. */ }
    setSource(value);
  };
  if (!ready) return <main className="initial-loading" role="status">Loading SentinelX…</main>;
  return <DashboardContent key={source} source={source} onSource={changeSource} />;
}

function DashboardContent({ source, onSource }: { source: DataSource; onSource: (source: DataSource) => void }) {
  const client = useMemo(() => createClient(source), [source]);
  const dashboard = useDashboard(client);
  const session = useSession(client);
  const [selection, setSelection] = useState<Selection>(null);
  const [returnIncident, setReturnIncident] = useState<string | null>(null);
  const [login, setLogin] = useState(false);
  const [filters, setFilters] = useState<IncidentFilters>(defaultFilters);
  const [expandedIncidents, setExpandedIncidents] = useState(false);
  const [expandedCameras, setExpandedCameras] = useState(false);
  const [section, setSection] = useState('overview');
  const { data, workflows, workflowStatus } = dashboard;
  const cameras = data?.cameras ?? [];
  const incidents = data?.incidents ?? [];
  const active = incidents.filter((item) => !resolved(item, workflows[item.id]));
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
  const selectedIncident = selection?.kind === 'incident' ? incidents.find((item) => item.id === selection.id) : undefined;
  const selectedCamera = selection?.kind === 'camera' ? cameras.find((item) => item.id === selection.id) : undefined;
  const select = (next: Selection) => { setReturnIncident(null); setSelection(next); };
  const navigate = (next: string) => {
    setSection(next);
    if (next === 'incidents') setExpandedIncidents(true);
    if (next === 'cameras') setExpandedCameras(true);
  };
  return <main className="shell">
    <a className="skip-link" href="#overview">Skip to dashboard</a>
    <header className="topbar">
      <a className="brand" href="#overview" onClick={() => navigate('overview')} aria-label="SentinelX home" data-focus-home><span className="brand-mark">S<span>×</span></span><span>sentinel<span className="brand-x">x</span></span></a>
      <nav className="main-nav" aria-label="Main navigation">{['overview', 'incidents', 'cameras'].map((item) => <a key={item} className={section === item ? 'nav-active' : ''} aria-current={section === item ? 'page' : undefined} href={'#' + item} onClick={() => navigate(item)}>{item[0].toUpperCase() + item.slice(1)}{item === 'incidents' && <span className="nav-count">{data ? active.length : '—'}</span>}</a>)}<Link href="/ai">AI demo</Link></nav>
      <div className="header-right"><span className="header-city">DUBLIN, IE</span>{session.user ? <><span className="operator-name">{session.user.display_name}{source === 'demo' && <small>Demo operator</small>}</span><button className="secondary-button" disabled={session.busy} onClick={() => void session.logout().catch(() => undefined)}>Sign out</button></> : <button className="secondary-button" onClick={() => setLogin(true)}>Operator sign in</button>}</div>
    </header>
    <div className="page-content" id="overview">
      <div className="welcome-row"><div><div className="eyebrow">SITUATIONAL AWARENESS <span className="eyebrow-line" /> DUBLIN, IRELAND</div><h1>A clearer view of the city<span>.</span></h1><p className="welcome-subtitle">Dublin transport and infrastructure, in one place.</p></div><button className="refresh-button" onClick={() => void dashboard.refresh()} disabled={dashboard.refreshing}><span className={dashboard.refreshing ? 'refreshing' : ''} aria-hidden="true">↻</span>{dashboard.refreshing ? 'Refreshing…' : 'Refresh data'}</button></div>
      <ConnectionStatus source={source} data={data} error={dashboard.error} workflowStatus={workflowStatus} workflowError={dashboard.workflowError} lastSuccess={dashboard.lastSuccess} refreshing={dashboard.refreshing} onRetry={() => void dashboard.refresh()} onSource={onSource} />
      {session.error && <p className="session-notice" role="status">{session.error}</p>}
      <section className="stats-grid" aria-label="City status">
        <article className="stat-card"><span className="stat-icon icon-incidents" aria-hidden="true">⌁</span><div className="stat-label">Active incidents</div><div className="stat-value" data-testid="active-count">{data ? active.length : '—'}</div><div className="stat-foot">{data ? active.filter((item) => ['high', 'critical'].includes(item.severity)).length + ' high priority' : 'Waiting for data'}<span>Across Greater Dublin</span></div></article>
        <article className="stat-card"><span className="stat-icon icon-cameras" aria-hidden="true">⌖</span><div className="stat-label">Camera locations</div><div className="stat-value">{data ? cameras.length : '—'}</div><div className="stat-foot">Snapshot monitoring<span>Provider images</span></div></article>
        <article className="stat-card"><span className="stat-icon icon-transport" aria-hidden="true">⇄</span><div className="stat-label">Transport signals</div><div className="stat-value">{data ? data.transport.length : '—'}</div><div className="stat-foot">Bus &amp; road network<span>Observations</span></div></article>
        <article className="stat-card"><span className="stat-icon icon-confidence" aria-hidden="true">◉</span><div className="stat-label">Average confidence</div><div className="stat-value">{active.length ? Math.round(active.reduce((sum, item) => sum + item.confidence, 0) / active.length * 100) + '%' : '—'}</div><div className="stat-foot">Active incidents<span>Supplied analysis</span></div></article>
      </section>
      {data ? <>
        <div className="content-grid">
          <MapPanel cameras={cameras} incidents={matching} transport={data.transport} selection={selection} onSelect={select} />
          <IncidentList incidents={matching} total={incidents.length} types={[...new Set(incidents.map((item) => item.type))].sort()} filters={filters} onFilters={(next) => { setFilters(next); setExpandedIncidents(true); }} expanded={expandedIncidents} onExpand={() => setExpandedIncidents(!expandedIncidents)} onSelect={(id) => select({ kind: 'incident', id })} selectedId={selection?.kind === 'incident' ? selection.id : undefined} workflows={workflows} workflowStatus={workflowStatus} operators={operators} user={session.user} />
        </div>
        <CameraGallery cameras={cameras} expanded={expandedCameras} onExpand={() => setExpandedCameras(!expandedCameras)} onSelect={(id) => select({ kind: 'camera', id })} />
      </> : <div className="initial-state" role="status">{dashboard.error ? 'Retry the backend connection or choose demo data to explore SentinelX.' : 'Connecting to the city dataset…'}</div>}
      <footer><span className="footer-brand">SENTINEL<span>X</span></span><span>Dublin situational awareness · {source === 'demo' ? 'Synthetic demo' : 'Backend data'}</span><span>Public viewing · Operator management</span></footer>
    </div>
    {selection && <DetailDialog key={selection.kind + selection.id} title={selectedIncident?.title ?? selectedCamera?.name ?? 'Record unavailable'} eyebrow={selection.kind === 'incident' ? 'INCIDENT DETAILS' : 'CAMERA DETAILS'} onClose={() => setSelection(null)}>
      {selectedIncident ? <IncidentDetails incident={selectedIncident} workflow={workflows[selectedIncident.id]} workflowStatus={workflowStatus} cameras={cameras} client={client} session={session} source={source} refreshKey={dashboard.lastSuccess} onLogin={() => setLogin(true)} onCamera={(id, observationId) => { setReturnIncident(selectedIncident.id); setSelection({ kind: 'camera', id, observationId }); }} onSave={dashboard.saveWorkflow} /> :
        selectedCamera ? <CameraDetails camera={selectedCamera} observationId={selection.observationId} client={client} refreshKey={dashboard.lastSuccess} onBack={returnIncident ? () => setSelection({ kind: 'incident', id: returnIncident }) : undefined} /> : <p>This record is no longer in the current dataset.</p>}
    </DetailDialog>}
    {login && <LoginDialog source={source} session={session} onClose={() => setLogin(false)} />}
  </main>;
}
