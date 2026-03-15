# System: Paris — Policy + L10n + Mirror Convergence (PRD 54 / PRD 61)

STATUS: REFERENCE — MUST MATCH RUNTIME  
Last updated: 2026-03-15 (PRD 070A/070B split)

Paris is the **control/orchestration boundary** for residual worker-owned state:

- Authz verification for editor surfaces (Roma/Bob)
- Residual l10n/layer routes still mounted in the Worker
- Minibob handoff + AI grant/outcome endpoints

Active product-surface rule (PRD 61):

- Paris accepts the Berlin-issued Roma/Bob bootstrap authz capsule as the post-bootstrap account auth contract for the remaining Paris-mounted account routes (`layers`, `l10n/status`).
- Paris does not re-read `account_members` for those active product routes.
- Paris derives account-route policy/entitlement truth from the signed bootstrap capsule and must not recompute entitlements on those routes.
- Paris account-capsule verification uses one dedicated `ROMA_AUTHZ_CAPSULE_SECRET`. Product auth must not fall back to `AI_GRANT_HMAC_SECRET` or `SUPABASE_SERVICE_ROLE_KEY`.
- Local Paris-to-Tokyo internal reads/writes use the same explicit pattern: `TOKYO_DEV_JWT` plus `x-ck-internal-service: paris.local`. Paris must not rely on a bare Tokyo dev token as universal saved-render authority.

Non-negotiable (PRD 54):

- **Public embeds must never call Paris.** Venice `/e` + `/r` are DB-free.
- Paris does not generate public “render snapshots”. It plans/queues convergence to Tokyo.

---

## Shipped endpoints (this repo snapshot)

### Health

- `GET /api/healthz`

### Accounts + instance editing

- Product-path core instance open/save, localization snapshot rehydrate, and save aftermath are Roma-owned and are not mounted in Paris.

### Locale pipeline (editor surfaces)

- `GET /api/accounts/:accountId/instances/:publicId/l10n/status?subject=account`
- `GET /api/accounts/:accountId/instances/:publicId/layers?subject=account`
- `GET/PUT/DELETE /api/accounts/:accountId/instances/:publicId/layers/:layer/:layerKey?subject=account`

Internal-only:
- `POST /internal/accounts/:accountId/locales/aftermath` — Berlin-triggered locale aftermath orchestration after the account mutation is already committed

### Minibob + AI + reporting

- `POST /api/minibob/handoff/start`
- `POST /api/minibob/handoff/complete` (non-local stages require a platform-owned account)
- `POST /api/l10n/jobs/report`
- `POST /api/ai/grant`
- `POST /api/ai/minibob/session`
- `POST /api/ai/minibob/grant`
- `POST /api/ai/outcome`

Current cloud-dev account rule:

- Finish/handoff flows complete only against the surviving platform-owned account.

### Public read boundary

- `GET /api/instance/:publicId` (public read; user-owned rows are published-only)

Locale/account note:

- Tier lifecycle settings actions are now Berlin-owned through Roma same-origin routes and are no longer mounted in Paris.
- Account creation is Berlin-owned and is no longer mounted in Paris.
- Flat locales reads and writes are served from Berlin-backed Roma same-origin routes.
- Roma starter discovery (`/api/roma/widgets`, `/api/roma/templates`) is Roma-owned and no longer mounted in Paris.
- Paris still owns the locale aftermath/orchestration work after Berlin commits account locale truth.
- Members reads are served from Berlin-backed Roma same-origin routes (`/api/accounts/:accountId/members`), not Paris.
- Product-path core account instance reads now come from Bob/Roma same-origin routes that resolve the saved authoring revision from Tokyo directly.
- Explicit localization snapshot rehydrate and account save aftermath are Roma-owned and no longer mounted in Paris.

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
2. Read the overlay/runtime state it needs for the Worker-owned routes that remain
3. Drive only the internal orchestration or worker-specific work that still lives there

### Product Save (current cutover)

- Bob/Roma same-origin routes commit `config` directly to the Tokyo saved snapshot.
- Product-path save aftermath now runs from Roma against Berlin/Tokyo/San Francisco/Tokyo-worker; it is no longer mounted in Paris.
- The internal account-locales aftermath route must still report degraded orchestration explicitly; it must not return `200 { ok: true }` when locale resync work failed or was skipped in a way that needs operator attention.

### After-Save Convergence (published instance)

If the instance is live (`status="published"`), Paris also enqueues Tokyo mirror jobs:

- `write-text-pack` (base locale always; all locales only when seeding)
- `write-config-pack` (when configFp changes)
- `sync-live-surface` (moves `renders/instances/<publicId>/live/r.json` last)

Current readiness contract:

- Roma/account settings plus entitlements determine the desired locale set.
- Paris translation aftermath reconciles Tokyo toward that desired set for the current `baseFingerprint`.
- Paris may use generation/materialization state internally, but the consumer pointer it sends to Tokyo must contain only `readyLocales` confirmed in Tokyo for that exact fingerprint.
- When a locale becomes ready for a published instance/current fingerprint, Paris reconverges the published surface on the write path; consumer/embed must not wait for another manual save.

### Explicit status change

- `publish` / `unpublish` are Roma-owned widget status commands. Paris is no longer the transport boundary for those commands; it remains available for explicit published-surface convergence work.

Source of truth:

- `roma/lib/account-save-aftermath.ts`
- `paris/src/shared/text-packs.ts` (strip text from config packs so text edits don’t churn `configFp`)
- `paris/src/shared/tokyo-mirror-jobs.ts` (enqueue Tokyo text/meta/config/live-sync jobs)
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

- bootstrap capsule entitlements on active account product routes
- explicit control-plane resolution only at the minting/control boundary (for example Berlin bootstrap or Minibob/session grant flows)

PRD 54 requires:

- SEO/GEO embed to be tier-gated (`embed.seoGeo.enabled`)
- Locale count to be capped (`l10n.locales.max`) at the control plane before the Roma locale set is saved; Paris translation/mirroring then consumes that saved locale set without reinterpreting the cap on the hot path
