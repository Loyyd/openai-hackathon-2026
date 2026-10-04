# SentinelX

Camera snapshots, vehicle detections and incident evidence. The dashboard uses persisted backend data; transport, synthetic-data switching and proposed operator/session features have been removed.

## Run locally

Python 3.11+ and Node 22+:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt -r algorithms/requirements-vision.txt
./scripts/run_backend.sh
```

In another terminal:

```sh
cd frontend
npm ci
npm run dev
```

The default API is http://localhost:8000 and frontend http://localhost:3000. For another API port set `BACKEND_URL` in `frontend/.env.local`, then restart Next.js. This workspace currently uses API 8001 and frontend 3001.

The backend automatically discovers public active TII cameras, fetches their first available view, validates and stores changed images, then scans every stored snapshot with YOLO11m and ResNet18 appearance embeddings. The catalog covers Ireland. Images and metadata survive restart: default database `output/cameras.db`, files `backend/uploads/`. Set `DATABASE_URL` for another SQLite or PostgreSQL database and `SNAPSHOT_STORAGE_DIR` for another persistent directory. Environment variables must be exported; `.env.example` is a reference, not an automatically loaded file.

## Camera processing

- Collection and inference run independently. Eight network fetches run concurrently; one inference worker serializes matching and database commits.
- `CAMERA_POLL_SECONDS=60` waits between collection rounds (minimum 30 seconds). Per-camera SHA-256 skips unchanged bytes. Failed provider images stay visible in capture metadata; placeholders and synthetic fallback images are not inserted.
- Upload a JPEG, PNG or WebP in camera details (10 MB / 20 megapixels). Stored uploads enter the same automatic analysis queue.
- Failed analysis stays persisted and can be retried. Completed analysis is idempotent. On restart the worker resumes pending stored images.
- TII does not supply verified image capture times. Its observation timestamp records retrieval time; manually uploaded images use the supplied capture time.
- `VEHICLE_WEIGHTS=yolo11m.pt`, `VEHICLE_DEVICE=auto`. Weights are downloaded on first use if absent. Embeddings use pretrained ResNet18; a visible histogram backend is retained if those weights fail to load. OCR and raw plate storage are disabled in snapshot processing.
- Vehicle IDs persist **per camera**, with conservative, ambiguity-aware appearance matching within ten minutes. Sparse still photos cannot establish continuous tracking or verified cross-camera identity. Small/occluded vehicles can be missed.
- Twelve or more detected vehicles produce a low-severity density review candidate, with stored image evidence. This count heuristic does not confirm congestion or collisions. Set `CONGESTION_REVIEW_THRESHOLD` to change the threshold. Incident resolution is persisted through the API.

The local backend is unauthenticated and should remain bound to localhost. Use one backend process with the camera worker. Set `CAMERA_WORKER_ENABLED=false` for API-only/test processes; `CAMERA_INGESTION_ENABLED=false` disables automatic collection while uploads still scan and manual collection remains available.

## API and validation

[Endpoint connections and persistence](docs/integration.md) lists the camera, observation, analysis, vehicle and incident routes. `/docs` provides the OpenAPI schema. The recorded highway replay remains available separately at `/ai`; it is not the camera ingestion source.

```sh
CAMERA_WORKER_ENABLED=false .venv/bin/python -m pytest -q
cd frontend
npm run typecheck
npm run lint
npm run build
```

Docker Compose supplies PostgreSQL, persistent snapshot/model volumes, API 8000 and frontend 3000:

```sh
docker compose up --build
```

Legacy shared fixture/transport record definitions remain only for compatibility with existing databases and algorithm fixtures. No transport routes or features are mounted.
