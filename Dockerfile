# Mavri: one container, one port (the Go server serves the API and the web app).
#   docker build -t mavri .
#   docker run -p 3001:3001 -v mavri-data:/data mavri
# Or: docker compose up -d --build

FROM node:20-alpine AS web
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY web ./web
RUN npm run build

FROM golang:1.24-alpine AS server
WORKDIR /src
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ ./
ARG VERSION=2.4.0
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w -X github.com/Raktim94/mavri/server/internal/web.Version=${VERSION}" -o /mavri ./cmd/mavri \
 && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w -X github.com/Raktim94/mavri/server/internal/web.Version=${VERSION}" -o /mavri-mcp ./cmd/mavri-mcp

FROM alpine:3.20
RUN adduser -D -u 10001 mavri && mkdir /data && chown mavri /data
COPY --from=server /mavri /mavri-mcp /usr/local/bin/
COPY --from=web /app/dist-fe /app/dist-fe
USER mavri
# Opens (or creates) /data/mavri.db on start.
ENV DB_DIRECTORY=/data \
    DB_FILE=mavri.db \
    PORT=3001 \
    TRUST_PROXY=0 \
    FRONTEND_DIR=/app/dist-fe
VOLUME ["/data"]
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3001/api/health >/dev/null || exit 1
CMD ["mavri"]
