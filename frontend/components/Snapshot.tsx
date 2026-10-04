'use client';

import { useState } from 'react';
import { snapshotUrl } from '../lib/presentation';

export function Snapshot({ src, name, className = '' }: { src: string; name: string; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <div className={'snapshot ' + className}>
    {!src || failedUrl === src ? <div className="image-error" role="status"><span aria-hidden="true">⌖</span>Snapshot unavailable<span className="muted">The image could not be loaded.</span></div> :
      // Stored snapshots use the same-origin API proxy; external provider URLs stay intact.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={snapshotUrl(src)} alt={'Camera snapshot: ' + name} onError={() => setFailedUrl(src)} loading="lazy" />}
  </div>;
}
