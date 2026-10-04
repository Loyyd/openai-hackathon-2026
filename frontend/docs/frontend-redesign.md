# SentinelX operations workspace

## Design and provenance

This redesign starts from the sidebar, restrained borders and workspace framing in [Dashboard Sidebar](https://21st.dev/@arunjdass/components/dashboard-sidebar) by arunjdass (21st demo 14941, retrieved 4 October 2026). The implementation is adapted to the repository's plain CSS and domain data; it does not install the reference's Tailwind scaffold, placeholder content or clickable divs. The wordmark asset introduced in PR #9 is reused as a theme-colored mask in the sidebar; the unified application shell replaces its standalone TopBar. New dependencies are only `lucide-react` (ISC) and locally bundled `@fontsource-variable/inter` (OFL-1.1).

Alabaster and graphite surfaces share emerald navigation/action accents. Amber and red indicate operational severity, stale data and errors. Normal text is 14–16px, supporting text at least 12px, and metric numerals are tabular. Main buttons and inputs have 44px targets. Keyboard focus is visible in both themes; all motion rules respect reduced motion, including map selection and keyboard panning.

## Navigation and ownership

`app/layout.tsx` owns ThemeProvider → ApplicationProvider → ApplicationShell. The source-specific application state contains the API client, map/workflow data, session, incident filters, camera search, selection and saved map center/zoom/layers. A single visible-tab scheduler refreshes map/workflows and session checks. Source changes remount that state to preserve demo/API isolation. Routes and theme changes do not recreate it.

Overview puts four supplied metrics above the map and incident queue; on phones, the queue precedes the map. The incident workspace uses one semantic table that becomes record cards at narrow widths, with status buttons, collapsible filters, removable chips and explicit reset/counts. The camera workspace provides a full responsive collection. API/image errors and empty results have specific states.

The persistent dialog host owns incident/camera selection and the optional operator login. Incident → camera evidence → incident keeps one detail dialog and its original opener. Native modal dialogs make background content inert; explicit Tab wrapping prevents keyboard focus from escaping into browser chrome. Login can temporarily stack over details. Close/Escape restores the opener, or a visible home/navigation control if the original record disappeared.

The AI route loads its results lazily and owns its request/video/frame-callback lifecycle. It preserves PR #9’s synchronized first-seen discovery, current-frame markers, unique identity list, and evidence/count reconstruction on seek. The searchable inventory and selected-identity inspector sit beside the recording. Missing timing or failed video falls back to clearly labeled full results. The city source preference does not generate or switch recorded AI artifacts. Replay labels retain heuristic confidence limits, model/device/OCR status and a clear distinction from Dublin observations. Model setup remains documented in the vehicle pipeline guide.

The Ireland transport workspace preserves the provider catalogue, per-camera cache status, and on-demand nearby OSM/NTA data merged in PR #8. It remains independent of the city demo switch. Camera drawers preserve detection reads and snapshot uploads, normalize stored image paths through the same-origin proxy, and refresh the collection after a successful upload.

## Themes and map

An inline head bootstrap reads `sentinelx.theme` before first paint. System is the default. React keeps media-query and cross-tab storage changes synchronized without overwriting the preference. The app still works when browser storage is denied. A future CSP must nonce/hash this bootstrap.

Leaflet remains browser-only. Co-located records retain separate popup actions, and source imagery is never substituted. Map move events save the viewport in the provider; remounting Overview restores it. Theme changes only change CSS. The dark filter targets `.default-osm-tiles`, never custom tile layers or camera/video evidence. Visible OSM attribution remains present. User-supplied custom attribution is the existing trusted deployment setting.

## Verification

The browser suite uses deterministic API fixtures and local stand-in map tiles, so screenshot geography is illustrative. It preserves the existing behavioral checks and adds navigation/Back, retained filters and viewport, one polling schedule, theme persistence/system/pre-hydration appearance, modal containment/restoration, large collections/long labels and text-token contrast. The screenshot matrix covers all five workspaces plus incident/camera drawers and operator sign-in at 1440, 1024 and 390 pixels, in light and dark themes.

The optional backend suite exercises the current upstream API and supplied image URLs without API interception. It verifies unavailable operator capabilities and creates a disposable smoke camera with an uploaded PNG, then confirms the URL decodes in the collection and observation drawer and that posted detections appear.

Validation on 4 October 2026 against upstream `69e5c03` (including PRs #8 and #9): lint, TypeScript, production build, all 36 fixture browser tests and all 14 backend tests pass. The two real-backend browser checks also pass. The 48-image review matrix covers five workspaces and three modal states in both themes at all three widths; it checks complete page capture and horizontal overflow. Contrast checks cover normal/supporting, severity and action text pairs at WCAG AA (4.5:1). Real decoded test footage verifies media cleanup, and deterministic seek events verify counts, per-frame evidence and identity discovery.

Validation results and selected screenshots are recorded in the pull request. Full generated screenshots and browser reports remain under ignored `output/playwright/redesign` and `frontend/playwright-report` directories. A small reviewed screenshot set is retained beside this document for the PR.

## Reviewed screenshots

| View | Capture |
| --- | --- |
| Overview · actual OSM tiles, seeded backend records | [Light](screenshots/overview-light.png) · [Dark](screenshots/overview-dark.png) |
| Incidents · deterministic synthetic dataset | [Light desktop](screenshots/incidents-light.png) |
| Cameras · complete synthetic collection | [Dark tablet](screenshots/cameras-dark-tablet.png) |
| Ireland transport · retrieved TII catalogue and snapshot, capture time unknown | [Light desktop](screenshots/transport-light.png) |
| AI replay · synthetic results, unavailable recording fallback | [Dark desktop](screenshots/ai-dark.png) |
| Full-screen details · synthetic evidence | [Incident / light](screenshots/incident-mobile-light.png) · [Camera / dark](screenshots/camera-mobile-dark.png) |

The final manual browser review loaded actual OSM tiles in both themes and the TII provider catalogue/snapshot through the same-origin proxy. Provider capture times remain explicitly unknown; the seeded city dataset remains labeled synthetic. No live AI artifacts were available locally; decoded test footage covers playback and cleanup in the automated suite.

## Boundaries

Backend payloads and shared contracts are unchanged. Real authentication, user lists, workflow persistence and live video still require the backend handoff. The existing dependency audit reports 8 advisories (7 high, 1 moderate) in the Next.js/ESLint/sharp dependency tree, outside this UI redesign; no framework major-version migration is included.
