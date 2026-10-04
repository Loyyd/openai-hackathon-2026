# SentinelX frontend

Dublin situational awareness dashboard: public map, incident inspection, camera snapshots and evidence history; precreated operators can assign, acknowledge and resolve incidents when the backend supports workflows.

## Run

Start the backend in a separate terminal from the repository root with `./scripts/run_backend.sh --reload` (first-time Python setup is in the [root README](../README.md#start-locally)). Then start the frontend:

    cd frontend
    npm ci
    npm run dev

Open http://localhost:3000. All browser requests go through the same-origin /backend proxy. Set BACKEND_URL (default http://localhost:8000) in frontend/.env.local or the server environment **before building**. Next.js rewrites are captured at build time, including in Docker. There is no browser-side API-origin override.

The initial view uses the backend. A connection failure offers retry and an explicit “Use demo data” action. After a successful read, outages retain the previous data and mark it stale. The dashboard polls every 15 seconds while the tab is visible, refreshes on return and times requests out after 10 seconds.

## Demo

Choose “Use demo data”, or set NEXT_PUBLIC_USE_MOCK_DATA=true before building. Demo accounts:

| Email | Password |
| --- | --- |
| chris@sentinelx.demo | sentinel-demo |
| alex@sentinelx.demo | sentinel-demo |

All demo records and actions are synthetic. The selected source and simulated session/workflows persist separately in browser session storage for that tab. API session tokens are never stored there. “Connect to backend” restores API reads and server-issued sessions. Demo data includes six cameras, observations, active and resolved incidents, and transport. Source timestamps remain fixture timestamps; refresh does not pretend ingestion occurred.

## Integration

See the [recent PR comparison](docs/pr-integration.md) for the differences from PRs #2/#3, conflict resolutions and review scope.

Existing shared contracts in ../shared/types.ts are unchanged. Proposed additive session, user, workflow and stream contracts are local to types/index.ts. The detailed [backend handoff](docs/backend-handoff.md) documents payloads, cookie settings, workflow semantics and the joint acceptance walkthrough.

The current backend has public dataset reads and ingestion writes; it does **not** yet implement auth, users, workflow persistence or streams. Frontend workflow controls show unavailable/stale states until those services exist. Real persistence after ingestion and server restart must be demonstrated with the backend owner.

Optional selected-camera HLS playback uses native support first, otherwise a lazy HLS.js import. It starts only on “Watch live video”, tears down on close/camera switch, and keeps snapshots usable when playback fails. Camera and evidence previews use the supplied image URLs without substituting synthetic images for missing real images.

## Shared header and dark theme

All pages use `components/TopBar.tsx`: the SentinelX wordmark (`public/sentinelx-logo.svg`), a centred Map / Camera gallery / AI demo navigation, and a right-hand area for the Ireland transport link and operator session controls. Below it, a case-style band shows the page title, data-source label, a LIVE / DEMO / OFFLINE status pill and the refresh action. The dark operations palette is defined at the end of `app/globals.css` and overrides the light base; standard OpenStreetMap tiles are darkened with a CSS filter rather than a different tile provider.

## Recorded highway AI demo

The dashboard's “AI demo” link opens /ai from PR #3. This separate page reads processed highway video results, vehicle fingerprints and actual embedding/device/OCR status through /backend/api/ai-demo. It keeps a selected vehicle on refresh and retains the previous results during errors.

Prepare artifacts and browser-compatible video using the [vehicle pipeline instructions](../algorithms/vehicles/README.md), then configure AI_DEMO_DIR on the backend (default output/highway). The dashboard's local demo switch does not generate these artifacts. Recorded highway results are separate from Dublin camera observations and operator workflows. Generated footage and model weights remain ignored by Git.

## Map configuration

Leaflet 1.9.4 with React Leaflet 5 runs only in the browser. CSS and explicit height are included. Co-located signals share a location popup with separate incident/camera buttons. Layer toggles and “Fit Dublin coverage” preserve ordinary map position across polling. The default incident filter is active, sorted by severity then latest observation.

- NEXT_PUBLIC_MAP_TILE_URL: defaults to https://tile.openstreetmap.org/{z}/{x}/{y}.png
- NEXT_PUBLIC_MAP_ATTRIBUTION: optional trusted HTML attribution for another tile provider; defaults to OpenStreetMap attribution.

Set these before building. Tiles use ordinary browser caching, visible attribution and normal browser referrers; there is no offline download or prefetch feature. See [React Leaflet setup](https://react-leaflet.js.org/docs/start-setup/) and [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).

## Verification

    npm run lint
    npm run typecheck
    npm run build
    npm run test:e2e

Browser tests use installed Google Chrome (channel: chrome). On machines without Chrome, install it with npx playwright install chrome. In unprivileged sandboxes, use `npx playwright install chromium` and `PLAYWRIGHT_CHANNEL=chromium npm run test:e2e`; managed setup installs this user-local browser. The suite starts the production build on 127.0.0.1:3100 and intercepts API and tile requests; tests do not fetch OSM tiles or require a backend. Ensure the build is current before rerunning.

Coverage includes complete collections and filters, co-location and map layers, evidence ordering, session lifecycle, workflows and failed writes, reads racing completed saves, polling/visibility/timeouts, outages and recovery, isolated demo persistence, empty/missing data, broken images/video, and mobile/keyboard focus. AI page regressions cover navigation, vehicle selection, refresh, media URLs and unavailable artifacts. Screenshots go to ../output/playwright; failure traces and reports are ignored by git.

For a real-backend read smoke check, start the repository backend on port 8000, then run:

    npm run test:e2e -- --config playwright.backend.config.ts

This verifies the current seeded API, evidence browsing and the missing-service UI without intercepting API calls. It expects auth/workflows to remain unavailable until the handoff is implemented. The backend test can also be rerun after fixture ingestion.

## Structure

- components/Dashboard.tsx: composition, selection, navigation and filters
- app/ai/page.tsx: recorded highway replay and vehicle inspection
- components/CityMap.tsx and MapPanel.tsx: map/layers
- components/IncidentList.tsx and IncidentDetails.tsx: incident inspection and controls
- components/CameraGallery.tsx and CameraDetails.tsx: snapshots, observation history and selected video
- components/DetailDialog.tsx: native modal focus containment, Escape and focus restoration
- hooks/useDashboard.ts: visible-tab polling, stale-response protection, sessions and history
- lib/api.ts: proxy, timeout and typed adapters
- lib/mock.ts: coherent local fixtures and isolated demo workflows
- app/globals.css: responsive light green visual system, focus styles and reduced motion


## Provider and evidence integration

`/transport` reads TII/OSM/NTA data via the main backend's `/api/v1` routes. It shows provider/catalogue status and snapshot cache status separately, with no fabricated capture timestamps. The camera selector and nearby transport button use the same-origin proxy.

Camera details on `/` include snapshot upload (JPEG/PNG/WebP, 10 MB) and detections for the selected observation. Capture time is entered in the viewer's local timezone and sent as an aware ISO timestamp. Stored snapshot paths are resolved through `/backend` even for older absolute API URLs. Uploading is disabled in local demo mode.

Operator auth/workflow and HLS endpoints are still optional proposed backend contracts; their existing unavailable states are intentional. See `docs/backend-handoff.md` and the repository's `docs/integration.md`.

Development output lives in `.next-dev`; production builds use `.next`. This prevents a build from replacing chunks used by a running development server.
