# 126A - PRD: Accessibility

Status: PRE-EXECUTION READY - three-lane review green.
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
- Codex step-6 execution audit: `audits/126A__Audit__Accessibility.md`.
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

126A owns these exact copy/state replacements where current UI leaks backend
terms, raw keys, or meaningless progress text.

| Current source | 126A target |
| --- | --- |
| `bob/components/TranslationsPanel.tsx:184-197` clears activity after generate failure. | Show terminal alert/status text `Translation generation failed. Please try again.` when `generateTranslations` throws or returns a failed result. |
| `bob/components/UpsellPopup.tsx:41-49` renders raw `reasonKey`. | Map `coreui.upsell.reason.limitReached` to `You've reached your plan limit.`; map `coreui.upsell.reason.flagBlocked` to `This option is not available on your current plan.`; fallback to `This action requires a plan upgrade.`. Never render the raw key. |
| `bob/components/CopilotPane.tsx:43` says `received an HTML error page`. | `Copilot is temporarily unavailable. Please try again in a moment.` |
| `bob/components/CopilotPane.tsx:44` maps `Unhandled error` to backend-timeout copy. | `Copilot could not complete the request. Please try again with a smaller change.` |
| `bob/components/CopilotPane.tsx:45-48` exposes empty/execution implementation wording. | Empty response: `Copilot did not return an edit. Please try again with a smaller, more specific request.` Timeout: `Copilot timed out. Please try again with a smaller change.` |
| `bob/components/CopilotPane.tsx:713-724` shows `...` while sending. | Button label is `Sending...`. |
| `roma/components/usage-domain.tsx:23-43` collapses usage read failure to `Unavailable`. | Failed read shows `Storage usage could not be loaded.` as alert/status. True missing/unavailable usage data remains `Unavailable`. |
| `roma/components/pages-domain.tsx:786` says page package generation must be enabled. | `Publishing is not available yet.` |
| `roma/components/widgets-domain.tsx:48-51,595-600` uses generic upgrade counts. | Create/duplicate limit title: `Upgrade to create more widget instances.` Publish limit title: `Upgrade to publish more widget instances.` Count line: `You are using {current} of {limit} widget instances.` |
| `roma/components/accept-invite-domain.tsx:106` says Berlin will accept the invitation. | `The signed-in email must match the invited email.` |
| `roma/components/roma-account-notice-modal.tsx:43` prints raw tier ids and `->`. | Plan labels are `Free`, `Tier 1`, `Tier 2`, `Tier 3`, `Tier 4`; sentence is `Your plan changed from {fromLabel} to {toLabel}.` |
| `roma/components/roma-account-notice-modal.tsx:98` appends raw dismiss error. | `Could not dismiss this notice. Please try again.` |
| `roma/app/login/page.tsx:65-69` displays unknown reason keys and `Error code: {errorReason}`. | Unknown reason text is `Sign in failed. Try again.`; login UI must not render raw reason-key/error-code text. |

## Hard Exclusions

126A must not touch:

- `roma/app/api/**`;
- `bob/app/api/**`;
- `roma/lib/**` route/client/storage helpers, except `roma/lib/account-shell-copy.ts`
  when 126A is only tightening user-facing copy fallback behavior;
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

## Execution Slices

### Slice 1 - Dieter Source Semantics

126A scope for Dieter is only the source files listed in the table below.
Generated Dieter mirrors are evidence only.

