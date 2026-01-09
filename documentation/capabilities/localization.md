# Localization (i18n + l10n) — Phase 1 Contract

This document defines how Clickeen handles language and localization across:
- Prague (marketing site)
- Bob (editor)
- Venice (embed runtime)
- Tokyo (software plane CDN)
- Michael (database)

## Core principle

- **Locale is a runtime parameter.**
- **Locale is not identity.** We never encode locale into `publicId`.

This prevents “fan-out” (e.g. `wgt_web_... .fr/.de/.es`) and keeps caching + ownership clean.

## Two distinct systems: `i18n` vs `l10n`

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

**Tokyo output**
- `tokyo/l10n/manifest.json`
- `tokyo/l10n/instances/<publicId>/<locale>.<hash>.ops.json`

Rule: overlays are **set-only ops** applied on top of the base instance config at runtime.

## Website creatives (Prague visuals)

Website creatives are Clickeen-owned instances used as Prague visual embeds (via Venice).

### Identity (non-negotiable)

- `creativeKey = {widgetType}.{page}.{slot}`
- `publicId = wgt_web_{creativeKey}` (locale-free)

There is exactly **one** instance row per creative in Michael. Locale selection happens at render time.

### Render algorithm (Phase 1)

1. Prague embeds Venice with canonical `publicId`:
   - `/e/wgt_web_{creativeKey}?locale=...`
2. Venice loads the base instance config from Paris/Michael.
3. Venice applies Tokyo `l10n` overlay for the request locale (if present).
4. Venice bootstraps `window.CK_WIDGET.state` with the localized config.

**Strict rule:** `wgt_web_*.<locale>` URLs are invalid and must 404 (no legacy support).

## Overlay format (set-only)

Source (repo):
- `l10n/instances/<publicId>/<locale>.ops.json`

Example:
```json
{
  "v": 1,
  "baseUpdatedAt": null,
  "ops": [
    { "op": "set", "path": "headline", "value": "..." }
  ]
}
```

Rules:
- Only `{ op: "set" }` ops are allowed.
- Paths use dot notation (e.g. `cta.label`, `items.0.title`).
- `baseUpdatedAt` is optional. When set, runtime applies the overlay only if it matches the base instance `updatedAt` (staleness guard).

## Why overlays (vs full localized JSON per locale)

We use ops overlays because they scale cleanly:
- **No DB fan-out:** one canonical base config per instance.
- **Cacheable at the edge:** hashed overlay files can be `immutable`.
- **Diff-friendly:** small changes don’t require re-storing the entire JSON blob.
- **Safe by construction:** set-only prevents structural drift and merge conflicts.

## Default locale (Phase 1)

If a request does not include a locale signal:
- Venice uses a deterministic default: `en`.

This is a deterministic runtime choice (for cache stability), not an identity rule.

## Operational runbook (Phase 1)

### 1) Enforce locale-free website creatives in Michael

Canonical migration:
- `supabase/migrations/20260108090000__website_creatives_locale_free.sql`

Effect:
- Collapses `wgt_web_{creativeKey}.{locale}` → `wgt_web_{creativeKey}`
- Deletes remaining locale-suffixed variants
- Re-adds the DB constraint forbidding locale suffixes

Apply:
- Local: `supabase db reset` (destructive) or apply the migration to the running local DB.
- Remote: `supabase db push` (will apply the migration to the configured remote project).

### 2) Add or update an instance overlay

1. Create/update: `l10n/instances/<publicId>/<locale>.ops.json`
2. Build + validate: `pnpm build:l10n`
3. Ensure Tokyo serves the output:
   - Local: `tokyo/dev-server.mjs` serves `/l10n/**` from `tokyo/l10n/**`
   - Cloud-dev/prod: `tokyo` must publish `tokyo/l10n/**` to R2/CDN

### 3) Consume overlays

- Venice applies overlays at runtime for `/e/:publicId` and `/r/:publicId` based on the request locale.
- Prague embeds the canonical locale-free `publicId` and passes locale via query param to Venice.

## Roadmap: user-owned localization (planned)

Higher-tier workspaces will be able to define their own localization logic for their own instances.

Non-goals for Phase 1:
- Storing per-locale copies of the full instance config in Michael.
- Allowing locale suffixes in `publicId`.
- Sprinkling locale-specific conditionals throughout widget packages.

The durable contract remains: **one instance identity + locale overlays applied at runtime**.
