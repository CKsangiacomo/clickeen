# CI/CD Automation Uplevel — “Cloud-dev Prague Is Boring”

**Status:** EXECUTED  
**Priority:** P0 (Blocks reliable Prague deploys)  
**Owner:** Product Dev Team  
**Date:** 2026-01-30
**Executed:** 2026-02-01

---

## 0) What “Deploy Prague” Means (Local Parity Contract)

When local “just works”, it’s because `scripts/dev-up.sh` keeps multiple components in sync.  
Cloud-dev must treat these as a single boring release contract for the **Prague surface**:

1) **Overall infra deploy**: Paris + San Francisco + Tokyo Worker + Tokyo assets origin are deployed and reachable.  
2) **Blocks deploy (structure)**: Prague pages are built from `tokyo/widgets/*/pages/*.json` (block layout + curated refs).  
3) **Blocks copy translation + deploy**: Prague overlays exist and are published to Tokyo/R2 under `tokyo/l10n/prague/**` (and are fetched by Prague from `${PUBLIC_TOKYO_URL}/l10n/v/<PUBLIC_PRAGUE_BUILD_ID>/prague/**`) for the exact `baseFingerprint`s implied by the deployed blocks/chrome.  
4) **Embedded creative instances via Venice (with translations)**: embeds referenced by Prague blocks resolve in cloud-dev (Venice renders and receives locale, instance overlays are published).

**Definition of “boring”**: after a push to `main`, cloud-dev Prague is correct without any human remembering extra steps.

---

## 1) Current State & Problem

### What exists today

- Local parity is good (dev-up brings up Tokyo stub, Paris, SF, Tokyo-worker and ensures Prague overlays exist locally).
- The overlay architecture itself is correct (base-in-repo + overlays-as-CDN assets).
- Cloud-dev GitHub Actions workflows exist (P0 scaffolding is in-repo):
  - `.github/workflows/cloud-dev-workers.yml` (Paris + San Francisco + Tokyo Worker)
  - `.github/workflows/cloud-dev-prague-app.yml` (Prague app deploy)
  - `.github/workflows/cloud-dev-prague-content.yml` (Prague content release: validate → translate/verify/publish overlays → deploy)
- Prague strict-mode + deterministic overlay headers ship in the runtime:
  - `PRAGUE_L10N_STRICT=1` makes missing/stale non-`en` overlays fail visibly with `424` + headers.
  - Widget routes set `X-Prague-Overlay-Status` + `X-Prague-Overlay-Locale` for smoke-test determinism.
- Prague deploys pass a build-stable cache-bust token to embeds:
  - Workflows set `PUBLIC_PRAGUE_BUILD_ID=${{ github.sha }}`.
  - Prague uses it as the Venice cache-bust token (`data-ts=<PUBLIC_PRAGUE_BUILD_ID>` on the loader; `?ts=<PUBLIC_PRAGUE_BUILD_ID>` on direct iframe URLs) so curated visuals refresh immediately after deploy.

### Prague's 4-Layer Architecture

Prague is not monolithic—it has **4 independent components** that must stay synchronized:

| Layer | What It Is | Source | Deploy Target | Translation |
|-------|-----------|--------|---------------|-------------|
| **1. Infra** | App scaffold (routes, layouts, runtime loaders) | `prague/src/`, `prague/astro.config.mjs` | Cloudflare Pages | Chrome strings via Prague overlay pipeline |
| **2. Blocks** | Block type registry (schemas, validators, renderers) | `prague/src/blocks/`, `prague/content/allowlists/` | Part of Pages build | N/A (code) |
| **3. Content** | Widget marketing copy (blocks[].copy in JSON) | `tokyo/widgets/*/pages/*.json` | Tokyo R2 (as overlays) | **Main overlay pipeline** |
| **4. Embeds** | Curated widget instances via Venice | Curated instances + instance overlays | Paris/Supabase + Tokyo R2 | Separate instance pipeline |

### Why Prague breaks in cloud-dev

Prague **Layers 1-3** depend on **two deploy planes**:

- **Plane A (git → Pages)**: Prague app + base content (Layers 1-2-3 base)
- **Plane B (git → R2)**: Prague overlays (Layer 3 localized ops)

If Plane A updates but Plane B doesn't, non-`en` becomes stale/missing. The root failure is any gap in enforcing Plane A ↔ Plane B sync (missing workflows, missing secrets, missing Pages env vars, or bypassing the content-release path).

---

