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

### Health + Roma domain
- `GET /api/healthz`
- `GET /api/roma/bootstrap`
- `GET /api/roma/widgets` — account-visible instance set (`wgt_main_*` + `wgt_curated_*`) for authenticated Roma/admin flows
- `GET /api/roma/templates` — Roma product starter catalog view over published starter instances
- `POST /api/roma/widgets/duplicate`
- `DELETE /api/roma/instances/:publicId`

### Accounts + instance editing
- `POST /api/accounts` (idempotent account ensure/create in local only; non-local stages reject new account creation)
- `GET /api/accounts/:accountId/instance/:publicId?subject=account` — editor load (1 DB read)
- `PUT /api/accounts/:accountId/instance/:publicId?subject=account` — save draft config/text (1 DB write)
- `POST /api/accounts/:accountId/instances/unpublish`
- `POST /api/accounts/:accountId/lifecycle/plan-change`
- `POST /api/accounts/:accountId/lifecycle/tier-drop/dismiss`

### Locale pipeline (editor surfaces)
- `PUT /api/accounts/:accountId/locales?subject=account` (persist active locales + policy)
- `GET /api/accounts/:accountId/instances/:publicId/l10n/status?subject=account`
- `POST /api/accounts/:accountId/instances/:publicId/l10n/enqueue-selected?subject=account`
- `GET /api/accounts/:accountId/instances/:publicId/layers?subject=account`
- `GET/PUT/DELETE /api/accounts/:accountId/instances/:publicId/layers/:layer/:layerKey?subject=account`

### Minibob + AI + reporting
- `POST /api/minibob/handoff/start`
- `POST /api/minibob/handoff/complete` (non-local stages accept admin account only)
- `POST /api/l10n/jobs/report`
- `POST /api/ai/grant`
- `POST /api/ai/minibob/session`
- `POST /api/ai/minibob/grant`
- `POST /api/ai/outcome`

Current cloud-dev account rule:
- Paris does not create new accounts there.
- Finish/handoff flows complete only against the surviving admin account.

### Public read boundary
- `GET /api/instance/:publicId` (public read; user-owned rows are published-only)

Locale read note:
- Flat locales reads moved to direct Michael access in Bob (`/api/accounts/:accountId/locales` in Bob runtime), so Paris keeps only the write/orchestration path.
- Members reads are served from Roma same-origin routes via direct Michael access (`/api/accounts/:accountId/members`), not Paris.

### Assets boundary
- Asset list/upload/delete are not exposed by Paris.
- Roma/Bob call Tokyo asset endpoints directly with Berlin-backed auth on server routes.
- Paris has no account-level asset operation beyond ref validation in instance writes.

## Health contract

Paris publishes exactly one machine-health endpoint:
- `GET /api/healthz` -> `{ "up": true }`

Non-negotiable:
- Paris does **not** publish `/api/healthz/schema`.
- CI/deploy workflows must not invent health sub-routes that runtime does not expose.
- Cross-service cloud-dev verification belongs in the dedicated runtime verification workflow, not inside unrelated app deploy workflows.

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
