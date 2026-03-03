# System: Paris — DB + Policy + Mirror Job Queue (PRD 54)

STATUS: REFERENCE — MUST MATCH RUNTIME  
Last updated: 2026-03-01 (PRD 54 pivot)

Paris is the **write boundary** for product state:
- Authz + policy (entitlements) for editor surfaces (Roma/Bob)
- Minimal Supabase reads/writes for workspaces/instances/assets metadata
- Enqueues Tokyo-worker jobs so Tokyo/R2 mirrors what is live

Non-negotiable (PRD 54):
- **Public embeds must never call Paris.** Venice `/e` + `/r` are DB-free.
- Paris does not generate public “render snapshots”. It only persists state and mirrors bytes to Tokyo.

---

## Shipped endpoints (this repo snapshot)

### Instances (editor surfaces only)
- `GET /api/workspaces/:workspaceId/instance/:publicId?subject=workspace|minibob` — editor load (1 DB read)
- `PUT /api/workspaces/:workspaceId/instance/:publicId?subject=workspace|minibob` — save draft config/text (1 DB write)
- `GET /api/workspaces/:workspaceId/instances` — list
- `POST /api/workspaces/:workspaceId/instances` — create (idempotent by `publicId`)

### Locale pipeline (editor surfaces)
- `GET /api/workspaces/:workspaceId/instances/:publicId/l10n/status?subject=workspace|minibob`
- `POST /api/workspaces/:workspaceId/instances/:publicId/l10n/enqueue-selected?subject=workspace|minibob`
- `GET/PUT/DELETE /api/workspaces/:workspaceId/instances/:publicId/layers/...` (locale overrides storage)

### PRD 54 deprecations / pivots
- `POST /api/workspaces/:workspaceId/instances/:publicId/render-snapshot` → `410` (deprecated)
- `GET /api/workspaces/:workspaceId/instances/:publicId/publish/status` → minimal status only (no snapshot pipeline)

### Assets (Roma Assets surface)
- `GET /api/accounts/:accountId/assets` — list asset metadata (variants + usage)
- `DELETE /api/accounts/:accountId/assets/:assetId` — hard delete one asset (metadata + blobs)
- `DELETE /api/accounts/:accountId/assets?confirm=1` — forced hard delete all account assets (downgrade/closure)

---

## PRD 54 write behavior (what happens on save / go-dark)

Paris does one boring thing:
1) Validate auth/ownership + payload shape
2) Commit the minimal DB write
3) Enqueue Tokyo mirror jobs **when the instance is live**

### Save (draft)
- `PUT .../instance/:publicId` with `{ config }`
- DB: persists working config (and any locale override rows are separate endpoints)
- If `instance.status !== 'published'`: stop after DB write (no Tokyo writes)

### Save (live instance)
If the instance is live (`status="published"`), Paris also enqueues Tokyo mirror jobs:
- `write-text-pack` (base locale always; all locales only when seeding)
- `write-config-pack` (when configFp changes or first publish)
- `sync-live-surface` (moves `renders/instances/<publicId>/live/r.json` last)

If the instance is made non-live (`published → unpublished`):
- enqueue `delete-instance-mirror` (Tokyo hard delete of instance subtree)

Source of truth:
- `paris/src/domains/workspaces/update-handler.ts`
- `paris/src/shared/mirror-packs.ts` (strip text from config packs so text edits don’t churn `configFp`)
- `paris/src/shared/stable-json.ts` (stable JSON hashing; must match tokyo-worker)

---

## Queue (Paris → Tokyo-worker)

Binding:
- `RENDER_SNAPSHOT_QUEUE` (historical name) is now the **Tokyo mirror jobs** queue.

Jobs are self-contained and must not require tokyo-worker DB reads.

Job kinds (v1):
- `write-config-pack`
- `write-text-pack`
- `write-meta-pack` (tier-gated; not emitted for non-entitled tiers)
- `sync-live-surface`
- `delete-instance-mirror`

---

## Entitlements (tier gating)

Paris resolves policy from:
- `config/entitlements.matrix.json` via `@clickeen/ck-policy`

PRD 54 requires:
- SEO/GEO embed to be tier-gated (`embed.seoGeo.enabled`)
- Locale count to be capped (`l10n.locales.max`) **before** any generation/mirroring