## 2) Architecture + Tenets: the Invariants We Must Enforce

From `documentation/architecture/Tenets.md` and `documentation/architecture/Overview.md`:

### Invariant A — Atomicity (Content Release)
Prague Pages deploy is allowed **only if** the corresponding Prague overlays for this commit's content are published to Tokyo R2 (cloud-dev bucket).

### Invariant B — No Fallbacks (Visible Failures)
**Runtime behavior:** For non-`en` routes in cloud-dev, missing/stale overlays must **fail visibly** (not silently serve English).

**Implementation:**
- `PRAGUE_L10N_STRICT=1` (cloud-dev env var) makes Prague runtime fail visibly on missing/stale overlays for non-`en`.
- Prague emits deterministic headers on every request:
  - `X-Prague-Overlay-Status: applied|missing|stale|skipped`
  - `X-Prague-Overlay-Locale: <locale>`
- Missing/stale overlay in strict mode returns `424 Failed Dependency` (preferred) or `500` (acceptable).
- UX: error banner or error page (never silent English fallback).

**Why:** "Log + serve English" is a tenet violation—it makes broken deploys look healthy.

### Invariant C — Layer Independence
**Layers 1-2 (app/blocks)** can deploy without Layer 3 (overlays) if content unchanged.
**Layer 4 (embeds)** is tested post-deploy (integration check), not as a Prague deploy gate.

---

## 3) The Solution Shape (Boring, Not Clever)

We implement **three small workflows** that mirror local dev semantics and keep business logic in scripts, not YAML:

1) **Cloud-dev Workers** (infra deploy): deploy Paris + San Francisco + Tokyo Worker when their code changes
2) **Prague App Deploy** (Layers 1-2): deploy Prague Pages when app/block code changes (**no translation run**)
3) **Prague Content Release** (Layer 3): validate blocks → translate overlays → verify overlays → publish overlays → deploy Prague Pages → smoke tests

**Key principle:** App changes and content changes trigger different paths. No wasteful retranslation when only code changed.

All workflows must use:
- **`concurrency`** (serialize per environment so AI-team merges can't race/publish conflicting state)
- minimal, deterministic steps (no diff graphs, no dynamic matrices)

**Non-goal for P0:** coupling Prague deploy success to Venice health. Venice checks are post-deploy (alerts), not a deploy gate.

---

## 4) Phase 1 (P0): Cloud-dev Deploy Is Correct

### 4.1 Workflow: Cloud-dev Workers (Infra Deploy)

**File:** `.github/workflows/cloud-dev-workers.yml`

Behavior:
- Trigger on `main` pushes that touch `paris/**`, `sanfrancisco/**`, `tokyo-worker/**`, `scripts/infra/**`.
- Deploy via `wrangler` for each worker.
- Idempotent infra: ensure queues exist for cloud-dev.
- Serialize with `concurrency: group: cloud-dev-workers`.

### 4.2 Workflow: Prague App Deploy (Layers 1-2)

**File:** `.github/workflows/cloud-dev-prague-app.yml`

Trigger on `main` pushes that touch Prague app/block code (no content). In GitHub Actions, implement this with `paths` + `paths-ignore`:

- `prague/src/**`
- `prague/public/**`
- `prague/package.json`
- `prague/astro.config.mjs`
- `prague/tsconfig.json`

Paths that must *not* trigger this workflow (they require content release instead):
- `prague/content/**`
- `tokyo/widgets/**/pages/*.json`
- `config/locales.json`

Required steps (boring):

1) **Build + deploy Prague Pages** (cloud-dev):
   - `pnpm -C prague build` (includes overlay verify)
   - `wrangler pages deploy prague/dist ...` (via `pnpm -C tokyo-worker exec wrangler ...`)
2) **Smoke tests (boring):**
   - `GET https://prague-dev.pages.dev/en/widgets/faq/` returns 200 (or the canonical CNAME once wired).

Operational requirements:
- Uses shared Prague deploy serialization (`concurrency: group: cloud-dev-prague, cancel-in-progress: false`) so content releases are never canceled mid-publish.

### 4.3 Workflow: Prague Content Release (Layer 3)

**File:** `.github/workflows/cloud-dev-prague-content.yml`

Trigger on `main` pushes that change Prague content inputs (requires overlays):
- `tokyo/widgets/**/pages/*.json`
- `prague/content/**` (includes `base` and `allowlists`)
- `config/locales.json`

Required steps (in this order):

