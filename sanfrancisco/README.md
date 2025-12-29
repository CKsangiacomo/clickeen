# SanFrancisco (Cloudflare Worker)

Local dev:

1) Set env vars (example):
   - `AI_GRANT_HMAC_SECRET`
   - `DEEPSEEK_API_KEY`
2) Run: `pnpm --filter @clickeen/sanfrancisco dev`

Endpoints:
- `GET /healthz`
- `POST /v1/execute`

Deploy note:
- This worker is intended to deploy from Cloudflare “Workers → Deploy from Git” (root: `/sanfrancisco`).

Grant format (v1):
`v1.<base64url(payloadJson)>.<base64url(hmacSha256("v1.<payloadB64>", AI_GRANT_HMAC_SECRET))>`
