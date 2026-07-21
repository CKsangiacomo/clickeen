# 126A - PRD: Accessibility

Status: PRE-EXECUTION STEPS 6-8 COMPLETE - exact-tree review green at
`c06fa7db`; no Step-9 execution credit.
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
- Exact-tree Step-8 review: `PRs/126A__Step8_Review.md`.
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
audit found one Repeater semantic-name gap, three direct Bob copy/state paths,
repeated raw Roma plan/profile/role labels, and one hidden DevStudio Policy
Editor operation-state path. Component triggers route to 126I and
popover/dialog classification and lifecycle routes to 126K.

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
| `dieter/components/repeater/repeater.html:26-29`; `repeater.spec.json:20-34`; `repeater.js:251` | Step-6 gap: hide both decorative reorder icon spans and supply the missing default showcase `reorderLabel` while preserving runtime-provided labels and pressed-state sync. | No reorder behavior change; regenerate mirrors from source instead of hand-editing them. |

Compliance reason: Dieter is the design-system source. 126A cleans semantic truth
at source or records exact component-owned gaps for 126I/126K. It does not create
a parallel accessibility system.

### Baseline 2 - Bob Semantic And Copy Truth

The Bob rows below are verified current baseline except for the three exact
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
| `bob/components/useTranslationPreviewState.ts:24-42,50-53,79-183`; `BuilderApp.tsx:35-79`; `ToolDrawer.tsx:104-215`; `TranslationsPanel.tsx:277-443`; `Workspace.tsx:145-160,464-481`; producer `tokyo-worker/src/routes/internal-translation-routes.ts:45-59` | Step-6 gap: Tokyo represents absence as successful `200 []`; every non-OK list/read response is failure. Keep list and selected-locale loading/errors independent, render combined status/failure in TranslationsPanel, and block a loading or failed non-base preview instead of showing base content as translated content. Tokyo is producer evidence only and is not edited. | No translation route, save, generation, refresh, package generation, or overlay behavior change. Successful base preview remains available. |
| `bob/components/UpsellPopup.tsx:12-16,41` | Preserve the exact upsell reason mapping in "Exact Copy And State Targets". | No monetization flow redesign. |
| `bob/components/CopilotPane.tsx:40-49` | Preserve the exact Copilot failure copy in "Exact Copy And State Targets". | No Copilot API behavior change. |
| `bob/components/CopilotPane.tsx:58-100`; `roma/app/api/account/instances/[instanceId]/copilot/route.ts:127-135,153-160` | Known Copilot reason keys map to product copy; unknown backend `detail`, `message`, `error`, body text, or status codes do not render as user copy. The real `{ error: "VALIDATION", issues }` response must retain issue coordinates through generic fallback copy. The Roma route is producer evidence only and is not edited. | No Copilot API/request behavior change. |
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
| `roma/lib/format.ts`; `roma/components/ai-domain.tsx:9-30`; `billing-domain.tsx:15-20`; `usage-domain.tsx:72-80`; `settings-domain.tsx:124-149`; `team-domain.tsx:185-271`; `team-member-domain.tsx:108-114,205-238`; `roma-account-notice-modal.tsx:40-60`; bootstrap evidence `use-roma-me.ts:125-135,153-194`, `roma-account-context.tsx:49-60,74-106` | Step-6 gap: move the notice's tier labels into one Roma-owned formatter, use it for valid customer-facing plan/profile labels, add role labels everywhere Roma displays/selects a role, and delete the duplicate formatter. Invalid or absent active-account tier/role/profile stays fail-closed at account context. Team Member renders a valid owner with a disabled selected `Owner` option; malformed role renders disabled selected `Invalid role` and cannot save until deliberate valid selection. | No entitlement, account/bootstrap, role, membership, invitation, billing, usage, notice lifecycle, or route behavior change. Valid select values remain raw enums; malformed role truth is never rewritten on read. |
| `roma/components/settings-domain.tsx:157,184-186` | Preserve status/alert semantics for `membersError`, `ownerTransferLoading`, the empty-owner-candidate notice, and `ownerTransferError`. | No ownership transfer route change. |
| `roma/components/accept-invite-domain.tsx:29-35` | Known invite reasons map to product copy; unknown implementation strings use the caller fallback. | No invitation route change. |
| `roma/components/accept-invite-domain.tsx:69-107` | Preserve invite status/alert semantics and `The signed-in email must match the invited email.` | No invitation route change. |
| `roma/components/roma-account-notice-modal.tsx:40-60,81-114` | Preserve exact plan-label and dismiss-failure copy from "Exact Copy And State Targets". | No lifecycle mutation change. |
| `roma/app/login/page.tsx:13-33,64` | Preserve the alert; unknown reason text is `Sign in failed. Try again.` and raw reason-code text is not rendered. | No login route change. |

