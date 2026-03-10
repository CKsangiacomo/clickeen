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
- **User**: Account-owned instances created by users (often by cloning curated).

Curated + user instances localize within the account’s **active locales** (EN implied), bounded by tier entitlements and subject policy.

- **User instances** auto-enqueue l10n on publish/update (for the active locales set).
- **Curated instances** also auto-enqueue l10n on save/update when status is published.

### Entitlement + active locales model

Effective localization = **entitlements** ∩ **subject policy** ∩ **account active locales**.

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
- Account active locales source: `accounts.l10n_locales` (JSON array of **non‑EN** locales; EN is implied)
- Account locale policy/settings are managed in Roma Settings, not inside Bob.

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

**Tokyo output (served; PRD 54)**

When an instance is live (`status=published`), Tokyo contains exactly two things for l10n:

- Full text pack (immutable):
  - `l10n/instances/<publicId>/packs/<locale>/<textFp>.json`
- Live locale pointer (mutable, tiny, `no-store`):
  - `l10n/instances/<publicId>/live/<locale>.json` → `{ "textFp": "..." }`

Rules:
- Venice public never reads DB. It only reads the live pointers + packs from Tokyo.
- `textFp` is the sha256 of the stable JSON bytes of the full text pack.
- Text packs are **full packs** (not diffs). They contain only allowlisted keys.

Where the write plane fits (current repo snapshot):
- Paris stores editable overlay rows in its own R2 bucket (`OVERLAYS_R2`) using keys like `overlays/<publicId>/<layer>/<layerKey>.json`.
  - `layer=locale` = generated/managed translation ops (agent/import/manual)
  - `layer=user` = user overrides on top of the locale translation (choosing auto-translate again clears this layer on the next Save)
- Paris stores generation/status state in `L10N_STATE_KV`, and keeps base snapshots in overlay storage for diffing + status.
- Every overlay row is keyed by `baseFingerprint` (sha256 of the current allowlist snapshot).
- Stale writes are rejected when `baseFingerprint` does not match.
- These authoring records are **never** served publicly.
- When overlay/base state changes and the instance is live, Paris rebuilds the full text pack and enqueues Tokyo-worker to write it:
  - `fullPack = baseSnapshot + localeOps + userOps` (user ops win per key)

**Generation + mirroring (current after PRD 54)**

- Paris extracts the base text snapshot from the widget allowlist (`tokyo/widgets/<widgetType>/localization.json`).
- Paris diffs base snapshots to compute `changedPaths` + `removedPaths` and enqueues San Francisco jobs.
- San Francisco translates only `changedPaths` and writes set-only ops back to Paris.
- Paris persists those overlay rows in its overlay store (`OVERLAYS_R2`) and updates l10n generation state in `L10N_STATE_KV`.
- If the instance is live:
  - Paris enqueues `write-text-pack` for that locale (full pack = base snapshot + locale ops + user ops).
  - If SEO/GEO is entitled+enabled, Paris also enqueues `write-meta-pack` for that locale.
- When an instance first goes live, Paris seeds **every entitled locale** with a text pack so the embed never requests a missing locale pointer.
- When account locale/policy changes, Paris resyncs the Tokyo live pointers for all already-live instances (and seeds any newly added locales).
- Unpublish (`status=unpublished`) deletes the full `l10n/instances/<publicId>/...` subtree from Tokyo (mirror rule).

**Widget allowlist (authoritative)**

- Locale layer allowlist: `tokyo/widgets/{widgetType}/localization.json`
- Non-locale layer allowlists: `tokyo/widgets/{widgetType}/layers/{layer}.allowlist.json` (404 = no allowed paths)
- Agents must not mutate paths outside the relevant allowlist.

**Canonical write-plane store (Paris runtime)**

