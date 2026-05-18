# PRD 103D Execution - Changed Field Translation

Status: Resolved
Attempted: 2026-05-17
Parent: PRD 103 - Instance Translation Agent Teardown And Rebuild
Depends on: PRD 103B, PRD 103D.0

## Blocker

103D cannot be executed safely yet.

The current Roma save follow-up has the new Instance Translation Agent boundary and the FAQ merge primitive, but it does not have the two production inputs required to translate whole changed fields and then build complete current language values without drift:

- previous saved FAQ config/field graph before the save
- current language values for the target locale before writing

Without those inputs, implementing 103D would either:

- keep retranslating the full graph, which violates 103D, or
- write partial agent output, which risks overwriting the last good language set, or
- invent a local fallback merge in Roma, which would create a second merge authority.

## Required Pre-Slice Fix

Before 103D implementation can resume:

1. Tokyo save must return the previous saved config or previous saved field graph to Roma as part of the save transition.
2. Roma must read the current language values for the locale before writing new values.
3. The save follow-up must pass previous graph, current graph, previous language values, whole changed fields, deleted fields, and agent output into `buildCurrentLanguageValues()`.
4. The clear-before-translate behavior must be removed from the changed-text path, because partial agent failure must leave the last good language values untouched.

No word-level diffing is required or allowed. A changed answer means translate the whole answer field; a changed question means translate the whole question field.

## Work Completed Before Block

- 103B completed the job-shaped Instance Translation Agent boundary.
- 103D.0 completed the FAQ identity/diff/merge primitive and tests.
- No 103D production write path was changed, because doing so without the required inputs would preserve the toxic flow.

## Verification State

Resolved by `103D__EXEC__Changed_Field_Translation.md`.
