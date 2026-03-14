# PRD 069A — LOC Offender Cleanup And AI Readability Restoration

Status: EXECUTING
Date: 2026-03-13
Owner: Product Dev Team
Priority: P0

Source:
- `/Users/piero_macpro/Downloads/clickeen-loc-offenders.pdf`

Environment contract:
- Read truth: local + cloud-dev
- Write order: local first, then cloud-dev
- Canonical startup: `bash scripts/dev-up.sh`

---

## One-line objective

Reduce the report’s LOC offenders so active source files stay readable to humans and AI agents, without introducing behavior drift, fake abstractions, or new build-pipeline complexity.

## Current execution progress

1. Phase 1 slice 1 is landed:
   - shared widget copilot engine extracted to `sanfrancisco/src/agents/widgetCopilotCore.ts`
   - `csWidgetCopilot.ts` reduced to a thin CS product wrapper
   - `sdrWidgetCopilot.ts` reduced to a thin SDR product wrapper
2. This slice preserves:
   - separate CS and SDR product entrypoints
   - separate session namespaces
   - CS-only control-dump guard behavior
3. Phase 1 slice 2 is landed:
   - `bob/lib/session/sessionTypes.ts` extracted for session state, host-message, and default session contracts
   - `bob/lib/session/sessionPolicy.ts` extracted for pure bootstrap/policy helpers
   - `useWidgetSession.tsx` reduced from `2822` LOC to `2494` LOC without changing the React/runtime control flow
4. This slice preserves:
   - existing Bob host postMessage contract
   - existing URL/message boot behavior
   - existing policy/bootstrap resolution behavior
5. Phase 1 slice 3 is landed:
   - `bob/lib/session/sessionLocalization.ts` extracted for localization snapshot normalization, overlay lookup/upsert, and aftermath message resolution
   - `useWidgetSession.tsx` reduced further from `2494` LOC to `2360` LOC without changing save/localization/session behavior
6. This slice preserves:
   - existing localization snapshot contract for Bob open flows
   - existing locale overlay bookkeeping semantics
   - existing save-aftermath messaging behavior
7. Phase 1 slice 4 is landed:
   - `bob/lib/session/sessionNormalization.ts` extracted for widget normalization and typography role-scale defaults
   - `sessionLocalization.ts` now also owns the shared localized-overlay resolution logic used by the full locale snapshot flows
   - `useWidgetSession.tsx` reduced further from `2360` LOC to `2210` LOC without changing Bob URL/message boot or locale fetch/save behavior
8. This slice preserves:
   - existing widget normalization behavior
   - existing global typography role-scale enforcement
   - existing locale stale-state and localized-overlay resolution semantics
9. Phase 1 slice 5 is landed:
   - `sanfrancisco/src/agents/l10nTranslationCore.ts` extracted for prompt construction, batching, placeholder/richtext safety checks, result parsing, and richtext fallback translation
   - `l10nInstance.ts` reduced from `1522` LOC to `872` LOC and now reads as orchestration instead of mixed engine + orchestration
10. This slice preserves:
   - existing l10n job orchestration behavior
   - existing DeepSeek prompt/response contract
   - existing placeholder, richtext tag, and anchor safety enforcement
11. Phase 1 slice 6 is landed:
   - `useWidgetSession.tsx` is now a composition file at `326` LOC
   - extracted modules:
     - `sessionTypes.ts`
     - `sessionPolicy.ts`
     - `sessionLocalization.ts`
     - `sessionNormalization.ts`
     - `sessionConfig.ts`
     - `sessionTransport.ts`
     - `useSessionLocalization.ts`
     - `useSessionEditing.ts`
     - `useSessionBoot.ts`
12. This slice preserves:
   - existing Bob URL boot behavior
   - existing host `postMessage` contract
   - existing account-command delegation behavior
   - existing locale fetch/save/sync behavior
   - existing in-memory editor ops, preview, undo, and budget behavior
13. Phase 1 slice 7 is landed:
   - `sessionTypes.ts` now owns `createInitialSessionState(...)`
   - `useSessionSaving.ts` extracted for account save orchestration, aftermath handling, and translation-monitor triggering
   - `useSessionCopilot.ts` extracted for copilot thread state updates
   - `useWidgetSession.tsx` reduced further from `326` LOC to `131` LOC and now only wires state, modules, memoized context value, and provider/context exports
14. This slice preserves:
   - existing save gating and upsell behavior
   - existing aftermath/degraded-save handling
   - existing post-save translation monitor behavior
   - existing copilot thread state semantics
15. `useWidgetSession.tsx` posture after execution:
   - before: `2822` LOC mixed controller
   - after: `131` LOC composition file
