# PRD 47 - Roma: Clickeen App Control Plane (System Introduction + Architecture Convergence)

**Status:** PLANNING (01-Planning; peer review required before 02-Executing)  
**Date:** 2026-02-14  
**Owner:** Product Dev Team  
**Reviewers:** Product Dev Team peers + Human Architect  
**Environment scope:** Local first (`bash scripts/dev-up.sh`), then cloud-dev  
**Type:** New system introduction + architecture convergence + product surface unification  
**User-facing change:** Yes (major; introduces the central authenticated control plane for all product domains)

---

## 0) Executive Summary

We introduce **Roma** as the internal system name for the public **Clickeen App** (`app.clickeen.com`).

Roma is not "Bob renamed." Roma is the **control plane** where users manage:

1. Workspaces and membership
2. Widget instances (create, duplicate, publish, archive)
3. Account-owned assets
4. Billing and plan lifecycle
5. Usage, entitlements, and limits visibility
6. AI controls/audit visibility
7. Builder access (Bob as a module)

**Core decision:** keep existing backend boundaries (Paris, Tokyo Worker, Venice, San Francisco, Prague), and add a first-class app shell/control-plane surface that orchestrates these domains coherently.

**Pre-GA rule for this PRD:** no legacy support/backcompat obligations unless explicitly required. Breaking old internal-only flows is allowed and expected if it improves architectural correctness.

---

## 1) Why Now (Evidence)

### 1.1 Current app surface is editor-centric, not control-plane

1. Root Bob page is a launcher, not an app shell:
   - `bob/app/page.tsx:1-7`
2. Bob route is the editor runtime:
   - `bob/app/bob/page.tsx:24-56`
3. Bob system doc defines Bob as editor-only:
   - `documentation/services/bob.md:1-5`

### 1.2 Architecture is explicitly multi-system, so a central control plane is missing

1. Active systems are already split (Prague, Bob, Venice, Paris, Tokyo Worker, San Francisco, etc.):
   - `documentation/architecture/Overview.md:45-56`
2. Production mapping currently points Bob to `app.clickeen.com`, which conflates deployment hostname with product control-plane identity:
   - `documentation/architecture/Overview.md:85-93`

### 1.3 Product motion requires more than editing

1. PLG flow already assumes post-signup app lifecycle beyond a single editor screen:
   - `documentation/strategy/WhyClickeen.md:257-277`
2. Strategic phase model requires scale to additional outputs and cross-output operations:
   - `documentation/strategy/WhyClickeen.md:313-346`

### 1.4 Data and policy already demand account/workspace management surfaces

1. Account/workspace boundary is now explicit:
   - `documentation/capabilities/multitenancy.md:156-170`
2. Account asset APIs exist, but no coherent app surface manages them:
   - `documentation/services/paris.md:114-124`
3. Current auth model remains dev-gated for many non-public endpoints and needs productized auth/rbac integration:
   - `documentation/services/paris.md:207`

### 1.5 Consequence

Without Roma, the system remains functionally fragmented:

1. Editing exists (Bob), but account/workspace/billing/user management remains distributed or internal-only.
2. Growth beyond Phase A app ergonomics is blocked by missing control-plane architecture.
3. Teams will keep adding ad hoc flows into Bob/DevStudio, increasing drift and complexity.

---

## 2) Problem Statement

We currently lack a dedicated **authenticated product control plane** that composes all existing system capabilities under one coherent application model.

This creates five concrete problems:

1. **Identity ambiguity at app level:** "App" is perceived as Bob/editor only.
2. **Operational fragmentation:** billing, assets, members, and usage are not first-class user flows.
3. **Policy fragmentation risk:** subject/tier/account constraints are enforced in backend domains but not surfaced as clear product-level contracts.
4. **Scalability drag:** adding outputs (emails/pages/creatives) will multiply UX/infra fragmentation if no central app shell exists.
5. **Architecture drift:** continued editor-centric additions will violate intended multi-system architecture.

---

## 3) Goals and Non-Goals

### 3.1 Goals

1. Establish **Roma** as the canonical internal system for Clickeen App control-plane concerns.
2. Keep Bob as the **builder module** inside Roma (not the entire app identity).
3. Provide first-class modules for account/workspace/billing/user/assets/instances/usage management.
4. Preserve strict system boundaries:
   - Paris = privileged API + policy + data orchestration
   - Tokyo Worker = uploads/l10n/snapshots
   - Venice = public embed runtime
   - San Francisco = AI execution/learning
   - Prague = acquisition/marketing
5. Remove pre-GA ambiguity and legacy branching that slows future evolution.
6. Define contract-complete execution plan that can move to 02-Executing without ambiguity.

### 3.2 Non-Goals

1. No rewrite of Venice, Paris, Tokyo Worker, or San Francisco into new services.
2. No speculative microservice split of Paris.
3. No additive compatibility layers for old app semantics unless explicitly required.
4. No pre-implementation gold-plating outside control-plane scope.

---

## 4) Hard Architecture Constraints (Non-Negotiable)

1. **Pre-GA contract applies:** strict contracts + fail-fast; no default legacy/backcompat layers.
   - `documentation/architecture/CONTEXT.md:5`
2. **Orchestrators remain dumb pipes:** no widget-specific healing in control-plane layers.
3. **Account/workspace boundaries remain explicit:**
   - account = billing/asset ownership/metering boundary
   - workspace = collaboration/instance boundary
4. **No browser direct access to privileged resources:** clients never hold service role keys.
5. **No hidden fallback behavior:** missing critical config fails visibly.
6. **One control plane, many domains:** Roma must orchestrate, not absorb all domain logic.

---

## 5) System Naming and Identity Contract

### 5.1 Naming

1. Public product name: **Clickeen App**
2. Internal system name: **Roma**
3. Technical slug: `roma`

