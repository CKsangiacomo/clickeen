# 126C — Component Batch: Inputs

**Parent:** 126 MAMA. **Depends on:** 126A. **Components:** textfield, valuefield, textedit, textrename, toggle, slider.

## Check each per the shared criteria (126 MAMA §Audit Criteria)
1. Dieter usage. 2. Clean, on-standard code.

## Batch notes
- `textrename` is dead — hydrated by `admin/src/main.ts:23,258` but no `.diet-textrename` markup exists. Removing it cleanly means also deleting those two lines (the old PRD missed them). Decide: delete, or wire a real consumer.
- `valuefield` is the numeric sibling of `textfield` — confirm they share sizing/label conventions.

## Done when
Every component here passes both checks; DevStudio shows them (126H).

## Not in scope
Other batches. Redesign.
