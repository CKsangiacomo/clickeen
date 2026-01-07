# Pitch Worker

Dedicated Cloudflare Worker that powers the **Investor Pitch Agent** (retrieval-first, citations).

## Why this is separate from San Francisco

Pitch infra (Vectorize index + docs ingestion) must **never** block core AI deploys. Keeping Pitch as its own Worker makes deploy failure isolated.

## Routes

- `GET /healthz`
- `GET /v1/pitch/search?query=...&top_k=...`
- `GET /v1/pitch/answer?query=...&locale=en&top_k=...`
- `POST /v1/pitch/upsert` (requires `X-API-Key: PITCH_SERVICE_KEY`)

## Required env vars

- `OPENAI_API_KEY` (embeddings + answer generation)
- `PITCH_SERVICE_KEY` (for upsert)
- Optional: `PITCH_MODEL` (default is set in `wrangler.toml`)

## Vectorize

This Worker binds Vectorize index:
- `clickeen-pitch-docs` (1536 dims, cosine)

Deploy script creates it if missing.

## Local dev

```bash
pnpm --filter @clickeen/pitch dev
```


