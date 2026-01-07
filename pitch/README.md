# Pitch Worker

Dedicated Cloudflare Worker that powers the **Investor Pitch Agent** (retrieval-first, citations).

## Auto-Deploy

**Pushing to `main` automatically:**
1. Ensures Vectorize index exists
2. Deploys the Worker
3. Syncs all pitch docs to Vectorize

Triggers on changes to: `pitch/**`, `documentation/_pitch/**`, `documentation/strategy/*.md`

### Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | Deploy worker |
| `CLOUDFLARE_ACCOUNT_ID` | Deploy worker |
| `PITCH_SERVICE_KEY` | Auth for doc sync |

### Required Cloudflare Secrets (set once)

```bash
cd pitch
echo "sk-..." | npx wrangler secret put OPENAI_API_KEY
echo "your-service-key" | npx wrangler secret put PITCH_SERVICE_KEY
```

## Manual Deploy

```bash
# Full deploy + sync
cd pitch
PITCH_API_URL=https://pitch-dev.clickeen.workers.dev \
PITCH_SERVICE_KEY=your-key \
pnpm deploy:full

# Or step by step
pnpm deploy      # ensure vectorize + deploy worker
pnpm sync-docs   # sync docs to vectorize
```

## Routes

- `GET /healthz`
- `GET /v1/pitch/search?query=...&top_k=...`
- `GET /v1/pitch/answer?query=...&locale=en&top_k=...`
- `POST /v1/pitch/upsert` (requires `X-API-Key: PITCH_SERVICE_KEY`)

## Vectorize

This Worker binds Vectorize index:
- `clickeen-pitch-docs` (1536 dims, cosine)

Created automatically on first deploy.

## Conversation Logging

Every conversation is logged to console as JSON. View logs in:

**Cloudflare Dashboard → Workers & Pages → pitch-dev → Logs**

Example log entry:
```json
{
  "type": "pitch_conversation",
  "ts": 1736280000000,
  "question": "What is Clickeen?",
  "answer": "Clickeen is...",
  "locale": "en",
  "sources": ["strategy-001", "architecture-002"],
  "model": "gpt-5.2",
  "country": "US"
}
```

No extra infrastructure needed.

## Local dev

```bash
pnpm --filter @clickeen/pitch dev
```

By default this runs on `http://localhost:8790`. To sync docs locally:

```bash
PITCH_API_URL=http://localhost:8790 \
PITCH_SERVICE_KEY=your-key \
pnpm --filter @clickeen/pitch sync-docs
```

