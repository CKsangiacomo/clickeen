# Localization (i18n + l10n) — Phase 1 Contract

This document defines how Clickeen handles language and localization across:
- Prague (marketing site strings)
- Bob (editor UI + instance content)
- Venice (embed runtime)
- Tokyo (software plane CDN)
- Michael (database)
- San Francisco (translation agents)

## Core principle

- **Locale is a runtime parameter.**
- **Locale is not identity.** We never encode locale into `publicId`.

This prevents “fan-out” (e.g. `wgt_curated_... .fr/.de/.es`) and keeps caching + ownership clean.

## Canonical locale registry (shared)

`config/locales.json` is the canonical registry of supported locale tokens **and** how to label them in different UI languages.

- Use `code` as the locale token everywhere (lowercase BCP47-ish like `fr-ca`, `zh-hans`).
- For locale pickers, always render locale names using `labels[uiLocale]` (not `nativeLabel`) so an English UI user does not see Chinese/Arabic script in the picker.
- Use `@clickeen/l10n` helpers (e.g. `normalizeLocaleToken`, `normalizeCanonicalLocalesFile`, `resolveLocaleLabel`) instead of ad-hoc parsing (`split('-')[0]` is forbidden).

## Instance kinds + entitlement gating (Phase 1)

### Instance kinds (authoritative)
- **Curated**: Clickeen-owned instances used for Prague embeds and template pickers.
- **User**: Workspace-owned instances created by users (often by cloning curated).

Curated + user instances localize within the workspace’s **active locales** (EN implied), bounded by tier entitlements and subject policy.
- **User instances** auto-enqueue l10n on publish/update (for the active locales set).
- **Curated instances** do **not** auto-enqueue; DevStudio tooling triggers l10n generation explicitly (still targeting the active locales set).

### Entitlement + active locales model
Effective localization = **entitlements** ∩ **subject policy** ∩ **workspace active locales**.

- Entitlement keys:
  - `l10n.locales.max` (cap; total locales including EN)
  - `l10n.locales.custom.max` (cap; how many non‑EN locales the user can choose)
  - `l10n.versions.max` (cap; retained overlay versions)
- Tier rules (v1; executed):
  - Minibob: EN only (0 additional locales)
  - Free: EN + 1 system-chosen locale (no picker)
  - Tier1: EN + 3 user-selected locales (total = 4)
  - Tier2+: unlimited locales
  - DevStudio: uncapped
- Workspace active locales source: `workspaces.l10n_locales` (JSON array of **non‑EN** locales; EN is implied)

## Localization systems (runtime)

### `i18n` (catalogs for UI strings)

Use `i18n` when the surface is UI chrome / labels:
- Bob editor chrome (`coreui.*`)
- Widget UI string bundles (`{widgetName}.*`), when applicable

**Tokyo output**
- `tokyo/i18n/manifest.json`
- `tokyo/i18n/{locale}/{bundle}.{hash}.json`

Rule: catalogs are content-hashed and cacheable; the manifest is the indirection layer.

### `l10n` (overlays for instance config/content)

Use `l10n` when the surface is “content inside an instance config” (copy, headings, CTA labels, etc.).

**Tokyo output (layered)**
- `tokyo/l10n/instances/<publicId>/<layer>/<layerKey>/<baseFingerprint>.ops.json`
- `tokyo/l10n/instances/<publicId>/index.json` (layer keys + optional geoTargets for locale selection)
- `tokyo/l10n/instances/<publicId>/bases/<baseFingerprint>.snapshot.json` (allowlist snapshot values for safe stale apply)

Rule: overlays are **set-only ops** applied on top of the base instance config at runtime.
Rule: `baseFingerprint` is computed from the **allowlist snapshot** (translatable fields only), not the full config.

#### Why you see many locale files changing locally (expected)
Two things happen when you run builds locally (`pnpm build` / `pnpm build:l10n`) or when CI publishes:

- `l10n/instances/**` is the **repo-tracked overlay source** for curated/main instances (human/agent-curated outputs).
- `tokyo/l10n/**` is the **deterministic build output** (what Venice/Prague consume locally and what gets uploaded to Tokyo/R2).

When the instance allowlist snapshot changes (new copy path, removed path, etc.), the `baseFingerprint` changes. That causes:
- New `*.ops.json` files to appear under a new fingerprint directory.
- Old fingerprint files to be deleted as stale.

