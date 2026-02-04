FROM node:20-alpine AS builder
WORKDIR /app


COPY package.json package-lock.json* ./
RUN npm install

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build:react
RUN npm run build:webserver

FROM node:20-alpine AS runner
WORKDIR /app

RUN npm install -g serve@14


COPY --from=builder /app/dist-fe /app/dist-fe
COPY --from=builder /app/dist-be /app/dist-be
COPY --from=builder /app/node_modules /app/node_modules

EXPOSE 3000 3001

COPY scripts/docker-start.sh /app/scripts/docker-start.sh
RUN sed -i 's/\r$//' /app/scripts/docker-start.sh \
    && chmod +x /app/scripts/docker-start.sh

VOLUME ["/data"]

CMD ["/app/scripts/docker-start.sh"]
