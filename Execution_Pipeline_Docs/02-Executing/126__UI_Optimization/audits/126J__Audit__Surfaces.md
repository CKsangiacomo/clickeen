# 126J - Current-Source Pre-Execution Audit: Surfaces And Bob Workspace

Status: PRE-EXECUTION STEPS 6-8 COMPLETE - current surface doctrine and Bob,
Roma, and DevStudio shell source audited; exact PRD reviewed GREEN at
`22a92ec9`; no Step-9 execution credit.

## Audit Result

The surface vocabulary and D2 product law are already correct in
`documentation/engineering/UI/surfaces.md`. The executable gap is responsive
composition, not a missing surface framework.

Bob was omitted from the old ownership map. It has no later screen PRD, so 126J
must own its D2 implementation. Roma and DevStudio remain exclusive owners of
their shells in 126M and 126L.

## Proven Current Gaps

| Surface | Current source | Gap owner |
| --- | --- | --- |
| Bob | `bob/app/bob_app.css` fixes the editor to `340px 1fr`; `BuilderApp.tsx` always renders ToolDrawer beside Workspace. | 126J |
| Roma | `roma/app/roma.css` collapses below `980px`; `roma-shell.tsx` uses inline `<details>` navigation. | 126M |
| DevStudio | `admin/src/css/layout.css` moves sidebar off-screen below `960px`; `admin/src/main.ts` creates no compact opener. | 126L |
| All three | Fixed `100vh`/no complete safe-area contract and no workspace-mode browser matrix. | Owning J/L/M slice |

## Deletion Map

- 126J replaces Bob's fixed-only composition declarations in place.
- 126L deletes DevStudio's unwired `960px` and collapsed-sidebar half-state.
- 126M deletes Roma's inline `<details>` compact path and generic `980px`
  collapse.
- No app is retained as a compatibility branch and no shared shell framework is
  introduced.

## Scope Boundary

126J changes responsive composition only. It does not change account/session
authority, Bob document state, save, translation, preview-device semantics,
widget runtime, storage, or public serving.

## Evidence Needed At Step 9

- local Bob lint/typecheck/build;
- authenticated Roma-hosted Bob Playwright at five viewports;
- orientation-change and focus-return proof;
- nonblank preview screenshots;
- `bob-dev` and Roma Pages builds at one source SHA;
- reconciled Bob service documentation.