This is not “manual editing of locales” — it’s the expected artifact regeneration. Commit these changes together with the source widget/content changes.

**Generation (current)**
- Paris enqueues localization jobs on publish/update.
- Paris builds a translatable snapshot from the widget allowlist and stores it in `l10n_base_snapshots`.
- Paris diffs snapshots to compute `changedPaths` + `removedPaths`, and enqueues jobs with only the deltas.
- Paris tracks generation state in `l10n_generate_state` (keyed by `publicId + layer + layerKey + baseFingerprint`) and schedules retries; jobs never hard-fail.
- San Francisco runs the localization agent, translating only `changedPaths`, removing `removedPaths`, and emitting set-only ops.
- San Francisco reports job status back to Paris via `POST /api/l10n/jobs/report` (`running | succeeded | failed | superseded`).
- Paris stores overlays in Supabase (`widget_instance_overlays`, layer + layer_key).
- Paris rebases user overrides onto the new snapshot fingerprint (drops removed paths, keeps valid overrides).
- Paris marks `l10n_publish_state` as dirty and enqueues publish jobs.
- Tokyo-worker materializes overlays into Tokyo/R2 using deterministic paths (no global manifest) and writes `index.json` for locale selection.
- Venice applies the **best available** overlay at render time:
  - **fresh:** `overlay.baseFingerprint` matches the current base
  - **stale:** may apply the last published overlay ops **selectively** when safe (see staleness guard)

**Widget allowlist (authoritative)**
- Locale layer allowlist: `tokyo/widgets/{widgetType}/localization.json`
- Non-locale layer allowlists: `tokyo/widgets/{widgetType}/layers/{layer}.allowlist.json` (404 = no allowed paths)
- Agents must not mutate paths outside the relevant allowlist.

**Canonical store (Supabase)**
- `widget_instance_overlays` is the layered source of truth for instance overlays.
- `ops` = layer overlay ops (agent/system/base).
- `user_ops` = manual overrides for layer=user only (set-only ops), merged last for the user layer.
- Tokyo overlay files contain merged ops for layer=user (`ops + user_ops`); other layers use `ops` only.
- `l10n_overlay_versions` is the version ledger used for cleanup and future rollbacks.
- Tokyo-worker prunes versions using the `l10n.versions.max` entitlement cap.
- `geo_targets` scopes locale selection only (fr vs fr-CA); geo overrides live in the geo layer.

### Prague localization (system-owned, Babel-aligned)

Use Prague page JSON base copy + Tokyo overlays for **Clickeen-owned website copy** (Prague pages). Chrome UI strings remain in `prague/content/base/v1/chrome.json`. This mirrors instance l10n semantics with deterministic overlay keys and no manifest.

**Filesystem layout**
- Base copy: `tokyo/widgets/*/pages/*.json`
- Chrome base: `prague/content/base/v1/chrome.json`
- Allowlists: `prague/content/allowlists/v1/**`
- Overlays: `tokyo/l10n/prague/{pageId}/{layer}/{layerKey}/{baseFingerprint}.ops.json` (locale layer only in Phase 1)

**Pipeline**
- Translation is done by San Francisco via `POST /v1/l10n/translate` (local + cloud-dev; requires `PARIS_DEV_JWT`).
- Provider: OpenAI for Prague strings (system-owned); instance l10n agents follow the **Tiered AI Profile** (DeepSeek for Free, OpenAI/Anthropic for Paid).
- `scripts/prague-l10n/translate.mjs` calls San Francisco and writes overlay ops into `tokyo/l10n/prague/**`.
- `scripts/prague-l10n/verify.mjs` validates allowlists + overlay paths.
  - Default mode is **best-available**: it validates the currently published overlay fingerprints (from `index.json`) and will **warn** on missing locales instead of blocking builds.
  - Strict mode is `node scripts/prague-l10n/verify.mjs --strict-latest` (or `PRAGUE_L10N_VERIFY_STRICT=1`) and enforces “latest base fingerprint translated for all locales”.
- `scripts/prague-sync.mjs` is the orchestrator used by CI: verify → (translate only if needed) → publish to Tokyo/R2.
  - To publish, pass `--publish` with an explicit target:
    - `--remote` in cloud-dev/prod (writes to Cloudflare R2)
    - `--local` in local dev (writes to Wrangler local R2)
