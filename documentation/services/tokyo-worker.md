# System: Tokyo Worker — Assets + Tokyo Mirror Jobs (PRD 54)

STATUS: REFERENCE — MUST MATCH RUNTIME  
Last updated: 2026-03-09 (PRD 61 Tokyo-authoring cutover)

Tokyo-worker has two responsibilities:

1. **Assets** (Roma-owned): upload/read/delete account assets in Tokyo/R2 + manifest metadata.
2. **Instance mirror** (PRD 54): write/delete the Tokyo files that Venice serves publicly (config/text/meta packs + live pointers).
3. **Saved authoring snapshot** (PRD 61 cutover): store the latest saved user-instance config in Tokyo so product reads can treat Tokyo as the saved revision base.

Tokyo-worker does not “decide what is live”. Roma/Bob decide; Tokyo-worker mirrors bytes from canonical saved/artifact truth.

---

## Interfaces (this repo snapshot)

### Assets

- `POST /__internal/assets/upload` (private Roma service-binding path)
- `GET /__internal/assets/account/:accountId` (private Roma service-binding path; member-scoped asset manifest list)
- `POST /__internal/assets/account/:accountId/resolve` (private Roma service-binding path; runtime materialization helper)
- `GET /assets/v/:assetRef` (public; immutable)
- `DELETE /__internal/assets/:accountId/:assetId` (private Roma service-binding path; editor+ hard delete metadata + blobs)
- `GET /healthz` (public worker health on `tokyo.dev.clickeen.com/healthz`)
- Integrity tools (dev/internal):
  - `GET /assets/integrity/:accountId`
  - `GET /assets/integrity/:accountId/:assetId`

Current auth rule:

- Product asset control routes execute from Roma through the `TOKYO_ASSET_CONTROL` Cloudflare service binding plus Roma-minted `x-ck-authz-capsule`. Tokyo-worker does not re-read membership/tier/account status on those paths.
- Product render/l10n authoring control routes execute from Roma through the `TOKYO_PRODUCT_CONTROL` Cloudflare service binding plus Roma-minted `x-ck-authz-capsule`. Tokyo-worker does not re-read membership/tier/account status on those paths.
- Shared-secret `CK_INTERNAL_SERVICE_JWT` is not part of the asset lane.
- Local internal tool routes may use `TOKYO_DEV_JWT` only when they also send an explicit allowed `x-ck-internal-service`.
- There is no generic trusted-token bypass on account routes.

Asset metadata model (current repo snapshot):

- Blob bytes live in Tokyo R2 under `assets/versions/{accountId}/...`.
- Per-asset manifest JSON lives in Tokyo R2 under `assets/meta/accounts/{accountId}/assets/{assetId}.json`.
- Manifest stores one canonical immutable blob key (`assetRef`) per asset.
- There is no Michael/Supabase asset table contract in the active runtime.
- Upload contract rejects legacy variant mode (`x-variant` -> `422 coreui.errors.assets.variantUnsupported`).
- Upload contract rejects unsafe filenames (`422 coreui.errors.filename.invalid`) instead of rewriting names server-side.

Health contract:

- Worker health URL: `https://tokyo.dev.clickeen.com/healthz` -> `{ "up": true }`
- `https://tokyo.dev.clickeen.com` intentionally exposes only `/healthz`, `/assets/v/*`, `/fonts/*`, `/l10n/*`, and `/renders/*`. Asset control-plane paths are not publicly routed.

Storage usage truth:

- Upload enforcement uses the authoritative current stored-bytes view derived from Tokyo asset manifests.
- `USAGE_KV` is a warm mirror for downstream account usage reads; it is not the source of truth for write authorization or storage-limit enforcement.
- If the `USAGE_KV` mirror is unavailable, product storage enforcement still uses manifest-backed truth and must not silently allow over-limit writes.

### Public reads (R2 backed)

Tokyo-worker serves R2 objects under stable paths (these are what Venice proxies):

- `GET /renders/**`
- `GET /l10n/**`
- `GET /assets/**`
- `GET /fonts/**`

### Saved authoring snapshot (private Roma product-control lane)

