# PRD 049A - Editor Contract and Admin Account Unification (Part of PRD 49)

**Status:** EXECUTING (Local complete; cloud-dev runtime verification pending)  
**Date:** 2026-02-19  
**Owner:** Product Dev Team  
**Reviewers:** Human Architect + Product Dev Team peers  
**Environment scope:** Local first (`bash scripts/dev-up.sh`), then cloud-dev  
**Parent PRD:** `Execution_Pipeline_Docs/02-Executing/049__PRD__Infra_and_Architecture_Recovery_Program.md`  
**Sequence:** A (must execute first)  
**Program membership:** This PRD is part of PRD 49 and cannot be executed standalone.

---

## Non-negotiable Tenets (inherited from PRD 49, must hold)

1. Bob in Roma and Bob in DevStudio is the same system.
2. Bob loads entitlements at auth; after that Bob does not re-check entitlements for actions (server still enforces writes).
3. Uploading an asset is simple; uploaded assets flow directly into Tokyo.
4. Deleting an asset is immediate hard delete (with confirm when in use); no soft delete.
5. Asset management is account-tied and straightforward.
6. Assets carry the file name in the system and nothing else.
7. There is no asset fallback.
8. Asset replacement updates embeds immediately and automatically.
9. Assets are global and reusable across unlimited instances in the same account.
10. Admin in Roma and DevStudio is just another account profile (same model, unlimited caps, no ad-hoc runtime path).
11. Everything that works in local works the same way in cloud-dev/Cloudflare.
12. No API file can exceed 800 LOC.
13. There is no legacy support and no back-compat execution path.

---

## 1) Architecture tenet lens for PRD A

1. `Tenet 0 (editing platform, no identity fallbacks)`: builder open identity must be deterministic.
2. `Tenet 2 (orchestrators are dumb pipes)`: host payload shape and Bob kernel contract must be identical across Roma and DevStudio.
3. `Tenet 3 (fail visibly)`: open failures must be explicit and attributable, not split by host-specific behavior.
4. `Tenet 13 (no legacy/backcompat)`: remove legacy `devstudio` contract branches; do not keep compatibility adapters.

---

## 2) Purpose

Unify Bob open behavior across Roma and DevStudio, and remove admin-specific runtime branching so admin is just an account policy profile.

This PRD executes Tenets: 1, 2, 10.

---

## 3) Why this is first

1. All later PRDs depend on one stable editor-open contract.
2. If host contracts remain split, every downstream fix (assets, parity, tests) must be implemented twice.
3. Removing runtime `devstudio` branching early removes the main drift vector.

---

## 4) Code-verified as-is issues

| Issue | Evidence | Impact |
| --- | --- | --- |
| Duplicate open lifecycle logic in both hosts | `roma/components/builder-domain.tsx:191`, `admin/src/html/tools/dev-widget-workspace.html:2790` | Contract drift, duplicate bugs. |
| Subject mode mismatch (`workspace` vs `devstudio`) | `roma/components/builder-domain.tsx:350`, `admin/src/html/tools/dev-widget-workspace.html:2770` | Same Bob kernel receives different runtime contracts. |
| Hardcoded workspace in DevStudio open path | `admin/src/html/tools/dev-widget-workspace.html:816`, `admin/src/html/tools/dev-widget-workspace.html:1334` | Non-deterministic identity model. |
| Bob URL subject defaults to `devstudio` in two places (SSR + unknown subject) | `bob/lib/session/useWidgetSession.tsx:527`, `bob/lib/session/useWidgetSession.tsx:534` | Legacy default can survive even after host contract unification. |
| Policy resolver has explicit `subject=devstudio` branch | `paris/src/shared/policy.ts:13` | Admin path diverges from normal account model. |
| Website creative endpoint requires `profile===devstudio` | `paris/src/domains/workspaces/index.ts:2008` | Ad-hoc admin gate remains in runtime. |
| L10n AI grant subject switches to `devstudio` for curated | `paris/src/domains/l10n/index.ts:364`, `paris/src/domains/l10n/index.ts:1542` | Hidden branch by instance kind. |
| AI grant policy resolver has `devstudio` branch | `paris/src/domains/ai/index.ts:254` | Runtime policy split persists beyond open contract. |
| Bob mutation subject helpers keep devstudio branching | `bob/components/TopDrawer.tsx:7`, `bob/components/CopilotPane.tsx:208` | Write and AI flows can still diverge by legacy profile mapping. |
| DevStudio APIs still hardcode `subject=devstudio` | `admin/src/html/tools/dev-widget-workspace.html:1343`, `admin/src/html/tools/dev-widget-workspace.html:1637` | Host keeps emitting legacy subject even after open payload unification. |
| Roma builder dead-end on missing identity | `roma/components/builder-domain.tsx:464` | Violates deterministic identity/open flow. |