16. Phase 1 slice 8 is landed:
   - `bob/components/TdMenuContent.tsx` reduced from `1823` LOC to `151` LOC
   - extracted modules:
     - `bob/components/td-menu-content/showIf.ts`
     - `bob/components/td-menu-content/dom.ts`
     - `bob/components/td-menu-content/useTdMenuHydration.ts`
     - `bob/components/td-menu-content/useTdMenuBindings.ts`
     - `bob/components/td-menu-content/linkedOps.ts`
     - `bob/components/td-menu-content/fieldValue.ts`
17. This slice preserves:
   - existing show-if parser and visibility semantics
   - existing Dieter asset load and hydration behavior
   - existing linked-op expansion and field-binding behavior
   - existing translate-mode and read-only DOM behavior
18. Remaining Phase 1 work:
   - none
19. Phase 1 status:
   - complete
20. Phase 2 slice 1 is landed:
   - `tokyo-worker/src/index.ts` reduced from `1265` LOC to `596` LOC
   - extracted modules:
     - `tokyo-worker/src/auth.ts`
     - `tokyo-worker/src/supabase.ts`
     - `tokyo-worker/src/asset-utils.ts`
     - `tokyo-worker/src/http.ts`
     - `tokyo-worker/src/types.ts`
21. This slice preserves:
   - existing Tokyo route surface
   - existing Berlin/JWKS upload auth behavior
   - existing l10n bridge header behavior
   - existing asset key/path/hash normalization behavior
22. Phase 2 slice 2 is landed:
   - `sanfrancisco/src/index.ts` reduced from `1133` LOC to `245` LOC
   - extracted modules:
     - `sanfrancisco/src/internalAuth.ts`
     - `sanfrancisco/src/concurrency.ts`
     - `sanfrancisco/src/telemetry.ts`
     - `sanfrancisco/src/l10n-routes.ts`
     - `sanfrancisco/src/personalization-jobs.ts`
23. This slice preserves:
   - existing execute route capability enforcement
   - existing l10n dispatch/plan/translate behavior
   - existing outcome signature verification and D1 indexing behavior
   - existing personalization job queue/status behavior
24. Remaining Phase 2 work:
   - `admin/vite.config.ts`, only after `069B` stabilizes the active route surface
25. Phase 3 slice 1 is landed:
   - `berlin/src/account-state.ts` reduced from `918` LOC to `824` LOC
   - extracted shared public contract types to:
     - `berlin/src/account-state.types.ts`
26. This slice preserves:
   - existing account-state query/normalize/bootstrap logic in one cohesive file
   - existing Berlin account-state route and helper behavior
   - existing cross-module account context/member/bootstrap type contracts
27. Phase 3 slice 2 is landed:
   - `dieter/components/textedit/textedit.ts` reduced from `935` LOC to `367` LOC
   - extracted modules:
     - `dieter/components/textedit/textedit-types.ts`
     - `dieter/components/textedit/textedit-dom.ts`
     - `dieter/components/textedit/textedit-content.ts`
     - `dieter/components/textedit/textedit-links.ts`
   - rebuilt derivative output:
     - `tokyo/dieter/components/textedit/textedit.js`
28. This slice preserves:
   - existing textedit hydration and palette selection behavior
   - existing link validation/apply/remove behavior
   - existing preview synchronization and inline sanitization behavior
   - existing Dieter build output contract
29. Remaining Phase 3 work:
   - `dropdown-fill.ts` only if the boundary is real
   - `berlin/src/account-state.ts` deeper split is intentionally deferred unless a stronger responsibility boundary emerges

---

## Why this PRD exists

The report’s core claim is correct:

1. once files get too large, AIs stop reading them fully
2. the repo falls back to grep-driven edits
3. boundary and runtime mistakes become much more likely

Report baseline:

1. 603 total source files
2. 22 files over the 900 LOC readability threshold
3. 15 source-code offenders
4. 7 admin HTML offenders
5. worst offender:
   - [useWidgetSession.tsx](/Users/piero_macpro/code/VS/clickeen/bob/lib/session/useWidgetSession.tsx)
   - 2822 LOC
6. largest duplicated engine surface to review carefully:
   - `csWidgetCopilot.ts` + `sdrWidgetCopilot.ts`

This PRD is the cleanup track for that report.

---

## Relationship to PRD 069B

This PRD is the broad LOC-offender cleanup track.

`PRD 069B` is the narrow boundary/incident track for:

1. DevStudio widget-workspace route misuse
2. Roma/Bob/Paris widget-instance open boundary cleanup
3. the active split of:
   - [dev-widget-workspace.html](/Users/piero_macpro/code/VS/clickeen/admin/src/html/tools/dev-widget-workspace.html)

Rule:

1. `dev-widget-workspace.html` LOC cleanup is executed through `PRD 069B`
2. `PRD 069A` still tracks it as part of the report, but does not duplicate the route-boundary work

---

## Non-negotiable execution rules