- `GET /__internal/renders/instances/:publicId/saved.json`
- `PUT /__internal/renders/instances/:publicId/saved.json`
- `PATCH /__internal/renders/instances/:publicId/saved.json`
- `DELETE /__internal/renders/instances/:publicId/saved.json`

Current runtime contract:

- This surface is editor-only and requires Roma internal service auth plus a valid Roma account authz capsule (`viewer+` for read, `editor+` for write).
- Local internal repair/tool flows may use `TOKYO_DEV_JWT` only with an explicit allowed `x-ck-internal-service`; Tokyo does not accept a bare dev token as a universal saved-render bypass.
- It stores the latest saved **user-instance** config in Tokyo under:
  - pointer: `renders/instances/<publicId>/saved/r.json`
  - pack: `renders/instances/<publicId>/saved/config/<configFp>.json`
- Local `dev-up` may also use this surface once, explicitly, to repair missing saved authoring snapshots for historical curated/main rows before DevStudio/Bob open them. Editor reads never backfill on demand.
- The saved pointer also carries editor-facing metadata needed on the normal open path (`widgetType`, `displayName`, `source`, `accountId`, `updatedAt`).
- Bob/Roma product-path save writes this snapshot synchronously before returning success.
- Bob/Roma product-path account reads use this Tokyo saved snapshot as the active open/save truth.
- Localization overlay authoring/readback is part of the Tokyo/Tokyo-worker l10n plane; explicit localization rehydrate now reads canonical Tokyo state.

---

## PRD 54 mirror model (what Tokyo-worker writes)

Tokyo-worker writes two kinds of files:

1. **Fingerprinted packs** (immutable)

- Config pack: `renders/instances/<publicId>/config/<configFp>/config.json`
- Text pack: `l10n/instances/<publicId>/packs/<locale>/<textFp>.json`
- Meta pack (tier-gated): `renders/instances/<publicId>/meta/<locale>/<metaFp>.json`

2. **Live pointers** (tiny, mutable, `no-store`)

- Render pointer: `renders/instances/<publicId>/live/r.json`
- Text pointer: `l10n/instances/<publicId>/live/<locale>.json`
- Meta pointer (tier-gated): `renders/instances/<publicId>/live/meta/<locale>.json`

Rule: **write packs first, move pointers last.**

Safety gate (PRD 54):

- `sync-live-surface` refuses to advance `renders/instances/<publicId>/live/r.json` unless:
  - the referenced config pack exists, and
  - **every locale** in `localePolicy.readyLocales` has a live text pointer, and
  - when `seoGeo=true`, every locale in that same ready set also has a live meta pointer.

Rule:
- Tokyo-worker validates the consumer-ready set it was given.
- Tokyo-worker does not interpret plan allowances, account entitlements, or which locales "should" exist.
- Roma/runtime policy decides the desired locale set; Tokyo-worker guarantees the referenced bytes exist and are cheap to serve.

---

## Queue jobs (this repo snapshot)

Queue binding:

- Roma/Tokyo-worker publish mirror jobs onto `instance-render-snapshot-{env}` via `RENDER_SNAPSHOT_QUEUE`.

Job kinds (v1):

- `write-config-pack`
- `write-text-pack`
- `write-meta-pack` (only when entitled)
- `sync-live-surface` (moves `live/r.json`; cleans up removed locales/meta)
- `delete-instance-mirror` (hard delete instance subtree in Tokyo)

Non-negotiable:

- Mirror jobs are **DB-free**. Tokyo-worker must not read Supabase to “discover state”.
- For l10n, Tokyo-worker writes public packs/live pointers from Roma-owned aftermath plus canonical Tokyo overlay state.

Source of truth:

- `tokyo-worker/src/domains/render.ts`

---

## Cleanup (Tokyo is a mirror, not an archive)

When an instance is unpublished (or deleted), Tokyo-worker must remove it from Tokyo:

- Deletes `renders/instances/<publicId>/...`
- Deletes `l10n/instances/<publicId>/...`

This prevents an R2 landfill and keeps “Venice is dumb” true forever.
