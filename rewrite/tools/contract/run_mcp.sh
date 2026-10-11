#!/bin/sh
# Contract test for the MCP server: the TypeScript tool server and the Go one
# answer the same conversation identically on copies of one database.
# Needs: node + npm install at the repository root, python3, docker.
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../../.." && pwd)
W=$(mktemp -d)
trap 'fuser -k 3915/tcp >/dev/null 2>&1 || true; rm -rf "$W"' EXIT
mkdir "$W/ts" "$W/go"

# 1. A database prepared through the TypeScript REST server: owner, API key, a business.
(cd "$ROOT" && DB_DIRECTORY="$W/ts" DEFAULT_DATABASE=t.db PORT=3915 FRONTEND_ORIGIN=http://localhost:1 \
  npx tsx src/backend/webserver/main.ts >"$W/ts.log" 2>&1 &)
for i in $(seq 40); do curl -sf localhost:3915/api/health >/dev/null && break; sleep 1; done
python3 - "$W" <<'PY'
import json, sys, urllib.request, http.cookiejar
jar = http.cookiejar.CookieJar(); op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def call(m, p, b=None):
    r = urllib.request.Request("http://127.0.0.1:3915" + p, method=m, data=json.dumps(b).encode() if b is not None else None, headers={"Content-Type": "application/json"})
    return json.loads(op.open(r).read())
call("POST", "/api/auth/setup", {"email": "me@example.com", "password": "Correct-Horse-9"})
key = call("POST", "/api/auth/api-keys", {"name": "mcp"})["data"]["secret"]
call("POST", "/api/businesses", {"name": "Mavri", "shortName": "MS", "vatCode": "V9", "isArchived": False})
open(sys.argv[1] + "/key", "w").write(key)
PY
fuser -k 3915/tcp >/dev/null; sleep 1
cp "$W/ts/t.db" "$W/go/t.db"; chmod -R a+rwX "$W/go"
KEY=$(cat "$W/key")

# 2. The same conversation with each server.
(cd "$ROOT" && NODEDR_API_KEY="$KEY" DB_DIRECTORY="$W/ts" DB_FILE=t.db python3 "$HERE/mcp_scenario.py" "$W/ts.json" -- npx tsx src/backend/mcp/server.ts)
echo "building the Go server..."
(cd "$ROOT/rewrite" && docker run --rm -v "$ROOT/rewrite":/w -w /w -v gomod:/go/pkg/mod -v "$W":/o golang:1.24 sh -c 'CGO_ENABLED=0 go build -o /o/mcp ./cmd/mcp && chmod a+rx /o/mcp')
NODEDR_API_KEY="$KEY" DB_DIRECTORY="$W/go" DB_FILE=t.db python3 "$HERE/mcp_scenario.py" "$W/go.json" -- "$W/mcp"
python3 "$HERE/mcp_compare.py" "$W/ts.json" "$W/go.json"
