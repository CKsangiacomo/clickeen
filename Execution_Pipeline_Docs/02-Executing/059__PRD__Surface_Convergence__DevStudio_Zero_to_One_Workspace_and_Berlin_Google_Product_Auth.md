# PRD 059 — Surface Convergence: DevStudio Zero-to-One Tool and Berlin/Google Product Auth

Status: EXECUTING
Date: 2026-03-06
Owner: Product Dev Team
Priority: P0 (product/runtime convergence)

> Core mandate: DevStudio is not dead. It was over-cut. Restore it with the correct purpose. At the same time, restore a working Berlin-owned Roma access path now without expanding this PRD into the full future auth/account program.

Context note:
- PRD 056 established the current auth boundary: Berlin is AuthN, Roma completes startup, Paris owns ensure-account + MiniBob handoff claim.
- A documentation correction pass on 2026-03-06 already fixed item `2` (usage/billing placeholder status) and item `3` (MiniBob -> account -> Roma is one continuous journey).
- Execution update (runtime): DevStudio local is being corrected to read and write the admin account’s instances directly through an explicit trusted local path. It must not depend on Roma starter discovery or product session auth just to read those instances.
- Execution update (runtime): DevStudio local now also owns its asset route family (`/api/devstudio/assets*`) so Bob/Dieter inside DevStudio do not rely on product `/api/assets*` routes.
- Execution update (runtime): DevStudio translation status is best-effort. If local San Francisco is unavailable, DevStudio returns `Unavailable` instead of surfacing hard `500` errors for the editor.
- Execution update (runtime): Roma access is currently restored through Berlin-owned session endpoints for both Google and email/password. This is an access-unblock decision, not the final long-term auth/account architecture.
- Execution update (runtime contract): non-local Roma/Bob auth now forces HTTPS redirects and cookie security at the request boundary, so cloud-dev auth completion does not depend on proxy-presented internal scheme.
- The two remaining cross-cutting issues are coupled:
  1. The DevStudio tool was replaced by a deprecation page, even though zero-to-one widget creation still needs a local authoring studio.
  2. Auth is still being separated from local tool behavior, but the larger multi-provider / multi-account redesign is not part of this PRD.
- PRD 059 defines the target surface split and auth split so implementation and documentation can converge again.

Environment contract:
- Integration truth: cloud-dev.
- Local is for building and authoring iteration.
- Standard local startup: `bash scripts/dev-up.sh`.
- No destructive Supabase resets.
- No git reset/rebase/force-checkout.

---

## Required Review Answers

### 1) Elegant engineering and scalability

Yes. This PRD reduces the system to:
- one product admin surface (`Roma`)
- one zero-to-one authoring surface (`DevStudio Local`)
- one current product access boundary (Berlin-owned auth for Roma)
- one local tool mode (explicit local-only tool auth)

That scales across 100s of widgets because the split is by responsibility, not by widget.

### 2) Compliance to architecture and tenets

Yes.
- Berlin remains the only AuthN boundary.
- Roma remains the authenticated product shell.
- Bob remains the editor kernel.
- DevStudio becomes a narrow internal tool again instead of a fake second product shell.
- MiniBob remains a pre-account editing surface whose state is claimed into Roma.

### 3) Avoid over-architecture and unnecessary complexity

Yes.
- No local Roma parity.
- No third auth mode.
- No separate “onboarding system” invented for MiniBob.
- No speculative admin platform inside DevStudio.

### 4) Move toward intended architecture and goals

Yes.
- 80% widget/admin operations live in cloud Roma with a real account.
- DevStudio survives only where it has unique leverage: zero-to-one widget birth.
- Product auth becomes boring and explicit.

---

## One-line Objective

Restore the DevStudio tool as a local-only zero-to-one widget studio, keep day-2 widget/admin operations in cloud Roma, and restore a working Berlin-owned Roma access path now without turning PRD 59 into the full future auth/account redesign.

---

## Instance Model

There is one set of instances on the admin account.

- One instance per widget may be shown first in MiniBob.
- That is what the team calls `main`.
- Other instances for that widget are still just instances.
- Roma shows those same instances as starters.
- Prague renders those same instances as embeds.
- Other accounts duplicate from those instances into their own account.

