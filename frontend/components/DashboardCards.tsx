import Image from 'next/image';
import type { Camera, Incident } from '../types';

function timeAgo(value: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

const mapBounds = { minLatitude: 53.32, maxLatitude: 53.45, minLongitude: -6.42, maxLongitude: -6.15 };

// Chris: replace the schematic with a basemap without changing the API contracts.

function mapPosition(latitude: number, longitude: number) {
  const left = ((longitude - mapBounds.minLongitude) / (mapBounds.maxLongitude - mapBounds.minLongitude)) * 100;
  const top = ((mapBounds.maxLatitude - latitude) / (mapBounds.maxLatitude - mapBounds.minLatitude)) * 100;
  return { left: `${Math.min(94, Math.max(6, left))}%`, top: `${Math.min(88, Math.max(8, top))}%` };
}

export function MapPanel({ cameras, incidents }: { cameras: Camera[]; incidents: Incident[] }) {
  const incidentLocations = new Set(incidents.map(({ location }) => location.id));
  return <section className="map-panel" aria-label="Dublin incident map">
    <div className="map-topline"><div><span className="eyebrow">CITY OVERVIEW</span><h2>Dublin, Ireland</h2></div><span className="map-chip"><span className="live-dot" /> Schematic view</span></div>
    <div className="map-canvas">
      <div className="map-grid" />
      <svg className="river" viewBox="0 0 800 400" preserveAspectRatio="none" aria-hidden="true"><path d="M-20 250 C120 195 170 275 285 225 S475 230 560 185 S710 210 820 135" /></svg>
      <div className="road road-one" /><div className="road road-two" /><div className="road road-three" />
      {cameras.filter(({ location }) => !incidentLocations.has(location.id)).map((camera) => <div className="map-marker marker-camera" style={mapPosition(camera.location.latitude, camera.location.longitude)} key={camera.id} title={camera.name}>
        <span className="marker-pulse" /><span className="camera-icon">⌖</span><span className="marker-label">{camera.location.name}</span>
      </div>)}
      {incidents.map((incident) => <div className={`map-marker marker-${incident.severity}`} style={mapPosition(incident.location.latitude, incident.location.longitude)} key={incident.id} title={incident.title}>
        <span className="marker-pulse" /><span className="marker-icon">!</span><span className="marker-label">{incident.location.name}</span>
      </div>)}
      <div className="map-legend"><span><i className="legend-event" /> Incident</span><span><i className="legend-camera" /> Camera</span></div>
      <span className="map-credit">Dublin schematic · not a live map</span>
    </div>
    <div className="map-footer"><span><b>{cameras.length}</b> camera locations</span><span><b>{incidents.length}</b> active incidents</span><span>Coverage area <b>Greater Dublin</b></span></div>
  </section>;
}

export function IncidentCard({ incident }: { incident: Incident }) {
  return <article className="incident-card">
    <div className={`severity-mark severity-${incident.severity}`} />
    <div className="incident-copy"><div className="incident-heading"><h3>{incident.title}</h3><span className={`severity-tag tag-${incident.severity}`}>{incident.severity}</span></div>
      <p>{incident.description}</p><div className="incident-meta"><span>⌖ {incident.location.name}</span><span>{Math.round(incident.confidence * 100)}% confidence</span><span>{timeAgo(incident.last_seen)}</span></div>
    </div>
  </article>;
}

export function CameraCard({ camera }: { camera: Camera }) {
  return <article className="camera-card"><div className="camera-image"><Image src={camera.image_url || '/demo-camera.svg'} alt={`Synthetic preview for ${camera.name}`} width={720} height={360} unoptimized /><span className="camera-live"><i /> DEMO</span><span className="camera-expand" aria-hidden="true">↗</span></div>
    <div className="camera-info"><div><h3>{camera.name}</h3><p>{camera.location.name}</p></div><span className="camera-age">{timeAgo(camera.last_updated)}</span></div>
  </article>;
}