| Path | Required 126A action | Must not do |
| --- | --- | --- |
| `dieter/tokens/dieter-foundation-tokens.css:92` | Preserve `.sr-only` as canonical hidden-text utility. | No focus/touch token program. |
| `dieter/components/agent-activity/agent-activity.html:1` | Preserve `role="status"` / `aria-live="polite"` Agent Activity semantics. | No generic job/polling framework. |
| `dieter/components/button/button.html:1-3` | Hide decorative icon spans when label/aria-label names the operation; require icon-only consumers to pass truthful labels. | No size, color, focus, or variant redesign. |
| `dieter/components/object-manager/object-manager.html:38-68`; `object-manager.js:339-360` | Treat the current reorder overlay as dialog-like and add truthful dialog semantics/name; add source-backed names for up/down/delete icon-only row controls. | No data-model rewrite, focus trap, Escape, scroll lock, or modal framework. |
| `dieter/components/dropdown-actions/dropdown-actions.html:13-16`; `dropdown-actions.ts:291`; `shared/dropdownToggle.ts:37` | Preserve `aria-expanded`/`aria-selected`; record pseudo-trigger conversion as a 126I component cleanup, not 126A work. | No listbox keyboard navigation. |
| `dieter/components/dropdown-fill/dropdown-fill.html:21-24,103-239,425-520`; `dropdown-fill.ts:454-461`; `media-controller.ts:43-46` | Record pseudo-trigger conversion as 126I; name color swatches from actual value/source; expose invalid/media error truth without inventing asset alt text. | No color/contrast changes; no invalid-value healing. |
| `dieter/components/dropdown-border/dropdown-border.html:14-17,101-160` | Record pseudo-trigger conversion as 126I; name swatches from actual value/source. | No color/contrast changes. |
| `dieter/components/dropdown-shadow/dropdown-shadow.html:19-22,106-166` | Record pseudo-trigger conversion as 126I; name swatches from actual value/source. | No color/contrast changes. |
| `dieter/components/dropdown-upload/dropdown-upload.html:23-38,57-90`; `dropdown-upload.ts:492-498` | Treat the current panel as non-modal popover content, not modal-dialog doctrine; expose visible file/error text semantically. | No corrupt metadata healing; no modal framework. |
| `dieter/components/dropdown-edit/dropdown-edit.html:2-7,29-93`; `dropdown-edit.ts:308-318` | Treat the current panel as non-modal popover content; label exact formatting commands; mirror existing active command state semantically. | No rich-text behavior rewrite. |
| `dieter/components/textedit/textedit.html:13-35` | Give link URL input a visible/programmatic label while preserving textedit behavior. | No textedit flow rewrite. |
| `dieter/components/textrename/textrename.html:2-4` | Record view-mode pseudo-control conversion as a 126I component cleanup; preserve existing edit input semantics. | No keyboard-support project. |
| `dieter/components/tabs/tabs.html:1`; `tabs.ts:7-13` | Preserve existing tab semantics. | No Home/End or keyboard expansion. |
| `dieter/components/choice-tiles/choice-tiles.html:10-18`; `choice-tiles.ts:85-91` | Preserve existing radiogroup/radio state. | No keyboard expansion. |
| `dieter/components/bulk-edit/bulk-edit.html:18` | Preserve existing dialog semantics. | No focus trap/scroll lock; route mechanics to 126K. |
| `dieter/components/toggle/toggle.html:9` | Preserve existing switch semantics. | No size/focus program. |
| `dieter/components/repeater/repeater.html:26-29`; `repeater.js:247-250` | Preserve existing reorder label and pressed-state sync. | Do not hand-edit generated empty-label examples. |

Compliance reason: Dieter is the design-system source. 126A cleans semantic truth
at source or records exact component-owned gaps for 126I/126K. It does not create
a parallel accessibility system.

### Slice 2 - Bob Semantic And Copy Truth

126A scope for Bob is only the files listed in the table below.

