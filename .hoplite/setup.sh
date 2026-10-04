#!/bin/sh
set -eu
python3 -m venv .venv
.venv/bin/python -I -m pip install -r requirements.txt
npm ci --prefix frontend
cd frontend
npx playwright install chromium
cd ..
if [ "${SENTINELX_VISION:-false}" = "true" ]; then
  .venv/bin/python -I -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
  .venv/bin/python -I -m pip install -r algorithms/requirements-vision.txt
fi