---

## 5) Target contracts

### C1-A: One host-to-Bob open contract

Payload contract for standard editor open in both hosts:

```json
{
  "type": "ck:open-editor",
  "requestId": "uuid",
  "sessionId": "string",
  "subjectMode": "workspace",
  "publicId": "wgt_*",
  "workspaceId": "uuid",
  "ownerAccountId": "uuid",
  "label": "string",
  "widgetname": "string",
  "compiled": {},
  "instanceData": {},
  "localization": {},
  "policy": {},
  "enforcement": {}
}
```

Lifecycle contract:
1. `bob:open-editor-ack`
2. `bob:open-editor-applied` or `bob:open-editor-failed`

Timing:
1. Retry every 250ms.
2. Max 6 ack attempts.
3. 7000ms total timeout.

Shared helper artifact (to prevent host drift):
1. Canonical lifecycle constants and event names live in one artifact: `tooling/contracts/open-editor-lifecycle.v1.json`.
2. Roma and DevStudio must both consume that artifact (no host-local hardcoded retry/timeout values).
3. Any lifecycle change is made in the artifact first; host code changes are invalid without artifact update.

### C1b-A: DevStudio workspace identity resolution (local + cloud-dev)

1. Standard editor flow requires explicit `workspaceId` identity.
2. Resolution order is identical in local and cloud-dev:
   1. `workspaceId` query param (UUID, required if present)
   2. `/api/paris/roma/bootstrap` defaults (`defaults.workspaceId`) when query is missing
   3. explicit fail-visible state if unresolved
3. Remove `DEV_WORKSPACE_ID` and `CLICKEEN_WORKSPACE_ID` from standard editor flow.
4. Curated-only operations use explicit `curatedWorkspaceId` query param; if absent, fallback to resolved `workspaceId`; if still absent, fail visibly.

### C2-A: Policy loaded at open, used at runtime

1. Bob consumes issued `policy` snapshot from open envelope.
2. Bob performs no post-open entitlement re-fetch loop.
3. Server remains authoritative on write endpoints.

### C10-A: Admin is account model, not branch model

1. Admin uses the same open payload and lifecycle as any account.
2. Unlimited behavior comes from policy caps/budgets values.
3. Standard editor runtime path does not depend on `subjectMode: 'devstudio'`.

Admin unlimited representation rule:
1. `subject` remains `workspace` for standard editor flows.
2. Policy is resolved from workspace/account data and emitted entitlements snapshot (not subject name).
3. No endpoint may grant unlimited behavior from role-only or subject-only checks; unlimited must come from policy/entitlements payload.

### C13-A: No legacy/backcompat contract behavior

1. Standard editor open/write/status paths must reject `subjectMode: 'devstudio'` and `subject=devstudio`.
2. Do not ship dual contract readers/writers (no old+new payload support in parallel).
3. Cut over to the single workspace contract in one path and remove legacy branch code.

Deterministic subject mapping required by C13-A:
1. `bob/lib/session/useWidgetSession.tsx::resolveSubjectModeFromUrl` accepts only `workspace|minibob`.
2. `resolveSubjectModeFromUrl` default is `workspace` for SSR and unknown/missing URL subject.
3. `bob/components/TopDrawer.tsx::resolveSubject` becomes `profile === 'minibob' ? 'minibob' : 'workspace'`.
4. `bob/components/CopilotPane.tsx` subject mapping becomes `policyProfile === 'minibob' ? 'minibob' : 'workspace'`.
5. Copilot must fail visibly on `workspace` subject without `workspaceId`; it must not auto-downgrade to `minibob`.

---

## 6) Cross-product dependency trace (anti-drift)

