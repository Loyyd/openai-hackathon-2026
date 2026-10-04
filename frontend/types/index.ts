export type {
  Camera,
  CameraObservation,
  Detection,
  Incident,
  Location,
  MapData,
  TransportObservation,
} from '../../shared/types';

// Proposed additive API contracts; canonical pipeline records stay unchanged.
export type DataSource = 'api' | 'demo';
export interface UserSummary { id: string; display_name: string }
export interface IncidentWorkflow {
  incident_id: string;
  assignee: UserSummary | null;
  acknowledged_by: UserSummary | null;
  acknowledged_at: string | null;
  resolved_by: UserSummary | null;
  resolved_at: string | null;
  updated_at: string;
}
export interface WorkflowPatch { assignee_id?: string | null; action?: 'acknowledge' | 'resolve' }
export interface CameraStream { format: 'hls'; url: string }
export type Selection = { kind: 'camera' | 'incident'; id: string; observationId?: string } | null;
export type WorkflowStatus = 'loading' | 'ready' | 'stale' | 'unavailable';
