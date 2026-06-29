# 126A Accessibility - Pre-Execution Gap Audit

Status: CODEX PRE-EXECUTION AUDIT - three-lane review green.
Parent PRD: `../126A__PRD__Accessibility.md`.
Audit date: 2026-06-28.

This is the file-level execution audit for 126A. It is not an as-built pass and
it is not a fix list for a generic accessibility program. It converts the
as-built/research/reviewer findings into the exact semantic-product-truth blast
radius that a later 126A implementation pass is allowed to execute.

## Authority

126A owns:

- truthful semantic state for UI state already visible in product UI;
- accessible names for existing operations and icon-only controls;
- decorative icon/media hiding;
- honest dialog/popover/status/error naming;
- visible operation-state truth for saving, generating, uploading, failures,
  partial success, and unavailable states;
- generated/translated/user-authored text remaining inspectable as user-facing
  product copy.

126A does not own:

- WCAG certification;
- custom keyboard support;
- keyboard-complete parity;
- focus traps, return focus, or focus-ring rollout;
- touch target sizing;
- contrast/color changes or contrast gates;
- modal/dialog framework mechanics;
- product route, account data, Tokyo/R2, Supabase, deploy, or Cloudflare
  behavior;
- generated artifact hand-edits;
- public widget runtime accessibility unless a widget PRD explicitly brings a
  widget into system scope.

## Commands Used

Read-only commands used for this audit:

```bash
rg -l "role=|aria-|tabIndex|tabindex|aria-live|aria-modal|aria-label|aria-current|aria-selected|aria-expanded|aria-checked|sr-only|visually-hidden" dieter bob roma admin documentation --glob '*.{ts,tsx,js,jsx,html,css,md}'
rg --count "role=|aria-|tabIndex|tabindex|aria-live|aria-modal|aria-label|aria-current|aria-selected|aria-expanded|aria-checked|sr-only|visually-hidden" dieter bob roma admin --glob '*.{ts,tsx,js,jsx,html,css}'
rg -n "role=\"button\"|aria-label=\"\"|role=\"dialog\"|aria-modal|role=\"status\"|role=\"alert\"|aria-live|aria-current|aria-selected|aria-checked|aria-expanded|aria-haspopup" dieter/components bob/components roma/components admin/src --glob '*.{html,ts,tsx,js}'
rg -n "accessib|a11y|WCAG|keyboard|focus|touch target|contrast|aria|screen reader|screen-reader|sr-only|visually-hidden|semantics|semantic" documentation Execution_Pipeline_Docs/02-Executing/126__UI_Optimization --glob '*.md'
```

No tests, builds, preflights, commits, pushes, deploys, product data mutations, or
Cloudflare/Supabase operations were run.

## Dieter Source Gaps

These are source paths. Generated mirrors under `tokyo/product/dieter/**` and
`admin/src/html/components/**` must be regenerated, not hand-edited.