| Surface | Code evidence | Required change under PRD 49 tenets | Drift if skipped |
| --- | --- | --- | --- |
| Roma host open lifecycle | `roma/components/builder-domain.tsx:191` | Extract shared open/ack/retry helper and use it here. Keep `subjectMode: 'workspace'`. | Roma and DevStudio diverge again on timing/error behavior. |
| DevStudio host open lifecycle | `admin/src/html/tools/dev-widget-workspace.html:2790` | Replace duplicated lifecycle code with same helper behavior and same event/error semantics. | DevStudio-only bugs reappear; peer review cannot compare hosts. |
| DevStudio runtime workspace identity | `admin/src/html/tools/dev-widget-workspace.html:816` | Remove hardcoded `DEV_WORKSPACE_ID` from standard open path. Require explicit resolved workspace/account context. | Editor opens against fake identity; account model is violated. |
| Shared host lifecycle artifact | `roma/components/builder-domain.tsx:191`, `admin/src/html/tools/dev-widget-workspace.html:2790` | Both hosts must consume one artifact (`tooling/contracts/open-editor-lifecycle.v1.json`) for retry/ack/timeout/event constants; no duplicated constants. | Same protocol drifts via independent host re-implementation. |
| Builder route producers | `roma/components/use-roma-widgets.ts:112` | Keep single route contract (`subject=workspace`, `workspaceId`, `publicId`) for all Roma entry points (widgets/templates/home handoff). | Different Roma domains generate different Bob-open query contracts. |
| Bob kernel subject resolution (URL + SSR defaults) | `bob/lib/session/useWidgetSession.tsx:527`, `bob/lib/session/useWidgetSession.tsx:534` | Remove both `devstudio` defaults. Accept only `workspace|minibob`; default to `workspace` for SSR and unknown subject. | Legacy subject branch survives even when host payload is unified. |
| TopDrawer mutation subject mapping | `bob/components/TopDrawer.tsx:7` | Replace helper with `profile === 'minibob' ? 'minibob' : 'workspace'` and remove `devstudio` branch. | Rename/publish continues using legacy subject behavior. |
| Copilot subject mapping and missing-workspace behavior | `bob/components/CopilotPane.tsx:208` | Replace mapping with `policyProfile === 'minibob' ? 'minibob' : 'workspace'`. If workspace subject has no `workspaceId`, fail visibly; do not auto-switch subject to minibob. | AI grants silently route through wrong subject semantics. |
| Bob workspace proxy routes | `bob/app/api/paris/workspaces/[workspaceId]/instance/[publicId]/route.ts:28`, `bob/app/api/paris/workspaces/[workspaceId]/instances/route.ts:39` | Enforce one accepted subject for standard editor flow: `workspace`. Keep explicit validation and fail fast. | Subject drift can still enter Paris from Bob API edge. |
| Paris policy resolver | `paris/src/shared/policy.ts:13` | Remove standard-editor `subject=devstudio` branch. Admin unlimited behavior comes from account/profile policy content, not special subject branch. | Admin path keeps separate policy model. |
| Paris workspace/admin operational endpoints | `paris/src/domains/workspaces/index.ts:2008` | Replace `profile===devstudio` gate with explicit authorization rule: `authorizeWorkspace(..., 'owner')` + existing local-only environment guard. Remove profile-based subject gate from this endpoint. | Hidden ad-hoc gate blocks Tenet 10 compliance and forces subject-specific behavior. |
| L10n curated grant subject replacement | `paris/src/domains/l10n/index.ts:364`, `paris/src/domains/l10n/index.ts:1542` | Set grant subject to `workspace` for both curated and user instances; require resolved `workspaceId` (row/instance). Missing workspaceId is explicit failure (`coreui.errors.workspaceId.invalid`), never fallback subject. | Curated path still depends on removed `devstudio` subject or fails unpredictably during cutover. |
| AI grant subject parser/policy resolver | `paris/src/domains/ai/index.ts:235`, `paris/src/domains/ai/index.ts:254` | Remove `devstudio` from accepted AI subject set. `issueAiGrant` supports only `workspace|minibob`; passing `devstudio` must return explicit validation error. | Runtime AI grant path keeps legacy branch even if editor open is unified. |
| DevStudio standard instance APIs | `admin/src/html/tools/dev-widget-workspace.html:1343`, `admin/src/html/tools/dev-widget-workspace.html:1637` | Standard editor load/save/status calls must stop hardcoding `subject=devstudio`; use unified workspace contract. | Host-level API semantics keep drifting even if open payload is fixed. |
| Tenet 12 prerequisite for touched Paris APIs | `paris/src/domains/workspaces/index.ts:1`, `paris/src/domains/l10n/index.ts:1` | Before functional edits, split touched logic into modules so files in scope meet `<=800 LOC` gate. | PRD A lands with non-negotiable Tenet 12 still violated. |

Execution rule for this table:
1. Every row is blocking.
2. No deferred rows, no waivers, no compatibility exceptions.

---

## 7) Implementation scope

### Files/services touched

