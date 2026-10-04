'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, request } from '../../lib/api';
import { TopBar, navIcons } from '../../components/TopBar';

type Vehicle = { vehicle_id: string; color?: string; make?: string; model?: string; first_seen: number; last_seen: number; observation_count: number; identity_confidence?: number; decision?: string; evidence?: Record<string, number> };
type ReplayFrame = { timestamp: number; vehicles: Pick<Vehicle, 'vehicle_id' | 'identity_confidence' | 'decision' | 'evidence'>[] };
type Demo = { run: { width: number; height: number; frames: number; sample_fps: number; replay_fps?: number; embedding_backend: string; device: string; ocr_status?: string; detector?: string; detection_width?: number }; vehicles: Vehicle[]; video_available: boolean; timeline?: ReplayFrame[] };

export default function AIDemo() {
  const [demo, setDemo] = useState<Demo | null>(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playbackTime, setPlaybackTime] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const api = '/backend';
  const load = useCallback(async (signal?: AbortSignal) => {
    setError('');
    setLoading(true);
    try {
      const data = await request<Demo>('/api/ai-demo', { signal });
      if (signal?.aborted) return;
      setDemo(data);
      setSelectedId((previous) => data.vehicles.some((vehicle) => vehicle.vehicle_id === previous) ? previous : null);
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof ApiError && cause.status === 404 ? 'No processed AI demo available. Run the vehicle pipeline and configure AI_DEMO_DIR.' : cause instanceof Error ? cause.message : 'Cannot load demo');
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video?.requestVideoFrameCallback) return;
    let handle: number;
    const update: VideoFrameRequestCallback = (_, metadata) => {
      setPlaybackTime(metadata.mediaTime);
      handle = video.requestVideoFrameCallback(update);
    };
    handle = video.requestVideoFrameCallback(update);
    return () => video.cancelVideoFrameCallback(handle);
  }, [demo?.video_available]);

  const synchronized = Boolean(demo?.video_available && demo.timeline?.length && !mediaError);
  const fps = demo?.run.replay_fps || demo?.run.sample_fps || 1;
  const frameIndex = playbackTime === null ? -1 : Math.min(Math.floor(playbackTime * fps + 1e-6), (demo?.timeline?.length || 1) - 1);
  const { discovered, activeIds, sourceTime } = useMemo(() => {
    if (!demo || !synchronized) return { discovered: demo?.vehicles || [], activeIds: new Set<string>(), sourceTime: null };
    const timeline = demo.timeline!;
    const known = new Map(demo.vehicles.map(vehicle => [vehicle.vehicle_id, vehicle]));
    const seen = new Map<string, Vehicle>();
    // Replay frames are indexed from zero; their timestamps refer to the source clip.
    for (let index = 0; index <= frameIndex; index++) {
      for (const observation of timeline[index].vehicles) {
        const vehicle = known.get(observation.vehicle_id);
        if (!vehicle) continue;
        const previous = seen.get(vehicle.vehicle_id);
        seen.set(vehicle.vehicle_id, { ...vehicle, ...observation, first_seen: previous?.first_seen ?? timeline[index].timestamp,
          last_seen: timeline[index].timestamp, observation_count: (previous?.observation_count || 0) + 1 });
      }
    }
    return { discovered: [...seen.values()], activeIds: new Set(timeline[frameIndex]?.vehicles.map(vehicle => vehicle.vehicle_id)), sourceTime: timeline[frameIndex]?.timestamp ?? null };
  }, [demo, synchronized, frameIndex]);
  const selected = discovered.find(vehicle => vehicle.vehicle_id === selectedId) ?? discovered.find(vehicle => activeIds.has(vehicle.vehicle_id)) ?? discovered[0];

  return <main className="shell">
    <TopBar active="ai" items={[{ key: 'overview', label: 'Map', icon: navIcons.map, href: '/' }, { key: 'incidents', label: 'Incidents', icon: navIcons.map, href: '/#incidents' }, { key: 'cameras', label: 'Cameras', icon: navIcons.camera, href: '/#cameras' }, { key: 'ai', label: 'Tracking demo', icon: navIcons.ai, href: '/ai' }]} />
    <div className="case-band"><div><span className="eyebrow">LOCAL VIDEO INTELLIGENCE</span><h1>Highway vehicle demo</h1><p className="case-subtitle">Recorded highway footage · not a live Dublin feed · pseudonymous identities</p></div><div className="case-meta"><span className="case-id">AI-DEMO · RECORDED</span><span className={'status-pill' + (playing ? '' : ' is-idle')}><i />{playing ? 'PLAYING' : 'REPLAY'}</span><button className="refresh-button" disabled={loading} onClick={() => void load()}>{loading ? 'Loading results…' : 'Refresh results'}</button></div></div>
    <div className="page-content">
      <p className="demo-notice">Local demo only. Footage may contain readable plates. Scores are heuristic, not verified identities; no owner lookup or cross-camera claim.</p>
      {error && <div role="alert" className="notice notice-error">{error}{demo && ' Showing the last successful results.'}</div>}
      {!demo && !error && <p role="status">Loading AI results…</p>}
      {demo && <><section className="stats-grid ai-stats">{[['Source', `${demo.run.width} × ${demo.run.height}`], ['Frames', `${demo.run.frames} at ${demo.run.sample_fps} FPS`], ['Detector', demo.run.detector ? `${demo.run.detector} · ${demo.run.detection_width}px` : 'Status unavailable'], ['Embedding / device', `${demo.run.embedding_backend} / ${demo.run.device}`], ['OCR', demo.run.ocr_status || 'Status unavailable']].map(([label, value]) => <article className="stat-card" key={label}><h3>{label}</h3><p>{value}</p></article>)}</section>
        <div className="content-grid ai-replay-grid"><section className="map-panel ai-video-panel">{demo.video_available ? <video ref={videoRef} controls playsInline preload="metadata" aria-label="Annotated highway replay" src={`${api}/api/ai-demo/media/browser.mp4`} onLoadedData={event => { setMediaError(false); setPlaybackTime(event.currentTarget.currentTime); }} onTimeUpdate={event => setPlaybackTime(event.currentTarget.currentTime)} onSeeked={event => setPlaybackTime(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => { setMediaError(true); setPlaying(false); }} /> : <p>Browser video not prepared. Convert annotated.mp4 to H.264 as documented.</p>}
          {mediaError && <p role="alert">Replay could not load. You can still inspect the processed identities.</p>}
          <div className="ai-playback-status"><span className={`ai-status-dot${playing ? ' is-playing' : ''}`} /><strong>{playing ? 'Playing' : 'Recorded replay'}</strong><span>{sourceTime !== null ? `Source ${sourceTime.toFixed(2)}s` : 'Local inference · sampled footage'}</span></div>
          <p className="ai-muted">Identities are revealed from recorded AI detections as the video plays. Seeking updates the list to that point in the replay.</p></section>
          <section className="incidents-panel ai-identities-panel" aria-label="Replay identities"><div className="ai-identity-heading"><div><span className="eyebrow">VEHICLE FINGERPRINTS</span><h2>Unique identities</h2></div><span className="ai-count" role="status" aria-live="polite" aria-atomic="true">{discovered.length} discovered</span></div>
            <p className="ai-muted">{synchronized ? `${activeIds.size} in frame · each identity listed once` : 'Full results · playback timing unavailable'}</p>
            {!synchronized && demo.video_available && !mediaError && <p className="ai-muted">Regenerate observations.jsonl with the vehicle pipeline to enable synchronized identities.</p>}
            <div className="ai-identity-list">{discovered.map(vehicle => <button className={`ai-identity-card${activeIds.has(vehicle.vehicle_id) ? ' is-active' : ''}`} key={vehicle.vehicle_id} onClick={() => setSelectedId(vehicle.vehicle_id)} aria-pressed={selected?.vehicle_id === vehicle.vehicle_id}><span className="ai-identity-title"><strong>{vehicle.vehicle_id}</strong>{synchronized && <span className="ai-identity-state">{activeIds.has(vehicle.vehicle_id) ? 'In frame' : 'Previously seen'}</span>}</span><span>{vehicle.color || 'Unknown colour'} · {vehicle.observation_count} observations</span><span className="ai-muted">First seen {vehicle.first_seen.toFixed(2)}s · {vehicle.decision || 'Detected'}</span></button>)}</div>
            {!discovered.length && <p className="ai-empty">{synchronized ? 'Play the video to discover vehicle identities. New fingerprints will appear here as they are detected.' : 'No vehicles detected.'}</p>}
            {selected && <div className="ai-vehicle-details"><h3>{selected.vehicle_id} · {selected.color || 'Unknown colour'}</h3><p>Make/model: {[selected.make, selected.model].filter(Boolean).join(' ') || 'Unavailable'}</p><p>{selected.observation_count} observations · {selected.first_seen.toFixed(2)}s–{selected.last_seen.toFixed(2)}s</p><p>Match confidence: {Math.round((selected.identity_confidence || 0) * 100)}% · {selected.decision}</p><p className="ai-muted">Zero means no confirmed re-identification evidence, not failed tracking.</p><details><summary>Matching evidence</summary><pre>{JSON.stringify(selected.evidence || {}, null, 2)}</pre></details></div>}
          </section></div></>}
    </div></main>;
}
