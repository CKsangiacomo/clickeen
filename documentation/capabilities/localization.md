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

`packages/l10n/locales.json` is the canonical registry of supported locale tokens **and** how to label them in different UI languages.

- Use `code` as the locale token everywhere (lowercase BCP47-ish like `fr-ca`, `zh-hans`).
- For locale pickers, always render locale names using `labels[uiLocale]` (not `nativeLabel`) so an English UI user does not see Chinese/Arabic script in the picker.
- Use `@clickeen/l10n` helpers (e.g. `normalizeLocaleToken`, `normalizeCanonicalLocalesFile`, `resolveLocaleLabel`) instead of ad-hoc parsing (`split('-')[0]` is forbidden).

## Instance kinds + entitlement gating (Phase 1)

### Instance kinds (authoritative)

- **Curated**: Clickeen-owned instances used for Prague embeds and template pickers.
- **User**: Account-owned instances created by users (often by cloning curated).

Curated + user instances localize within the account’s **active locales** (EN implied), bounded by tier entitlements and subject policy.

- **User instances** localize through explicit Tokyo-worker sync triggered by Roma widget/localization routes; save itself does not run l10n work.
- **Curated instances** use the same explicit Tokyo-worker sync model rather than save-time l10n work.

### Entitlement + active locales model

Account-mode effective localization = **entitlements** ∩ **subject policy** ∩ **account active locales**.

- Entitlement keys:
  - `l10n.locales.max` (cap; total locales including EN)
  - `l10n.locales.custom.max` (cap; how many non‑EN locales the user can choose)
  - `l10n.versions.max` (cap; retained overlay versions)
- Tier rules (v1; executed):
  - Free: EN + 1 system-chosen locale (no picker)
  - Tier1: EN + 3 user-selected locales (total = 4)
  - Tier2+: unlimited locales
- DevStudio: uncapped
- Account active locales source: `accounts.l10n_locales` (JSON array of **non‑EN** locales; EN is implied)
- Account locale policy/settings are managed in Roma Settings, not inside Bob.

Current free-tier materialization rule:
- Roma materializes the single additional locale before persistence.
- If the base locale is not `en`, the additional locale is `en`.
- If the base locale is `en`, the additional locale is `es`.
- Berlin persists the resulting saved locale list exactly as decided; downstream systems do not choose again.

### MiniBob public contract

MiniBob is not an account-governance surface, so its locale visibility is different:

- MiniBob can view all locales that are already `ready` in the public Venice/Tokyo consumer truth for the current live fingerprint.
- MiniBob does not gain locale governance, translation generation, publish, or account writes from that visibility.
- MiniBob action limits come from subject policy; locale visibility comes from public `readyLocales`.
- Bob translation UI should communicate locale truth only; commercial upsell/gating copy must not live inside the translation-status surface.
- Bob must treat host/public localization payloads as strict system-owned truth. Malformed MiniBob/account localization snapshots are producer bugs, not inputs to normalize.

## Localization systems (runtime)

### `i18n` (catalogs for UI strings)

Use `i18n` when the surface is UI chrome / labels:

- Bob editor chrome (`coreui.*`)
- Widget UI string bundles (`{widgetName}.*`), when applicable

**Tokyo output**

- `tokyo/i18n/manifest.json`
- `tokyo/i18n/{locale}/{bundle}.{hash}.json`
- Admin-owned authored source: `tokyo/admin-owned/i18n/{locale}/{bundle}.json`

Rule: catalogs are content-hashed and cacheable; the manifest is the indirection layer.

### `l10n` (overlays for instance config/content)

Use `l10n` when the surface is “content inside an instance config” (copy, headings, CTA labels, etc.).

**Tokyo output (served; PRD 54)**

When Tokyo marks an instance as published/servable, Tokyo exposes exactly two public l10n outputs:

- Full text pack (immutable):
  - `l10n/instances/<publicId>/packs/<locale>/<textFp>.json`
- Live locale pointer (mutable, tiny, `no-store`):
  - `l10n/instances/<publicId>/live/<locale>.json` → `{ "textFp": "..." }`