1. No “split” that only moves code around without clarifying responsibilities.
2. No behavior changes unless they are required to preserve existing runtime truth during extraction.
3. No new build pipeline or bundler layer just to split files.
4. Generated or compiled artifacts are not hand-edited as primary source-of-truth fixes.
5. Active runtime contracts and docs must stay true during every extraction.
6. If a file is large because it is generated, fix the generator/source strategy, not the generated blob manually.
7. If a needed item is intentionally postponed, it must be added to [EVERGREEN_BACKLOG.md](/Users/piero_macpro/code/VS/clickeen/Execution_Pipeline_Docs/02-Executing/EVERGREEN_BACKLOG.md) with its source PRD and promotion trigger.

---

## Report items captured by this PRD

### Critical offenders

1. `sanfrancisco/src/agents/csWidgetCopilot.ts`
2. `sanfrancisco/src/agents/sdrWidgetCopilot.ts`
3. `bob/lib/session/useWidgetSession.tsx`

### High offenders

1. `bob/components/TdMenuContent.tsx`
2. `sanfrancisco/src/agents/l10nInstance.ts`
3. `dieter/components/dropdown-fill/dropdown-fill.ts`
4. `admin/vite.config.ts`
5. `tokyo-worker/src/index.ts`

### Medium offenders

1. `sanfrancisco/src/index.ts`
2. `dieter/components/textedit/textedit.ts`
3. `berlin/src/account-state.ts`
4. `tokyo/widgets/shared/typography.js`

### Admin HTML offenders

1. `admin/src/html/tools/dev-widget-workspace.html`
   - executed through PRD 069B
2. `admin/src/html/components/dropdown-fill.html`
3. `admin/src/html/tools/entitlements.html`
4. `admin/src/html/components/button.html`
5. `admin/src/html/foundations/colors.html`
6. generated icon catalogs:
   - `dieteradmin/.../icons.html`
   - `admin/.../foundations/icons.html`

### Compiled artifact policy item

1. `tokyo/dieter/**/*.js` compiled output
   - derivative output
   - not the primary cleanup target
   - must shrink as TS sources are cleaned up and rebuilt

---

## What “done” means here

This PRD is not “make every file tiny at any cost.”

It means:

1. active hand-edited source files are readable by responsibility, not split mechanically to satisfy a number
2. truly generic duplicated logic is factored once, while distinct product behavior stays separate
3. giant files are decomposed by responsibility
4. high-risk active tool and runtime files stop hiding real logic in giant blobs
5. compiled output becomes a consequence of smaller sources, not the main worksite

Target posture:

1. 900 LOC is a readability alarm, not a blind split target
2. target under 800 LOC where that split is natural
3. extracted modules should generally stay reviewable at roughly 200–500 LOC
4. files just over the threshold only move if there is a real responsibility boundary

---

## Execution phases

### Phase 1 — Highest ROI structural cleanup

Goal:
- remove the worst shared-engine duplication and the biggest single-file bottlenecks first

Scope:
1. separate product-specific copilot behavior from truly generic shared engine code:
   - `csWidgetCopilot.ts`
   - `sdrWidgetCopilot.ts`
2. decompose:
   - `useWidgetSession.tsx`
3. extract:
   - `TdMenuContent.tsx` parser/loader/state helpers
4. split:
   - `l10nInstance.ts`

Acceptance:
1. CS and SDR remain separate copilot products with separate prompts, policies, and routing
2. only truly generic copilot engine/helpers are shared
3. `useWidgetSession.tsx` becomes a composition file, not a 2800-line control blob
4. the largest Bob and San Francisco offenders are split by responsibility, not by arbitrary line chunks

### Phase 2 — Dev tooling and worker entrypoint cleanup

Goal:
- reduce oversized middleware/router files that hide cross-service behavior

Scope:
1. split `admin/vite.config.ts`
   - only after `PRD 069B` stabilizes the active DevStudio proxy routes
2. split `tokyo-worker/src/index.ts`
3. split `sanfrancisco/src/index.ts`

Acceptance:
1. Vite config becomes Vite wiring, not a proxy server blob
2. Tokyo Worker entrypoint becomes route/auth wiring, not a monolith
3. San Francisco entrypoint becomes route wiring, not a mixed auth/job/router blob

### Phase 3 — Route-adjacent and medium-risk source cleanup

Goal:
- finish the remaining runtime-adjacent offenders where there is a real responsibility split

Scope:
1. split `dropdown-fill.ts` only if gradient/editor/color responsibilities can be separated cleanly
2. split `textedit.ts` only if editor/link logic can be separated cleanly
3. split `berlin/src/account-state.ts` only if there is a real validation/query/assembly or shared-type boundary
4. defer `tokyo/widgets/shared/typography.js` unless it blocks active work or a clean low-risk split is obvious

