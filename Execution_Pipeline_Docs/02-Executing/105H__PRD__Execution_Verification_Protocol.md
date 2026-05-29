# PRD 105H - Execution Verification Protocol

Status: Active execution protocol / verification gate
Owner: Product + Architecture
Date: 2026-05-27
Parent: `105__PRD__Instance_Folder_Tenets.md`
Depends on: `105A__PRD__DB_R2_Operation_Authority.md`, `105B__PRD__Core_DB_Model_Verification.md`, `105C__PRD__Tokyo_Runtime_Boundary_Verification.md`, `105D__PRD__Translation_Operation_State_And_Smoke_Verification.md`, `105E__PRD__Generic_Translation_Field_And_Agent_Contract_Verification.md`, `105F__PRD__Manual_Translation_Edit_And_Public_Materialization_Verification.md`, `105G__PRD__Translation_Workflow_State_And_Sync_Verification.md`

## Purpose

Define the verification discipline for PRD 105 execution.

This PRD extracts the useful execution-control doctrine from the 103 parent/status/protocol documents and resets it under the PRD 105 architecture.

The point is simple:

```text
Every slice must prove the intended product path and delete or demote legacy truth.
No slice is green because files moved, docs changed, or a local patch hid the symptom.
```

## Execution Phase Order

Use this phase order for the active 105 series:

| Phase | Docs | Role | Green Gate |
| --- | --- | --- | --- |
| 0 | `105`, `105H` | Authority lock | All execution uses PRD 105 vocabulary and names legacy concepts being deleted. |
| 1 | `105A`, `105B`, `105C` | Foundation verification | Supabase/R2/Tokyo boundaries are verified; old listing/source/widget authorities are not active truth. |
| 2 | `105D`, `105E`, `105F`, `105G` | Translation contracts | Backend operation, editable-field, manual edit, and Bob/Roma state contracts are clear before runtime refactor. |
| 3 | `105I`, `105J` | Admin/Prague boundary | `CLICKEEN` and Prague public-coordinate behavior are verified without internals. |
| 4 | `105K` | Audit/backlog reconciliation | Broad cleanup findings are closed, dropped, or promoted to focused PRDs. |
| 5A | `105L` Phase A | Product deploy/widget package cleanup | R2/product-root manifests and widget package source are clean enough for runtime refactor. |
| 5B | `105M` | Tokyo-worker runtime refactor | Old artifact names and R2 operation-controller JSON are no longer created by code. |
| 5C | `105L` Phase B | R2 stale account/runtime deletion | Stale remote objects are deleted only after 105M proves they will not be recreated. |
| 6 | `../01-Planning/105N` | Deferred paid SEO/GEO | Planning only. Not executable until default runtime/materialization and Prague proof are green. |

The `105L`/`105M` relationship is a handoff, not a simple one-way dependency:

```text
105L Phase A inventory/taxonomy -> 105M runtime refactor -> 105L Phase B remote stale-key deletion
```

Do not delete old account runtime objects from R2 before the code that recreates them has been changed and verified.

Execution reality:

```text
Implementation tickets: 105L Phase A, 105M, 105L Phase B.
Verification/checkpoint docs: 105A-H, 105I, 105J.
Audit/backlog only: 105K.
Future planning only: 105N.
```

If a contract/checkpoint document exposes required code changes, promote those changes into the focused implementation PRD that owns the blast radius. Do not turn the contract document itself into an opportunistic patch plan.

## Source Documents Reviewed

This PRD extracts from:

```text
103__PRD__Saved_Instance_Localization_Runtime.md
103__STATUS__Deterministic_Execution_Ledger.md
103Z__PRD__Sub_PRD_Verification_Protocol.md
```

Those documents become historical planning/control evidence after this extraction. They must not remain active execution authority.

## Universal Slice Requirements

Every PRD 105 execution slice must name:

- the surviving product authority;
- the surviving code/storage authority;
- the legacy concepts being deleted, isolated, or demoted;
- the exact systems in blast radius;
- the files expected to change;
- the files explicitly out of scope;
- the verification commands, scans, fixtures, or smoke proof that make the slice green.

Active callers are not proof that a concept belongs in the product. A slice must preserve the intended product path, not the current accidental topology.

## Product Path Trace