| Path | Evidence | 126A gap | Execution decision | Not 126A |
| --- | --- | --- | --- | --- |
| `dieter/tokens/dieter-foundation-tokens.css:92` | `.sr-only` is the canonical hidden-text utility. | Multiple hidden-text variants exist in generated/admin/component CSS. | Preserve `.sr-only` as the semantic hidden-text utility where source components need hidden labels. | Do not create a focus/touch/accessibility token program. |
| `dieter/components/agent-activity/agent-activity.html:1` | `role="status" aria-live="polite"`. | None; this is current good substrate. | Preserve as the status semantics pattern for Agent Activity. | Do not turn Agent Activity into generic polling/job status. |
| `dieter/components/button/button.html:1-3` | Native `<button>` supports optional `aria-label`; icon span lacks `aria-hidden`. | Icon + label buttons can expose redundant icon semantics; icon-only buttons depend on callers supplying a truthful `ariaLabel`. | Ensure button icons are decorative by default when label/aria-label names the operation; require icon-only consumers to pass real product labels. | Do not redesign button sizes, variants, focus rings, or colors. |
| `dieter/components/object-manager/object-manager.html:38-54` | Modal-like reorder surface lacks `role="dialog"`/label semantics. | Dialog-like product surface is not named honestly. | Treat current reorder overlay as dialog-like and add truthful dialog semantics/name; route mechanics to 126K/126I without claiming accessibility completion. | Do not add focus trap, Escape, scroll lock, or modal framework. |
| `dieter/components/object-manager/object-manager.html:61-68` | Up/down/delete icon-only buttons have no accessible names. | Existing row actions are unnamed. | Add deterministic labels from row/action truth: move up, move down, delete item; include the visible row label when the source provides it. | Do not invent object labels that are not visible/source-backed. |
| `dieter/components/object-manager/object-manager.js:339-360` | Manage button opens and mutates modal rows. | Behavior must be preserved while names/semantics are added. | Verify row-control labels do not change add/reorder/delete behavior. | Do not rewrite object-manager data model. |
| `dieter/components/dropdown-actions/dropdown-actions.html:13-16` | Trigger is `div role="button"` with `aria-haspopup`/`aria-expanded`. | Pseudo-control trigger. | Record native-control conversion as a 126I component cleanup; preserve existing expanded-state truth under 126A. Do not bless pseudo-control as preferred. | No custom keyboard matrix. |
| `dieter/components/dropdown-actions/dropdown-actions.html:31-55` and `dropdown-actions.ts:291` | Listbox/options with `aria-selected` sync. | Current semantic state exists. | Preserve selected-state sync when touching this component. | Do not add listbox keyboard navigation under 126A. |
| `dieter/components/dropdown-fill/dropdown-fill.html:21-24` | Trigger is `div role="button"` with expanded state. | Pseudo-control trigger. | Record native-control conversion as a 126I component cleanup; preserve existing expanded-state truth under 126A. | No keyboard/focus redesign. |
| `dieter/components/dropdown-fill/dropdown-fill.html:103-239` | Color swatches are visual choices with `aria-pressed` but no per-color accessible names. | Product choices are unnamed. | Name swatches from the actual color/value source. If no human-readable color name exists, expose the value exactly; do not invent marketing names. | Do not change color values or contrast. |
| `dieter/components/dropdown-fill/dropdown-fill.html:425-520` | Image/video preview area is marked decorative while preview name/error are visible. | Media preview naming boundary is unclear. | Keep purely decorative thumbnails hidden; expose file name/error/status text where it carries product meaning. | Do not invent alt text for account assets unless the product has that content. |
| `dieter/components/dropdown-fill/dropdown-fill.ts:454-461`; `dropdown-fill.html:21-35` | Invalid fill sets `data-invalid` and visible header text `Invalid` via `.diet-dropdown-fill__label`. | Invalid state is visible but not a consistent semantic/status truth. | Keep the existing header label `Invalid` as the visible error location and expose the invalid state on the current `.diet-dropdown-fill__control`/value field. | Do not silently heal malformed fill values; do not add a new error container. |
| `dieter/components/dropdown-fill/media-controller.ts:43-46` | Media controller sets `aria-expanded`. | Existing expanded state must stay truthful. | Preserve `aria-expanded` sync if media UI is touched. | No extra keyboard behavior. |
| `dieter/components/shared/account-assets.ts:32-40` | Account asset helper returns raw route reason keys for UI callers. | Backend/product keys can leak as visible Dieter control copy. | Keep reason keys as internal control signals for upsell dispatch; map to user-facing copy before rendering. | Do not change account-asset transport, upload, resolve, storage, or entitlement behavior. |
| `dieter/components/shared/account-asset-resolve.ts:20-29` | Resolve failures pass raw error messages to UI callbacks. | Missing/unavailable asset preview can render backend keys. | Map resolve failures to user-facing preview copy before UI rendering. | Do not silently heal missing/invalid asset refs. |
| `dieter/components/dropdown-border/dropdown-border.html:14-17` | Trigger is pseudo-control. | Pseudo-control trigger. | Record native-control conversion as a 126I component cleanup; preserve existing expanded-state truth under 126A. | No keyboard/focus redesign. |
| `dieter/components/dropdown-border/dropdown-border.html:101-160` | Border color swatches have visual values but no names. | Product choices are unnamed. | Name swatches from actual color/value source. | Do not change color values or contrast. |
| `dieter/components/dropdown-shadow/dropdown-shadow.html:19-22` | Trigger is pseudo-control. | Pseudo-control trigger. | Record native-control conversion as a 126I component cleanup; preserve existing expanded-state truth under 126A. | No keyboard/focus redesign. |
| `dieter/components/dropdown-shadow/dropdown-shadow.html:106-166` | Shadow color swatches have visual values but no names. | Product choices are unnamed. | Name swatches from actual color/value source. | Do not change color values or contrast. |
| `dieter/components/dropdown-upload/dropdown-upload.html:23-27` | Trigger is pseudo-control. | Pseudo-control trigger. | Record native-control conversion as a 126I component cleanup; preserve existing expanded-state truth under 126A. | No keyboard/focus redesign. |
| `dieter/components/dropdown-upload/dropdown-upload.html:38` | Popover uses `role="dialog"` without modal semantics. | Popover/dialog naming must be honest. | Treat current panel as non-modal popover content; do not claim modal-dialog doctrine unless 126K later owns the mechanics. | Do not add focus trap or modal framework. |
| `dieter/components/dropdown-upload/dropdown-upload.html:57-90` and `dropdown-upload.ts:492-498` | Preview error text is visible via `previewError.textContent`. | Upload/metadata errors are not exposed as a status/error semantic surface. | Preserve visible file/error text and add semantic status/error only around existing text. | Do not turn corrupt/missing metadata into empty asset. |
| `dieter/components/dropdown-edit/dropdown-edit.html:2-7` | Trigger is pseudo-control; popover uses `role="dialog"`. | Pseudo-control/dialog naming boundary. | Record trigger conversion as 126I; treat current panel as non-modal popover content under 126A. | No focus trap or keyboard parity. |
| `dieter/components/dropdown-edit/dropdown-edit.html:29-93` | Bold/italic/underline/strike/link/clear icon buttons have no names. | Existing editor operations are unnamed. | Add labels matching the exact command names. | Do not invent editor features. |
| `dieter/components/dropdown-edit/dropdown-edit.ts:308-318` | Formatting buttons toggle `.is-active`. | Active formatting state is visual-only. | Mirror the existing active command state semantically on the existing formatting buttons. | Do not rewrite rich-text editor behavior. |
| `dieter/components/textedit/textedit.html:13-35` | Link input has placeholder but no visible/programmatic label in the inline form. | Link URL input meaning is weak. | Add visible/programmatic URL label without changing the editor flow. | Do not rewrite textedit link behavior. |
| `dieter/components/textrename/textrename.html:2-4` | View mode is `div role="button"` with `aria-label`. | Pseudo-control trigger. | Record native-control conversion as a 126I component cleanup; preserve existing edit input semantics under 126A. | No keyboard support project. |
| `dieter/components/tabs/tabs.html:1` and `tabs.ts:7-13` | Tablist, `aria-selected`, roving tabindex exist. | Existing strong pattern. | Preserve; do not expand to Home/End or new keyboard doctrine from 126A. | No keyboard matrix. |
| `dieter/components/choice-tiles/choice-tiles.html:10-18` and `choice-tiles.ts:85-91` | Radiogroup/radio and `aria-checked` exist. | Existing strong pattern. | Preserve selected state truth. | No keyboard expansion. |
| `dieter/components/bulk-edit/bulk-edit.html:18` | Existing modal body has `role="dialog" aria-modal="true"`. | Existing good semantics, but mechanics are not complete. | Preserve semantics; route modal mechanics to 126K. | No focus trap/scroll lock under 126A. |
| `dieter/components/toggle/toggle.html:9` | Native checkbox with switch role and label. | Existing strong pattern. | Preserve. | No sizing/focus program. |
| `dieter/components/repeater/repeater.html:26-29` and `repeater.js:247-250` | Reorder button has label and pressed-state sync. | Existing strong pattern. | Preserve. Generated DevStudio examples with empty labels are generated evidence, not source law. | Do not hand-edit generated examples. |

