'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { divIcon, type LatLngTuple } from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { useApplication } from './ApplicationProvider';
import type { MapProps } from './MapPanel';
import { dateTime } from '../lib/presentation';
import type { Location, Selection } from '../types';

type Props = MapProps & { layers: { cameras: boolean; incidents: boolean; transport: boolean }; fit: number };
type Place = { location: Location; entries: { key: string; title: string; kind: 'camera' | 'incident' | 'transport'; selection: Selection; detail?: string; severity?: string }[] };
const tileUrl = process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const attribution = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const position = (location: Location): LatLngTuple => [location.latitude, location.longitude];
const valid = (location: Location) => Number.isFinite(location.latitude) && Number.isFinite(location.longitude) && Math.abs(location.latitude) <= 90 && Math.abs(location.longitude) <= 180;

function MapPosition({ selected, fit, coverage }: { selected?: Location; fit: number; coverage: Location[] }) {
  const { setMapView } = useApplication();
  const map = useMap();
  useMapEvents({ moveend: () => { const center = map.getCenter(); setMapView({ center: [center.lat, center.lng], zoom: map.getZoom() }); } });
  const latestCoverage = useRef(coverage);
  latestCoverage.current = coverage;
  const latitude = selected?.latitude;
  const longitude = selected?.longitude;
  useEffect(() => {
    if (latitude !== undefined && longitude !== undefined && valid({ latitude, longitude } as Location)) map.panTo([latitude, longitude], { animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches });
  }, [map, latitude, longitude]);
  useEffect(() => {
    const points = latestCoverage.current.filter(valid).map(position);
    if (fit && points.length) map.fitBounds(points, { padding: [40, 40], maxZoom: 14, animate: false });
    else if (fit) map.setView([53.374, -6.285], 11);
  }, [fit, map]);
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  useEffect(() => {
    const container = map.getContainer();
    const reduceMotion = (event: KeyboardEvent) => {
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches || event.altKey || event.ctrlKey || event.metaKey) return;
      const directions: Record<string, [number, number]> = { ArrowLeft: [-80, 0], ArrowRight: [80, 0], ArrowUp: [0, -80], ArrowDown: [0, 80] };
      const offset = directions[event.key];
      if (offset) { event.preventDefault(); event.stopImmediatePropagation(); map.panBy(offset.map((value) => value * (event.shiftKey ? 3 : 1)) as [number, number], { animate: false }); }
    };
    container.addEventListener('keydown', reduceMotion, true);
    return () => container.removeEventListener('keydown', reduceMotion, true);
  }, [map]);
  return null;
}

export default function CityMap({ cameras, incidents, transport, selection, onSelect, layers, fit }: Props) {
  const { mapView } = useApplication();
  const [tilesFailed, setTilesFailed] = useState(false);
  const places = useMemo(() => {
    const groups = new Map<string, Place>();
    const add = (location: Location, entry: Place['entries'][number]) => {
      if (!valid(location)) return;
      const key = location.latitude.toFixed(5) + ',' + location.longitude.toFixed(5);
      const place = groups.get(key) ?? { location, entries: [] };
      place.entries.push(entry);
      groups.set(key, place);
    };
    if (layers.incidents) incidents.forEach((item) => add(item.location, { key: item.id, title: item.title, kind: 'incident', severity: item.severity, selection: { kind: 'incident', id: item.id } }));
    if (layers.cameras) cameras.forEach((item) => add(item.location, { key: item.id, title: item.name, kind: 'camera', selection: { kind: 'camera', id: item.id } }));
    if (layers.transport) transport.forEach((item) => add(item.location, { key: item.id, title: item.type + ' · Route ' + item.route, kind: 'transport', selection: null, detail: item.provider + ' · ' + dateTime(item.timestamp) + (item.delay_seconds != null ? ' · Delay ' + Math.round(item.delay_seconds / 60) + ' min' : '') }));
    return [...groups.entries()];
  }, [cameras, incidents, transport, layers]);
  const selected = selection?.kind === 'camera' ? cameras.find((item) => item.id === selection.id)?.location : incidents.find((item) => item.id === selection?.id)?.location;
  return <div className="map-wrap">
    {tilesFailed && <div className="tile-warning" role="status">Map tiles unavailable. Markers, lists and details remain available.</div>}
    <MapContainer center={mapView.center} zoom={mapView.zoom} scrollWheelZoom={false} className="city-map">
      <TileLayer className={process.env.NEXT_PUBLIC_MAP_TILE_URL ? 'custom-map-tiles' : 'default-osm-tiles'} url={tileUrl} attribution={attribution} eventHandlers={{ tileerror: () => setTilesFailed(true), loading: () => setTilesFailed(false) }} />
      <MapPosition selected={selected} fit={fit} coverage={[...cameras, ...incidents, ...transport].map((item) => item.location)} />
      {places.map(([key, place]) => {
        const active = Boolean(selection && place.entries.some((item) => item.selection?.id === selection.id && item.selection?.kind === selection.kind));
        const kind = place.entries[0].severity || place.entries[0].kind;
        const label = place.location.name + ': ' + place.entries.map((item) => item.title).join(', ');
        const icon = divIcon({ className: 'location-marker marker-' + kind + (active ? ' marker-selected' : ''), html: '<span>' + (place.entries.length > 1 ? place.entries.length : place.entries[0].kind === 'incident' ? '!' : place.entries[0].kind === 'camera' ? '⌖' : '↔') + '</span>', iconSize: [32, 32], iconAnchor: [16, 16] });
        return <Marker key={key + label} position={position(place.location)} icon={icon} title={label} alt={label} eventHandlers={{ click: () => { if (place.entries.length === 1 && place.entries[0].selection) onSelect(place.entries[0].selection); } }}>
          <Popup><div className="location-popup"><strong>{place.location.name}</strong>{place.entries.map((entry) => entry.selection ? <button key={entry.kind + entry.key} onClick={() => onSelect(entry.selection)}><small>{entry.kind}</small>{entry.title}<span aria-hidden="true"> ↗</span></button> : <p key={entry.key}><b>{entry.title}</b><br />{entry.detail}</p>)}</div></Popup>
        </Marker>;
      })}
    </MapContainer>
  </div>;
}
