# PRD 44 — Curated Publish Freshness + L10n Fanout Control (DevStudio ↔ Prague ↔ Venice)

**Status:** EXECUTED  
**Date:** 2026-02-09  
**Executed:** 2026-02-10  
**Owner:** Product Dev Team (Platform + DevStudio + Runtime)  
**Type:** Infra/architecture hardening + DevStudio UX additions  
**User-facing change:** Faster, predictable “updates everywhere” + l10n cost bounded by design  

---

## 0) As-built execution record (authoritative)

Delivered outcomes:
- Curated snapshot freshness control is shipped via DevStudio action + Paris endpoint:
  - `POST /api/workspaces/:workspaceId/instances/:publicId/render-snapshot?subject=devstudio`
- Curated/user l10n fanout uses workspace active locales (`workspaces.l10n_locales`) instead of `SUPPORTED_LOCALES` defaults.
- DevStudio ships explicit locale enqueue action:
  - `POST /api/workspaces/:workspaceId/instances/:publicId/l10n/enqueue-selected?subject=devstudio`
- Publish-status now exposes finite pipeline buckets/reasons (`inFlight`, `retrying`, `failedTerminal`, `needsEnqueue`, `stageReasons`, `nextAction`) for non-blackbox debugging.

Execution nuance (important):
- Curated published saves/updates still auto-enqueue l10n in Paris.
- The explicit DevStudio “Translate locales” action is additive (used for immediate/manual enqueue and no-diff backfill).

If any legacy planning text below conflicts with runtime, this execution record + runtime code wins.

---

## 0) Summary

We have two connected P0 problems that are currently undermining the product promise:

1) **Curated instances edited in DevStudio don’t reliably/quickly update Prague** (even in local dev).  
2) **Curated instances trigger “translate everything” behavior (29 locales) on small edits**, which causes:
   - “Retrying” loops (queue backlog / failures)
   - unnecessary cost
   - unusable iteration speed

The fix must preserve Cloudflare “cached greatness”:
- immutable, fingerprinted artifacts
- edge-cached, globally fast embed runtime
- predictable update propagation via **publish/refresh of pointers**, not “live DB reads”

This PRD introduces a small but foundational publish/refresh control plane for curated templates:
- a **DevStudio “Refresh Prague preview”** action that regenerates render snapshots deterministically
- a **curated l10n policy** that uses **entitlement-derived active locales + explicit actions** (no automatic 29-locale fanout; explicit enqueue controls for fast/manual refresh)
- improved failure visibility so we stop “shooting ourselves in the foot”

---

## 1) Why this matters (Product promise + infra reality)

### 1.1 The promise we’re making
For users, we promise: **“Update your widget and it updates almost instantly everywhere.”**

That implies:
- a single canonical widget runtime (Venice) that everyone embeds
- published output is globally cacheable and stable
- changes propagate via a controlled publish pipeline (not by turning off caching)

### 1.2 What’s currently happening (why it feels broken)

#### A) Prague freshness breaks (curated)
Prague embeds curated instances through Venice’s public embed path (`/e/:publicId`).  
Venice is **snapshot-first** and serves pre-rendered artifacts when available.

Today, curated edits often **don’t regenerate the snapshot artifacts**, so Venice keeps serving old snapshots.  
Even when snapshots *do* update, our current cache TTLs can make it feel “stuck”.

Key references:
- Prague embeds Venice snapshot path: `prague/src/components/CuratedInstanceEmbed.astro`
- Venice snapshot-first behavior: `venice/app/e/[publicId]/route.ts`
- Snapshot pointer index: `venice/lib/render-snapshot.ts` → `renders/instances/:publicId/index.json`
- Snapshot generation + index update: `tokyo-worker/src/index.ts` (`render-snapshot` jobs + `/renders/instances/:publicId/snapshot`)

#### B) “Retranslate 29 locales” on small edits (curated)
Curated instances currently treat “locales to manage” as **all supported locales** (29 from `config/locales.json`) and this is reflected in:
- l10n status (`3/29 updated`)
- l10n enqueue behavior on edits

This is a systemic scalability bug:
- cost scales as **edits × instances × locales**
- queues/backoff cause “Retrying” status and slow iteration
- it will either **bankrupt us** (if unbounded) or **break UX** (if we enforce caps too aggressively)

Key references:
- curated uses `SUPPORTED_LOCALES` (29): `paris/src/domains/l10n/index.ts` (curated branch)
- supported locales list size: `config/locales.json`
- DevStudio surfaces the summary (no details): `admin/src/html/tools/dev-widget-workspace.html`

