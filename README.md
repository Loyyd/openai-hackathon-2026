# SentinelX

A hackathon demo for Dublin situational awareness. **The default Dublin cameras, snapshots, detections, buses and incidents are synthetic DEMO DATA.** The optional highway AI demo processes recorded footage locally and is separate from the Dublin dashboard. No external API keys or live feeds are required for the default demo.

## Start locally

Run Python commands from the repository root (Python 3.11+):

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn backend.app.main:app --reload --port 8000
```

In another terminal (Node 22+):

```sh
cd frontend
npm ci
npm run dev
```

Open http://localhost:3000; API docs: http://localhost:8000/docs. Python reads process environment variables; `.env` is a template, not automatically loaded. Use `export DATABASE_URL=sqlite:///./sentinelx.db` before starting the backend for persisted local data. Leave it unset for independent in-memory development. For frontend configuration, copy BACKEND_URL and relevant NEXT_PUBLIC_* settings into frontend/.env.local, then restart development or rebuild production.

## Dashboard and recorded highway demo

- Open / for the interactive map, incident filters, camera evidence and operator controls. Use the explicit demo switch to try simulated workflows; credentials and configuration are in the [frontend README](frontend/README.md).
- Open /ai using the “AI demo” navigation link to inspect processed highway footage and vehicle fingerprints. Follow the [vehicle pipeline setup](algorithms/vehicles/README.md) to prepare artifacts and the browser replay, then set AI_DEMO_DIR on the backend.
- Real operator sessions and incident workflow persistence require the proposed [backend endpoints](frontend/docs/backend-handoff.md). The [recent PR comparison](frontend/docs/pr-integration.md) explains how the frontend integrates PRs #2 and #3.

## Demo pipeline

With the backend running:

```sh
source .venv/bin/activate
python -m ingestion.run
```

This fetches fixture camera/transport data, normalizes it, posts observations, runs the mock analyzer, correlates detections and posts incidents. Refresh the dashboard to view the results. `python -m ingestion.run --dry-run` works offline. `python -m algorithms.run --dry-run` runs the intelligence pipeline independently; `--post` sends results to the API. The demo does not imply real visual inference or live ingestion.

The runner reads prior incidents before correlation, preserving stable event IDs on repeated runs.

## Four independent workstreams

| Owner | Primary files | Boundary |
| --- | --- | --- |
| Chris | `frontend/app/`, `frontend/components/`, `frontend/lib/` | Typed HTTP client; explicit mock/fallback mode |
| Umut | `backend/app/api/`, `backend/app/services/`, `backend/app/database/`, `backend/app/models/`, `backend/app/schemas/` | Routes call services, which use the repository boundary; replace storage without changing routes. Schemas re-export canonical `shared/models.py` contracts |
| Garv | `ingestion/providers/`, `normalizers/`, `fixtures/` | Convert provider payloads into shared Pydantic models |
| Konrad | `algorithms/vision/`, `detection/`, `confidence/`, `identity/`, `correlation/` | Observation → detections → incidents; event/object matching, not person identity |

`shared/` changes require agreement across the team. Each component README explains extension points. Frontend can run on mock data, backend on seeded memory, ingestion on fixtures and algorithms on sample observations. The frontend includes simulated operator workflows and adapters for real sessions; backend auth/workflow services are proposed in the [handoff](frontend/docs/backend-handoff.md). There are no queues or separate worker services.

## API contract

| Method | Path | Response/body |
| --- | --- | --- |
| GET | `/health` | Health status |
| GET | `/api/cameras` | `Camera[]` |
| GET | `/api/cameras/{camera_id}` | `Camera` or 404 |
| GET | `/api/cameras/{camera_id}/observations` | `CameraObservation[]` |
| GET | `/api/incidents` | `Incident[]` |
| GET | `/api/incidents/{incident_id}` | `Incident` or 404 |
| GET | `/api/transport` | `TransportObservation[]` |
| GET | `/api/map` | `{cameras, incidents, transport}` |
| POST | `/api/observations` | One `CameraObservation` |
| POST | `/api/detections` | One `Detection` |
| POST | `/api/incidents` | One `Incident` |

Additional camera/transport write endpoints support ingestion. Writes upsert by stable ID. Shared schemas specify confidence bounds, nullable transport fields, timezone-aware timestamps and severity/status enums. The scaffold is deliberately unauthenticated: bind locally and do not expose it as a production service.

## Optional Docker Compose

```sh
docker compose up --build
```

Starts PostgreSQL, API on 8000 and frontend on 3000. The database credentials in Compose are local demo values only. `docker compose down` preserves the volume; `docker compose down -v` deletes it. Browser requests use the same-origin /backend proxy, configured using the server-side BACKEND_URL build argument.

## Checks

```sh
python -m pytest
python -m scripts.export_contracts
cd frontend
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

Generated schemas/examples should be committed alongside contract updates. Backend and algorithm tests cover validation/storage/demo behavior. Frontend browser tests cover dashboard interactions and failures with intercepted APIs and tiles; see the [frontend README](frontend/README.md).

The initial dependency audit still reports transitive advisories (including tooling/image-processing dependencies). Next.js is pinned to the patched 15.5 release line; review the remaining advisories before any public/production deployment rather than applying forced major upgrades during the hackathon.

## Git workflow and decisions

Keep main stable and use feature branches for frontend, backend, ingestion and algorithms. Recent PRs target main; use main until the team creates and adopts the planned dev integration branch. Primarily modify your own directory; avoid opportunistic edits to another owner's files. Agree on shared contract changes before merging.

Before moving beyond the demo, agree on provider access/licensing and refresh rate, stable provider IDs, image retention/storage URLs, incident taxonomy and matching thresholds, and whether persistence should become the default. The frontend uses a Leaflet basemap and polls backend data every 15 seconds while visible. Database migrations, live ingestion, actual AI, and backend session/workflow persistence remain with their owners.
