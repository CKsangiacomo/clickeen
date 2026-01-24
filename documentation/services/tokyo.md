# System: Tokyo — Asset Storage & CDN

## Identity
- Tier: Supporting
- Purpose: File and asset storage with CDN delivery

## Interfaces
- Upload APIs, signed URLs
- Serves widget definitions/assets (core runtime + contract files):
  - `spec.json`, `widget.html`, `widget.css`, `widget.client.js`, `agent.md`
  - `limits.json`, `localization.json`, `layers/*.allowlist.json`, `pages/*.json`
- Serves localization overlays for instances (`tokyo/l10n/**`) materialized from Supabase overlays
- Prague website base copy is repo-local in `tokyo/widgets/*/pages/*.json`; localized overlays are served by Tokyo under `tokyo/l10n/prague/**` (Chrome UI strings remain in `prague/content/base/v1/chrome.json`).

## Dependencies
- Used by: Venice, Bob, Prague

## Deployment
- Cloudflare R2 (zero egress)

## Rules
- Public assets cacheable; private assets signed, time-limited

## Canonical URLs (executed)

- **Local**: `http://localhost:4000` (Tokyo dev server started by `scripts/dev-up.sh`)
- **Cloud-dev**: `https://tokyo.dev.clickeen.com` (Cloudflare dev)
- **UAT / Limited GA / GA**: `https://tokyo.clickeen.com` (release stages share prod infra)

Consumers should treat Tokyo as the **software plane**:
- Widget definitions are fetched over HTTP (even locally) using `NEXT_PUBLIC_TOKYO_URL`
- Dieter build artifacts are served from Tokyo (`tokyo/dieter/**`)
- i18n bundles are served from Tokyo (`tokyo/i18n/**`)

## Dieter bundling manifest (executed)

Dieter emits a bundling manifest at:
- `tokyo/dieter/manifest.json`

This is the authoritative contract Bob uses to determine which Dieter bundles are real and which classnames are helpers.

Shape (as implemented today):
- `v`: schema version (number)
- `gitSha`: build fingerprint
- `components`: string[] (valid component bundles)
- `componentsWithJs`: string[] (bundles that ship a `.js`)
- `aliases`: Record<string,string> (optional hint mapping)
- `helpers`: string[] (classnames that must never be treated as bundles)
- `deps`: Record<string,string[]> (explicit component dependencies)

## Determinism rule (anti-drift)

- ToolDrawer `type="..."` drives required bundles.
- CSS classnames never add bundles (classnames are not a dependency graph).

## i18n bundles (executed)

Tokyo serves built localization catalogs for editor/runtime surfaces:
- Build output path: `tokyo/i18n/{locale}/{bundle}.{hash}.json`
- Manifest: `tokyo/i18n/manifest.json`

Rules:
- Catalog filenames are content-hashed (safe for `Cache-Control: immutable` at the CDN).
- `manifest.json` is the indirection layer that maps `{ locale, bundle } → filename` and is intended to be short-TTL.
- Bundles are scoped by namespace:
  - `coreui.*` (shared product/editor chrome)
  - `{widgetName}.*` (widget-specific terminology/labels)

Local dev:
- `tokyo/dev-server.mjs` serves `/i18n/*` from `tokyo/i18n/*`.
- `tokyo/dev-server.mjs` serves `/workspace-assets/*` from `tokyo/workspace-assets/*` (gitignored).
- `tokyo/dev-server.mjs` serves `/curated-assets/*` from `tokyo/curated-assets/*` (gitignored).
- `tokyo/dev-server.mjs` serves `/l10n/*` from `tokyo/l10n/*`.
- `tokyo/dev-server.mjs` supports local upload endpoints:
  - `POST /workspace-assets/upload` (workspace-scoped assets; required header: `x-workspace-id`)
  - `POST /curated-assets/upload` (curated instance assets; required headers: `x-public-id`, `x-widget-type`)
  - `POST /widgets/upload` (platform/widget-scoped assets; required header: `x-widget-type`)
  - `POST /l10n/instances/:publicId/:layer/:layerKey` (dev-only; layered path)
  - `DELETE /l10n/instances/:publicId/:layer/:layerKey` (dev-only; layered path)
  - `POST /l10n/instances/:publicId/index` (dev-only; writes layer index into `tokyo/l10n/**`)
  - `DELETE /l10n/instances/:publicId/index` (dev-only; removes layer index from `tokyo/l10n/**`)
- Local l10n publish path: `tokyo-worker` reads Supabase and POSTs to the dev server when `TOKYO_L10N_HTTP_BASE` is set.
- `scripts/dev-up.sh` starts the dev server and workers, builds Dieter + i18n, and verifies Prague l10n overlays (auto-translates missing overlays when SF is running), but does **not** build/push instance l10n overlays; run `pnpm build:l10n` or trigger the Paris/SF pipeline when you need instance overlays.

## l10n overlays (executed)

Tokyo serves **instance localization overlays** as deterministic baseFingerprint ops patches:

- Build output path: `tokyo/l10n/instances/<publicId>/<layer>/<layerKey>/<baseFingerprint>.ops.json` (locale + user layers active; other layers use the same path)
- Locale index: `tokyo/l10n/instances/<publicId>/index.json` (hybrid layer index)

Rules:
- Overlays are set-only ops (no structural mutations).
- Overlays include `baseFingerprint` and are rejected if missing.
- Instance identity is locale-free (`publicId` never contains locale).
- Consumers should treat overlay files as cacheable (immutable baseFingerprint filenames); no global manifest is used.
- Overlay files are materialized by `tokyo-worker` from Supabase `widget_instance_overlays` (layered; locale + user are active).
- `index.json` is materialized by `tokyo-worker` and lists available layer keys (hybrid index).

Build command (repo root):
- `pnpm build:l10n`

Cloud-dev:
- `tokyo-worker` provides a Cloudflare Worker for workspace asset uploads + serving:
  - `POST /workspace-assets/upload` (requires `Authorization: Bearer ${TOKYO_DEV_JWT}`; required header: `x-workspace-id`)
  - `GET /workspace-assets/**` (public, cacheable; content-addressed by `assetId`)
  - `POST /curated-assets/upload` (requires `Authorization: Bearer ${TOKYO_DEV_JWT}`; required headers: `x-public-id`, `x-widget-type`)
  - `GET /curated-assets/**` (public, cacheable; content-addressed by `assetId`)
  - `POST /l10n/instances/:publicId/:layer/:layerKey` (requires `Authorization: Bearer ${TOKYO_DEV_JWT}`)
  - `GET /l10n/**` (public; deterministic overlay paths, immutable)
  - `/l10n/publish` (internal) materializes Supabase overlays into R2

Security rule (executed):
- `TOKYO_DEV_JWT` must never be used from a browser. DevStudio promotion uses it server-side (local Vite middleware).

## Links
- Back: ../../CONTEXT.md
- Tokyo Worker: documentation/services/tokyo-worker.md
- Localization contract: documentation/capabilities/localization.md
