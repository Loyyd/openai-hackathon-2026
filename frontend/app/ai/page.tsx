'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Car, Film, RefreshCw, Search, ScanLine } from 'lucide-react';
import { ApiError, request } from '../../lib/api';
import { WorkspaceHeading } from '../../components/Dashboard';

type Vehicle = { vehicle_id: string; color?: string; make?: string; model?: string; first_seen: number; last_seen: number; observation_count: number; identity_confidence?: number; decision?: string; evidence?: Record<string, number> };
type ReplayFrame = { timestamp: number; vehicles: Pick<Vehicle, 'vehicle_id' | 'identity_confidence' | 'decision' | 'evidence'>[] };
type Demo = { run: { width: number; height: number; frames: number; sample_fps: number; replay_fps?: number; embedding_backend: string; device: string; ocr_status?: string; detector?: string; detection_width?: number }; vehicles: Vehicle[]; video_available: boolean; timeline?: ReplayFrame[] };

export default function AIDemo() {
  const [demo, setDemo] = useState<Demo | null>(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [playbackTime, setPlaybackTime] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pending = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setError(''); setLoading(true);
    try {
      const data = await request<Demo>('/api/ai-demo', { signal: controller.signal });
      if (controller.signal.aborted) return;
      setDemo(data);
      // A metadata refresh preserves playback; failed media can be retried here.
      if (videoRef.current?.error) videoRef.current.load();
      setSelectedId((previous) => data.vehicles.some((vehicle) => vehicle.vehicle_id === previous) ? previous : null);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof ApiError && cause.status === 404 ? 'No processed AI demo available.' : cause instanceof Error ? cause.message : 'Cannot load demo');
    } finally { if (!controller.signal.aborted) setLoading(false); if (pending.current === controller) pending.current = null; }
  }, []);
  useEffect(() => { void load(); return () => { pending.current?.abort(); pending.current = null; }; }, [load]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let handle: number | undefined;
    if (video.requestVideoFrameCallback) {
      const update: VideoFrameRequestCallback = (_, metadata) => {
        setPlaybackTime(metadata.mediaTime);
        handle = video.requestVideoFrameCallback(update);
      };
      handle = video.requestVideoFrameCallback(update);
    }
    return () => {
      if (handle !== undefined) video.cancelVideoFrameCallback(handle);
      video.pause(); video.removeAttribute('src'); video.load();
    };
  }, [demo?.video_available]);

  const synchronized = Boolean(demo?.video_available && demo.timeline?.length && !videoError);
  const fps = demo?.run.replay_fps || demo?.run.sample_fps || 1;
  const frameIndex = playbackTime === null ? -1 : Math.min(Math.floor(playbackTime * fps + 1e-6), (demo?.timeline?.length || 1) - 1);
  const { discovered, activeIds, sourceTime } = useMemo(() => {
    if (!demo || !synchronized) return { discovered: demo?.vehicles || [], activeIds: new Set<string>(), sourceTime: null };
    const timeline = demo.timeline!;
    const known = new Map(demo.vehicles.map((vehicle) => [vehicle.vehicle_id, vehicle]));
    const seen = new Map<string, Vehicle>();
    // Array position is replay time; timestamps are source-video time. Empty
    // frames matter. Rebuilding through the current frame also handles seeking.
    for (let index = 0; index <= frameIndex; index++) {
      for (const observation of timeline[index].vehicles) {
        const vehicle = known.get(observation.vehicle_id);
        if (!vehicle) continue;
        const previous = seen.get(vehicle.vehicle_id);
        seen.set(vehicle.vehicle_id, { ...vehicle, ...observation,
          decision: observation.decision ?? previous?.decision,
          identity_confidence: observation.identity_confidence ?? previous?.identity_confidence,
          evidence: observation.evidence ?? previous?.evidence ?? {},
          first_seen: previous?.first_seen ?? timeline[index].timestamp,
          last_seen: timeline[index].timestamp, observation_count: (previous?.observation_count || 0) + 1 });
      }
    }
    return { discovered: [...seen.values()], activeIds: new Set(timeline[frameIndex]?.vehicles.map((vehicle) => vehicle.vehicle_id)), sourceTime: timeline[frameIndex]?.timestamp ?? null };
  }, [demo, synchronized, frameIndex]);
  const selected = discovered.find((vehicle) => vehicle.vehicle_id === selectedId) ?? discovered.find((vehicle) => activeIds.has(vehicle.vehicle_id)) ?? discovered[0];
  const vehicles = discovered.filter((vehicle) => [vehicle.vehicle_id, vehicle.color, vehicle.make, vehicle.model].join(' ').toLowerCase().includes(query.trim().toLowerCase()));

  return <>
    <div className="welcome-row"><WorkspaceHeading eyebrow="INTELLIGENCE / RECORDED FOOTAGE" title="Highway vehicle replay" description="Inspect vehicle observations as they appear in a processed recording." /><button className="secondary-button" disabled={loading} onClick={() => void load()}><RefreshCw size={16} className={loading ? 'refreshing' : ''} aria-hidden="true" />{loading ? 'Loading results…' : 'Refresh results'}</button></div>
    <div className="replay-notice"><Film size={18} aria-hidden="true" /><p><strong>Recorded highway footage</strong> · Not a live Dublin feed. Pseudonymous identities; scores are heuristic, not verified identities. No owner lookup or cross-camera claim. Footage may contain readable plates.</p></div>
    {error && <div role="alert" className="notice notice-error">{error}{demo && ' Showing the last successful results.'}</div>}
    {!demo && !error && <div className="initial-state" role="status"><ScanLine size={30} aria-hidden="true" /><p>Loading AI results…</p></div>}
    {demo && <div className="content-grid ai-grid">
      <div className="ai-media-column">
        <section className="replay-panel panel" aria-label="Recorded video">
          <div className="section-heading"><h2><Film size={18} aria-hidden="true" />Sampled replay</h2><span className="badge">{playing ? 'PLAYING / RECORDED' : 'RECORDED'}</span></div>
          <div className="video-stage">{demo.video_available ? <>
            <video ref={videoRef} aria-label="Recorded highway footage" controls playsInline preload="metadata" src="/backend/api/ai-demo/media/browser.mp4"
              onLoadedData={(event) => { setVideoError(false); setPlaybackTime(event.currentTarget.currentTime); }}
              onTimeUpdate={(event) => setPlaybackTime(event.currentTarget.currentTime)} onSeeked={(event) => setPlaybackTime(event.currentTarget.currentTime)}
              onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => { setVideoError(true); setPlaying(false); }} />
            {videoError && <p className="video-error" role="alert">Replay could not load. You can still inspect the processed identities.</p>}
          </> : <div className="video-placeholder"><Film size={36} aria-hidden="true" /><h3>Browser video not prepared.</h3><p>The recording is unavailable. You can still inspect processed vehicle results.</p></div>}</div>
          <div className="replay-meta"><span>{demo.run.width} × {demo.run.height}</span><span>{demo.run.frames} frames at {demo.run.sample_fps} FPS</span><span>{sourceTime !== null ? `Source ${sourceTime.toFixed(2)}s` : 'Local inference · sampled footage'}</span></div>
          <p className="replay-guidance">Identities appear on their first detected frame. Seeking updates the list and matching evidence to that point in the replay.</p>
        </section>
        <details className="run-details panel" open><summary>Processing information</summary><dl>{[['Embedding / device', `${demo.run.embedding_backend} / ${demo.run.device}`], ['Detector', demo.run.detector ? `${demo.run.detector}${demo.run.detection_width ? ' · ' + demo.run.detection_width + 'px' : ''}` : 'Status unavailable'], ['OCR', demo.run.ocr_status || 'Status unavailable']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
      </div>
      <section className="vehicle-inspector panel" aria-label="Replay identities">
        <div className="section-heading"><div><span className="eyebrow">VEHICLE FINGERPRINTS</span><h2>Unique identities</h2></div><span className="heading-count" role="status" aria-live="polite" aria-atomic="true">{discovered.length} discovered</span></div>
        <p className="identity-timing">{synchronized ? `${activeIds.size} in frame · each identity listed once` : 'Full results · playback timing unavailable'}</p>
        <label className="search-field vehicle-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search vehicles</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Identity, colour, make or model…" /></label>
        <div className="replay-identity-list">{vehicles.map((vehicle) => <button className={'vehicle-card' + (activeIds.has(vehicle.vehicle_id) ? ' in-frame' : '')} key={vehicle.vehicle_id} onClick={() => setSelectedId(vehicle.vehicle_id)} aria-pressed={selected?.vehicle_id === vehicle.vehicle_id}>
          <Car size={21} aria-hidden="true" /><span><strong>{vehicle.vehicle_id}</strong><span>{vehicle.color || 'Unknown colour'} · {vehicle.observation_count} observations</span><span>First seen {vehicle.first_seen.toFixed(2)}s</span></span><span className="badge">{synchronized ? activeIds.has(vehicle.vehicle_id) ? 'In frame' : 'Previously seen' : vehicle.decision || 'Observed'}</span>
        </button>)}</div>
        {!vehicles.length && <p className="empty-state">{discovered.length ? 'No vehicles match your search.' : synchronized ? 'Play the video to discover vehicle identities. New fingerprints appear here as they are detected.' : 'No vehicles detected.'}</p>}
        <p className="collection-summary">Showing {vehicles.length} of {discovered.length} {synchronized ? 'discovered identities' : 'vehicle fingerprints'}</p>
        {selected && <div className="vehicle-details"><span className="eyebrow">SELECTED IDENTITY</span><div className="vehicle-identity"><span className="vehicle-icon"><Car size={28} aria-hidden="true" /></span><div><h3>{selected.vehicle_id} · {selected.color || 'Unknown colour'}</h3><span className="muted">{[selected.make, selected.model].filter(Boolean).join(' ') || 'Make / model unavailable'}</span></div></div>
          <dl className="detail-facts"><dt>Observations</dt><dd>{selected.observation_count}</dd><dt>Seen in recording</dt><dd>{selected.first_seen.toFixed(2)}s–{selected.last_seen.toFixed(2)}s</dd><dt>Decision</dt><dd>{selected.decision || 'Unavailable'}</dd><dt>Match confidence</dt><dd>{Math.round((selected.identity_confidence || 0) * 100)}%</dd></dl>
          <p className="confidence-note">Zero means no confirmed re-identification evidence, not failed tracking.</p><details className="technical-evidence"><summary>Matching evidence</summary><pre>{JSON.stringify(selected.evidence || {}, null, 2)}</pre></details>
        </div>}
      </section>
    </div>}
  </>;
}