Rules:
- Venice public never reads DB. It only reads the live pointers + packs from Tokyo.
- `textFp` is the sha256 of the stable JSON bytes of the full text pack.
- Text packs are **full packs** (not diffs). They contain only allowlisted keys.

Where the write plane fits (current repo snapshot):
- Tokyo/Tokyo-worker store editable overlay rows and base snapshots under `tokyo/l10n/instances/<publicId>/...`.
  - `layer=locale` = generated/managed translation ops
  - legacy `layer=user` rows may still exist in Tokyo storage, but active product routes no longer expose or write a user-layer surface
- Tokyo-worker still owns canonical overlay/artifact state, but Builder no longer mounts account-mode localization snapshot/status/user-layer flows as part of the active authoring loop.
- Every overlay row is keyed by `baseFingerprint` (sha256 of the current allowlist snapshot).
- Repo-authored admin-owned l10n source overlays, when kept in-repo, live under `tokyo/admin-owned/l10n/**` and build into `tokyo/l10n/**`.
- Stale writes are rejected when `baseFingerprint` does not match.
- These authoring records are **never** served publicly.
- When overlay/base state changes and the instance is published/servable, Tokyo-worker rebuilds the full text pack and publishes it:
  - `fullPack = baseSnapshot + localeOps`

**Generation + mirroring (current after PRD 54)**

- Tokyo computes the canonical base text snapshot/fingerprint from the widget allowlist (`tokyo/widgets/<widgetType>/localization.json`) when the saved authoring config is written.
- Tokyo-worker reads Tokyo-owned l10n identity/artifact state and calls San Francisco `POST /v1/l10n/account/ops/generate` only when explicit instance sync needs new locale ops.
- Roma forwards the caller capsule/bearer to Tokyo-worker; Tokyo-worker sends the already-minted account `policyProfile` with the San Francisco request, and San Francisco derives the `l10n.instance.v1` AI profile/provider lane from `@clickeen/ck-policy` rather than defaulting to a generic paid path.
- San Francisco returns set-only locale ops.
- Tokyo-worker persists those overlay rows in the canonical Tokyo l10n plane.
- Roma settings plus entitlements determine the canonical desired locale set for the account/widget lane, and Tokyo-worker reads that account-locale truth directly from Berlin during explicit sync execution.
- Product-path save writes the current saved-widget l10n summary (`baseLocale` + desired locale set) into the Tokyo saved widget plane alongside the current `baseFingerprint`.
- Product-path save also requires Tokyo-worker to durably accept one current widget translation state for that saved revision before Roma reports save success.
- Explicit sync converges locale artifacts against that Tokyo-worker translation state.
- Builder Translations reads consume only the current Tokyo-worker translation state; they do not infer readiness from saved summaries, queue internals, or public/live artifact pointers.
- While the `Translations` panel is open, Bob reads one Roma same-origin translations route backed by Tokyo-worker. That payload is `baseLocale`, `requestedLocales`, `readyLocales`, `status`, `failedLocales`, `baseFingerprint`, `generationId`, and `updatedAt`.
- After Save succeeds, Bob may re-read that same route once to show current Tokyo truth.
- Builder does not own an always-on localization convergence loop. If the Translations panel is open and the route says translations are still preparing, Builder may perform a small bounded recheck of that same Tokyo-backed status read.
- The Translations panel presents one global readiness answer from `status`.
- The panel locale chooser represents the account's current display languages only when `status` is `ready`. Partial current-ready locale sets remain backend safety state, not user-facing product state.
- Lower-tier language upsell copy in Builder comes from the policy cap carried in the Roma open-editor payload.
- When a newer save writes a new current translation state for the same instance, queued older generations are ignored by `generationId`.
- If Tokyo cannot hand follow-up localization work to the queue, Tokyo-worker marks the current translation state `failed` instead of letting Builder show fake progress.
- If locale generation does not return current ops for a locale requested by the latest save, Tokyo-worker does not publish that locale as current-ready for the new `baseFingerprint`.
- Builder preview locale selection uses the same readiness truth. Incomplete locale sets never enter the Builder locale chooser as a partial readiness list.
- On explicit Tokyo-worker sync, the pipeline reconciles Tokyo against that desired set for the current `baseFingerprint`:
  - if Tokyo already has the locale artifact for that exact fingerprint, skip
  - if Tokyo does not have it, generate and write it