| Path | Required 126A action | Must not do |
| --- | --- | --- |
| `bob/components/Workspace.tsx:388-407` | Preserve iframe title plus status/alert overlays. | No preview runtime change. |
| `bob/components/ToolDrawer.tsx:35-48` | Known builder/session reasons map to product copy; unknown implementation strings use the caller fallback. | No session/save behavior change. |
| `bob/components/ToolDrawer.tsx:215-310` | Preserve Assist mode radio truth and existing alert surfaces. | No session/save behavior change. |
| `bob/components/TdMenu.tsx:53-65` | Preserve selected tab semantics. | No tab keyboard expansion. |
| `bob/components/TranslationsPanel.tsx:27-36` | Use user-facing locale names; unresolved locale fallback is `Language unavailable`, not the backend locale token. | No locale generation behavior change. |
| `bob/components/TranslationsPanel.tsx:94-105` | Preserve Agent Activity live-status semantics. | No persistent job tracker. |
| `bob/components/TranslationsPanel.tsx:184-197` | Show terminal alert/status `Translation generation failed. Please try again.` when Generate translations fails instead of clearing activity to idle. | Do not put translation generation in save; no polling/package probes. |
| `bob/components/useTranslationPreviewState.ts:88-111` | Keep saved-translation read failures user-facing; unknown route/HTTP reason keys collapse to the existing saved-translation fallback copy instead of leaking raw keys. | No translation route, save, polling, package generation, or overlay behavior change. |
| `bob/components/UpsellPopup.tsx:41-49` | Apply the exact upsell reason mapping in "Exact Copy And State Targets". | No monetization flow redesign. |
| `bob/components/CopilotPane.tsx:43-48` | Apply the exact Copilot failure copy in "Exact Copy And State Targets". | No Copilot API behavior change. |
| `bob/components/CopilotPane.tsx:84-120` | Known Copilot reason keys map to product copy; unknown backend `detail`, `message`, `error`, body text, or status codes do not render as user copy. | No Copilot API/request behavior change. |
| `bob/components/CopilotPane.tsx:713-724` | Replace `...` with `Sending...`. | No Copilot request flow change. |
| `bob/components/td-menu-content/useTdMenuHydration.ts:76` | Preserve existing alert fallback. | No runtime/probe dependency. |
| `bob/components/TopDrawer.tsx:35-46` | Preserve existing truthful Saving text. | No save process change. |

Compliance reason: Bob is the editor surface where agent operations are visible
to the user. 126A fixes semantic/copy truth without changing save, translation,
Copilot, preview, or session behavior.

### Slice 2A - Dieter Account Asset Copy Boundary

| Path | Required 126A action | Must not do |
| --- | --- | --- |
| `dieter/components/shared/account-assets.ts:32-40` | Preserve backend reason keys as internal control signals, including existing upsell dispatch, but expose mapped user copy before rendering. | No account-asset route, upload, resolve, storage, or entitlement behavior change. |
| `dieter/components/shared/account-asset-resolve.ts:20-29` | Map asset preview resolve failures to product copy before passing them to UI renderers. | Do not silently heal missing or invalid asset refs. |
| `dieter/components/dropdown-fill/media-controller.ts:292-338` | Render user-facing asset load/upload failures while preserving existing list/upload behavior and upsell dispatch. | No media picker redesign or account asset source change. |
| `dieter/components/dropdown-upload/dropdown-upload.ts:226-243` | Render user-facing upload failure copy while preserving existing metadata/write behavior and upsell dispatch. | No upload flow redesign. |

Compliance reason: Account assets are current product UI inside Dieter controls.
126A owns whether raw route keys become visible copy; it does not own asset
storage, routes, entitlement, or upload mechanics.

### Slice 3 - Roma Semantic And Copy Truth

126A scope for Roma is only the files listed in the table below.

