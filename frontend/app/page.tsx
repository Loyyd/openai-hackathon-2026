'use client';

import { useCallback, useEffect, useState } from 'react';
import { CameraCard, IncidentCard, MapPanel } from '../components/DashboardCards';
import { getDashboardData } from '../lib/api';
import type { MapData } from '../types';

type DashboardState = { data: MapData; source: 'api' | 'demo'; warning?: string };

export default function Home() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setState(await getDashboardData());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const data = state?.data;
  const incidents = data?.incidents.filter((incident) => incident.status === 'active') ?? [];
  const cameras = data?.cameras ?? [];

  return <main className="shell">
    <header className="topbar"><a className="brand" href="#overview" aria-label="SentinelX home"><span className="brand-mark">S<span>×</span></span><span>sentinel<span className="brand-x">x</span></span></a>
      <nav className="main-nav" aria-label="Main navigation"><a className="nav-active" href="#overview">Overview</a><a href="#incidents">Incidents <span className="nav-count">{incidents.length}</span></a><a href="#cameras">Cameras</a><a href="/ai">AI demo</a></nav>
      <div className="header-right"><span className="system-status"><i /> {state?.source === 'api' ? 'BACKEND CONNECTED' : 'DEMO MODE'}</span><span className="header-divider" /><span className="header-city">DUBLIN, IE <span>⌄</span></span><span className="avatar">SX</span></div>
    </header>
    <div className="page-content" id="overview">
      <div className="welcome-row"><div><div className="eyebrow">SITUATIONAL AWARENESS <span className="eyebrow-line" /> DUBLIN, IRELAND</div><h1>Good morning, team<span>.</span></h1><p className="welcome-subtitle">A situational overview of Dublin transport and infrastructure.</p></div><button className="refresh-button" onClick={() => void load()} disabled={loading}><span className={loading ? 'refreshing' : ''}>↻</span> Refresh data</button></div>
      {state?.warning && <div className="fallback-notice" role="status"><span>ⓘ</span><div><strong>Demo mode</strong><span>{state.warning}</span></div><button onClick={() => void load()}>Retry backend ↗</button></div>}
      {state?.source === 'demo' && !state.warning && <div className="demo-notice" role="status"><span>DEMO DATA</span> Showing local synthetic data. Set <code>NEXT_PUBLIC_USE_MOCK_DATA=false</code> to connect to the backend.</div>}
      {error && <div className="error-notice" role="alert"><span>{error}</span><button onClick={() => void load()}>Retry</button></div>}
      <section className="stats-grid" aria-label="City status">
        <article className="stat-card"><span className="stat-icon icon-incidents">⌁</span><div className="stat-label">Active incidents</div><div className="stat-value">{loading && !data ? '—' : incidents.length}<span className="stat-trend">{incidents.length ? `${incidents.filter((item) => item.severity === 'high' || item.severity === 'critical').length} high priority` : 'All clear'}</span></div><div className="stat-foot"><span className="mini-bars"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></span><span>Across Greater Dublin</span></div></article>
        <article className="stat-card"><span className="stat-icon icon-cameras">⌖</span><div className="stat-label">Cameras in dataset</div><div className="stat-value">{loading && !data ? '—' : cameras.length}</div><div className="stat-foot"><span className="status-inline"><i /> Camera locations</span><span>Demo feed</span></div></article>
        <article className="stat-card"><span className="stat-icon icon-transport">⇄</span><div className="stat-label">Transport signals</div><div className="stat-value">{loading && !data ? '—' : data?.transport.length ?? 0}<span className="stat-trend trend-neutral">observations</span></div><div className="stat-foot"><span className="stat-neutral">Bus &amp; road network</span><span>Greater Dublin</span></div></article>
        <article className="stat-card"><span className="stat-icon icon-confidence">◉</span><div className="stat-label">Avg. confidence</div><div className="stat-value">{loading && !data ? '—' : incidents.length ? `${Math.round(incidents.reduce((sum, item) => sum + item.confidence, 0) / incidents.length * 100)}%` : '—'}</div><div className="stat-foot"><span className="status-inline"><i /> Signal quality</span><span>Analysis data</span></div></article>
      </section>
      <div className="content-grid"><MapPanel cameras={cameras} incidents={incidents} />
        <section className="incidents-panel" id="incidents"><div className="section-heading"><div><span className="eyebrow">NEEDS ATTENTION</span><h2>Current incidents <span className="heading-count">{incidents.length}</span></h2></div><a href="#incidents">View all <span>↗</span></a></div>
          <div className="incident-list">{loading && !data ? <div className="empty-state">Loading incidents…</div> : incidents.length ? incidents.slice(0, 4).map((incident) => <IncidentCard key={incident.id} incident={incident} />) : <div className="empty-state">No active incidents. No incident data is currently available.</div>}</div>
          {incidents.length > 4 && <button className="show-more">View all {incidents.length} incidents <span>→</span></button>}
        </section>
      </div>
      <section className="cameras-section" id="cameras"><div className="section-heading"><div><span className="eyebrow">NETWORK SNAPSHOT</span><h2>Camera previews <span className="heading-count">{cameras.length}</span></h2></div><a href="#cameras">All cameras <span>↗</span></a></div>
        <div className="camera-grid">{loading && !data ? <div className="empty-state">Connecting to camera network…</div> : cameras.length ? cameras.slice(0, 4).map((camera) => <CameraCard camera={camera} key={camera.id} />) : <div className="empty-state">No camera data is currently available.</div>}</div>
      </section>
      <footer><span className="footer-brand">SENTINEL<span>X</span></span><span>Dublin situational awareness <i /> {state?.source === 'demo' ? 'Synthetic demo feed' : state?.source === 'api' ? 'Backend data' : 'Waiting for data'}</span><span>Data refreshes on request</span></footer>
    </div>
  </main>;
}
