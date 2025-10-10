STATUS: WIP — ONLY wired in Venice (not built, not GA)

# Widget: forms.contact

Current Venice Status
- SSR route: `venice/app/e/[publicId]/route.ts:1`
- Renderer: `venice/lib/renderers/formsContact.ts:1`
- Embed entry: `GET /e/:publicId`
- Query params: `theme=light|dark`, `device=desktop|mobile`, `ts=<ms>` (preview → no-store)
- Caching: published vs draft TTLs; validators ETag + Last-Modified; `Vary: Authorization, X-Embed-Token`
- CSP: strict; inline `<style>` uses a CSP nonce
- Backlink: “Made with Clickeen” visible per branding policy
- Pixel: 1×1 request to `/embed/pixel` (Venice) which forwards to Paris `/api/usage` and returns 204
- Submissions: form `action="/s/:publicId"` (Venice proxy → Paris `/api/submit/:publicId`), rate-limited and idempotent server-side

Config (Phase‑1 stub)
- `title` (string)
- `fields` (object): `{ name: boolean, email: boolean, message: boolean }`
- `submitText` (string)

Notes
- This widget is only wired for SSR in Venice; it is not considered feature-complete and is not GA.
- Styling is minimal and inline; Dieter tokens integration is TBD.

