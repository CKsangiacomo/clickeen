# 103 Translation Workflow And Sync Batch Archive

Status: Historical planning evidence
Archived: 2026-05-27

## Archive Decision

This batch is not active execution authority.

Surviving workflow-state doctrine was extracted to:

```text
Execution_Pipeline_Docs/02-Executing/105G__PRD__Translation_Workflow_State_And_Sync_Verification.md
```

Where these files conflict with the PRD 105 reset, the active authority is:

```text
105__PRD__Instance_Folder_Tenets.md
105D__PRD__Translation_Operation_State_And_Smoke_Verification.md
105E__PRD__Generic_Translation_Field_And_Agent_Contract_Verification.md
105F__PRD__Manual_Translation_Edit_And_Public_Materialization_Verification.md
105G__PRD__Translation_Workflow_State_And_Sync_Verification.md
```

## Files Archived

```text
103K__PRD__Saved_Base_Content_Translation_Sync.md
103K__EXEC__Saved_Base_Content_Translation_Sync_Runtime_Wiring.md
103L__PRD__Translation_Workflow_Refactor.md
```

## Important Correction Preserved In 105G

The old 103K PRD included target locale set in `baseContentMarker`. That is no longer active authority.

Correct active rule:

```text
baseContentMarker = saved source content sync identity
generationRequestMarker = baseContentMarker + requested target locale set
```

Operation-controller JSON such as `translation-generation-job.json` is not active authority and must not be used as the instance-folder translation workflow model.
