# 126A Accessibility - Step 6 Current Gap Audit

Status: STEP 6 RECONCILED AFTER STEP-8 FINDINGS - six current-source gap groups and owner routing recorded; Step 8 must review the amended exact tree and all step-9 implementation remains pending.
Parent PRD: `../126A__PRD__Accessibility.md`.
Audit date: 2026-07-15.

This is a current-source pre-execution audit. It replaces the frozen 2026-06-28
snapshot in this path. It does not claim implementation, test, deploy, or
product-runtime credit.

## Authority And Scope

Canonical doctrine is `documentation/engineering/UI/accessibility.md`. The
execution boundary is `126A__PRD__Accessibility.md`. Product-owner decisions in
`126__Product_Owner_Execution_Decisions.md` are binding where work crosses into
126I Components or 126K Dialogs and Modals.

126A owns semantic product truth already visible in the UI: names, current and
selected state, loading/saving/error status, partial-success truth, decorative
media hiding, and product copy in place of raw implementation errors. It does
not own keyboard completeness, focus systems, touch targets, contrast, modal
lifecycle, responsive layout, product routes, storage, deploy, or public-widget
runtime behavior.

## Audit Method

The audit read the canonical doctrine, the 126A/126I/126K PRDs, the accepted
product-owner decisions, and every current source family named by 126A under:

- `dieter/components/**` and `dieter/tokens/**`;
- `bob/components/**` and the session error producers under `bob/lib/session/**`;
- the named Roma account/product surfaces under `roma/components/**` and login;
- the named DevStudio sources under `admin/src/**`;
- current living UI and service documentation.

Read-only evidence commands included targeted `rg`, `nl`, `sed`, `git diff`,
and `git status` reads. No tests, builds, product mutations, preflights, commits,
pushes, deploys, Cloudflare operations, or Supabase operations were run.

## Verdict

Current source leaves six direct 126A code-gap groups: one Dieter decorative-
icon/name path, three Bob error-copy/state paths, one repeated Roma product-label
path, and one DevStudio operation-state path.
The other semantic/copy repairs
previously listed for Dieter, Roma, and DevStudio are present and become
preservation requirements. Component and overlay mechanics remain real work,
but they belong to 126I and 126K rather than being disguised as 126A
implementation.

## Direct 126A Implementation Map

