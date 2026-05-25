# STATUS 103 - Deterministic Execution Ledger

Status: Red / Active Repair
Date: 2026-05-25
Parent: `103__PRD__Saved_Instance_Localization_Runtime.md`

## Current Verdict

PRD 103 is back on the right track only as documentation truth after the cleanup in progress. Runtime is not green until PRD 103K is implemented and verified.

The previous translation path made a simple product operation depend on weak handoffs:

- Bob showed progress from local/inventory signals.
- Tokyo treated current job lineage as sync authority.
- San Francisco could complete work that Tokyo rejected as old.
- The panel could poll forever while showing unclear copy.

That model is not acceptable.

## Active Product Model

The surviving product model is saved-base-content translation sync:

```text
saved base content + editable field contract -> saved base marker
saved base marker + target locale -> translation sync state
Generate -> one active operation for the current marker
San Francisco completion -> applies only when marker matches
Bob -> displays Tokyo sync and liveness state
```

Translation is not a FAQ feature. It is a generic widget feature.

## Active Authorities

| Concern | Authority |
| --- | --- |
| Parent product truth | `103__PRD__Saved_Instance_Localization_Runtime.md` |
| DB/storage architecture | `Execution_Pipeline_Docs/02-Executing/103_DB_Pivot__PRD__Operational_State_In_Supabase_Public_Artifacts_In_R2.md` |
| Generic widget translation contract | `103J__PRD__Generic_Widget_Translation_System.md` |
| Saved base sync and panel UX | `103K__PRD__Saved_Base_Content_Translation_Sync.md` |
| 103K runtime wiring | `103K__EXEC__Saved_Base_Content_Translation_Sync_Runtime_Wiring.md` |
| San Francisco agent boundary | `103B__PRD__Instance_Translation_Agent_Contract.md` |
| Translation/Copilot source projection | `103C__PRD__Shared_Content_Text_Base_For_Copilot_And_Translation.md` |
| Manual translated-locale edit | `103F__PRD__Translation_Override_UX.md` |
| Publish generated language files | `103G__PRD__Save_Publish_Generated_Language_Files.md` |

## Deleted Translation Authority

The FAQ-first and job-lineage documents were deleted from active planning because they preserved the wrong architecture:

- `103_03__PRD__Translation_Generation_Job_State.md`
- `103_03__EXEC__Translation_Generation_Job_State.md`
- `103V__PRD__FAQ_Single_Language_Vertical_Slice.md`
- `103V__EXEC__FAQ_Single_Language_Vertical_Slice.md`
- `103C1__PRD__FAQ_Widget_Gold_Standard_Contract.md`
- `103C1__EXEC__FAQ_Widget_Gold_Standard_Contract.md`
- `103D0__PRD__FAQ_Identity_Diff_Merge_And_Override_Contract.md`
- `103D0__EXEC__FAQ_Identity_Diff_Merge_And_Override_Contract.md`
- `103D__PRD__Changed_Text_Translation.md`
- `103D__EXEC__Changed_Field_Translation.md`
- `103D__EXEC__Changed_Text_Translation_BLOCKED.md`
- `103E__PRD__Translation_Panel_FAQ_Text_Review.md`
- `103E__EXEC__Translation_Panel_FAQ_Text_Review.md`
- `103C__EXEC__Shared_Content_Text_Base_For_Copilot_And_Translation.md`
- `103A__PRD__Teardown_Map_And_Agent_Boundary.md`
- `103A__EXEC__Teardown_Map_And_Agent_Boundary.md`
- `103B__EXEC__Instance_Translation_Agent_Contract.md`
- `103_00__PRD__Pre_103_Architecture_Gate.md`
- `103_00__EXEC__Pre_103_Architecture_Gate.md`
- `103_01__PRD__Widget_Source_And_Bootstrap_Script_Audit.md`
- `103_01__EXEC__Widget_Source_And_Bootstrap_Script_Audit.md`
- `103_02__PRD__Instance_Source_And_Public_Artifact_Model.md`
- `103_02__EXEC__Instance_Source_And_Public_Artifact_Model.md`

## Runtime Evidence

Cloud telemetry for the stuck FAQ instance proved the translation agent existed and ran. The failure was not "no agent".

Observed behavior:

- San Francisco recorded `agentId = widget.instance.translator`.
- Provider/model execution reached the translation path.
- Tokyo returned a non-applied completion outcome for stale work.
- Bob kept polling and showed unclear active copy.

Code evidence:

- San Francisco records `stale_completion_ignored` when Tokyo completion returns `applied: false`.
- Tokyo returns non-applied completion when the submitted job does not match the current generation.

This proves the broken authority was job lineage and panel state, not the existence of the translator.

## Required Next Execution

Execute PRD 103K without drifting into the deleted model:

1. Add the saved base content marker as Tokyo translation sync authority.
2. Make Generate idempotent for the same active marker.
3. Disable Generate while current-marker generation is active.
4. Mark locales in sync only when values exist for the current marker.
5. Show the out-of-sync banner when saved base content changes.
6. Apply San Francisco completions by marker and locale.
7. Delete UI copy and runtime branches that imply queue preparation is product progress.
8. Verify FAQ plus at least one non-FAQ widget.

## Green Bar

PRD 103 cannot be called green until:

- Bob panel states match the 103K product model.
- Tokyo sync state survives refresh and polling.
- San Francisco completions apply for the current marker.
- stale older-marker completions are ignored without trapping the current marker.
- generic widgets use the same path.
- docs and code no longer cite the deleted FAQ/job-lineage PRDs as current authority.
