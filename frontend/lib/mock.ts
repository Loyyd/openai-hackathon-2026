import type { CameraObservation, IncidentWorkflow, MapData, UserSummary, WorkflowPatch } from '../types';

// Synthetic demo fixtures: no live feeds or external image URLs are used.
export const demoMapData: MapData = {
  cameras: [
    {
      id: 'demo-cam-custom-house', provider: 'DEMO', name: 'Custom House Quay · Eastbound',
      location: { id: 'custom-house-quay', name: 'Custom House Quay', latitude: 53.3482, longitude: -6.2478 },
      image_url: '/demo-camera.svg', last_updated: '2026-10-04T10:42:00Z',
    },
    {
      id: 'demo-cam-oconnell', provider: 'DEMO', name: "O'Connell Street · Northbound",
      location: { id: 'oconnell-street', name: "O'Connell Street", latitude: 53.3509, longitude: -6.2602 },
      image_url: '/demo-camera.svg', last_updated: '2026-10-04T10:40:00Z',
    },
    {
      id: 'demo-cam-m50', provider: 'DEMO', name: 'M50 · Junction 6',
      location: { id: 'm50-junction-6', name: 'M50', latitude: 53.3898, longitude: -6.3655 },
      image_url: '/demo-camera.svg', last_updated: '2026-10-04T10:38:00Z',
    },
    {
      id: 'demo-cam-airport', provider: 'DEMO', name: 'Dublin Airport · Approach',
      location: { id: 'dublin-airport', name: 'Dublin Airport', latitude: 53.4264, longitude: -6.2499 },
      image_url: '/demo-camera.svg', last_updated: '2026-10-04T10:36:00Z',
    },
  ],
  incidents: [
    {
      id: 'demo-incident-quay', type: 'traffic_congestion', title: 'Slow traffic on Custom House Quay',
      description: 'Traffic is moving slowly eastbound near the Samuel Beckett Bridge.', severity: 'high', confidence: 0.91,
      location: { id: 'custom-house-quay', name: 'Custom House Quay', latitude: 53.3482, longitude: -6.2478 },
      camera_ids: ['demo-cam-custom-house'], related_observation_ids: ['demo-observation-quay'],
      first_seen: '2026-10-04T10:24:00Z', last_seen: '2026-10-04T10:42:00Z', status: 'active', metadata: { source: 'DEMO DATA' },
    },
    {
      id: 'demo-incident-oconnell', type: 'crowd', title: 'Busy pedestrian crossing',
      description: 'A larger-than-usual crowd is gathering near the central crossing.', severity: 'medium', confidence: 0.78,
      location: { id: 'oconnell-street', name: "O'Connell Street", latitude: 53.3509, longitude: -6.2602 },
      camera_ids: ['demo-cam-oconnell'], related_observation_ids: ['demo-observation-oconnell'],
      first_seen: '2026-10-04T10:31:00Z', last_seen: '2026-10-04T10:39:00Z', status: 'active', metadata: { source: 'DEMO DATA' },
    },
    {
      id: 'demo-incident-m50', type: 'stopped_vehicle', title: 'Vehicle stopped on M50 shoulder',
      description: 'A vehicle appears stationary on the shoulder near Junction 6.', severity: 'low', confidence: 0.68,
      location: { id: 'm50-junction-6', name: 'M50', latitude: 53.3898, longitude: -6.3655 },
      camera_ids: ['demo-cam-m50'], related_observation_ids: ['demo-observation-m50'],
      first_seen: '2026-10-04T10:18:00Z', last_seen: '2026-10-04T10:34:00Z', status: 'active', metadata: { source: 'DEMO DATA' },
    },
  ],

};

