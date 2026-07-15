# 126A - PRD: Accessibility

Status: PRE-EXECUTION STEP 7 COMPLETE - final executable plan records four direct semantic/copy-gap groups; step 8 exact-tree peer review and all step-9 implementation remain pending.
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA).
Series order: 126A of 126A-126M.
KB doc target: `documentation/engineering/UI/accessibility.md`.
Step 6 audit: `audits/126A__Audit__Accessibility.md`.

126A is not a generic accessibility program. It is the semantic product-truth
slice of the 126 UI Optimization Program.

It tells agents exactly how to expose existing UI truth through semantic state,
names, status/error feedback, and user-facing copy without reinterpreting the
task into WCAG certification, keyboard support, focus systems, touch targets,
contrast enforcement, modal machinery, or UI redesign.

## Inputs

- Codex as-built: `audits/126A__AsBuilt_Codex.md`.
- GLM as-built: `audits/126A__AsBuilt_GLM.md`.
- Codex research: `research/126A_Research_Codex.md`.
- GLM research: `research/126A_Research_GLM.md`.
- GLM peer review: `PRs/126A__GLM_PR.md`.
- Codex step-6 gap audit: `audits/126A__Audit__Accessibility.md`.
- Living docs: `documentation/engineering/UI/**`, `documentation/services/bob.md`.

The step-6 audit is binding for execution scope. If a path is not in this PRD or
in `audits/126A__Audit__Accessibility.md`, it is outside 126A unless the human
adds it.

## Human Decisions

- No WCAG certification claim.
- No custom keyboard support.
- No keyboard-complete component behavior.
- No focus-trap implementation.
- No focus-ring rollout or component-wide focus redesign.
- No mobile/touch-target program.
- No AI-enforced contrast/color changes.
- No accessibility validator/check suite.
- No modal/dialog framework behavior.
- No visual redesign.

Contrast/readability findings are evidence for human review only. Keyboard,
focus, touch, modal mechanics, motion, and contrast do not re-enter 126A through
accessibility wording.

## 126A Standard

126A has six rules.

1. If the UI visibly communicates current, selected, expanded, disabled,
   invalid, loading, saving, uploading, generating, success, failure, or partial
   success state, expose that state semantically when a direct truthful
   semantic representation exists.
2. Use native controls where the source can represent the same operation
   directly without a behavior rewrite. If direct replacement is not proven,
   record the exact owner gap; do not bless pseudo-controls as doctrine.
3. Icon-only controls need accessible names that match the real operation.
   Decorative icons/media are hidden from semantic output.
4. Dialog, modal, popover, sheet, banner, and status surfaces must be named
   honestly. 126A owns the truth label/state; 126K owns overlay mechanics.
5. Operation state cannot disappear into color, spinner motion, `...`, raw
   backend keys, or idle UI after failure.
6. Generated, translated, and user-authored text must remain user-facing and
   inspectable. Backend/service names, raw reason keys, and locale/tier tokens
   are not user copy unless the product explicitly presents them as operator
   coordinates.

Why compliant: Clickeen is agent-operated. Agents need structured UI truth they
can inspect and operate, not broad compliance machinery or invented behavior.

## Exact Copy And State Targets

The following copy/state corrections are implemented in current source. They
are the verified baseline that remaining 126 work must preserve; they are not
future execution targets.

| Verified current baseline | Landed product behavior to preserve |
| --- | --- |
| `bob/components/TranslationsPanel.tsx` | Generate failure remains visible as terminal alert/status text: `Translation generation failed. Please try again.` |
| `bob/components/UpsellPopup.tsx` | Known upsell reasons map to product copy and raw reason keys never render. |
| `bob/components/CopilotPane.tsx` | HTML/backend failures, empty responses, and timeouts use user-facing recovery copy; sending uses `Sending...`. |
| `roma/components/usage-domain.tsx` | A failed usage read shows `Storage usage could not be loaded.`; genuinely unavailable data remains `Unavailable`. |
| `roma/components/pages-domain.tsx` | The unavailable publish path says `Publishing is not available yet.` |
| `roma/components/widgets-domain.tsx` | Create, duplicate, and publish limits use operation-specific titles plus the truthful `{current} of {limit}` count. |
| `roma/components/accept-invite-domain.tsx` | Invite mismatch says `The signed-in email must match the invited email.` |
| `roma/components/roma-account-notice-modal.tsx` | Plan changes use product labels and dismiss failure uses stable recovery copy; raw tier ids/errors do not render. |
| `roma/app/login/page.tsx` | Unknown sign-in failure uses `Sign in failed. Try again.` and does not render raw reason-key/error-code text. |

## Hard Exclusions

126A must not touch:

- `roma/app/api/**`;
- `bob/app/api/**`;
- `roma/lib/**` route/client/storage helpers, except
  `roma/lib/account-shell-copy.ts` when 126A is only tightening user-facing copy
  fallback behavior and `roma/lib/format.ts` for the pure display-label
  formatter explicitly named by the Step-7 plan;