Hard rule:
- `main` is a designation, not a separate type.
- DevStudio must not invent a second local/source instance type.

---

## The Problem This PRD Fixes

### 1. DevStudio was over-cut

`admin/src/html/tools/dev-widget-workspace.html` is currently a deprecation page. That removed a still-needed internal tool:
- building a new widget from scratch
- iterating on `spec.json` + runtime behavior quickly
- validating Bob/editor behavior before the widget is mature enough for product/admin flows

That was not the intended simplification.

### 2. DevStudio and Roma responsibilities are blurred

The intended split is:
- Roma cloud admin account for the majority of operational widget management
- DevStudio Local for the narrow zero-to-one authoring loop

The repo currently contains both stories:
- docs that still describe a real DevStudio tool
- a live DevStudio page that says the tool is deprecated

### 3. Auth currently mixes product and tool stories

Current repo reality:
- Berlin + Roma finish flow exists
- Google login route exists in Roma
- password login still exists
- Bob local proxy still resolves `PARIS_DEV_JWT` in `ENV_STAGE=local`
- `bob/wrangler.toml` still contains a literal `PARIS_DEV_JWT`

This creates exactly the kind of ambiguity that causes drift:
- product auth vs local tool auth
- supported cloud path vs local convenience path
- runtime truth vs documented security model

### 4. The product needs one boring access story now

For users, the product should behave like one app:
- Prague/MiniBob acquisition
- Berlin login
- Roma product shell
- Bob editor

No surface should require users or AI agents to reason about internal auth exceptions.

---

## Target Surface Ownership

| Surface | Target role | Must not become |
|---|---|---|
| Prague | Marketing + acquisition + MiniBob entry | Auth/session owner, account admin shell |
| MiniBob | Pre-account editing/acquisition surface | Separate product/account model |
| Roma (cloud, admin account included) | Authenticated product/admin shell for day-2 operations | Local dev tool, unauth bypass surface |
| DevStudio Local | Zero-to-one widget authoring studio | Local Roma clone, general admin shell |
| DevStudio Cloudflare | Read-only deploy verification / docs/tools shell | Write-capable product admin |
| Bob | Editor kernel used by Roma/MiniBob/DevStudio | Auth boundary, account provisioning owner |
| Berlin | Product AuthN boundary | Product shell, provisioning service |

Hard rule:
- If a workflow is product/account-facing and works with a real account, it belongs in Roma.
- If a workflow is source-of-widget-software authoring and only makes sense during widget birth, it belongs in DevStudio Local.

---

## DevStudio Tool: Correct Purpose

### DevStudio Local must exist again

Route stays:
- `/#/tools/dev-widget-workspace`

But the purpose changes from “local parity tool” to:
- **zero-to-one widget authoring studio**

### DevStudio Local owns only these jobs

1. Open Bob locally for the widget under construction.
2. Load the admin account’s instances for that widget through an explicit trusted local route.
3. Reset local working state from current widget defaults.
4. Open the `wgt_main_*` instance and other instances for real config iteration.
5. Check translations/localization on those instances in Bob.
6. Write updated defaults back into the widget source of truth (`tokyo/widgets/{widget}/spec.json`) when explicitly requested.
7. Keep widget defaults aligned with the current instance state when explicitly requested.
8. Provide the shortest loop for:
   - `spec.json` editing
   - control schema validation
   - Bob ToolDrawer behavior
   - runtime preview behavior
   - widget-package birth work

Current trusted local route family:
- instances: `/api/devstudio/instances*`
- assets: `/api/devstudio/assets*`
- widget catalog: `/api/devstudio/widgets`

### DevStudio Local must not own these jobs

1. Local Roma parity.
2. General account management.
3. Cloud-authenticated product flows.
4. Day-2 operational curated-instance management as the primary path.
5. Billing, usage, team, or account-shell domains.

### Roma owns the 80% path

Roma cloud with the admin account is the operational surface for:
- starter-catalog consumption using the instances on the admin account
- product-facing instance workflows
- publish/live behavior
- translations/locales in normal product context
- account assets
- embed/copy-code operational flow

