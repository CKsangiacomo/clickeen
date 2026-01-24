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

## Instance kinds + entitlement gating (Phase 1)

### Instance kinds (authoritative)
- **Curated**: Clickeen-owned instances used for Prague embeds and template pickers.
- **User**: Workspace-owned instances created by users (often by cloning curated).

Curated instances always localize to all supported locales. User instances localize only when entitled and selected.

### Entitlement + selection model
Effective localization = **entitlements** ∩ **subject policy** ∩ **workspace locale selection**.

- Entitlement keys:
  - `l10n.enabled` (flag)
  - `l10n.locales.max` (cap)
  - `l10n.versions.max` (cap)
- Tier rules (V0):
  - Minibob / Free / Tier 1: ❌ no localization
  - Tier 2: ✅ up to 3 locales
  - Tier 3: ✅ unlimited locales
  - DevStudio: ✅ uncapped
- Workspace selection source: `workspaces.l10n_locales` (JSON array)

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

Rule: overlays are **set-only ops** applied on top of the base instance config at runtime.
Rule: `baseFingerprint` is computed from the **allowlist snapshot** (translatable fields only), not the full config.

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
- Venice applies the overlay at render time (if present and not stale).

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
- Translation is done by San Francisco via `POST /v1/l10n/translate` (local-only; requires `PARIS_DEV_JWT`).
- Provider: OpenAI for Prague strings; instance l10n agents use DeepSeek.
- `scripts/prague-l10n/translate.mjs` calls San Francisco and writes overlay ops into `tokyo/l10n/prague/**`.
- `scripts/prague-l10n/verify.mjs` validates allowlists + overlay paths (wired into Prague build/dev-up).
- Prague loads page JSON base copy and applies overlays at runtime via Tokyo fetch.

**Strict rules**
- Overlays are set-only ops and must include `baseFingerprint`.
- Verification fails if any non-en locale is missing an overlay.
- Same staleness guard as instance overlays (`baseFingerprint`).

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
- `geoTargets` is optional; Venice does not use it for runtime locale selection (explicit `?locale` or default `en`).
- Runtime applies overlays only when `overlay.baseFingerprint` matches the current base.

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
- Runtime applies an overlay only when:
  - `overlay.baseFingerprint === computeL10nFingerprint(baseConfig, allowlist)`.

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

## Default locale (Phase 1)

If a request does not include a locale signal:
- Venice defaults to `en` (no index-based auto-selection).

This is a deterministic runtime choice (for cache stability), not an identity rule.

## Operational runbook (Phase 1)

### 0) Prague localization (system-owned)

1. Author base copy in `tokyo/widgets/*/pages/*.json`.
2. Update allowlists under `prague/content/allowlists/v1/**` when new copy paths are added.
3. Generate overlays via `pnpm prague:l10n:translate` (requires San Francisco local).
4. Verify overlays via `pnpm prague:l10n:verify`.
5. Prague reads page JSON base copy + Tokyo overlays (`tokyo/l10n/prague/**`), no Supabase publish.

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
