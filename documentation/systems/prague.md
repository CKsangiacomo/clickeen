STATUS: NORMATIVE — SINGLE SOURCE OF TRUTH (PHASE-1)
This document is authoritative for the Prague system. It MUST NOT conflict with:
1) supabase/migrations/ (DB schema truth)
2) documentation/CONTEXT.md (Global terms and precedence)
3) Other system PRDs in documentation/systems/
If any conflict is found, STOP and escalate to the CEO. Do not guess.

# System: Prague — Marketing & Discovery Surface

## 0) Quick Facts
- **Route:** `/` (marketing pages) + `/gallery` (public widget showcase)
- **Repo path:** `prague/` (Next.js App Router)
- **Deploy surface:** Vercel project `c-keen-site`
- **Purpose:** Drive PLG funnel — educate, showcase widgets, and hand off to Bob/Venice preview flows without auth friction.

## 1) Scope (Phase-1)
- Static-first marketing pages (home, pricing outline, FAQ) rendered via Next.js SSG. Dynamic user data is out of scope.
- Gallery (`/gallery`, `/gallery/[widgetSlug]`) is static-first and sourced from Denver/CDN widget definitions (Paris does not host a widget catalog in this repo snapshot).
- **Widget selection flow (CRITICAL):**
  1. User browses gallery, clicks widget card (e.g., "Contact Form")
  2. Prague creates (or selects) a draft instance upstream (outside Paris) and obtains a `publicId`
  3. Prague opens MiniBob: `<iframe src="https://c-keen-app.vercel.app/bob?minibob=true&publicId={publicId}">` (planned flow)
  4. Bob loads with that specific widget already instantiated with default template applied
  5. User edits config (text, colors) and/or switches templates inside Bob
  6. Click "Publish" → signup → claim widget to workspace
- **MiniBob UI (conditional rendering in Bob):**
  - Bob detects `?minibob=true` and conditionally hides UI (no Save button, no SecondaryDrawer)
  - Only "Publish" button visible in MiniBob mode
  - "Publish" triggers signup flow → parent window redirects to c-keen-app with claimed widget
- **Critical**: Bob does NOT have widget type picker. Widget type is chosen on Prague gallery, Prague creates instance, Bob only edits that specific widget.

## 2) Integrations & Data Flow
| Action | Source | Notes |
| --- | --- | --- |
| Fetch gallery data | Denver/CDN | Static catalog built from widget definitions; keep marketing pages fast and cacheable. |
| Create draft instance | Outside Paris | Instance creation is not implemented in this repo snapshot; Paris `POST /api/instance` is disabled. |
| Open MiniBob | Bob (c-keen-app) | Prague iframes Bob with `?minibob=true&publicId={publicId}` |
| Generate embed snippet | Venice | Embed code uses `https://c-keen-embed.vercel.app/e/{publicId}`; Prague never calls Paris with secrets. |
| Capture attribution | Berlin (if enabled) | Only anonymous page analytics; no PII. |

Environment variables: `NEXT_PUBLIC_BOB_URL`, `NEXT_PUBLIC_VENICE_URL`, `NEXT_PUBLIC_DENVER_URL` for building links to Bob/embeds/widget catalog assets. No secrets allowed.

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

## 6) Common Mistakes (DO NOT DO)
- ❌ Calling Paris with service-role tokens — Prague is public-only.
- ❌ Building widget type picker in Bob — widget type is chosen on Prague gallery before Bob opens.
- ❌ Shipping heavy client bundles — keep to static/SSR output with minimal JS.

---
Links: back to `documentation/CONTEXT.md`
