# System: Paris — Policy + L10n + Mirror Convergence (PRD 54 / PRD 61)

STATUS: REFERENCE — MUST MATCH RUNTIME  
Last updated: 2026-03-09 (PRD 61 async aftermath + Tokyo-only open/save)

Paris is the **control/orchestration boundary** for product state:

- Authz + policy (entitlements) for editor surfaces (Roma/Bob)
- Paris-owned l10n overlay state in R2/KV
- Enqueues Tokyo-worker jobs so Tokyo/R2 mirrors what is live

Active product-surface rule (PRD 61):

- Paris accepts the Roma/Bob bootstrap authz capsule as the post-bootstrap account auth contract for active product routes (`localization`, `layers`, `l10n/status`, `sync-translations`, `sync-published-surface`, `roma/widgets`, `roma/templates`, `roma/instances/:publicId` delete, account lifecycle settings actions).
- Paris does not re-read `account_members` for those active product routes.
- Local DevStudio remains the explicit local-only trusted-token exception (`PARIS_DEV_JWT` + internal service marker), not a second product auth model.

Non-negotiable (PRD 54):

- **Public embeds must never call Paris.** Venice `/e` + `/r` are DB-free.
- Paris does not generate public “render snapshots”. It plans/queues convergence to Tokyo.

---

## Shipped endpoints (this repo snapshot)

### Health + Roma domain

- `GET /api/healthz`
- `GET /api/roma/bootstrap`
- `GET /api/roma/widgets` — account-visible instance set (`wgt_main_*` + `wgt_curated_*`) for authenticated Roma/admin flows (bootstrap capsule required on the active Roma shell path)
- `GET /api/roma/templates` — Roma product starter catalog view over published starter instances (bootstrap capsule required on the active Roma shell path)
- `DELETE /api/roma/instances/:publicId` (bootstrap capsule required on the active Roma shell path)

### Accounts + instance editing

- `POST /api/accounts` (idempotent account ensure/create in local only; non-local stages reject new account creation)
- `POST /api/accounts/:accountId/instances/:publicId/sync-translations` — explicit translation aftermath from the saved revision
- `POST /api/accounts/:accountId/instances/:publicId/sync-published-surface` — explicit published-surface aftermath from the saved revision
- `POST /api/accounts/:accountId/lifecycle/plan-change` (bootstrap capsule required on the active Roma settings path)
- `POST /api/accounts/:accountId/lifecycle/tier-drop/dismiss` (bootstrap capsule required on the active Roma settings path)

### Locale pipeline (editor surfaces)

- `GET /api/accounts/:accountId/instances/:publicId/localization?subject=account` — explicit localization snapshot rehydrate for Bob/Roma product flows
- `PUT /api/accounts/:accountId/locales?subject=account` (persist active locales + policy)
- `GET /api/accounts/:accountId/instances/:publicId/l10n/status?subject=account`
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

- Flat locales reads moved to direct Michael access in Roma (`/api/accounts/:accountId/locales` in Roma runtime), so Paris keeps only the write/orchestration path.
- Members reads are served from Roma same-origin routes via direct Michael access (`/api/accounts/:accountId/members`), not Paris.
- Product-path core account instance reads now come from Bob/Roma same-origin routes that resolve the saved authoring revision from Tokyo directly.
- Explicit localization snapshot rehydrate remains Paris-backed through a narrow localization-only endpoint, not through a compatibility alias of the full-instance envelope.

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

1. Validate auth/ownership + payload shape
2. Read the saved revision / overlay state it needs
3. Drive only the explicit aftermath requested from that saved revision

### Product Save (current cutover)

- Bob/Roma same-origin routes commit `config` directly to the Tokyo saved snapshot.
- Paris product-path role is explicit save aftermath only: translation sync and published-surface sync after the Tokyo commit.
- Bob/Roma now schedule save aftermath after the save response returns; Paris is no longer on the synchronous save-response path.
- Paris aftermath is observable convergence, not part of a multi-service save transaction. If it warns or fails, the Tokyo save remains committed and the failure is observable through status/logging rather than by rejecting the save.
- Save aftermath now authorizes from the bootstrap authz capsule and the caller-provided save context (`widgetType`, `status`, `source`, `previousConfig`); it does not re-load the product-path instance row from Michael before running account save aftermath.
- If translatable base text changed: Paris enqueues l10n work regardless of `published` / `unpublished`.
- Public mirror writes remain gated by live status.

### After-Save Convergence (published instance)

If the instance is live (`status="published"`), Paris also enqueues Tokyo mirror jobs:

- `write-text-pack` (base locale always; all locales only when seeding)
- `write-config-pack` (when configFp changes)
- `sync-live-surface` (moves `renders/instances/<publicId>/live/r.json` last)

### Explicit status change

- `publish` / `unpublish` are Roma-owned widget status commands. Paris is no longer the transport boundary for those commands; it remains available for explicit published-surface convergence work.

Source of truth:

- `paris/src/domains/account-instances/save-aftermath-handlers.ts`
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

- `packages/ck-policy/entitlements.matrix.json` via `@clickeen/ck-policy`

PRD 54 requires:

- SEO/GEO embed to be tier-gated (`embed.seoGeo.enabled`)
- Locale count to be capped (`l10n.locales.max`) **before** any generation/mirroring
