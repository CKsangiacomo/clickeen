# System: Paris — DB + Policy + Mirror Job Queue (PRD 54)

STATUS: REFERENCE — MUST MATCH RUNTIME  
Last updated: 2026-03-06 (PRD 56/57 hard-cut sync)

Paris is the **write boundary** for product state:
- Authz + policy (entitlements) for editor surfaces (Roma/Bob)
- Minimal Supabase reads/writes for accounts/instances plus Paris-owned l10n overlay state in R2/KV
- Enqueues Tokyo-worker jobs so Tokyo/R2 mirrors what is live

Non-negotiable (PRD 54):
- **Public embeds must never call Paris.** Venice `/e` + `/r` are DB-free.
- Paris does not generate public “render snapshots”. It only persists state and mirrors bytes to Tokyo.

---

## Shipped endpoints (this repo snapshot)

### Instances (editor surfaces only)
- `GET /api/accounts/:accountId/instance/:publicId?subject=account` — editor load (1 DB read)
- `PUT /api/accounts/:accountId/instance/:publicId?subject=account` — save draft config/text (1 DB write)

### Locale pipeline (editor surfaces)
- `PUT /api/accounts/:accountId/locales?subject=account` (persist active locales + policy)
- `GET /api/accounts/:accountId/instances/:publicId/l10n/status?subject=account`
- `POST /api/accounts/:accountId/instances/:publicId/l10n/enqueue-selected?subject=account`
- `GET/PUT/DELETE /api/accounts/:accountId/instances/:publicId/layers/...` (locale overrides storage)

Locale read note:
- Flat locales reads moved to direct Michael access in Bob (`/api/accounts/:accountId/locales` in Bob runtime), so Paris keeps only the write/orchestration path.

### Assets boundary
- Asset list/delete/purge are no longer exposed by Paris.
- Roma/Bob call Tokyo asset endpoints directly with Berlin-backed auth on server routes.
- Paris still triggers asset purge internally during tier-drop orchestration when required.

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
- `paris/src/domains/account-instances/update-handler.ts`
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
