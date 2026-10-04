'use client';

import { useEffect, useRef, useState } from 'react';
import type Hls from 'hls.js';
import type { ApiClient } from '../lib/api';
import { dateTime, timestamp } from '../lib/presentation';
import { useObservations } from '../hooks/useDashboard';
import type { Camera, CameraStream } from '../types';
import { Snapshot } from './Snapshot';

function StreamPlayer({ stream, onError }: { stream: CameraStream; onError: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current!;
    let disposed = false;
    let hls: Hls | undefined;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = stream.url;
    } else {
      void import('hls.js').then(({ default: HlsPlayer }) => {
        if (disposed) return;
        if (!HlsPlayer.isSupported()) { onError(); return; }
        hls = new HlsPlayer();
        hls.on(HlsPlayer.Events.ERROR, (_, data) => { if (data.fatal) onError(); });
        hls.loadSource(stream.url);
        hls.attachMedia(video);
      }).catch(() => { if (!disposed) onError(); });
    }
    return () => { disposed = true; hls?.destroy(); video.pause(); video.removeAttribute('src'); video.load(); };
  }, [stream, onError]);
  return <video ref={ref} className="stream-video" aria-label="Selected camera live video" autoPlay muted playsInline controls onError={onError} />;
}

export function CameraDetails({ camera, observationId, client, refreshKey, onBack }: { camera: Camera; observationId?: string; client: ApiClient; refreshKey: string | null; onBack?: () => void }) {
  const history = useObservations(client, [camera.id], refreshKey);
  const [selected, setSelected] = useState(observationId ?? 'latest');
  const [stream, setStream] = useState<CameraStream | null>(null);
  const [streamStatus, setStreamStatus] = useState('Checking video availability…');
  const [playing, setPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const failed = useRef(() => { setPlaybackError(true); setPlaying(false); });
  useEffect(() => {
    const controller = new AbortController();
    void client.stream(camera.id, controller.signal).then((value) => {
      if (!controller.signal.aborted) { setStream(value); setStreamStatus(value ? 'Live video available' : 'Snapshot monitoring · no video feed supplied'); }
    }).catch(() => { if (!controller.signal.aborted) setStreamStatus('Video service unavailable · snapshots remain available'); });
    return () => controller.abort();
  }, [camera.id, client]);
  const newest = history.observations[0];
  const observation = selected === 'latest' ? newest && timestamp(newest.timestamp) > timestamp(camera.last_updated) ? newest : undefined : history.observations.find((item) => item.id === selected);
  const missing = selected !== 'latest' && !observation;
  const imageTime = observation?.timestamp ?? camera.last_updated;
  return <>
    {onBack && <button className="text-button back-button" onClick={onBack}>← Back to incident</button>}
    <div className="detail-tags"><span className="badge">{camera.provider}</span><span className="badge">{camera.location.name}</span></div>
    {missing ? <div className="empty-state">{history.loading ? 'Loading evidence…' : 'Evidence unavailable. This observation is not in the camera history.'}</div> :
      <>{playing && stream ? <StreamPlayer stream={stream} onError={failed.current} /> : <Snapshot key={imageTime} src={observation?.image_url ?? camera.image_url} name={camera.name} className="detail-snapshot" />}
        <p className="image-caption">Snapshot captured <time dateTime={imageTime}>{dateTime(imageTime)}</time>{selected === 'latest' && observation ? ' · Newer observation' : ''}</p></>}
    <div className="video-status"><span className="muted">{streamStatus}</span>{stream && <button className="secondary-button" onClick={() => { setPlaybackError(false); setPlaying(!playing); }}>{playing ? 'Return to snapshot' : 'Watch live video'}</button>}</div>
    {playbackError && <p className="inline-error" role="status">Video playback failed. Showing the snapshot.</p>}
    <section className="detail-section"><h3>Observation history <span className="heading-count">{history.observations.length}</span></h3><p className="muted">Newest first. Select an observation to inspect an earlier snapshot.</p>
      {history.error && <div className="notice notice-warning" role="status">{history.error}<button className="text-button" onClick={history.retry}>Retry history</button></div>}
      <div className="observation-list">
        <button className={'observation-row' + (selected === 'latest' ? ' selected' : '')} aria-pressed={selected === 'latest'} onClick={() => { setSelected('latest'); setPlaying(false); }}><span>Latest available snapshot</span><span>↗</span></button>
        {history.observations.map((item) => <button key={item.id} className={'observation-row' + (selected === item.id ? ' selected' : '')} aria-pressed={selected === item.id} onClick={() => { setSelected(item.id); setPlaying(false); }}><span><time dateTime={item.timestamp}>{dateTime(item.timestamp)}</time><small>{item.id}</small></span><span aria-hidden="true">↗</span></button>)}
      </div>
      {!history.loading && !history.observations.length && <p className="muted">No observations available.</p>}
      {history.loading && <p role="status" className="muted">Loading observation history…</p>}
    </section>
  </>;
}