### 5.2 Domain contract

1. Production: `https://app.clickeen.com`
2. Cloud-dev (recommended): `https://roma.dev.clickeen.com` (while keeping `bob.dev` during transition)
3. Legacy internal dev surface allowed only during migration, not as long-term identity.

### 5.3 Repo contract (target)

1. New app package/folder: `roma/` (`@clickeen/roma`)
2. Bob retained as module/system package (`bob/`) until convergence workstream completes.

---

## 6) Target Architecture (Roma in the Existing System Graph)

### 6.1 Topology

1. **Roma** (Cloudflare Pages / Next.js): authenticated control plane + module router + same-origin API proxy.
2. **Paris** (Workers): source of privileged API operations and policy resolution.
3. **Tokyo Worker** (Workers + R2): uploads/l10n/snapshots.
4. **Venice** (Pages Next.js Edge): public embeds.
5. **San Francisco** (Workers + D1/KV/R2/Queues): AI execution/learning.
6. **Prague** (Pages Astro): marketing acquisition + Minibob entry.

Roma does not replace these systems; it composes them under one coherent app.

### 6.2 Roma responsibilities

1. Session bootstrapping for authenticated app usage.
2. Global navigation and module composition.
3. Product-level RBAC/UI gating using backend-resolved policy.
4. Same-origin API routes that proxy to domain services (primarily Paris, plus upload proxy to Tokyo Worker).
5. Centralized UX primitives for control-plane flows (tables, filters, asset manager, billing state, invites, audit views).

### 6.3 Roma anti-responsibilities

1. No widget rendering ownership (belongs to Tokyo runtime + Bob builder + Venice embed).
2. No direct DB access from browser.
3. No embed runtime logic (belongs to Venice).
4. No AI model/provider secret handling (belongs to San Francisco + Paris grant layer).

---

## 7) Module Architecture (Inside Roma)

### 7.1 Canonical modules

1. `home` - account/workspace summary dashboard
2. `builder` - Bob module entry and editor lifecycle
3. `instances` - instance library (user + curated visibility where policy allows)
4. `assets` - account asset library + usage mapping
5. `team` - workspace members/roles/invites
6. `billing` - subscription, invoices, usage caps, checkout/portal
7. `usage` - plan usage, quota diagnostics, event timelines
8. `ai` - copilot access state, policy profile visibility, outcome/audit diagnostics
9. `settings` - account/workspace preferences, locale defaults, integration toggles

### 7.2 Route contract (target)

1. `/` -> dashboard
2. `/builder/:publicId` -> edit specific instance
3. `/instances` -> instances grid/list
4. `/instances/:publicId` -> instance details
5. `/assets` -> asset library
6. `/assets/:assetId` -> asset detail + usedBy mapping
7. `/team` -> members/roles
8. `/billing` -> plan + payment actions
9. `/usage` -> metering + entitlement diagnostics
10. `/ai` -> AI controls and audit
11. `/settings` -> account/workspace settings

### 7.3 Builder integration contract

1. Bob remains module-authoritative for editing UX and compile contracts.
2. **Decision (locked for this PRD):** Bob exports an importable builder root (example: `<BuilderApp />`) that Roma mounts under `/builder/:publicId`.
3. Roma owns routing/session/nav/context around Builder.
4. Builder launches via Roma route + normalized context payload (`workspaceId`, `accountId`, `policy profile`, `locale`, `entitlement snapshot`).
5. Production integration is in-process component import, not iframe or cross-domain redirect.
6. Temporary local/cloud-dev redirect compatibility is allowed only during migration and must be removed within the legacy retirement window in Workstream I.
7. No separate long-term app identity for Builder.

### 7.4 Control-plane layout contract (Locked UX direction)

1. Roma follows a Dropbox-like high-level layout/information architecture:
   - persistent left navigation rail for global/module wayfinding
   - top command bar for search, scope switchers, and primary actions
   - main content canvas optimized for dense tables, lists, and detail panels
2. This is a structural UX reference, not a visual clone.
3. `home`, `instances`, `assets`, `team`, `billing`, `usage`, `ai`, and `settings` share one shell layout contract.
4. Builder route keeps shared app identity but supports focus mode:
   - shell-level breadcrumbs + account/workspace context remain available
   - builder canvas can reduce surrounding chrome while editing
5. Mobile/tablet behavior:
   - left rail collapses into a drawer
   - top command bar remains the primary command surface
6. Layout ownership belongs to Roma + Dieter primitives; modules cannot fork nav/layout ad hoc.

---

## 8) Cloudflare Runtime and Deployment Model

### 8.1 Platform choice

Roma deploys on **Cloudflare Pages** (Next.js + `@cloudflare/next-on-pages`), consistent with existing app surfaces.

Rationale:

1. Matches existing Bob/Venice Pages operational model.
2. Keeps user-facing app deployment simple.
3. Supports same-origin API routes and edge runtime where needed.

### 8.2 Environment mapping

1. Local: `http://localhost:<roma-port>`
2. Cloud-dev: `roma.dev.clickeen.com`
3. UAT/Limited GA/GA: `app.clickeen.com`

### 8.3 Required env vars (Roma)

1. `PARIS_BASE_URL` (preferred)
2. `NEXT_PUBLIC_PARIS_URL` (fallback for local/dev only)
3. `NEXT_PUBLIC_TOKYO_URL`
4. `TOKYO_DEV_JWT` (local/dev only; never prod)
5. `SANFRANCISCO_BASE_URL`
6. Optional operational flags for pre-GA rollouts

### 8.4 Security constraints

1. `PARIS_DEV_JWT` never present in production Pages env.
2. Roma prod auth must use user/session tokens, not dev bypass keys.
3. Dev surfaces can remain behind Cloudflare Access where needed.

### 8.5 Auth Mechanism (Locked Decision)