## Bob Gaps

| Path | Evidence | 126A gap | Execution decision | Not 126A |
| --- | --- | --- | --- | --- |
| `bob/components/Workspace.tsx:388-407` | Iframe title plus loading/error/status overlays with `role=status`/`role=alert`. | None; strong current substrate. | Preserve. | Do not change preview runtime or iframe behavior. |
| `bob/components/ToolDrawer.tsx:35-48` | Builder/session error fallback can render unknown implementation strings. | Backend/session implementation text can leak into Builder UI. | Known reasons map to product copy; unknown strings use caller fallback. | Do not change session/save behavior. |
| `bob/components/ToolDrawer.tsx:215-268` | Assist mode uses radio inputs and hidden icon spans. | Existing state truth. | Preserve. | Do not add keyboard matrices. |
| `bob/components/ToolDrawer.tsx:276-310` | Session/switch block messages use `role="alert"`. | Existing error truth. | Preserve and avoid hiding these behind generic chrome. | Do not change save/session flows. |
| `bob/components/TdMenu.tsx:53-65` | Vertical tablist with `aria-selected`; no custom arrow handling. | Existing semantic selected state; keyboard completeness out of scope. | Preserve selected semantics. | Do not add tab keyboard behavior under 126A. |
| `bob/components/TranslationsPanel.tsx:27-36` | Locale label fallback returns normalized locale token. | User-facing labels can expose backend locale coordinate if lookup fails. | Use user-facing locale names; unresolved locale fallback is `Language unavailable`, not the backend locale token. | Do not change locale generation behavior. |
| `bob/components/TranslationsPanel.tsx:94-105` | Agent Activity has `role=status` and live updates. | Strong substrate. | Preserve. | Do not make Agent Activity a persistent job tracker. |
| `bob/components/TranslationsPanel.tsx:184-197` | Generate translation failure clears activity with no terminal failure. | Operation failure masquerades as absence/idle. | Show terminal alert/status `Translation generation failed. Please try again.` for failed generate operation; keep generation out of save. | Do not create polling/jobs/package probes. |
| `bob/components/useTranslationPreviewState.ts:88-111` | Saved-translation read failures can include route/HTTP reason keys. | Backend reason keys can leak into user-facing translation preview copy. | Keep saved-translation read failures user-facing; unknown route/HTTP reason keys collapse to the existing saved-translation fallback copy. | Do not change translation routes, save, polling, package generation, or overlay behavior. |
| `bob/components/UpsellPopup.tsx:41-49` | Dialog renders raw `reasonKey` body copy. | Backend/product keys can leak as user copy. | Map `coreui.upsell.reason.limitReached` to `You've reached your plan limit.`; map `coreui.upsell.reason.flagBlocked` to `This option is not available on your current plan.`; fallback to `This action requires a plan upgrade.`. Never render the raw key. | Do not redesign monetization flow. |
| `bob/components/CopilotPane.tsx:43-48` | Copy mentions HTML error page, backend timeout, empty model response, and execution timeout. | Implementation details leak into user copy. | HTML error page: `Copilot is temporarily unavailable. Please try again in a moment.` Unhandled error: `Copilot could not complete the request. Please try again with a smaller change.` Empty response: `Copilot did not return an edit. Please try again with a smaller, more specific request.` Timeout: `Copilot timed out. Please try again with a smaller change.` | Do not change Copilot API behavior. |
| `bob/components/CopilotPane.tsx:84-120` | Generic Copilot error normalization can render backend `detail`, `message`, `error`, body text, or status-code fallback. | Backend/API implementation text can leak into the Copilot user surface. | Known reason keys map to product copy; unknown backend error payload text falls back to fixed product copy. | Do not change Copilot API/request behavior. |
| `bob/components/CopilotPane.tsx:713-724` | Send button loading label is `...`. | Operation state is not meaningful text. | Replace with `Sending...`. | Do not alter Copilot request flow. |
| `bob/components/td-menu-content/useTdMenuHydration.ts:76` | Fallback error uses `role="alert"`. | Existing strong substrate. | Preserve. | No runtime/probe dependency. |
| `bob/components/TopDrawer.tsx:35-46` | Save button is disabled/label-mutates to Saving. | Save interaction itself belongs to 126E/Bob UI refactor, not 126A. | 126A only preserves truthful "Saving" text if touched. | Do not change save process. |

