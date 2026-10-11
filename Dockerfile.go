# Mavri with the Go backend: one container, one port (the API and the web app).
#   docker build -f Dockerfile.go -t mavri .
#   docker run -p 3001:3001 -v mavri-data:/data mavri
# Or: docker compose -f docker-compose.go.yml up -d --build

FROM node:20-alpine AS web
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
# Optional: only for deployments where the API lives on another origin.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build:react

FROM golang:1.24-alpine AS server
WORKDIR /src
COPY rewrite/go.mod rewrite/go.sum ./
RUN go mod download
COPY rewrite/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /mavri ./cmd/server

FROM alpine:3.20
RUN adduser -D -u 10001 mavri && mkdir /data && chown mavri /data
COPY --from=server /mavri /usr/local/bin/mavri
COPY --from=web /app/dist-fe /app/dist-fe
USER mavri
# NODE_ENV=docker keeps the old behaviour of opening (or creating) /data/invoice.db.
ENV NODE_ENV=docker \
    DB_DIRECTORY=/data \
    PORT=3001 \
    TRUST_PROXY=0 \
    DEV_SERVER_URL=0.0.0.0 \
    FRONTEND_DIR=/app/dist-fe
VOLUME ["/data"]
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3001/api/health >/dev/null || exit 1
CMD ["mavri"]