| Path | Required 126A action | Must not do |
| --- | --- | --- |
| `roma/components/roma-nav.tsx:17-38` | Preserve `aria-current`. | No nav redesign. |
| `roma/components/roma-sign-out-button.tsx:27-35` | Preserve disabled/`aria-busy` pending truth. | No auth route change. |
| `roma/components/roma-account-context.tsx:74-106` | Add status/alert semantics to existing loading, redirecting, unavailable, and no-context states. | No bootstrap/session behavior change. |
| `roma/components/roma-domain-error-boundary.tsx:54-75` | Add alert semantics to existing render error UI. | No error reset/reload behavior change. |
| `roma/components/usage-domain.tsx:23-43` | Failed storage read shows `Storage usage could not be loaded.` as alert/status; true unavailable data remains `Unavailable`. | No usage API change. |
| `roma/components/assets-domain.tsx:323-374` | Add alert/status semantics around existing load/upload/delete errors. | No asset route or upload/delete behavior change. |
| `roma/components/assets-domain.tsx:426-456` | Preserve partial-success truth; make bulk item status user-facing and semantically visible. | No bulk upload processing change. |
| `roma/lib/account-shell-copy.ts:21-30` | Shared account-shell error copy returns mapped product copy or the caller fallback; unknown backend namespaces do not render as user copy. | No account route/client/storage behavior change. |
| `roma/components/pages-domain.tsx:35-42` | Show user-facing locale labels in page UI; do not show backend locale codes as page copy. | No locale storage change. |
| `roma/components/pages-domain.tsx:614-617,778-788` | Add status/alert semantics to data/mutation/loading/blocker copy; replace page-package-generation wording with `Publishing is not available yet.` | Do not enable or change publishing. |
| `roma/components/pages-domain.tsx:633-640` | Expose active/selected page row truth semantically. | No table redesign. |
| `roma/components/pages-domain.tsx:940-1010` | Preserve Add instances dialog semantics. | No modal mechanics. |
| `roma/components/widgets-domain.tsx:383-397` | Add status/alert semantics to load/mutation/rename/loading states. | No widget route change. |
| `roma/components/widgets-domain.tsx:449` | Expose selected/current widget row truth semantically. | No table redesign. |
| `roma/components/widgets-domain.tsx:593-600` | Preserve upgrade dialog and apply widget-instance limit copy from "Exact Copy And State Targets". | No entitlement flow change. |
| `roma/components/widget-defaults-domain.tsx:327-338,348-386,540-560` | Widget-defaults load, compiled-control load, and save failures use fixed product copy instead of caught backend messages. | No widget-defaults route, compiled-control, or save behavior change. |
| `roma/components/widget-defaults-domain.tsx:566-664` | Add status/alert semantics to loading/contract/error states. | No compiled-controls behavior change. |
| `roma/components/widget-defaults-builder-controls.tsx:329-333` | Builder-control media/hydration failures use fixed product copy instead of caught backend messages. | No control rendering, media, or hydration behavior change. |
| `roma/components/team-domain.tsx:174-184,223-226` | Add status/alert semantics to load error/loading states; replace internal service-name invitation copy with user-facing pending-invitation copy. | No team route or invitation behavior change. |
| `roma/components/team-member-domain.tsx:45-51` | Known member reasons map to product copy; unknown implementation strings use the caller fallback. | No membership route change. |
| `roma/components/team-member-domain.tsx:194-203` | Add status/alert semantics to load error/loading states. | No membership route change. |
| `roma/components/profile-domain.tsx:39-45` | Known profile/settings reasons map to product copy; unknown implementation strings use the caller fallback. | No settings save change. |
| `roma/components/profile-domain.tsx:275-277` | Add alert semantics around save error. | No settings save change. |
| `roma/components/account-locale-settings-card.tsx:101-107` | Known account-locale reasons map to product copy; unknown implementation strings use the caller fallback. | No account locale rule change. |
| `roma/components/account-locale-settings-card.tsx:236-244` | Add status/alert semantics around error/loading. | No account locale rule change. |
| `roma/components/settings-domain.tsx:39-45` | Known settings reasons map to product copy; unknown implementation strings use the caller fallback. | No ownership transfer route change. |
| `roma/components/settings-domain.tsx:157-181` | Add status/alert semantics to the current visible `membersError`, `ownerTransferLoading`, empty-owner-candidate notice, and `ownerTransferError` UI. | No ownership transfer route change. |
| `roma/components/accept-invite-domain.tsx:29-35` | Known invite reasons map to product copy; unknown implementation strings use the caller fallback. | No invitation route change. |
| `roma/components/accept-invite-domain.tsx:69-107` | Add alert semantics to invite error; replace Berlin service-name copy with `The signed-in email must match the invited email.` | No invitation route change. |
| `roma/components/roma-account-notice-modal.tsx:40-44,98` | Apply exact plan-label and dismiss-failure copy from "Exact Copy And State Targets". | No lifecycle mutation change. |
| `roma/app/login/page.tsx:65-69` | Keep known alert; unknown reason text is `Sign in failed. Try again.` and raw reason-code text is not rendered. | No login route change. |

