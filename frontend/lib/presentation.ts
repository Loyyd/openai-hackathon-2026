import type { Incident, IncidentWorkflow, MapData } from '../types';

export function timestamp(value: string | null | undefined): number {
  return value ? Date.parse(value) || 0 : 0;
}

export function dateTime(value: string | null | undefined): string {
  return timestamp(value) ? new Date(value!).toLocaleString('en-IE', { dateStyle: 'medium', timeStyle: 'medium' }) : 'Not available';
}

export function timeAgo(value: string): string {
  if (!timestamp(value)) return 'Time unavailable';
  const seconds = Math.floor((Date.now() - timestamp(value)) / 1000);
  if (seconds < -60) return 'Future timestamp';
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function humanize(value: string): string {
  return value.replace(/[_-]/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}

export function resolved(incident: Incident, workflow?: IncidentWorkflow): boolean {
  return incident.status === 'resolved' || Boolean(workflow?.resolved_at);
}

const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
export function sortIncidents(a: Incident, b: Incident): number {
  return severityOrder[a.severity] - severityOrder[b.severity] || timestamp(b.last_seen) - timestamp(a.last_seen);
}

export function knownDemo(data: MapData): boolean {
  return data.cameras.some((camera) => /demo|synthetic/i.test(camera.provider)) ||
    data.incidents.some(({ metadata }) => metadata.demo === true || /demo|synthetic/i.test(String(metadata.source ?? '')));
}

export function newestTimestamp(values: string[]): string | undefined {
  return values.filter((value) => timestamp(value)).sort((a, b) => timestamp(b) - timestamp(a))[0];
}

// Snapshot records are portable across local ports, Docker and deployments.
export function snapshotUrl(value: string): string {
  try {
    const url = new URL(value, 'http://local.invalid');
    if (/^\/api\/snapshots\/[a-f0-9]{32}$/.test(url.pathname)) return '/backend' + url.pathname;
  } catch { /* Let the image component handle malformed provider URLs. */ }
  return value;
}
