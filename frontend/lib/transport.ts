import { request } from './api';

export interface ProviderCamera {
  id: string; name: string | null;
  location: { latitude: number | null; longitude: number | null; road: string | null; place: string | null };
  source_updated_at: string | null;
  latest_snapshot: { url: string | null; captured_at: string | null };
}
export interface CameraCatalog {
  mode: 'live' | 'cached' | 'sample'; generated_at: string; warning?: string; cameras: ProviderCamera[];
}
export interface NearbyData {
  mode: 'live' | 'cached' | 'sample'; generated_at: string; warning?: string; realtime_status: string;
  stops: { id: string; name: string | null; distance_m: number; routes: string[] }[];
  routes: { id: string; name: string | null; ref: string | null }[];
  vehicles: { id: string; route_id: string | null; label?: string; delay_seconds: number | null }[];
  delays: { trip_id: string; stop_id: string | null; delay_seconds: number; event: string }[];
  alerts: { id: string }[];
}
export const providerCameras = (signal?: AbortSignal) => request<CameraCatalog>('/api/v1/cameras', { signal }, 30_000);
export const nearbyTransport = (lat: number, lon: number, signal?: AbortSignal) =>
  request<NearbyData>('/api/v1/nearby?' + new URLSearchParams({ lat: String(lat), lon: String(lon), radius_m: '1500' }), { signal }, 30_000);
