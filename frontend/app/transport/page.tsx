'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { errorMessage } from '../../lib/api';
import { dateTime } from '../../lib/presentation';
import { nearbyTransport, providerCameras, type CameraCatalog, type NearbyData } from '../../lib/transport';
import { TopBar, navIcons } from '../../components/TopBar';

function ProviderSnapshot({ cameraId, revision }: { cameraId: string; revision: number }) {
  const [image, setImage] = useState('');
  const [status, setStatus] = useState('Loading snapshot…');
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';
    setImage(''); setStatus('Loading snapshot…');
    void fetch('/backend/api/v1/cameras/' + encodeURIComponent(cameraId) + '/snapshot', { signal: controller.signal, cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('Snapshot unavailable.');
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setImage(objectUrl);
      const state = response.headers.get('X-Snapshot-Status');
      setStatus(state === 'live' ? 'Retrieved from TII · capture time unknown' : state === 'stale-cache' ? 'Cached snapshot · provider unavailable' : 'Snapshot unavailable · offline placeholder');
    }).catch((error) => { if (!controller.signal.aborted) setStatus(errorMessage(error)); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [cameraId, revision]);
  return <><p role="status">{status}</p>{image && <div className="snapshot detail-snapshot">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={image} alt="Selected TII camera snapshot" />
  </div>}</>;
}

export default function TransportPage() {
  const [catalog, setCatalog] = useState<CameraCatalog | null>(null);
  const [selected, setSelected] = useState('');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nearby, setNearby] = useState<NearbyData | null>(null);
  const [nearbyError, setNearbyError] = useState('');
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyRequested, setNearbyRequested] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    void providerCameras(controller.signal).then((value) => {
      if (controller.signal.aborted) return;
      setCatalog(value);
      setSelected((previous) => value.cameras.some((camera) => camera.id === previous) ? previous : value.cameras[0]?.id ?? '');
    }).catch((cause) => { if (!controller.signal.aborted) setError(errorMessage(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  const camera = catalog?.cameras.find((item) => item.id === selected);
  const lat = camera?.location.latitude;
  const lon = camera?.location.longitude;
  useEffect(() => {
    const controller = new AbortController();
    setNearby(null); setNearbyError(''); setNearbyLoading(false);
    if (nearbyRequested && lat != null && lon != null) {
      setNearbyLoading(true);
      void nearbyTransport(lat, lon, controller.signal).then((value) => { if (!controller.signal.aborted) setNearby(value); })
        .catch((cause) => { if (!controller.signal.aborted) setNearbyError(errorMessage(cause)); })
        .finally(() => { if (!controller.signal.aborted) setNearbyLoading(false); });
    }
    return () => controller.abort();
  }, [lat, lon, nearbyRequested, revision]);
  return <main className="shell">
    <TopBar active="transport" items={[{ key: 'overview', label: 'Map', icon: navIcons.map, href: '/' }, { key: 'cameras', label: 'Camera gallery', icon: navIcons.camera, href: '/#cameras' }, { key: 'ai', label: 'AI demo', icon: navIcons.ai, href: '/ai' }]}><Link className="header-link" href="/transport" aria-current="page">Ireland transport</Link></TopBar>
    <div className="case-band"><div><span className="eyebrow">TII · OPENSTREETMAP · NTA</span><h1>Ireland transport</h1><p className="case-subtitle">Provider snapshots and nearby public transport.</p></div><div className="case-meta"><button className="refresh-button" disabled={loading} onClick={() => setRevision((value) => value + 1)}>{loading ? 'Loading…' : 'Refresh provider data'}</button></div></div>
    <div className="page-content">
      {error && <p role="alert">{error}{catalog && ' Showing the last successful catalogue.'}</p>}
      {catalog && <><p className="demo-notice">Camera catalogue: {catalog.mode} · Retrieved {dateTime(catalog.generated_at)}. Snapshot capture times are not supplied by TII.</p>{catalog.warning && <p role="status">{catalog.warning}</p>}
        <label className="provider-picker">Camera<select aria-label="TII camera" value={selected} onChange={(event) => { setSelected(event.target.value); setNearbyRequested(false); }}>{catalog.cameras.map((item) => <option key={item.id} value={item.id}>{item.name || item.id} · {item.location.road || 'Road unavailable'}</option>)}</select></label>
        {camera && <div className="content-grid"><section className="map-panel provider-panel"><h2>{camera.name || camera.id}</h2><ProviderSnapshot cameraId={camera.id} revision={revision} /><p className="muted">TII Traffic · Catalogue record updated {dateTime(camera.source_updated_at)}</p></section>
          <section className="incidents-panel provider-panel"><h2>Nearby transport · 1.5 km</h2><button className="secondary-button" disabled={lat == null || lon == null || nearbyLoading} onClick={() => { if (nearbyRequested) setRevision((value) => value + 1); else setNearbyRequested(true); }}>{nearbyLoading ? 'Loading nearby transport…' : 'Load nearby transport'}</button>
            {nearbyError && <p role="alert">{nearbyError}</p>}
            {nearby && <><p role="status">Source: {nearby.mode} · NTA realtime: {nearby.realtime_status}</p>{nearby.warning && <p>{nearby.warning}</p>}{nearby.mode !== 'live' && <p className="demo-notice">Cached or illustrative data. Do not treat these results as current service information.</p>}
              <h3>Bus stops ({nearby.stops.length})</h3><ul>{nearby.stops.map((stop) => <li key={stop.id}>{stop.name || stop.id} · {stop.distance_m} m · {stop.routes.join(', ') || 'Routes unavailable'}</li>)}</ul>
              <h3>Routes ({nearby.routes.length})</h3><ul>{nearby.routes.map((route) => <li key={route.id}>{route.ref || route.name || route.id}</li>)}</ul>
              <h3>Vehicles ({nearby.vehicles.length})</h3><ul>{nearby.vehicles.map((vehicle) => <li key={vehicle.id}>{vehicle.label || vehicle.id} · Route {vehicle.route_id || 'unknown'} · {vehicle.delay_seconds == null ? 'Delay unavailable' : `${vehicle.delay_seconds} s delay`}</li>)}</ul>
              <p>{nearby.delays.length} delay updates · {nearby.alerts.length} alerts</p>{nearby.realtime_status === 'not_configured' && <p>NTA realtime is not configured. Bus stops and routes remain available.</p>}
            </>}
          </section></div>}
        {!catalog.cameras.length && <p>No provider cameras available.</p>}
      </>}
      <footer><span>TII Traffic · © OpenStreetMap contributors · NTA/TFI</span><Link href="/">Return to stored incident dashboard</Link></footer>
    </div></main>;
}
