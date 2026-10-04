# Camera dashboard

`npm ci` then `npm run dev`. Browser requests use `/backend` on the same origin; set server-side `BACKEND_URL` in `.env.local` (default http://localhost:8000). The current local workspace uses http://localhost:3001 with API http://localhost:8001.

The main dashboard shows the map and incidents. Cameras opens a dedicated `/cameras` gallery with searchable camera previews, stored snapshots and AI scan progress. The gallery renders at most 12 previews per page, with lazy image loading and asynchronous decoding. Stored image URLs are immutable and privately cached; metadata refreshes every 15 seconds with overlapping refreshes prevented. Camera details load actual stored images, observation history, durable analysis state and detections with persistent vehicle IDs. Uploads automatically enter the backend queue. Incident resolve/reopen updates are persisted. No demo switch, transport view, proposed session/workflow requests, or unsupported video requests are made.

TII observation times show retrieval time because provider capture time is unknown. Vehicle IDs are heuristic and scoped per camera; the UI distinguishes detection confidence from identity confidence. The Tracking demo link immediately beside Cameras opens `/ai`, the recorded highway replay with vehicle tracking and an identity panel.

Run `npm run typecheck`, `npm run lint` and `npm run build`. Development uses `.next-dev`; production builds use `.next`. See [API integration](../docs/integration.md).

Navigation keeps the last loaded dashboard dataset while fresh requests run in the background. Map and incident sections use native anchors; separate routes are prefetched. Camera/map content no longer waits for processing-status responses. For local demos use `npm run build` followed by `npm run start -- --hostname 127.0.0.1 --port 3001` to avoid development compilation on navigation.
