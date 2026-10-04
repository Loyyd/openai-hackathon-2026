import { demoLogin, demoLogout, demoMapData, demoObservations, demoSaveWorkflow, demoSession, demoUsers, demoWorkflows } from './mock';
import type { Camera, CameraObservation, CameraStream, DataSource, Detection, Incident, IncidentWorkflow, MapData, TransportObservation, UserSummary, WorkflowPatch } from '../types';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = 'ApiError'; }
}

// All browser API traffic shares the Next.js origin. No browser auth tokens.
export async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 10_000): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (init.signal?.aborted) controller.abort();
  init.signal?.addEventListener('abort', abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetch('/backend' + path, { ...init, cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
    if (!response.ok) {
      if ([400, 413, 415, 422].includes(response.status)) {
        const body = await response.json().catch(() => null);
        if (typeof body?.detail === 'string') throw new ApiError(response.status, body.detail);
      }
      throw new ApiError(response.status, response.status === 401 ? 'Your session has expired. Sign in again.' :
        response.status === 403 ? 'You do not have permission to save this change.' :
        response.status === 404 ? 'This service is not available yet.' :
        'The server could not complete this request (' + response.status + ').');
    }
    return response.status === 204 ? undefined as T : await response.json() as T;
  } catch (error) {
    if (timedOut) throw new Error('The request timed out. Please retry.');
    throw error;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', abort);
  }
}

function write<T>(path: string, method: string, value?: unknown): Promise<T> {
  return request<T>(path, { method, headers: { 'Content-Type': 'application/json' }, body: value === undefined ? undefined : JSON.stringify(value) });
}
export const getMap = (signal?: AbortSignal) => request<MapData>('/api/map', { signal });
export const getCameras = () => request<Camera[]>('/api/cameras');
export const getCamera = (id: string) => request<Camera>('/api/cameras/' + encodeURIComponent(id));
export const getCameraObservations = (id: string, signal?: AbortSignal) => request<CameraObservation[]>('/api/cameras/' + encodeURIComponent(id) + '/observations', { signal });
export const getIncidents = () => request<Incident[]>('/api/incidents');
export const getIncident = (id: string) => request<Incident>('/api/incidents/' + encodeURIComponent(id));
export const getDetections = () => request<Detection[]>('/api/detections');
export const getObservationDetections = (id: string, signal?: AbortSignal) => request<Detection[]>('/api/observations/' + encodeURIComponent(id) + '/detections', { signal });
export const uploadSnapshot = (id: string, file: File, capturedAt: string) => {
  const body = new FormData();
  body.append('file', file);
  body.append('captured_at', capturedAt);
  return request<CameraObservation>('/api/cameras/' + encodeURIComponent(id) + '/snapshots', { method: 'POST', body }, 30_000);
};
export const getTransport = () => request<TransportObservation[]>('/api/transport');
export const postObservation = (value: CameraObservation) => write<CameraObservation>('/api/observations', 'POST', value);
export const postDetection = (value: Detection) => write<Detection>('/api/detections', 'POST', value);
export const postIncident = (value: Incident) => write<Incident>('/api/incidents', 'POST', value);

export function createClient(source: DataSource) {
  const demo = source === 'demo';
  return {
    source,
    detections: async (id: string, signal?: AbortSignal) => demo ? [] as Detection[] : getObservationDetections(id, signal),
    uploadSnapshot: async (id: string, file: File, capturedAt: string) => {
      if (demo) throw new Error("Connect to the backend to save snapshots.");
      return uploadSnapshot(id, file, capturedAt);
    },
    map: async (signal?: AbortSignal) => demo ? structuredClone(demoMapData) : getMap(signal),
    observations: async (id: string, signal?: AbortSignal) => demo ? demoObservations.filter((item) => item.camera_id === id) : getCameraObservations(id, signal),
    workflows: async (signal?: AbortSignal) => demo ? demoWorkflows() : request<IncidentWorkflow[]>('/api/incident-workflows', { signal }),
    me: async (signal?: AbortSignal): Promise<UserSummary | null> => {
      if (demo) return demoSession();
      try { return await request<UserSummary>('/api/auth/me', { signal }); }
      catch (error) { if (error instanceof ApiError && error.status === 401) return null; throw error; }
    },
    login: async (email: string, password: string) => {
      if (demo) return demoLogin(email, password);
      try { return await write<UserSummary>('/api/auth/login', 'POST', { email, password }); }
      catch (error) {
        if (error instanceof ApiError && error.status === 401) throw new Error('Email or password is incorrect.');
        throw error;
      }
    },
    logout: async () => demo ? demoLogout() : write<void>('/api/auth/logout', 'POST'),
    users: async (signal?: AbortSignal) => demo ? demoUsers() : request<UserSummary[]>('/api/users', { signal }),
    saveWorkflow: async (id: string, patch: WorkflowPatch) => demo ? demoSaveWorkflow(id, patch) : write<IncidentWorkflow>('/api/incidents/' + encodeURIComponent(id) + '/workflow', 'PATCH', patch),
    stream: async (id: string, signal?: AbortSignal): Promise<CameraStream | null> => {
      if (demo) return null;
      try { return await request<CameraStream>('/api/cameras/' + encodeURIComponent(id) + '/stream', { signal }); }
      catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
    },
  };
}
export type ApiClient = ReturnType<typeof createClient>;
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please retry.';
}