Any slice touching saved widgets, translation, publish, Prague dogfood, or public serving must trace the relevant part of this path:

```text
Roma opens one account widget.
Bob edits one active locale.
Roma saves to Tokyo.
Tokyo writes saved instance source and/or durable translated locale overlays.
San Francisco translates only Tokyo-created marker-bearing work when generation is requested.
Bob reflects Tokyo product state.
Publish/materialization emits generated browser artifacts.
Public serving reads generated artifacts only.
Prague consumes the public widget boundary only.
```

If the slice cannot explain where it fits in that path, it is not ready to execute.

## PRD 105 Authority Language

Use these terms as product-boundary language:

```text
saved instance
instance.config.json
instance.content.json
overlays/
overlays/locales/{locale}.json
assets/
index.html
styles.css
runtime.js
editable-fields.json
saved base content marker
generation request marker
translated locale overlay
Tokyo product operation
San Francisco translation agent
Bob translation panel product state
```

Do not use these as active product-boundary language:

```text
translation-generation-job.json
generated language files
{locale}.html
script.{locale}.js
translation inventory
generation lane
selected overlay pointer
job lineage as sync truth
Bob local spinner truth
FAQ-only translation path
operation-controller JSON
```

Historical documents may contain old language. Active docs and code comments must not present old language as current authority.

## Blast Radius Checklist

Each slice must explicitly say whether it touches:

- Bob;
- Roma;
- Tokyo-worker / Tokyo storage;
- San Francisco;
- `clk.live` public serving;
- Prague;
- Berlin/account context;
- Supabase migrations or policies;
- R2 instance folder shape;
- `ck-contracts`;
- `ck-policy`;
- widget packages and `editable-fields.json`;
- tests;
- documentation.

If a system is in blast radius but not tested or scanned, the slice is not green.

## Green Bar Rules

A slice is green only when:

- intended product behavior is verified;
- legacy product concepts named by the slice are deleted, isolated, or marked blocked;
- docs and code use the same authority language;
- focused tests or scans pass;
- runtime smoke is completed when the slice affects cross-service behavior;
- no new duplicate truth is introduced;
- no compatibility bridge is presented as product architecture.

Moving a document to another folder is never enough proof by itself.

## Drift Stop Conditions

Stop execution and revise the slice if implementation requires:

- preserving operation-controller JSON as active authority;
- adding a second source of truth for sync, readiness, publish, account identity, or locale state;
- special-casing FAQ, Prague, CLICKEEN, Bob preview, or any single widget as product architecture;
- making Bob infer backend operation state from local UI state or storage inventory;
- making Prague consume Tokyo/Bob/San Francisco internals;
- changing master PRD 105 tenets to accommodate accidental implementation details;
- touching systems outside the declared blast radius without updating the slice.

## Evidence Format

Keep evidence short and concrete.

Preferred proof:

- focused unit or integration tests;
- grep tripwires;
- code scan with exact paths;
- cloud-dev smoke trace;
- product screenshot;
- R2/Supabase shape verification;
- short Save -> Generate -> Review -> Publish trace where relevant.

Avoid process theatre. Do not add review artifacts that do not prove product behavior or architecture cleanup.

Required preflight before `105M` code execution:

- active docs do not teach `translation-generation-job.json`, default `{locale}.html`, `script.{locale}.js`, `script.v*`, `styles.v*`, or `translated-locale-values/` as current architecture;
- `105M` Slice 0 records the concrete Supabase operation ledger/outbox schema;
- `105M` Slice 0 records the public locale serving decision;
- `105M` Slice 0 records whether `clk.live` is served by Tokyo-worker, Venice, or another handoff in the deployed environment;
- `105M` Slice 0 records the existing translated-value migration/backfill decision.

## Archive Decision For Source Batch

After this PRD is created, the 103 parent/status/protocol batch must move to `03-Executed` as historical planning/control evidence.

Required archive status:

```text
Historical planning/control evidence.
Surviving product truth extracted to PRD 105 and 105A-105G.
Surviving execution verification protocol extracted to PRD 105H.
Superseded by PRD 105/105A/105B/105C/105D/105E/105F/105G/105H where conflicting.
```

## Non-Scope

This PRD does not implement runtime behavior. It defines execution verification discipline for the PRD 105 series.
