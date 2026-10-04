import type { Page } from '@playwright/test';
import type { CameraCatalog, NearbyData } from '../lib/transport';

export async function installTransport(page: Page) {
  const state = {
    catalog: { mode: 'live', generated_at: '2026-10-04T10:42:00Z', cameras: [
      { id: '114', name: 'M50 · Finglas interchange', location: { latitude: 53.39, longitude: -6.31, road: 'M50', place: 'Finglas, Dublin' }, source_updated_at: '2026-10-04T10:40:00Z', latest_snapshot: { url: null, captured_at: null } },
      { id: '115', name: 'N4 · Liffey Valley', location: { latitude: 53.35, longitude: -6.40, road: 'N4', place: 'Liffey Valley, Dublin' }, source_updated_at: '2026-10-04T10:40:00Z', latest_snapshot: { url: null, captured_at: null } },
    ] } as CameraCatalog,
    nearby: { mode: 'live', generated_at: '2026-10-04T10:42:00Z', realtime_status: 'not_configured', stops: [{ id: 'stop-1', name: 'Finglas Road', distance_m: 240, routes: ['40', '140'] }], routes: [{ id: 'route-40', name: 'Finglas to Liffey Valley', ref: '40' }], vehicles: [], delays: [], alerts: [] } as NearbyData,
    catalogError: false, snapshotError: false, nearbyError: false, snapshotStatus: 'live', nearbyQueries: [] as string[], snapshotReads: [] as string[],
  };
  await page.route('**/backend/api/v1/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/snapshot')) {
      state.snapshotReads.push(url.pathname);
      return state.snapshotError ? route.fulfill({ status: 503 }) : route.fulfill({ path: 'public/demo-camera.svg', contentType: 'image/svg+xml', headers: { 'X-Snapshot-Status': state.snapshotStatus } });
    }
    if (url.pathname.endsWith('/nearby')) {
      state.nearbyQueries.push(url.search);
      return route.fulfill({ status: state.nearbyError ? 503 : 200, json: state.nearby });
    }
    return route.fulfill({ status: state.catalogError ? 503 : 200, json: state.catalog });
  });
  return state;
}
