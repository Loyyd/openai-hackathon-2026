# SentinelX frontend

Next.js App Router dashboard in TypeScript. It uses the canonical contracts from `../shared/types.ts`; demo fixtures are local, synthetic data and do not use real camera feeds.

## Run

```sh
cd frontend
npm ci
npm run dev
```

Open <http://localhost:3000>. By default, browser requests use the same-origin `/backend` path, which Next.js proxies to `BACKEND_URL` (default `http://localhost:8000`). This avoids hardcoding a browser-side localhost address in remote previews. Set `NEXT_PUBLIC_API_URL` only when the browser can directly reach that API origin. The dashboard requests `GET /api/map`; on a backend error it automatically shows labelled local fixtures and a retry action. Set `NEXT_PUBLIC_USE_MOCK_DATA=true` to deliberately use fixtures without requesting the API. Run `npm run build`, `npm run lint`, and `npm run typecheck` for checks.

## Backend API client

`lib/api.ts` provides typed functions for `GET /api/map`, `/api/cameras`, `/api/cameras/{camera_id}`, `/api/cameras/{camera_id}/observations`, `/api/incidents`, `/api/incidents/{incident_id}`, and `/api/transport`; and `POST /api/observations`, `/api/detections`, `/api/incidents`. The map response is expected to match `MapData` (`cameras`, `incidents`, `transport`).

## Chris — frontend ownership

- `app/page.tsx` — dashboard composition and loading/error/fallback states.
- `components/DashboardCards.tsx` — schematic map, incident cards, camera preview cards.
- `app/globals.css` — responsive visual system.
- `lib/api.ts` — typed API integration and fallback behavior.
- `lib/mock.ts` — synthetic data for independent frontend work.
- `types/index.ts` re-exports canonical shared contracts; change `shared/types.ts` only in coordination with backend and algorithm owners.
- `public/demo-camera.svg` is synthetic placeholder artwork. Replace it when an approved image source is available.

Keep interface changes aligned with `shared/types.ts`. No live tile service or camera feed is used by this scaffold.