1. Roma uses **Supabase Auth** as the canonical user session mechanism (no custom Paris-minted browser session format).
2. Roma stores/reads auth via secure httpOnly session cookies (`Secure`, `SameSite=Lax`, rotation enabled).
3. Roma server routes resolve the Supabase access token from session cookies per request and perform one refresh/rotation attempt when token expiry requires it.
4. Roma forwards access tokens to Paris as `Authorization: Bearer <access_token>`.
5. Paris validates Supabase JWTs (JWKS-based verification) and enforces expected issuer/audience/expiry before deriving account/workspace membership + role context server-side.
6. `PARIS_DEV_JWT` remains local/dev-only fallback and is explicitly disallowed in production path.
7. No silent auto-auth fallback: missing/invalid session returns explicit `401`.

---

## 9) Identity, RBAC, and Policy Architecture

### 9.1 Identity entities

1. `user` (auth identity)
2. `account` (billing + asset ownership boundary)
3. `workspace` (collaboration + instance boundary)

### 9.2 Role model

#### Account-level roles (phased)

Phase 1 (required for first shipped Roma slice):

1. `account_owner`
2. `account_admin`

Phase 2 (add when billing/team modules are fully live in product UI):

1. `account_billing`
2. `account_viewer`

#### Workspace-level roles (existing model extended)

1. `viewer`
2. `editor`
3. `admin`

### 9.3 Policy resolution

1. Roma sends user/session + workspace context to Paris.
2. Paris resolves final policy object:
   - flags
   - caps
   - budgets
   - role capabilities
3. Roma renders UX strictly from resolved policy; Roma does not invent policy logic.

### 9.4 Subject model transition

1. `devstudio|minibob` remains dev/internal policy source during transition.
2. Roma production policy source becomes authenticated user/workspace/account context.
3. Query-param subject overrides are disabled in production control-plane flows.

### 9.5 Minimal capability matrix (Role clarity)

`account_member` = any authenticated account role.
`workspace_member` = `viewer|editor|admin`.
Endpoint matrix aliases: `workspace_admin` = `admin`, `workspace_editor` = `editor`.

| Capability | Scope | Allowed roles (Phase 1) | Allowed roles (Phase 2) |
|---|---|---|---|
| View account summary/workspaces | account | `account_owner`, `account_admin` | + `account_billing`, `account_viewer` |
| Create workspace | account | `account_owner`, `account_admin` | same |
| Manage account invites/members | account | `account_owner`, `account_admin` | same |
| View billing summary | account | `account_owner`, `account_admin` | + `account_billing` |
| Start checkout/portal billing actions | account | `account_owner`, `account_admin` | + `account_billing` |
| Delete/restore account assets | account | `account_owner`, `account_admin` | same |
| List/view account assets | account | `account_member` | same |
| Create/duplicate/archive/publish instances | workspace | `editor`, `admin` | same |
| Manage workspace invites/revokes | workspace | `admin` | same |
| View policy/entitlements/AI profile | workspace | `workspace_member` | same |
| View AI outcomes/audit feed | workspace | `admin` | same |

---

## 10) Data Model Changes (Required for Roma Scope)

This section defines required schema capabilities for control-plane completeness.

### 10.1 Existing baseline (already present)

1. `accounts`, `workspaces.account_id`, `account_assets`, `account_asset_variants`, `account_asset_usage`
2. `widget_instances`, `curated_widget_instances`, `workspace_members`

### 10.2 Required additions

#### A) Account membership and control-plane ownership

1. `account_members`
   - `account_id`
   - `user_id`
   - `role` (`account_owner|account_admin` in Phase 1; add `account_billing|account_viewer` in Phase 2)
   - timestamps
   - unique `(account_id, user_id)`
2. Optional deterministic bootstrap table for migration if needed:
   - `account_bootstrap_events`

#### B) Billing model

1. `account_billing_profiles`
   - `account_id`
   - `provider` (`stripe`)
   - `provider_customer_id`
   - billing email
   - tax region metadata
2. `account_subscriptions`
   - `account_id`
   - `tier`
   - `status`
   - `period_start`
   - `period_end`
   - provider subscription id
3. `billing_events`
   - webhook/event journal for deterministic replay and debugging

#### C) Invite model

1. `workspace_invites`
2. `account_invites`

Both with signed token flow, expiry, inviter id, and acceptance state.

#### D) Audit model

1. `control_plane_audit_events`
   - actor user/account/workspace
   - action key
   - target type/id
   - payload hash / structured details
   - timestamp

### 10.3 Invariants

1. Every workspace belongs to exactly one account.
2. Every user action in Roma is attributable to actor identity.
3. Billing ownership is account-scoped, not workspace-scoped.
4. Instance ownership remains workspace-scoped.
5. Asset ownership remains account-scoped.

---

## 11) API Contract Changes (Paris-Centric)

Roma requires contract-complete API surfaces for control-plane operations.

### 11.1 New/standardized identity endpoints

1. `GET /api/me`
   - returns authenticated user profile + account/workspace memberships
2. `POST /api/accounts`
   - explicit account creation action from Roma bootstrap flow
3. `GET /api/accounts/:accountId`
   - account summary + current tier + billing status
4. `GET /api/accounts/:accountId/workspaces`
5. `POST /api/accounts/:accountId/workspaces`
   - explicit first workspace creation/select flow for newly onboarded users
6. `GET /api/workspaces/:workspaceId`
7. `POST /api/claims/minibob/complete`
   - validates signed claim token and deterministically binds MiniBob draft/instance to account/workspace context

### 11.2 Team and invite endpoints

1. `GET /api/workspaces/:workspaceId/members`
2. `POST /api/workspaces/:workspaceId/invites`
3. `POST /api/workspaces/:workspaceId/invites/:inviteId/revoke`
4. `POST /api/invites/:token/accept`
5. `GET /api/accounts/:accountId/members`
6. `POST /api/accounts/:accountId/invites`

