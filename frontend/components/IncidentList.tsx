'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, MapPin, Search, SlidersHorizontal, X } from 'lucide-react';
import { dateTime, humanize, resolved, timeAgo } from '../lib/presentation';
import { defaultFilters, type IncidentFilters } from '../lib/filters';
import { useApplication } from './ApplicationProvider';
import type { Incident } from '../types';

export function IncidentQueue() {
  const app = useApplication();
  const filtered = (Object.keys(defaultFilters) as (keyof IncidentFilters)[]).some((key) => app.filters[key] !== defaultFilters[key]);
  return <section className="incidents-panel priority-queue" aria-labelledby="queue-heading">
    <div className="section-heading"><div><span className="eyebrow">{filtered ? 'FILTERED INCIDENTS' : 'REQUIRING ATTENTION'}</span><h2 id="queue-heading">Incident queue <span className="heading-count">{app.matching.length}</span></h2></div><Link className="text-button" href="/incidents" aria-label="View all incidents"><ArrowUpRight size={18} aria-hidden="true" /></Link></div>
    {filtered && <p className="queue-filter-note">Saved incident filters apply. <button className="text-button" onClick={() => app.setFilters(defaultFilters)}>Reset filters</button></p>}
    <div className="incident-list">{app.matching.slice(0, 4).map((incident) => <button key={incident.id} className="incident-card" onClick={() => app.select({ kind: 'incident', id: incident.id })} aria-label={'Inspect ' + incident.title}>
      <span className={'severity-mark severity-' + incident.severity} /><span className="incident-copy"><span className="incident-heading"><span className={'severity-tag tag-' + incident.severity}>{incident.severity}</span><span className="incident-age">{timeAgo(incident.last_seen)}</span></span><strong className="incident-title">{incident.title}</strong><span className="incident-meta"><MapPin size={13} aria-hidden="true" />{incident.location.name}</span><span className="incident-meta">{assignment(app, incident)} · {status(app, incident)}</span></span><ArrowUpRight className="card-arrow" size={16} aria-hidden="true" />
    </button>)}</div>
    {!app.matching.length && <div className="empty-state">{app.incidents.length ? 'No incidents match these filters.' : 'No incidents in this dataset.'}</div>}
    <Link href="/incidents" className="queue-footer">Open incident workspace <ArrowRight size={16} aria-hidden="true" /></Link>
  </section>;
}

function assignment(app: ReturnType<typeof useApplication>, incident: Incident) {
  const workflow = app.dashboard.workflows[incident.id];
  return (workflow?.assignee?.display_name ?? (app.dashboard.workflowStatus === 'ready' ? 'Unassigned' : 'Assignment unavailable')) + (app.dashboard.workflowStatus === 'stale' && workflow ? ' (stale)' : '');
}
function status(app: ReturnType<typeof useApplication>, incident: Incident) {
  const workflow = app.dashboard.workflows[incident.id];
  return resolved(incident, workflow) ? 'Resolved' : workflow?.acknowledged_at ? 'Acknowledged' : 'Active';
}

export function IncidentList() {
  const app = useApplication();
  const { filters, setFilters, matching } = app;
  const [expanded, setExpanded] = useState(false);
  const change = (key: keyof IncidentFilters, value: string) => setFilters({ ...filters, [key]: value });
  const chips = (Object.keys(filters) as (keyof IncidentFilters)[]).filter((key) => key !== 'status' && filters[key] !== defaultFilters[key]);
  return <section className="incidents-workspace panel" aria-label="Incident collection">
    <div className="collection-toolbar"><div className="status-tabs" role="group" aria-label="Incident status">{['active', 'resolved', 'all'].map((value) => <button key={value} aria-pressed={filters.status === value} onClick={() => change('status', value)}>{humanize(value)}</button>)}</div><span className="result-count" role="status">{matching.length} {matching.length === 1 ? 'incident' : 'incidents'}</span></div>
    <div className="filter-toolbar"><label className="search-field"><Search size={18} aria-hidden="true" /><span className="sr-only">Search incidents</span><input type="search" placeholder="Search incidents, locations or types…" value={filters.query} onChange={(event) => change('query', event.target.value)} /></label><button className="secondary-button" aria-label="Filters" aria-expanded={expanded} aria-controls="incident-filters" onClick={() => setExpanded(!expanded)}><SlidersHorizontal size={16} aria-hidden="true" />Filters{chips.length > 0 && <span className="heading-count">{chips.length}</span>}</button></div>
    {expanded && <div className="filter-grid" id="incident-filters">
      <label>Severity<select aria-label="Severity" value={filters.severity} onChange={(event) => change('severity', event.target.value)}><option value="all">All severities</option>{['critical', 'high', 'medium', 'low'].map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
      <label>Type<select aria-label="Type" value={filters.type} onChange={(event) => change('type', event.target.value)}><option value="all">All types</option>{[...new Set(app.incidents.map((item) => item.type))].sort().map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
      <label>Assignee<select aria-label="Assignee" value={filters.assignee} onChange={(event) => change('assignee', event.target.value)}><option value="all">Anyone</option><option value="unassigned">Unassigned</option><option value="me" disabled={!app.session.user}>Assigned to me</option>{app.operators.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select></label>
    </div>}
    {(chips.length > 0 || filters.status !== 'active') && <div className="filter-chips">{chips.map((key) => <button key={key} onClick={() => change(key, defaultFilters[key])} aria-label={'Remove ' + key + ' filter'}>{humanize(key)}: {key === 'assignee' ? app.operators.find((item) => item.id === filters[key])?.display_name ?? humanize(filters[key]) : humanize(filters[key])}<X size={13} aria-hidden="true" /></button>)}<button className="text-button" onClick={() => setFilters(defaultFilters)}>Reset filters</button></div>}
    {matching.length ? <table className="incident-table"><caption className="sr-only">Incidents ordered by severity, then most recent observation</caption><thead><tr><th scope="col">Incident / location</th><th scope="col">Severity</th><th scope="col">Status</th><th scope="col">Assignee</th><th scope="col">Last observed</th></tr></thead><tbody>{matching.map((incident) => <tr key={incident.id}>
      <td><button className="incident-card table-incident" onClick={() => app.select({ kind: 'incident', id: incident.id })} aria-label={'Inspect ' + incident.title}><strong>{incident.title}<ArrowUpRight size={15} aria-hidden="true" /></strong><span>{incident.location.name}</span></button><span className="table-type">{humanize(incident.type)} · {Math.round(incident.confidence * 100)}% confidence</span></td>
      <td data-label="Severity"><span className={'severity-tag tag-' + incident.severity}>{incident.severity}</span></td><td data-label="Status"><span className="status-label">{status(app, incident)}</span></td><td data-label="Assignee">{assignment(app, incident)}</td><td data-label="Last observed"><time dateTime={incident.last_seen} title={dateTime(incident.last_seen)}>{timeAgo(incident.last_seen)}</time></td>
    </tr>)}</tbody></table> : <div className="empty-state">{app.incidents.length ? 'No incidents match these filters.' : 'No incidents in this dataset.'}{filters.assignee !== 'all' && app.dashboard.workflowStatus !== 'ready' && <p>Assignments are unavailable or stale. Retry the connection to confirm results.</p>}<button className="text-button" onClick={() => setFilters(defaultFilters)}>Reset filters</button></div>}
    <p className="collection-summary">Showing {matching.length} of {app.incidents.length} incidents · Severity first, newest within each severity</p>
  </section>;
}
