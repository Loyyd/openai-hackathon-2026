'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

export type TopBarItem = { key: string; label: string; icon: ReactNode; href: string; onClick?: () => void };

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
export const navIcons = {
  map: <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" {...stroke}><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" /><path d="M9 4v14M15 6v14" /></svg>,
  camera: <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" {...stroke}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7l2-3h4l2 3" /><circle cx="12" cy="13.5" r="3.5" /></svg>,
  ai: <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" {...stroke}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  transport: <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" {...stroke}><rect x="5" y="3" width="14" height="16" rx="3" /><path d="M5 11h14M8 19l-1 2M16 19l1 2" /></svg>,
};

export function TopBar({ items, active, children }: { items: TopBarItem[]; active: string; children?: ReactNode }) {
  return <header className="topbar">
    <Link href="/" className="brand" aria-label="SentinelX home" data-focus-home>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/sentinelx-logo.svg" alt="" width="190" height="35" /><span className="sr-only">SentinelX</span>
    </Link>
    <nav className="main-nav" aria-label="Main navigation">
      {items.map((item) => <Link key={item.key} href={item.href} onClick={item.onClick} className={active === item.key ? 'nav-active' : ''} aria-current={active === item.key ? 'page' : undefined}>{item.icon}<span>{item.label}</span></Link>)}
    </nav>
    <div className="header-right">{children}</div>
  </header>;
}