This is the intended simplification.

### Consequence

We do **not** restore the old DevStudio tool as-is.
We restore a **narrower** tool with a cleaner job.

---

## Auth Contract: Exactly Two Modes

### Mode A — Product auth (supported path)

This is the supported product auth model for cloud-dev and the intended product architecture:

1. User starts from Prague or Roma.
2. Roma starts a Berlin-owned login path.
3. Berlin handles provider start/callback and issues `finishId`.
4. Roma `/api/session/finish` completes server-side:
   - redeem finish
   - issue cookies
   - ensure account if needed
   - complete MiniBob handoff if present
   - redirect to final product route
5. Bob and Roma product routes use Berlin-backed session cookies only.
6. Paris/Tokyo-worker product-facing server routes trust Berlin bearer/session auth only.

Product auth principles:
- Current cloud-dev access may use Google or email/password if both converge into the same Berlin -> Roma session contract.
- MiniBob publish/signup uses this same path.
- No product auth flow uses `PARIS_DEV_JWT`.

### Mode B — Local tool auth (explicit development convenience)

This mode exists only to let local DevStudio/Bob author widgets without product login ceremony.

It is allowed only when all are true:
1. `ENV_STAGE=local`
2. the surface is explicitly tool-owned (`surface=devstudio`)
3. the call is server-side within the local DevStudio/Bob toolchain

Local tool auth principles:
- no browser-visible login flow
- no Roma product route may rely on it
- no cloud runtime may rely on it
- the secret must come from local env/secret configuration only
- no committed token in Pages config

### Hard rule

There is no third mode.

Not allowed:
- semi-product local auth
- cloud Pages using `PARIS_DEV_JWT`
- hidden hybrid fallbacks where product routes silently become tool-trusted

---

## Transitional Auth Reality

PRD 59 does not attempt to finish the full auth/account platform.

Current execution rule:
- Roma cloud access must work now through Berlin-owned login paths.
- Google and email/password are both acceptable current access modes if they converge into the same Roma session contract.
- The future multi-provider / multi-user / paid-vs-free account model is a separate PRD.

---

## MiniBob Contract (Restated, Not Reopened)

This PRD does **not** introduce a separate onboarding or enrichment system.

The contract remains:
1. User edits in MiniBob.
2. User may provide website/context while editing.
3. User clicks Publish.
4. User creates/signs into an account via the supported product auth path.
5. Roma completes handoff.
6. The draft instance is claimed into the account and the user continues in Roma.

PRD 59 depends on this contract staying simple.

---

## Route and Surface Contract

### Keep / use

Berlin:
- `POST /auth/login/provider/start`
- `GET /auth/login/provider/callback`
- `POST /auth/finish`
- `POST /auth/refresh`
- `POST /auth/logout`

Roma:
- `GET /api/session/login/google` — Berlin-owned Google login start
- `GET /api/session/finish` — server-side completion gate
- `POST /api/session/logout`
- `POST /api/session/login` — Berlin-owned email/password login path

Paris:
- `POST /api/accounts`
- `POST /api/minibob/handoff/complete`

DevStudio:
- `/#/tools/dev-widget-workspace` — restored local zero-to-one tool

### Must not be reintroduced

1. Local Roma parity as an architectural goal.
2. Generic wildcard auth bypass for product routes.
3. DevStudio Cloudflare write flows.
4. Browser-visible product usage of `PARIS_DEV_JWT`.

---

## Execution Plan

### Phase 1 — Restore the DevStudio tool with the correct scope

1. Replace the current deprecation-only page in `admin/src/html/tools/dev-widget-workspace.html` with a real local authoring tool again.
2. Keep the route the same to avoid churn.
3. Use Bob message boot with explicit `surface=devstudio`.
4. Limit the tool to zero-to-one widget-authoring actions only.
5. Remove any wording that implies DevStudio is a dead surface.
6. Remove DevStudio dependence on `/api/roma/templates` and any product-session-gated starter discovery.
7. Show the admin account’s instances directly, with one `main` instance shown first when it exists.