### 11.3 Instance lifecycle endpoints

1. `POST /api/workspaces/:workspaceId/instances` (create)
2. `POST /api/workspaces/:workspaceId/instances/:publicId/duplicate`
3. `POST /api/workspaces/:workspaceId/instances/:publicId/archive`
4. `POST /api/workspaces/:workspaceId/instances/:publicId/unarchive`
5. `POST /api/workspaces/:workspaceId/instances/:publicId/publish`
6. `POST /api/workspaces/:workspaceId/instances/:publicId/unpublish`

### 11.4 Asset library endpoints (extend existing)

1. `GET /api/accounts/:accountId/assets`
2. `GET /api/accounts/:accountId/assets/:assetId`
3. `DELETE /api/accounts/:accountId/assets/:assetId`
4. `POST /api/assets/upload` (Roma proxy to Tokyo Worker)
5. `POST /api/accounts/:accountId/assets/:assetId/restore` (if soft-delete retained)

### 11.5 Billing endpoints

1. `GET /api/accounts/:accountId/billing/summary`
2. `POST /api/accounts/:accountId/billing/checkout-session`
3. `POST /api/accounts/:accountId/billing/portal-session`
4. `POST /api/billing/webhooks/stripe` (server-to-server)

Billing provider decision for this PRD: **Stripe now** (no abstraction layer in this slice).

### 11.6 Usage and entitlement endpoints

1. `GET /api/accounts/:accountId/usage`
2. `GET /api/workspaces/:workspaceId/entitlements`
3. `GET /api/workspaces/:workspaceId/policy`

### 11.7 AI visibility endpoints

1. `GET /api/workspaces/:workspaceId/ai/profile`
2. `GET /api/workspaces/:workspaceId/ai/outcomes`
3. `GET /api/workspaces/:workspaceId/ai/limits`

### 11.8 Stripe Webhook Idempotency Contract

1. Verify webhook signature (`Stripe-Signature`) before any state mutation.
2. Use `stripe_event_id` as global idempotency key in `billing_events` (unique index).
3. Processing order:
   - parse + verify signature
   - check `billing_events` for existing `stripe_event_id`
   - if exists: return `200` (idempotent no-op)
   - if missing: insert `billing_events` row (`received` state)
   - apply deterministic subscription mutation in `account_subscriptions`
   - emit audit event + mark `billing_events` row `applied`
4. Failures:
   - mutation failure marks `billing_events` as `failed` with reason
   - endpoint returns non-2xx so Stripe retries
5. Reconciliation (Phase 2 hardening):
   - Stage 1/2: reconciliation may run manually for validation and drift investigation.
   - Stage 4 (Limited GA/GA): scheduled reconciliation job is required and compares Stripe subscription ground truth with `account_subscriptions`.
   - drift writes a corrective audit event and deterministic patch.

---

## 12) UX Flows (Contract-Level)

### 12.0 Account/Workspace Bootstrap (No Silent Auto-Provisioning)

1. User signs up/authenticates via Supabase Auth.
2. Roma calls `GET /api/me`.
3. If user has no account membership:
   - Roma shows explicit "Create account" step.
   - User submits account creation action.
   - Roma calls `POST /api/accounts`.
4. If account exists but no workspace selected/created:
   - Roma shows explicit workspace creation/selection step.
   - Roma calls `POST /api/accounts/:accountId/workspaces` (create) or selects existing.
5. Only after explicit account + workspace context exists can user enter builder/control-plane modules.
6. No hidden auto-provisioning and no silent fallback account/workspace creation.

### 12.1 Smooth signup + claim handoff from Prague/MiniBob to Bob in Roma

1. User starts in MiniBob on Prague with a draft/instance reference (`publicId`) and claim context.
2. Publish intent triggers signup/auth only if needed.
3. Prague redirects to Roma with signed one-time claim token + claim context.
4. Roma calls Paris claim endpoint immediately to validate token and resolve claim state.
5. If user has no account/workspace yet, Roma runs explicit bootstrap (Section 12.0) while preserving pending claim state.
6. After account/workspace selection/creation, Roma resumes claim automatically without requiring token re-entry.
7. Claim completion endpoint is idempotent (`Idempotency-Key` + token replay protection) so retries and refreshes are safe.
8. Paris binds ownership to target account/workspace and returns canonical builder route.
9. Roma opens `/builder/:publicId` with Bob mounted and recovered draft context.
10. Any failure returns explicit reason-coded blocking UX (`retry`, `switch workspace`, `contact support`) with no silent fallback and no dropped draft.

### 12.2 Create instance in Roma

1. User opens `/instances`.
2. Chooses widget and starter design.
3. Roma calls Paris create endpoint with workspace context.
4. Paris validates entitlements/policy.
5. Roma routes to builder for editing.

### 12.3 Duplicate instance

1. User selects existing instance.
2. Roma calls duplicate endpoint.
3. Paris clones config deterministically, generates new publicId.
4. Roma opens duplicated instance in builder.

### 12.4 Asset upload and reuse

1. User uploads file in builder or asset module.
2. Roma upload proxy calls Tokyo Worker `/assets/upload` with `x-account-id`.
3. Tokyo Worker stores canonical `/arsenale/o/**` path.
4. Paris usage map updates on instance save/publish.
5. Asset library shows where-used mapping and safe delete constraints.

### 12.5 Billing upgrade

1. User opens `/billing`.
2. Roma fetches billing summary.
3. Upgrade action requests checkout session from Paris.
4. User completes payment provider flow.
5. Webhook updates subscription tier.
6. Roma reflects new entitlements without manual intervention.

### 12.6 Team management

1. Admin opens `/team`.
2. Sends invite with role.
3. Invitee accepts token.
4. Paris writes membership.
5. Roma reflects role-scoped UI immediately.

