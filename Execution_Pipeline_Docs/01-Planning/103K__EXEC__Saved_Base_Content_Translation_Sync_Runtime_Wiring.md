# EXEC 103K - Saved Base Content Translation Sync Runtime Wiring

Status: Planning
Date Started: 2026-05-25
Parent PRD: `103K__PRD__Saved_Base_Content_Translation_Sync.md`

## Execution Intent

Delete the fragile current-generation/job-id model and wire the product around saved-base-content sync.

The implementation must not patch around the old model. It must make one invariant true:

```text
Translated values are valid only for the saved base content marker they were generated from.
```

## Required Runtime Changes

### Tokyo

- Derive a deterministic saved base content marker from current saved editable text.
- Store the marker with active generation work.
- Store or return per-locale sync state for translated locale values.
- Return the active generation for repeated Generate while the same marker is active.
- Reject or return active state when Generate is requested while any generation is active for the same instance.
- Apply completion by marker match, not by random job id alone.
- Convert marker mismatch into explicit out-of-sync/base-changed state.
- Remove previous-generation lineage from product logic.

### San Francisco

- Carry the saved base content marker in the translation job.
- Return the marker with completion/failure.
- Treat deterministic validation failures as terminal and report them to Tokyo.
- Do not own sync state and do not write translated values directly.

### Roma

- Forward Generate and generation read operations only through Tokyo.
- Do not create any second interpretation of sync state.
- Preserve the single real authoring path: Roma opens Bob, Bob edits, Roma saves to Tokyo.

### Bob

- Disable Generate while Tokyo reports active generation.
- Show the base-changed regenerate banner when Tokyo reports out-of-sync translated values.
- Remove vague preparation copy.
- Do not expose queue math as product progress.
- Preview translated locales only from Tokyo translated values.

## Delete Targets In Code

- Generation replacement on normal Generate click for same saved base content.
- previous-job lineage as product behavior.
- stale-job completion as the normal result for duplicate Generate.
- UI copy that says queued work is "preparing" without useful product truth.
- Tests that assert late valid completions are ignored just because a newer random job id exists.

## Execution Order

1. Add marker contract and tests in shared contracts/Tokyo.
2. Change Tokyo Generate to reuse active same-marker generation and block competing active generation.
3. Change Tokyo completion to apply by marker match.
4. Add locale sync read state for Bob.
5. Update Bob UX copy, banner, and button state.
6. Update San Francisco job payload and callback payload.
7. Run local tests and cloud-dev smoke.

## Verification Gate

This EXEC is green only when:

- `pnpm lint` passes.
- `pnpm typecheck` passes.
- Tokyo tests prove idempotent Generate and marker-based completion.
- San Francisco tests prove marker round trip.
- Bob tests prove disabled Generate while active and out-of-sync banner.
- Cloud-dev smoke proves translated text appears for FAQ and one non-FAQ widget after Generate.
