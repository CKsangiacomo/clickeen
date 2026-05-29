# EXEC 103_DB.5 Translation Generation Control State

Status: Historical red evidence / surviving repair doctrine extracted to PRD 105D; superseded by PRD 105, 105A, 105B, 105C, and 105D where conflicting
Date Started: 2026-05-22
Parent PRD: `103_DB_Pivot__PRD__Operational_State_In_Supabase_Public_Artifacts_In_R2.md`
Corrective authority: `../01-Planning/103K__PRD__Saved_Base_Content_Translation_Sync.md`
Execution repair: `../01-Planning/103K__EXEC__Saved_Base_Content_Translation_Sync_Runtime_Wiring.md`

Archive note: this document is no longer active execution authority. It is retained as evidence of the red translation-generation finding. Current repair authority is `../02-Executing/105D__PRD__Translation_Operation_State_And_Smoke_Verification.md`.

## Finding

This slice is not green under the real product model.

The shipped/current slice made `instances.translation_status` useful as coarse control state, but it also encoded the wrong generation behavior: a normal Generate request can create a competing generation and make late translated output from earlier work stale by random `jobId`.

That violates the product rule:

```text
Translations are valid when they match the current saved base content.
```

The product has one Generate button. Duplicate clicks, retries, browser replays, or user retries while the UI looks stuck must not create competing current generations for the same saved base content.

## Surviving Work

Keep these parts:

- `instances.translation_status` as coarse button/liveness state: `idle`, `queued`, `running`, `failed`;
- Tokyo-owned Generate/complete/fail operations;
- San Francisco reports outcomes through Tokyo;
- Bob/Roma read state through Tokyo and do not infer correctness from local spinners;
- no DB job table and no per-locale progress table by default.

## Deleted Product Model

These are no longer approved:

- normal Generate click creates competing work for the same saved base content;
- `jobId` alone decides whether translated output may apply;
- prior active work is treated as obsolete by default;
- late completion from same saved base content is ignored as normal behavior;
- old-job lineage is product logic;
- vague active UI copy that says work is only being prepared after Tokyo already knows the operation state.

## Correct Model

PRD 103K owns the correction:

- Tokyo derives a deterministic saved base content marker from the current saved editable text, widget contract, base locale, and target locale set.
- Generate while the same marker is active returns the active generation instead of creating a new one.
- Generate while any generation is active keeps the button disabled and does not create competing work.
- San Francisco completion applies when its marker still matches the current saved base content.
- If the marker no longer matches, Tokyo records base content changed / out-of-sync state instead of pretending generation is still useful.
- Bob shows `The base content has changed. Regenerate translations.` when translations are out of sync.

## Required Repair

This DB.5 slice cannot be closed until 103K runtime wiring is implemented and verified.

Green requires:

- Tokyo tests for idempotent active Generate by saved base content marker;
- Tokyo completion tests for marker-based apply/reject;
- Bob tests for disabled Generate while active and the base-changed regenerate banner;
- San Francisco tests proving marker round trip;
- cloud-dev smoke proving translated text appears after Generate for FAQ and one non-FAQ widget.
