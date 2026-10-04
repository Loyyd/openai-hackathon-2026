'use client';

import { useState } from 'react';
import type { Camera } from '../types';
import { dateTime, timeAgo } from '../lib/presentation';
import { Snapshot } from './Snapshot';

export function CameraGallery({ cameras, expanded, onExpand, onSelect, standalone = false }: { standalone?: boolean; cameras: Camera[]; expanded: boolean; onExpand: () => void; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 12;
  const matches = cameras.filter((item) => (item.name + ' ' + item.provider + ' ' + item.location.name).toLowerCase().includes(query.toLowerCase().trim()));
  const paginated = standalone || expanded || Boolean(query);
  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = paginated ? matches.slice(currentPage * pageSize, (currentPage + 1) * pageSize) : matches.slice(0, 4);
  return <section className="cameras-section" id="cameras" aria-labelledby="cameras-heading">
    <div className="section-heading"><div><span className="eyebrow">NETWORK SNAPSHOT</span><h2 id="cameras-heading">{standalone ? 'All cameras' : 'Camera previews'} <span className="heading-count">{cameras.length}</span></h2></div>{!standalone && <button className="text-button" onClick={onExpand} aria-expanded={expanded}>{expanded ? 'Show fewer cameras' : 'All cameras'} ↗</button>}</div>
    <label className="search-field camera-search"><span className="sr-only">Search cameras</span><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Find a camera, location or provider" /></label>
    <div className="camera-grid">{visible.map((camera) => <button className="camera-card" key={camera.id} onClick={() => onSelect(camera.id)} aria-label={'Open camera ' + camera.name}>
      <div className="camera-image"><Snapshot key={camera.image_url} src={camera.image_url} name={camera.name} /><span className="camera-label">{/demo|synthetic/i.test(camera.provider) ? 'SYNTHETIC' : 'SNAPSHOT'}</span><span className="camera-expand" aria-hidden="true">↗</span></div>
      <span className="camera-info"><strong>{camera.name}</strong><span>{camera.location.name}</span><span className="camera-meta"><span>{camera.provider}</span><time dateTime={camera.last_updated} title={dateTime(camera.last_updated)}>{timeAgo(camera.last_updated)}</time></span></span>
    </button>)}</div>
    {!matches.length && <div className="empty-state">{cameras.length ? 'No cameras match your search.' : 'No cameras in this dataset.'}</div>}
    {paginated && pageCount > 1 && <nav className="gallery-pagination" aria-label="Camera gallery pages">
      <button className="secondary-button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous cameras</button>
      <span>Page {currentPage + 1} of {pageCount}</span>
      <button className="secondary-button" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Next cameras</button>
    </nav>}
    <p className="collection-summary">Showing {visible.length} of {matches.length} cameras · TII timestamps show retrieval time; provider capture time is unknown.</p>
  </section>;
}
