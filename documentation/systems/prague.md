STATUS: NORMATIVE — SINGLE SOURCE OF TRUTH (PHASE-1)
This document is authoritative for the Prague system. It MUST NOT conflict with:
1) documentation/dbschemacontext.md (DB Truth)
2) documentation/CRITICAL-TECHPHASES/Techphases.md (Global Contracts)
3) documentation/CRITICAL-TECHPHASES/Techphases-Phase1Specs.md (Phase-1 Contracts)
If any conflict is found, STOP and escalate to the CEO. Do not guess.

# System: Prague — Marketing & Discovery Surface

## 0) Quick Facts
- **Route:** `/` (marketing pages) + `/gallery` (public widget showcase)
- **Repo path:** `prague/` (Next.js App Router)
- **Deploy surface:** Vercel project `c-keen-site`
- **Purpose:** Drive PLG funnel — educate, showcase widgets, and hand off to Bob/Venice preview flows without auth friction.

## 1) Scope (Phase-1)
- Static-first marketing pages (home, pricing outline, FAQ) rendered via Next.js SSG. Dynamic user data is out of scope.
- Gallery (`/gallery`, `/gallery/[widgetSlug]`) fetched from Paris public catalog endpoints (`GET /api/widgets`, `GET /api/templates`) and cached edge-side for 10 minutes.
- “Play without an account” CTA opens Venice preview using `/embed/v{semver}/loader.js` snippet. No builder functionality lives inside Prague.

## 2) Integrations & Data Flow
| Action | Source | Notes |
| --- | --- | --- |
| Fetch gallery data | Paris `/api/widgets` | Use `fetch()` with ISR revalidation 600 s; fallback spinner + retry. |
| Generate preview snippet | Venice | Embed code uses `https://c-keen-embed.vercel.app/...`; Prague never calls Paris with secrets. |
| Capture attribution | Berlin (if enabled) | Only anonymous page analytics; no PII. |

Environment variables: `NEXT_PUBLIC_PARIS_URL`, `NEXT_PUBLIC_VENICE_URL` for building links to API/embeds. No secrets allowed.

## 3) Performance & SEO
- All pages must meet Core Web Vitals targets (LCP ≤2.5 s, CLS <0.1). Use static generation + image optimisation.
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
- ❌ Embedding Bob or builder flows in Prague; defer to `/bob`.
- ❌ Shipping heavy client bundles — keep to static/SSR output with minimal JS.

---
Links: back to `documentation/CONTEXT.md`
