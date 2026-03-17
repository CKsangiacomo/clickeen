# System: Tokyo — Asset Storage & CDN

## Identity
- Tier: Supporting
- Purpose: File and asset storage with CDN delivery

## Interfaces
- Upload APIs, signed URLs
- Serves widget definitions/assets (core runtime + contract files):
  - `spec.json`, `widget.html`, `widget.css`, `widget.client.js`, `agent.md`
  - `limits.json`, `localization.json`, `layers/*.allowlist.json`, `pages/*.json`
- Serves published localization artifacts for instances (`tokyo/l10n/**`) written by Roma/Tokyo-worker
- Serves published render snapshots for Venice (`tokyo/renders/instances/**`) materialized by `tokyo-worker` (PRD 38)
- Prague website base copy is repo-local in `tokyo/widgets/*/pages/*.json`; localized overlays are stored under `tokyo/l10n/prague/**` and fetched by Prague from `${PUBLIC_TOKYO_URL}/l10n/v/<build-token>/prague/**` (Chrome UI strings remain in `prague/content/base/v1/chrome.json`; build token defaults to `CF_PAGES_COMMIT_SHA`, with `PUBLIC_PRAGUE_BUILD_ID` as optional override).

## Dependencies
- Used by: Venice, Bob, Prague

## Deployment
- Cloudflare R2 (zero egress)

## Rules
- Public assets cacheable; private assets signed, time-limited

## Canonical URLs (executed)

- **Local**: `http://localhost:4000` (local Tokyo dev server + local Tokyo-worker path).
- **Cloud-dev**: `https://tokyo.dev.clickeen.com` (Cloudflare dev)
- **UAT / Limited GA / GA**: `https://tokyo.clickeen.com` (release stages share prod infra)

Consumers should treat Tokyo as the **software plane**:
- Widget definitions are fetched over HTTP using `NEXT_PUBLIC_TOKYO_URL` (local Tokyo in canonical local development)
- Dieter build artifacts are served from Tokyo (`tokyo/dieter/**`)
- i18n bundles are served from Tokyo (`tokyo/i18n/**`)
- Admin-owned authored i18n source catalogs live under `tokyo/admin-owned/i18n/**` and are built into `tokyo/i18n/**`
- Admin-owned authored l10n source overlays live under `tokyo/admin-owned/l10n/**` and are built into `tokyo/l10n/**`
- Roma account asset control-plane calls use the private `TOKYO_ASSET_CONTROL` Cloudflare service binding; `NEXT_PUBLIC_TOKYO_URL` is not the product asset control seam.

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
- Admin-owned authored source path: `tokyo/admin-owned/i18n/{locale}/{bundle}.json`

Rules:
- Catalog filenames are content-hashed (safe for `Cache-Control: immutable` at the CDN).
- `manifest.json` is the indirection layer that maps `{ locale, bundle } → filename` and is intended to be short-TTL.
- Bundles are scoped by namespace:
  - `coreui.*` (shared product/editor chrome)
  - `{widgetName}.*` (widget-specific terminology/labels)

Local dev:
- `tokyo/dev-server.mjs` serves `/i18n/*` from `tokyo/i18n/*`.
- `tokyo/dev-server.mjs` proxies canonical account asset reads (`/assets/v/*`) directly to `tokyo-worker` (no local mirror mode).
- `tokyo/dev-server.mjs` serves `/l10n/*` from `tokyo/l10n/*`.
- `tokyo/dev-server.mjs` proxies `/renders/*` to `tokyo-worker` with forwarded auth headers (so DevStudio/Venice can read the same saved/live render surfaces from the same Tokyo origin).
- `tokyo/dev-server.mjs` proxies instance-backed `GET /l10n/instances/*` reads to `tokyo-worker`; repo-local Prague/admin-owned l10n content still serves directly from `tokyo/l10n/*`.
- `tokyo/dev-server.mjs` also supports versioned l10n fetches by rewriting `/l10n/v/<token>/*` → `/l10n/*` (used by Prague deploys).
- Local asset management does not go through `tokyo/dev-server.mjs`.
  - Roma product uploads use `/api/accounts/:accountId/assets/upload`.
  - DevStudio local uses `/api/devstudio/assets/*` and talks directly to `tokyo-worker` with explicit internal-tool auth.
- `tokyo/dev-server.mjs` still supports local widget uploads:
  - `POST /widgets/upload` (platform/widget-scoped assets; required header: `x-widget-type`)