- Prague loads page JSON base copy and applies overlays at runtime via Tokyo fetch.
  - Runtime fetches are versioned for cache determinism:
    - cloud-dev/prod: `${PUBLIC_TOKYO_URL}/l10n/v/<PUBLIC_PRAGUE_BUILD_ID>/prague/...`
    - local dev: `${PUBLIC_TOKYO_URL}/l10n/prague/...` (and the Tokyo dev server also rewrites `/l10n/v/<token>/...` → `/l10n/...` when needed)

**Strict rules**
- Overlays are set-only ops and must include `baseFingerprint`.
- Same staleness guard as instance overlays (`baseFingerprint`).
- Best-available fallback is supported:
  - Prague can apply stale overlays **safely** when the base value at a path is unchanged (using a base snapshot).

**Base snapshots (Prague)**
- `scripts/prague-l10n/translate.mjs` writes base snapshots to `tokyo/l10n/prague/{pageId}/bases/{baseFingerprint}.snapshot.json`.
- Prague uses snapshots to safely apply stale overlays when page copy changes.

## Curated embeds (Prague visuals)

Prague visuals are **curated instances** (Clickeen-owned) embedded directly by `curatedRef.publicId`.
There is exactly **one** instance row per curated embed in Michael. Locale selection happens at render time.

### Render algorithm (Phase 1)

1. Prague embeds Venice with canonical `publicId`:
   - `/e/wgt_curated_{...}?locale=...`
2. Venice loads the base instance config from Paris/Michael.
3. Venice applies Tokyo layered overlays for the request locale (locale layer + user overrides when present).
4. Venice bootstraps `window.CK_WIDGET.state` with the localized config.

**Strict rule:** `wgt_curated_*.<locale>` URLs are invalid and must 404 (no legacy support).

## Overlay format (set-only)

Manual overlay sources (dev-only, repo-local):
- `l10n/instances/<publicId>/<layer>/<layerKey>.ops.json` (build computes `baseFingerprint`; locale layer uses layerKey=<locale>)

Materialized output (Tokyo/R2):
- `tokyo/l10n/instances/<publicId>/<layer>/<layerKey>/<baseFingerprint>.ops.json`

Locale index (Tokyo/R2):
- `tokyo/l10n/instances/<publicId>/index.json`
- `index.json` shape (layered, hybrid):
```json
{
  "v": 1,
  "publicId": "wgt_main_faq",
  "layers": {
    "locale": {
      "keys": ["en", "fr"],
      "lastPublishedFingerprint": {
        "en": "sha256-hex",
        "fr": "sha256-hex"
      },
      "geoTargets": {
        "fr": ["FR", "BE"]
      }
    },
    "industry": { "keys": ["dentist"] }
  }
}
```
Rules:
- `index.json` is updated by Tokyo-worker whenever locales are published or deleted.
- `geoTargets` is optional and is used only for **variant selection within a language** (e.g. `fr` vs `fr-ca`); it must never override an explicit unrelated locale.
- Runtime prefers overlays whose `overlay.baseFingerprint` matches the current base fingerprint.
  - If the latest overlay is stale (fingerprint mismatch), Venice may apply the last published overlay ops **selectively** when safe, using `tokyo/l10n/instances/<publicId>/bases/<baseFingerprint>.snapshot.json`.

Example:
```json
{
  "v": 1,
  "baseFingerprint": "sha256-hex",
  "baseUpdatedAt": null,
  "ops": [
    { "op": "set", "path": "headline", "value": "..." }
  ]
}
```

Rules:
- Only `{ op: "set" }` ops are allowed.
- Paths use dot notation (e.g. `cta.label`, `items.0.title`).

### Staleness guard (single contract for pages + instances)

We use one staleness guard everywhere (Prague pages, curated instances, user instances):

- `baseFingerprint` is the canonical staleness guard.
- Fresh overlays apply when:
  - `overlay.baseFingerprint === computeL10nFingerprint(baseConfig, allowlist)`.
- Stale overlays may apply **partially** when safe:
  - Venice compares the current base value at each op path to the published base snapshot for the stale overlay fingerprint.

This keeps “locale overlays” deterministic across file-based content (Prague pages) and DB-based content (instances).

**Strict rule (Phase 1+):**
- `baseFingerprint` is required for all new overlays (curated + user).
- `baseUpdatedAt` is retained as metadata only; runtime does not apply overlays without a fingerprint.

