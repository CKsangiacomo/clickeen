# 126A Accessibility - Step 6 Current Gap Audit

Status: STEP 6 COMPLETE - current-source gaps and owner routing recorded; the Step-7 final PRD now consumes this audit; Step 8 and all step-9 implementation remain pending.
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

Current source leaves four direct 126A code-gap groups: one Dieter decorative-
icon path, two Bob error-copy paths, and one repeated Roma product-label path.
The other semantic/copy repairs
previously listed for Dieter, Roma, and DevStudio are present and become
preservation requirements. Component and overlay mechanics remain real work,
but they belong to 126I and 126K rather than being disguised as 126A
implementation.

## Direct 126A Implementation Map

| Path | Current evidence | Required result | Preserve / do not change |
| --- | --- | --- | --- |
| `dieter/components/repeater/repeater.html:26-29` | The reorder button is truthfully named and exposes pressed state, but its two mutually exclusive decorative icon spans are not hidden from semantic output. | Add `aria-hidden="true"` to both reorder icon spans. | No reorder state, label, button, hydration, or visual behavior change. Regenerate mirrors from source; do not hand-edit them. |
| `bob/components/ToolDrawer.tsx:58-72`; producer: `bob/lib/session/useSessionSaving.ts:69-99` | The primary save reason is mapped to product copy, but `error.detail` is appended verbatim to the visible alert. `error.paths` are separately and explicitly presented as Builder field coordinates. | Stop rendering arbitrary save `detail`. Keep mapped save copy and keep exact validation paths as operator coordinates when supplied. | No save request, validation, session, or persistence behavior change. Do not hide the save failure or the failing paths. |
| `bob/components/CopilotPane.tsx:456-486,541-545` | Known HTTP/contract failures are normalized, but the outer catch renders any thrown `Error.message`; a network/runtime exception can therefore become assistant copy. | Unknown request/runtime exceptions use stable Copilot recovery copy. Preserve known normalized reason copy, validation issue paths/messages as Builder coordinates, and successful agent-authored response text. | No Copilot request, response, model, edit, undo, or timeout behavior change. Do not replace valid agent output with a generic message. |
| `roma/lib/format.ts`; `roma/components/ai-domain.tsx:9-13,22-30`; `billing-domain.tsx:15-20`; `usage-domain.tsx:72-80`; `settings-domain.tsx:124-149`; `team-domain.tsx:185-271`; `team-member-domain.tsx:205-238`; existing label source `roma-account-notice-modal.tsx:40-60` | Customer-facing Roma cards render raw plan/profile tokens such as `tier1`; Settings, Team, and Team Member also render raw lowercase role tokens, including visible select-option labels. The tier-drop notice already owns the correct tier labels in a duplicate local formatter. | Move the existing tier labels into one Roma-owned pure formatter; use `Free`, `Tier 1`, `Tier 2`, `Tier 3`, `Tier 4` everywhere plan/profile truth is shown and `Viewer`, `Editor`, `Admin`, `Owner` everywhere Roma displays or selects a role; use exact `Invalid plan` / `Invalid role` copy for present non-contract values while absent AI profile remains `Not assigned`; migrate the notice and delete its duplicate local formatter. | Keep stored/API enum and select-option values plus all entitlement, role, membership, invitation, billing, usage, notice lifecycle, and account behavior unchanged. DevStudio operator token displays are not part of this change. |

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
| Dieter semantic substrate | `.sr-only`; Agent Activity live status; decorative base-button icons; named Object Manager row actions; named swatches; invalid fill state; upload/media status and errors; named/pressed formatting commands; text-link labeling; tabs, choice tiles, toggle, repeater state, and Bulk Edit semantics are present in the source paths named by the PRD. The two Repeater reorder icons above are the only direct Dieter exception found. |
| Bob status/state | Workspace loading/error/status overlays, Assist-mode radio truth, selected ToolDrawer tabs, translation locale labels, terminal translation failure, Agent Activity status, upsell reason mapping, `Sending...`, TopDrawer saving truth, and saved-translation read fallbacks are present. |
| Roma account/product UI | Current-page nav, sign-out busy state, account/error/loading status, usage failure versus unavailable, asset partial success, page/widget selected rows, user-facing locale labels, publishing-unavailable copy, widget-limit copy, widget-defaults failures, team/invite/profile/settings/locale status and fallback copy, tier-drop notice labels, dismiss failure, and login fallback are present. The repeated raw plan/profile/role labels above are the only direct Roma exception found. |
| DevStudio | Current nav state, fixed Dieter token load/save copy, named token-editor dialog, decorative close icon hiding, native named token-edit triggers, normalized decorative SVGs, and existing tool live regions are present. DevStudio token identifiers remain legitimate operator coordinates. |
| Living docs | Current UI doctrine and Bob/Roma/DevStudio service docs use living-doc authority and current A-M ownership. No Step-6 code gap requires a living-doc behavior rewrite. |

