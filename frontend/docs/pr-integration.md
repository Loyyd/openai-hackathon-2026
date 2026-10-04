# Recent pull request comparison

Reviewed on 4 October 2026. The frontend implementation started from scaffold merge c1d3041 (PR #1). It is now based on main at 5df5dab, which includes PRs #2 and #3.

| Recent change | Difference from the original frontend baseline | Integration in this PR |
| --- | --- | --- |
| [#2 — Local 4K highway vehicle intelligence pipeline](https://github.com/Loyyd/openai-hackathon-2026/pull/2) | Adds algorithms/vehicles, optional vision dependencies, identity tests and pipeline documentation. Ignores weights and generated output. | All upstream pipeline code and documentation are retained. The ignore-file conflict preserves upstream output, model-weight and attachment rules alongside browser-test ignores. |
| [#3 — Highway AI demo on the website](https://github.com/Loyyd/openai-hackathon-2026/pull/3) | Adds /ai, read-only /api/ai-demo summary/media routes, backend tests and an AI demo link in the old dashboard. | The new dashboard preserves the AI demo link. The /ai page keeps vehicle selection, recorded replay, model/device/OCR status and existing privacy labels. Its requests and media use the same /backend proxy as the dashboard. |

The other overlapping file was frontend/app/page.tsx: it now composes the new Dashboard component, and the navigation link from PR #3 lives in that component. No algorithms, ingestion implementation, backend route or canonical shared-contract changes are part of this frontend PR.

The inspected backend branch at 2187e85 adds relational entity models and repository changes. It has not been merged into main and is not included here. Those model additions do not provide the authentication, user roster or incident workflow endpoints proposed in the [backend handoff](backend-handoff.md).

## What this frontend adds

- Leaflet map with camera, incident and transport layers, co-located location popups, selection and coverage controls.
- Full incident/camera browsing, filters, responsive detail dialogs, snapshot history and incident evidence.
- Operator login/logout adapters, assignment, acknowledgment and resolution, with independent workflows and consistent map/list/count updates.
- Requests through /backend with 10-second timeouts; visible-tab polling every 15 seconds; retained data during outages and protection against reads racing saves.
- Explicit local simulation with precreated demo operators and workflows saved for the browser tab; optional selected-camera HLS playback.
- Setup/demo instructions in the [frontend README](../README.md), session/API requirements in the [backend handoff](backend-handoff.md), and browser regression coverage for both the dashboard and /ai.

## Verification

Verified after integration on 4 October 2026:

| Check | Result |
| --- | --- |
| Frontend lint and TypeScript | Passed |
| Production build | Passed, including / and /ai |
| Intercepted browser suite | 15 passed: 13 dashboard cases and 2 AI-page cases |
| Real-backend browser smoke check | 1 passed |
| Python regression suite | 25 passed, including the 11 vehicle identity cases from PR #2 |

Run these against the current checkout:

    cd frontend
    npm run lint
    npm run typecheck
    npm run build
    npm run test:e2e

The browser suite uses intercepted APIs and local stand-in map tiles. AI regression cases exercise navigation, vehicle selection, refresh, media URLs, missing artifacts and outages. They do not claim to rerun vehicle inference or validate playback of the private 4K footage.

With the repository backend running on port 8000:

    npm run test:e2e -- --config playwright.backend.config.ts

Existing Python regressions can be run from the repository root with:

    python -m pytest

Vehicle identity tests require NumPy and OpenCV from the optional vision dependencies; without them pytest skips that module. The verification environment installed those two packages to exercise all 25 tests without downloading models or running inference. The Python suite emitted an upstream Starlette/httpx deprecation warning.

The real-backend smoke test verifies public reads and evidence browsing. Real operator sessions and resolution persistence after ingestion/server restart still require the handoff endpoints. Optional HLS feeds also depend on a provider. The local recorded highway demo remains separate from Dublin incident monitoring.

## Review and merge

Target main: recent PRs target main, and no dev branch existed on the remote at review time. This request adds frontend behavior and documentation on top of the two merged PRs; it does not replace them. Review the new API contract with the backend owner before enabling real operator management.
