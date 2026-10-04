# Ireland transport data adapter

A small, dependency-free Python service that gives a frontend or backend one consistent JSON shape for TII traffic cameras, nearby OSM bus stops/routes, and NTA/TFI real-time vehicle and delay data. It includes a bundled sample and writes live responses to a local cache so a demo can keep serving data through an upstream outage.

## Run it

The adapter is included in the main FastAPI application. Start `./scripts/run_backend.sh --reload` from the repository root, start the frontend, and open `/transport`. The page uses the same-origin `/backend/api/v1/...` routes. No separate port or browser API key is required.

For independent adapter development, run `python3 -m ingestion.transport_adapter.server` from the repository root. This serves the same provider routes on `http://127.0.0.1:8787`; `HOST` and `PORT` can override that standalone listener.

Runtime caches go to `output/transport-cache`, or `TRANSPORT_CACHE_DIR`. Bundled `data/sample.json` is an explicitly labelled fallback. The older files in `cache/` are historical reference data and are not used as fresh runtime caches. Snapshot capture time remains unknown; the UI distinguishes provider retrieval, stale cached images, and offline placeholders.

For live NTA data, set `NTA_API_KEY` in the server environment. Apply for a key through the [NTA developer portal](https://developer.nationaltransport.ie/). The server keeps the key on the backend and requests the combined JSON feed at `https://api.nationaltransport.ie/gtfsr/v2/gtfsr?format=json`. It extracts vehicle positions and trip stop delays from that feed. The NTA usage policy says to respect a 60 second request interval per key, so this adapter caches the shared NTA feed for 60 seconds across all coordinates, including failed attempts, as well as caching nearby responses. You can override the URL with `NTA_FEED_URL` if your subscription portal gives you a different production endpoint.

Set the key in the same terminal before starting the service (keep it private):

```sh
export NTA_API_KEY='your-primary-key'
python3 -m ingestion.transport_adapter.server
```

In PowerShell, use `$env:NTA_API_KEY = "your-primary-key"` and then `python -m ingestion.transport_adapter.server`.

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Health and schema version |
| `GET /api/v1/cameras` | Public, active TII cameras with coordinates, road/place, views, and still-image URL |
| `GET /api/v1/cameras/{camera_id}/snapshot` | Proxies the current still image and writes a local last-good image cache |
| `GET /api/v1/nearby?lat=53.35&lon=-6.26&radius_m=1500` | Nearby OSM bus stops and bus-route relations plus nearby NTA vehicles and matched trip delay, if configured |

`radius_m` is clamped to 100–5000 metres. The nearby endpoint reports the feed state in `mode` and `realtime_status`. Check `warning` when present. Camera records are cached in `output/transport-cache/cameras.json`; nearby results are cached by rounded coordinate and radius under the runtime cache directory.

## Shared data shape

Every response includes `schema_version`. Camera records use stable string IDs and coordinates in decimal degrees (`latitude`, `longitude`). A camera view has `type`, `image_url`, and a stable view ID. `latest_snapshot.url` points to a still image. TII does not publish a per-image capture timestamp in this feed, so `captured_at` stays `null`; `source_updated_at` refers to the camera catalogue record only. The snapshot proxy serves the upstream image and falls back to the last image it successfully cached. If neither the live image nor a previous image is available, it returns an offline SVG placeholder with `X-Snapshot-Status: unavailable-placeholder`; a real image response has `X-Snapshot-Status: live` or `stale-cache`.

Nearby results have `stops`, `routes`, `vehicles`, `delays`, and `alerts` arrays, even when a source has no results. OSM stop IDs are namespaced as `osm:node:…` or `osm:way:…`; GTFS-Realtime route, trip, and vehicle IDs are preserved as strings. Delay values are seconds, matching GTFS-Realtime. OSM route relations and NTA route IDs are separate source identifiers; join them through displayed route labels only when the source provides a reliable match.

## Sources and limits

- **TII cameras:** the production TII Traffic site uses the public camera catalogue at `https://iretg.carsprogram.org/cameras_v1/api/cameras`. Its response includes public/active status, camera location, road reference, image views, and still-image URLs. The catalogue's `lastUpdated` is not an image capture time. Images may be temporarily stale or unavailable; the proxy cache covers the last successful image per camera after the first successful request.
- **NTA / TFI real time:** the combined endpoint is `https://api.nationaltransport.ie/gtfsr/v2/gtfsr?format=json`, using the `x-api-key` header. Keys are required. The feed can contain GTFS-Realtime vehicle positions, trip updates, and alerts. Trip updates provide delay seconds by trip and stop. The [NTA dataset entry](https://data.gov.ie/dataset/nta-gtfs/resource/53190120-1aa2-4127-acff-e5645acff08b) lists this JSON API URL; the [usage policy](https://developeruat.nationaltransport.ie/usagepolicy) currently says one request per key every 60 seconds.
- **Nearby stops and route context:** OpenStreetMap Overpass is queried only around the requested coordinate. OSM coverage varies by area and its route relations are not a full substitute for the NTA static GTFS schedule/stop tables. For exact scheduled stop departures, use the NTA static GTFS download and join GTFS-Realtime by stop/trip IDs.
- **Licensing:** NTA GTFS data is published under [CC BY 4.0](https://data.gov.ie/licence). Attribute OpenStreetMap contributors; see [OSM copyright and attribution](https://www.openstreetmap.org/copyright). Follow TII's [traffic site terms](https://traffic.tii.ie/help/53/TII-Terms-of-Use-).

The sample at `data/sample.json` is an offline fallback, not live transit data. It contains a few real TII camera records and image URLs. The stop, route, vehicle, and delay rows are illustrative demo fixtures with `demo_only: true`; never present those as live service information. On live upstream failure, the service prefers the most recent cached data and then uses this bundled sample.
