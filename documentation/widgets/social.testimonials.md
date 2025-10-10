STATUS: WIP — ONLY wired in Venice (not built, not GA)

# Widget: social.testimonials

Current Venice Status
- SSR route: `venice/app/e/[publicId]/route.ts:1`
- Renderer: `venice/lib/renderers/testimonials.ts:1`
- Embed entry: `GET /e/:publicId`
- Query params: `theme=light|dark`, `device=desktop|mobile`, `ts=<ms>` (preview → no-store)
- Caching: published vs draft TTLs; validators ETag + Last-Modified; `Vary: Authorization, X-Embed-Token`
- CSP: strict; inline `<style>` uses a CSP nonce
- Backlink: “Made with Clickeen” visible per branding policy
- Pixel: 1×1 request to `/embed/pixel` (Venice) → Paris `/api/usage` (204 from Venice)

Config (Phase‑1 stub)
- `title` (string)
- `items` (array of `{ quote: string, author?: string, role?: string }`)

Notes
- Wired for SSR only; not feature-complete and not GA.
- Grid layout is basic; Dieter tokens and richer variants TBD.