**Shared implementation requirement:**
- `computeL10nFingerprint()` (and `buildL10nSnapshot()`) must be implemented once and imported from a shared module (recommended: `@clickeen/l10n` in `tooling/l10n`).

## Why overlays (vs full localized JSON per locale)

We use ops overlays because they scale cleanly:
- **No DB fan-out:** one canonical base config per instance.
- **Cacheable at the edge:** baseFingerprint-named overlay files can be `immutable`.
- **Diff-friendly:** small changes don’t require re-storing the entire JSON blob.
- **Safe by construction:** set-only prevents structural drift and merge conflicts.

**Base language note (current architecture):**
- The base config may be authored in **any** language (ConversationLanguage in Minibob).
- Overlays are generated from whatever base language is stored; no English‑only assumption.

## Default locale (Phase 1)

If a request does not include a locale signal:
- Venice defaults to `en` (no index-based auto-selection).

This is a deterministic runtime choice (for cache stability), not an identity rule.

## Operational runbook (Phase 1)

### 0) Prague localization (system-owned)

1. Author base copy in `tokyo/widgets/*/pages/*.json`.
2. Update allowlists under `prague/content/allowlists/v1/**` when new copy paths are added.
3. Generate overlays via `node scripts/prague-l10n/translate.mjs` (requires San Francisco; local uses `sanfrancisco-local`, cloud-dev uses `sanfrancisco-dev` with `SANFRANCISCO_BASE_URL` + `PARIS_DEV_JWT`).
4. Verify overlays via `pnpm prague:l10n:verify`.
5. Publish overlays to Tokyo/R2:
   - Cloud-dev/prod (remote R2): `node scripts/prague-sync.mjs --publish --remote`
   - Local dev (wrangler local R2): `node scripts/prague-sync.mjs --publish --local`
6. Prague reads page JSON base copy + Tokyo overlays from `tokyo/l10n/prague/**` (repo output) and fetches them at runtime from `${PUBLIC_TOKYO_URL}/l10n/v/<PUBLIC_PRAGUE_BUILD_ID>/prague/...` (cache-busted; token optional in local dev).

### 1) Enforce locale-free curated instances in Michael

Canonical migration:
- `supabase/migrations/20260116090000__public_id_prefixes.sql`

Effect:
- Renames known curated/main instances to the new prefixes and enforces locale-free IDs.
- Re-adds the DB constraint forbidding locale suffixes

Apply:
- Local/Remote: apply the migration to the running DB (`supabase db push` to the configured project).

### 2) Generate overlays (current)

1. Paris enqueues an l10n job on publish/update.
2. San Francisco runs the localization agent (allowlist + budgets).
3. Paris writes overlays to Supabase (`widget_instance_overlays`).
4. Tokyo-worker publishes overlays to Tokyo/R2 using deterministic paths.

Manual override (optional, dev-only for curated overlays):
- Create/update: `l10n/instances/<publicId>/<layer>/<layerKey>.ops.json` (locale layer: layerKey=<locale>)
- Overlay files must include `baseFingerprint` (or be built with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY so the build can compute it).
- Build + validate: `pnpm build:l10n` (enforces allowlists + fingerprints)
- Ensure Tokyo serves the output (`tokyo/dev-server.mjs` serves `/l10n/**` from `tokyo/l10n/**` locally).

User overrides (interactive):
- Saved via Bob to Supabase as layer=user overlays (layerKey=<locale> with optional `global` fallback).
- Never written directly to `tokyo/l10n/**`; Tokyo-worker publishes the user layer like other overlays.

### 3) Consume overlays

- Venice applies overlays at runtime for `/e/:publicId` and `/r/:publicId` based on the request locale.
- Prague embeds the canonical locale-free `publicId` and passes locale via query param to Venice.

## User-owned localization (current)

Higher-tier workspaces can edit per-field translations in Bob. These edits are stored as layer=user overlays (layerKey=<locale>, optional `global` fallback) and persist across agent re-translation.

Non-goals for Phase 1:
- Storing per-locale copies of the full instance config in Michael.
- Allowing locale suffixes in `publicId`.
- Sprinkling locale-specific conditionals throughout widget packages.

The durable contract remains: **one instance identity + locale overlays applied at runtime**.

---

## Links

- Prague overview: `documentation/services/prague/prague-overview.md`
- Tokyo (CDN): `documentation/services/tokyo.md`
- San Francisco: `documentation/services/sanfrancisco.md`
