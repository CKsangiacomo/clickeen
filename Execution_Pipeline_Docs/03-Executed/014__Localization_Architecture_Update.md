# Localization Architecture Review (Scale + Cost + Elegance)

Status: Executed / superseded. Architecture changes landed; this doc is historical analysis.
Source of truth: `documentation/` and `Execution_Pipeline_Docs/03-Executed/033__PRD__07-14_Remaining_Work_Closeout.md`.

**Repo:** CKsangiacomo/clickeen (snapshot referenced by code citations in chat)  
**Focus:** i18n + l10n architecture, scaling to millions of overlays, cost/operability, and “elegant engineering” assessment.

---

## 1) Current architecture (what you built)
### 1.1 Core contract (good)
- **Locale is a runtime parameter** and is **not** encoded into instance identity (`publicId`) to avoid ID fan-out.  
- Instance content localization uses **set-only ops overlays** applied at runtime on top of a single canonical base config (“no DB fan-out of full localized configs”).

### 1.2 Two parallel systems
1) **i18n catalogs** (UI/chrome labels)
   - Tokyo-hosted hashed bundles + a manifest indirection layer.
2) **l10n overlays** (instance config/content)
   - Canonical overlays stored in Supabase (`widget_instance_locales`), materialized to Tokyo/R2 as cacheable overlay files.
   - Venice applies overlays at render time based on request locale and a staleness guard.

### 1.3 Shipped runtime flow (instances)
1) Paris stores instance base config (single per publicId).
2) Paris enqueues l10n generation jobs on publish/update.
3) San Francisco generates agent ops (set-only) for locales (curated: all locales; user: selected locales by entitlements).
4) Paris stores overlays in Supabase.
5) Tokyo-worker publishes overlays to Tokyo/R2 and updates the l10n indirection map.
6) Venice fetches base config from Paris, then applies overlay before bootstrapping `window.CK_WIDGET.state`.

### 1.4 Why the overlay model is conceptually elegant
- One base config + overlays avoids “full localized config” duplication.
- Set-only ops are safe by construction (no structural drift).
- `baseFingerprint` is a universal staleness guard across both pages and instances.

---

## 2) Scaling reality: where “millions of JSON” becomes painful
It is not the *existence* of millions of overlay objects that will hurt you; object storage can handle many objects.

The scaling killers in the current implementation are:
1) **A monolithic global manifest** (`tokyo/l10n/manifest.json`) that contains entries for every localized instance and locale.
2) **A full-table daily republish cron** in tokyo-worker that scans all locale rows and republishes all artifacts.
3) **Venice’s fetch + caching behavior** that disables caching at the network layer and caches the manifest indefinitely in memory.

These three create a path where cost and operational complexity explode at scale.

---

## 3) The non-scalable parts (clear diagnosis)
### 3.1 Global manifest is a hard ceiling
Both Venice and tokyo-worker assume a single manifest object with shape:
`instances: Record<publicId, Record<locale, {file,...}>>`.

- tokyo-worker reads and rewrites that single JSON blob on each publish.
- Venice loads that same blob to resolve which overlay file to fetch.

At millions of localized instances, this is guaranteed to exceed:
- practical file size limits,
- worker memory limits,
- update contention limits (race conditions),
- and request latency budgets.

### 3.2 Daily cron republish is not viable at scale
tokyo-worker’s scheduled job currently iterates *all* `widget_instance_locales` rows and republishes them.
That approach becomes infeasible at millions of overlays (read amplification + write amplification), regardless of R2 “cheap storage.”

### 3.3 Venice disables caching, then caches forever
- `tokyoFetch()` uses `cache: 'no-store'` universally.
- `venice/lib/l10n.ts` caches the manifest Promise forever in a Map without TTL or revalidation.

This creates a bad combination:
- high request volume to Tokyo for assets/overlays,
- and stale manifest behavior that won’t observe updates reliably.

---

## 4) Cost model (where you’ll actually pay)
### 4.1 Translation cost vs storage cost
- The largest “per instance” spend is translation tokens (agents), not storage.
- Storage cost scales with: `#overlays * avgOverlaySize`.
- Operational cost scales with: `#publishes * (manifest rewrite + R2 list/delete + DB reads)` and `#renders * (manifest fetch + overlay fetch)`.

