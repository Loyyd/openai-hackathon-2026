'use client';

import Link from 'next/link';
import { ArrowUpRight, Camera as CameraIcon, Search } from 'lucide-react';
import { dateTime, timeAgo } from '../lib/presentation';
import { Snapshot } from './Snapshot';
import { useApplication } from './ApplicationProvider';

export function CameraGallery({ preview = false }: { preview?: boolean }) {
  const { cameras, cameraQuery, setCameraQuery, select } = useApplication();
  const matches = cameras.filter((item) => (item.name + ' ' + item.provider + ' ' + item.location.name).toLowerCase().includes(cameraQuery.toLowerCase().trim()));
  const visible = preview ? cameras.slice(0, 4) : matches;
  return <section className={'cameras-section' + (preview ? ' camera-preview-section' : '')} aria-labelledby="cameras-heading">
    <div className="section-heading"><div>{preview && <span className="eyebrow">VISUAL COVERAGE</span>}<h2 id="cameras-heading">{preview ? 'Across the camera network' : 'Camera collection'} <span className="heading-count">{cameras.length}</span></h2></div>{preview && <Link className="text-button" href="/cameras">All cameras <ArrowUpRight size={16} aria-hidden="true" /></Link>}</div>
    {!preview && <div className="camera-toolbar"><label className="search-field"><Search size={18} aria-hidden="true" /><span className="sr-only">Search cameras</span><input type="search" value={cameraQuery} onChange={(event) => setCameraQuery(event.target.value)} placeholder="Find a camera, location or provider…" /></label><span className="result-count" role="status">{matches.length} cameras</span></div>}
    <div className={'camera-grid' + (preview ? ' preview-grid' : '')}>{visible.map((camera) => <button className="camera-card" key={camera.id} onClick={() => select({ kind: 'camera', id: camera.id })} aria-label={'Open camera ' + camera.name}>
      <div className="camera-image"><Snapshot key={camera.last_updated} src={camera.image_url} name={camera.name} /><span className="camera-label"><CameraIcon size={12} aria-hidden="true" />{/demo|synthetic/i.test(camera.provider) ? 'SYNTHETIC' : 'SNAPSHOT'}</span><span className="camera-expand" aria-hidden="true"><ArrowUpRight size={17} /></span></div>
      <span className="camera-info"><strong>{camera.name}</strong><span>{camera.location.name}</span><span className="camera-meta"><span>{camera.provider}</span><time dateTime={camera.last_updated} title={dateTime(camera.last_updated)}>{timeAgo(camera.last_updated)}</time></span></span>
    </button>)}</div>
    {!visible.length && <div className="empty-state"><CameraIcon size={28} aria-hidden="true" /><p>{cameras.length ? 'No cameras match your search.' : 'No cameras in this dataset.'}</p>{cameraQuery && <button className="text-button" onClick={() => setCameraQuery('')}>Clear camera search</button>}</div>}
    <p className="collection-summary">Showing {visible.length} of {preview ? cameras.length : matches.length} cameras · Image times are supplied by the provider.</p>
  </section>;
}