---

## 2) Non‑negotiables (Architecture + Tenets)

1) **Cloudflare cached greatness stays.**
   - No “disable caching” or “always hit Supabase” as a fix.
   - Heavy artifacts stay immutable + long-cache.
   - Freshness comes from regenerating artifacts + flipping pointers.

2) **Widget folder is truth.**
   - No Prague/Venice widget-specific hacks to paper over stale templates.

3) **Bounded work by default.**
   - No implicit “translate 29 locales” on every edit.
   - “All languages” is an explicit, intentional operation.

4) **Fail visibly.**
   - “Retrying” must explain *what failed* and *why*, not hide the root cause.

---

## 3) Goals / Non‑Goals

### 3.1 Goals

**G1 — Deterministic Prague refresh (curated):**
- From DevStudio, we can force “what Prague shows” to update **predictably**.
- Works in **local** and **cloud-dev** without hand-editing instances or clearing caches.

**G2 — Curated l10n is selective + explicit:**
- Curated instances do **not** implicitly adopt `SUPPORTED_LOCALES` as their “active” locales.
- DevStudio uses a smaller, meaningful set of **active locales** (derived from workspace entitlements / defaults), and provides explicit actions:
  - Generate/refresh active locales (manual)
  - (optional) Generate “all languages” as a deliberate operation

**G3 — Freshness SLA while preserving caching:**
- Define and meet an SLA:
  - **Local:** Prague reflects a refresh within ~10–30s.
  - **Cloud-dev/GA:** embed updates propagate within **≤ 60s** under normal conditions.

### 3.2 Non‑Goals (explicitly out of scope)
- Rewriting the embed architecture (Venice stays snapshot-first).
- Adding i18n product UX end-to-end (we’re touching l10n infra + DevStudio tooling only).
- Introducing new Dieter primitives.
- “Perfect” translation quality tuning (that’s agent/prompt work; we’re fixing infra + control plane).

---

## 4) System model (what we’re building on)

### 4.1 The intended cache architecture (already present — we will lean into it)

Artifacts are immutable and fingerprinted:
```
renders/instances/:publicId/:fingerprint/e.html
renders/instances/:publicId/:fingerprint/r.json
renders/instances/:publicId/:fingerprint/meta.json
```

There is a lightweight pointer/manifest:
```
renders/instances/:publicId/index.json
  current[locale] = { e, r, meta }  // fingerprints
```

Venice uses the index to load the correct immutable artifact and serves it with an ETag of the fingerprint.

**This is exactly how we preserve cached greatness:** big bytes are immutable; small pointers flip.

### 4.2 Where the current design breaks down

- Curated edit paths do not provide a reliable “refresh snapshot” step, so the pointer (`index.json`) is stale.
- Curated l10n uses `SUPPORTED_LOCALES` as “active” locales, so the system *attempts* 29-locale generation.

---

## 5) Proposed solution (high level)

### 5.1 “Refresh Prague preview” = regenerate snapshot (curated)
Add a DevStudio action that triggers a render snapshot regeneration for the current curated publicId.

Implementation principle:
- It regenerates the **English (`en`) snapshot by default**.
- It does **not** require curated status to be `published` (curated status is not a user gating concept).

Why `en` only:
- Prague’s primary experience is English-first.
- Non-en snapshots should only appear when l10n overlays exist (and are published), which Tokyo Worker already supports.

### 5.2 Fix curated l10n fanout (29 → active + explicit)
Change curated locale handling to match how a scalable product must behave:

#### Key clarification: “available” vs “active”
Policy/tier defines what locales are **available/allowed**; runtime needs a concrete **active** locale set to decide what work to do.

We will keep this simple and automatic:
- Curated instances use the **workspace active locale set** (`workspaces.l10n_locales`) as their default fanout.
- That active locale set is **not chosen per-translation**; it is part of the workspace’s entitlement/config state (DevStudio/admin can set it; product UX will set it on upgrade/onboarding).
- DevStudio/admin can still run an explicit “all languages” operation when needed.

#### Behavioral rules
- Curated instances do **not** default to `SUPPORTED_LOCALES` (29) for every operation.
- “All supported locales” is an explicit operation (DevStudio button), not a default.
- Status endpoints and DevStudio display are based on the **active** locale set.
- Curated translation supports both:
  - auto-enqueue on published save/update (runtime default),
  - explicit DevStudio enqueue action for immediate/manual refresh and no-diff backfill.

