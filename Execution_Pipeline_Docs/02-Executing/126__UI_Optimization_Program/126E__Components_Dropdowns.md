# 126E — Component Batch: Dropdowns

**Parent:** 126 MAMA. **Depends on:** 126A. **Components:** dropdown-actions, dropdown-border, dropdown-edit, dropdown-fill, dropdown-shadow, dropdown-upload.

## Check each per the shared criteria (126 MAMA §Audit Criteria)
1. Dieter usage. 2. Clean, on-standard code.

## Batch notes
- A family of 6 popover-based pickers — confirm they share one popover host + behavior, and differ only by content.
- `dropdown-border` already flagged: hardcoded hex swatches inline in the stencil, plus an inline `style="…"` and an inline `oninput="…"` handler. Tokenize / move to CSS.
- Open each of the other five before claiming they're clean — only `dropdown-border` has been read so far.

## Done when
All 6 pass both checks; DevStudio shows them (126H).

## Not in scope
Other batches. Redesign.
