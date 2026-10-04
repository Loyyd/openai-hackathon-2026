"""Public TII camera catalog and image retrieval; no transit features."""
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, urlopen
import json

CATALOG_URL = 'https://iretg.carsprogram.org/cameras_v1/api/cameras'
MAX_BYTES = 10 * 1024 * 1024


def catalog() -> list[dict]:
    with urlopen(Request(CATALOG_URL, headers={'Accept': 'application/json'}), timeout=10) as response:
        items = json.loads(response.read())
    return [item for item in items if item.get('public') and item.get('active')]


def fetch_snapshot(item: dict) -> tuple[dict, bytes | None, str | None]:
    url = next((view['url'] for view in item.get('views', []) if view.get('url')), None)
    if not url:
        return item, None, 'No public image'
    try:
        with urlopen(Request(url, headers={'Cache-Control': 'no-cache', 'User-Agent': 'SentinelX/1.0'}), timeout=8) as response:
            if not response.headers.get('Content-Type', '').startswith('image/'):
                raise ValueError('Provider returned a non-image response')
            data = response.read(MAX_BYTES + 1)
            if len(data) > MAX_BYTES:
                raise ValueError('Provider image exceeds 10 MB')
            return item, data, None
    except Exception as exc:
        return item, None, str(exc)


def snapshots(items: list[dict]):
    with ThreadPoolExecutor(max_workers=8) as pool:
        yield from pool.map(fetch_snapshot, items)
