#!/bin/sh
set -eu
.venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 &
backend_pid=$!
trap 'kill "$backend_pid" 2>/dev/null || true' EXIT INT TERM
cd frontend
npm run dev -- --hostname 0.0.0.0
