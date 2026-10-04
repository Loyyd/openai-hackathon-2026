# SentinelX backend

FastAPI API backed by seeded DEMO DATA. Run from the repository root after installing `requirements.txt`:

```sh
uvicorn backend.app.main:app --reload
```

Open `/docs` for the interactive API. Unset `DATABASE_URL` uses an in-memory repository. To use the local PostgreSQL service from Compose, start it with `docker compose up -d db`, then start the API with `DATABASE_URL=postgresql+psycopg://sentinelx:sentinelx@localhost:5433/sentinelx`. The API persists cameras, locations, observations, detections, and incidents in typed tables; transport remains in the generic JSON row for now. SQLite URLs are also supported for local development.

All request and response bodies use the canonical strict Pydantic contracts in `shared/models.py`, re-exported for backend API use from `backend/app/schemas/`. SQLAlchemy persistence models live in `backend/app/models/`. Routes call `backend/app/services/api.py`; services apply parent-resource checks and coordinate persistence and image metadata, while `backend/app/database/` implements storage. The API supports GET `/health`, `/api/cameras`, `/api/cameras/{camera_id}`, `/api/cameras/{camera_id}/observations`, `/api/detections`, `/api/observations/{observation_id}/detections`, `/api/incidents`, `/api/incidents/{incident_id}`, `/api/transport`, `/api/map`; POST `/api/cameras`, `/api/observations`, `/api/detections`, `/api/incidents`, `/api/transport`. POSTs validate the body, upsert by ID (repeating the same ID replaces its record), and return 201. Observations require an existing camera; detections require an existing observation. Missing resources/parents return 404.

Camera and observation responses retain the existing shared JSON contracts; their locations are stored as normalized location rows and expanded when returned. Upload a JPEG, PNG, or WebP snapshot with a timezone-aware capture timestamp using `POST /api/cameras/{camera_id}/snapshots` as multipart form fields `file` and `captured_at`. Uploads are limited to 10 MB. The API creates a linked observation, stores the image under `SNAPSHOT_STORAGE_DIR` (default `backend/uploads`), records file metadata in Postgres, and returns an observation whose `image_url` points to `GET /api/snapshots/{snapshot_id}`. Docker Compose keeps uploads in its `snapshot_data` volume. `create_all` creates tables for development; there are no migration scripts yet.

Run tests from repository root: `pytest backend/tests`.
