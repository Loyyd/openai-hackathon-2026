# Camera dashboard

`npm ci` then `npm run dev`. Browser requests use `/backend` on the same origin; set server-side `BACKEND_URL` in `.env.local` (default http://localhost:8000). The current local workspace uses http://localhost:3001 with API http://localhost:8001.

The dashboard shows cameras, stored snapshots, AI scan progress and incidents. Camera details load actual stored images, observation history, durable analysis state and detections with persistent vehicle IDs. Uploads automatically enter the backend queue. Incident resolve/reopen updates are persisted. No demo switch, transport view, proposed session/workflow requests, or unsupported video requests are made.

TII observation times show retrieval time because provider capture time is unknown. Vehicle IDs are heuristic and scoped per camera; the UI distinguishes detection confidence from identity confidence. `/ai` retains the separate recorded highway replay.

Run `npm run typecheck`, `npm run lint` and `npm run build`. Development uses `.next-dev`; production builds use `.next`. See [API integration](../docs/integration.md).