demoMapData.cameras.push(
  { id: 'demo-cam-dcu', provider: 'DEMO', name: 'DCU · Collins Avenue', location: { id: 'dcu', name: 'DCU Glasnevin', latitude: 53.385, longitude: -6.257 }, image_url: '/demo-camera.svg', last_updated: '2026-10-04T10:37:00Z' },
  { id: 'demo-cam-port', provider: 'DEMO', name: 'Dublin Port · Entrance', location: { id: 'port', name: 'Dublin Port', latitude: 53.349, longitude: -6.211 }, image_url: '/demo-camera.svg', last_updated: '2026-10-04T10:35:00Z' },
);
demoMapData.incidents.push(
  { ...demoMapData.incidents[0], id: 'demo-incident-port', title: 'Obstruction at port entrance', type: 'road_obstruction', severity: 'critical', description: 'A synthetic obstruction is affecting access to the port.', location: demoMapData.cameras[5].location, camera_ids: ['demo-cam-port'], related_observation_ids: ['demo-observation-port'], confidence: 0.94 },
  { ...demoMapData.incidents[1], id: 'demo-incident-airport', title: 'Slow approach to airport', location: demoMapData.cameras[3].location, camera_ids: ['demo-cam-airport'], related_observation_ids: ['demo-observation-airport'] },
  { ...demoMapData.incidents[2], id: 'demo-incident-dcu', title: 'Crossing clear at DCU', description: 'The earlier synthetic crossing obstruction has cleared.', status: 'resolved', location: demoMapData.cameras[4].location, camera_ids: ['demo-cam-dcu'], related_observation_ids: ['demo-observation-dcu'] },
);

export const demoObservations: CameraObservation[] = demoMapData.cameras.flatMap((camera, index) => {
  const shortId = ['quay', 'oconnell', 'm50', 'airport', 'dcu', 'port'][index];
  return [0, 1, 2].map((age) => ({
    id: 'demo-observation-' + shortId + (age ? '-' + age : ''),
    camera_id: camera.id,
    timestamp: new Date(Date.parse(camera.last_updated) + 60_000 - age * 300_000).toISOString(),
    image_url: '/demo-camera.svg',
    location: camera.location,
  }));
});

export const demoAccounts = [
  { id: 'demo-chris', display_name: 'Chris', email: 'chris@sentinelx.demo' },
  { id: 'demo-alex', display_name: 'Alex Murphy', email: 'alex@sentinelx.demo' },
];
export const demoPassword = 'sentinel-demo';
const STORAGE_KEY = 'sentinelx.simulation.v1';
type DemoState = { user: UserSummary | null; workflows: Record<string, IncidentWorkflow> };
let memory: DemoState = { user: null, workflows: {} };

function read(): DemoState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && typeof saved.workflows === 'object' && saved.workflows !== null) memory = saved;
    }
  } catch { /* The current tab can still read its in-memory state. */ }
  return memory;
}
function write(state: DemoState) {
  // Persist first: a storage failure must not be reported as a successful save.
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  memory = state;
}
export function demoSession() { return read().user; }
export function demoUsers(): UserSummary[] {
  return demoAccounts.map(({ id, display_name }) => ({ id, display_name }));
}
export function demoLogin(email: string, password: string): UserSummary {
  const account = demoAccounts.find((item) => item.email === email.trim().toLowerCase());
  if (!account || password !== demoPassword) throw new Error('Email or password is incorrect.');
  const user = { id: account.id, display_name: account.display_name };
  write({ ...read(), user });
  return user;
}
export function demoLogout() { write({ ...read(), user: null }); }
export function demoWorkflows(): IncidentWorkflow[] { return Object.values(read().workflows); }
export function demoSaveWorkflow(id: string, patch: WorkflowPatch): IncidentWorkflow {
  const state = read();
  if (!state.user) throw new Error('Sign in to manage incidents.');
  if (!demoMapData.incidents.some((item) => item.id === id)) throw new Error('Incident no longer available.');
  const now = new Date().toISOString();
  const workflow: IncidentWorkflow = {
    ...(state.workflows[id] ?? { incident_id: id, assignee: null, acknowledged_by: null, acknowledged_at: null, resolved_by: null, resolved_at: null }),
    updated_at: now,
  };
  if (patch.assignee_id !== undefined) {
    const assignee = demoUsers().find((item) => item.id === patch.assignee_id) ?? null;
    if (patch.assignee_id && !assignee) throw new Error('Operator is unavailable.');
    workflow.assignee = assignee;
  }
  if (patch.action && !workflow.acknowledged_at) {
    workflow.acknowledged_at = now;
    workflow.acknowledged_by = state.user;
  }
  if (patch.action === 'resolve' && !workflow.resolved_at) {
    workflow.resolved_at = now;
    workflow.resolved_by = state.user;
  }
  write({ ...state, workflows: { ...state.workflows, [id]: workflow } });
  return workflow;
}
