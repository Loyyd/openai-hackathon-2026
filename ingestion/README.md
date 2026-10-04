# Camera ingestion

The backend automatically collects public active cameras using `ingestion/providers/live_cameras.py`. It stores changed images and queues AI scans. No buses, nearby transport or synthetic fallback features are active.

With a running backend, `BACKEND_URL=http://localhost:8001 .venv/bin/python -m ingestion.run` requests an additional collection round. `CAMERA_POLL_SECONDS` controls the interval after each collection round. Provider timestamps are recorded as retrieval time because actual image capture time is not supplied. Legacy fixture adapters remain solely for isolated algorithm tests.
