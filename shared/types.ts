// Canonical frontend contracts. Keep aligned with shared/models.py.
export interface Location { id: string; name: string; latitude: number; longitude: number }
export interface Camera { id: string; provider: string; name: string; location: Location; image_url: string; last_updated: string }
export interface CameraObservation { id: string; camera_id: string; timestamp: string; image_url: string; location: Location }
export interface Detection { id: string; observation_id: string; type: string; confidence: number; label: string; metadata: Record<string, unknown> }
export interface Incident { id: string; type: string; title: string; description: string; severity: 'low' | 'medium' | 'high' | 'critical'; confidence: number; location: Location; camera_ids: string[]; related_observation_ids: string[]; first_seen: string; last_seen: string; status: 'active' | 'resolved'; metadata: Record<string, unknown> }
export interface TransportObservation { id: string; provider: string; type: string; route: string; vehicle_id?: string | null; location: Location; timestamp: string; speed?: number | null; delay_seconds?: number | null; metadata: Record<string, unknown> }
export interface MapData { cameras: Camera[]; incidents: Incident[]; transport: TransportObservation[] }
