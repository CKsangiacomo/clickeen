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
- `POST /model/chat`
- `POST /execute` (deprecated; visible 410)
- `POST /outcome` (signed outcome attach)

Deploy:
- Cloud-dev deploys through GitHub Actions `cloud-dev workers deploy`.
- Worker config lives in `sanfrancisco/wrangler.toml`.
- Do not use the Cloudflare dashboard worker Git deploy control as the deploy authority.

Grant format:
`ckgrant.<base64url(payloadJson)>.<base64url(hmacSha256("ckgrant.<payloadB64>", AI_GRANT_HMAC_SECRET))>`
