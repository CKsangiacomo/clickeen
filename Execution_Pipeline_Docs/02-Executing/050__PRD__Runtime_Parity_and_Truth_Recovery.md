# PRD 50 - DevStudio/Roma Runtime Parity (Host + Context)

## Simple asset tenets (hard, cross-PRD)

1. Asset flow is straightforward. User uploads Asset A in Bob -> Asset A is immediately linked in the instance and stored in Tokyo. User uploads Asset B in Bob -> Asset B is immediately linked in the instance and stored in Tokyo. Bob does not manage assets.
2. Embed does not manage assets. Embed serves exactly what the published embed config references. No fallback, no fixes, no intervention. If an asset was deleted, embed does not show it.
3. Users manage assets only in Roma Assets panel. That is the single place to view assets and fix asset issues. System does not add hidden replacement logic, silent fixes, or fallback behavior.
4. Asset entitlements are enforced in the Roma Assets panel. If user cannot upload due to entitlement, UX routes the user to Assets panel to manage assets.
5. R2 is a simple mirror of Roma Assets panel for account asset namespace. What Roma Assets shows is exactly what exists in R2 under `assets/versions/{accountId}/`. No hidden artifacts, no ghost files, no deferred cleanup, no system-managed invisible storage.

---

Status: EXECUTED (local + cloud-dev parity green)  
Date: 2026-02-26  
Owner: Product Dev Team  
Priority: P0

Environment contract:
- Read truth: local + cloud-dev
- Write order: local first, then cloud-dev
- Canonical startup: `bash scripts/dev-up.sh`

---

## One-line objective

DevStudio and Roma must run the same Bob workflow for curated instance open, edit, save, and publish using the same account/workspace contract.

---

## Fixed tenets (do not reinterpret)

1. DevStudio is an internal tooling surface. It embeds Bob. It uses the same admin account. Widget Workspace is where curated instances are created and managed. Nothing else.
2. Roma (`roma/`) is the product shell for workspace users. It is the product app with login. Right now we run with the admin account in `.env.local`.
3. DevStudio and Roma are two hosts over the same runtime contracts. Local vs cloud-dev is deployment/config, not behavior forks.

---

## Why this PRD exists

Runtime behavior drifted between hosts even when build, lint, and typecheck were green.

The practical impact:
1. Same instance flow behaved differently depending on host.
2. Debugging became host-by-host instead of contract-by-contract.
3. Product work stalled because runtime truth was unclear.

This PRD restores one runtime truth for host behavior.

---

## End state

1. Bob receives the same `ck:open-editor` contract shape from DevStudio and Roma for equivalent workspace flows.
2. Account/workspace identity resolves to the same IDs across hosts for the same signed-in admin user.
3. Open -> edit -> save -> publish works the same from both hosts.
4. Publish-to-embed visibility is measured and inside gate in local and cloud-dev.
5. Runtime parity checks are blocking, not optional.

---

## Current delta vs target

| Area | Current risk | Target |
| --- | --- | --- |
| Host boot contract | Host-specific branching can creep back in | One Bob boot contract used by both hosts |
| Context resolution | Hidden fallback behavior can mask wrong context | Explicit account/workspace resolution with fail-fast errors |
| Publish validation | "Looks fine" manual checks are inconsistent | Measured publish-to-visible gate with evidence |
| Release gating | Static checks can pass while runtime drifts | Runtime parity matrix blocks completion |

---

## Scope

In scope:
1. DevStudio + Roma host parity for Bob open/edit/save/publish.
2. Account/workspace context parity across hosts.
3. Runtime parity gates and evidence.

Out of scope:
1. Asset data-model hard-cut and API contract cleanup (owned by PRD 51).
2. New widget features.
3. UI redesign unrelated to parity.

Boundary with PRD 51:
1. PRD 50 treats asset behavior as black-box runtime proof only (`upload once -> apply once` observed behavior).
2. PRD 51 owns the asset contract internals and endpoint/model changes.

Execution dependency To-Do (focus guard):
1. [x] Do not execute PRD 50 runtime closure before PRD 51 slices A/B/E are complete.
2. [x] Do not patch host/context logic to work around broken asset internals.
3. [x] Only validate asset behavior as runtime proof (`upload once -> apply once`) after PRD 51 changes land.
4. [x] If parity fails due to asset internals, return to PRD 51 checklist instead of adding host-specific fallback.

---

## Execution plan

### Slice A - Host boot contract parity

Goal: both hosts open Bob the same way.