Compliance reason: Roma is account/product operations UI. 126A makes visible
state, selected/current truth, partial success, and error copy non-masquerading
without touching account authorities or product data.

### Slice 4 - DevStudio Semantic And Copy Truth

126A scope for DevStudio is only the files listed in the table below.

| Path | Required 126A action | Must not do |
| --- | --- | --- |
| `admin/src/main.ts:235-239` | Preserve `aria-current` active nav truth. | No DevStudio nav redesign. |
| `admin/src/main.ts:292-318` | Token load/save failures use fixed product copy and never render backend detail, reason keys, or `HTTP_*` codes into the token editor status surface. | No token write lane or API behavior change. |
| `admin/src/main.ts:337-367` | Add honest dialog semantics/name to token editor panel; preserve diff `aria-live`. | No token write lane change. |
| `admin/src/main.ts:346-348` | Hide decorative close icon. | No close behavior change. |
| `admin/src/main.ts:656-661` | Preserve generated token edit triggers as native named controls. | No token governance API change. |
| `admin/src/data/icons.ts:8-10` | Preserve `aria-hidden`/`focusable=false` SVG normalization. | No icon origination change. |
| `admin/src/css/layout.css:127-128` | Record focus evidence only. | No focus-ring rollout. |
| `admin/src/html/tools/entitlements.html:251`; `admin/src/html/tools/llm-management.html:120` | Preserve existing `aria-live` tool roots. | No DevStudio tool route change. |

Compliance reason: DevStudio is Dieter's reveal/steer cockpit. 126A keeps reveal
and editor status honest without changing the token write operation.

### Slice 5 - Living Documentation

These documentation updates are part of the later 126 execution. They are listed
here so documentation is not omitted from blast radius.

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

### Slice 6 - Generated Artifacts

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

## Verification

Before implementation starts, verify scope with:

```bash
test -f Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/audits/126A__Audit__Accessibility.md
rg -n "126A2__SUBPRD__Color_System|126C__PRD|126D__PRD|track 126A|track 126B|\\*\\(126A\\)|\\*\\(126B\\)|\\*\\(126C\\)|\\*\\(126B/126D\\)|\\*\\(126C/126D\\)|PRD 126D|during 126B|during 126C|126C corrections|126C's job|126D's job|126D Step|focus & keyboard|focus/keyboard|toasts|easing.*126A" documentation/engineering/UI documentation/services/bob.md
rg -n "role=\"button\"|aria-label=\"\"|role=\"dialog\"|aria-modal|role=\"status\"|role=\"alert\"|aria-live|aria-current|aria-selected|aria-checked|aria-expanded|aria-haspopup" dieter/components bob/components roma/components roma/app/login/page.tsx admin/src --glob '*.{html,ts,tsx,js}'
rg -n "coreui\\.|HTTP_|backend|Berlin|page package generation|\\.\\.\\.|tier[0-9]|->|Unavailable" bob/components roma/components roma/app/login/page.tsx admin/src --glob '*.{ts,tsx,html}'
```

After implementation, run focused checks for changed surfaces:

```bash
pnpm build:dieter              # if Dieter source changed
pnpm --filter @clickeen/devstudio generate  # if generated DevStudio/Dieter pages are affected and this command exists in the repo scripts
pnpm --filter @clickeen/bob lint             # if Bob changed
pnpm --filter @clickeen/roma lint            # if Roma changed
pnpm --filter @clickeen/devstudio lint       # if DevStudio changed and this command exists in the repo scripts
```

If a command does not exist, record that fact. Do not add a new validator/check
suite for 126A.

After Slice 5 documentation cleanup, the stale-doc `rg` sweep above must return
no matches unless a match is explicitly current product law in the edited doc.

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
