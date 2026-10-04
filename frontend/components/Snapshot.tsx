'use client';

import { useState } from 'react';
import { snapshotUrl } from '../lib/presentation';
import { CameraOff, LoaderCircle } from 'lucide-react';

export function Snapshot({ src, name, className = '' }: { src: string; name: string; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const failed = !src || failedUrl === src;
  return <div className={'snapshot ' + className} aria-busy={!failed && loadedUrl !== src}>
    {failed ? <div className="image-error" role="status"><CameraOff size={25} aria-hidden="true" />Snapshot unavailable<span className="muted">{src ? 'The image could not be loaded.' : 'No image was supplied.'}</span></div> : <>
      {loadedUrl !== src && <div className="image-loading" role="status"><LoaderCircle size={21} className="refreshing" aria-hidden="true" /><span className="sr-only">Loading snapshot</span></div>}
      {/* Proxy stored snapshots while preserving external provider URLs. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={snapshotUrl(src)} alt={'Camera snapshot: ' + name} onLoad={() => setLoadedUrl(src)} onError={() => setFailedUrl(src)} loading="lazy" />
    </>}
  </div>;
}