Compliance reason: Roma is account/product operations UI. 126A makes visible
state, selected/current truth, partial success, and error copy non-masquerading
without touching account authorities or product data.

### Baseline 4 - DevStudio Semantic And Copy Truth

The DevStudio semantic/copy repairs below are implemented current baseline
except for the Policy Editor operation-state gap recorded by Step 6.

| Path | Current verified baseline | Must not do |
| --- | --- | --- |
| `admin/src/main.ts:237-238` | Preserve `aria-current` active nav truth. | No DevStudio nav redesign. |
| `admin/src/main.ts:296-324,448-453` | Token load/save failures use fixed product copy and never render backend detail, reason keys, or `HTTP_*` codes into the token editor status surface. | No token write lane or API behavior change. |
| `admin/src/main.ts:348-373` | Preserve honest dialog semantics/name on the token editor panel and diff `aria-live`. | No token write lane change. |
| `admin/src/main.ts:351-352` | Preserve decorative close-icon hiding. | No close behavior change. |
| `admin/src/main.ts:619-623,661-666` | Preserve generated token edit triggers as native named controls. | No token governance API change. |
| `admin/src/data/icons.ts:8-10` | Preserve `aria-hidden`/`focusable=false` SVG normalization. | No icon origination change. |
| `admin/src/css/layout.css:127-128` | Record focus evidence only. | No focus-ring rollout. |
| `admin/src/html/tools/entitlements.html:251-352,410-438,1294-1385`; response authority `admin/functions/_shared/policy-github.js:336-349` | Step-6 gap: serialize Policy Editor UI operations; expose stable initial load, reload, save, saved, failure, and successful-commit/unreadable-response state; use each POST's committed matrix response directly instead of letting a follow-up GET turn success into failure. The backend file is response-contract evidence only and is not edited. | No policy API, request body, matrix schema, tier, cell-write, auth, or route behavior change. Existing Reload remains recovery. |
| `admin/src/html/tools/llm-management.html:120` | Preserve existing `aria-live` tool root. | No DevStudio tool route change. |

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

This section is the Step-7 execution authority for 126A. It converts the six
Step-6 gap groups into the smallest code and proof plan. It does not authorize
implementation before every 126A-126M PRD completes Step 8.

### Authority And Order

When the parent program opens Step 9, execute 126A in four slices. A slice must
be green before the next starts.

1. **126A.1 - Repeater semantic truth.** Change the Dieter source markup and
   default source context, regenerate the owned mirrors, and prove no visual or
   reorder behavior change.
2. **126A.2 - Bob error-state boundaries.** Remove the raw save-detail render
   path, distinguish deliberate Copilot product failures from unknown runtime
   exceptions, preserve issue-only validation coordinates, and expose failed
   saved-translation reads instead of empty UI.
3. **126A.3 - Roma product labels.** Promote the already-correct tier labels into
   the existing Roma format module, add role labels there, migrate every named
   consumer, preserve account bootstrap fail-closed behavior, handle malformed
   Team Member role truth without healing it, and delete the duplicate formatter.
4. **126A.4 - DevStudio Policy Editor state.** Make the existing policy editor
   expose loading, reloading, saving, saved, and stable failure copy without
   changing either policy operation.

Do not combine these slices with 126I native-trigger conversion, 126K overlay
mechanics, any screen redesign, or any backend/product operation.

### Exact Code Change Map