Phase 1 gate:
- A developer can start local with `bash scripts/dev-up.sh`, open DevStudio, and iterate on the admin account’s instances for a widget without product login.

### Phase 2 — Reassert Roma as the day-2 operational/admin surface

1. Keep product/account/curated operational workflows in Roma cloud with a real admin account.
2. Keep Roma starter discovery as a product view over the same instances on the admin account.
3. Remove stale DevStudio docs/README text that still claim DevStudio is the general operational owner.
4. Ensure documentation says DevStudio edits those instances, Roma consumes the same instances as starters, and Prague consumes the same instances as embeds.

Phase 2 gate:
- An AI team can tell, from docs alone, where a workflow belongs without guessing.

### Phase 3 — Restore a working Berlin-owned Roma access path

1. Make Roma cloud login work through Berlin-owned session endpoints.
2. Confirm Roma finish remains the single server-side completion gate.
3. Confirm Google and email/password both converge into the same Roma/Bob shared-cookie session model.
4. Keep the larger auth/account redesign out of PRD 59.

Phase 3 gate:
- Cloud Roma login works.
- MiniBob publish/signup lands the user in Roma with claimed instance continuity.

### Phase 4 — Hard-cut auth ambiguity

1. Confine local tool-trusted auth to explicit local DevStudio/Bob tool flows only.
2. Remove committed or cloud-configured `PARIS_DEV_JWT` usage from product-facing Pages config.
3. Update docs so they describe:
   - one product auth mode
   - one local tool mode
   - the transition state, if any

Phase 4 gate:
- No product/runtime doc implies `PARIS_DEV_JWT` is part of supported product auth.
- Repo config no longer teaches that product pages should carry dev JWTs.

---

## Verification

### Local

1. `bash scripts/dev-up.sh`
2. Open the DevStudio tool.
3. Load/open a widget under construction in Bob.
4. Reset from current defaults.
5. Apply changes and sync the local baseline/default-authoring flow.

### Cloud-dev

1. Start from Roma login.
2. Complete either supported Berlin login path.
3. Complete Berlin callback / login -> Roma finish when applicable.
4. Land in Roma with usable account context.
5. Open Builder and confirm Bob works with shared cookies.

### MiniBob continuity

1. Start in Prague MiniBob.
2. Change draft content and provide a website if applicable.
3. Click Publish.
4. Complete the supported login/signup path.
5. Confirm the user lands in Roma with the claimed instance continuity intact.

### Auth boundary checks

1. Grep confirms no product-facing route depends on `PARIS_DEV_JWT` in cloud mode.
2. Grep/config check confirms no committed Pages config carries a product dev JWT.
3. Docs match the actual split after implementation.

---

## In Scope

- Restore the DevStudio tool as a real local tool again.
- Narrow DevStudio responsibility to zero-to-one widget authoring.
- Reassert Roma as the operational/admin surface.
- Restore a working Berlin-owned Roma access path.
- Confine local tool-trusted auth to explicit local DevStudio flows.
- Update instance docs when the implementation lands.

## Out of Scope

- Billing or usage implementation.
- Reworking MiniBob personalization product behavior.
- Reopening assets/l10n storage decisions from prior PRDs.
- Building local Roma parity.
- Adding more auth providers or the full future account/auth model.
- Large Bob editor refactors unrelated to surface/auth convergence.

---

## Documentation That Must Be Updated When This Ships

- `documentation/services/devstudio.md`
- `documentation/services/roma.md`
- `documentation/services/bob.md`
- `documentation/services/berlin.md`
- `documentation/architecture/CONTEXT.md`
- `documentation/architecture/Overview.md`
- `documentation/README.md`
- `admin/README.md`

---

## Summary

PRD 59 makes the system simpler, not broader:
- DevStudio returns, but only as a zero-to-one widget studio.
- Roma stays the real product/admin shell.
- Berlin owns the current Roma access story.
- Local tool auth becomes explicit, local-only, and non-leaky.
- The larger auth/account redesign is explicitly separate from this PRD.

That is the clean split the repo should teach and the code should implement.