- If the instance is published/servable:
  - Tokyo-worker writes the locale text pack (full pack = base snapshot + locale ops + user ops).
  - Tokyo-worker moves the public live locale policy with the current-ready locale subset only; missing locales stay out of public serving until they have current artifacts.
  - If SEO/GEO is entitled+enabled, Tokyo-worker also writes the locale meta pack.
- Consumer/embed policy is built only from Tokyo-ready locales for the current `baseFingerprint`, never from the full desired/allowed set.
- When an instance first becomes published/servable, Roma triggers Tokyo-worker sync for the desired locale set and Tokyo-worker exposes only the Tokyo-ready subset to consumers.
- When account locale/policy changes, Roma fans that change out across all account-owned saved instances:
  - published instances enqueue sync with `live: true`, so public serving truth refreshes too
  - unpublished instances enqueue sync with `live: false`, so Builder/saved locale truth refreshes without turning public serving on
  - curated starter instances are not part of that account locale fanout
- Unpublish turns public serving off. It removes the public live/serve surfaces that Venice depends on, but it is not the definition of whether saved base state or internal overlay authoring state exists.

**Widget allowlist (authoritative)**

- Locale layer allowlist: `tokyo/widgets/{widgetType}/localization.json`
- Non-locale layer allowlists: `tokyo/widgets/{widgetType}/layers/{layer}.allowlist.json` (404 = no allowed paths)
- Agents must not mutate paths outside the relevant allowlist.

**Canonical write-plane store (Tokyo/Tokyo-worker runtime)**

- Tokyo stores per-instance overlay rows for authoring/generation (write plane only).
  - Locale translations: `layer='locale'`, `layer_key=<locale>`, set-only ops, `base_fingerprint=<hash of base snapshot>`.
- Historical `layer='user'` rows may still exist in Tokyo storage from older flows, but the active `75E` product path no longer writes or consumes them.
- Public/product l10n control routes no longer admit `layer='user'`.
- Tokyo-worker derives status from canonical Tokyo overlay/artifact state.
- These authoring records are never served publicly.
- Public embeds read only Tokyo packs + live pointers (`l10n/instances/.../live/*.json` and `l10n/instances/.../packs/...`).
- `widget_instance_overlays` is not part of the active Michael schema in this repo snapshot.

Notes:
- `user_ops` is not part of the active `75E` product path.
- `geo_targets` is not used by PRD 54 public embed; IP mapping is driven by `localePolicy.ip.*` in `renders/.../live/r.json`.

### Prague localization (system-owned, Babel-aligned)

Use Prague page JSON base copy + Tokyo overlays for **Clickeen-owned website copy** (Prague pages). Chrome UI strings remain in `prague/content/base/v1/chrome.json`. This mirrors instance l10n semantics with deterministic overlay keys and no manifest.

**Filesystem layout**

- Base copy: `tokyo/widgets/*/pages/*.json`
- Chrome base: `prague/content/base/v1/chrome.json`
- Allowlists: `prague/content/allowlists/v1/**`
- Overlays: `tokyo/l10n/prague/{pageId}/locale/{locale}/{baseFingerprint}.ops.json`

**Pipeline**

- Translation is done by San Francisco via `POST /v1/l10n/translate` (local + cloud-dev; requires `CK_INTERNAL_SERVICE_JWT`).
- Provider: OpenAI for Prague strings (system-owned); instance l10n agents follow the **Tiered AI Profile** (DeepSeek for Free, OpenAI/Anthropic for Paid).
- `scripts/prague-l10n/translate.mjs` calls San Francisco and writes overlay ops into `tokyo/l10n/prague/**`.
- `scripts/prague-l10n/verify.mjs` is a read-only artifact validator:
  - validates index/overlay presence and schema
  - validates overlay fingerprint alignment
  - does not mutate files or enforce allowlist policy
  - Default mode validates the currently published overlay fingerprints (from `index.json`) and will **warn** on missing locales instead of blocking builds.
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
- `baseFingerprint` is the consumer visibility guard.
- Public/current consumer paths must not apply non-current overlays.
- Prague snapshot/base-snapshot metadata may still exist for verification and publication repair work, but that is not the account/widget consumer contract and must not be copied into Builder/Venice product paths.

