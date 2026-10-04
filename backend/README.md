# SentinelX backend

FastAPI API backed by seeded DEMO DATA. Requires Python 3.11+. Run from the repository root:

```sh
python3 --version  # Must be Python 3.11 or newer
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
./scripts/run_backend.sh --reload
```

For subsequent starts, run only `./scripts/run_backend.sh --reload`. The launcher uses `.venv/bin/python -m uvicorn` so an unrelated global Uvicorn installation cannot select the wrong Python. If a traceback mentions Xcode or Python 3.9, stop the old command with Ctrl+C and use this launcher.

Open http://localhost:8000/docs for the interactive API and http://localhost:8000/health to check startup. Unset `DATABASE_URL` uses an in-memory repository; set it to `sqlite:///./sentinelx.db` or a PostgreSQL SQLAlchemy URL (`postgresql+psycopg://...`) to use a persistent JSON-row store. The same repository protocol serves both. `JSONRecord` is an intentionally generic example database model, not a final relational design.

All request and response bodies use the canonical strict Pydantic contracts in `shared/models.py`, re-exported for backend API use from `backend/app/schemas/`. SQLAlchemy persistence models live in `backend/app/models/`. Routes call `backend/app/services/api.py`; services apply parent-resource checks and coordinate persistence and image metadata, while `backend/app/database/` implements storage. The API supports GET `/health`, `/api/cameras`, `/api/cameras/{camera_id}`, `/api/cameras/{camera_id}/observations`, `/api/incidents`, `/api/incidents/{incident_id}`, `/api/transport`, `/api/map`; POST `/api/cameras`, `/api/observations`, `/api/detections`, `/api/incidents`, `/api/transport`. POSTs validate the body, upsert by ID (repeating the same ID replaces its record), and return 201. Observations require an existing camera; detections require an existing observation. Missing resources/parents return 404.

The backend owner should extend repository/services and database models here while preserving shared contracts. Image metadata currently has an in-memory adapter; image bytes are not stored by this scaffold.

Run tests from repository root: `.venv/bin/python -m pytest backend/tests`.
