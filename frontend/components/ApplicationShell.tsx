'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, ArrowUpRight, Camera, ChevronRight, CircleAlert, LayoutDashboard, MapPin, Menu, PanelLeftClose, PanelLeftOpen, RefreshCw, ScanLine, Route, ShieldCheck, UserRound } from 'lucide-react';
import { useApplication } from './ApplicationProvider';
import { ThemeControl } from './ThemeProvider';
import { ConnectionStatus } from './ConnectionStatus';
import { DetailDialog } from './DetailDialog';

const workspaces = [{ href: '/', title: 'Overview', icon: LayoutDashboard }, { href: '/incidents', title: 'Incidents', icon: CircleAlert }, { href: '/cameras', title: 'Cameras', icon: Camera }, { href: '/transport', title: 'Ireland transport', icon: Route }, { href: '/ai', title: 'AI replay', icon: ScanLine }];

export function ApplicationShell({ children }: { children: ReactNode }) {
  const app = useApplication();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  const navigation = <nav className="workspace-nav" aria-label="Main navigation">{workspaces.map(({ href, title, icon: Icon }) => <Link key={href} href={href} title={title} aria-label={title} aria-current={pathname === href ? 'page' : undefined} className={pathname === href ? 'nav-active' : ''} onClick={() => setMobileOpen(false)}><Icon size={19} aria-hidden="true" /><span className="nav-label">{title}</span>{href === '/incidents' && <span className="nav-count">{app.dashboard.data ? app.active.length : '—'}</span>}</Link>)}</nav>;
  return <div className={'app-shell' + (collapsed ? ' sidebar-collapsed' : '')}>
    <a className="skip-link" href="#workspace">Skip to workspace</a>
    <aside className="sidebar" aria-label="Workspace sidebar">
      <Link href="/" className="brand" aria-label="SentinelX home" data-focus-home><span className="brand-mark"><Activity size={23} aria-hidden="true" /></span><span className="brand-word" aria-hidden="true" /></Link>
      <div className="workspace-identity"><span className="workspace-avatar"><MapPin size={18} aria-hidden="true" /></span><span className="nav-label"><strong>Dublin operations</strong><small>City monitoring workspace</small></span></div>
      <p className="nav-group-label">WORKSPACE</p>{navigation}
      <div className="sidebar-bottom"><div className="workspace-note"><ShieldCheck size={19} aria-hidden="true" /><span>Public visibility.<br /><strong>Operator-led response.</strong></span></div><span className="sidebar-version">SENTINELX <span>01 / DUBLIN</span></span></div>
    </aside>
    <div className="app-main">
      <header className="workspace-header"><div className="breadcrumbs"><button className="icon-button desktop-toggle" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed}>{collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button><button className="icon-button mobile-toggle" aria-label="Open navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu size={21} /></button><span className="breadcrumb-city">Workspace <ChevronRight size={14} aria-hidden="true" /></span><strong>{workspaces.find((item) => item.href === pathname)?.title ?? 'Workspace'}</strong></div>
        <div className="header-actions"><ThemeControl /><span className="header-divider" /><button className="icon-button" aria-label={app.dashboard.refreshing ? 'Refreshing data' : 'Refresh data'} title="Refresh data" disabled={app.dashboard.refreshing} onClick={() => void app.dashboard.refresh()}><RefreshCw size={18} className={app.dashboard.refreshing ? 'refreshing' : ''} /></button>{app.session.user ? <><span className="operator-name">{app.session.user.display_name}<small>{app.source === 'demo' ? 'Demo operator' : 'Operator'}</small></span><button className="secondary-button sign-out" disabled={app.session.busy} onClick={() => void app.session.logout().catch(() => undefined)}>Sign out</button></> : <button className="secondary-button operator-button" onClick={() => app.setLogin(true)}><UserRound size={16} aria-hidden="true" /><span>Operator sign in</span></button>}</div>
      </header>
      <main className="page-content" id="workspace" tabIndex={-1}>
        <ConnectionStatus source={app.source} data={app.dashboard.data} error={app.dashboard.error} workflowStatus={app.dashboard.workflowStatus} workflowError={app.dashboard.workflowError} lastSuccess={app.dashboard.lastSuccess} refreshing={app.dashboard.refreshing} onRetry={() => void app.dashboard.refresh()} onSource={app.onSource} sessionError={app.session.error} />
        {children}
        <footer><span><span className="connection-dot" /> DUBLIN OPERATIONS</span><span>{app.source === 'demo' ? 'Synthetic demo' : 'Backend data'} · Public viewing</span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Map attribution <ArrowUpRight size={13} aria-hidden="true" /></a></footer>
      </main>
    </div>
    {mobileOpen && <DetailDialog title="Navigation" eyebrow="SENTINELX WORKSPACE" onClose={() => setMobileOpen(false)} variant="navigation">{navigation}<p className="muted">Dublin, Ireland · City operations</p></DetailDialog>}
  </div>;
}
