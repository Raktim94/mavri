#!/bin/sh
# End-to-end check: the real web app, in Chrome, against the Go server in its
# Docker image. Needs docker, python3 with playwright (pip install playwright)
# and Google Chrome. Builds the image (a few minutes the first time).
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../../.." && pwd)
docker build --network host -f "$ROOT/Dockerfile.go" -t mavri-e2e-image "$ROOT"
docker rm -f mavri-e2e >/dev/null 2>&1 || true
trap 'docker rm -f mavri-e2e >/dev/null 2>&1 || true' EXIT
docker run -d --name mavri-e2e -p 3921:3001 mavri-e2e-image >/dev/null
for i in $(seq 30); do curl -sf localhost:3921/api/health >/dev/null && break; sleep 1; done
python3 "$HERE/ui_flow.py" http://localhost:3921
