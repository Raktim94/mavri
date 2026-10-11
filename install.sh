#!/usr/bin/env bash
set -euo pipefail

# Mavri — one-click Docker installer
# Checks prerequisites, builds images, starts the stack, and prints the URL.

PORT="${HOST_PORT:-3001}"

echo "Mavri installer"
echo "========================"
echo ""

# ── Check Docker ─────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker is not installed."
  echo "Install it from https://docs.docker.com/get-docker/"
  exit 1
fi

if ! docker compose version &>/dev/null 2>&1; then
  echo "ERROR: docker compose plugin is not available."
  echo "Install or update Docker: https://docs.docker.com/compose/install/"
  exit 1
fi

echo "Docker found: $(docker --version)"
echo ""

# ── Build & start ────────────────────────────────────────────────────────────
echo "Building and starting containers..."
docker compose up -d --build

# ── Wait for backend to be healthy ───────────────────────────────────────────
echo ""
echo "Waiting for backend to become healthy..."
MAX_WAIT=90
ELAPSED=0
until curl -fsS "http://localhost:${PORT}/api/health" >/dev/null 2>&1; do
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    echo "ERROR: Backend did not become healthy within ${MAX_WAIT}s."
    echo "Check logs with: docker compose logs"
    exit 1
  fi
done

echo ""
echo "========================"
echo "Mavri is running!"
echo "Open http://localhost:${PORT} in your browser."
echo ""
echo "Useful commands:"
echo "  docker compose logs -f    # watch logs"
echo "  docker compose down       # stop the stack"
echo "  docker compose up -d      # restart"
echo ""
