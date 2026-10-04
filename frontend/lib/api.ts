import { demoMapData } from './mock';
import type { Camera, CameraObservation, Detection, Incident, MapData, TransportObservation } from '../types';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || '/backend').replace(/\/$/, '');
const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { cache: 'no-store', ...init });
  if (!response.ok) throw new Error(`API request failed (${response.status})`);
  return response.json() as Promise<T>;
}

function post<T>(path: string, value: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
}

export function getMap(): Promise<MapData> {
  return request<MapData>('/api/map');
}

export function getCameras(): Promise<Camera[]> {
  return request<Camera[]>('/api/cameras');
}

export function getCamera(cameraId: string): Promise<Camera> {
  return request<Camera>(`/api/cameras/${encodeURIComponent(cameraId)}`);
}

export function getCameraObservations(cameraId: string): Promise<CameraObservation[]> {
  return request<CameraObservation[]>(`/api/cameras/${encodeURIComponent(cameraId)}/observations`);
}

export function getIncidents(): Promise<Incident[]> {
  return request<Incident[]>('/api/incidents');
}

export function getIncident(incidentId: string): Promise<Incident> {
  return request<Incident>(`/api/incidents/${encodeURIComponent(incidentId)}`);
}

export function getTransport(): Promise<TransportObservation[]> {
  return request<TransportObservation[]>('/api/transport');
}

export function postObservation(observation: CameraObservation): Promise<CameraObservation> {
  return post<CameraObservation>('/api/observations', observation);
}

export function postDetection(detection: Detection): Promise<Detection> {
  return post<Detection>('/api/detections', detection);
}

export function postIncident(incident: Incident): Promise<Incident> {
  return post<Incident>('/api/incidents', incident);
}

export async function getDashboardData(): Promise<{ data: MapData; source: 'api' | 'demo'; warning?: string }> {
  if (USE_MOCK_DATA) return { data: demoMapData, source: 'demo' };
  try {
    return { data: await getMap(), source: 'api' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not reach the backend';
    return { data: demoMapData, source: 'demo', warning: `${message}. Showing synthetic demo data instead.` };
  }
}
