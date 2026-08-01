# San Francisco (Cloudflare Worker)

San Francisco is Clickeen's governed model-execution engine. Current
architecture docs live in `documentation/ai/sanfrancisco.md`.

Local dev:

1) Set env vars (example):
   - `ROMA_AI_GRANT_PUBLIC_KEY_PEM`
   - `PRAGUE_L10N_HMAC_SECRET`
   - `DEEPSEEK_API_KEY`
2) Run: `pnpm --filter @clickeen/sanfrancisco dev`

Endpoints:
- `GET /healthz`
- `POST /model/chat`
- `POST /execute` (deprecated; visible 410)
- `POST /l10n/translate` (signed Prague system-copy translation)

Deploy:
- Cloud-dev deploys through GitHub Actions `cloud-dev workers deploy`.
- Worker config lives in `sanfrancisco/wrangler.toml`.
- Do not use the Cloudflare dashboard worker Git deploy control as the deploy authority.

Grant format:
`ckgrant.<base64url(payloadJson)>.<base64url(RS256("ckgrant.<payloadB64>", ROMA_AI_GRANT_PRIVATE_KEY_PEM))>`

Roma alone holds the private key. San Francisco verifies grants with
`ROMA_AI_GRANT_PUBLIC_KEY_PEM`; Prague request bodies use the independent
`PRAGUE_L10N_HMAC_SECRET`.
