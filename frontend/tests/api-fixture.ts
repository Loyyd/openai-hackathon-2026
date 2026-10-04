import { expect, type Page } from '@playwright/test';
import { demoMapData, demoObservations, demoUsers } from '../lib/mock';
import type { CameraObservation, IncidentWorkflow, MapData, UserSummary, WorkflowPatch } from '../types';

export const operator = demoUsers()[0];
export interface ApiState {
  data: MapData;
  observations: CameraObservation[];
  user: UserSummary | null;
  workflows: IncidentWorkflow[];
  mapError: number;
  workflowError: number;
  saveError: number;
  historyError: boolean;
  tileError: boolean;
  loginError: boolean;
  logoutError: boolean;
  streamUrl: string | null;
  mapReads: number;
  workflowReads: number;
  saves: WorkflowPatch[];
  nextWorkflows: Promise<IncidentWorkflow[]> | null;
  nextMap: Promise<MapData> | null;
  pageErrors: string[];
}
export async function installApi(page: Page, options: Partial<ApiState> = {}): Promise<ApiState> {
  const state: ApiState = {
    data: structuredClone(demoMapData), observations: structuredClone(demoObservations).reverse(), user: null, workflows: [],
    mapError: 0, workflowError: 0, saveError: 0, historyError: false, tileError: false, loginError: false, logoutError: false,
    streamUrl: null, mapReads: 0, workflowReads: 0, saves: [], nextWorkflows: null, nextMap: null, pageErrors: [], ...options,
  };
  page.on('pageerror', (error) => state.pageErrors.push(error.message));
  // No test requests reach OSM. Map movement and outages use local stand-in tiles.
  await page.route('https://tile.openstreetmap.org/**', (route) => state.tileError ? route.abort() : route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e8eee4"/><path d="M0 100L256 160M80 0L130 256" stroke="#fff" stroke-width="12"/></svg>',
  }));
  await page.route('**/backend/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/backend', '');
    const json = (value: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (path === '/api/map') {
      state.mapReads++;
      if (state.nextMap) { const response = state.nextMap; state.nextMap = null; return json(await response); }
      return state.mapError ? json({}, state.mapError) : json(state.data);
    }
    if (path === '/api/incident-workflows') {
      state.workflowReads++;
      if (state.nextWorkflows) { const response = state.nextWorkflows; state.nextWorkflows = null; return json(await response); }
      return state.workflowError ? json({}, state.workflowError) : json(state.workflows);
    }
    if (path === '/api/auth/me') return state.user ? json(state.user) : json({}, 401);
    if (path === '/api/auth/login') {
      const body = request.postDataJSON();
      if (state.loginError || body.password !== 'valid-password') return json({}, 401);
      state.user = operator; return json(operator);
    }
    if (path === '/api/auth/logout') {
      if (state.logoutError) return json({}, 503);
      state.user = null; return route.fulfill({ status: 204 });
    }
    if (path === '/api/users') return state.user ? json(demoUsers()) : json({}, 401);
    if (path.endsWith('/observations')) {
      const id = decodeURIComponent(path.split('/')[3]);
      return state.historyError ? json({}, 503) : json(state.observations.filter((item) => item.camera_id === id));
    }
    if (path.endsWith('/detections')) return json([]);
    if (path.endsWith('/stream')) return state.streamUrl ? json({ format: 'hls', url: state.streamUrl }) : json({}, 404);
    if (path.endsWith('/workflow') && request.method() === 'PATCH') {
      const patch: WorkflowPatch = request.postDataJSON();
      state.saves.push(patch);
      if (state.saveError) return json({}, state.saveError);
      if (!state.user) return json({}, 401);
      const id = decodeURIComponent(path.split('/')[3]);
      const existing = state.workflows.find((item) => item.incident_id === id);
      const now = new Date().toISOString();
      const workflow: IncidentWorkflow = { ...(existing ?? { incident_id: id, assignee: null, acknowledged_by: null, acknowledged_at: null, resolved_by: null, resolved_at: null }), updated_at: now };
      if (patch.assignee_id !== undefined) workflow.assignee = demoUsers().find((item) => item.id === patch.assignee_id) ?? null;
      if (patch.action && !workflow.acknowledged_at) { workflow.acknowledged_at = now; workflow.acknowledged_by = state.user; }
      if (patch.action === 'resolve' && !workflow.resolved_at) { workflow.resolved_at = now; workflow.resolved_by = state.user; }
      state.workflows = [...state.workflows.filter((item) => item.incident_id !== id), workflow];
      return json(workflow);
    }
    return json({}, 404);
  });
  return state;
}
export async function openDashboard(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Backend connected', { exact: true })).toBeVisible();
}
export async function openIncident(page: Page, title = 'Obstruction at port entrance') {
  await page.getByRole('button', { name: 'Inspect ' + title, exact: true }).click();
  return page.getByRole('dialog', { name: title });
}
export async function signIn(page: Page, password = 'valid-password') {
  await page.getByRole('button', { name: 'Operator sign in', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Operator sign in' });
  await dialog.getByLabel('Email', { exact: true }).fill('chris@example.test');
  await dialog.getByLabel('Password', { exact: true }).fill(password);
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
}