| Slice | File | Exact change | Explicitly preserve |
| --- | --- | --- | --- |
| 126A.1 | `dieter/components/repeater/repeater.html` | Add `aria-hidden="true"` to the two spans with `diet-repeater__reorder-icon` classes. | The button, `aria-label`, `title`, `aria-pressed`, data attributes, icon keys, CSS, hydration, and reorder behavior. |
| 126A.1 | `dieter/components/repeater/repeater.spec.json` | Add `"reorderLabel": "Reorder items"` to the default showcase context so every generated example has a truthful non-empty name. | Component attributes, per-widget runtime context, labels, sizes, and example content. |
| 126A.2 | `bob/components/ToolDrawer.tsx` | Named-export the existing pure session-error line resolver for the focused test and delete only the `error.detail` append branch. Keep the mapped primary message and `Paths: ...` line. | Save request, session state, validation, persistence, error title, and path coordinates. |
| 126A.2 | `bob/components/CopilotPane.tsx` | Add and named-export one same-module `CopilotUserFacingError` discriminator plus a pure `resolveCopilotCaughtError` test seam. Deliberate visible-failure branches use the discriminator. `normalizeErrorMessage` appends its validated issue summary to mapped copy or generic fallback, including Roma's `{ error: "VALIDATION", issues }` response. The outer catch renders trusted copy only and otherwise returns `Copilot failed unexpectedly. Please try again.` | Request envelope, model choice, HTTP call, reason-key mapping, issue coordinates/messages, successful agent text, draft ops, undo, outcome reporting, and status transitions. No test-only runtime branch or new helper module. |
| 126A.2 | `bob/components/useTranslationPreviewState.ts` | Named-export one pure read-failure resolver: every non-OK list/read response maps to `Saved translations could not be read.`; only normalized successful empty list means absence. Replace shared loading/error with separate list and selected-locale channels; key locale state to the requested locale. List completion changes only list state; locale completion changes only matching locale state. Return both channels plus deterministic combined status/failure. | Transport calls, payload normalization, locale retention, refresh dependencies, and successful values. No request may clear the other class's state. |
| 126A.2 | `bob/components/BuilderApp.tsx` | Read both hook state channels; pass combined status/failure to ToolDrawer/TranslationsPanel and Workspace for non-base translated preview blocking. | Preview mode, locale selection, Workspace values, and refresh ownership. |
| 126A.2 | `bob/components/ToolDrawer.tsx` | Accept saved-translation loading/error props and pass them only to TranslationsPanel. | Panel selection, session behavior, and every non-translation panel. |
| 126A.2 | `bob/components/TranslationsPanel.tsx` | Render saved-translation loading as `role="status"` and failure as `role="alert"` near the preview control. | Generate-button law, Agent Activity, generation feedback/error, reviewable locales, and preview selection. |
| 126A.2 | `bob/components/Workspace.tsx` | Accept saved-translation loading/failure. When translations mode selects a non-base locale and either is present, do not send base instance data as translated preview; render `Loading saved translation...` status or the stable alert over the preview and do not stack the generic `Loading preview...` overlay. | Base-locale preview, editing preview, media/font readiness, iframe protocol, device controls, and successful translated preview. |
| 126A.2 | `bob/tests/run-accessibility-copy.ts` | Add focused assertions for mapped save copy, retained validation paths, omitted arbitrary detail, retained deliberate Copilot copy, suppressed unknown thrown values, retained issue-only validation coordinates, all non-OK translation read failure, successful-empty absence, and list/locale status precedence. | No source-text grep test and no runtime test branch. |
| 126A.2 | `bob/package.json` | Add only `test:accessibility-copy` for the focused test file. | Existing scripts and dependencies. |
| 126A.2 | `e2e/widgets/126a-accessibility-state.spec.ts` | Under authenticated `CLICKEEN`, intercept delayed/failed translation-list GET, delayed/failed selected-locale GET, and Copilot POST separately. Prove explicit loading, list/read failure alerts, translated-preview blocking with no base-content fallback, and Roma's issue-only Copilot fallback with issue coordinates. Use unique raw sentinels and assert none render. The intercepted Copilot POST returns before grant/quota reservation. | Real Roma -> Bob host-command path; no remote mutation, no fake runtime mode, and no account-usage consumption. |
| 126A.3 | `roma/lib/format.ts` | Add pure `formatAccountTierLabel(value)`, `formatAccountRoleLabel(value)`, and `isAccountRoleValue(value)` over one local role-label map. Known labels are `Free`, `Tier 1`, `Tier 2`, `Tier 3`, `Tier 4`, `Viewer`, `Editor`, `Admin`, and `Owner`; formatter fallback is `Invalid plan` / `Invalid role` and never echoes the raw token. | Existing number/byte formatting and stored/API enum values. This formatter does not weaken bootstrap validation. |
| 126A.3 | `roma/components/ai-domain.tsx` | Use the tier formatter for Current plan and `accountPolicy.profile`. Do not retain or add `Not assigned`/invalid-profile card fallback because the account boundary already requires a valid profile. | Entitlements, account-context validation, and Copilot-limit calculation. |
| 126A.3 | `roma/components/billing-domain.tsx` | Use the tier formatter for Current plan. | Billing availability and account context. |
| 126A.3 | `roma/components/usage-domain.tsx` | Use the tier formatter for Current plan. | Usage fetch, loading/error/unavailable distinction, and byte formatting. |
| 126A.3 | `roma/components/settings-domain.tsx` | Use tier and role formatters in the account summary and tier formatter in the Plan section. | Ownership, locale, membership, routes, and permission checks, which continue to use raw enum values internally. |
| 126A.3 | `roma/components/team-domain.tsx` | Use the role formatter for member rows, invitation rows, and the visible labels of invite-role options. | Member/invitation reads and writes, permission checks, select values, and request enum values. |
| 126A.3 | `roma/components/team-member-domain.tsx` | Use the role formatter for current/option labels. When `roleDraft === 'owner'`, insert a disabled selected `Owner` option so the already-disabled owner control is truthful. For non-contract role, preserve raw `roleDraft`, insert disabled selected `Invalid role`, and leave Save disabled until deliberate valid selection. | Member reads/writes, permission checks, valid editable values, request enums, and owner restrictions. No repair PATCH occurs on read. |
| 126A.3 | `roma/components/roma-account-notice-modal.tsx` | Import the shared tier formatter and delete the local `formatTierLabel` function. | Tier normalization/rank, notice copy, dismissal, and lifecycle behavior. |
| 126A.3 | `roma/tests/run-ui-copy.ts` | Assert every known tier/role label, exact formatter fallbacks, and the role-value guard. | No component source-text assertions and no runtime test branch. |
| 126A.3 | `roma/package.json` | Add only `test:ui-copy` for the focused test file. | Existing scripts and dependencies. |
| 126A.3 | `e2e/roma/126a-accessibility-state.spec.ts` | Intercept Team Member reads for `126a-owner-role` and `126a-invalid-role`. Assert owner renders selected disabled `Owner` with disabled Save. Assert malformed role renders selected disabled `Invalid role`, Save stays disabled, then selecting `Viewer` enables Save without clicking it. | Real account context and UI; no member write or remote product-data mutation. |
| 126A.4 | `admin/src/html/tools/entitlements.html` | Replace raw hidden `lastError` with stable visible operation copy. Serialize reload/save in the UI: while one is active, Reload and every editable entitlement/AI-policy control are disabled. Initial load/reload/save/saved copy remains as named above. On successful entitlement POST, use `json.matrix` directly and remove its follow-up GET. A successful POST missing a usable matrix renders `Entitlement changes were saved, but the latest policy could not be shown. Reload policy data.` or `AI policy changes were saved, but the latest policy could not be shown. Reload policy data.`. Non-OK uses the exact save-failure copy. Explicit successful Reload clears prior feedback. | Both API endpoints, request bodies, matrix schema, tier/value editing, and `lastSavedAt`. No queue, retry framework, or backend change. |
| 126A.4 | `e2e/devstudio/route-contract.spec.ts` | Extend the Policy Editor contract with interception for initial/reload/non-OK save failures, successful POST with missing matrix, and a delayed save. Assert stable/partial-success copy, no raw detail, and global editor controls disabled during the delayed operation. Every POST is intercepted, so no policy mutation occurs. | Existing route/read assertions and remote policy data. |

