#!/usr/bin/env bash
set -euo pipefail

sentinelx_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
sentinelx_python="$sentinelx_root/.venv/bin/python"

if [[ ! -x "$sentinelx_python" ]]; then
  cat >&2 <<'EOF'
The project Python environment is missing. From the repository root, run:
  python3 --version  # Must be Python 3.11 or newer
  python3 -m venv .venv
  .venv/bin/python -m pip install -r requirements.txt -r algorithms/requirements-vision.txt
Then retry ./scripts/run_backend.sh --reload.
EOF
  exit 1
fi

if ! "$sentinelx_python" -c 'import sys; sys.exit(sys.version_info < (3, 11))'; then
  printf 'SentinelX requires Python 3.11 or newer; .venv uses: ' >&2
  "$sentinelx_python" --version >&2
  printf 'Recreate .venv with Python 3.11+ and install requirements.txt.\n' >&2
  exit 1
fi

if ! "$sentinelx_python" -c 'import fastapi, uvicorn, pydantic, sqlalchemy, ultralytics, torchvision' >/dev/null 2>&1; then
  printf 'Install backend dependencies from the repository root:\n  .venv/bin/python -m pip install -r requirements.txt -r algorithms/requirements-vision.txt\n' >&2
  exit 1
fi

cd "$sentinelx_root"
exec "$sentinelx_python" -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 "$@"