Actions:
1. Keep one canonical `ck:open-editor` message contract for workspace subject.
2. Remove or reject host-only payload variants for standard curated flow.
3. Keep host wiring thin: host fetches context + instance, Bob owns editor runtime.

Primary touchpoints:
1. `admin/src/html/tools/dev-widget-workspace.html`
2. `roma/components/builder-domain.tsx`
3. `bob/lib/session/useWidgetSession.tsx`

Acceptance:
1. Same curated `publicId` opens successfully from both hosts.
2. No host-specific fallback path is needed for standard workspace subject.

### Slice B - Context parity

Goal: same identity in both hosts.

Actions:
1. Normalize account/workspace resolution path from bootstrap.
2. Fail fast on missing/invalid workspace context (`422` reason keys), no silent defaulting.
3. Verify context IDs match between hosts for same signed-in user.

Primary touchpoints:
1. `roma/components/use-roma-me.ts`
2. `roma/app/api/bootstrap/route.ts`
3. `bob/app/api/paris/roma/bootstrap/route.ts`

Acceptance:
1. Matching `userId`, `accountId`, `workspaceId` across hosts in parity probe.
2. Missing context fails explicitly with stable reason keys.

### Slice C - Publish parity

Goal: same publish behavior from both hosts.

Actions:
1. Ensure Bob publish path is identical regardless of host.
2. Measure publish-to-visible latency at embed endpoints.
3. Capture latency evidence for both local and cloud-dev.

Primary touchpoints:
1. `bob/lib/session/useWidgetSession.tsx`
2. `scripts/ci/runtime-parity/scenarios/publish-immediacy.mjs`
3. `scripts/ci/runtime-parity/scenarios/instance-open-parity.mjs`

Acceptance:
1. Publish succeeds from both hosts for same instance.
2. Embed visibility latency passes gates in both environments.

### Slice D - Runtime parity gates (blocking)

Goal: runtime truth is a hard gate.

Actions:
1. Keep runtime parity scenarios current and host-aware.
2. Run local + cloud-dev parity in completion criteria.
3. Record evidence in execution report.

Primary touchpoints:
1. `scripts/ci/runtime-parity/index.mjs`
2. `scripts/ci/runtime-parity/scenarios/bootstrap-parity.mjs`
3. `scripts/ci/runtime-parity/scenarios/public-access-parity.mjs`
4. `scripts/ci/runtime-parity/scenarios/instance-open-parity.mjs`
5. `scripts/ci/runtime-parity/scenarios/publish-immediacy.mjs`
6. `scripts/ci/check-bootstrap-parity.mjs`

Acceptance:
1. Runtime parity suite is green in local and cloud-dev.
2. No PRD completion without runtime evidence.

---

## Required commands

Local:
```bash
bash scripts/dev-up.sh
pnpm test:paris-boundary
pnpm test:bootstrap-parity
pnpm test:runtime-parity:public
pnpm test:runtime-parity:auth
pnpm lint
pnpm typecheck
```

Cloud-dev:
```bash
pnpm test:bootstrap-parity:cloud-dev
pnpm test:runtime-parity:cloud-dev:public
pnpm test:runtime-parity:cloud-dev:auth
pnpm test:runtime-parity:cross-env
```

---

## Manual runtime checklist (blocking)

Local:
1. Open same curated instance in DevStudio and Roma.
2. Edit one visible field in each host.
3. Save and publish from each host.
4. Verify embed reflects publish.
5. Verify asset-backed field applies once without host-specific workaround.

Cloud-dev:
1. Repeat same checklist.
2. Confirm no host divergence.

---

## Evidence to record (`050__Execution_Report.md`)

Record one row per environment with these fields:
1. `host`
2. `publicId`
3. `userId`
4. `accountId`
5. `workspaceId`
6. `openEditorStatus`
7. `saveStatus`
8. `publishStatus`
9. `embedVisibleLatencyMs`
10. `parityResult` (`PASS|FAIL`)

---

## Rollback

1. Roll out slice-by-slice.
2. If a slice regresses runtime behavior, roll back only that slice.
3. Do not start next slice until current slice is green.

---

## Definition of done

All must be true:
1. DevStudio and Roma run the same Bob curated workflow.
2. Account/workspace context parity is proven with matching IDs.
3. Publish parity and latency gates pass in local and cloud-dev.
4. Runtime parity checks are green and treated as blocking evidence.
5. `050__Execution_Report.md` is updated with concrete runtime data.