- `tokyo-worker/**`;
- `tokyo/product/widgets/**`;
- account runtime data under `accounts/{accountPublicId}/**`;
- instance, page, locale overlay, or locale package data;
- `admin/functions/**`;
- Supabase migrations;
- Cloudflare Pages, Worker, R2, or DNS deploy paths;
- public widget runtime accessibility unless a widget PRD explicitly brings that
  widget into system scope;
- save, publish, translation-generation, entitlement, account, auth, storage, or
  deploy behavior beyond visible UI status/copy/semantic truth.

Why compliant: it keeps source authorities separate. 126A is a UI truth pass, not
a product-data, route, deploy, widget-runtime, or backend behavior pass.

## Current Baseline And Remaining Routing

Premature A-H code changes implemented most 126A semantic and copy repairs named
below. The tables now serve as current-source preservation evidence. The Step-6
audit found one Repeater decorative-icon gap, two remaining direct Bob copy
gaps, and repeated raw Roma plan/profile/role labels. Component triggers route
to 126I and popover/dialog classification and lifecycle routes to 126K.

### Baseline 1 - Dieter Source Semantics

126A scope for Dieter is only the source files listed in the table below.
Generated Dieter mirrors are evidence only.

| Path | Current baseline / remaining routing | Must not do |
| --- | --- | --- |
| `dieter/tokens/dieter-foundation-tokens.css:83` | Preserve `.sr-only` as canonical hidden-text utility. | No focus/touch token program. |
| `dieter/components/agent-activity/agent-activity.html:1` | Preserve `role="status"` / `aria-live="polite"` Agent Activity semantics. | No generic job/polling framework. |
| `dieter/components/button/button.html:1-3` | Hide decorative icon spans when label/aria-label names the operation; require icon-only consumers to pass truthful labels. | No size, color, focus, or variant redesign. |
| `dieter/components/object-manager/object-manager.html:38-68`; `object-manager.js:356-358` | Dialog naming and row-action names are implemented; 126K owns the remaining `aria-modal` and lifecycle mechanics. | No data-model rewrite or modal framework. |
| `dieter/components/dropdown-actions/dropdown-actions.html:13-16`; `dropdown-actions.ts:291`; `shared/dropdownToggle.ts:37` | Preserve `aria-expanded`/`aria-selected`; record pseudo-trigger conversion as a 126I component cleanup, not 126A work. | No listbox keyboard navigation. |
| `dieter/components/dropdown-fill/dropdown-fill.html:21-24,173-239,425-520`; `dropdown-fill.ts:594,634-642`; `media-controller.ts:43-46` | Swatch names and invalid/media error truth are implemented; pseudo-trigger conversion remains 126I work. | No color/contrast changes; no invalid-value healing. |
| `dieter/components/dropdown-border/dropdown-border.html:14-17,103-159` | Swatch names are implemented; pseudo-trigger conversion remains 126I work. | No color/contrast changes. |
| `dieter/components/dropdown-shadow/dropdown-shadow.html:19-22,108-164` | Swatch names are implemented; pseudo-trigger conversion remains 126I work. | No color/contrast changes. |
| `dieter/components/dropdown-upload/dropdown-upload.html:22-38,58-89`; `dropdown-upload.ts:476-501` | Visible file/error semantics are implemented; 126K owns truthful non-modal popover classification. | No corrupt metadata healing; no modal framework. |
| `dieter/components/dropdown-edit/dropdown-edit.html:1-7,29-104`; `dropdown-edit.ts:319` | Command labels and active state are implemented; 126K owns truthful non-modal popover classification. | No rich-text behavior rewrite. |
| `dieter/components/textedit/textedit.html:13-35` | Link URL labeling is implemented and must be preserved. | No textedit flow rewrite. |
| `dieter/components/textrename/**` | Delete the unconsumed component and all references under 126I; do not convert or preserve its pseudo-control. | No keyboard-support project or compatibility alias. |
| `dieter/components/tabs/tabs.html:1`; `tabs.ts:7-13` | Preserve existing tab semantics. | No Home/End or keyboard expansion. |
| `dieter/components/choice-tiles/choice-tiles.html:10-18`; `choice-tiles.ts:85-91` | Preserve existing radiogroup/radio state. | No keyboard expansion. |
| `dieter/components/bulk-edit/bulk-edit.html:18`; `bulk-edit.ts:394-452` | Preserve existing dialog semantics; route modal mechanics to 126K and the independently generated upload pseudo-trigger to 126I. | No behavior rewrite or parallel upload-control contract. |
| `dieter/components/toggle/toggle.html:9` | Preserve existing switch semantics. | No size/focus program. |
| `dieter/components/repeater/repeater.html:26-29`; `repeater.js:251` | Step-6 gap: hide both decorative reorder icon spans while preserving the existing reorder label and pressed-state sync. | No reorder behavior change; regenerate mirrors from source instead of hand-editing them. |