**Base snapshots (Prague)**

- `scripts/prague-l10n/translate.mjs` writes base snapshots to `tokyo/l10n/prague/{pageId}/bases/{baseFingerprint}.snapshot.json`.
- Prague retains snapshots for translation/publication tooling and diagnostics.

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

Tokyo write-plane storage:

- Overlay row: `tokyo/l10n/instances/<publicId>/<layer>/<layerKey>/<baseFingerprint>.ops.json`
- Base snapshots: `tokyo/l10n/instances/<publicId>/bases/<baseFingerprint>.snapshot.json`

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
- Consumer paths apply only current overlays for the active `baseFingerprint`.
- Non-current overlays remain internal publication/control-plane state until regeneration converges them.

This keeps “locale overlays” deterministic across file-based content (Prague pages) and service-backed content (instances).

**Strict rule (Phase 1+):**

- `baseFingerprint` is required for all new overlays (curated + user).
- `baseUpdatedAt` is retained as metadata only; runtime does not apply overlays without a fingerprint.

**Shared implementation requirement:**

- `computeL10nFingerprint()` (and `buildL10nSnapshot()`) must be implemented once and imported from a shared module (`@clickeen/l10n` in `packages/l10n`).

## Why overlays (vs full localized JSON per locale)

We use ops overlays because they scale cleanly:

- **No instance fan-out:** one canonical base config per instance.
- **Cacheable at the edge:** baseFingerprint-named overlay files can be `immutable`.
- **Diff-friendly:** small changes don’t require re-storing the entire JSON blob.
- **Safe by construction:** set-only prevents structural drift and merge conflicts.

**Base language note (current architecture):**

- The base config may be authored in **any** language.
- The account base locale is the source language for translation bases.
- That base locale must be chosen before the first widget save in the account.
- After the first widget save, base locale is locked in product UI; later changes are support/migration work, not a normal settings toggle.
- Overlays are generated from whatever base language is stored; no English-only assumption.

## Default locale (Phase 1)

If a request does not include a locale signal:

- Venice defaults to `en` (no index-based auto-selection).

This is a deterministic runtime choice (for cache stability), not an identity rule.

## Operational runbook (Phase 1)

### 0) Prague localization (system-owned)

1. Author base copy in `tokyo/widgets/*/pages/*.json`.
2. Update allowlists under `prague/content/allowlists/v1/**` when new copy paths are added.
3. Generate overlays via `node scripts/prague-l10n/translate.mjs` (requires San Francisco; local uses `sanfrancisco-local`, cloud-dev uses `sanfrancisco-dev` with `SANFRANCISCO_BASE_URL` + `CK_INTERNAL_SERVICE_JWT`).
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

1. Roma triggers Tokyo-worker sync only from explicit create/locale-settings/publish flows when locale artifacts need to converge.
2. San Francisco generates locale ops when needed.
3. Tokyo-worker writes overlay rows and base snapshots to Tokyo.
4. If the instance is live, Tokyo-worker publishes text packs + live pointers to Tokyo/R2.

User overrides (interactive):

- Historical `layer=user` rows may still exist in Tokyo storage from older flows.
- The active Builder product path does not expose or write a `layer=user` surface.

### 3) Consume overlays

- Public `/e/:publicId` and `/r/:publicId` are snapshot-first and revision-coherent; they do not dynamically heal missing locale artifacts.
- Dynamic overlay composition is internal bypass behavior only (non-public).
- Prague embeds the canonical locale-free `publicId` and passes locale via query param to Venice.

## User-owned localization (historical / not active in current product path)

Older flows stored user-authored translation overrides separately from system-generated locale ops.
That model is not part of the active Builder authoring path in the current repo state.

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
