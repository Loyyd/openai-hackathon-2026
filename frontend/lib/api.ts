import type { Camera, CameraObservation, Detection, Incident, MapData } from '../types';

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
export function createClient() {
  return {
    source: 'api' as const,
    detections: getObservationDetections,
    uploadSnapshot,
    map: getMap,
    observations: getCameraObservations,
  };
}
export type ApiClient = ReturnType<typeof createClient>;
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please retry.';
}
