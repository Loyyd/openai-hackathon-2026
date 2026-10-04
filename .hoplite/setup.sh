#!/bin/sh
set -eu
python3 -m venv .venv
.venv/bin/python -I -m pip install -r requirements.txt
npm ci --prefix frontend
