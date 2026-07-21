# 126K - Current-Source Pre-Execution Audit: Dialogs And Modals

Status: STEP 6 COMPLETE - current blocking dialogs, popovers, browser guards,
and Upgrade paths audited; Step 7 is defined in
`../126K__PRD__Dialogs_and_Modals.md`; no Step-9 execution credit.

## Audit Result

The product policy is complete, but current source implements several local
modal families with incomplete lifecycle behavior. The smallest cohesive fix is
native `<dialog>` plus one DOM-only Dieter helper. Workflow state remains local.
The helper is shared as monorepo source and bundled by each current app/component
build; Dieter does not become a general package or runtime loader.

## Current Blocking Dialog Inventory

| Workflow | Current source gap |
| --- | --- |
| Bulk Edit | Escape/backdrop drop work; no dirty confirmation, focus return, or scroll lifecycle. |
| Object Manager | Incomplete semantics/lifecycle and an accumulating backdrop listener. |
| Roma Add Instances | ARIA wrapper without complete lifecycle. |
| Roma Bulk Upload | ARIA wrapper does not enforce running-state dismissal. |
| Roma tier-drop notice | ARIA wrapper does not enforce required-action dismissal. |
| Roma plan-limit prompt | Local wrapper routes Upgrade to Billing. |
| Bob plan-limit prompt | Local wrapper lacks complete native lifecycle. |
| Roma upsell scaffold | Missing. |
| DevStudio token editor | Local imperative wrapper; dirty work closes without confirmation. |
| Roma unsaved Builder/defaults | Uses in-app `window.confirm`. |

## Current Non-Modal Semantics

- `dropdown-actions` is correctly a listbox product.
- fill, border, and shadow expose editing controls behind false listbox roles.
- dropdown edit/upload are dialog popovers.
- textedit is a dialog popover with a separate host lifecycle.
- popaddlink is nested content, not another host.

## Proven Deletions

- `object-manager.js` after behavior-driven TypeScript replacement;
- two Roma `window.confirm` calls;
- migrated local blocking-dialog backdrop wrappers/z-index branches;
- dead Bob publish/website modal CSS and unused upsell detail CSS;
- accumulating Object Manager backdrop listener.

## Boundary

No plan enforcement, billing, account, save, translation, storage, public
widget, or browser `beforeunload` behavior changes. No global modal framework or
dialog store is justified.

## Evidence Needed At Step 9

- helper lifecycle tests;
- Dieter build and manifest readback;
- Bob/Roma/DevStudio builds;
- direct browser proof for every D1 row and D3 transition;
- host-correct DevStudio authentication;
- exact-source-SHA Pages and Worker/R2 deployment evidence;
- living documentation reconciliation.