Compliance reason: Dieter is the design-system source. 126A cleans semantic truth
at source or records exact component-owned gaps for 126I/126K. It does not create
a parallel accessibility system.

### Baseline 2 - Bob Semantic And Copy Truth

The Bob rows below are verified current baseline except for the two exact
Step-6 gaps recorded in `audits/126A__Audit__Accessibility.md`.

| Path | Current verified baseline | Must not do |
| --- | --- | --- |
| `bob/components/Workspace.tsx:456-481` | Preserve iframe title plus status/alert overlays. | No preview runtime change. |
| `bob/components/ToolDrawer.tsx:33-49` | Known builder/session reasons map to product copy; unknown implementation strings use the caller fallback. | No session/save behavior change. |
| `bob/components/ToolDrawer.tsx:58-72` | Step-6 gap: stop appending arbitrary save `detail`; preserve mapped product copy and explicit validation paths as Builder coordinates. | No session/save behavior change. |
| `bob/components/ToolDrawer.tsx:215-310` | Preserve Assist mode radio truth and existing alert surfaces. | No session/save behavior change. |
| `bob/components/TdMenu.tsx:53-65` | Preserve selected tab semantics. | No tab keyboard expansion. |
| `bob/components/TranslationsPanel.tsx:39-48` | Use user-facing locale names; unresolved locale fallback is `Language unavailable`, not the backend locale token. | No locale generation behavior change. |
| `bob/components/TranslationsPanel.tsx:256-267` | Preserve Agent Activity live-status semantics. | No persistent job tracker. |
| `bob/components/TranslationsPanel.tsx:97-145,275,431-441` | Preserve terminal alert/status `Translation generation failed. Please try again.` when Generate translations fails instead of clearing activity to idle. | Do not put translation generation in save; no polling/package probes. |
| `bob/components/useTranslationPreviewState.ts:24-42,88-111,147-171` | Keep saved-translation read failures user-facing; unknown route/HTTP reason keys collapse to the existing saved-translation fallback copy instead of leaking raw keys. | No translation route, save, polling, package generation, or overlay behavior change. |
| `bob/components/UpsellPopup.tsx:12-16,41` | Preserve the exact upsell reason mapping in "Exact Copy And State Targets". | No monetization flow redesign. |
| `bob/components/CopilotPane.tsx:40-49` | Preserve the exact Copilot failure copy in "Exact Copy And State Targets". | No Copilot API behavior change. |
| `bob/components/CopilotPane.tsx:58-100` | Known Copilot reason keys map to product copy; unknown backend `detail`, `message`, `error`, body text, or status codes do not render as user copy. | No Copilot API/request behavior change. |
| `bob/components/CopilotPane.tsx:456-486,541-545` | Step-6 gap: unknown request/runtime exceptions use stable recovery copy; preserve known normalized failures, issue coordinates, and valid agent-authored response text. | No Copilot API/request behavior change. |
| `bob/components/CopilotPane.tsx:692-703` | Preserve `Sending...` while the request is active. | No Copilot request flow change. |
| `bob/components/td-menu-content/useTdMenuHydration.ts:81` | Preserve existing alert fallback. | No runtime/probe dependency. |
| `bob/components/TopDrawer.tsx:43-46` | Preserve existing truthful Saving text. | No save process change. |

Compliance reason: Bob is the editor surface where agent operations are visible
to the user. 126A fixes semantic/copy truth without changing save, translation,
Copilot, preview, or session behavior.

### Baseline 2A - Dieter Account Asset Copy Boundary

The account-asset reason mapping and fallback suppression are implemented. The
rows below are preservation requirements, not pending route or UI work.

| Path | Current verified baseline | Must not do |
| --- | --- | --- |
| `dieter/components/shared/account-assets.ts:12-26,46-68` | Preserve backend reason keys as internal control signals, including existing upsell dispatch, but expose mapped user copy before rendering. | No account-asset route, upload, resolve, storage, or entitlement behavior change. |
| `dieter/components/shared/account-asset-resolve.ts:20-29` | Map asset preview resolve failures to product copy before passing them to UI renderers. | Do not silently heal missing or invalid asset refs. |
| `dieter/components/dropdown-fill/media-controller.ts:292-342` | Preserve user-facing asset load/upload failures, existing list/upload behavior, and upsell dispatch. | No media picker redesign or account asset source change. |
| `dieter/components/dropdown-upload/dropdown-upload.ts:221-246` | Preserve user-facing upload failure copy, existing metadata/write behavior, and upsell dispatch. | No upload flow redesign. |

Compliance reason: Account assets are current product UI inside Dieter controls.
126A owns whether raw route keys become visible copy; it does not own asset
storage, routes, entitlement, or upload mechanics.