## Roma Gaps

| Path | Evidence | 126A gap | Execution decision | Not 126A |
| --- | --- | --- | --- | --- |
| `roma/components/roma-nav.tsx:17-38` | Active nav item uses `aria-current="page"`. | Existing strong substrate. | Preserve. | No nav redesign. |
| `roma/components/roma-sign-out-button.tsx:27-35` | Pending state uses disabled and `aria-busy`. | Existing state truth. | Preserve. | No auth route changes. |
| `roma/components/roma-account-context.tsx:74-106` | Loading, redirecting, unavailable, and no-context states are visible sections. | Status/error semantics missing. | Add status/alert semantics to existing visible states only. | Do not alter account bootstrap/session route behavior. |
| `roma/components/roma-domain-error-boundary.tsx:54-75` | Rendering error UI is visible, no alert semantics. | Error state not semantically exposed. | Add alert semantics around existing error text. | Do not change error boundary reset/reload behavior. |
| `roma/components/usage-domain.tsx:23-43` | Storage read failure is swallowed and shown as `Unavailable`. | Failure becomes absence/unavailable. | Failed storage read shows `Storage usage could not be loaded.` as alert/status; true unavailable data remains `Unavailable`. | Do not change storage API. |
| `roma/components/assets-domain.tsx:323-374` | Load/upload/delete errors are visible paragraphs. | Existing errors lack semantic alert/status boundary. | Add alert/status semantics around existing error text. | Do not change upload/delete routes. |
| `roma/components/assets-domain.tsx:54-60` | Asset reason fallback can render unknown backend namespace strings. | Backend/API implementation text can leak into asset UI. | Use mapped product copy or caller fallback only. | Do not change asset routes or upload/delete processing. |
| `roma/components/assets-domain.tsx:426-456` | Bulk upload modal shows success/failed counts and raw item status strings. | Partial success truth exists but user copy is raw enum-shaped and not semantic. | Keep per-item/aggregate partial-success truth; make status text user-facing and semantically visible. | Do not change bulk upload processing. |
| `roma/lib/account-shell-copy.ts:21-30` | Shared account-shell copy fallback can render unknown backend namespace strings. | Team/widgets/pages account UI can expose internal reason namespaces. | Return mapped product copy or caller fallback only. | Do not change account route/client/storage behavior. |
| `roma/components/pages-domain.tsx:35-42` | Locale label always renders `Label (normalized)`. | Backend locale code leaks into user-facing page UI. | Show user-facing locale labels in page UI; do not show backend locale codes as page copy. | Do not change locale storage. |
| `roma/components/pages-domain.tsx:614-617` | Data/mutation/loading/empty states are visible paragraphs. | Status/error semantics missing. | Add status/alert semantics around existing states. | Do not change page load/save/publish behavior. |
| `roma/components/pages-domain.tsx:633-640` | Active page row only uses `data-selected` plus variant text. | Current/selected state lacks semantic truth. | Expose selected/current state on the actual row/action representation. | Do not redesign table. |
| `roma/components/pages-domain.tsx:778-788` | Copy/status/publish blockers are visible paragraphs. | Status/error semantics and internal machinery copy risk. | Add status/error semantics and replace internal package-generation wording with `Publishing is not available yet.` | Do not enable page publishing. |
| `roma/components/pages-domain.tsx:940-1010` | Add instances modal has dialog semantics. | Existing strong substrate. | Preserve; modal mechanics stay 126K. | No focus trap/scroll lock. |
| `roma/components/widgets-domain.tsx:383-397` | Load/mutation/rename/loading states visible. | Status/error semantics missing. | Add status/alert semantics around existing states. | Do not change widget routes. |
| `roma/components/widgets-domain.tsx:449` | Selected widget instance row is only `data-selected` plus visible copy. | Selected/current state lacks semantic truth. | Expose selected/current state on the actual row/action representation. | Do not redesign table. |
| `roma/components/widgets-domain.tsx:593-600` | Upgrade modal has dialog semantics; copy says counts without naming limited object. | Copy lacks affected product meaning. | Create/duplicate limit title is `Upgrade to create more widget instances.` Publish limit title is `Upgrade to publish more widget instances.` Count line is `You are using {current} of {limit} widget instances.` | Do not change entitlement flow. |
| `roma/components/widget-defaults-domain.tsx:327-338,348-386,540-560` | Load/save catches render caught `Error.message`. | Backend/API/contract implementation text can leak into widget-defaults alerts. | Use fixed product copy for widget-defaults load, compiled-control load, and save failures. | Do not change widget-defaults routes, compiled-control loading, or save behavior. |
| `roma/components/widget-defaults-domain.tsx:566-664` | Loading/contract/error states visible. | Status/error semantics missing. | Add status/alert semantics around existing states. | Do not change compiled controls loading. |
| `roma/components/widget-defaults-builder-controls.tsx:329-333` | Builder-control media/hydration catch renders caught `Error.message`. | Backend/media/hydration implementation text can leak into widget-defaults control errors. | Use fixed product copy for builder-control load failures. | Do not change control rendering, media, or hydration behavior. |
| `roma/components/team-domain.tsx:174-184` | Team load errors/loading visible. | Status/error semantics missing. | Add status/alert semantics around existing states. | Do not change team routes. |
| `roma/components/team-domain.tsx:223-226` | Invitation helper copy mentions Berlin ownership/acceptance flow. | Internal service name leaks into user-facing team UI. | Replace with user-facing pending-invitation copy. | Do not change invitation route or flow. |
| `roma/components/team-member-domain.tsx:45-51` | Member error copy fallback can render unknown implementation strings. | Backend/API implementation text can leak into member UI. | Known reasons map to product copy; unknown strings use caller fallback. | Do not change membership routes. |
| `roma/components/team-member-domain.tsx:194-203` | Member load error/loading visible. | Status/error semantics missing. | Add status/alert semantics around existing states. | Do not change membership routes. |
| `roma/components/profile-domain.tsx:39-45` | Profile/settings error copy fallback can render unknown implementation strings. | Backend/API implementation text can leak into profile UI. | Known reasons map to product copy; unknown strings use caller fallback. | Do not change settings save. |
| `roma/components/profile-domain.tsx:275-277` | Save error visible. | Error semantics missing. | Add alert semantics around existing error. | Do not change settings save. |
| `roma/components/account-locale-settings-card.tsx:101-107` | Account-locale error copy fallback can render unknown implementation strings. | Backend/API implementation text can leak into locale settings UI. | Known reasons map to product copy; unknown strings use caller fallback. | Do not change account locale rules. |
| `roma/components/account-locale-settings-card.tsx:236-244` | Error/loading/refresh visible. | Status/error semantics missing. | Add status/alert semantics around existing states. | Do not change account locale rules. |
| `roma/components/settings-domain.tsx:39-45` | Settings error copy fallback can render unknown implementation strings. | Backend/API implementation text can leak into settings UI. | Known reasons map to product copy; unknown strings use caller fallback. | Do not change ownership transfer routes. |
| `roma/components/settings-domain.tsx:157-181` | Owner transfer state visible by disabled/loading labels, `membersError`, empty-owner-candidate notice, and `ownerTransferError`. | Status semantics are missing on current visible state. | Add status/alert semantics to the current visible `membersError`, `ownerTransferLoading`, empty-owner-candidate notice, and `ownerTransferError` UI. | Do not change ownership transfer routes. |
| `roma/components/accept-invite-domain.tsx:29-35` | Invite error copy fallback can render unknown implementation strings. | Backend/API implementation text can leak into invite UI. | Known reasons map to product copy; unknown strings use caller fallback. | Do not change invitation acceptance. |
| `roma/components/accept-invite-domain.tsx:69-107` | Invite error visible; copy mentions Berlin service. | Error semantics missing; service name leaks into user copy. | Add alert semantics and replace service-name copy with `The signed-in email must match the invited email.` | Do not change invitation acceptance. |
| `roma/components/roma-account-notice-modal.tsx:40-44` | Tier drop copy renders raw tier ids and `->`. | Backend tier ids leak as user copy. | Plan labels are `Free`, `Tier 1`, `Tier 2`, `Tier 3`, `Tier 4`; sentence is `Your plan changed from {fromLabel} to {toLabel}.` | Do not change lifecycle route. |
| `roma/components/roma-account-notice-modal.tsx:98` | Dismiss failure displays raw caught error. | Backend error leaks. | Use `Could not dismiss this notice. Please try again.` while preserving visible failure truth. | Do not change dismiss mutation. |
| `roma/app/login/page.tsx:65-69` | Known errors use alert; unknown error reason displays raw key and repeats "Error code". | Backend reason keys can leak as user copy. | Unknown reason text is `Sign in failed. Try again.` and raw reason-key/error-code text is not rendered. | Do not change login route. |

