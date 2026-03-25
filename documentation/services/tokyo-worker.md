# System: Tokyo Worker — Assets + Tokyo Mirror Jobs (PRD 54)

STATUS: REFERENCE — MUST MATCH RUNTIME  
Last updated: 2026-03-18 (PRD 73 public payload + request-boundary closure)

Tokyo-worker has five responsibilities:

1. **Assets** (Roma-owned): upload/read/delete account assets in Tokyo/R2 + manifest metadata.
2. **Saved authoring snapshot** (PRD 61 cutover): store the latest saved user-instance config in Tokyo so product reads can treat Tokyo as the saved revision base.
3. **Canonical l10n identity**: derive/store the current base snapshot + fingerprint when localization/live follow-up consumers need it after save.
4. **Explicit instance sync** (PRD 54): reconcile locale overlays, text/meta packs, runtime config packs, and live pointers when Roma widget/localization routes ask Tokyo-worker to do that work.
5. **Public instance payload assembly**: build the public MiniBob boot payload from Tokyo live truth so Venice stays a thin surface.

Roma Widgets decides whether an instance should become live. Tokyo-worker owns the execution that reconciles bytes and advances live pointers when Roma invokes explicit sync.
Cloudflare Workers observability is the first boring production sink for Tokyo-worker request logs and failures, and internal/account-scoped routes do not inherit public wildcard CORS.

---

## Interfaces (this repo snapshot)

### Assets

- `POST /__internal/assets/upload` (private Roma service-binding path)
- `GET /__internal/assets/account/:accountId` (private Roma service-binding path; member-scoped asset manifest list)
- `GET /__internal/assets/account/:accountId/usage` (private Roma service-binding path; manifest-authoritative storage-bytes read)
- `POST /__internal/assets/account/:accountId/resolve` (private Roma service-binding path; runtime materialization helper)
- `GET /assets/v/:assetRef` (public; immutable)
- `DELETE /__internal/assets/:accountId/:assetId` (private Roma service-binding path; editor+ hard delete metadata + blobs)
- `GET /healthz` (public worker health on `tokyo.dev.clickeen.com/healthz`)
- Integrity tools (dev/internal):
  - `GET /assets/integrity/:accountId`
  - `GET /assets/integrity/:accountId/:assetId`

Current auth rule:

- Product asset control routes execute from Roma through the `TOKYO_ASSET_CONTROL` Cloudflare service binding plus Roma-minted `x-ck-authz-capsule`. Tokyo-worker does not re-read membership/tier/account status on those paths.
- Product asset upload is account-owned only. Tokyo-worker does not accept widget-scoped upload identity (`x-public-id` / `x-widget-type`) on that path.
- Product render/l10n authoring control routes execute from Roma through the `TOKYO_PRODUCT_CONTROL` Cloudflare service binding plus Roma-minted `x-ck-authz-capsule`. The explicit instance-sync route also receives the caller's Berlin bearer so Tokyo-worker can read account locale policy/settings, but authz still comes from the capsule and Tokyo-worker does not rediscover membership/role from Berlin.
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
- Product storage reads now also use the authoritative manifest-backed stored-bytes view through `GET /__internal/assets/account/:accountId/usage`.
- Tokyo-worker does not mirror or heal storage usage into a second store on asset read paths. Asset `GET` routes are read-only.

### Public reads

Tokyo-worker serves R2 objects under stable paths (these are what Venice proxies):

- `GET /renders/**`
- `GET /l10n/**`
- `GET /assets/**`
- `GET /fonts/**`
- `GET /renders/instances/:publicId/live/public-instance.json`

### Saved authoring snapshot (private Roma product-control lane)

- `GET /__internal/renders/instances/:publicId/saved.json`
- `PUT /__internal/renders/instances/:publicId/saved.json`
- `PATCH /__internal/renders/instances/:publicId/saved.json`
- `DELETE /__internal/renders/instances/:publicId/saved.json`
- `POST /__internal/renders/instances/:publicId/sync`
- `POST /__internal/renders/instances/serve-state.json`
- `GET /__internal/l10n/instances/:publicId/translations`

Current runtime contract:

- This surface is editor-only and requires Roma internal service auth plus a valid Roma account authz capsule (`viewer+` for read, `editor+` for write).
- Local internal repair/tool flows may use `TOKYO_DEV_JWT` only with an explicit allowed `x-ck-internal-service`; Tokyo does not accept a bare dev token as a universal saved-render bypass.
- It stores the latest saved **user-instance** config in Tokyo under:
  - pointer: `renders/instances/<publicId>/saved/r.json`
  - pack: `renders/instances/<publicId>/saved/config/<configFp>.json`
