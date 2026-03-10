# System: Tokyo Worker — Assets + Tokyo Mirror Jobs (PRD 54)

STATUS: REFERENCE — MUST MATCH RUNTIME  
Last updated: 2026-03-09 (PRD 61 Tokyo-authoring cutover)

Tokyo-worker has two responsibilities:

1. **Assets** (Roma-owned): upload/read/delete account assets in Tokyo/R2 + manifest metadata.
2. **Instance mirror** (PRD 54): write/delete the Tokyo files that Venice serves publicly (config/text/meta packs + live pointers).
3. **Saved authoring snapshot** (PRD 61 cutover): store the latest saved user-instance config in Tokyo so product reads can treat Tokyo as the saved revision base.

Tokyo-worker does not “decide what is live”. Bob/Roma decides; Paris commits DB writes; Tokyo-worker mirrors bytes.

---

## Interfaces (this repo snapshot)

### Assets

- `POST /assets/upload` (auth required)
- `GET /assets/account/:accountId` (auth required; member-scoped asset manifest list)
- `GET /assets/v/:assetRef` (public; immutable)
- `DELETE /assets/:accountId/:assetId` (auth required; editor+ hard delete metadata + blobs)
- `GET /healthz` (worker health; workers.dev only)
- Integrity tools (dev/internal):
  - `GET /assets/integrity/:accountId`
  - `GET /assets/integrity/:accountId/:assetId`

Asset metadata model (current repo snapshot):

- Blob bytes live in Tokyo R2 under `assets/versions/{accountId}/...`.
- Per-asset manifest JSON lives in Tokyo R2 under `assets/meta/accounts/{accountId}/assets/{assetId}.json`.
- Manifest stores one canonical immutable blob key (`assetRef`) per asset.
- There is no Michael/Supabase asset table contract in the active runtime.
- Upload contract rejects legacy variant mode (`x-variant` -> `422 coreui.errors.assets.variantUnsupported`).
- Upload contract rejects unsafe filenames (`422 coreui.errors.filename.invalid`) instead of rewriting names server-side.

Health contract:

- Worker health URL: `https://tokyo-assets-dev.clickeen.workers.dev/healthz` -> `{ "up": true }`
- `https://tokyo.dev.clickeen.com` intentionally exposes only `/assets/*`, `/fonts/*`, `/l10n/*`, and `/renders/*`; `/healthz` is not routed there.

### Public reads (R2 backed)

Tokyo-worker serves R2 objects under stable paths (these are what Venice proxies):

- `GET /renders/**`
- `GET /l10n/**`
- `GET /assets/**`
- `GET /fonts/**`

### Saved authoring snapshot (auth required)

- `GET /renders/instances/:publicId/saved.json?accountId=:accountId`
- `PUT /renders/instances/:publicId/saved.json?accountId=:accountId`
- `PATCH /renders/instances/:publicId/saved.json?accountId=:accountId`

Current runtime contract:

- This surface is editor-only and requires account membership auth (`viewer+` for read, `editor+` for write).
- It stores the latest saved **user-instance** config in Tokyo under:
  - pointer: `renders/instances/<publicId>/saved/r.json`
  - pack: `renders/instances/<publicId>/saved/config/<configFp>.json`
- The saved pointer also carries editor-facing metadata needed on the normal open path (`widgetType`, `displayName`, `source`, `accountId`, `updatedAt`).
- Bob/Roma product-path save writes this snapshot synchronously before returning success.
- Bob/Roma product-path account reads use this Tokyo saved snapshot as the active open/save truth.
- Localization overlay authoring/readback is not part of this surface; explicit localization rehydrate still comes from Paris-managed storage in the current cutover.

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
  - **every locale** in `localePolicy.availableLocales` has a live text pointer, and
  - when `seoGeo=true`, every locale also has a live meta pointer.

---

## Queue jobs (this repo snapshot)

Queue binding (historical name, repurposed for PRD 54):

- Paris enqueues mirror jobs onto `instance-render-snapshot-{env}` via `RENDER_SNAPSHOT_QUEUE`.

Job kinds (v1):

- `write-config-pack`
- `write-text-pack`
- `write-meta-pack` (only when entitled)
- `sync-live-surface` (moves `live/r.json`; cleans up removed locales/meta)
- `delete-instance-mirror` (hard delete instance subtree in Tokyo)

Non-negotiable:

- Mirror jobs are **DB-free**. Tokyo-worker must not read Supabase to “discover state”.
- For l10n, Tokyo-worker writes public packs/live pointers from self-contained Paris jobs; authoring overlays remain in Paris-managed storage.

Source of truth:

- `tokyo-worker/src/domains/render.ts`

---

## Cleanup (Tokyo is a mirror, not an archive)

When an instance is unpublished (or deleted), Tokyo-worker must remove it from Tokyo:

- Deletes `renders/instances/<publicId>/...`
- Deletes `l10n/instances/<publicId>/...`

This prevents an R2 landfill and keeps “Venice is dumb” true forever.