---

## 13) No-Legacy / No-Backcompat Policy (Pre-GA)

This PRD explicitly chooses architecture correctness over compatibility layers.

### 13.1 Allowed breaking changes

1. Retire Bob as standalone app identity for production usage once Roma is active.
2. Remove production support for query-driven subject overrides (`?subject=...`) in authenticated flows.
3. Remove/410 internal-only endpoints accidentally exposed to product routes.
4. Remove stale route aliases that duplicate Roma canonical routes.

### 13.2 Not allowed

1. Silent fallback to old behavior.
2. Hidden compatibility shims that preserve ambiguous ownership/policy semantics.
3. Dual-write patterns without strict invariants and clear retirement deadline.

### 13.3 Failure mode standard

1. Invalid contracts fail with explicit structured errors.
2. Roma surfaces clear error states with deterministic remediation paths.

---

## 14) Workstreams (Execution-Oriented Plan)

### 14.0 Dependency order (Locked)

1. Workstream A is the shell prerequisite for all other workstreams.
2. Workstream C is a hard prerequisite for any non-internal cloud-dev access.
3. Workstream B can start locally in parallel with C, but Builder cloud-dev enablement for non-internal users is blocked until C exit gate is passed.
4. Workstreams D-H require C completion; builder-dependent UX in these modules also depends on B route integration.
5. Workstream I executes after Roma modules are active in cloud-dev/UAT and follows the explicit time-boxed retirement timeline.

## 14.1 Workstream A - Roma App Skeleton and Routing

### What

Create new `roma/` app package and route shell.

### Why

Separate app identity from builder identity and establish control-plane backbone.

### How

1. Add workspace package `@clickeen/roma`.
2. Add core layout/nav/state providers.
3. Implement canonical module routes with placeholders wired to policy-aware guards.
4. Add build/deploy scripts for Pages (`build:cf` pattern).
5. Roma API proxy routes are pass-through only:
   - no request/response semantic rewriting
   - no synthetic success responses
   - upstream `status` + structured error body must bubble as-is.

### Exit Gate

1. Roma runs locally with auth-guarded route shell.
2. Cloud-dev deploy works with `roma.dev` domain.

---

## 14.2 Workstream B - Builder Module Integration

### What

Integrate Bob editor into Roma route space.

### Why

Builder must be one domain of Roma, not the app identity.

### How

1. Add Builder route in Roma.
2. Refactor Bob package to export importable builder root (example: `<BuilderApp />`) and required providers.
3. Mount builder via in-process module import inside Roma route (production contract).
4. Normalize session/bootstrap payload.
5. Keep Bob compile/runtime contracts unchanged.
6. Temporary redirect compatibility in local/cloud-dev (if used) must be explicitly time-boxed and removed per Workstream I cutover.

### Exit Gate

1. Editing flow launched from Roma only in cloud-dev.
2. Workstream C exit gate passed before non-internal cloud-dev builder access.
3. No behavior regression vs current Bob editor for same instance.

---

## 14.3 Workstream C - Identity/RBAC Productization

### What

Replace dev-only auth assumptions in Roma product flows with user/workspace/account auth.

### Why

Control-plane requires production-grade identity semantics.

### How

1. Implement `GET /api/me` and membership resolution.
2. Implement Supabase JWT verification path in Paris for control-plane endpoints.
3. Add account/workspace role checks in Paris for control-plane endpoints.
4. Remove production dependence on `PARIS_DEV_JWT`.
5. This workstream is mandatory before enabling any non-internal cloud-dev access (including Builder routes).

### Exit Gate

1. User can sign in and access only authorized account/workspace resources.
2. Unauthorized access returns deterministic 401/403.

---

## 14.4 Workstream D - Instance Management Module

### What

Implement list/create/duplicate/archive/publish management surface.

### Why

Current instance lifecycle is editor-centric; Roma must support operational management.

### How

1. Build instance grid with workspace filters.
2. Integrate create and duplicate endpoints.
3. Add publish status and locale pipeline visibility.

### Exit Gate

1. End-to-end create -> edit -> publish -> embed flow works from Roma.

---

## 14.5 Workstream E - Asset Library Module

### What

Implement account asset manager in Roma.

### Why

Account-owned assets already exist as backend domain and need user-facing operations.

### How

1. List/search/filter assets by account.
2. Show where-used mapping (`usedBy[]`).
3. Support soft-delete/restore flows with safe guards.
4. Integrate upload entrypoint and canonical URL preview.

### Exit Gate

1. Asset CRUD+usage visibility works from Roma without DevStudio dependency.

---

## 14.6 Workstream F - Billing Module

### What

Add billing and subscription management.

### Why

Billing is a core control-plane domain and must not be implicit/internal.

### How

1. Add billing summary endpoint + UI.
2. Add checkout and portal sessions.
3. Add webhook processing + subscription state updates.
4. Connect plan tier changes to entitlements matrix application.

### Exit Gate

1. Upgrade/downgrade lifecycle updates policy and limits deterministically.

---

## 14.7 Workstream G - Team/User Management Module

### What

Implement workspace and account invite/member management.

### Why

Control-plane without team controls is incomplete and blocks collaboration scale.

### How

1. Add member listing and role mutation UI.
2. Add invite create/revoke/accept flows.
3. Implement audit events for role changes.

### Exit Gate

1. Invite-to-access lifecycle works end-to-end in cloud-dev.

---

## 14.8 Workstream H - AI Controls and Audit Module

### What

Expose AI policy profile and outcome visibility surfaces.

### Why

AI is core platform behavior; control-plane must make it observable and governable.

### How

1. Show current AI profile/limits by workspace tier.
2. Show recent AI outcomes and failure classes.
3. Add safe operational controls (enable/disable feature flags where supported).

