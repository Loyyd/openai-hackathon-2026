# SentinelX

A one-day hackathon skeleton for Dublin situational awareness. **All bundled cameras, images, detections, buses and incidents are synthetic DEMO DATA.** No external API keys, actual live feeds, or production AI are required.

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

Open http://localhost:3000; API docs: http://localhost:8000/docs. Python reads process environment variables; `.env` is a template, not automatically loaded. Use `export DATABASE_URL=sqlite:///./sentinelx.db` before starting the backend for persisted local data. Leave it unset for independent in-memory development. For frontend configuration, copy relevant `NEXT_PUBLIC_*` settings into `frontend/.env.local` and restart Next.js.

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

`shared/` changes require agreement across the team. Each component README explains extension points. Frontend can run on mock data, backend on seeded memory, ingestion on fixtures and algorithms on sample observations. There are no queues, authentication systems or separate worker services.

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

Starts PostgreSQL, API on 8000 and frontend on 3000. The database credentials in Compose are local demo values only. `docker compose down` preserves the volume; `docker compose down -v` deletes it. Browser API URL defaults to localhost:8000; change the public build-time URL for non-local deployments.

## Checks

```sh
python -m pytest
python -m scripts.export_contracts
cd frontend
npm run typecheck
npm run build
```

Generated schemas/examples should be committed alongside contract updates. Backend and algorithm tests cover validation/storage/demo behavior; the frontend build checks integration types.

The initial dependency audit still reports transitive advisories (including tooling/image-processing dependencies). Next.js is pinned to the patched 15.5 release line; review the remaining advisories before any public/production deployment rather than applying forced major upgrades during the hackathon.

## Git workflow and decisions

Keep `main` stable; integrate through `dev`. Work on `feature/frontend`, `feature/backend`, `feature/ingestion`, `feature/algorithms` and open small PRs into `dev`. Primarily modify your own directory; avoid opportunistic edits to another owner's files. Agree on shared contract changes before merging.

Before moving beyond the demo, agree on provider access/licensing and refresh rate, stable provider IDs, image retention/storage URLs, incident taxonomy and matching thresholds, and whether persistence should become the default. The schematic map is not a geospatial basemap. Database migrations, live fetching, actual AI, production security and polling are intentionally left to the team.