The Copilot discriminator is not a general error framework. It is a local trust
boundary: only copy produced by the existing Copilot normalization branches may
cross into assistant-visible failure text; an arbitrary thrown implementation
message may not.

### Generated Artifact Map

Generated files are changed only by their existing generators after the
Repeater source/spec edit:

| Generator | Expected generated change | Stop condition |
| --- | --- | --- |
| `pnpm build:dieter` | `tokyo/product/dieter/components/repeater/repeater.html` contains the two hidden decorative spans; `tokyo/product/dieter/components/repeater/repeater.spec.json` contains the default name; `tokyo/product/dieter/manifest.json` may change only its generator-owned `gitSha` because the committed manifest currently predates the latest Dieter source commit. | Stop if the build fails, if any other manifest field changes, or if any other Dieter output differs. |
| `pnpm --filter @clickeen/devstudio generate` | Every rendered Repeater example in `admin/src/html/components/repeater.html` contains the two hidden decorative spans and the non-empty `Reorder items` name. | Stop if generation fails or produces any other DevStudio diff. |

Do not hand-edit any generated file. No other generated file is an accepted
126A diff unless the owning generator proves it is a deterministic consequence
of these exact source changes and Step 8 has reviewed that blast radius.

### Deletion And No-Change Map

126A deletes no files and no product data. It removes exactly:

