# AGENTS.md — Mavri

## Integrating with Mavri
Read [`prompts/AI_INTEGRATION_PROMPT.md`](prompts/AI_INTEGRATION_PROMPT.md). Essentials: REST with `mvr_…` Bearer keys (not scoped; keep server-side), OpenAPI at `/api/openapi.yaml`, order→invoice at `POST /api/v1/orders` (idempotent), signed outbound webhooks, local stdio MCP with an approval gate (`confirm:true` only after the user's explicit yes). Mavri is self-hosted: ask for URL and key, never invent or commit them. Details: [`docs/API.md`](docs/API.md).

## Working on this repo
See `CONTRIBUTING.md`. No Co-Authored-By trailers.