### Baseline 3 - Roma Semantic And Copy Truth

The Roma semantic/copy repairs below are implemented current baseline except
for the repeated product-label gap recorded by Step 6. The remaining rows are
preservation requirements if an owning 126M surface changes them.

| Path | Current verified baseline | Must not do |
| --- | --- | --- |
| `roma/components/roma-nav.tsx:17-38` | Preserve `aria-current`. | No nav redesign. |
| `roma/components/roma-sign-out-button.tsx:27-35` | Preserve disabled/`aria-busy` pending truth. | No auth route change. |
| `roma/components/roma-account-context.tsx:74-106` | Preserve status/alert semantics for loading, redirecting, unavailable, and no-context states. | No bootstrap/session behavior change. |
| `roma/components/roma-domain-error-boundary.tsx:54-75` | Preserve alert semantics on the render-error UI. | No error reset/reload behavior change. |
| `roma/components/usage-domain.tsx:21-24,31-51,65-68` | Failed storage read shows `Storage usage could not be loaded.` as alert/status; true unavailable data remains `Unavailable`. | No usage API change. |
| `roma/components/assets-domain.tsx:332-360,403-404,439-445` | Preserve alert/status semantics around existing load/upload/delete errors. | No asset route or upload/delete behavior change. |
| `roma/components/assets-domain.tsx:332-343,458-490` | Preserve partial-success truth and user-facing per-item status. | No bulk upload processing change. |
| `roma/lib/account-shell-copy.ts:21-30` | Shared account-shell error copy returns mapped product copy or the caller fallback; unknown backend namespaces do not render as user copy. | No account route/client/storage behavior change. |
| `roma/components/pages-domain.tsx:35-42` | Show user-facing locale labels in page UI; do not show backend locale codes as page copy. | No locale storage change. |
| `roma/components/pages-domain.tsx:619-621,783-793` | Preserve status/alert semantics for data/mutation/loading/blocker copy and `Publishing is not available yet.` | Do not enable or change publishing. |
| `roma/components/pages-domain.tsx:638` | Preserve active/selected page-row truth. | No table redesign. |
| `roma/components/pages-domain.tsx:947` | Preserve Add instances dialog semantics. | No modal mechanics. |
| `roma/components/widgets-domain.tsx:383-397` | Preserve status/alert semantics for load/mutation/rename/loading states. | No widget route change. |
| `roma/components/widgets-domain.tsx:449` | Expose selected/current widget row truth semantically. | No table redesign. |
| `roma/components/widgets-domain.tsx:593-600` | Preserve upgrade dialog and apply widget-instance limit copy from "Exact Copy And State Targets". | No entitlement flow change. |
| `roma/components/widget-defaults-domain.tsx:65-67,337-398,547-570` | Widget-defaults load, compiled-control load, and save failures use fixed product copy instead of caught backend messages. | No widget-defaults route, compiled-control, or save behavior change. |
| `roma/components/widget-defaults-domain.tsx:577-674` | Preserve status/alert semantics for loading/contract/error states. | No compiled-controls behavior change. |
| `roma/components/widget-defaults-builder-controls.tsx:53,337` | Builder-control media/hydration failures use fixed product copy instead of caught backend messages. | No control rendering, media, or hydration behavior change. |
| `roma/components/team-domain.tsx:174-184,223-226` | Preserve status/alert semantics for load error/loading states and user-facing pending-invitation copy. | No team route or invitation behavior change. |
| `roma/components/team-member-domain.tsx:45-51` | Known member reasons map to product copy; unknown implementation strings use the caller fallback. | No membership route change. |
| `roma/components/team-member-domain.tsx:194-203` | Preserve status/alert semantics for load error/loading states. | No membership route change. |
| `roma/components/profile-domain.tsx:39-45` | Known profile/settings reasons map to product copy; unknown implementation strings use the caller fallback. | No settings save change. |
| `roma/components/profile-domain.tsx:275-282` | Preserve alert/status semantics around save error/success. | No settings save change. |
| `roma/components/account-locale-settings-card.tsx:101-107` | Known account-locale reasons map to product copy; unknown implementation strings use the caller fallback. | No account locale rule change. |
| `roma/components/account-locale-settings-card.tsx:236-244` | Preserve status/alert semantics around error/loading. | No account locale rule change. |
| `roma/components/settings-domain.tsx:39-45` | Known settings reasons map to product copy; unknown implementation strings use the caller fallback. | No ownership transfer route change. |
| `roma/lib/format.ts`; `roma/components/ai-domain.tsx:9-13,22-30`; `billing-domain.tsx:15-20`; `usage-domain.tsx:72-80`; `settings-domain.tsx:124-149`; `team-domain.tsx:185-271`; `team-member-domain.tsx:205-238`; `roma-account-notice-modal.tsx:40-60` | Step-6 gap: move the notice's existing tier labels into one Roma-owned pure formatter, use it for every customer-facing plan/profile label, add the corresponding role labels everywhere Roma displays or selects a role, and delete the notice's duplicate local tier formatter. | No entitlement, account, role, membership, invitation, billing, usage, notice lifecycle, or route behavior change. Select option values remain raw enums. |
| `roma/components/settings-domain.tsx:157,184-186` | Preserve status/alert semantics for `membersError`, `ownerTransferLoading`, the empty-owner-candidate notice, and `ownerTransferError`. | No ownership transfer route change. |
| `roma/components/accept-invite-domain.tsx:29-35` | Known invite reasons map to product copy; unknown implementation strings use the caller fallback. | No invitation route change. |
| `roma/components/accept-invite-domain.tsx:69-107` | Preserve invite status/alert semantics and `The signed-in email must match the invited email.` | No invitation route change. |
| `roma/components/roma-account-notice-modal.tsx:40-60,81-114` | Preserve exact plan-label and dismiss-failure copy from "Exact Copy And State Targets". | No lifecycle mutation change. |
| `roma/app/login/page.tsx:13-33,64` | Preserve the alert; unknown reason text is `Sign in failed. Try again.` and raw reason-code text is not rendered. | No login route change. |

