# Ingestion

Fixture-backed provider adapters normalize data into `shared.models` contracts. No live source URLs are assumed; implement provider-specific fetching and parsing inside `providers/` without changing downstream models. Fixtures are synthetic **DEMO DATA**, not live feeds.

Run from the repository root: `python -m ingestion.run` to POST cameras, transport, observations, detections, and incidents to `BACKEND_URL` (default `http://localhost:8000`). `--dry-run` selects offline mode. All required API routes are included in the backend scaffold.

Garv owns `ingestion/`; use the provider protocols in `providers/base.py` and canonical validation in `normalizers/models.py`.