- `OVERLAYS_R2` stores per-instance overlay rows for authoring/generation (write plane only).
  - Locale translations: `layer='locale'`, `layer_key=<locale>`, set-only ops, `base_fingerprint=<hash of base snapshot>`.
  - User overrides: `layer='user'`, `layer_key=<locale>`, set-only ops, `base_fingerprint=<hash of base snapshot>`.
- `L10N_STATE_KV` stores per-fingerprint generation state used by status/retry orchestration.
- These authoring records are never served publicly.
- Public embeds read only Tokyo packs + live pointers (`l10n/instances/.../live/*.json` and `l10n/instances/.../packs/...`).
- `widget_instance_overlays` is not part of the active Michael schema in this repo snapshot.

Notes:
- `user_ops` is not used by PRD 54; overrides are stored as a separate `layer='user'` row so they can be reverted independently.
- `geo_targets` is not used by PRD 54 public embed; IP mapping is driven by `localePolicy.ip.*` in `renders/.../live/r.json`.

### Prague localization (system-owned, Babel-aligned)

Use Prague page JSON base copy + Tokyo overlays for **Clickeen-owned website copy** (Prague pages). Chrome UI strings remain in `prague/content/base/v1/chrome.json`. This mirrors instance l10n semantics with deterministic overlay keys and no manifest.

**Filesystem layout**

- Base copy: `tokyo/widgets/*/pages/*.json`
- Chrome base: `prague/content/base/v1/chrome.json`
- Allowlists: `prague/content/allowlists/v1/**`
- Overlays: `tokyo/l10n/prague/{pageId}/locale/{locale}/{baseFingerprint}.ops.json`

**Pipeline**

- Translation is done by San Francisco via `POST /v1/l10n/translate` (local + cloud-dev; requires `PARIS_DEV_JWT`).
- Provider: OpenAI for Prague strings (system-owned); instance l10n agents follow the **Tiered AI Profile** (DeepSeek for Free, OpenAI/Anthropic for Paid).
- `scripts/prague-l10n/translate.mjs` calls San Francisco and writes overlay ops into `tokyo/l10n/prague/**`.
- `scripts/prague-l10n/verify.mjs` is a read-only artifact validator:
  - validates index/overlay presence and schema
  - validates overlay fingerprint alignment
  - does not mutate files or enforce allowlist policy
  - Default mode is **best-available**: it validates the currently published overlay fingerprints (from `index.json`) and will **warn** on missing locales instead of blocking builds.
  - Strict mode is `node scripts/prague-l10n/verify.mjs --strict-latest` (or `PRAGUE_L10N_VERIFY_STRICT=1`) and enforces “latest base fingerprint translated for all locales”.
- `scripts/prague-sync.mjs` is the orchestrator used by CI: verify → (translate only if needed) → publish to Tokyo/R2.
  - To publish, pass `--publish` with an explicit target:
    - `--remote` in cloud-dev/prod (writes to Cloudflare R2)
    - `--local` in local dev (writes to Wrangler local R2)
- Prague loads page JSON base copy and applies overlays at runtime via Tokyo fetch.
  - Runtime fetches are versioned for cache determinism:
    - cloud-dev/prod: `${PUBLIC_TOKYO_URL}/l10n/v/<build-token>/prague/...` where `<build-token>` resolves to `CF_PAGES_COMMIT_SHA` (or `PUBLIC_PRAGUE_BUILD_ID` override)
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
2. Venice serves the published snapshot for the requested locale from the current revision.
3. If locale artifact is missing in that revision, response is unavailable (no serve-time EN fallback).
4. Dynamic base-config + overlay composition is an internal bypass/debug path, not the public default path.

**Strict rule:** `wgt_curated_*.<locale>` URLs are invalid and must 404 (no legacy support).

## Overlay format (set-only authoring state)

Paris write-plane storage:

- Overlay row: `overlays/<publicId>/<layer>/<layerKey>.json` in `OVERLAYS_R2`
- Base snapshots: `l10n/snapshots/<publicId>/<baseFingerprint>.json` plus `l10n/snapshots/<publicId>/latest.json`