| Path | Current evidence | Required result | Preserve / do not change |
| --- | --- | --- | --- |
| `dieter/components/repeater/repeater.html:26-29`; `dieter/components/repeater/repeater.spec.json:20-34` | The reorder button exposes pressed state, but its two mutually exclusive decorative icon spans are not hidden from semantic output. The default showcase context omits `reorderLabel`, so generated DevStudio examples render an empty accessible name. | Add `aria-hidden="true"` to both reorder icon spans and add the default source context `"reorderLabel": "Reorder items"`. | No reorder state, button, hydration, or visual behavior change. Regenerate mirrors from source; do not hand-edit them. |
| `bob/components/ToolDrawer.tsx:58-72`; producer: `bob/lib/session/useSessionSaving.ts:69-99` | The primary save reason is mapped to product copy, but `error.detail` is appended verbatim to the visible alert. `error.paths` are separately and explicitly presented as Builder field coordinates. | Stop rendering arbitrary save `detail`. Keep mapped save copy and keep exact validation paths as operator coordinates when supplied. | No save request, validation, session, or persistence behavior change. Do not hide the save failure or the failing paths. |
| `bob/components/CopilotPane.tsx:58-100,456-486,541-545`; producer: `roma/app/api/account/instances/[instanceId]/copilot/route.ts:127-135,153-160` | Known HTTP/contract failures are normalized, but the outer catch renders any thrown `Error.message`; a network/runtime exception can therefore become assistant copy. Roma's real validation response can be `{ error: "VALIDATION", issues }` with no recognized reason key, and Bob currently drops those issue coordinates when it selects generic fallback copy. | Unknown request/runtime exceptions use stable Copilot recovery copy. Generic normalized HTTP fallback retains the validated issue summary even when no reason key maps. Preserve known normalized reason copy, validation issue paths/messages as Builder coordinates, and successful agent-authored response text. | No Copilot request, response, model, edit, undo, timeout, or Roma route behavior change. Do not replace valid agent output with a generic message. |
| `bob/components/useTranslationPreviewState.ts:24-42,50-53,79-183`; `bob/components/BuilderApp.tsx:35-79`; `bob/components/ToolDrawer.tsx:104-215`; `bob/components/TranslationsPanel.tsx:277-443`; `bob/components/Workspace.tsx:145-160,464-481`; producer: `tokyo-worker/src/routes/internal-translation-routes.ts:45-59` | Saved-translation loading/failure is calculated in the hook but `BuilderApp` drops it. The panel therefore renders apparent idle/empty state, and Workspace falls back to base instance data while a non-base locale is loading or failed. Tokyo returns genuine absence as `200` with an empty list; list `404` means the instance document is missing. Concurrent list/locale reads can also clear one shared error. | Every non-OK list or selected-locale read is `Saved translations could not be read.`; only a successful `200` empty list is absence. Keep separate list and selected-locale loading/error channels so one request class cannot clear another. Pass combined loading/failure to TranslationsPanel. When a non-base locale is selected, Workspace blocks preview with `Loading saved translation...` status or the saved-translation alert instead of sending base content as translated content. | No translation list/read route, Generate translations, locale overlay, preview materialization, refresh trigger, or polling behavior change. Successful base preview remains available. |
| `roma/lib/format.ts`; `roma/components/ai-domain.tsx:9-30`; `billing-domain.tsx:15-20`; `usage-domain.tsx:72-80`; `settings-domain.tsx:124-149`; `team-domain.tsx:185-271`; `team-member-domain.tsx:108-114,205-238`; existing label source `roma-account-notice-modal.tsx:40-60`; bootstrap authority `roma/components/use-roma-me.ts:125-135,153-194`; `roma/components/roma-account-context.tsx:49-60,74-106` | Customer-facing Roma cards render raw valid plan/profile tokens such as `tier1`; Settings, Team, and Team Member render raw lowercase role tokens, including visible select-option labels. The tier-drop notice owns correct tier labels in a duplicate local formatter. Active-account tier/role/profile values are validated fail-closed before these screens render, while the Team Member route payload remains string-typed and can put an invalid role into a select with no matching option. | Move the existing tier labels into one Roma-owned pure formatter and use `Free`, `Tier 1`, `Tier 2`, `Tier 3`, `Tier 4` for valid plan/profile display plus `Viewer`, `Editor`, `Admin`, `Owner` for valid role display/options. Keep invalid or absent active-account tier/role/profile fail-closed as account-context failure; do not weaken bootstrap or manufacture unreachable card fallbacks. For a malformed Team Member role, preserve the raw draft value internally, render a disabled selected `Invalid role` option, and keep Save disabled until the user deliberately selects a valid role. Migrate the notice and delete its duplicate formatter. | Keep stored/API enum and valid select-option values plus all entitlement, role, membership, invitation, billing, usage, notice lifecycle, bootstrap, and account behavior unchanged. Never rewrite a malformed role on read. DevStudio operator token displays are not part of this change. |
| `admin/src/html/tools/entitlements.html:263-352,410-438,1294-1385`; response authority: `admin/functions/_shared/policy-github.js:336-349` | Entitlement and AI-policy load/save/reload catches store raw backend detail in `lastError`, but `render()` never displays it. Initial load failure remains loading; save/reload failure returns to ready. Entitlement save also performs a committed POST and then a GET inside one catch, so failed refresh can falsely report a successful commit as not saved. The two save families can overlap and overwrite shared status. | Expose one serialized Policy Editor operation at a time: disable Reload and every editable policy control while reload/save is active. Render stable loading/reloading/saving/saved/error state and no raw detail. A successful entitlement POST consumes its returned matrix directly and does not perform the ambiguous follow-up GET. A `2xx` response missing its committed matrix renders truthful partial-success copy: the change was saved but latest policy could not be shown; Reload is the recovery. Apply the same response-shape truth to AI-policy save. Explicit Reload owns refresh and clears prior operation feedback only after successful read. | No entitlement/AI runtime API endpoint, request body, matrix schema, tier, policy, auth, or DevStudio route change. No queue/retry framework; serialization is local control state only. |

There are no other direct 126A code changes authorized by this audit.

## 126I Component Routing