1. `roma/components/builder-domain.tsx`
2. `roma/components/use-roma-widgets.ts`
3. `admin/src/html/tools/dev-widget-workspace.html`
4. `bob/lib/session/useWidgetSession.tsx`
5. `bob/components/TopDrawer.tsx`
6. `bob/components/CopilotPane.tsx`
7. `bob/app/api/paris/workspaces/[workspaceId]/instance/[publicId]/route.ts`
8. `bob/app/api/paris/workspaces/[workspaceId]/instances/route.ts`
9. `paris/src/shared/policy.ts`
10. `paris/src/domains/workspaces/index.ts`
11. `paris/src/domains/l10n/index.ts`
12. `paris/src/domains/ai/index.ts`
13. `tooling/contracts/open-editor-lifecycle.v1.json` (new artifact)

### Required changes

1. Implement one shared host open lifecycle contract and event timing.
2. Remove hardcoded workspace identity from DevStudio standard open path.
3. Normalize all standard editor subjects to workspace.
4. Keep admin unlimited behavior in policy values, not path branching.
5. Remove standard-editor dependence on `devstudio` branches in policy and AI/l10n grant flows.
6. Remove legacy contract adapters and branch guards once workspace contract is live.
7. Remove both `devstudio` defaults in `resolveSubjectModeFromUrl` (SSR + unknown subject).
8. Apply exact TopDrawer/Copilot subject mapping replacements (`minibob` only special case).
9. Replace website-creative admin gate with explicit owner-role authorization rule (no profile/subject gate).
10. Switch curated L10n AI grants to required workspace subject with explicit workspaceId requirement.
11. Replace DevStudio workspace identity hardcoding with explicit resolver order (query -> bootstrap default -> fail-visible).
12. Enforce shared open-lifecycle artifact usage in both Roma and DevStudio.

Tenet 12 sub-plan inside PRD A (blocking):
1. Split `paris/src/domains/workspaces/index.ts` so website-creative subject/policy edits occur in extracted modules and `index.ts` is reduced to `<=800 LOC`.
2. Split `paris/src/domains/l10n/index.ts` so curated grant-subject edits occur in extracted modules and `index.ts` is reduced to `<=800 LOC`.
3. PRD A functional cutover cannot merge before these two files pass the `<=800 LOC` gate.

---

## 8) Verification

### Core tests

1. Open same instance in Roma and DevStudio; verify identical event order (`session-ready -> ack -> applied`) and timing.
2. Force open failure (bad request/session); verify same `reasonKey` surface in both hosts.
3. Verify no standard open payload emits `subjectMode: 'devstudio'`.
4. Verify rename/publish/AI grant requests from Bob standard flow use `subject=workspace`.
5. Verify admin and non-admin payload shape is identical; only policy values differ.
6. Verify requests with `subjectMode: 'devstudio'` or `subject=devstudio` fail explicitly (no compatibility shim).
7. Verify `resolveSubjectModeFromUrl` defaults to `workspace` for SSR and unknown URL subject.
8. Verify TopDrawer/Copilot emit only `workspace|minibob` subjects and never `devstudio`.
9. Verify curated L10n enqueue paths issue AI grants with `subject=workspace` and explicit `workspaceId`.
10. Verify DevStudio local and cloud-dev resolve workspace identity with same resolver order and produce same fail-visible behavior when unresolved.
11. Verify Roma and DevStudio lifecycle timing values come from shared artifact, not host hardcoded constants.
12. Verify `paris/src/domains/workspaces/index.ts` and `paris/src/domains/l10n/index.ts` are each `<=800 LOC` before PRD A gate closes.

### Environment checks

1. Run local first.
2. Re-run same scenarios in cloud-dev.

---

## 9) Exit gate (blocking)

1. One shared open helper behavior in both hosts.
2. No hardcoded workspace ID in standard editor open path.
3. No standard `devstudio` subject mode for editor open/write/status calls.
4. Admin and non-admin use the same runtime contracts and payload shape.
5. All dependency-table rows are complete.
6. No legacy/backcompat branch remains in standard editor open/write/status flow.
7. No `devstudio` subject branch remains in `paris/src/domains/ai/index.ts`, `paris/src/domains/l10n/index.ts`, or `paris/src/shared/policy.ts`.
8. DevStudio identity resolution is explicit and identical in local + cloud-dev (no hardcoded workspace IDs).
9. `paris/src/domains/workspaces/index.ts` and `paris/src/domains/l10n/index.ts` satisfy Tenet 12 (`<=800 LOC`).

---

## 10) Handover to 049B

049B may start only after 049A gate is green, because all asset workflows depend on one stable and unified editor-open contract.
