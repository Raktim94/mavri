set -e

mkdir -p /data

echo "Starting backend webserver..."
node /app/dist-be/backend/server/webserver/main.js &
PID_BACKEND=$!

echo "Serving frontend on :3001..."
serve -s /app/dist-fe -l 3001 &
PID_FRONTEND=$!

wait -n $PID_BACKEND $PID_FRONTEND

echo "One process exited, shutting down..."
kill $PID_BACKEND 2>/dev/null || true
kill $PID_FRONTEND 2>/dev/null || true
wait
