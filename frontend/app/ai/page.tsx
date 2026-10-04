'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, request } from '../../lib/api';

type Vehicle = { vehicle_id: string; color?: string; make?: string; model?: string; first_seen: number; last_seen: number; observation_count: number; identity_confidence?: number; decision?: string; evidence?: Record<string, number> };
type Demo = { run: { width: number; height: number; frames: number; sample_fps: number; embedding_backend: string; device: string; ocr_status?: string }; vehicles: Vehicle[]; video_available: boolean };

export default function AIDemo() {
  const [demo, setDemo] = useState<Demo | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const api = '/backend';
  const load = useCallback(async (signal?: AbortSignal) => {
    setError('');
    setLoading(true);
    try {
      const data = await request<Demo>('/api/ai-demo', { signal });
      if (signal?.aborted) return;
      setDemo(data);
      setSelected((previous) => data.vehicles.find((vehicle) => vehicle.vehicle_id === previous?.vehicle_id) ?? data.vehicles[0] ?? null);
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof ApiError && cause.status === 404 ? 'No processed AI demo available. Run the vehicle pipeline and configure AI_DEMO_DIR.' : cause instanceof Error ? cause.message : 'Cannot load demo');
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  return <main className="shell"><header className="topbar"><Link href="/" className="brand">SentinelX</Link><nav className="main-nav"><Link href="/">Overview</Link><Link href="/ai" className="nav-active">AI highway demo</Link></nav></header>
    <div className="page-content"><div className="welcome-row"><div><span className="eyebrow">LOCAL VIDEO INTELLIGENCE</span><h1>Highway vehicle demo</h1><p>Recorded highway footage · not a live Dublin feed · pseudonymous identities</p></div><button className="refresh-button" disabled={loading} onClick={() => void load()}>{loading ? 'Loading results…' : 'Refresh results'}</button></div>
      <p className="demo-notice">Local demo only. Footage may contain readable plates. Scores are heuristic, not verified identities; no owner lookup or cross-camera claim.</p>
      {error && <div role="alert" className="notice notice-error">{error}{demo && ' Showing the last successful results.'}</div>}
      {!demo && !error && <p role="status">Loading AI results…</p>}
      {demo && <><section className="stats-grid">{[['Source', `${demo.run.width} × ${demo.run.height}`], ['Frames', `${demo.run.frames} at ${demo.run.sample_fps} FPS`], ['Embedding / device', `${demo.run.embedding_backend} / ${demo.run.device}`], ['OCR', demo.run.ocr_status || 'Status unavailable']].map(([label, value]) => <article className="stat-card" key={label}><h3>{label}</h3><p>{value}</p></article>)}</section>
        <div className="content-grid"><section className="map-panel" style={{ padding: 20 }}>{demo.video_available ? <video controls playsInline preload="metadata" poster={`${api}/api/ai-demo/media/latest.jpg`} style={{ width: '100%' }} src={`${api}/api/ai-demo/media/browser.mp4`} /> : <p>Browser video not prepared. Convert annotated.mp4 to H.264 as documented.</p>}<p>{demo.vehicles.length} known vehicle fingerprints · sampled replay</p></section>
          <section className="incidents-panel" style={{ padding: 20 }}><h2>Vehicle details</h2>{selected ? <><h3>{selected.vehicle_id} · {selected.color || 'Unknown colour'}</h3><p>Make/model: {[selected.make, selected.model].filter(Boolean).join(' ') || 'Unavailable'}</p><p>{selected.observation_count} observations · {selected.first_seen.toFixed(2)}s–{selected.last_seen.toFixed(2)}s</p><p>Match confidence: {Math.round((selected.identity_confidence || 0) * 100)}% · {selected.decision}</p><p>Zero means no confirmed re-identification evidence, not failed tracking.</p><pre style={{ overflow: 'auto' }}>{JSON.stringify(selected.evidence || {}, null, 2)}</pre></> : <p>No vehicles detected.</p>}</section></div>
        <section className="cameras-section"><h2>Known vehicles</h2><div className="camera-grid">{demo.vehicles.map(vehicle => <button className="camera-card" style={{ padding: 18, textAlign: 'left' }} key={vehicle.vehicle_id} onClick={() => setSelected(vehicle)} aria-pressed={selected?.vehicle_id === vehicle.vehicle_id}><h3>{vehicle.vehicle_id}</h3><p>{vehicle.color || 'Unknown'} · Seen {vehicle.observation_count} times</p></button>)}</div></section></>}
    </div></main>;
}