Compliance reason: Roma is account/product operations UI. 126A makes visible
state, selected/current truth, partial success, and error copy non-masquerading
without touching account authorities or product data.

### Baseline 4 - DevStudio Semantic And Copy Truth

The DevStudio semantic/copy repairs below are implemented current baseline.

| Path | Current verified baseline | Must not do |
| --- | --- | --- |
| `admin/src/main.ts:237-238` | Preserve `aria-current` active nav truth. | No DevStudio nav redesign. |
| `admin/src/main.ts:296-324,448-453` | Token load/save failures use fixed product copy and never render backend detail, reason keys, or `HTTP_*` codes into the token editor status surface. | No token write lane or API behavior change. |
| `admin/src/main.ts:348-373` | Preserve honest dialog semantics/name on the token editor panel and diff `aria-live`. | No token write lane change. |
| `admin/src/main.ts:351-352` | Preserve decorative close-icon hiding. | No close behavior change. |
| `admin/src/main.ts:619-623,661-666` | Preserve generated token edit triggers as native named controls. | No token governance API change. |
| `admin/src/data/icons.ts:8-10` | Preserve `aria-hidden`/`focusable=false` SVG normalization. | No icon origination change. |
| `admin/src/css/layout.css:127-128` | Record focus evidence only. | No focus-ring rollout. |
| `admin/src/html/tools/entitlements.html:251`; `admin/src/html/tools/llm-management.html:120` | Preserve existing `aria-live` tool roots. | No DevStudio tool route change. |

Compliance reason: DevStudio is Dieter's reveal/steer cockpit. 126A keeps reveal
and editor status honest without changing the token write operation.

### Baseline 5 - Living Documentation

Living-document reconciliation is complete against current source. The paths
remain blast radius only if later 126 execution changes the documented behavior.

| Path | Required doc update | Must not do |
| --- | --- | --- |
| `documentation/engineering/UI/README.md:17-38` | Replace stale track mapping with actual A-M map. | No invented process/tracker. |
| `documentation/engineering/UI/accessibility.md:1-90` | Keep as narrowed 126A doctrine; replace vague post-execution gaps with exact owner routing for non-126A work. | No checklist/WCAG expansion. |
| `documentation/engineering/UI/dialogs-and-modals.md:1-45` | Keep 126A naming/semantics vs 126K mechanics boundary. | No modal framework doctrine from 126A. |
| `documentation/engineering/UI/components.md:4,43-58` | Replace stale 126B component track with 126I; remove stale 126B execution wording and 126C correction references. | No component API expansion from 126A. |
| `documentation/engineering/UI/interactions.md:15-24` | Remove toast/focus/keyboard ownership drift and stale 126D-state wording; interactions owns status/error/command-feedback vocabulary under 126E. | No feedback framework beyond 126E. |
| `documentation/engineering/UI/motion.md:25` | Replace false 126A easing ownership with 126F ownership. | No motion implementation in 126A. |
| `documentation/engineering/UI/color.md:7,56-58,104` | Replace nonexistent color PRD link; remove contrast guarantee overclaim; keep contrast human-owned under 126B. | No contrast gates or palette changes. |
| `documentation/engineering/UI/dieter.md:55-58` | Route focus/touch substrate to 126H/owners; 126A owns `.sr-only`/semantic truth only. | No focus/touch doctrine. |
| `documentation/engineering/UI/ops.md:42-53` | Replace stale 126C ops ownership with 126G. | No ops machinery from 126A. |
| `documentation/engineering/UI/surfaces.md:7,11-21,35-52` | Replace stale DevStudio/Roma PRD names and stale 126C/126D job wording; state Bob is current editor reference with 126A gaps, not perfect standard. | No screen refactor from 126A. |
| `documentation/services/bob.md:150-183,412-415` | Route translation UI/status treatment to current Bob/126E/126M docs; remove both stale `PRD 126D` ownership references; require terminal success/failure truth without jobs/polling. | Do not put translations into save. |