## DevStudio Gaps

| Path | Evidence | 126A gap | Execution decision | Not 126A |
| --- | --- | --- | --- | --- |
| `admin/src/main.ts:235-239` | Active nav link uses `aria-current`. | Existing strong substrate. | Preserve. | Do not redesign DevStudio nav. |
| `admin/src/main.ts:292-318` | Token load/save error handling can render backend detail, reason keys, or `HTTP_*` codes into the editor status surface. | DevStudio operator UI can expose backend/API implementation language. | Use fixed product copy for load/save failures; keep status visible. | Do not change token API, write lane, governance, or generated artifacts. |
| `admin/src/main.ts:337-367` | Token editor overlay is modal-like; panel lacks dialog semantics/name relation; diff has `aria-live`. | Dialog/status truth is partial. | Add honest dialog semantics/name and preserve diff live status. | Do not change token write lane. |
| `admin/src/main.ts:346-348` | Close icon button has accessible name but icon is not hidden. | Decorative icon can leak. | Hide decorative icon. | Do not change editor close behavior. |
| `admin/src/main.ts:656-661` | `[data-token-edit]` nodes get click handlers. | Source generators now emit native buttons; preserve native controls. | Keep generated token edit triggers as native named controls; do not regress to clickable divs. | Do not alter token governance API. |
| `admin/src/data/icons.ts:8-10` | SVG markup normalized to `aria-hidden="true" focusable="false"`. | Existing strong substrate. | Preserve. | Icon origination is 126C/human-owned. |
| `admin/src/css/layout.css:127-128` | Nav focus outline removed. | Focus evidence only. | Record as not 126A execution. | No focus-ring rollout. |
| `admin/src/html/tools/entitlements.html:251` and `llm-management.html:120` | Tool roots have `aria-live`. | Existing status substrate. | Preserve if docs/code touched. | Do not alter DevStudio tools routes. |

