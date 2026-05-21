# PRD 103A - Teardown Map And Agent Boundary

Status: Complete
Owner: Product + Architecture
Date: 2026-05-17
Parent: PRD 103 - Instance Translation Agent Teardown And Rebuild

## Purpose

Map the current Save -> Translation -> Bob review -> Publish path and declare the surviving product boundary:

```text
translate saved instance
```

This sub-PRD prevents PRD 103 from starting with file movement, route renames, or adapter layers while the old authority split survives.

## Execution Contract

- Executable without drift: every active route, function, type, storage object, and UI consumer in the language path must be classified before implementation begins.
- New systems are allowed only when they simplify the product path or merge disjoint existing systems.
- End-to-end accuracy must cover Save, Translation Agent, language values, Bob review, and Publish.
- All systems must use the same language: `saved instance`, `Instance Translation Agent`, `current language values`, `publish language files`.
- Blast radius must include Roma, Bob, San Francisco, Tokyo-worker, `ck-policy`, FAQ widget config, public publish, tests, and docs.

## Scope

Map and classify:

- Roma save route and follow-up translation trigger.
- San Francisco translation routes, Copilot execution route, provider/model routing, grants, telemetry.
- Tokyo-worker overlay/language value storage and selected-overlay behavior.
- Bob Translations panel and preview application.
- Static language file generation and publish serving.
- FAQ widget declarations: editor controls, `overlays.text[]`, `agent.md`, runtime state.

## Required Teardown Map

Each item must be marked:

```text
keep
internal primitive
rename
replace
delete
blocked
```

Every `keep` must name the surviving authority it serves.

## Non-Negotiables

- Old text-value routes are not the product boundary.
- `runBabelTextFollowupAfterSave` is not the product boundary.
- `overlays.text[]` is not the product text authority.
- `agent.md` is not the product schema authority.
- "selected overlay pointer" is not allowed to describe current language values unless a real durable pointer exists.

## Acceptance

- A teardown map exists for all active Save -> Translation -> Bob -> Publish code paths.
- The map identifies exactly one surviving product operation: `translate saved instance`.
- Every duplicate text authority has a delete/derive/internal decision.
- Every legacy name has a delete/rename/internal decision.
- The first implementation slice is blocked if any active path still discovers FAQ text from a second authority.

## Verification

- TPM signoff: the mapped path preserves the user story from one FAQ edit to published language files.
- Dev Manager signoff: every surviving code path has one authority and no compatibility bridge pretending to be product architecture.
