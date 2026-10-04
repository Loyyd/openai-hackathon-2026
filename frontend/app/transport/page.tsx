'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BusFront, Camera, MapPin, RefreshCw, Route, TriangleAlert } from 'lucide-react';
import { WorkspaceHeading } from '../../components/Dashboard';
import { Snapshot } from '../../components/Snapshot';
import { errorMessage } from '../../lib/api';
import { dateTime } from '../../lib/presentation';
import { nearbyTransport, providerCameras, type CameraCatalog, type NearbyData } from '../../lib/transport';

function ProviderSnapshot({ cameraId, name, revision }: { cameraId: string; name: string; revision: number }) {
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
  return <><div className="provider-image">{image ? <Snapshot src={image} name={name} className="detail-snapshot" /> : <div className="image-error"><Camera size={28} aria-hidden="true" /><span>TII roadside camera</span></div>}</div><p className="image-caption" role="status">{status}</p></>;
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
  return <>
    <div className="welcome-row"><WorkspaceHeading eyebrow="TII / OPENSTREETMAP / NTA" title="Ireland transport" description="Roadside visibility and public transport around each camera." /><button className="secondary-button" disabled={loading} onClick={() => setRevision((value) => value + 1)}><RefreshCw size={16} className={loading ? 'refreshing' : ''} aria-hidden="true" />{loading ? 'Loading provider data…' : 'Refresh provider data'}</button></div>
    <div className="replay-notice"><Camera size={18} aria-hidden="true" /><p><strong>Provider data</strong> · Independent of the city dataset and demo source. Snapshot capture times are not supplied by TII.</p></div>
    {error && <div className="notice notice-warning" role="alert"><TriangleAlert size={17} aria-hidden="true" />{error}{catalog && ' Showing the last successful catalogue.'}</div>}
    {loading && !catalog && <div className="initial-state" role="status"><Camera size={30} aria-hidden="true" /><h2>Loading the camera catalogue…</h2><p>Retrieving provider records and their availability.</p></div>}
    {catalog && <>
      <div className="provider-toolbar"><label className="provider-picker">TII camera<select aria-label="TII camera" value={selected} onChange={(event) => { setSelected(event.target.value); setNearbyRequested(false); }} disabled={!catalog.cameras.length}>{catalog.cameras.map((item) => <option key={item.id} value={item.id}>{item.name || item.id} · {item.location.road || 'Road unavailable'}</option>)}</select></label><div className="provider-catalog-status"><span className="badge">Catalogue: {catalog.mode}</span><span>Retrieved <time dateTime={catalog.generated_at}>{dateTime(catalog.generated_at)}</time></span></div></div>
      {catalog.warning && <p className="notice notice-warning" role="status">{catalog.warning}</p>}
      {camera && <div className="content-grid transport-grid">
        <section className="panel provider-panel" aria-label="Provider camera"><div className="section-heading"><h2><Camera size={18} aria-hidden="true" />{camera.name || camera.id}</h2><span className="badge">{camera.location.road || 'Road unavailable'}</span></div><ProviderSnapshot cameraId={camera.id} name={camera.name || camera.id} revision={revision} /><p className="provider-location"><MapPin size={15} aria-hidden="true" />{camera.location.place || 'Location name unavailable'}</p><p className="muted">TII Traffic · Catalogue record updated <time dateTime={camera.source_updated_at ?? undefined}>{dateTime(camera.source_updated_at)}</time></p></section>
        <section className="panel provider-panel" aria-label="Nearby public transport"><div className="section-heading"><h2><BusFront size={19} aria-hidden="true" />Nearby transport</h2><span className="badge">1.5 km radius</span></div>
          <p className="muted">Stops, routes and available service updates around the selected camera.</p><button className="secondary-button" disabled={lat == null || lon == null || nearbyLoading} onClick={() => { if (nearbyRequested) setRevision((value) => value + 1); else setNearbyRequested(true); }}><Route size={16} aria-hidden="true" />{nearbyLoading ? 'Loading nearby transport…' : nearbyRequested ? 'Refresh nearby transport' : 'Load nearby transport'}</button>
          {lat == null || lon == null ? <p className="muted">Coordinates are unavailable for this camera.</p> : !nearbyRequested && <p className="transport-hint">Load nearby transport to see service information for this location.</p>}
          {nearbyError && <p className="inline-error" role="alert">{nearbyError}</p>}
          {nearby && <div className="nearby-results"><p className="muted" role="status">Source: {nearby.mode} · NTA realtime: {nearby.realtime_status}<br />Retrieved {dateTime(nearby.generated_at)}</p>{nearby.warning && <p className="notice notice-warning">{nearby.warning}</p>}{nearby.mode !== 'live' && <p className="notice notice-warning">Cached or illustrative data. Do not treat these results as current service information.</p>}
            <h3>Bus stops <span className="heading-count">{nearby.stops.length}</span></h3>{nearby.stops.length ? <ul>{nearby.stops.map((stop) => <li key={stop.id}><strong>{stop.name || stop.id}</strong><span>{stop.distance_m} m · {stop.routes.join(', ') || 'Routes unavailable'}</span></li>)}</ul> : <p className="muted">No stops supplied for this location.</p>}
            <h3>Routes <span className="heading-count">{nearby.routes.length}</span></h3>{nearby.routes.length ? <ul>{nearby.routes.map((route) => <li key={route.id}>{route.ref || route.name || route.id}</li>)}</ul> : <p className="muted">No routes supplied.</p>}
            <h3>Vehicles <span className="heading-count">{nearby.vehicles.length}</span></h3>{nearby.vehicles.length ? <ul>{nearby.vehicles.map((vehicle) => <li key={vehicle.id}><strong>{vehicle.label || vehicle.id}</strong><span>Route {vehicle.route_id || 'unknown'} · {vehicle.delay_seconds == null ? 'Delay unavailable' : `${vehicle.delay_seconds} s delay`}</span></li>)}</ul> : <p className="muted">No vehicle positions supplied.</p>}
            <p className="muted">{nearby.delays.length} delay updates · {nearby.alerts.length} alerts</p>{nearby.realtime_status === 'not_configured' && <p className="notice">NTA realtime is not configured. Bus stops and routes remain available.</p>}
          </div>}
        </section>
      </div>}
      {!catalog.cameras.length && <div className="initial-state"><Camera size={30} aria-hidden="true" /><h2>No provider cameras available</h2><p>Refresh provider data to try the catalogue again.</p></div>}
    </>}
    <div className="provider-attribution"><span>TII Traffic · © OpenStreetMap contributors · NTA/TFI</span><Link className="text-button" href="/">Return to city overview</Link></div>
  </>;
}