## Deletion And No-Change Map

Direct 126A file-deletion count is zero. Its implementation slice hides two
decorative Repeater icons, removes two raw Bob error-render paths, replaces
repeated raw Roma product-token rendering inside retained components, and
deletes the notice's duplicate local tier-label formatter; it does not delete
product components or files.

Deletion routed to 126I:

- `dieter/components/textrename/**` and all source/generated references;
- the dead `dropdown-actions` Apply/Cancel footer branch already named by 126I.

Do not touch during direct 126A implementation:

- Roma/DevStudio behavior and Dieter component behavior; generated Dieter
  mirrors are regenerated only from the Repeater source change and are never
  hand-edited;
- `bob/app/api/**`, `roma/app/api/**`, `admin/functions/**`, or route clients;
- `tokyo-worker/**`, `tokyo/product/widgets/**`, account runtime data, R2,
  Cloudflare, Supabase, migrations, or deploy configuration;
- save, translation, Copilot, auth, entitlement, publish, or asset operation
  behavior;
- public widget runtime accessibility;
- keyboard, focus, touch, contrast, responsive layout, or dialog mechanics.

## Step 7 Input (Consumed)

Step 7 must convert only the four direct rows above into a small implementation
and verification plan. It must also preserve the 126I/126K routing as
dependencies, not pull those changes into 126A. The minimum verification
surface is the Dieter build/typecheck plus Bob and Roma lint/typecheck, with
focused proof for Repeater icon hiding, safe save-error, Copilot-exception, and
plan/profile/role copy. No generic accessibility validator or new runtime
dependency is authorized.

## V1-V8 Audit

| ID | Result | Reason |
| --- | --- | --- |
| V1 Silent substitution | PASS | The audit distinguishes stable product fallback copy from valid Builder coordinates and valid agent-authored output. |
| V2 Silent healing | PASS | No persisted, invalid, or failed state is rewritten or normalized. |
| V3 Silent omission | PASS | The Repeater icon gap, two Bob gaps, repeated Roma product-label gap, `bulk-edit` duplicate trigger, `textrename` deletion, and every current dialog/popover family are named. |
| V4 Fail-open control | PASS | No scanner, validator, or optional dependency becomes product truth. |
| V5 Corruption-as-absence | PASS | Existing error, invalid, unavailable, empty, and partial-success distinctions are preserved. |
| V6 Partial-success masquerade | PASS | Roma bulk-upload and Bob terminal translation truth remain explicit preservation requirements. |
| V7 Masquerade/redress | PASS | Component and overlay work is routed to 126I/126K instead of being renamed as 126A completion. |
| V8 Runtime test dependency | PASS | Proposed checks verify later implementation only; runtime behavior gains no test dependency. |

## Step 6 Closure

126A Step 6 is green as a pre-execution audit. Step 7 has turned the four direct
gap groups into the exact change/test checklist in the parent 126A PRD. The
domain is not implementation-ready until Step 8 independently reviews that
checklist at an exact recorded tree. No step-9 execution has begun.