### Exit Gate

1. AI usage state is visible and debuggable without diving into logs.

---

## 14.9 Workstream I - Legacy Surface Retirement

### What

Remove app-identity ambiguity and old route clutter.

### Why

Pre-GA architecture requires convergence, not indefinite compatibility.

### How

1. Retire production Bob standalone identity.
2. Apply explicit timeline:
   - `T0` = first successful `roma.dev.clickeen.com` deployment
   - `T0 + 14 days max` = end of Roma/Bob coexistence in cloud-dev
   - `T0 + 21 days max` = `app.clickeen.com` UAT cutover to Roma
   - `T0 + 35 days max` = Bob standalone production path returns `410` (or single-hop redirect for a final 7-day window), then removed
3. Keep redirects short-lived and tracked with explicit removal tasks.
4. Remove obsolete docs/routes/env flags.

### Exit Gate

1. `app.clickeen.com` is Roma, with Builder as one module.

---

## 15) API and Contract Validation Matrix

### 15.1 Contract Matrix (Current Planned Endpoints)

Schema refs use IDs (`*.req.v1`, `*.res.v1`) to keep endpoint contracts explicit and versioned.

| Endpoint | Auth source | Required roles | Schema refs | Idempotency | Audit event |
|---|---|---|---|---|---|
| `GET /api/me` | Supabase session JWT | `authenticated` | `me.read.res.v1` | n/a | `-` |
| `POST /api/accounts` | Supabase session JWT | `authenticated` | `accounts.create.req.v1` / `accounts.create.res.v1` | yes (`Idempotency-Key`) | `account.created` |
| `GET /api/accounts/:accountId` | Supabase session JWT | `account_member` | `accounts.read.res.v1` | n/a | `-` |
| `GET /api/accounts/:accountId/workspaces` | Supabase session JWT | `account_member` | `accounts.workspaces.list.res.v1` | n/a | `-` |
| `POST /api/accounts/:accountId/workspaces` | Supabase session JWT | `account_owner|account_admin` | `workspaces.create.req.v1` / `workspaces.create.res.v1` | yes (`Idempotency-Key`) | `workspace.created` |
| `POST /api/claims/minibob/complete` | Supabase session JWT + signed claim token | `authenticated` | `claims.minibob.complete.req.v1` / `claims.minibob.complete.res.v1` | yes (`Idempotency-Key` + claim token nonce) | `instance.claimed_from_minibob` |
| `GET /api/workspaces/:workspaceId` | Supabase session JWT | `workspace_member` | `workspaces.read.res.v1` | n/a | `-` |
| `GET /api/workspaces/:workspaceId/members` | Supabase session JWT | `workspace_member` | `workspace.members.list.res.v1` | n/a | `-` |
| `POST /api/workspaces/:workspaceId/invites` | Supabase session JWT | `workspace_admin` | `workspace.invites.create.req.v1` / `workspace.invites.create.res.v1` | yes (`Idempotency-Key`) | `workspace.invite.created` |
| `POST /api/workspaces/:workspaceId/invites/:inviteId/revoke` | Supabase session JWT | `workspace_admin` | `workspace.invites.revoke.req.v1` / `workspace.invites.revoke.res.v1` | yes | `workspace.invite.revoked` |
| `POST /api/invites/:token/accept` | invite token + Supabase session | `authenticated` | `invites.accept.req.v1` / `invites.accept.res.v1` | yes | `invite.accepted` |
| `GET /api/accounts/:accountId/members` | Supabase session JWT | `account_member` | `account.members.list.res.v1` | n/a | `-` |
| `POST /api/accounts/:accountId/invites` | Supabase session JWT | `account_owner|account_admin` | `account.invites.create.req.v1` / `account.invites.create.res.v1` | yes (`Idempotency-Key`) | `account.invite.created` |
| `POST /api/workspaces/:workspaceId/instances` | Supabase session JWT | `workspace_editor|workspace_admin` | `instances.create.req.v1` / `instances.create.res.v1` | yes (`Idempotency-Key`) | `instance.created` |
| `POST /api/workspaces/:workspaceId/instances/:publicId/duplicate` | Supabase session JWT | `workspace_editor|workspace_admin` | `instances.duplicate.req.v1` / `instances.duplicate.res.v1` | yes (`Idempotency-Key`) | `instance.duplicated` |
| `POST /api/workspaces/:workspaceId/instances/:publicId/archive` | Supabase session JWT | `workspace_editor|workspace_admin` | `instances.archive.req.v1` / `instances.archive.res.v1` | yes | `instance.archived` |
| `POST /api/workspaces/:workspaceId/instances/:publicId/unarchive` | Supabase session JWT | `workspace_editor|workspace_admin` | `instances.unarchive.req.v1` / `instances.unarchive.res.v1` | yes | `instance.unarchived` |
| `POST /api/workspaces/:workspaceId/instances/:publicId/publish` | Supabase session JWT | `workspace_editor|workspace_admin` | `instances.publish.req.v1` / `instances.publish.res.v1` | yes | `instance.published` |
| `POST /api/workspaces/:workspaceId/instances/:publicId/unpublish` | Supabase session JWT | `workspace_editor|workspace_admin` | `instances.unpublish.req.v1` / `instances.unpublish.res.v1` | yes | `instance.unpublished` |
| `GET /api/accounts/:accountId/assets` | Supabase session JWT | `account_member` | `assets.list.req.v1` / `assets.list.res.v1` | n/a | `-` |
| `GET /api/accounts/:accountId/assets/:assetId` | Supabase session JWT | `account_member` | `assets.get.res.v1` | n/a | `-` |
| `DELETE /api/accounts/:accountId/assets/:assetId` | Supabase session JWT | `account_owner|account_admin` | `assets.delete.req.v1` / `assets.delete.res.v1` | yes | `asset.soft_deleted` |
| `POST /api/assets/upload` | Supabase session JWT + server relay | `workspace_editor|workspace_admin` | `assets.upload.req.v1` / `assets.upload.res.v1` | yes (`Idempotency-Key`) | `asset.uploaded` |
| `POST /api/accounts/:accountId/assets/:assetId/restore` | Supabase session JWT | `account_owner|account_admin` | `assets.restore.req.v1` / `assets.restore.res.v1` | yes | `asset.restored` |
| `GET /api/accounts/:accountId/billing/summary` | Supabase session JWT | `account_owner|account_admin` (Phase 1) + `account_billing` (Phase 2) | `billing.summary.res.v1` | n/a | `-` |
| `POST /api/accounts/:accountId/billing/checkout-session` | Supabase session JWT | `account_owner|account_admin` (Phase 1) + `account_billing` (Phase 2) | `billing.checkout.req.v1` / `billing.checkout.res.v1` | yes (`Idempotency-Key`) | `billing.checkout.initiated` |
| `POST /api/accounts/:accountId/billing/portal-session` | Supabase session JWT | `account_owner|account_admin` (Phase 1) + `account_billing` (Phase 2) | `billing.portal.req.v1` / `billing.portal.res.v1` | yes (`Idempotency-Key`) | `billing.portal.opened` |
| `POST /api/billing/webhooks/stripe` | Stripe signature (service-to-service) | `service` | `billing.webhook.stripe.req.v1` / `billing.webhook.stripe.res.v1` | yes (`stripe_event_id`) | `billing.webhook.applied` |
| `GET /api/accounts/:accountId/usage` | Supabase session JWT | `account_member` | `usage.account.res.v1` | n/a | `-` |
| `GET /api/workspaces/:workspaceId/entitlements` | Supabase session JWT | `workspace_member` | `entitlements.workspace.res.v1` | n/a | `-` |
| `GET /api/workspaces/:workspaceId/policy` | Supabase session JWT | `workspace_member` | `policy.workspace.res.v1` | n/a | `-` |
| `GET /api/workspaces/:workspaceId/ai/profile` | Supabase session JWT | `workspace_member` | `ai.profile.res.v1` | n/a | `-` |
| `GET /api/workspaces/:workspaceId/ai/outcomes` | Supabase session JWT | `workspace_admin` | `ai.outcomes.list.res.v1` | n/a | `-` |
| `GET /api/workspaces/:workspaceId/ai/limits` | Supabase session JWT | `workspace_member` | `ai.limits.res.v1` | n/a | `-` |

