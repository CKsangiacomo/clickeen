# PRD 103I - San Francisco Instance Translation Runtime Cleanup

Status: Historical evidence / surviving doctrine extracted to PRD 105E; superseded by PRD 105, 105D, and 105E where conflicting
Owner: Product + Architecture
Date: 2026-05-25
Parent: `103__PRD__Saved_Instance_Localization_Runtime.md`
Depends on: PRD 103B, PRD 103J, PRD 103K

Archive note: this document is no longer active execution authority. Current San Francisco translation worker boundary is PRD 105E plus PRD 105D for operation state.

## Purpose

Keep San Francisco boring: it is the translator worker, not translation state authority.

San Francisco receives Tokyo-produced widget-generic translation jobs, calls the approved AI provider through shared policy routing, validates returned primitive paths, and reports terminal locale outcomes back to Tokyo.

## Product Boundary

- Bob starts Generate from the Translations panel.
- Roma forwards the account command to Tokyo.
- Tokyo owns saved base content marker calculation, generation liveness, target locale selection, queue production, translated value storage, and sync state.
- San Francisco owns only AI text production for the fields in the job.
- San Francisco must not decide whether a locale is in sync.
- San Francisco must not write public artifacts.
- San Francisco must not resurrect FAQ-specific payloads or save-follow-up translation.

## Job Contract

Each job must carry:

- account and instance identity;
- widget type;
- base locale;
- target locale;
- saved base content marker;
- concrete editable field paths from `editable-fields.json`;
- base text values for exactly those paths;
- current translated values needed for merge context;
- signed policy/runtime budget.

San Francisco returns exactly the requested changed/missing paths and their translated strings. It may include telemetry and diagnostics, but Tokyo alone decides whether the completion applies.

## Validation Rules

- Missing requested path: fail the locale.
- Extra undeclared path: fail the locale.
- Provider empty output: fail the locale.
- Marker mismatch response from Tokyo: record stale old work, but do not retry forever.
- Provider retry is limited to the shared AI runtime policy. San Francisco must not silently switch providers or models.

## Deleted Runtime Shapes

- old text-value route as a product path;
- FAQ-only translation payloads;
- Roma save-follow-up as translation trigger;
- San Francisco-written language files;
- San Francisco-owned readiness or generation state;
- provider/model hardcoding outside the policy router.

## Acceptance

- Queue consumer handles widget-generic jobs for any widget with editable fields.
- San Francisco reports complete/fail through Tokyo for each locale.
- Telemetry records agent ID, provider, model, policy profile, and outcome.
- Completion cannot create product sync state outside Tokyo.
- FAQ plus at least one non-FAQ widget use the same San Francisco path.
