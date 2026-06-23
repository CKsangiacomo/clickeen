# San Francisco (Cloudflare Worker)

San Francisco is Clickeen's governed model-execution engine. Current
architecture docs live in `documentation/ai/sanfrancisco.md`.

Local dev:

1) Set env vars (example):
   - `AI_GRANT_HMAC_SECRET`
   - `DEEPSEEK_API_KEY`
2) Run: `pnpm --filter @clickeen/sanfrancisco dev`

Endpoints:
- `GET /healthz`
- `POST /v1/model/chat`
- `POST /v1/execute` (deprecated; visible 410)
- `POST /v1/outcome` (signed outcome attach)

Deploy:
- Cloud-dev deploys through GitHub Actions `cloud-dev workers deploy`.
- Worker config lives in `sanfrancisco/wrangler.toml`.
- Do not use the Cloudflare dashboard worker Git deploy control as the deploy authority.

Grant format (v1):
`v1.<base64url(payloadJson)>.<base64url(hmacSha256("v1.<payloadB64>", AI_GRANT_HMAC_SECRET))>`
