# Camera dashboard

`npm ci` then `npm run dev`. Browser requests use `/backend` on the same origin; set server-side `BACKEND_URL` in `.env.local` (default http://localhost:8000). The current local workspace uses http://localhost:3001 with API http://localhost:8001.

The main dashboard shows the map and incidents. Cameras opens a dedicated `/cameras` gallery with all camera previews, search, stored snapshots and AI scan progress. Camera details load actual stored images, observation history, durable analysis state and detections with persistent vehicle IDs. Uploads automatically enter the backend queue. Incident resolve/reopen updates are persisted. No demo switch, transport view, proposed session/workflow requests, or unsupported video requests are made.

TII observation times show retrieval time because provider capture time is unknown. Vehicle IDs are heuristic and scoped per camera; the UI distinguishes detection confidence from identity confidence. The Tracking demo link immediately beside Cameras opens `/ai`, the recorded highway replay with vehicle tracking and an identity panel.

Run `npm run typecheck`, `npm run lint` and `npm run build`. Development uses `.next-dev`; production builds use `.next`. See [API integration](../docs/integration.md).
