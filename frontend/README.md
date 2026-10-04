# SentinelX frontend

Dublin operations workspace with a public map, incident desk, camera snapshots, observation history and recorded highway replay. Precreated operators can assign, acknowledge and resolve incidents when the backend supports workflows.

## Run

Start the backend in a separate terminal from the repository root with `./scripts/run_backend.sh --reload` (first-time Python setup is in the [root README](../README.md#start-locally)). Then start the frontend:

    cd frontend
    npm ci
    npm run dev

Open http://localhost:3000. All browser requests go through the same-origin /backend proxy. Set BACKEND_URL (default http://localhost:8000) in frontend/.env.local or the server environment **before building**. Next.js rewrites are captured at build time, including in Docker. There is no browser-side API-origin override.

The initial view uses the backend. A connection failure offers retry and an explicit “Use demo data” action. After a successful read, outages retain the previous data and mark it stale. The dashboard polls every 15 seconds while the tab is visible, refreshes on return and times requests out after 10 seconds.

## Workspaces and themes

| Route | Workspace |
| --- | --- |
| `/` | City overview: supplied metrics, Dublin map, prioritized incident queue and camera previews |
| `/incidents` | Complete incident table (record cards on phones), search, Active/Resolved/All and severity/type/assignee filters |
| `/cameras` | Full searchable camera collection and observation drawers |
| `/transport` | TII provider camera snapshots and nearby OSM/NTA transport |
| `/ai` | Recorded highway video, searchable vehicle inventory, inspector and technical evidence |

The desktop sidebar collapses to an icon rail; mobile navigation opens a keyboard-accessible sheet. All five routes share one application provider, API client, session, dialog host and 15-second polling scheduler. Client navigation and browser Back retain incident filters, camera search and map center/zoom/layers. Switching the city data source intentionally resets that source's view state. Reloads retain the source and demo session, but start with default filters and map position.

Choose **System / Light / Dark** in the header. System is the default and follows OS changes. The preference is stored in `localStorage` as `sentinelx.theme`, synchronized across tabs, and applied by a small inline head script before React starts. Inter is served locally from the font package; no external font request is required. A deployment that adds a restrictive Content Security Policy must allow the theme bootstrap with a nonce or hash.

The status area keeps source labels, old observations (over five minutes), connection errors and unavailable/stale workflows visible. **Diagnostics** expands source timestamps and individual service errors. Source times are supplied values, not simulated refresh times. Incident evidence opens a camera drawer with an explicit **Back to incident** action; closing restores the original opener when it remains in the document.

The design adapts the spacing, sidebar and workspace framing of [Dashboard Sidebar by arunjdass on 21st.dev](https://21st.dev/@arunjdass/components/dashboard-sidebar), retrieved as demo 14941. The project uses semantic Next.js links/buttons, native dialogs, Lucide icons and existing plain CSS instead of the reference's Tailwind and placeholder controls. See [design and verification notes](docs/frontend-redesign.md).

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

## Recorded highway AI demo

The sidebar's “AI replay” link opens `/ai`. This separate page reads processed highway video results, vehicle fingerprints and actual embedding/device/OCR status through /backend/api/ai-demo. Results load only when this route is opened. It keeps a selected vehicle and playback position on refresh, retains previous results during errors, and releases video playback, frame callbacks and pending requests when leaving. Identities appear once on their first detected frame, highlight while in frame, and remain searchable after leaving the frame. Seeking rebuilds counts and matching evidence through the current frame. Without timing or playable media, the full inventory remains available with an explicit timing-unavailable label. See the [AI timing contract](docs/ai-demo-backend.md) for artifact preparation.

Prepare artifacts and browser-compatible video using the [vehicle pipeline instructions](../algorithms/vehicles/README.md), then configure AI_DEMO_DIR on the backend (default output/highway). The dashboard's local demo switch does not generate these artifacts. Recorded highway results are separate from Dublin camera observations and operator workflows. Generated footage and model weights remain ignored by Git.

## Map configuration

Leaflet 1.9.4 with React Leaflet 5 runs only in the browser. CSS and explicit height are included. Co-located signals share a location popup with separate incident/camera buttons. Layer toggles and “Fit Dublin coverage” preserve ordinary map position across polling, theme changes and client navigation. Only the default OSM tile layer is darkened in dark mode; custom tiles, markers and evidence images keep their own colors. The default incident filter is active, sorted by severity then latest observation.

- NEXT_PUBLIC_MAP_TILE_URL: defaults to https://tile.openstreetmap.org/{z}/{x}/{y}.png
- NEXT_PUBLIC_MAP_ATTRIBUTION: optional trusted HTML attribution for another tile provider; defaults to OpenStreetMap attribution.

Set these before building. Tiles use ordinary browser caching, visible attribution and normal browser referrers; there is no offline download or prefetch feature. See [React Leaflet setup](https://react-leaflet.js.org/docs/start-setup/) and [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).

## Verification

    npm run lint
    npm run typecheck
    npm run build
    npm run test:e2e

Browser tests use installed Google Chrome (channel: chrome). On machines without Chrome, install it with npx playwright install chrome. In unprivileged sandboxes, use `npx playwright install chromium` and `PLAYWRIGHT_CHANNEL=chromium npm run test:e2e`; managed setup installs this user-local browser. The suite starts the production build on 127.0.0.1:3100 and intercepts API and tile requests; tests do not fetch OSM tiles or require a backend. Ensure the build is current before rerunning.

Coverage includes complete collections and filters, co-location and map layers, evidence ordering, session lifecycle, workflows and failed writes, reads racing completed saves, polling/visibility/timeouts, outages and recovery, isolated demo persistence, empty/missing data, broken images/video, and mobile/keyboard focus. AI page regressions cover navigation, vehicle selection, refresh, media URLs and unavailable artifacts. The workspace suite covers direct routes/Back, retained map and filters, one poller, theme persistence/system changes/pre-hydration appearance, evidence return, mobile navigation and WCAG AA text token contrast. It captures all routes and both drawers at 1440, 1024 and 390 pixels in both themes. Screenshots go to ../output/playwright/redesign; failure traces and reports are ignored by git.

For a real-backend read smoke check, start the repository backend on port 8000, then run:

    npm run test:e2e -- --config playwright.backend.config.ts

This verifies the current seeded API, evidence browsing and the missing-service UI without intercepting API calls. A second test creates a uniquely named smoke camera, uploads a tiny PNG through the drawer, posts a detection, and verifies both analysis and the returned snapshot URL in the collection and observation drawer. Run against a disposable local backend; that record remains until its in-memory process exits (or must be removed from a persistent test database). It expects auth/workflows to remain unavailable until the handoff is implemented. The backend test can also be rerun after fixture ingestion. Provider regressions cover camera selection, on-demand nearby queries, cached/sample labels, retry, and failed upload/analysis responses.

## Structure

- components/ApplicationProvider.tsx: shared polling, session, selection, filters and map view state
- components/ApplicationShell.tsx and ThemeProvider.tsx: navigation, header and persistent theme preferences
- components/Dashboard.tsx: overview and shared workspace headings
- app/ai/page.tsx: recorded highway replay and vehicle inspection
- components/CityMap.tsx and MapPanel.tsx: map/layers
- components/IncidentList.tsx and IncidentDetails.tsx: incident inspection and controls
- components/CameraGallery.tsx and CameraDetails.tsx: snapshots, observation history and selected video
- components/DetailDialog.tsx: native modal inertness, explicit Tab cycling, Escape and focus restoration
- hooks/useDashboard.ts: visible-tab polling, stale-response protection, sessions and history
- lib/api.ts: proxy, timeout and typed adapters
- lib/mock.ts: coherent local fixtures and isolated demo workflows
- app/globals.css: graphite/alabaster tokens, responsive layouts, focus styles and reduced motion

## Provider and evidence integration

`/transport` reads TII/OSM/NTA data through the main backend’s `/api/v1` routes. Catalogue status and snapshot cache status are shown separately, without fabricated capture timestamps. The camera selector and nearby transport action use the same-origin proxy. Transport provider results are separate from the city’s local demo switch.

Camera drawers include detections for the selected observation and snapshot upload (JPEG/PNG/WebP, 10 MB, 20 megapixels). Capture time is entered in the viewer’s local timezone and sent as an aware ISO timestamp. Stored snapshot paths resolve through `/backend`, including older absolute API URLs. Uploads are available only with the backend source.

Operator auth/workflows and HLS remain optional proposed contracts. See [backend handoff](docs/backend-handoff.md) and [project integration](../docs/integration.md).

Development output lives in `.next-dev`; production builds use `.next`, preserving the upstream fix that isolates development chunks from production builds.
