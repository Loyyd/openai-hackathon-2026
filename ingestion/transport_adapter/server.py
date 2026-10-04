#!/usr/bin/env python3
"""Small dependency-free API adapter for the Ireland transport demo."""

from __future__ import annotations

import json
import math
import os
import threading
import re
from uuid import uuid4
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
CACHE = Path(os.environ.get("TRANSPORT_CACHE_DIR", str(ROOT.parents[1] / "output" / "transport-cache")))
SAMPLE = DATA / "sample.json"
CAMERAS_URL = "https://iretg.carsprogram.org/cameras_v1/api/cameras"
NTA_FEED_URL = os.environ.get("NTA_FEED_URL", "https://api.nationaltransport.ie/gtfsr/v2/gtfsr?format=json")
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = "IrelandTransportDemo/1.0 (public-data integration)"
CAMERA_TTL = 30
TRANSIT_TTL = 60
_memory: dict[str, tuple[float, object]] = {}
_lock = threading.Lock()
_nta_lock = threading.Lock()
_nta_cached: tuple[float, dict | None] | None = None


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_json(url: str, headers: dict[str, str] | None = None, data: bytes | None = None):
    request_headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    request_headers.update(headers or {})
    request = Request(url, headers=request_headers, data=data)
    with urlopen(request, timeout=6) as response:
        return json.loads(response.read().decode("utf-8"))