- one `error.detail` display branch in Bob;
- one arbitrary Copilot caught-message display branch in Bob;
- one saved-translation failure-to-empty substitution and one loading/failed
  base-as-translation fallback in Bob;
- one duplicate local tier-label formatter in Roma.
- raw hidden Policy Editor `lastError` assignments in DevStudio.

126A does not edit API routes, session/save producers, Copilot transport/model
code, account/entitlement/role data, Tokyo-worker, San Francisco, Supabase,
account R2 data, public widget runtimes, Cloudflare configuration, deployment
workflows, or the 126I/126K-owned source paths.

### Slice Green Gates

Each Step-9 slice has two gates in this order: local source/build proof, then
commit/push through the existing Git deployment path and cloud-dev proof. A
remote browser check cannot prove unpushed local code. Do not start the next
slice until both gates are green. This authorizes no deployment during Steps
1-8; it defines the later Step-9 order.

**126A.1 local gate:** source and generated markup contain
`aria-hidden="true"` on both reorder icons and every source/generated Repeater
example has a non-empty `Reorder items` name; `pnpm build:dieter`, Dieter
typecheck, DevStudio generation, and DevStudio typecheck pass; generated diffs
are limited to the two Repeater mirrors plus the manifest `gitSha`.

**126A.1 cloud gate:** commit and push only the green slice; wait for the
`cloud-dev workers deploy` Dieter sync and DevStudio Pages Git build; verify the
two exact R2 objects; and use before/after
`https://devstudio.clickeen.com/#/dieter/repeater` screenshots plus reorder
interaction to prove no visual or behavior change.

**126A.2 local gate:** the focused test proves arbitrary save detail and
unknown Copilot exception text never render, mapped save copy/path coordinates
and deliberate Copilot product failures still render, issue-only validation
coordinates survive generic fallback, every non-OK translation read remains
failure, successful `200 []` remains absence, list/locale errors cannot clear
each other, and loading/failed non-base preview cannot receive base content; Bob
lint/typecheck pass.

**126A.2 cloud gate:** commit and push only the green slice; wait for the Bob
Pages Git build; run the authenticated intercepted Builder spec at
`/builder/QD1G068MX7`; prove list/locale loading, list/read alerts,
translated-preview blocking, issue-only Copilot coordinates, and raw-sentinel
suppression. No real Copilot request is allowed because it reserves account
usage.

**126A.3 local gate:** the focused test proves all nine labels plus
the formatter fallbacks and role guard; active-account auth/bootstrap validation
is unchanged; the seven named Roma consumers use the shared formatter; no
customer-facing raw `free|tier1|tier2|tier3|tier4|viewer|editor|admin|owner`
token remains in those consumers; Roma lint/typecheck pass.

**126A.3 cloud gate:** commit and push only the green slice; wait for the Roma
Pages Git build; run the intercepted malformed Team Member spec to prove invalid
truth, disabled Save, deliberate valid selection, truthful disabled Owner, and
no write; and capture before/after authenticated screenshots at `/ai`,
`/billing`, `/usage`, `/settings`, `/team`, and one real `/team/{memberId}`
proving only intended valid-label changes.

**126A.4 local gate:** DevStudio generation/typecheck pass; source inspection
proves no entitlement save follow-up GET remains; one busy state disables Reload
and both policy editor families; and successful, non-OK, and successful-but-
unreadable responses map to their exact distinct state without raw detail.

**126A.4 cloud gate:** commit and push only the green slice; wait for the
DevStudio Pages Git build; run the intercepted Policy Editor spec proving
initial/reload failures, both non-OK save failures, both partial-success
responses, global busy-state serialization, and zero POST mutation; and capture
before/after `https://devstudio.clickeen.com/#/policy/entitlements` screenshots
proving no editor-layout or policy-value change.

If any gate fails, stop inside that slice. Do not broaden scope or move to the
next slice.

### Exact Runtime Proof Coordinates

- **Account/session:** ignored authenticated storage state
  `e2e/.auth/roma-dev.json`, created by `pnpm e2e:auth:roma-dev`, must resolve to
  the normal `CLICKEEN` account. Missing auth is a failed gate, not a skipped
  proof.
