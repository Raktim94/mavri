set -e

echo "Starting container with SERVICE=${SERVICE}"

case "$SERVICE" in
  backend)
    mkdir -p /data
    echo "Starting backend webserver..."
    exec node /app/dist-be/backend/server/webserver/main.js
    ;;

  frontend)
    echo "Starting frontend server..."
    exec serve -s /app/dist-fe -l 3001
    ;;

  *)
    echo "ERROR: SERVICE must be 'backend' or 'frontend'"
    exit 1
    ;;
esac
