STATUS: WIP — ONLY wired in Venice (not built, not GA)

# Widget: engagement.newsletter

Current Venice Status
- SSR route: `venice/app/e/[publicId]/route.ts:1`
- Renderer: `venice/lib/renderers/newsletter.ts:1`
- Embed entry: `GET /e/:publicId`
- Query params: `theme=light|dark`, `device=desktop|mobile`, `ts=<ms>` (preview → no-store)
- Caching: published vs draft TTLs; validators ETag + Last-Modified; `Vary: Authorization, X-Embed-Token`
- CSP: strict; inline `<style>` uses a CSP nonce
- Backlink: “Made with Clickeen” visible per branding policy
- Pixel: 1×1 request to `/embed/pixel` (Venice) → Paris `/api/usage` (204 from Venice)
- Submissions: form `action="/s/:publicId"` (Venice proxy → Paris `/api/submit/:publicId`), rate-limited and idempotent server-side

Config (Phase‑1 stub)
- `title` (string)
- `placeholder` (string)
- `buttonText` (string)
- `layout` ("inline" | "stacked")

Notes
- Wired for SSR only; not feature-complete and not GA.
- Email capture posts to server proxy only; no client storage or JS beyond SSR.

