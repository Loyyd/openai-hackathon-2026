# Backend

Run `./scripts/run_backend.sh` from the repository root after installing `requirements.txt` and `algorithms/requirements-vision.txt`. The FastAPI lifespan starts one collection thread and one serialized inference worker. Use one server process. The default database is `sqlite:///./output/cameras.db` without fixture seeds; `DATABASE_URL` can select PostgreSQL. `SNAPSHOT_STORAGE_DIR` defaults to `backend/uploads`.

Camera uploads store actual validated bytes and immediately enter automatic processing. The worker also discovers public TII cameras and stores changed images, using eight concurrent downloads and per-camera hashes. Model failures persist as failed analysis records; retry through the analysis endpoint. All model results, fingerprints and completion markers share one database transaction.

Use `CAMERA_WORKER_ENABLED=false` for isolated API/tests and `CAMERA_INGESTION_ENABLED=false` to scan uploads without automatic provider polling. Set `VEHICLE_WEIGHTS`, `VEHICLE_DEVICE`, `CAMERA_POLL_SECONDS`, and `CONGESTION_REVIEW_THRESHOLD` as needed. Model weights download on first use if absent.

See [endpoint integration](../docs/integration.md). Historical JSON records migrate without overwriting typed rows. Legacy transport database rows are preserved for compatibility but not exposed. This local API has no authentication; bind it to localhost.