These are current component-source gaps, not 126A implementation:

| Owner | Exact source | Required owner result |
| --- | --- | --- |
| 126I | `dieter/components/dropdown-actions/dropdown-actions.html:11-17` | Convert the fake trigger to a native button while preserving listbox and expanded-state truth. |
| 126I | `dieter/components/dropdown-fill/dropdown-fill.html:19-25` | Convert the fake trigger to a native button without changing fill behavior. |
| 126I | `dieter/components/dropdown-border/dropdown-border.html:12-18` | Convert the fake trigger to a native button without changing border behavior. |
| 126I | `dieter/components/dropdown-shadow/dropdown-shadow.html:17-23` | Convert the fake trigger to a native button without changing shadow behavior. |
| 126I | `dieter/components/dropdown-upload/dropdown-upload.html:22-28` | Convert the fake trigger to a native button without changing upload behavior. |
| 126I | `dieter/components/dropdown-edit/dropdown-edit.html:1-5` | Convert the fake trigger to a native button without changing rich-text behavior. |
| 126I | `dieter/components/bulk-edit/bulk-edit.ts:394-452` | Update the independently generated upload-control markup with the `dropdown-upload` contract; do not leave this second fake trigger behind. |
| 126I | `dieter/components/textrename/**` plus its exports, hydration, registry, and generated artifacts | Delete the unconsumed component. Do not convert or preserve it. |

The six dropdown source triggers are the settled native-conversion set.
`textrename` is a deletion target, not a seventh conversion. The inline
`bulk-edit` upload control is a second producer of `dropdown-upload` markup and
must move with that component contract.

## 126K Dialog And Popover Routing

These current surfaces require 126K semantics/lifecycle execution. 126A only
preserves their truthful names and visible state:

| Current family | Exact source | 126K classification / work |
| --- | --- | --- |
| Blocking work dialog | `dieter/components/bulk-edit/bulk-edit.html:13-19`; `bulk-edit.ts` | Keep as a blocking dialog and apply accepted D1 dirty/unchanged dismissal law plus focus, return, inertness, and scroll mechanics. |
| Blocking work dialog | `dieter/components/object-manager/object-manager.html:36-39`; `object-manager.js` | Keep its current truthful dialog name; add blocking-dialog semantics and accepted D1 lifecycle without changing reorder/delete behavior. |
| Choice popover | `dieter/components/dropdown-actions/dropdown-actions.html:29-34` | Preserve listbox classification; delete the dead footer branch under 126I rather than calling it a dialog. |
| Editing popovers | `dieter/components/dropdown-fill/dropdown-fill.html:40-45`, `dropdown-border.html:33-38`, `dropdown-shadow.html:38-43` | Replace the current listbox classification with truthful non-modal editing-dialog semantics; preserve editing behavior. |
| Editing popovers | `dieter/components/dropdown-upload/dropdown-upload.html:38`; `dropdown-edit/dropdown-edit.html:7`; `textedit/textedit.html:13` | Preserve truthful names and complete the non-modal dialog-popover mechanics owned by 126K. |
| Generated editing popover | `dieter/components/bulk-edit/bulk-edit.ts:452` | Move with the upload popover contract; do not leave an independently classified copy. |

## Current Preservation Evidence

The following current behavior is green for 126A and must not be reimplemented
or expanded during its direct slice:

| Surface | Current evidence |
| --- | --- |
| Dieter semantic substrate | `.sr-only`; Agent Activity live status; decorative base-button icons; named Object Manager row actions; named swatches; invalid fill state; upload/media status and errors; named/pressed formatting commands; text-link labeling; tabs, choice tiles, toggle, repeater state, and Bulk Edit semantics are present in the source paths named by the PRD. The Repeater icon/name path above is the only direct Dieter exception found. |
| Bob status/state | Workspace loading/error/status overlays, Assist-mode radio truth, selected ToolDrawer tabs, translation locale labels, terminal translation-generation failure, Agent Activity status, upsell reason mapping, `Sending...`, and TopDrawer saving truth are present. Saved-translation read failure propagation is the direct exception named above. |
| Roma account/product UI | Current-page nav, sign-out busy state, account/error/loading status, usage failure versus unavailable, asset partial success, page/widget selected rows, user-facing locale labels, publishing-unavailable copy, widget-limit copy, widget-defaults failures, team/invite/profile/settings/locale status and fallback copy, tier-drop notice labels, dismiss failure, and login fallback are present. The repeated raw plan/profile/role labels above are the only direct Roma exception found. |
| DevStudio | Current nav state, fixed Dieter token load/save copy, named token-editor dialog, decorative close icon hiding, native named token-edit triggers, normalized decorative SVGs, and existing tool live regions are present. DevStudio token identifiers remain legitimate operator coordinates. Policy Editor operation-state rendering is the direct exception named above. |
| Living docs | Current UI doctrine and Bob/Roma/DevStudio service docs use living-doc authority and current A-M ownership. No Step-6 code gap requires a living-doc behavior rewrite. |

