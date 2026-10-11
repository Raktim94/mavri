#!/bin/sh
# Contract test: the TypeScript server and the Go server must answer the same
# scripted conversation identically when they start from the same database.
# Needs: node + npm install at the repository root, python3, docker.
# usage: tools/contract/run.sh  (from anywhere)
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../../.." && pwd)
W=$(mktemp -d)
trap 'fuser -k 3915/tcp 3916/tcp >/dev/null 2>&1 || true; [ -n "${KEEP:-}" ] && cp "$W"/*.json /tmp/ 2>/dev/null; rm -rf "$W"' EXIT
mkdir "$W/ts" "$W/go"

# 1. Let the TypeScript server create the database and the owner account.
start_ts() { (cd "$ROOT" && DB_DIRECTORY="$1" DEFAULT_DATABASE=t.db PORT=3915 FRONTEND_ORIGIN=http://localhost:1 \
  npx tsx src/backend/webserver/main.ts >"$W/ts.log" 2>&1 &); for i in $(seq 40); do curl -sf localhost:3915/api/health >/dev/null && return; sleep 1; done; echo "TS server did not start"; exit 1; }
start_ts "$W/ts"
python3 "$HERE/scenario.py" http://127.0.0.1:3915 "$W/setup.json" --setup
fuser -k 3915/tcp >/dev/null; sleep 1
cp "$W/ts/t.db" "$W/go/t.db"; chmod -R a+rwX "$W/go"

# 2. Same scenario against each server, each on its own copy.
start_ts "$W/ts"
python3 "$HERE/scenario.py" http://127.0.0.1:3915 "$W/ts.json"
fuser -k 3915/tcp >/dev/null
docker run --rm --network host -v "$ROOT/rewrite":/w -w /w -v gomod:/go/pkg/mod -v "$W":/s -v "$HERE":/t:ro golang:1.24 sh -c '
  go build -o /tmp/srv ./cmd/server
  DB_DIRECTORY=/s/go DEFAULT_DATABASE=t.db PORT=3916 /tmp/srv >/s/go.log 2>&1 &
  PID=$!
  sleep 2
  (command -v python3 >/dev/null || (apt-get -qq update && apt-get -qq install -y python3) >/dev/null 2>&1)
  python3 /t/scenario.py http://127.0.0.1:3916 /s/go.json
  kill $PID'
python3 "$HERE/compare.py" "$W/ts.json" "$W/go.json"
