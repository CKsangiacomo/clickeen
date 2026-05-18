# PRD 103C - Agent Source Projections

Status: Restart / Not done
Owner: Product + Architecture
Date: 2026-05-17
Parent: PRD 103 - Instance Translation Agent Teardown And Rebuild
Depends on: PRD 103C.0, PRD 103C.1

## Purpose

Make Bob Copilot and the Instance Translation Agent consume the right projections from the same widget folder.

Translation localizes saved customer-visible text after Save. Copilot is a widget specialist that can change content, behavior, appearance, and valid config based on the user's request.

## Execution Contract

- Executable without drift: Translation may only use authored `content.json`; Copilot may use the whole widget package.
- New systems are allowed only if they expose the authored widget source cleanly or remove duplicate discovery code.
- End-to-end accuracy must prove Translation uses the content JSON projection and Copilot receives enough widget-package context to make valid edits.
- Translation systems must use content field identity, role, type, and label.
- Blast radius includes widget source files, `sanfrancisco/src/agents/csPromptPayload.ts`, Bob Copilot input shape, compiled controls, translation extraction, FAQ content fixtures, and validation.

## Target Flow

```text
FAQ content.json
  -> saved text graph
  -> Instance Translation Agent
  -> current language values

FAQ widget package
  -> Copilot prompt/context
  -> valid widget ops/config changes
```

Compiled controls can render and apply edits. They cannot decide translation text independently.

## Current State

Translation has started moving to authored `content.json`. Copilot is not product-green while it receives only compiled controls and prompt heuristics instead of the whole widget package.

## Acceptance

- Translation receives declared text paths, labels, roles, types, and current saved values from `content.json`.
- Copilot receives a widget package view, not only a content fields list.
- Copilot no longer decides FAQ content fields with regexes over path/label/group label.
- Copilot can reason about content, behavior, appearance, limits, and runtime behavior from the widget package.
- A behavior/style field can be available to Copilot without being sent to Translation.
- `overlays.text[]` is not used as an authored source contract.
- Any fallback to compiled-control text discovery fails tests.

## Verification

- Fixture: Translation receives only FAQ `content.json` fields.
- Fixture: a non-text styling or behavior control can be visible to Copilot but is not sent to Translation.
- TPM signoff: Translation and Copilot feel like two Clickeen agents working from the same widget folder with different jobs.
- Dev Manager signoff: there is no second authored translation-text authority.
