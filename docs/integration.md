# Endpoint integration

The frontend sends API requests through Next.js `/backend`, configured by server-only `BACKEND_URL`. The provider adapter from PR #6 is now imported by FastAPI; the persisted resources from PR #7 retain the canonical `shared/models.py` contracts.

| Endpoints | Producer / consumer |
| --- | --- |
| `GET /health` | Startup and container health checks |
| `GET /api/map`, `/api/cameras`, `/api/cameras/{id}`, `/api/incidents`, `/api/incidents/{id}`, `/api/transport` | Repository/service → dashboard API client, map, camera and incident views |
| `GET /api/cameras/{id}/observations` | Repository → camera history and incident evidence |
| `GET /api/detections`, `/api/observations/{id}/detections` | Repository → typed API client and selected snapshot's detection list |
| `POST /api/cameras`, `/api/observations`, `/api/detections`, `/api/incidents`, `/api/transport` | Fixture ingestion / analyzer → validated backend persistence |
| `POST /api/cameras/{id}/snapshots` | Camera-details upload form → image file, observation, snapshot metadata and latest camera preview |
| `GET /api/snapshots/{id}` | Persisted image → same-origin dashboard/evidence images |
| `GET /api/v1/cameras` | TII catalogue adapter → `/transport` camera selector |
| `GET /api/v1/cameras/{id}/snapshot` | Adapter live/cache/placeholder image → `/transport` preview and cache-status label |
| `GET /api/v1/nearby` | OSM + optional NTA adapter → `/transport` stops, routes, vehicles and delay/alert counts |
| `GET /api/ai-demo`, `/api/ai-demo/media/{name}` | Offline vehicle-pipeline artifacts → `/ai` |

## Boundaries

Provider catalogue timestamps do not prove when an image was captured. The provider view does not write these images into incident evidence or run the synthetic incident analyzer. Uploading a timestamped image to a stored camera creates evidence but does not itself trigger inference. Images are decoded before saving; invalid/truncated files, files over 10 MB and images over 20 megapixels are rejected. Ingestion remains explicit: `BACKEND_URL=http://127.0.0.1:8001 .venv/bin/python -m ingestion.run --post` (use the port of this project's backend).

The prior frontend PR proposes `/api/auth/*`, `/api/users`, `/api/incident-workflows`, `PATCH /api/incidents/{id}/workflow`, and `/api/cameras/{id}/stream`. These are not implemented by PR #6 or #7. The UI reports unavailable workflows/auth and snapshot-only cameras; local demo actions are simulated. No substitute authentication or fake write success was added.

## Verification

`python -m pytest` includes legacy JSON-to-table migration, snapshot/detection round trips in memory and SQLite, reopening persisted files, older-capture ordering, provider fallback/validation, and NTA feed cache sharing. Frontend typecheck, lint, production build and browser integration checks cover the new transport view, upload controls, snapshot proxy and detection rendering. PostgreSQL and Docker require separate runtime validation; SQLite is the automated persistence target.
