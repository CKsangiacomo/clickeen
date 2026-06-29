# Dialogs And Modals In Clickeen

Authority: 126K for dialog/modal behavior mechanics.
Related authority: [`126A__PRD__Accessibility.md`](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126A__PRD__Accessibility.md) for honest naming and semantic state.

This doc does not define a modal framework. It records the boundary agents must
respect while the 126 UI program executes.

## 126A Boundary

126A owns whether a surface is named truthfully:

- dialog/modal;
- popover/dropdown;
- sheet/panel;
- banner/status.

126A does not require:

- focus traps;
- return-focus behavior;
- scroll lock;
- z-index systems;
- keyboard-complete modal behavior;
- shared modal framework behavior.

Those mechanics belong to 126K and the owning component/screen PRD.

## Product Distinctions

- **Dialog/modal:** interruptive contained surface that asks the user to act
  before returning to the previous workflow.
- **Popover/dropdown:** local contextual surface attached to a trigger.
- **Sheet/panel:** larger surface that edits or inspects context without
  necessarily being modal.
- **Banner/status:** feedback surface for operation state or guidance.

Do not call a surface a modal/dialog unless the product behavior is actually
dialog-like. Do not make a non-modal popover pretend to be a modal dialog.

## Execution Rule

When dialog/modal behavior is implemented or changed, execute under 126K or the
owning component/screen PRD. 126A may require truthful semantics and naming, but
it must not be used to introduce overlay machinery.
