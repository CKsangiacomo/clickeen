# Dialogs And Modals In Clickeen

Canonical doctrine: this document.
Execution PRD: [`126K__PRD__Dialogs_and_Modals.md`](../../../Execution_Pipeline_Docs/03-Executed/126__UI_Optimization/126K__PRD__Dialogs_and_Modals.md).
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

Dieter Popup is the shared visual and structural contract for blocking native
`<dialog>` elements. It owns the backdrop, seamless elevated surface, viewport
fit, radius, small/medium/large size, generous outer inset, section spacing,
body scrolling, and header/body/footer/action slots. It does not draw an outer
stroke or internal header/footer dividers. A visible title is optional; when
present it uses `heading-4` and names the dialog, and when absent the caller
must provide the exact alternate accessible name.

Popup also owns the optional dismiss composition: a medium quaternary Dieter
Button with the `multiply` Icon. The caller owns its accessible label and may
render it only when the workflow's existing dismissal law allows the same
action. Popup does not choose dismissal policy, invent Close copy, or persist
work. Those remain governed by the matrix below and implemented by the owning
workflow with the existing shared dialog lifecycle.

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
| Roma Bulk Upload | Disabled while an upload is active; close after terminal | Never | Close exists only after terminal state |
| Roma account tier-drop notice | Never | Never | Open settings or persisted Dismiss resolves it |
| Roma shared plan-limit/upsell Popup | Close | Close | Denied action was not applied; system-owned Upgrade scaffold or dismiss |
| Roma widget public code | Close | Close | Close; read/copy only, no work is mutated |
| DevStudio token editor | Close if unchanged; dirty opens discard confirmation | Never | Cancel follows the dirty rule; Confirm Commit persists |
| Roma unsaved Builder/defaults confirmation | Keep editing | Never | Keep editing is safe; Discard is explicit |

## Shared Upsell Popup Composition

Legitimate entitlement denials use one Roma-hosted Popup. There is no Bob
plan-limit dialog that transitions to, or stacks beneath, a second Roma upsell
dialog. Bob reports the denied capability and exact compiled Widget message
identity; Roma opens the one account surface directly.

The Popup has multiple content authorities without becoming multiply hosted:

- the Widget's compiled upsell locale artifact supplies the exact contextual
  body template for a Widget-bound denial;
- Roma/system policy supplies the current plan, target eligible plan, and denied
  system capability;
- Roma/system UI supplies the Popup title, CTA labels, dismissal labels, and
  behavior;
- Dieter supplies only the Popup structure, presentation, and lifecycle.

Roma interpolates exact system plan values into the Widget template. It never
invents Widget wording, chooses another message, or falls back to generic copy
when the bound message is missing. The Widget never supplies plan values or CTA
behavior, and Dieter never reads policy or copy artifacts.

Until billing is separately implemented, Upgrade is scaffolding: it must not
mutate a plan, call a billing provider, claim purchase success, navigate to
inactive Billing, or invent a sales/contact destination. Opening or dismissing
the Popup preserves unsaved Builder work; it must not invoke a discard
confirmation because the denied action did not mutate the draft.

Current cloud-dev implementation: Bob's local generic upsell Popup and the second
Upgrade-intent scaffold are removed. Bob sends the exact denied capability and
compiled Widget message identity; Roma directly opens the one shared
Roma/Dieter Popup described above. Cloud-dev deploy proof passes; owner QA
remains pending.

## Execution Rule

When dialog/modal behavior is implemented or changed, use the 126K or owning
component/screen execution PRD. Accessibility doctrine may require truthful semantics and naming, but
it must not be used to introduce overlay machinery. Do not add a generic modal
framework, global dialog store, or parallel compatibility path.