Compliance reason: docs are part of done. Future agents operate from living docs;
stale ownership labels are execution hazards.

### Baseline 6 - Generated Artifacts

Do not hand-edit generated artifacts.

| Generated path | Rule |
| --- | --- |
| `tokyo/product/dieter/**` | Regenerate from source with `pnpm build:dieter` after Dieter source changes. |
| `admin/src/html/components/*.html` | Regenerate through DevStudio/Dieter generators after component source changes. |
| `admin/src/html/foundations/{colors,icons,typography}.html` | Regenerate from source/generators. |
| `admin/src/data/{componentRegistry.generated.ts,icons.generated.ts,showcase.generated.ts,typography.generated.json}` | Regenerate from source/generators. |
| `admin/dist/**`, `.next/**`, `.turbo/**`, `.vercel/**` | Build output only. |

Compliance reason: source and generated artifacts are separate authorities. A
hand-edit to generated output is masquerade and will be overwritten.

## Widget Boundary

System/account/admin UI follows 126A. Public widget runtime accessibility belongs
to each widget's owning runtime/docs unless a widget PRD explicitly brings that
widget into system scope.

126A scope includes Bob/Roma/Dieter editor/system semantics around widgets. It must
not create global visitor-widget accessibility doctrine.

## Step 7 Final Executable Plan

This section is the Step-7 execution authority for 126A. It converts the four
Step-6 gap groups into the smallest code and proof plan. It does not authorize
implementation before every 126A-126M PRD completes Step 8.

### Authority And Order

When the parent program opens Step 9, execute 126A in three slices. A slice must
be green before the next starts.

1. **126A.1 - Repeater decorative semantics.** Change the Dieter source,
   regenerate both owned mirrors, and prove no visual or reorder behavior change.
2. **126A.2 - Bob error-copy boundary.** Remove the raw save-detail render path
   and distinguish deliberate Copilot product failures from unknown runtime
   exceptions. Prove both boundaries with focused pure-function tests.
3. **126A.3 - Roma product labels.** Promote the already-correct tier labels into
   the existing Roma format module, add role labels there, migrate every named
   consumer, delete the duplicate notice formatter, and prove every enum/fallback.

Do not combine these slices with 126I native-trigger conversion, 126K overlay
mechanics, any screen redesign, or any backend/product operation.

### Exact Code Change Map

| Slice | File | Exact change | Explicitly preserve |
| --- | --- | --- | --- |
| 126A.1 | `dieter/components/repeater/repeater.html` | Add `aria-hidden="true"` to the two spans with `diet-repeater__reorder-icon` classes. | The button, `aria-label`, `title`, `aria-pressed`, data attributes, icon keys, CSS, hydration, and reorder behavior. |
| 126A.2 | `bob/components/ToolDrawer.tsx` | Named-export the existing pure session-error line resolver for the focused test and delete only the `error.detail` append branch. Keep the mapped primary message and `Paths: ...` line. | Save request, session state, validation, persistence, error title, and path coordinates. |
| 126A.2 | `bob/components/CopilotPane.tsx` | Add and named-export one same-module `CopilotUserFacingError` discriminator plus a pure `resolveCopilotCaughtError` test seam. The three deliberate visible-failure branches - HTML error response, normalized non-OK response, and invalid response/edit - use the discriminator. The resolver returns its trusted message and otherwise returns `Copilot failed unexpectedly. Please try again.`; the outer catch uses the resolver. | Request envelope, model choice, HTTP call, reason-key mapping, validation issue coordinates, successful agent text, draft ops, undo, outcome reporting, and status transitions. No test-only runtime branch or new helper module. |
| 126A.2 | `bob/tests/run-accessibility-copy.ts` | Add focused assertions for mapped save copy, retained validation paths, omitted arbitrary detail, retained deliberate Copilot failure copy, and suppressed unknown `Error.message`/non-Error values. | No source-text grep test and no runtime test branch. |
| 126A.2 | `bob/package.json` | Add only `test:accessibility-copy` for the focused test file. | Existing scripts and dependencies. |
| 126A.3 | `roma/lib/format.ts` | Add pure `formatAccountTierLabel(value)` and `formatAccountRoleLabel(value)` maps. Known labels are `Free`, `Tier 1`, `Tier 2`, `Tier 3`, `Tier 4`, `Viewer`, `Editor`, `Admin`, and `Owner`; unknown/non-contract input returns exactly `Invalid plan` or `Invalid role`, never the raw token. | Existing number/byte formatting and stored/API enum values. |
| 126A.3 | `roma/components/ai-domain.tsx` | Use the tier formatter for Current plan and AI profile. A null/blank profile remains exactly `Not assigned`; a present non-contract value becomes `Invalid plan`. | Entitlements and Copilot-limit calculation. |
| 126A.3 | `roma/components/billing-domain.tsx` | Use the tier formatter for Current plan. | Billing availability and account context. |
| 126A.3 | `roma/components/usage-domain.tsx` | Use the tier formatter for Current plan. | Usage fetch, loading/error/unavailable distinction, and byte formatting. |
| 126A.3 | `roma/components/settings-domain.tsx` | Use tier and role formatters in the account summary and tier formatter in the Plan section. | Ownership, locale, membership, routes, and permission checks, which continue to use raw enum values internally. |
| 126A.3 | `roma/components/team-domain.tsx` | Use the role formatter for member rows, invitation rows, and the visible labels of invite-role options. | Member/invitation reads and writes, permission checks, select values, and request enum values. |
| 126A.3 | `roma/components/team-member-domain.tsx` | Use the role formatter for the current role and the visible labels of editable role options. | Member reads/writes, permission checks, select values, and request enum values. |
| 126A.3 | `roma/components/roma-account-notice-modal.tsx` | Import the shared tier formatter and delete the local `formatTierLabel` function. | Tier normalization/rank, notice copy, dismissal, and lifecycle behavior. |
| 126A.3 | `roma/tests/run-ui-copy.ts` | Assert every known tier and role label plus exact `Invalid plan` and `Invalid role` results for non-contract input. | No component source-text assertions and no runtime test branch. |
| 126A.3 | `roma/package.json` | Add only `test:ui-copy` for the focused test file. | Existing scripts and dependencies. |