### 15.2 Gating Rule (Non-Blocking but Strict)

1. This matrix is the contract baseline for this PRD.
2. For move to `02-Executing`, matrix rows for Workstreams A-D must be implementation-ready (schemas + authz + audit confirmed).
3. Remaining rows must be contract-complete before their corresponding workstream starts.
4. No endpoint may ship without explicit row-level contract completion and test coverage.

---

## 16) Observability, Audit, and SLOs

### 16.0 Enforcement staging

1. Stage 1/2: instrumentation + dashboards are required; SLO thresholds are monitored targets, not release blockers.
2. Stage 3: SLO trends are reviewed as UAT promotion criteria.
3. Stage 4: SLO thresholds + alert baselines become release hardening gates.

### 16.1 Core app SLOs

1. Roma route TTFB p95 <= 300ms (edge-resident pages, non-report views)
2. Control-plane API p95 <= 500ms (read) and <= 800ms (write)
3. Builder handoff navigation <= 1.5s p95 (excluding widget compile cold starts)

### 16.2 Operational telemetry

1. Structured request logs with request id propagation across Roma -> Paris -> downstream.
2. Audit logs for:
   - billing actions
   - role mutations
   - publish/unpublish
   - destructive asset actions
3. Error taxonomy dashboards by `reasonKey`.

### 16.3 Alerting baselines

1. Elevated 5xx rate on control-plane APIs
2. Authentication/authorization anomaly spikes
3. Billing webhook failure backlog
4. Asset upload failure spike

---

## 17) Security and Compliance Requirements

1. Session tokens must be httpOnly and never exposed via JS.
2. CSRF protections on state-changing endpoints.
3. Strict CORS allowlist for non-public APIs.
4. No service-role key leakage to Pages runtime.
5. Billing webhooks must be signed and replay-protected.
6. Audit trail must include actor + action + target + timestamp.

---

## 18) Performance and UX Requirements

1. Dashboard and list views must support pagination/cursor-based APIs.
2. Asset and instance tables must support server-side search/filter/sort.
3. Builder launch from Roma must not regress editor responsiveness.
4. Empty/loading/error states must be deterministic and localizable.
5. Dieter tokens/components are mandatory for all new UI primitives.
6. Roma shell layout must implement the Section 7.4 left-rail + top-command-bar + main-canvas pattern across control-plane modules.
7. MiniBob -> Roma -> Bob PLG handoff must preserve claim context and draft continuity without manual copy/paste or repeated token entry.

---

## 19) Test Strategy and Gates

### 19.1 Required automated gates

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. Control-plane route integration tests for critical flows.
5. Contract tests for new Paris endpoints (workstream-scoped; required before each workstream ships).
6. Security tests for authz failures (401/403 matrix).

### 19.2 Required scenario tests (cloud-dev)

1. Signup -> claim -> builder
2. Create instance -> duplicate -> publish -> embed verification
3. Upload asset -> reuse asset -> delete guard on used asset
4. Invite member -> accept -> role-restricted action attempts
5. Billing upgrade -> entitlement propagation -> gating update
6. Interrupted PLG flow (refresh/session rotation mid-claim) resumes to the same pending claim and lands in `/builder/:publicId` without data loss.
7. Invalid/replayed claim token returns explicit blocking state and causes no ownership mutation.