Public Tokyo output:

- Text pack: `tokyo/l10n/instances/<publicId>/packs/<locale>/<textFp>.json`
- Live locale pointer: `tokyo/l10n/instances/<publicId>/live/<locale>.json`
- Optional base snapshots for diagnostics/non-public tooling: `tokyo/l10n/instances/<publicId>/bases/<baseFingerprint>.snapshot.json`

Example:

```json
{
  "public_id": "wgt_main_faq",
  "layer": "locale",
  "layer_key": "fr",
  "base_fingerprint": "sha256-hex",
  "source": "agent",
  "ops": [{ "op": "set", "path": "headline", "value": "..." }]
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
- Stale overlays may apply **partially** only in explicitly configured non-public paths:
  - Safe stale apply compares current base values to the published base snapshot for the stale overlay fingerprint.
- Venice public snapshot materialization does not use safe stale apply.

This keeps “locale overlays” deterministic across file-based content (Prague pages) and service-backed content (instances).

**Strict rule (Phase 1+):**

- `baseFingerprint` is required for all new overlays (curated + user).
- `baseUpdatedAt` is retained as metadata only; runtime does not apply overlays without a fingerprint.

**Shared implementation requirement:**

- `computeL10nFingerprint()` (and `buildL10nSnapshot()`) must be implemented once and imported from a shared module (recommended: `@clickeen/l10n` in `tooling/l10n`).

## Why overlays (vs full localized JSON per locale)

We use ops overlays because they scale cleanly:

- **No instance fan-out:** one canonical base config per instance.
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
6. Prague reads page JSON base copy + Tokyo overlays from `tokyo/l10n/prague/**` (repo output) and fetches them at runtime from `${PUBLIC_TOKYO_URL}/l10n/v/<build-token>/prague/...` (cache-busted; token optional in local dev; `<build-token>` resolves to `CF_PAGES_COMMIT_SHA` unless `PUBLIC_PRAGUE_BUILD_ID` is set).

### 1) Enforce locale-free curated/main IDs in Michael (current migration set)

Canonical migrations:

- `supabase/migrations/20260116090000__public_id_prefixes.sql` (historical rename to canonical prefixes)
- `supabase/migrations/20260211143000__curated_ids_strict_and_faq_renames.sql` (current strict constraints for active instance tables)
- `supabase/migrations/20260201090000__drop_widget_instance_locales.sql` (legacy locales table removed)

Effect:

- Enforces locale-free curated/main/user identity patterns on active instance tables.
- Keeps website creative IDs (`wgt_web_*`) as dedicated web-content identity, not locale-fanout IDs.
- Removes legacy `widget_instance_locales` table from active schema.

Apply:

- Local/Remote: apply the migration to the running DB (`supabase db push` to the configured project).

### 2) Generate overlays (current)

1. Paris enqueues an l10n job on publish/update.
2. San Francisco runs the localization agent (allowlist + budgets).
3. Paris writes overlay rows to its own overlay store (`OVERLAYS_R2`) and updates generation state in `L10N_STATE_KV`.
4. If the instance is live, Paris enqueues Tokyo-worker to publish text packs + live pointers to Tokyo/R2.

User overrides (interactive):

- Saved via Bob through Paris into the overlay store as layer=user rows (`layerKey=<locale>`; optional `global` when supported by the endpoint).
- Never written directly to public `tokyo/l10n/**`; Tokyo-worker publishes live text artifacts from Paris-managed state.

### 3) Consume overlays

- Public `/e/:publicId` and `/r/:publicId` are snapshot-first and revision-coherent; they do not dynamically heal missing locale artifacts.
- Dynamic overlay composition is internal bypass behavior only (non-public).
- Prague embeds the canonical locale-free `publicId` and passes locale via query param to Venice.

## User-owned localization (current)

Higher-tier accounts can edit per-field translations in Bob. These edits are stored as layer=user overlays in Paris's overlay store and persist across agent re-translation.

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
