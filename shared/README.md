# Shared contracts — all owners

`models.py` is the canonical Pydantic contract. `types.ts` is the matching TypeScript interface, re-exported by the frontend. `schemas/` contains generated JSON Schema; `examples/` contains **synthetic DEMO DATA**, never live reports. Timestamps are timezone-aware ISO 8601 strings, confidence is 0–1, coordinates are WGS84, transport speed is km/h and delay is seconds (negative means early).

IDs are opaque provider-prefixed strings. POST writes are idempotent upserts by ID. Detection types and incident types are extensible strings; severity and status are fixed unions. Arbitrary JSON extensions belong in metadata. Optional transport values may be absent or null. No personal identification is part of this scaffold.

Coordinate schema changes with all four owners, update both Python and TypeScript, then run `python -m scripts.export_contracts` and tests. Do not change the frontend-facing envelope casually: list endpoints return arrays; `/api/map` returns `{cameras, incidents, transport}`. JSON Schema is suitable for external adapter validation; FastAPI also publishes `/openapi.json`.
