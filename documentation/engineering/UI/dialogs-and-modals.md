# Dialogs And Modals In Clickeen

Canonical doctrine: this document.
Execution PRD: [`126K__PRD__Dialogs_and_Modals.md`](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126K__PRD__Dialogs_and_Modals.md).
Related doctrine: [`accessibility.md`](accessibility.md) for honest naming and
semantic state. Interaction doctrine: [`interactions.md`](interactions.md) for when product
behavior needs blocking, entitlement, destructive, or account-notice feedback.

This doc does not define a modal framework. It records the product distinctions,
lifecycle contract, and exact dismissal behavior agents must implement through
the 126 UI program.

## Accessibility Boundary

[`accessibility.md`](accessibility.md) owns whether a surface is named truthfully:

- dialog/modal;
- popover/dropdown;
- sheet/panel;
- banner/status.

The accessibility doctrine does not require:

- focus traps;
- return-focus behavior;
- scroll lock;
- z-index systems;
- keyboard-complete modal behavior;
- shared modal framework behavior.

Those mechanics belong to this document and the owning component/screen
execution PRD.

## Product Distinctions

- **Dialog/modal:** interruptive contained surface that asks the user to act
  before returning to the previous workflow.
- **Popover/dropdown:** local contextual surface attached to a trigger.
- **Sheet/panel:** larger surface that edits or inspects context without
  necessarily being modal.
- **Banner/status:** feedback surface for operation state or guidance.

Do not call a surface a modal/dialog unless the product behavior is actually
dialog-like. Do not make a non-modal popover pretend to be a modal dialog.

## Blocking Dialog Lifecycle

A blocking dialog provides truthful naming, initial focus, focus containment,
return focus, parent inertness, scroll control, and keyboard-complete dismissal.
Reusable Dieter code may own those mechanics. The owning product surface keeps
workflow state, copy, validation, and persistence.

Native browser `beforeunload` remains the browser-boundary guard. In-product
unsaved-work decisions use the product dialog contract; they do not use
`window.confirm`.

## Dismissal Contract

Dismissal means exactly what this matrix says. It is not inferred from whether
a dialog seems low-risk.

| Dialog/workflow | Escape | Backdrop | Explicit action and protection |
|---|---|---|---|
| Dieter Bulk Edit | Close if unchanged; dirty opens discard confirmation | Never | Cancel follows the dirty rule; Save applies edits to Bob's working state |
| Dieter Object Manager | Close if unchanged; dirty opens discard confirmation | Never | Cancel follows the dirty rule; Save applies reorder/delete to Bob's working state |
| Roma Add Instances | Close and discard temporary selection | Never | Cancel discards; Add selected persists |
| Roma Bulk Upload | Disabled while an upload is active; close after terminal | Never | Close exists only after terminal state |
| Roma account tier-drop notice | Never | Never | Open settings or persisted Dismiss resolves it |
| Roma plan-limit prompt | Close | Close | No work is lost; enforcement and Upgrade meaning are separate concerns |
| Bob plan-limit/upsell prompt | Close | Close | No work is lost; enforcement and Upgrade meaning are separate concerns |
| Roma upsell scaffold | Close | Close | No work is lost; no commercial operation has started |
| DevStudio token editor | Close if unchanged; dirty opens discard confirmation | Never | Cancel follows the dirty rule; Confirm Commit persists |
| Roma unsaved Builder/defaults confirmation | Keep editing | Never | Keep editing is safe; Discard is explicit |

## Upsell Transition

Legitimate Upgrade entry points remain during pre-GA development. When Upgrade
starts inside a plan-limit prompt, that prompt transitions to the shared upsell
dialog scaffold in the same dialog layer. Do not stack two modals.

The scaffold has real dialog semantics and a stable content region, but it does
not imply a working commercial operation. Until billing is separately
implemented, it must not mutate a plan, call a billing provider, claim purchase
success, or invent a sales/contact destination. Opening it is an in-place UI
transition that preserves unsaved Builder work; it must not invoke a discard
confirmation.

## Execution Rule

When dialog/modal behavior is implemented or changed, use the 126K or owning
component/screen execution PRD. Accessibility doctrine may require truthful semantics and naming, but
it must not be used to introduce overlay machinery. Do not add a generic modal
framework, global dialog store, or parallel compatibility path.
