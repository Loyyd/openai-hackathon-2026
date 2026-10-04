'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Vehicle = { vehicle_id: string; color?: string; make?: string; model?: string; first_seen: number; last_seen: number; observation_count: number; identity_confidence?: number; decision?: string; evidence?: Record<string, number> };
type Demo = { run: { width: number; height: number; frames: number; sample_fps: number; embedding_backend: string; device: string; ocr_status?: string; detector?: string; detection_width?: number }; vehicles: Vehicle[]; video_available: boolean };

export default function AIDemo() {
  const [demo, setDemo] = useState<Demo | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const api = (process.env.NEXT_PUBLIC_API_URL || '/backend').replace(/\/$/, '');
  async function load() {
    setError('');
    try {
      const response = await fetch(`${api}/api/ai-demo`, { cache: 'no-store' });
      if (!response.ok) throw new Error('No processed AI demo available. Run the vehicle pipeline and configure AI_DEMO_DIR.');
      const data: Demo = await response.json();
      setDemo(data); setSelected(data.vehicles[0] || null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Cannot load demo'); }
  }
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <main className="shell"><header className="topbar"><Link href="/" className="brand">SentinelX</Link><nav className="main-nav"><Link href="/">Overview</Link><Link href="/ai" className="nav-active">AI highway demo</Link></nav></header>
    <div className="page-content"><div className="welcome-row"><div><span className="eyebrow">LOCAL VIDEO INTELLIGENCE</span><h1>Highway vehicle demo</h1><p>Recorded highway footage · not a live Dublin feed · pseudonymous identities</p></div><button className="refresh-button" onClick={() => void load()}>Refresh results</button></div>
      <p className="demo-notice">Local demo only. Footage may contain readable plates. Scores are heuristic, not verified identities; no owner lookup or cross-camera claim.</p>
      {error && <div role="alert" className="error-notice">{error}</div>}
      {!demo && !error && <p role="status">Loading AI results…</p>}
      {demo && <><section className="stats-grid">{[['Source', `${demo.run.width} × ${demo.run.height}`], ['Frames', `${demo.run.frames} at ${demo.run.sample_fps} FPS`], ['Detector', demo.run.detector ? `${demo.run.detector} · ${demo.run.detection_width}px` : 'Status unavailable'], ['Embedding / device', `${demo.run.embedding_backend} / ${demo.run.device}`], ['OCR', demo.run.ocr_status || 'Status unavailable']].map(([label, value]) => <article className="stat-card" key={label}><h3>{label}</h3><p>{value}</p></article>)}</section>
        <div className="content-grid"><section className="map-panel" style={{ padding: 20 }}>{demo.video_available ? <video controls playsInline preload="metadata" poster={`${api}/api/ai-demo/media/latest.jpg`} style={{ width: '100%' }} src={`${api}/api/ai-demo/media/browser.mp4`} /> : <p>Browser video not prepared. Convert annotated.mp4 to H.264 as documented.</p>}<p>{demo.vehicles.length} known vehicle fingerprints · sampled replay</p></section>
          <section className="incidents-panel" style={{ padding: 20 }}><h2>Vehicle details</h2>{selected ? <><h3>{selected.vehicle_id} · {selected.color || 'Unknown colour'}</h3><p>Make/model: {[selected.make, selected.model].filter(Boolean).join(' ') || 'Unavailable'}</p><p>{selected.observation_count} observations · {selected.first_seen.toFixed(2)}s–{selected.last_seen.toFixed(2)}s</p><p>Match confidence: {Math.round((selected.identity_confidence || 0) * 100)}% · {selected.decision}</p><p>Zero means no confirmed re-identification evidence, not failed tracking.</p><pre style={{ overflow: 'auto' }}>{JSON.stringify(selected.evidence || {}, null, 2)}</pre></> : <p>No vehicles detected.</p>}</section></div>
        <section className="cameras-section"><h2>Known vehicles</h2><div className="camera-grid">{demo.vehicles.map(vehicle => <button className="camera-card" style={{ padding: 18, textAlign: 'left' }} key={vehicle.vehicle_id} onClick={() => setSelected(vehicle)} aria-pressed={selected?.vehicle_id === vehicle.vehicle_id}><h3>{vehicle.vehicle_id}</h3><p>{vehicle.color || 'Unknown'} · Seen {vehicle.observation_count} times</p></button>)}</div></section></>}
    </div></main>;
}