Acceptance:
1. no split exists only to satisfy the line threshold
2. Dieter and Berlin changes are backed by a real responsibility boundary
3. widget-runtime and design-system blast radius stays controlled

### Phase 4 — Deferred low-ROI cleanup from the report

Goal:
- track the remaining report items without letting them dominate higher-value cleanup

Scope:
1. admin showcase/demo HTML cleanup:
   - `dropdown-fill.html`
   - `entitlements.html`
   - `button.html`
   - `colors.html`
2. icon catalog classification/generation cleanup
3. any remaining report-listed offender that still has a real split justification after Phases 1–3

Acceptance:
1. low-ROI showcase cleanup does not block the high-value runtime cleanup
2. generated icon catalogs are clearly treated as generated assets, not hand-edited work surfaces
3. any deferred item moved into execution has a clear responsibility-based split rationale
4. postponed work from this phase is recorded in [EVERGREEN_BACKLOG.md](/Users/piero_macpro/code/VS/clickeen/Execution_Pipeline_Docs/02-Executing/EVERGREEN_BACKLOG.md)

---

## Recommended execution order

Use the report’s order only where it matches engineering ROI and stable dependencies:

1. separate copilot product behavior from shared engine/helpers
2. decompose `useWidgetSession.tsx`
3. extract `TdMenuContent.tsx` modules
4. split `l10nInstance.ts`
5. complete the active `069B` route/boundary stabilization that touches `admin/vite.config.ts`
6. extract `admin/vite.config.ts` proxy layer
7. extract `tokyo-worker/src/index.ts` auth/router
8. extract `sanfrancisco/src/index.ts` auth/jobs
9. split `textedit.ts` if the boundary is real
10. split `dropdown-fill.ts` if the boundary is real
11. split `berlin/src/account-state.ts` only if justified by real responsibility separation
12. defer `typography.js` and showcase/demo HTML cleanup unless they become active blockers

---

## File-specific cleanup intent

### Copilot agents

Desired end state:

1. CS and SDR stay separate copilot products
2. shared code is limited to genuinely generic runtime/helpers
3. prompts, capability gates, policy, and product semantics stay product-specific
4. no fake shared abstraction forces the two copilots into one behavior model

### useWidgetSession

Desired end state:

1. bootstrap/session parsing extracted
2. message-boot protocol extracted
3. localization extracted
4. policy/capsule parsing extracted
5. copilot thread state extracted
6. types extracted
7. `useWidgetSession.tsx` becomes composition + provider glue

### TdMenuContent

Desired end state:

1. show-if parser extracted
2. Dieter asset loader extracted
3. preset/state helpers extracted
4. component file mostly renders and wires

### l10nInstance

Desired end state:

1. richtext masking extracted
2. batch splitting extracted
3. prompt/response parsing extracted
4. orchestrator remains readable

### admin/vite.config.ts

Desired end state:

1. proxy logic extracted
2. auth/env helpers extracted
3. Vite config stays Vite config
4. extraction happens after `069B` stabilizes the current route surface

### Worker/service entrypoints

Desired end state:

1. auth extracted
2. route matching extracted
3. entrypoint wires handlers and owns boundary/error behavior only

---

## Acceptance gates

PRD 069A is done only when all of these are true:

1. the high-risk active runtime/tooling offenders targeted by this PRD are split by real responsibility boundaries
2. copilot engine duplication is reduced without collapsing SDR and CS into one copilot
3. `useWidgetSession.tsx` is decomposed into explicit modules/hooks/types
4. `admin/vite.config.ts` is no longer a 1300-line proxy/server blob
5. `tokyo-worker/src/index.ts` and `sanfrancisco/src/index.ts` are decomposed into entrypoint + extracted modules
6. `dev-widget-workspace.html` cleanup is tracked and executed through `69B`
7. deferred showcase/demo cleanup is not confused with the main runtime cleanup track
8. compiled output is treated and documented as derivative output, not as the primary cleanup target
9. docs match the new file/module truth

---

## Failure conditions

Stop and reassess if execution starts doing any of these:

1. splitting files by arbitrary line count without clarifying responsibility boundaries
2. changing runtime behavior under the cover of “cleanup”
3. introducing new framework/build complexity for admin HTML cleanup
4. editing compiled/generated output as if it were the real source of truth
5. duplicating the `69B` widget-workspace boundary work inside this PRD
6. forcing SDR and CS into one shared copilot abstraction because the files look similar
7. splitting Dieter, Berlin, or showcase files just to satisfy the 900 LOC threshold
8. editing `admin/vite.config.ts` in parallel with unstable `069B` route work

---

## Simple and boring end state

The correct end state is boring:

1. large files are split by responsibility
2. generic logic exists once and product-specific copilot behavior stays separate
3. active tool files are readable
4. entrypoints are wiring, not systems
5. generated output is treated as generated output

That is the whole point of PRD 069A.