- `scripts/dev-up.sh` starts the local Tokyo dev server + Tokyo-worker as part of the local DevStudio operating lane, builds Dieter + i18n, seeds required local platform state through the canonical seed scripts, and verifies the DevStudio/Bob localhost lane before completion.
- Explicit rerun commands:
  - `pnpm dev:seed:platform`
  - `pnpm dev:verify:platform`
- Account asset state is manifest-backed product truth. It must not be “repaired” by boot scripts with blob-only sync logic.

## l10n published artifacts (executed)

Tokyo serves **published instance localization artifacts**:

- Text pack: `tokyo/l10n/instances/<publicId>/packs/<locale>/<textFp>.json`
- Live locale pointer: `tokyo/l10n/instances/<publicId>/live/<locale>.json`
- Base snapshots for diagnostics/non-public tooling: `tokyo/l10n/instances/<publicId>/bases/<baseFingerprint>.snapshot.json`

Rules:
- Instance identity is locale-free (`publicId` never contains locale).
- Public runtime reads packs + live pointers only.
- Authoring overlay state is stored in Tokyo/Tokyo-worker under the canonical `l10n/instances/**` plane.
- Fingerprinted packs are immutable/cacheable; live pointers are tiny mutable `no-store` files.

Admin-owned repo-local l10n source overlays live under:

- `tokyo/admin-owned/l10n/instances/<publicId>/<layer>/<layerKey>.ops.json`

Cloud-dev:
- `tokyo-worker` provides a Cloudflare Worker for account-owned asset uploads + serving:
  - `GET /renders/instances/:publicId/saved.json` (product paths require `Authorization: Bearer ${CK_INTERNAL_SERVICE_JWT}` + `x-ck-internal-service: roma.edge` + Roma `x-ck-authz-capsule`; local internal tool reads may use `TOKYO_DEV_JWT` plus an allowed `x-ck-internal-service`; requires `x-account-id` or `?accountId=`.)
  - `PUT /renders/instances/:publicId/saved.json` (product paths require `Authorization: Bearer ${CK_INTERNAL_SERVICE_JWT}` + `x-ck-internal-service: roma.edge` + Roma `x-ck-authz-capsule`; local internal tool writes may use `TOKYO_DEV_JWT` plus an allowed `x-ck-internal-service`; requires `x-account-id` or `?accountId=`.)
  - `POST /__internal/assets/upload` (private Roma service-binding path; requires `x-account-id`, Roma `x-ck-authz-capsule`, optional `x-public-id`, `x-widget-type`, `x-source`)
  - `GET /__internal/assets/account/:accountId` (private Roma service-binding path; member-scoped list)
  - `POST /__internal/assets/account/:accountId/resolve` (private Roma service-binding path; resolves logical `assetId` values to canonical immutable asset reads for runtime materialization)
  - `DELETE /__internal/assets/:accountId/:assetId` (private Roma service-binding path; editor+-scoped hard delete path)
  - `GET /assets/integrity/:accountId` (local internal only: `Authorization: Bearer ${TOKYO_DEV_JWT}` + allowed `x-ck-internal-service`)
  - `GET /assets/integrity/:accountId/:assetId` (local internal only: `Authorization: Bearer ${TOKYO_DEV_JWT}` + allowed `x-ck-internal-service`)
  - `GET /assets/v/:assetRef` (public, immutable, cacheable; canonical account-owned asset reads)
  - `GET /l10n/**` (public; serves published instance packs/live pointers plus Prague overlays)
  - `GET /l10n/v/:token/**` (public; cache-bust wrapper for `/l10n/**` used by Prague)

Security rule (executed):
- `TOKYO_DEV_JWT` must never be used from a browser. Browser product uploads go through same-origin Roma routes using Berlin session auth plus Roma `x-ck-authz-capsule`.
- Asset control routes execute from Roma through a private Cloudflare service binding and Roma-minted `x-ck-authz-capsule`; Tokyo-worker does not rediscover account truth from Supabase or end-user JWTs on those paths.
- `TOKYO_DEV_JWT` is not a universal bypass. Local internal callers must identify themselves explicitly with `x-ck-internal-service`, and Tokyo only honors the specific service ids wired into the route.

Asset-domain note:
- Tokyo upload metadata is ownership/file-centric and stored as per-asset manifest JSON in Tokyo R2.
- Upload/list payloads expose both logical identity (`assetId`) and canonical storage identity (`assetRef`).
- Tokyo runtime materialization resolves logical `assetId` values into canonical `/assets/v/...` reads before config packs are written.
- The current repo snapshot does not persist a canonical "where used" index in Michael/Supabase.

## Links
- Back: ../../CONTEXT.md
- Tokyo Worker: documentation/services/tokyo-worker.md
- Localization contract: documentation/capabilities/localization.md
