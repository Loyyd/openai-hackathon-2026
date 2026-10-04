'use client';

import { humanize, resolved, timeAgo } from '../lib/presentation';
import type { Incident, IncidentWorkflow, UserSummary, WorkflowStatus } from '../types';

export interface IncidentFilters { query: string; severity: string; type: string; status: string; assignee: string }
export const defaultFilters: IncidentFilters = { query: '', severity: 'all', type: 'all', status: 'active', assignee: 'all' };

export function IncidentList({ incidents, total, types, filters, onFilters, expanded, onExpand, onSelect, selectedId, workflows, workflowStatus, operators, user }: {
  incidents: Incident[]; total: number; types: string[]; filters: IncidentFilters; onFilters: (filters: IncidentFilters) => void;
  expanded: boolean; onExpand: () => void; onSelect: (id: string) => void; selectedId?: string; workflows: Record<string, IncidentWorkflow>;
  workflowStatus: WorkflowStatus; operators: UserSummary[]; user: UserSummary | null;
}) {
  const change = (key: keyof IncidentFilters, value: string) => onFilters({ ...filters, [key]: value });
  return <section className="incidents-panel" id="incidents" aria-labelledby="incidents-heading">
    <div className="section-heading"><div><span className="eyebrow">INCIDENT DESK</span><h2 id="incidents-heading">Incidents <span className="heading-count">{incidents.length}</span></h2></div><button className="text-button" onClick={onExpand} aria-expanded={expanded}>{expanded ? 'Show fewer' : 'View all'}</button></div>
    <div className="filters">
      <label className="search-field"><span className="sr-only">Search incidents</span><span aria-hidden="true">⌕</span><input type="search" placeholder="Search incidents or locations" value={filters.query} onChange={(event) => change('query', event.target.value)} /></label>
      <div className="filter-grid">
        <label>Status<select aria-label="Status" value={filters.status} onChange={(event) => change('status', event.target.value)}><option value="active">Active</option><option value="resolved">Resolved</option><option value="all">All statuses</option></select></label>
        <label>Severity<select aria-label="Severity" value={filters.severity} onChange={(event) => change('severity', event.target.value)}><option value="all">All severities</option>{['critical', 'high', 'medium', 'low'].map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
        <label>Type<select aria-label="Type" value={filters.type} onChange={(event) => change('type', event.target.value)}><option value="all">All types</option>{types.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
        <label>Assignee<select aria-label="Assignee" value={filters.assignee} onChange={(event) => change('assignee', event.target.value)}><option value="all">Anyone</option><option value="unassigned">Unassigned</option><option value="me" disabled={!user}>Assigned to me</option>{operators.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select></label>
      </div>
    </div>
    <div className="incident-list">
      {!incidents.length && <div className="empty-state">{total ? 'No incidents match these filters.' : 'No incidents in this dataset.'}{filters.assignee !== 'all' && workflowStatus !== 'ready' && <p>Assignments are unavailable or stale. Retry the connection to confirm results.</p>}<button className="text-button" onClick={() => onFilters(defaultFilters)}>Reset filters</button></div>}
      {(expanded ? incidents : incidents.slice(0, 4)).map((incident) => {
        const workflow = workflows[incident.id];
        const assignment = workflow?.assignee?.display_name ?? (workflowStatus === 'ready' ? 'Unassigned' : 'Assignment unavailable');
        return <button key={incident.id} className={'incident-card' + (selectedId === incident.id ? ' selected' : '')} onClick={() => onSelect(incident.id)} aria-label={'Inspect ' + incident.title}>
          <span className={'severity-mark severity-' + incident.severity} />
          <span className="incident-copy"><span className="incident-heading"><span className="incident-title">{incident.title}</span><span className={'severity-tag tag-' + incident.severity}>{incident.severity}</span></span>
            <span className="incident-description">{incident.description}</span>
            <span className="incident-meta"><span>⌖ {incident.location.name}</span><span>{timeAgo(incident.last_seen)}</span></span>
            <span className="incident-meta"><span>{Math.round(incident.confidence * 100)}% confidence</span><span>{resolved(incident, workflow) ? 'Resolved' : workflow?.acknowledged_at ? 'Acknowledged' : 'Active'} · {assignment}{workflowStatus === 'stale' && workflow ? ' (stale)' : ''}</span></span>
          </span><span className="card-arrow" aria-hidden="true">↗</span>
        </button>;
      })}
    </div>
    {!expanded && incidents.length > 4 && <button className="show-more" onClick={onExpand}>View all {incidents.length} incidents →</button>}
    <p className="collection-summary">Showing {expanded ? incidents.length : Math.min(4, incidents.length)} of {incidents.length} matching incidents</p>
  </section>;
}
