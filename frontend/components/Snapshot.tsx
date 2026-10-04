'use client';

import { useState } from 'react';

export function Snapshot({ src, name, className = '' }: { src: string; name: string; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <div className={'snapshot ' + className}>
    {!src || failedUrl === src ? <div className="image-error" role="status"><span aria-hidden="true">⌖</span>Snapshot unavailable<span className="muted">The image could not be loaded.</span></div> :
      // Camera providers supply browser-accessible images; preserve their URLs.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={'Camera snapshot: ' + name} onError={() => setFailedUrl(src)} loading="lazy" />}
  </div>;
}