## Documentation Gaps

These are exact living docs that the later 126 execution must update. This audit
does not rewrite them.

| Path | Current issue | 126A execution target |
| --- | --- | --- |
| `documentation/engineering/UI/README.md:17-38` | Track mapping is stale: Dieter/color/type/motion shown as 126A; components/dialogs/interactions/ops/surfaces tracks are wrong. | Replace with actual A-M map: A accessibility, B color, C icons, D typography, E interactions, F motion, G ops, H Dieter, I components, J surfaces, K dialogs, L DevStudio, M Roma. |
| `documentation/engineering/UI/accessibility.md:1-90` | Already narrowed but lacks file-level execution inventory. | Keep it as living doctrine after implementation; do not broaden into keyboard/focus/touch/contrast work. |
| `documentation/engineering/UI/dialogs-and-modals.md:1-45` | Correctly routes mechanics to 126K; must stay aligned. | Ensure 126A only owns naming/semantics, 126K owns overlay mechanics. |
| `documentation/engineering/UI/components.md:4,43-58` | Says component track is 126B and contains stale 126B execution / 126C correction wording. | Replace with 126I and remove stale ownership/correction language. |
| `documentation/engineering/UI/interactions.md:15-24` | Mentions toasts, cross-cutting focus/keyboard ownership, and stale 126D-state wording. | Replace with status/error/command-feedback ownership under 126E; keyboard/focus remain outside 126A and belong only to owning component/screen PRDs. |
| `documentation/engineering/UI/motion.md:25` | Says easing is a 126A deliverable. | Replace with 126F ownership; 126A only routes motion-only state signals. |
| `documentation/engineering/UI/color.md:7` | Points to nonexistent `126A2__SUBPRD__Color_System.md`. | Replace with `126B__PRD__Color.md`. |
| `documentation/engineering/UI/color.md:56-58,104` | Overclaims contrast as accessibility guarantee. | Replace with human-owned readability/contrast evidence under 126B; no gate. |
| `documentation/engineering/UI/dieter.md:55-58` | Routes focus/touch tokens to accessibility. | Replace with 126H/substrate ownership; 126A owns `.sr-only`/semantic truth only. |
| `documentation/engineering/UI/ops.md:42-53` | Says ops gaps close during 126C. | Replace with 126G. |
| `documentation/engineering/UI/surfaces.md:7,11-21,35-52` | Says DevStudio/Roma are 126C/126D, overstates Bob as fully standard, and contains stale 126C/126D job wording. | Replace with 126L/126M and state Bob is current editor reference with listed 126A gaps; remove stale job wording. |
| `documentation/services/bob.md:150-183,412-415` | Translation UI treatment routes to stale PRD 126D in two places and lacks terminal failure truth. | Route translation attention/status treatment to current Bob/126E/126M UI docs; remove both stale `PRD 126D` references; require success/failure terminal truth without jobs/polling. |