### 4.2 Hidden multipliers in the current design
- Each publish triggers: DB read + R2 PUT + R2 LIST+DELETE + manifest read/parse + manifest write.
- Each Venice render triggers: Tokyo fetch (manifest/overlay) and CPU work to fingerprint + apply ops.

At “millions,” the manifest and cron dominate your pain.

---

## 5) Recommended design upgrades (keep the contract, fix scale)
### Option A (best, chosen): Make overlay addressing deterministic → eliminate manifest entirely
Your overlay already includes `baseFingerprint` and Venice already computes it.
Leverage that to address the overlay file directly.

**New key design**
- `tokyo/l10n/instances/<publicId>/<locale>/<baseFingerprint>.ops.json`
  - or: `<locale>.<sha8(baseFingerprint + policyVersion)>.ops.json` for stable revisions.

**Benefits**
- No global manifest.
- No per-publish manifest rewrite.
- Venice can fetch overlay directly using (publicId, locale, baseFingerprint).
- Caching becomes trivial: baseFingerprint implies immutability per base version.

**Trade-off**
- If you need multiple translations for the same base, add a `translationVersion` or `policyVersion` suffix.
- V1 chooses baseFingerprint-only keys (overwrite on re-translate).

### Option B (good, not chosen): Shard the manifest (per instance or by prefix)
If you want to keep hash-based filenames:
- Replace `tokyo/l10n/manifest.json` with either:
  - `tokyo/l10n/instances/<publicId>/manifest.json`, or
  - `tokyo/l10n/manifests/<prefix>.json` (e.g., first 2–3 chars of a hash/publicId).

**Benefits**
- Updates touch small manifests (and only for affected instances).
- Venice reads only the shard it needs, not a global blob.
- Avoids catastrophic memory/latency blowups.

**Trade-off**
- More files and more logic, but far less than global-manifest risk.

### Remove/replace the daily republish cron
Replace the scheduled “republish everything” with one of:
- A repair job that only republishes rows updated in the last N hours.
- A repair job that consumes a “dirty set” keyed by `(publicId, locale)`.
- A periodic manifest validation + sampling approach (not full rewrite).

### Fix Venice caching strategy
- Parameterize `tokyoFetch` so overlays and widget assets can use caching appropriate to their headers (immutable files should be cached aggressively).
- Remove the indefinite in-memory manifest cache, or add TTL-based invalidation aligned to the manifest cache-control.
- If you shard or remove the manifest, this becomes simpler and safer.

### Store instance `baseFingerprint` in Paris (performance win)
Right now, Venice computes `computeBaseFingerprint(instance.config)` at runtime.
If Paris returns `baseFingerprint` with the instance snapshot (computed on update/publish), Venice can:
- avoid computing fingerprints on every request,
- use the fingerprint both for staleness checks and deterministic overlay keying.

---

## 6) Is the architecture “elegant engineering”? (verdict)
### The contract is elegant
- Locale-free identity, overlay ops, staleness guards, allowlists, and user overrides are all strong primitives.

### The implementation is not yet scalable
- A single global l10n manifest and a full-table daily republish are “prototype-level” mechanisms that will not survive real scale.

### Recommendation
Preserve the overlay contract, but refactor:
1) remove/shard the manifest,
2) remove the daily republish scan,
3) fix Venice caching + fingerprint strategy.

This will turn the design into genuinely elegant, scalable engineering.

---

## 7) Concrete next steps (Codex-ready)
1) Lock Option A: deterministic overlay keys, no manifest.
2) Update tokyo-worker publish path:
   - write overlay artifact to `l10n/instances/<publicId>/<locale>/<baseFingerprint>.ops.json`
   - insert/update overlay rows; no manifest writes
3) Update Paris instance response to include `baseFingerprint` (computed on publish/update).
4) Update Venice `applyTokyoInstanceOverlay`:
   - read `baseFingerprint` from Paris response
   - fetch overlay directly by deterministic key
5) Delete the scheduled “republish everything” logic and replace with incremental repair.
6) Update docs (`documentation/capabilities/localization.md`, `documentation/services/venice.md`, `documentation/services/tokyo-worker.md`) to match runtime truth.

---