0) **Validate blocks** (fail fast on schema/layout violations):
   - `node scripts/prague-blocks/validate.mjs`
1) **Translate + verify + publish Prague overlays to Tokyo (cloud-dev R2)**:
   - `node scripts/prague-sync.mjs --publish --remote` with `TOKYO_R2_BUCKET=tokyo-assets-dev`
   - Note: `prague-sync.mjs` is the orchestrator; it runs `scripts/prague-l10n/verify.mjs` first, runs `scripts/prague-l10n/translate.mjs` only when verification fails (then re-verifies), and then publishes to R2.
4) **Build + deploy Prague Pages** (cloud-dev):
   - `pnpm -C prague build`
   - `wrangler pages deploy prague/dist ...` (via `pnpm -C tokyo-worker exec wrangler ...`)
5) **Smoke tests (marker-based, not CDN parsing):**
   - `GET https://prague-dev.pages.dev/en/widgets/faq/` returns 200.
   - `GET https://prague-dev.pages.dev/fr/widgets/faq/` returns 200.
   - Response headers include `X-Prague-Overlay-Status: applied` and `X-Prague-Overlay-Locale: fr`.

Operational requirements:
- `concurrency: group: cloud-dev-prague, cancel-in-progress: false` (content release must be atomic; never cancel mid-translation/publish)
- `PRAGUE_L10N_STRICT=1` enabled during build/runtime for cloud-dev

### 4.4 Required Runtime Glue (Must Ship Before Workflows)

These are the minimal runtime changes needed so cloud-dev is tenet-compliant and CI can test deterministically.
They are now implemented; keep this section as the contract.

**A) Strict mode support (cloud-dev)**
- Update strictness logic in `prague/src/lib/pragueL10n.ts` to treat `PRAGUE_L10N_STRICT=1` as strict (independent of `NODE_ENV`).

**B) Overlay status metadata**
- Update layered overlay application to return content + metadata:
  - `loadPraguePageContent(...)` and `loadPragueChromeStrings(...)` (or the shared internal) must return:
    - `content` (localized base)
    - `overlayStatus: applied|missing|stale|skipped`
    - `overlayLocale: <resolved-locale>`

**C) Deterministic headers (smoke-testable)**
- Every Prague page response must include:
  - `X-Prague-Overlay-Status: applied|missing|stale|skipped`
  - `X-Prague-Overlay-Locale: <locale>`
- Implement in a single place (preferred):
  - a shared route helper, or
  - an Astro middleware pattern (if available in Prague’s setup),
  so headers aren’t duplicated across routes.

**D) Typed overlay failure → 424**
- Introduce `OverlayFailureError extends Error` (or equivalent) that carries:
  - `statusCode: 424` (preferred; `500` acceptable)
  - `overlayStatus: missing|stale`
  - `overlayLocale`
- Prague route layer converts that error into:
  - status `424` (or `500`)
  - headers above
  - visible error UX (banner/page), never silent English

**E) Chrome allowlist completeness**
- Update `scripts/prague-l10n/translate.mjs` chrome logic (`translateChrome`) to use the same “expected paths” completeness check as pages:
  - allowlist change must trigger regeneration, not “file exists → skip”.

### 4.5 Cloud-dev Strict Mode (No Silent Fallbacks)

We must support an explicit strict flag for cloud-dev such that:
- non-`en` + missing/stale overlay ⇒ **visible error** (banner + non-2xx), not English.

This is not optional: it is the enforcement mechanism for “No Fallbacks” in a two-plane system.

**Precise contract (cloud-dev):**
- Env var: `PRAGUE_L10N_STRICT=1`
- If non-`en` overlay cannot be applied, Prague responds:
  - status: `424 Failed Dependency` (preferred) or `500` (acceptable)
  - header: `X-Prague-Overlay-Status: missing|stale`
  - header: `X-Prague-Overlay-Locale: <locale>`
  - UX: visible error page/banner (no silent English)

**Where this is configured:**
- **Cloudflare Pages project env vars (cloud-dev / branch `main`) must include**:
  - `PUBLIC_TOKYO_URL=https://tokyo.dev.clickeen.com`
  - `PUBLIC_PARIS_URL=https://paris.dev.clickeen.com`
  - `PUBLIC_VENICE_URL=https://venice.dev.clickeen.com`
  - `PRAGUE_L10N_STRICT=1`
- GitHub workflows should not rely on “build-time env” for runtime correctness; these are runtime values.