## Generated Artifacts

Do not hand-edit generated artifacts.

| Generated path | Source/action |
| --- | --- |
| `tokyo/product/dieter/**` | Regenerated from `dieter/**` by `pnpm build:dieter`. |
| `admin/src/html/components/*.html` | Regenerated by DevStudio/Dieter component generation. |
| `admin/src/html/foundations/{colors,icons,typography}.html` | Regenerated by `admin/scripts/generate-foundation-pages.mjs` and related generators. |
| `admin/src/data/{componentRegistry.generated.ts,icons.generated.ts,showcase.generated.ts,typography.generated.json}` | Regenerated by DevStudio generators. |
| `admin/dist/**`, `.next/**`, `.turbo/**`, `.vercel/**` | Build output only. |

Generated mirrors may be used as evidence only. Source fixes must land in the
source files or generator code that produces them.

## Explicit Non-Scope

Do not touch:

- `roma/app/api/**`;
- `bob/app/api/**`;
- `roma/lib/**` route/client/storage helpers, except `roma/lib/account-shell-copy.ts`
  when 126A is only tightening user-facing copy fallback behavior;
- `tokyo-worker/**`;
- `tokyo/product/widgets/**`;
- account runtime data under `accounts/{accountPublicId}/**`;
- page/instance/locale overlay/package data;
- `admin/functions/**` write lanes;
- Supabase migrations;
- Cloudflare Pages/Worker/R2 deploy paths;
- product save, publish, translation-generation, entitlement, account, or auth
  behavior beyond visible/status/copy semantics in UI components.

