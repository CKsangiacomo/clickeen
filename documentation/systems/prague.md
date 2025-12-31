STATUS: REFERENCE — LIVING DOC (MAY DRIFT)
This document describes the intended Prague responsibilities and contracts.
When debugging reality, treat runtime code, `supabase/migrations/`, and deployed Cloudflare config as truth.
If you find a mismatch, update this document (do not block execution on doc drift).

# System: Prague — Marketing & Discovery Surface

## 0) Quick Facts
- **Route:** `/` (marketing pages) + `/gallery` (public widget showcase)
- **Repo path:** `prague/` (placeholder workspace in this repo snapshot)
- **Deploy surface:** Cloudflare Pages (planned)
- **Purpose (planned):** Drive PLG funnel — educate, showcase widgets, and hand off to Bob/MiniBob flows without auth friction.

## Runtime Reality (this repo snapshot)

- `prague/` is a placeholder (see `prague/README.md`).
- Marketing site + gallery are not implemented here yet.
- The rest of this document is a PRD for the intended Prague responsibilities.

## 1) Scope (Phase-1)
- Static-first marketing pages (home, pricing outline, FAQ) rendered via Next.js SSG. Dynamic user data is out of scope.
- Gallery (`/gallery`, `/gallery/[widgetSlug]`) is static-first and sourced from Tokyo/CDN widget definitions (Paris does not host a widget catalog in this repo snapshot).
- **Widget selection flow (CRITICAL):**
  1. User browses gallery, clicks widget card (e.g., "Contact Form")
  2. Prague creates (or selects) an unpublished instance upstream and obtains a `publicId`
  3. Prague opens MiniBob: `<iframe src="https://app.clickeen.com/bob?minibob=true&publicId={publicId}">` (planned flow)
  4. Bob loads that specific instance (either spec-defaults or a curated starter instance)
  5. User edits config (text, colors, layout, etc.) inside Bob
  6. Click "Publish" → signup → claim widget to workspace
- **MiniBob UI (conditional rendering in Bob):**
  - Bob detects `?minibob=true` and conditionally hides UI (no Save button, no SecondaryDrawer)
  - Only "Publish" button visible in MiniBob mode
  - "Publish" triggers signup flow → parent window redirects to Bob app with claimed widget
- **Critical**: Bob does NOT have widget type picker. Widget type is chosen on Prague gallery, Prague creates instance, Bob only edits that specific widget.

## 2) Integrations & Data Flow
| Action | Source | Notes |
| --- | --- | --- |
| Fetch gallery data | Tokyo/CDN | Static catalog built from widget definitions; keep marketing pages fast and cacheable. |
| Create unpublished instance | Product backend | In this repo snapshot, `POST /api/instance` exists for dev/local bootstrapping; anonymous marketing creation is not implemented yet. |
| Open MiniBob | Bob (app.clickeen.com) | Prague iframes Bob with `?minibob=true&publicId={publicId}` |
| Generate embed snippet | Venice | Embed code uses `https://embed.clickeen.com/e/{publicId}`; Venice is the public embed origin. |
| Capture attribution | Berlin (if enabled) | Only anonymous page analytics; no PII. |

Environment variables: `NEXT_PUBLIC_BOB_URL`, `NEXT_PUBLIC_VENICE_URL`, `NEXT_PUBLIC_TOKYO_URL` for building links to Bob/embeds/widget catalog assets. These are public URLs only.

## 3) Performance & SEO
- All pages must meet Core Web Vitals targets (LCP ≤2.5 s, CLS <0.1). Use static generation + image optimisation.
- SEO requirements: set canonical URLs, structured data snippets for gallery entries, open graph tags for social sharing.
- Accessibility: All interactive elements follow WCAG AA (focus management, semantic headings, alt text).

## 4) Out of Scope / Future
- No authenticated experiences, dashboards, or builder previews.
- No CMS authoring UI (content edits happen via filesystem/MDX during Phase-1).
- No third-party scripts beyond sanctioned analytics (Berlin). No marketing pixel injection without explicit CEO approval.

## 5) Testing Checklist
- Visual regression for home + gallery (Playwright smoke).
- Link checker ensuring CTA routes point to Bob `/bob` or Venice embed docs.
- Lighthouse budget tests as part of release checklist.

## 6) Boundary Summary
- Prague is a public-only surface; it links to Bob/Venice/Tokyo and contains no service credentials.
- Widget type selection happens in Prague; Bob opens for a specific `publicId`.
- Prague is static-first and ships minimal client JS.

---
Links: back to `documentation/CONTEXT.md`