**Implementation surface (code):**
- `prague/src/lib/pragueL10n.ts` must read `PRAGUE_L10N_STRICT` (in addition to `NODE_ENV`) to decide strictness in cloud-dev.
- Prague routes must set the response headers (`X-Prague-Overlay-Status`, `X-Prague-Overlay-Locale`) on every request (Astro route handlers or a central middleware pattern).

---

## 5) Phase 2 (P1): Complete Surface Parity (Bob/Venice + Tokyo Assets)

After cloud-dev Prague is reliable:

1) **Bob & Venice Pages deploy** (separate workflows; same two-path pattern: app deploy vs content deploy)
2) **Tokyo assets sync** (Dieter + widget assets) to R2/CDN when those paths change
3) **Preview deployments** (PR URLs) if AI-team merge velocity creates serialization bottleneck

Non-goal for P1: custom dashboards or large orchestration frameworks.

---

## 6) Phase 3 (P2): Operational Excellence (Only After P0 Works)

These are leverage once the invariant is enforced:

- **Rollback** (atomic rollback story across Prague Pages + relevant overlay publish set)
- **Deployment dashboard** (single view: SHA per service + overlay publish timestamp + smoke status)
- **Production promotion** (separate workflows for prod envs with integration test gates)

---

## 7) Required Secrets & Configuration

### 7.1 Cloudflare Prerequisites Checklist (Must Be True Before First Run)

Cloud-dev resources must exist and be correctly named/bound before CI can deploy:

- Cloudflare Pages project exists for Prague (project name used by `wrangler pages deploy`).
- Tokyo R2 bucket exists: `tokyo-assets-dev` (or update the plan to the canonical bucket name).
- Cloud-dev Workers exist and can deploy via CI tokens:
  - Paris
  - San Francisco
  - Tokyo Worker
- Cloudflare Pages env vars are set for Prague (cloud-dev / branch `main`):
  - `PUBLIC_TOKYO_URL=https://tokyo.dev.clickeen.com`
  - `PUBLIC_PARIS_URL=https://paris.dev.clickeen.com`
  - `PUBLIC_VENICE_URL=https://venice.dev.clickeen.com`
  - `PRAGUE_L10N_STRICT=1`

### GitHub Secrets (repo level)

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `SANFRANCISCO_BASE_URL` (cloud-dev)
- `PARIS_DEV_JWT` (dev auth used by SF translation endpoint)

### Cloud-dev URLs (constants used by workflows)

- `PUBLIC_TOKYO_URL=https://tokyo.dev.clickeen.com`
- `PUBLIC_PARIS_URL=https://paris.dev.clickeen.com`
- `PUBLIC_VENICE_URL=https://venice.dev.clickeen.com`
- `TOKYO_R2_BUCKET=tokyo-assets-dev`

---

## 8) Success Criteria (P0)

**App Deploy Path:**
- Push to `main` (Prague code changes) ⇒ Pages deployed ⇒ /en/ smoke tests pass
- No wasteful translation triggered

**Content Release Path:**
- Push to `main` (JSON/allowlist changes) ⇒ overlays published to Tokyo R2 ⇒ Pages deployed ⇒ /en/ + /fr/ smoke tests pass
- Smoke tests verify `X-Prague-Overlay-Status: applied` and `X-Prague-Overlay-Locale: fr`

**Strict Mode Enforcement:**
- Non-`en` routes in cloud-dev with missing overlays return 424 (or 500) with error page + headers
- No silent English fallback

**Venice Integration:**
- Post-deploy tests verify Venice embed reachability (alerts if broken, doesn't block Prague)

---

## 9) Peer Review Answers (Gate for 02-Executing)

1) **Elegant + scalable:** two-path Prague release (app vs content) + deterministic overlays; no bespoke CI framework.  
2) **Tenet compliant:** atomic overlay publish gate + strict no-fallback behavior in cloud-dev.  
3) **Not over-architected:** minimal workflows + minimal smoke tests (header markers, not CDN parsing).  
4) **Moves toward goals:** makes cloud-dev “push to main” deterministic and operable by AI teams with zero human coordination.

---

## 10) Rollback Caveat (P0 Reality)

Prague overlays are fingerprinted, but the Prague `index.json` uses `lastPublishedFingerprint` per locale.

**Implication:** rolling back Prague Pages to an older SHA may require a coordinated overlay republish for that SHA (or future index versioning), otherwise overlays can be treated as stale in strict mode.