### 19.3 Rejection criteria

1. Any endpoint with ambiguous authz behavior.
2. Any control-plane flow relying on dev-only secrets in production path.
3. Any silent fallback to legacy behavior.
4. Any MiniBob claim flow that can drop draft context or require manual state reconstruction.

---

## 20) Rollout Plan

### 20.1 Stage 1 - Local

1. Roma app skeleton + module routing
2. Core API contracts wired to local Paris/Tokyo Worker (no mocked success states in critical flows)
3. UI placeholders may show explicit "not implemented" states, but may not fake policy/auth/billing success
4. End-to-end local flows validated without DevStudio dependency

### 20.2 Stage 2 - Cloud-dev

1. Roma deployed at `roma.dev.clickeen.com`
2. Auth productization (Workstream C) completed before non-internal user access
3. Controlled internal use
4. Observability baseline and error burn-in

### 20.3 Stage 3 - UAT

1. Roma promoted to `app.clickeen.com` for allowlisted demo accounts
2. Bob standalone production identity enters short-lived retirement path per Workstream I timeline
3. Validate onboarding, billing, and team flows

### 20.4 Stage 4 - Limited GA then GA

1. Exposure controls per release process
2. Aggressive rollback readiness for critical auth/billing regressions
3. Enable scheduled Stripe reconciliation and enforce SLO/alert baselines as GA hardening gates

---

## 21) Risk Register

### 21.1 High risks

1. Auth transition from dev JWT assumptions to full user/workspace auth introduces permission regressions.
2. Billing state drift if webhook/idempotency is underspecified.
3. Module integration of Bob may introduce session/context inconsistency if contracts are not strict.
4. Account vs workspace role confusion could create security gaps.

### 21.2 Mitigations

1. Contract-first endpoint specs and authz matrix gates.
2. Explicit audit events on all sensitive operations.
3. Idempotent billing event handling and replay-safe webhooks.
4. Scheduled Stripe reconciliation (mandatory by Stage 4) to detect and correct subscription drift.
5. Pass-through proxy conformance tests (status/body bubbling; no synthetic success).
6. Module boundary checks to prevent cross-module state leakage.
7. Staged rollout with hard fail-fast behavior on invalid contracts.

---

## 22) Peer Review Decisions (Locked)

Locked by peer review consolidation (2026-02-14):

1. Internal system naming: `Roma` (approved).
2. Domain strategy:
   - production `app.clickeen.com`
   - cloud-dev `roma.dev.clickeen.com`
3. Builder integration: importable Bob builder module in Roma production path (no iframe/cross-domain production split).
4. Auth foundation: Supabase Auth session/JWT flow (no production `PARIS_DEV_JWT` dependence).
5. Billing provider in this PRD: Stripe direct integration (no abstraction layer in this slice).
6. Legacy retirement: explicit time-boxed coexistence and deprecation timeline in Workstream I.
7. Role model staging:
   - Phase 1: `account_owner|account_admin`
   - Phase 2: `account_billing|account_viewer`
8. Token forwarding contract locked: Roma resolves/refreshes Supabase session token from cookies and forwards `Authorization: Bearer` to Paris; Paris enforces issuer/audience/expiry.
9. Workstream dependency lock: C is a hard prerequisite for any non-internal cloud-dev access (including Builder route availability).
10. Role clarity lock: minimal capability matrix in Section 9.5 is normative for invite/publish/billing/asset authority.
11. Hardening staging lock: scheduled Stripe reconciliation and strict SLO gating are Stage 4 hardening gates, not blockers for Stage 1/2 viability.

Remaining open decision (deferred intentionally):

1. Exact GA-day cutoff for any final Bob redirect window (set during Stage 3 UAT based on observed error rate).

---

## 23) First Review Rubric Responses (Explicit)

This section answers the mandatory `01-Planning` first-review questions.

### 23.1 Elegant engineering + scalability across 100s of widgets?

**Yes, if executed as specified.**

Why:

1. Keeps widget semantics in existing widget/runtime contracts (no control-plane widget branching).
2. Centralizes policy and identity resolution rather than scattering per-feature gating.
3. Uses module boundaries and shared contracts, not one-off screens.

### 23.2 Compliant with architecture and tenets?

**Yes, with clear boundary adherence.**

Why:

1. Preserves Paris/Tokyo Worker/Venice/SF responsibilities.
2. Keeps orchestrators as contract-driven pipes.
3. Enforces pre-GA fail-fast and no hidden fallback behavior.

### 23.3 Avoids over-architecture and unnecessary complexity?

**Yes, by reusing existing systems and introducing only one new app surface.**

Why:

1. No new backend microservice is introduced.
2. No speculative rewrite of mature domains.
3. Complexity is concentrated where it belongs: control-plane app composition.

### 23.4 Moves us toward intended architecture and goals?

**Yes, directly.**

Why:

1. Establishes the missing control-plane needed for product evolution beyond editor-only.
2. Aligns with Phase A/B/C trajectory in strategy docs.
3. Enables coherent account/workspace/billing/asset operations in one place.

---

## 24) Definition of Done for Move to 02-Executing

This PRD can move to `02-Executing` only when all are true:

1. Endpoint matrix is fully specified per Section 15, with Workstreams A-D rows implementation-ready.
2. Data model deltas are translated into concrete migration plan.
3. Module route map is final and accepted.
4. Legacy retirement list has explicit cut dates and no ambiguous "temporary forever" items.
5. Security and billing webhook contracts are explicit and testable.
6. Peer review consolidation is complete and locked in Section 22.

---

## 25) Canonical Outcome Statement

After execution, Clickeen App is no longer "Bob with extras."

It is **Roma**: a coherent control plane that unifies editing, assets, billing, team, usage, and AI governance while preserving strict multi-system architecture boundaries and pre-GA convergence discipline.