## Deletion And No-Change Map

Direct 126A file-deletion count is zero. Its implementation slices hide two
decorative Repeater icons and supply their missing generated name, remove two
raw Bob error-render paths, expose saved-translation read failure, replace
repeated raw Roma product-token rendering inside retained components, expose
DevStudio Policy Editor operation failures, and delete the notice's duplicate
local tier-label formatter; they do not delete product components or files.

Deletion routed to 126I:

- `dieter/components/textrename/**` and all source/generated references;
- the dead `dropdown-actions` Apply/Cancel footer branch already named by 126I.

Do not touch during direct 126A implementation:

- Roma account/bootstrap behavior, DevStudio policy operations, and Dieter
  component behavior; generated Dieter mirrors are regenerated only from the
  Repeater source/spec change and are never hand-edited;
- `bob/app/api/**`, `roma/app/api/**`, `admin/functions/**`, or route clients;
- `tokyo-worker/**`, `tokyo/product/widgets/**`, account runtime data, R2,
  Cloudflare, Supabase, migrations, or deploy configuration;
- save, translation, Copilot, auth, entitlement, publish, or asset operation
  behavior;
- public widget runtime accessibility;
- keyboard, focus, touch, contrast, responsive layout, or dialog mechanics.

## Step 7 Input (Consumed)

Step 7 must convert only the six direct rows above into a small implementation
and verification plan. It must also preserve the 126I/126K routing as
dependencies, not pull those changes into 126A. The minimum verification
surface is the Dieter build/typecheck plus Bob and Roma lint/typecheck and the
existing DevStudio route-contract surface, with focused proof for Repeater icon
hiding/naming, safe save-error, Copilot exception and issue-only payload,
saved-translation failure, plan/profile/role copy, and Policy Editor operation
state. No generic accessibility validator or new runtime dependency is
authorized.

## V1-V8 Audit

| ID | Result | Reason |
| --- | --- | --- |
| V1 Silent substitution | PASS | The audit distinguishes stable product fallback copy from valid Builder coordinates and valid agent-authored output. |
| V2 Silent healing | PASS | No persisted, invalid, or failed state is rewritten or normalized. |
| V3 Silent omission | PASS | The Repeater icon/name gap, three Bob paths, repeated Roma product-label gap, DevStudio Policy Editor gap, `bulk-edit` duplicate trigger, `textrename` deletion, and every current dialog/popover family are named. |
| V4 Fail-open control | PASS | No scanner, validator, or optional dependency becomes product truth. |
| V5 Corruption-as-absence | PASS | Translation absence is only successful `200 []`; every failed read remains failed and blocks translated preview. Malformed Team Member role remains invalid instead of blank/healed; Policy Editor failure is separated from loading/ready. |
| V6 Partial-success masquerade | PASS | Policy save uses the committed response directly and distinguishes non-OK save failure from successful commit with unusable returned state. Serialized controls prevent sibling success from overwriting a live failure. |
| V7 Masquerade/redress | PASS | Component and overlay work is routed to 126I/126K instead of being renamed as 126A completion. |
| V8 Runtime test dependency | PASS | Proposed checks verify later implementation only; runtime behavior gains no test dependency. |

## Step 6 Closure

126A Step 6 is reconciled as a pre-execution audit. Step 7 now carries all six
direct gap groups into the exact change/test checklist in the parent 126A PRD.
The domain is not implementation-ready until Step 8 independently reviews that
amended checklist at an exact recorded tree. No step-9 execution has begun.