The Copilot discriminator is not a general error framework. It is a local trust
boundary: only copy produced by the existing Copilot normalization branches may
cross into assistant-visible failure text; an arbitrary thrown implementation
message may not.

### Generated Artifact Map

Generated files are changed only by their existing generators after the
Repeater source edit:

| Generator | Expected generated change | Stop condition |
| --- | --- | --- |
| `pnpm build:dieter` | `tokyo/product/dieter/components/repeater/repeater.html` contains the two hidden decorative spans. | Stop if the build fails or produces unrelated Dieter diffs. |
| `pnpm --filter @clickeen/devstudio generate` | Every rendered Repeater example in `admin/src/html/components/repeater.html` contains the two hidden decorative spans. | Stop if generation fails or produces unrelated DevStudio diffs. |

Do not hand-edit either generated file. No other generated file is an accepted
126A diff unless the owning generator proves it is a deterministic consequence
of these exact source changes and Step 8 has reviewed that blast radius.

### Deletion And No-Change Map

126A deletes no files and no product data. It removes exactly:

- one `error.detail` display branch in Bob;
- one arbitrary Copilot caught-message display branch in Bob;
- one duplicate local tier-label formatter in Roma.

126A does not edit API routes, session/save producers, Copilot transport/model
code, account/entitlement/role data, Tokyo-worker, San Francisco, Supabase,
account R2 data, public widget runtimes, Cloudflare configuration, deployment
workflows, or the 126I/126K-owned source paths.

### Slice Green Gates

**126A.1 is green only when:** source and both generated artifacts contain
`aria-hidden="true"` on both reorder icons; `pnpm build:dieter`, Dieter
typecheck, DevStudio generation, and DevStudio typecheck pass; the generated
diff is limited to the two named Repeater artifacts; and before/after DevStudio
Repeater screenshots show no visual or interaction change.

**126A.2 is green only when:** the focused test proves arbitrary save detail and
unknown Copilot exception text never render, mapped save copy/path coordinates
and deliberate Copilot product failures still render, Bob lint/typecheck pass,
and a normal Builder/Copilot smoke shows no request/edit/undo regression.

**126A.3 is green only when:** the focused test proves all nine labels plus
`Invalid plan` and `Invalid role`, the seven named Roma consumers use the shared formatter, no
customer-facing raw `free|tier1|tier2|tier3|tier4|viewer|editor|admin|owner`
token remains in those consumers, Roma lint/typecheck pass, and before/after
Roma AI, Billing, Usage, Settings, Team list/invitation, and Team Member role
control screenshots prove only the intended copy change.

If any gate fails, stop inside that slice. Do not broaden scope or move to the
next slice.

### Code, Data, Deploy, And Documentation Reconciliation

- **Code:** only the source, focused tests, package scripts, and two generated
  artifacts named above.
- **Product data:** none. No Cloudflare or Supabase product-data operation is
  authorized.
- **Deploy/runtime:** deployment happens only in the parent program's eventual
  Step-9 deploy batch. Verify Bob, Roma, and DevStudio through their Cloudflare
  Pages Git build state and cloud-dev browser surfaces. Verify the Dieter product
  root through the GitHub Actions `cloud-dev workers deploy` run, then run
  `pnpm cf:preflight` and read `dieter/components/repeater/repeater.html` with
  `pnpm cf:r2:get` from the owning R2 surface. Do not manually write the object.
