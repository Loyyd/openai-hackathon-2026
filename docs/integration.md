# Camera and incident integration

| Route | Connection |
| --- | --- |
| GET /health | Backend health |
| GET /api/map | Dashboard map, camera gallery and incident list; cameras + incidents only |
| GET, POST /api/cameras | Persisted catalog and manual camera creation |
| GET /api/cameras/{id} | Stored camera metadata and latest local image URL |
| POST /api/cameras/capture | Request a real provider collection round |
| GET /api/cameras/{id}/observations | Camera history and incident evidence |
| POST /api/cameras/{id}/snapshots | Validate bytes, store file + metadata, queue AI automatically |
| GET /api/snapshots/{id} | Serve persisted bytes through the frontend proxy |
| GET /api/observations/{id}/analysis | Durable queued/completed/failed analysis state |
| POST /api/observations/{id}/analyze | Retry a failed stored-image scan; completed results remain unchanged |
| GET /api/detections | All persisted detection records |
| GET /api/observations/{id}/detections | Camera details, bounding boxes, vehicle IDs and matching evidence |
| GET /api/vehicles | Persistent camera-scoped fingerprints, excluding internal embeddings |
| GET /api/vehicles/{id}/sightings | Detections linked to a persistent vehicle ID |
| GET /api/processing | Dashboard counters, worker state and collection outcome |
| GET, POST /api/incidents | Incident list and persisted incident creation |
| GET, PATCH /api/incidents/{id} | Incident evidence and persisted resolve/reopen action |
| POST /api/observations, /api/detections | Existing metadata producer contracts; use snapshot upload for automatic pixel analysis |

Snapshot files and database entries persist together. Results, updated fingerprints and completion markers commit in one transaction. Network failures never substitute sample images; SHA-256 comparison avoids repeating unchanged provider snapshots. Stored images are scanned in chronological order, including pending images found after restart. A failure is retained until explicitly retried.

Vehicle identity is scoped to one camera. Independent photos use detection rather than ByteTrack continuity. Match threshold 0.94, ambiguity margin 0.1, maximum candidate gap ten minutes. Detection confidence and heuristic identity confidence are separate. OCR is disabled. The density incident threshold is a review heuristic, not a collision detector.

Transport routes, the transport page, demo switching and unimplemented authentication/workflow/video consumers were removed. Existing legacy database rows remain intact; the default new persistent database has no synthetic seed data.