- **Bob through Roma:** `https://roma.dev.clickeen.com/builder/QD1G068MX7`.
  The fixed instance is the current cloud-dev proof fixture. Assert Builder
  opens, Content and Translations panels render, delayed/failed list and selected-
  locale reads expose status/alert, translated preview never substitutes base
  content, and raw response sentinels are absent. Intercept the Copilot POST to
  return Roma's issue-only response and assert fallback plus issue coordinates.
  Do not run the real Copilot smoke: it reserves account usage and is outside
  this no-product-data slice.
- **Roma labels:** `https://roma.dev.clickeen.com/ai`, `/billing`, `/usage`,
  `/settings`, `/team`, and `/team/{memberId}` for a member id read from the
  authenticated Team surface. Assert only human-readable valid labels. The
  malformed-role state uses the intercepted `126a-invalid-role` fixture and
  performs no write.
- **DevStudio:** `https://devstudio.clickeen.com/#/dieter/repeater` and
  `https://devstudio.clickeen.com/#/policy/entitlements`. Error-state proof uses
  Playwright request interception with unique raw sentinels; it never changes
  remote policy data.

### Code, Data, Deploy, And Documentation Reconciliation

- **Code:** only the source, focused tests, package scripts, two Repeater
  generated mirrors, and generator-owned manifest field named above.
- **Product data:** none. No Cloudflare or Supabase product-data operation is
  authorized.
- **Deploy/runtime:** no deployment occurs in Steps 1-8. During Step 9, each
  locally green slice is committed and pushed separately; its owning Git deploy
  and cloud-dev proof must be green before the next slice starts. Verify Bob
  (`bob-dev`), Roma (`roma-dev`), and DevStudio (`devstudio`) through Cloudflare
  Pages Git build state and the exact browser coordinates above. For 126A.1,
  verify the Dieter product root through the GitHub Actions `cloud-dev workers
  deploy` run, then run `pnpm cf:preflight` and read both
  `dieter/components/repeater/repeater.html` and
  `dieter/components/repeater/repeater.spec.json` with `pnpm cf:r2:get`. Do not
  manually write either object.
- **Documentation:** the living accessibility doctrine already states the
  target behavior. During Step 9, update it only if implementation exposes a
  confirmed contract mismatch; record execution evidence in this PRD without
  duplicating doctrine.

### Step-8 Outcome

Three independent lenses reviewed this exact file map green at tree `c06fa7db`.
The review attacked omitted consumers, generated-file drift, raw-copy escape
paths, request concurrency, partial-success truth, test-only behavior,
126I/126K scope theft, and accidental backend/data/deploy-configuration changes.
Evidence is recorded in `PRs/126A__Step8_Review.md`. This grants no Step-9
implementation credit.

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
pnpm exec playwright test e2e/widgets/126a-accessibility-state.spec.ts e2e/roma/126a-accessibility-state.spec.ts
E2E_BASE_URL=https://devstudio.clickeen.com pnpm exec playwright test e2e/devstudio/route-contract.spec.ts
```

The two test commands are created by the exact package-script edits above. Do
not add a generic validator, accessibility scanner, or runtime check dependency.
Run each Playwright path only after its owning slice has deployed; it is not a
local source gate. Do not substitute the real Copilot runtime smoke because it
reserves account usage.

The pre-slice stale-doc `rg` sweep is a read-only scope check. Documentation
reconciliation is already complete; it does not authorize a documentation
cleanup slice during 126A Step 9.

## V1-V8 Controls

| ID | 126A risk | Required control |
| --- | --- | --- |
| V1 Silent substitution | Invented labels/states replace unknown product meaning. | Only successful `200 []` is translation absence; every non-OK read is failure. Valid account tokens become human labels; malformed Team Member role remains `Invalid role`. |
| V2 Silent healing | Invalid fill/upload/state is normalized away. | Preserve malformed Team Member `roleDraft`; require deliberate valid selection before Save and never issue a repair write on read. |
| V3 Silent omission | Real labels/status/errors are skipped because keyboard/focus/touch/contrast are out. | Execute semantic truth and separately route non-126A mechanics. |
| V4 Fail-open control | Optional scanners/validators become source truth. | No runtime validator gate; source/docs own semantics. |
| V5 Corruption-as-absence | Failed/invalid state becomes unavailable, empty, missing, or idle. | Independent translation read failures remain alerts and block non-base preview; Policy Editor failure never becomes perpetual loading or ready UI. |
| V6 Partial-success masquerade | Bulk/agent operation claims full success after partial failure. | Use each committed policy response directly; missing returned matrix says saved-but-not-shown, and serialized UI prevents sibling success from erasing failure. |
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
