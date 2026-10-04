'use client';

import { useState } from 'react';
import type { Camera } from '../types';
import { dateTime, timeAgo } from '../lib/presentation';
import { Snapshot } from './Snapshot';

export function CameraGallery({ cameras, expanded, onExpand, onSelect }: { cameras: Camera[]; expanded: boolean; onExpand: () => void; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const matches = cameras.filter((item) => (item.name + ' ' + item.provider + ' ' + item.location.name).toLowerCase().includes(query.toLowerCase().trim()));
  const visible = expanded || query ? matches : matches.slice(0, 4);
  return <section className="cameras-section" id="cameras" aria-labelledby="cameras-heading">
    <div className="section-heading"><div><span className="eyebrow">NETWORK SNAPSHOT</span><h2 id="cameras-heading">Camera previews <span className="heading-count">{cameras.length}</span></h2></div><button className="text-button" onClick={onExpand} aria-expanded={expanded}>{expanded ? 'Show fewer cameras' : 'All cameras'} ↗</button></div>
    <label className="search-field camera-search"><span className="sr-only">Search cameras</span><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a camera, location or provider" /></label>
    <div className="camera-grid">{visible.map((camera) => <button className="camera-card" key={camera.id} onClick={() => onSelect(camera.id)} aria-label={'Open camera ' + camera.name}>
      <div className="camera-image"><Snapshot key={camera.last_updated} src={camera.image_url} name={camera.name} /><span className="camera-label">{/demo|synthetic/i.test(camera.provider) ? 'SYNTHETIC' : 'SNAPSHOT'}</span><span className="camera-expand" aria-hidden="true">↗</span></div>
      <span className="camera-info"><strong>{camera.name}</strong><span>{camera.location.name}</span><span className="camera-meta"><span>{camera.provider}</span><time dateTime={camera.last_updated} title={dateTime(camera.last_updated)}>{timeAgo(camera.last_updated)}</time></span></span>
    </button>)}</div>
    {!matches.length && <div className="empty-state">{cameras.length ? 'No cameras match your search.' : 'No cameras in this dataset.'}</div>}
    <p className="collection-summary">Showing {visible.length} of {matches.length} cameras · Image times are supplied by the provider.</p>
  </section>;
}
