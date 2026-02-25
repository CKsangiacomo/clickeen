# System: Tokyo Worker - Asset Uploads + Instance l10n Publisher + Render Snapshots

## Identity
- Tier: Supporting
- Purpose: Serve account-owned assets and materialize **instance** localization overlays + **published render snapshots** into Tokyo/R2.

## Interfaces
- `POST /assets/upload` (auth required; account-owned uploads; writes to R2 + Supabase metadata)
- `GET /assets/v/:versionKey` (public; immutable account asset version reads)
- `PUT /assets/:accountId/:assetId` (dev auth; atomic asset content replace)
- `DELETE /assets/:accountId/:assetId` (dev auth; synchronous delete pipeline + impacted-instance snapshot rebuild)
- `POST /l10n/publish` (internal; publish or delete a layer overlay; body: `{ publicId, layer, layerKey, action? }`)
- `POST /l10n/instances/:publicId/:layer/:layerKey` (dev auth; direct overlay write)
- `GET /l10n/**` (public; deterministic overlay paths; immutable by fingerprint, except `index.json`)
- `GET /l10n/v/:token/**` (public; cache-bust wrapper for `/l10n/**` used by Prague; token is ignored for storage keys)
- `GET /renders/instances/:publicId/published.json` (public; no-store published pointer with active revision id)
- `GET /renders/instances/:publicId/revisions/:revision/index.json` (public; immutable per-revision locale artifact map)
- `GET /renders/instances/:publicId/:fingerprint/(e.html|r.json|meta.json)` (public; immutable, cache-forever)
- `POST /renders/instances/:publicId/snapshot` (dev auth; manually generate/delete render snapshot artifacts)

## Dependencies
- Supabase (service role) for `widget_instance_overlays`, `l10n_publish_state`, `l10n_base_snapshots`, `instance_render_health`
- Tokyo R2 bucket for artifacts
- Paris for queueing publish jobs
- Venice for render snapshot generation (Tokyo-worker fetches Venice dynamic endpoints; Venice remains the only renderer)

Asset-domain note:
- Tokyo-worker persists canonical ownership/file metadata in `account_assets` + `account_asset_variants`.
- Instance/path usage mapping is maintained by Paris in `account_asset_usage` as a best-effort sync during instance config writes.
- Asset delete pipeline reads `account_asset_usage`, deletes metadata + blobs synchronously, and rebuilds render snapshots for impacted `publicId`s in the same request.
- Asset delete pipeline performs synchronous Cloudflare purge-by-URL for affected `/assets/v/**` URLs and records instance render-health transitions (`degraded`/`error`) in `instance_render_health`.
- Upload filename normalization enforces non-redundant variant/file naming.
- Upload response includes deterministic metadata (`accountId`, `assetId`, `variant`, `key`, `url`, `workspaceId/publicId/widgetType` trace fields).
- `workspace_id/public_id/widget_type` on `account_assets` are provenance fields only; ownership remains account-bound.
- Upload auth contract:
  - Product path: Supabase session bearer + required `x-workspace-id`; Tokyo-worker enforces workspace membership (`editor+`) and workspace/account binding.
  - Internal/dev path: `TOKYO_DEV_JWT` remains accepted for internal automation endpoints.

## Deployment
- Cloudflare Workers + Queues
- Queue names: `instance-l10n-publish-{env}` (`local`, `cloud-dev`, `prod`)
- Queue names: `instance-render-snapshot-{env}` (`local`, `cloud-dev`, `prod`)
- Scheduled repair publishes only dirty rows (bounded; no full-table scans).

## l10n Publish Flow (executed)
- Reads `widget_instance_overlays` from Supabase (layered).
- Merges `ops + user_ops` for layer=user (user_ops applied last).
- Writes `tokyo/l10n/instances/<publicId>/<layer>/<layerKey>/<baseFingerprint>.ops.json`.
- Writes `tokyo/l10n/instances/<publicId>/bases/<baseFingerprint>.snapshot.json` (allowlist snapshot metadata for diagnostics/non-public tooling).
- Writes `tokyo/l10n/instances/<publicId>/index.json` with layer keys (hybrid index).
- Marks publish state clean in `l10n_publish_state`.
- Records versions in `l10n_overlay_versions` and prunes older versions per tier.

## Local Dev
- If `TOKYO_L10N_HTTP_BASE` is set, publishes to the Tokyo dev server over HTTP.
- `TOKYO_DEV_JWT` is required for dev-only endpoints.
- Asset-delete legal purge path expects `CLOUDFLARE_ZONE_ID` + `CLOUDFLARE_API_TOKEN`; if missing, delete returns explicit partial-failure (`502`) after storage delete.

## Rules
- Overlay files are set-only ops with `baseFingerprint` (required).
- `publicId` is locale-free; locale is a runtime parameter.
- Prague website strings are not handled here; they are published by `scripts/prague-l10n/*` into `tokyo/l10n/prague/**` (repo-owned base + ops overlays).
- Cache semantics:
  - `.../index.json` is mutable and served with a short TTL (`cache-control: public, max-age=60`).
  - Fingerprinted overlay files are immutable (`cache-control: public, max-age=31536000, immutable`).

## Render Snapshots (PRD 38)

**Goal:** allow Venice to serve published `/e/:publicId` + `/r/:publicId` without hitting Paris, by serving immutable artifacts from Tokyo/R2.

Artifacts (authoritative paths):
- `renders/instances/<publicId>/published.json` (no-store pointer to active revision)
- `renders/instances/<publicId>/revisions/<revision>/index.json` (immutable per-locale map for that revision)
- `renders/instances/<publicId>/<fingerprint>/e.html` (immutable)
- `renders/instances/<publicId>/<fingerprint>/r.json` (immutable)
- `renders/instances/<publicId>/<fingerprint>/meta.json` (immutable)

Cache semantics:
- `renders/instances/<publicId>/published.json` is mutable and served `no-store`.
- `renders/instances/<publicId>/revisions/<revision>/index.json` is immutable (`cache-control: public, max-age=31536000, immutable`).
- Fingerprinted render artifacts are immutable (`cache-control: public, max-age=31536000, immutable`).

Generation:
- Triggered by Paris on publish/unpublish (via `instance-render-snapshot-{env}` queue).
- Also triggered by Tokyo-worker after l10n overlay publish; active locale set is resolved from l10n layer index and regenerated as one snapshot job.
- Also triggered by Tokyo-worker after account-asset delete for impacted instances (resolved via `account_asset_usage`).
- Queue success marks instance render health `healthy`; queue failures mark `error` (fail-visible operational state).
- Materialization is done by fetching Venice dynamic endpoints:
  - `/e/:publicId?locale=<locale>`
  - `/r/:publicId?locale=<locale>`
  - `/r/:publicId?locale=<locale>&meta=1`
  - Requests include `X-Ck-Snapshot-Bypass: 1` so Venice **never** serves the old snapshot while generating the next snapshot.
- Snapshot safety rule: for non-EN locales, Tokyo-worker requires Venice responses to report consistent non-EN `X-Ck-L10n-Effective-Locale` and `X-Ck-L10n-Status=fresh`; otherwise snapshot generation fails and the published pointer does not move.

## Links
- Tokyo: `documentation/services/tokyo.md`
- Localization contract: `documentation/capabilities/localization.md`
