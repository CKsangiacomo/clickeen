# 126F — Component Batch: Composites

**Parent:** 126 MAMA. **Depends on:** 126A. **Components:** repeater, object-manager, bulk-edit, popover, tabs, popaddlink, menuactions.

## Check each per the shared criteria (126 MAMA §Audit Criteria)
1. Dieter usage. 2. Clean, on-standard code.

## Batch notes
- These are the complex, multi-part editor controls; several bind to Bob editor data (`data-bob-path` / `data-bob-json`): repeater, object-manager, bulk-edit.
- `repeater` and `object-manager` overlap (both manage arrays with add/remove/reorder). Confirm the distinction is real or flag a merge candidate (don't merge unless forced).
- `popover` is the primitive the dropdowns + popaddlink build on — confirm it's solid since others depend on it.

## Done when
All pass both checks; DevStudio shows them (126H).

## Not in scope
Other batches. Redesign.