### 5.3 Improve freshness without killing caching
We keep caching, but tune pointer/response TTLs to match the SLA:

- Reduce cache TTLs for:
  - `renders/instances/:publicId/index.json` (pointer)
  - Venice `/e/:publicId` + `/r/:publicId` snapshot responses (publicId path)

Rationale:
- Immutable artifacts are already long-cache (`immutable`).
- The pointer and the publicId route are where “staleness” exists; those should be short-cache.

---

## 6) Detailed execution plan

### 6.0 Preflight (local vs cloud-dev clarity)
We will validate in **local dev** first (canonical startup: `scripts/dev-up.sh`).

Local services involved:
- Paris: `http://localhost:3001`
- Tokyo Worker: `http://localhost:8791`
- Venice: `http://localhost:3003`
- Prague: `http://localhost:4321`
- DevStudio: `http://localhost:5173`

Verification commands (local):
- `node scripts/compile-all-widgets.mjs`
- `node scripts/[retired]/validate-sdr-allowlists`

### 6.1 DevStudio: add “Refresh Prague preview”
**File:** `admin/src/html/tools/dev-widget-workspace.html`

Add a new Superadmin action:
- Label: **Refresh Prague preview**
- Behavior:
  - Calls a new Paris dev-auth endpoint to enqueue a render snapshot regen for `publicId` with locales `['en']`.
  - Shows success/failure toast (or `alert()` for v1 parity with existing actions).
  - After completion, reminds user: “Reload Prague section” (local dev uses `ts` already; should update quickly).

### 6.2 Paris: endpoint to enqueue render snapshot regen (curated-safe)
**Add endpoint:** `POST /api/workspaces/:workspaceId/instances/:publicId/render-snapshot`

Rules:
- **Dev-auth required** (same mechanism as other workspace endpoints).
- Default locales: `['en']` unless explicitly provided.
- For curated, allow regeneration regardless of instance.status (status not a gate).
- Enqueue via `RENDER_SNAPSHOT_QUEUE` to Tokyo Worker (`RenderSnapshotQueueJob`).

Why Paris owns this:
- DevStudio already talks to Paris (via Bob proxy).
- Queue binding lives in Paris; Tokyo Worker consumes.
- Keeps control plane centralized (policy/budgets can live here if needed).

Related hardening (P0):
- Ensure any “default locale list” used for curated snapshot jobs is **not** `SUPPORTED_LOCALES`.
  - Curated snapshot regen default should be `['en']` (other locales are regenerated when their overlays publish).

### 6.3 Tokyo Worker: no change required (already supports this)
Tokyo Worker already:
- Consumes `render-snapshot` queue jobs and regenerates artifacts + `index.json`.
- Exposes dev-auth endpoint `POST /renders/instances/:publicId/snapshot` (useful for debugging).

### 6.4 Paris l10n: curated locales become “active”, not “SUPPORTED”
**Files:** `paris/src/domains/l10n/index.ts`, `paris/src/domains/workspaces/index.ts`

Change locale resolution for curated in:
- `handleWorkspaceInstanceL10nStatus`
- `enqueueL10nJobs`

New rule:
- Curated uses the workspace **active locales** (`workspace.l10n_locales`) and never auto-expands to `SUPPORTED_LOCALES`.
- `en` is *not* considered a translation target (it is the base content).

Rollout note:
- In cloud-dev/GA, the Clickeen marketing workspace should have a sane default active locale set (e.g. 3–5 locales) configured once.
- In DevStudio (`subject=devstudio`), there is **no runtime locale fallback**. DevStudio runs against the deterministic `ck-dev` workspace (tier3), which should be explicitly seeded with all supported locales in `workspaces.l10n_locales` (non‑EN; EN implied). If it’s empty, translations are correctly “Off” and DevStudio must surface that as a configuration bug (fail visibly).
- In user workspaces, an empty active locale set means l10n is effectively “Off” (status returns empty list) until the user’s tier/config enables locales.

Behavioral change (P0):
- **Keep curated fanout bounded to active locales** in the workspace instance update flow.
  - Curated translation remains auto-enqueued on published saves/updates, and DevStudio manual enqueue remains available for operator control.