## V1-V8 Risk Map

| ID | 126A risk | Paths most exposed | Control |
| --- | --- | --- | --- |
| V1 Silent substitution | Invented labels or semantic states replace unknown product meaning. | `dropdown-edit`, `object-manager`, swatches, Roma reason-key copy. | Use visible/source-backed operation names; if unknown, route to owner/human instead of inventing. |
| V2 Silent healing | Invalid fill/upload/route state is normalized away. | `dropdown-fill.ts`, `dropdown-upload.ts`, Roma operation errors. | Expose failure truth; do not rewrite persisted/user state. |
| V3 Silent omission | Rejecting keyboard/focus/touch/contrast causes actual labels/status/errors to be skipped. | Dieter pseudo controls, Bob translation failure, Roma status/error surfaces. | Execute semantic truth only, and list non-126A mechanics separately. |
| V4 Fail-open control | Optional validators/scanners become the source of truth. | `scripts/dieter/governance-guards.mjs`, `e2e/**`, generated checks. | No runtime validator gate; docs/source own semantics. |
| V5 Corruption-as-absence | Failed/invalid state becomes "Unavailable", "empty", or idle. | `usage-domain.tsx`, `TranslationsPanel.tsx`, `dropdown-upload.ts`. | Distinguish failed, unavailable, empty, and idle in visible/status truth. |
| V6 Partial-success masquerade | Partial/bulk operation claims full success. | `assets-domain.tsx` bulk upload, Bob translation generation. | Preserve per-item/terminal result truth. |
| V7 Masquerade/redress | Popovers/dialogs/pseudo-controls get renamed without behavior truth. | `dropdown-upload`, `dropdown-edit`, `object-manager`, Roma modals, DevStudio token editor. | Name surfaces honestly; route mechanics to 126K/126I instead of relabeling. |
| V8 Runtime test dependency | Product work depends on probes or accessibility test rituals. | `e2e/**`, generated checks, governance scripts. | Use tests/checks only as verification, never runtime product dependency. |

## Audit Verdict

Before this audit existed, 126A was not execution-ready. The current PRD must
consume this audit and expose file-level blast radius before any 126A
implementation pass begins.
