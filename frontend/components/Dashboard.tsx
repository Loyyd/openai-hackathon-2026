'use client';

import Link from 'next/link';
import { Activity, ArrowUpRight, Camera, CircleAlert, ScanLine } from 'lucide-react';
import { useApplication } from './ApplicationProvider';
import { MapPanel } from './MapPanel';
import { IncidentQueue } from './IncidentList';
import { CameraGallery } from './CameraGallery';

export function WorkspaceHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="workspace-heading"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>;
}
export function DataBoundary({ children }: { children: React.ReactNode }) {
  const { dashboard } = useApplication();
  return dashboard.data ? children : <div className="initial-state" role="status"><Activity size={30} aria-hidden="true" /><h2>{dashboard.error ? 'City data is unavailable' : 'Connecting to the city dataset…'}</h2><p>{dashboard.error ? 'Retry the backend connection or choose demo data in the status bar.' : 'Loading incidents, camera snapshots and transport observations.'}</p></div>;
}

export function Dashboard() {
  const app = useApplication();
  const { data } = app.dashboard;
  return <>
    <div className="welcome-row"><WorkspaceHeading eyebrow="DUBLIN, IRELAND / OPERATIONS" title="City overview" description="Your operational picture. The signals that need your attention." /><Link href="/incidents" className="secondary-button">Incident workspace <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
    <section className="stats-grid" aria-label="City status">
      {[{ title: 'Active incidents', value: data ? app.active.length : '—', foot: data ? app.active.filter((item) => ['high', 'critical'].includes(item.severity)).length + ' high priority' : 'Waiting for data', icon: CircleAlert, testId: 'active-count', className: 'metric-alert' }, { title: 'Camera locations', value: data ? app.cameras.length : '—', foot: 'Provider snapshot coverage', icon: Camera }, { title: 'Transport signals', value: data ? data.transport.length : '—', foot: 'Bus & road observations', icon: Activity }, { title: 'Average confidence', value: app.active.length ? Math.round(app.active.reduce((sum, item) => sum + item.confidence, 0) / app.active.length * 100) + '%' : '—', foot: 'Supplied analysis · active incidents', icon: ScanLine }].map(({ title, value, foot, icon: Icon, testId, className = '' }) => <article className={'stat-card ' + className} key={title}><div className="stat-label">{title}<Icon size={18} aria-hidden="true" /></div><div className="stat-value" data-testid={testId}>{value}</div><div className="stat-foot">{foot}</div></article>)}
    </section>
    <DataBoundary><div className="content-grid overview-grid"><MapPanel cameras={app.cameras} incidents={app.matching} transport={data?.transport ?? []} selection={app.selection} onSelect={app.select} /><IncidentQueue /></div><CameraGallery preview /></DataBoundary>
  </>;
}
