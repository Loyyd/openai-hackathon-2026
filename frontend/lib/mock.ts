import type { MapData } from '../types';

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
  transport: [
    {
      id: 'demo-bus-41', provider: 'DEMO', type: 'bus', route: '41', vehicle_id: 'DEMO-41',
      location: { id: 'dublin-airport', name: 'Dublin Airport', latitude: 53.4264, longitude: -6.2499 },
      timestamp: '2026-10-04T10:40:00Z', speed: 18.4, delay_seconds: 240, metadata: { source: 'DEMO DATA' },
    },
  ],
};