- **Documentation:** the living accessibility doctrine already states the
  target behavior. During Step 9, update it only if implementation exposes a
  confirmed contract mismatch; record execution evidence in this PRD without
  duplicating doctrine.

### Step-8 Handoff

Step 8 must review this exact file map and the exact recorded Git tree before
any 126A code change. It must attack omitted consumers, generated-file drift,
raw-copy escape paths, test-only behavior, 126I/126K scope theft, and accidental
backend/data/deploy-configuration changes. Step 7 completion is not Step 8
approval and grants no implementation credit.

## Verification

Before the eventual 126A Step-9 slice starts, verify scope with:

```bash
test -f Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/audits/126A__Audit__Accessibility.md
rg -n "126A2__SUBPRD__Color_System|126C__PRD|126D__PRD|track 126A|track 126B|\\*\\(126A\\)|\\*\\(126B\\)|\\*\\(126C\\)|\\*\\(126B/126D\\)|\\*\\(126C/126D\\)|PRD 126D|during 126B|during 126C|126C corrections|126C's job|126D's job|126D Step|focus & keyboard|focus/keyboard|toasts|easing.*126A" documentation/engineering/UI documentation/services/bob.md
rg -n "role=\"button\"|aria-label=\"\"|role=\"dialog\"|aria-modal|role=\"status\"|role=\"alert\"|aria-live|aria-current|aria-selected|aria-checked|aria-expanded|aria-haspopup" dieter/components bob/components roma/components roma/app/login/page.tsx admin/src --glob '*.{html,ts,tsx,js}'
rg -n "coreui\\.|HTTP_|backend|Berlin|page package generation|\\.\\.\\.|tier[0-9]|->|Unavailable" bob/components roma/components roma/app/login/page.tsx admin/src --glob '*.{ts,tsx,html}'
```

After implementation, run the exact focused checks:

```bash
pnpm build:dieter              # if Dieter source changed
pnpm --filter @ck/dieter typecheck
pnpm --filter @clickeen/devstudio generate
pnpm --filter @clickeen/devstudio typecheck
pnpm --filter @clickeen/bob test:accessibility-copy
pnpm --filter @clickeen/bob lint
pnpm --filter @clickeen/bob typecheck
pnpm --filter @clickeen/roma test:ui-copy
pnpm --filter @clickeen/roma lint
pnpm --filter @clickeen/roma typecheck
```

The two test commands are created by the exact package-script edits above. Do
not add a generic validator, accessibility scanner, or runtime check dependency.

The pre-slice stale-doc `rg` sweep is a read-only scope check. Documentation
reconciliation is already complete; it does not authorize a documentation
cleanup slice during 126A Step 9.

## V1-V8 Controls

| ID | 126A risk | Required control |
| --- | --- | --- |
| V1 Silent substitution | Invented labels/states replace unknown product meaning. | Use visible/source-backed operation names; route unclear meaning to owner/human. |
| V2 Silent healing | Invalid fill/upload/state is normalized away. | Expose failure truth; do not rewrite persisted/user state. |
| V3 Silent omission | Real labels/status/errors are skipped because keyboard/focus/touch/contrast are out. | Execute semantic truth and separately route non-126A mechanics. |
| V4 Fail-open control | Optional scanners/validators become source truth. | No runtime validator gate; source/docs own semantics. |
| V5 Corruption-as-absence | Failed/invalid state becomes unavailable, empty, missing, or idle. | Distinguish failed, unavailable, empty, and idle in visible/status truth. |
| V6 Partial-success masquerade | Bulk/agent operation claims full success after partial failure. | Preserve per-item and terminal result truth. |
| V7 Masquerade/redress | Popovers/dialogs/pseudo-controls are renamed without behavior truth. | Name surfaces honestly; route mechanics to 126K/126I. |
| V8 Runtime test dependency | Product work depends on probes/test rituals. | Tests/checks verify execution only; they are not product operation. |

## Done For 126A

126A is done only when:

- every path in this PRD and `audits/126A__Audit__Accessibility.md` is fixed or
  explicitly routed to the named owner PRD with the exact unresolved path;
- semantic product states are exposed when visually present and directly
  mappable;
- icon-only controls have source-backed names;
- decorative icon/media semantics are hidden;
- dialog/popover/status/error surfaces are named honestly;
- Bob/Roma/DevStudio operation states do not disappear into idle UI, raw keys,
  backend copy, or `...`;
- living docs above are aligned;
- generated artifacts are regenerated only from source when source changes;
- no product route, product data, deploy, keyboard, focus, touch, contrast,
  modal-framework, widget-runtime, or visual-redesign work was smuggled into
  126A.