def cache_read(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def cache_write(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
    temp.replace(path)


def normalized_camera(camera: dict, retrieved_at: str | None = None) -> dict:
    location = camera.get("location") or {}
    views = []
    for index, view in enumerate(camera.get("views") or []):
        url = view.get("url")
        views.append({
            "id": str(view.get("id") or f'{camera.get("id")}-{index + 1}'),
            "name": view.get("name"),
            "type": view.get("type"),
            "image_url": url,
        })
    last_updated = camera.get("lastUpdated")
    # TII lastUpdated is the camera record timestamp, not a verified image capture time.
    return {
        "id": str(camera.get("id")),
        "name": camera.get("name"),
        "active": bool(camera.get("active")),
        "public": bool(camera.get("public")),
        "location": {
            "latitude": location.get("latitude"),
            "longitude": location.get("longitude"),
            "road": location.get("routeId"),
            "place": location.get("cityReference"),
        },
        "owner": (camera.get("cameraOwner") or {}).get("name"),
        "source_updated_at": datetime.fromtimestamp(last_updated / 1000, timezone.utc).isoformat() if isinstance(last_updated, (int, float)) else None,
        "views": views,
        "latest_snapshot": {
            "url": views[0]["image_url"] if views else None,
            "captured_at": None,
            "retrieved_at": None,
        },
    }


def camera_catalog() -> dict:
    with _lock:
        fresh = _memory.get("cameras")
        if fresh and time.time() - fresh[0] < CAMERA_TTL:
            return fresh[1]
    try:
        retrieved = now()
        raw = get_json(CAMERAS_URL)
        cameras = [normalized_camera(c, retrieved) for c in raw if c.get("public") and c.get("active")]
        result = {
            "schema_version": "1.0.0", "mode": "live", "generated_at": retrieved,
            "sources": {"cameras": {"provider": "TII Traffic", "url": CAMERAS_URL, "fetched_at": retrieved}},
            "cameras": cameras,
        }
        cache_write(CACHE / "cameras.json", result)
    except Exception as error:
        result = cache_read(CACHE / "cameras.json") or cache_read(SAMPLE)
        if result is None:
            raise RuntimeError("Live camera feed failed and no cache/sample is available") from error
        result["mode"] = "cached" if (CACHE / "cameras.json").exists() else "sample"
        result["warning"] = "Live camera feed unavailable; serving the last cache or bundled sample."
    with _lock:
        _memory["cameras"] = (time.time(), result)
    return result


def distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def osm_nearby(lat: float, lon: float, radius: int) -> dict:
    query = f'''[out:json][timeout:20];
(node["highway"="bus_stop"](around:{radius},{lat},{lon});
 node["public_transport"="platform"]["bus"!="no"](around:{radius},{lat},{lon});
 way["public_transport"="platform"]["bus"!="no"](around:{radius},{lat},{lon});
 relation["route"="bus"](around:{radius},{lat},{lon}););
out center tags;'''
    raw = get_json(OVERPASS_URL + "?data=" + __import__("urllib.parse", fromlist=["quote"]).quote(query))
    stops, routes = [], []
    for item in raw.get("elements", []):
        tags = item.get("tags") or {}
        center = item.get("center") or item
        if item.get("type") == "relation" and tags.get("route") == "bus":
            routes.append({"id": f'osm:{item["id"]}', "name": tags.get("name"), "ref": tags.get("ref"), "operator": tags.get("operator"), "source": "OpenStreetMap"})
        elif center.get("lat") is not None and center.get("lon") is not None:
            stops.append({
                "id": f'osm:{item["type"]}:{item["id"]}', "name": tags.get("name") or tags.get("local_ref"),
                "code": tags.get("ref") or tags.get("local_ref"), "latitude": center["lat"], "longitude": center["lon"],
                "distance_m": round(distance_m(lat, lon, center["lat"], center["lon"])),
                "routes": [x for x in (tags.get("route_ref") or tags.get("ref", "")).split(";") if x],
                "source": "OpenStreetMap",
            })
    stops.sort(key=lambda x: x["distance_m"])
    return {"stops": stops, "routes": routes}


def nta_realtime(lat: float, lon: float, radius: int) -> dict:
    key = os.environ.get("NTA_API_KEY")
    if not key:
        return {"status": "not_configured", "vehicles": [], "delays": [], "alerts": []}
    # NTA's request interval applies to the whole feed, across all locations.
    global _nta_cached
    with _nta_lock:
        if _nta_cached is None or time.monotonic() - _nta_cached[0] >= TRANSIT_TTL:
            try:
                feed = get_json(NTA_FEED_URL, {"x-api-key": key})
            except Exception:
                _nta_cached = (time.monotonic(), None)
                raise
            _nta_cached = (time.monotonic(), feed)
        feed = _nta_cached[1]
    if feed is None:
        return {"status": "unavailable", "vehicles": [], "delays": [], "alerts": []}
    # Some API gateways wrap the standard FeedMessage in a data object.
    if "entity" not in feed and isinstance(feed.get("data"), dict):
        feed = feed["data"]
    entities = feed.get("entity") or feed.get("entities") or []
    delays_by_trip: dict[str, list[dict]] = {}
    vehicle_entities = []
    alerts = []
    for entity in entities:
        vehicle = entity.get("vehicle") or entity.get("vehicle_position") or entity.get("vehiclePosition")
        if vehicle:
            vehicle_entities.append((entity, vehicle))
        update = entity.get("trip_update") or entity.get("tripUpdate") or {}
        trip = update.get("trip") or {}
        trip_id = trip.get("trip_id") or trip.get("tripId")
        stop_updates = update.get("stop_time_update") or update.get("stopTimeUpdate") or []
        for stop_update in stop_updates:
            stop_id = stop_update.get("stop_id") or stop_update.get("stopId")
            for event_name in ("arrival", "departure"):
                part = stop_update.get(event_name)
                if part and part.get("delay") is not None:
                    delays_by_trip.setdefault(str(trip_id), []).append({
                        "trip_id": str(trip_id),
                        "route_id": trip.get("route_id") or trip.get("routeId"),
                        "stop_id": stop_id,
                        "event": event_name,
                        "delay_seconds": part["delay"],
                        "source": "NTA GTFS-Realtime",
                    })
        alert = entity.get("alert")
        if alert:
            alerts.append({"id": entity.get("id"), "source": "NTA GTFS-Realtime"})

    vehicles = []
    for entity, vehicle in vehicle_entities:
        position = vehicle.get("position") or {}
        vlat, vlon = position.get("latitude", position.get("lat")), position.get("longitude", position.get("lon"))
        if vlat is None or vlon is None:
            continue
        distance = distance_m(lat, lon, float(vlat), float(vlon))
        if distance > radius:
            continue
        trip = vehicle.get("trip") or {}
        trip_id = trip.get("trip_id") or trip.get("tripId")
        vehicle_info = vehicle.get("vehicle") or {}
        vehicles.append({
            "id": vehicle_info.get("id") or entity.get("id"),
            "route_id": trip.get("route_id") or trip.get("routeId"), "trip_id": trip_id,
            "label": vehicle_info.get("label"), "latitude": float(vlat), "longitude": float(vlon),
            "bearing": position.get("bearing"), "speed_mps": position.get("speed"),
            "distance_m": round(distance),
            "delay_seconds": (delays_by_trip.get(str(trip_id), [{}])[-1].get("delay_seconds") if trip_id else None),
            "source": "NTA GTFS-Realtime",
        })
    nearby_trip_ids = {str(v["trip_id"]) for v in vehicles if v.get("trip_id") is not None}
    delays = [record for trip_id in nearby_trip_ids for record in delays_by_trip.get(trip_id, [])]
    return {"status": "live", "vehicles": vehicles, "delays": delays, "alerts": alerts}


def nearby_data(lat: float, lon: float, radius: int) -> dict:
    cache_key = f"nearby:{lat:.4f}:{lon:.4f}:{radius}"
    with _lock:
        cached = _memory.get(cache_key)
        if cached and time.time() - cached[0] < TRANSIT_TTL:
            return cached[1]
    path = CACHE / f"nearby-{lat:.4f}-{lon:.4f}-{radius}.json"
    try:
        osm = osm_nearby(lat, lon, radius)
        try:
            transit = nta_realtime(lat, lon, radius)
        except Exception:
            transit = {"status": "unavailable", "vehicles": [], "delays": [], "alerts": []}
        value = {
            "schema_version": "1.0.0", "generated_at": now(), "mode": "live",
            "query": {"latitude": lat, "longitude": lon, "radius_m": radius},
            "stops": osm["stops"], "routes": osm["routes"], "vehicles": transit["vehicles"],
            "delays": transit["delays"], "alerts": transit["alerts"],
            "sources": {"stops_routes": "OpenStreetMap", "realtime": "NTA/TFI GTFS-Realtime"},
            "realtime_status": transit["status"],
            **({"warning": "NTA realtime unavailable; serving nearby OSM data without live vehicles or delays."} if transit["status"] == "unavailable" else {}),
        }
        cache_write(path, value)
    except Exception as error:
        value = cache_read(path)
        if value is None:
            sample = cache_read(SAMPLE) or {}
            nearby = dict(sample.get("nearby", {}))
            # Bundled fixtures belong to their original coordinates, not every query.
            for field in ("stops", "vehicles"):
                nearby[field] = [dict(item, distance_m=round(distance_m(lat, lon, item["latitude"], item["longitude"])))
                                 for item in nearby.get(field, [])
                                 if item.get("latitude") is not None and item.get("longitude") is not None
                                 and distance_m(lat, lon, item["latitude"], item["longitude"]) <= radius]
            if not nearby.get("stops") and not nearby.get("vehicles"):
                nearby.update(routes=[], delays=[], alerts=[])
            value = {
                "schema_version": "1.0.0", "generated_at": now(), "mode": "sample",
                "query": {"latitude": lat, "longitude": lon, "radius_m": radius},
                "stops": nearby.get("stops", []), "routes": nearby.get("routes", []),
                "vehicles": nearby.get("vehicles", []), "delays": nearby.get("delays", []), "alerts": nearby.get("alerts", []),
                "sources": {"stops_routes": "OpenStreetMap sample", "realtime": "NTA/TFI GTFS-Realtime sample"},
                "realtime_status": nearby.get("realtime_status", "unavailable"), "warning": "Nearby live data unavailable; serving cached/sample data.",
            }
        else:
            value["mode"] = "cached"
            if value.get("realtime_status") == "live":
                value["realtime_status"] = "cached"
            value["warning"] = "Nearby live data unavailable; serving last cached response."
    with _lock:
        _memory[cache_key] = (time.time(), value)
    return value


def camera_snapshot(camera_id: str) -> tuple[bytes, str, str]:
    if not re.fullmatch(r"[A-Za-z0-9_-]+", camera_id):
        raise LookupError("Unknown camera")
    camera = next((c for c in camera_catalog()["cameras"] if c["id"] == camera_id), None)
    if not camera or not camera["latest_snapshot"]["url"]:
        raise LookupError("Camera or snapshot not found")
    snapshot_path = CACHE / "snapshots" / f"camera-{camera_id}"
    metadata_path = snapshot_path.with_suffix(".json")
    try:
        request = Request(camera["latest_snapshot"]["url"], headers={"User-Agent": USER_AGENT})
        with urlopen(request, timeout=6) as response:
            image = response.read(10 * 1024 * 1024 + 1)
            content_type = response.headers.get("Content-Type", "image/jpeg").split(";")[0]
        if len(image) > 10 * 1024 * 1024 or content_type not in {"image/jpeg", "image/png", "image/webp"}:
            raise ValueError("Unsupported snapshot response")
        snapshot_path.parent.mkdir(parents=True, exist_ok=True)
        temp = snapshot_path.with_name(f".{snapshot_path.name}.{uuid4().hex}.tmp")
        temp.write_bytes(image)
        temp.replace(snapshot_path)
        cache_write(metadata_path, {"content_type": content_type})
        return image, content_type, "live"
    except Exception:
        if snapshot_path.is_file():
            metadata = cache_read(metadata_path) or {}
            return snapshot_path.read_bytes(), metadata.get("content_type", "image/jpeg"), "stale-cache"
        return (DATA / "snapshots" / "offline-placeholder.svg").read_bytes(), "image/svg+xml", "unavailable-placeholder"


class Handler(BaseHTTPRequestHandler):
    def send_json(self, value, status: int = 200):
        body = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            return self.send_json({"status": "ok", "schema_version": "1.0.0"})
        if parsed.path == "/api/v1/cameras":
            return self.send_json(camera_catalog())
        if parsed.path == "/api/v1/nearby":
            query = parse_qs(parsed.query)
            try:
                lat = float(query["lat"][0]); lon = float(query["lon"][0])
                radius = max(100, min(5000, int(query.get("radius_m", ["1500"])[0])))
                if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                    raise ValueError()
            except (KeyError, ValueError, TypeError):
                return self.send_json({"error": "Provide valid lat and lon; radius_m must be 100–5000."}, 400)
            return self.send_json(nearby_data(lat, lon, radius))
        if parsed.path.startswith("/api/v1/cameras/") and parsed.path.endswith("/snapshot"):
            camera_id = parsed.path.split("/")[-2]
            try:
                image, content_type, snapshot_status = camera_snapshot(camera_id)
            except LookupError:
                return self.send_json({"error": "Camera or snapshot not found."}, 404)
            self.send_response(200); self.send_header("Content-Type", content_type)
            self.send_header("X-Snapshot-Status", snapshot_status)
            self.send_header("Cache-Control", "public, max-age=15"); self.send_header("Content-Length", str(len(image)))
            self.end_headers(); self.wfile.write(image); return
        self.send_json({"error": "Not found"}, 404)

    def log_message(self, fmt, *args):
        print(f"{self.log_date_time_string()} {fmt % args}")


if __name__ == "__main__":
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8787"))
    print(f"Transport data adapter listening at http://{host}:{port}")
    ThreadingHTTPServer((host, port), Handler).serve_forever()
