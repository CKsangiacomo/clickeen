# 126G — Component Batch: Activity Displays

**Parent:** 126 MAMA. **Depends on:** 126A. **Components:** agent-activity, command-activity.

## Check each per the shared criteria (126 MAMA §Audit Criteria)
1. Dieter usage. 2. Clean, on-standard code.

## Batch notes
- `agent-activity` is a read-only status block (`aria-live`) showing what an agent is doing.
- `command-activity` has **no stencil** — `command-activity/command-activity.html` does not exist. Incomplete/broken component shipping under Dieter. First job: open the folder, find out what's actually there, decide build-or-delete.

## Done when
Both components pass both checks (or the broken one is resolved); DevStudio shows them (126H).

## Not in scope
Other batches. Redesign.
