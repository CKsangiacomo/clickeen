# FAQ Widget — SEO + GEO Execution Plan (Repo-Accurate)

This plan turns the FAQ widget into a moat:
- **SEO**: Search Engine Optimization (Google/Bing rich results + entity understanding)
- **GEO**: Generative Engine Optimization (AI answer extraction + citation)

This doc is the committed version of the working plan (the `Execution_Pipeline_Docs/` folder is gitignored). Any future files or routes are explicitly labeled as planned.

See also:
- Cross-cutting architecture: `documentation/capabilities/seo-geo.md`
- Widget architecture: `documentation/widgets/WidgetArchitecture.md`

---

## Hard requirement (the foundation)

**SEO and GEO must apply to the host page.**

Current embed is iframe-first (`venice/app/e/[publicId]/route.ts`). That is correct for safety, but it is not a reliable SEO channel.

**Therefore we must add an indexable inline embed mode** (no iframe) so:
- Schema.org JSON-LD is in the host DOM (`<head>`).
- Question deep links are host-page anchors.

---

## Phase 0 — Indexable embed mode (Venice + widget scoping)

### Goal
Ship a second embed mode that mounts into the host DOM (SEO/GEO-capable) while keeping iframe mode intact.

### Venice deliverables
- Add loader routes (currently only `loader.ts` modules exist):
  - `GET /embed/v2/loader.js` (indexable inline embed)
  - `GET /embed/latest/loader.js` (points at the latest stable loader)
- Add an inline render endpoint:
  - `GET /r/:publicId` (returns `{ widgetType, state, schemaJsonLd, renderHtml, assets: { styles[], scripts[] } }` for Shadow DOM mount + schema injection; `assets.styles[]` must include `tokens.shadow.css`)

### Embed strategy: Shadow DOM for UI (default)
Inline embed must survive real host pages (resets, Tailwind/Bootstrap, `!important`, font overrides).
For the FAQ widget, indexable embed should:
- Inject Schema.org JSON-LD into the host `<head>` (SEO).
- Render the interactive UI into a Shadow Root (CSS isolation).
- Expose per-question deep links (`geo.enableDeepLinks`) so engines can cite:
  - URL hash uses `#faq-q-<publicId>-<stableId>` (prevents collisions when multiple widgets exist on a page)
  - Loader scrolls into the Shadow DOM target and opens it

Default vs fallback:
- Default: Shadow DOM indexable embed.
- Fallback: iframe embed for customers who explicitly require origin-level isolation.

### Widget deliverables (FAQ first)
- Scope CSS under the widget root (no global `html/body/:root` styling).
- Ensure shared runtime modules can target stage/pod wrappers via `data-role` (not generic class selectors).

---

## Phase 1 — Add SEO/GEO controls (Tokyo + Bob compiler passthrough)

### Goal
Users can opt into SEO/GEO optimization and then configure settings manually (no AI yet).

### Product toggle (Settings)

Add a single toggle in Settings:
- Label: “Enable SEO/GEO Optimization”
- State: `seoGeo.enabled: boolean`
- Default: `false`

Behavior:
- When `seoGeo.enabled === false`:
  - SEO/GEO advanced controls are hidden.
  - Embed mode remains safe iframe (current behavior).
- When `seoGeo.enabled === true`:
  - Expose SEO and GEO settings (and later scoring/AI actions).
  - Default embed mode becomes indexable (Shadow DOM UI) via the new loader.

Entitlements (product rule):
- In **Minibob**, the toggle cannot be turned on.
- In **Bob**, the toggle is only available for users on a plan (free or paid).
- Server must enforce this on publish (UI gating is not sufficient).

### Tokyo (FAQ spec)
Update `tokyo/widgets/faq/spec.json` defaults + add a new `<bob-panel id='seo'>`:
- `state.seoGeo.enabled` (optimization toggle; drives show-if for the rest)
- `state.seo.*` (schema enablement, business type, product metadata when applicable)
- `state.geo.*` (answer format, max answer length, deep links)
- `state.analytics.*` (click/expand tracking toggles)

All SEO/GEO control clusters in the new panel must use `show-if="seoGeo.enabled == true"`.

### Bob compiler
No special validation/coercion. Bob compiles and passes these fields through as normal instance config.

Relevant entrypoint:
- `bob/lib/compiler.server.ts`

---

## Phase 2 — SEO output (Schema.org) + GEO output (deep links)

### SEO: Schema.org JSON-LD generation
For indexable embed mode only:
- Always emit `FAQPage`
- Additionally emit (based on `seo.businessType`):
  - `product-seller`: `Product` (+ `Offer` / merchant URLs when present)
  - `online-service`: `Organization` (or service entity)
  - `local`: `LocalBusiness`/`Place` (only when explicitly enabled + fields present)

Ownership (deterministic):
- Venice generates schema at render time from the canonical instance snapshot.
- Loader injects the returned JSON-LD string into the host `<head>`.

Implementation location (Venice):
- New helper: `venice/lib/schema/faq.ts`
- Used by: new `venice/app/r/[publicId]/route.ts` (inline render endpoint)

### GEO: deep links + deep-link activation
When `geo.enableDeepLinks === true`:
- Render stable IDs per question (e.g. `id="faq-q-<stableId>"`)
- Support opening a question when URL hash matches (initial load + `hashchange`)

Implementation location (FAQ runtime):
- `tokyo/widgets/faq/widget.client.js`

---

## Phase 3 — SanFrancisco scoring + “Fix All” optimization

### Goal
Show SEO/GEO scores and generate deterministic `ops[]` to fix issues.

### SanFrancisco
New agent (planned, not in repo yet):
- `sanfrancisco/src/agents/faqOptimizer.ts`

Prompt modules (kept small and typed, no prose returns):
- SEO scorer (returns JSON score + issues)
- GEO scorer (returns JSON score + issues)
- Answer reformatter (direct-first) (returns JSON + rewritten answer)

### Paris (gateway)
Paris is a Cloudflare Worker router in `paris/src/index.ts` (not Next.js route files).

Add endpoints:
- `POST /api/ai/faq/analyze`
- `POST /api/ai/faq/optimize`
- `POST /api/ai/faq/generate`

Auth model stays consistent with current repo architecture (dev gating via `PARIS_DEV_JWT` today; production will evolve).

### Bob UI
Add a sidebar panel for FAQ scoring + actions:
- “SEO score / GEO score”
- “Fix all” (applies returned ops via `bob/lib/ops.ts`)

### GEO rewrite UX (explicit)
GEO rewrites must never happen silently.
Flow:
- User triggers “Rewrite to direct-first” (or “Fix all GEO issues”).
- SanFrancisco returns deterministic `ops[]` (set paths for answers).
- Bob applies ops locally and uses the standard Keep/Undo decision.

---

## Notes (contracts)

- SEO is not only local/NAP. Entity schema differs by business type (`Product` vs `Organization` vs `LocalBusiness`).
- GEO is only: answer structure + answer length + deep-link citation.
- Keep outputs deterministic:
  - Strict JSON schemas
  - Fail-visible missing keys/fields
  - No silent fallbacks that mask gaps