Explicit actions (P0/P1):
- (P0) Add a dev-auth endpoint to enqueue **active locales** for curated (endpoint name kept for compatibility):
  - `POST /api/workspaces/:workspaceId/instances/:publicId/l10n/enqueue-selected`
  - If a locale is active but missing/failed, this endpoint must still queue work even when the base snapshot diff is empty (backfill initial overlays; avoid “queued:0” confusion).
- (P1) Add a dev-auth endpoint to enqueue “all supported locales” for curated:
  - `POST /api/workspaces/:workspaceId/instances/:publicId/l10n/enqueue-all`
  - Requires explicit confirmation UI + a budget check (log-only in local/cloud-dev; enforce in GA).

Reliability hardening (P0):
- Reduce “Execution timeout exceeded” loops by keeping the `l10n.instance.v1` prompt compact and allowing enough wall time for provider latency within grant budgets.
  - File: `sanfrancisco/src/agents/l10nInstance.ts`

### 6.5 DevStudio l10n UX: stop hiding the root cause (P1)
**File:** `admin/src/html/tools/dev-widget-workspace.html`

Current state:
- A single summary line shows “Retrying” but not *why*.

Improve:
- When status is `Retrying`, show:
  - last error of the first failed locale
  - a “Retry failed” button that calls a new Paris endpoint to requeue failed locales
- Add explicit “Translate locales” (P0) and “Translate all languages” (P1) buttons for curated instances.

This makes failure visible and reduces “stuck in sand” iteration.

### 6.6 Venice/Tokyo cache tuning (freshness SLA)
**Files:**
- `tokyo-worker/src/index.ts` (render index cache-control)
- `venice/lib/tokyo.ts` (render index revalidate)
- `venice/app/e/[publicId]/route.ts` and `venice/app/r/[publicId]/route.ts` (snapshot response cache-control)

Changes:
1) Reduce `renders/instances/:publicId/index.json` TTL (pointer) to ~60s.
2) Reduce Venice snapshot response TTL on `/e/:publicId` and `/r/:publicId` to ~60s `s-maxage`.

This preserves caching, but ensures published updates propagate in ~1 minute without purges.

---

## 7) Acceptance criteria (what “done” means)

### 7.1 Curated Prague freshness
- In **local dev**, after editing a curated instance in DevStudio and pressing **Refresh Prague preview**:
  - Prague’s embedded curated instance changes within ~10–30s.

- In **cloud-dev**, same behavior:
  - change propagates within ≤ 60s.

### 7.2 Curated l10n fanout eliminated
- Editing a curated instance does **not** cause DevStudio to show `…/29 updated` by default.
- The l10n status count reflects **active locales only** (workspace + DevStudio defaults).
- “Retrying” state becomes actionable (shows an error + offers retry).
- Curated translation runs **only** when explicitly triggered (active/all), never implicitly on edit.

### 7.3 Caching preserved
- Render artifacts remain immutable + long-cache (`immutable`).
- Only pointer/response TTLs are reduced (no-store is not the default for prod).

---

## 8) Risks + mitigations

### R1) Active locales might be empty (workspace config)
Mitigation:
- Seed `ck-dev` (DevStudio) with all supported locales in `workspaces.l10n_locales` (no runtime fallback).
- Marketing workspace should configure `workspaces.l10n_locales` once in cloud-dev/GA so Prague/curated pages don’t appear to “support translations” but remain Off.

### R2) Lower TTL increases Venice request volume
Mitigation:
- Heavy work is already offloaded to Tokyo immutable artifacts; Venice mostly serves cached bytes.
- We can tune TTL after measuring, but 60s is a safe starting point.

### R3) Manual refresh button gets spammed
Mitigation:
- Optional budget consumption in Paris (log-only in local/cloud-dev; enforce in GA if needed).

---

## 9) Verification plan (local)

1) Run local stack: `bash scripts/dev-up.sh`
2) In DevStudio, select a curated instance (e.g. `wgt_curated_faq.lightblurs.v01`)
3) Make a visible change in Bob editor, update curated instance
4) Click **Refresh Prague preview**
5) Open Prague page and confirm change is visible without manual cache-clearing
6) Confirm l10n status:
   - no 29-locale fanout by default
   - failures show lastError + retry path

---

## 10) Decisions (resolved in execution)

1) **SLA target:** short-pointer freshness with snapshot regeneration (no cache purge strategy required for v1).
2) **Curated locale selection source:** workspace active locales (`workspaces.l10n_locales`) with EN implied.
3) **Curated translation trigger model:** auto-enqueue on published save/update + explicit DevStudio enqueue action for manual/backfill control.