- Local `dev-up` may also use this surface once, explicitly, to repair missing saved authoring snapshots for historical curated/main rows before Roma/Bob reads need them. Editor reads never backfill on demand.
- The saved pointer also carries editor-facing metadata needed on the normal open path (`widgetType`, `displayName`, `source`, `accountId`, `updatedAt`).
- Bob/Roma product-path save writes this snapshot synchronously before returning success.
- Product-path save does not read the previous saved pointer to recover sibling metadata. Roma sends the current saved-pointer metadata explicitly on save, and Tokyo-worker writes that payload directly.
- Product-path saved-config validation is owned once at the Tokyo-worker save helper boundary. The internal route does not keep a second parallel save-validity story for the same widget payload.
- Product-path save writes/refreshes the current localization base snapshot/fingerprint on the saved widget pointer in Tokyo from `tokyo/widgets/{widgetType}/localization.json`.
- Product-path save also writes the current saved-widget l10n summary (`baseLocale` + desired locale set) onto that same saved pointer so Builder reads one saved-widget truth plane immediately after save.
- Explicit Tokyo-worker sync refreshes that saved-widget l10n summary, then converges overlay artifacts separately.
- Tokyo maintains one current locale pointer truth over those artifacts.
- Builder Translations reads consume that saved Tokyo l10n summary plus current locale artifact state; they do not live-read Berlin on panel open.
- Bob/Roma product-path save does not inline l10n/live-surface convergence; it writes one durable Tokyo overlay work item and then triggers queue delivery. If queue handoff or later execution fails, Tokyo-worker persists that failure on the work item instead of leaving fake infinite `updating` state behind.
- When a new save writes the current overlay work item for an instance, Tokyo-worker deletes older work items for that same instance so only the latest save remains current workflow truth.
- If locale generation for the latest save does not return current ops for a requested locale, Tokyo-worker does not publish that locale as current-ready for the new `baseFingerprint`.
- For published instances, Tokyo-worker advances the live locale policy with the current-ready locale subset only. A missing locale drops out of public serving until current artifacts exist again.
- Publish is the explicit live flip boundary: Roma calls `POST /__internal/renders/instances/:publicId/sync` with `live: true` so Tokyo-worker materializes the current live surface before publish returns success.
- The internal serve-state read boundary is `POST /__internal/renders/instances/serve-state.json`. Roma uses it for widgets status, publish caps, and save-aftermath routing; Michael status rows are not the canonical answer.
- Bob/Roma product-path account reads use this Tokyo saved snapshot as the active open/save truth.
- `GET /__internal/renders/instances/:publicId/saved.json` is the named saved-document read boundary for Builder. If the saved pointer/config is malformed, Tokyo-worker now returns a validation failure instead of hiding that state as a fake not-found.
- Tokyo-worker now uses that same truthful saved-document read contract across Builder-open, explicit instance sync, and account-localization state. Invalid saved state is not silently collapsed into “missing” in sibling product flows.
- Localization overlay authoring/readback remains part of the Tokyo/Tokyo-worker l10n plane. It is no longer a Builder-localization control loop on the active account authoring path.
- The old Builder-era l10n snapshot/status/user-layer control surface is removed. Builder now reads only the narrow translations panel truth from the saved-widget plane plus current Tokyo-ready artifacts.
- Public MiniBob payload assembly also executes on Tokyo-worker from live Tokyo truth; Venice proxies that payload instead of reconstructing it locally.
- The Tokyo account-localization implementation is now split by Tokyo-owned responsibilities (`state`, `mirror`, `utils`) behind this same domain surface.

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
- Roma decides when explicit sync should run and whether the instance should be live.
- Roma passes the deterministic desired locale intent into Tokyo-worker sync, and Tokyo-worker guarantees the referenced bytes exist and are cheap to serve.

---

## Queue jobs (this repo snapshot)

Queue binding:

- Tokyo-worker publishes mirror jobs onto `instance-render-snapshot-{env}` via `RENDER_SNAPSHOT_QUEUE`.

Job kinds (v1):

- `write-config-pack`
- `write-text-pack`
- `write-meta-pack` (only when entitled)
- `sync-instance-overlays` (durable overlay convergence after save/settings changes)
- `sync-live-surface` (moves `live/r.json`; cleans up removed locales/meta)
- `delete-instance-mirror` (hard delete instance subtree in Tokyo for instance deletion, not normal unpublish)

Non-negotiable:

- Mirror jobs are **DB-free**. Tokyo-worker must not read Supabase to “discover state”.
- For l10n, Tokyo-worker writes public packs/live pointers from its own explicit instance-sync execution plus canonical Tokyo overlay state.

Source of truth:

- `tokyo-worker/src/domains/render.ts`

---

## Cleanup (serve-state off vs delete)

When an instance is unpublished, Tokyo-worker must remove the public live/serve surface in Tokyo so Venice stops serving it.
When an instance is deleted, Tokyo-worker removes the full Tokyo subtree.

- Unpublish removes the live serve surface (`live/r.json` and public-live pointers that make Venice servable)
- Delete removes `renders/instances/<publicId>/...`
- Delete removes `l10n/instances/<publicId>/...`

Unpublish is not a synonym for purging saved documents or internal overlay authoring state.
Delete is the hard cleanup path.
