# PRD 100B - San Francisco Agent Contract

Status: Executing  
Owner: Product + Architecture  
Date: 2026-05-16  
Parent: PRD 100 - Core Instance Mini-Sites And Static Embed Delivery

## Purpose

Define the production contract for San Francisco-managed translation and embed generation jobs required by PRD 100.

PRD 100 makes each account-owned widget instance a generated mini-site. That only works if Save-time agents are reliable production infrastructure, not loose scripts, UI helpers, or best-effort follow-up calls.

This PRD names the surviving authority:

- Tokyo/Roma save writes the saved source package to `instance.json`.
- San Francisco owns production agent execution for translation and embed generation.
- Translation output is stored only as overlay value maps under `overlays/`.
- Embed output is stored only as generated browser files in the same account instance folder.
- Agent readiness/status for Roma Widgets is recorded in `instance.json`.

## Scope

In scope:

- Define queueable, retryable, observable job contracts for the translation agent and embed agent.
- Define the minimum status model stored in `instance.json`.
- Define stale-job guards tied to a saved `instance.json` version.
- Define the input/output boundary for `instance.json`, `overlays/`, widget software/contracts, and generated browser files.
- Define acceptance criteria and validation for PRD 100 agent hardening.

Out of scope:

- Full San Francisco platform rebuild.
- Generic artifact framework beyond account widget instances.
- New account asset storage model.
- New top-level instance JSON files.
- Public serving implementation for `clk.live`.
- Widget-specific generated file implementation details beyond the required contract.

## Current State / Drift

Current docs and runtime describe San Francisco primarily as an AI execution service with a shipped Copilot path and an account-widget translation path that returns structured text values. The active documented translation path says Roma orchestrates and Tokyo-worker writes overlay objects.

That is not sufficient for PRD 100.

PRD 100 requires San Francisco-managed production jobs for:

- translating saved instance content into overlay value maps
- generating static browser files for the instance mini-site
- reporting durable job/readiness state back into `instance.json`

Known drift to remove or contain:

- Translation is currently described as value production only, not a durable production job writing `overlays/`.
- There is no production embed agent contract for writing `index.html`, `styles.css`, `script.js`, and related browser files.
- Existing save follow-up behavior is not guaranteed queueable, retryable, observable, or stale-save safe.
- Any route or helper that treats translation/embed generation as synchronous UI work is incompatible with PRD 100.

## Target State

On every successful Builder Save:

1. Roma/Tokyo persists the new saved source package in `instance.json`.
2. The saved package receives a new monotonic saved version or immutable save revision identifier.
3. San Francisco enqueues translation jobs for enabled target locales that require overlays.
4. San Francisco enqueues an embed job for the saved version.
5. Agents update only their status fields in `instance.json` and their owned output files.
6. Roma Widgets reads `instance.json` to show generation state.

The instance folder remains:

```text
accounts/{accountPublicId}/instances/{instanceId}/
  instance.json
  overlays/
  index.html
  styles.css
  script.js
  ...
```

There are no sibling `config.json`, `publish.json`, `embed.json`, `translations.json`, job JSON ledgers, or agent-owned top-level state documents.

## Job Contracts

### Shared Job Envelope

Every translation and embed job must carry:

- `jobId`: unique San Francisco job id
- `jobType`: `widget.translation` or `widget.embed`
- `accountPublicId`
- `instanceId`
- `sourceVersion`: exact `instance.json` version the job is allowed to describe
- `attempt`
- `queuedAt`
- `traceId`
- `agentId`

The job may also carry implementation routing metadata such as priority or retry delay, but product truth must remain in `instance.json` and instance folder outputs.

### Translation Job

The translation agent reads:

- `instance.json` for identity, `widgetType`, saved config, base locale, enabled target locales, and saved version
- widget text primitive contract from product widget software/contracts

The translation agent writes:

- exact locale overlay value maps under `overlays/{locale}.json`
- translation status in `instance.json`

The translation agent must not:

- create `translations/`
- create per-locale top-level JSON
- write unrelated instance fields
- invent overlay paths outside the widget primitive graph
- infer a different folder shape from widget type or locale
- mark a newer save ready from an older job

Minimum output rule:

- For each target locale, output must contain exactly the concrete text primitive path set required for that saved config, no more and no fewer, unless the job fails explicitly.

### Embed Job

The embed agent reads:

- `instance.json`
- required files under `overlays/`
- widget software/contracts from `product/widgets/{widgetType}/`
- approved account asset references already present in `instance.json`

The embed agent writes:

```text
index.html
styles.css
script.js
other explicitly required generated browser files
```

The embed agent writes browser files into:

```text
accounts/{accountPublicId}/instances/{instanceId}/
```

The embed agent must not:

- create a second public namespace
- copy account assets into the instance folder
- mint asset IDs or public asset URLs
- call Venice/Roma/Bob/Tokyo config endpoints from generated public code on normal visitor views
- expose `instance.json` or `overlays/` to public serving
- write status for a saved version it did not build

Write order:

1. Write support files first.
2. Validate output references.
3. Write or atomically rename `index.html` last.

This prevents public visitors from receiving new HTML that points at missing support files.

## Status Model

`instance.json` must include agent status fields sufficient for Roma Widgets to display generation state without reading queues, logs, or generated files.

Minimum status values:

```text
not_generated
queued
building
ready
stale
failed
unavailable
```

Minimum status transitions:

```text
not_generated -> queued -> building -> ready
queued/building -> failed
ready -> stale
ready/stale/failed -> queued
any publicly available state -> unavailable
```

`instance.json` must distinguish:

- saved source version
- latest queued translation version
- latest successful translation version by locale
- latest queued embed version
- latest successful embed version
- widget software version used by the last successful embed build
- last failure summary for Roma Widgets

Failure summaries must be explicit and bounded. They should identify the failed phase, locale when relevant, job id, source version, and retry state. They must not store provider prompts, secrets, or large logs in `instance.json`.

## Race Guards

All status writes must be conditional on the source version they describe.

Required guards:

- A job may mark `building`, `failed`, or `ready` only if `instance.json.sourceVersion` still equals the job `sourceVersion`.
- A translation job may write only the locale overlay files required by `instance.json` for that source version.
- An embed job may mark ready only after all required overlay-dependent outputs for its build shape are present for the same source version.
- A stale job result must be recorded in logs/observability, not normalized into current instance readiness.
- Retry attempts must preserve the same `sourceVersion`; a retry must not silently upgrade itself to a newer save.
- A new save marks previous ready output stale when the saved source version changes, while old public output may continue serving until new output is fully written.

If the conditional status write fails because a newer save exists, the job exits as stale success for operations, not as instance readiness.

## Out Of Scope

- Reworking San Francisco grants, policy, provider routing, or learning loops beyond what the two production agents need.
- Adding a durable cross-product job database as a new product truth.
- Supporting multiple simultaneous widget instances inside one Builder save.
- Translation memory, human review, glossary management, or localization QA workflows.
- Full SEO/GEO generation beyond honoring `embedBuildShape`.
- Runtime public rendering, runtime overlay application, or Venice request-time composition.

## Acceptance Criteria

- Save can enqueue translation and embed jobs without blocking Bob editing.
- Translation jobs are queueable, retryable, observable, and tied to one saved `instance.json` version.
- Embed jobs are queueable, retryable, observable, and tied to one saved `instance.json` version plus the overlay state used.
- Translation writes overlays only under `overlays/`.
- Embed writes generated browser files only inside the same account instance folder.
- Roma Widgets can render status using only `instance.json`.
- Failed jobs never mark incomplete output as ready.
- Older jobs cannot mark newer saves ready.
- Agent outputs do not create extra top-level JSON truth.
- Generated public code does not call Clickeen internal product/config endpoints on normal visitor views.
- Widget software version used by the last successful embed build is recorded in `instance.json`.

## Implementation Notes

- Prefer Cloudflare Queues or the existing San Francisco queue substrate for job delivery.
- Job status updates should use compare-and-set or equivalent version-checked writes to `instance.json`.
- Observability should include `jobId`, `traceId`, `accountPublicId`, `instanceId`, `sourceVersion`, `jobType`, attempt, duration, provider/model when AI is used, and terminal result.
- Large logs and raw provider payloads belong in San Francisco observability storage, not `instance.json`.
- The embed agent should treat widget software/contracts as product-owned read inputs and account assets as already accepted account-owned references.
- Status field names should be finalized with the PRD 100 `instance.json` schema slice, but semantics in this document are required.

## Risks / Guards

- Risk: synchronous save waits on translation/build work.  
  Guard: Save persists source and enqueues jobs; generation readiness is separate.

- Risk: stale jobs overwrite newer saves.  
  Guard: all writes are saved-version conditional.

- Risk: agents invent folders or sidecar JSON.  
  Guard: contract tests fail any output outside `overlays/` or generated browser files.

- Risk: embed generation becomes asset management.  
  Guard: embed agent consumes approved asset references only and never writes account asset files.

- Risk: PRD 100 expands into a San Francisco rebuild.  
  Guard: implement only the two production job runners, shared envelope, retries, status writes, and observability required here.

## Validation / Tests

Required tests:

- Unit tests for job envelope validation.
- Unit tests for allowed status transitions.
- Unit tests for saved-version conditional status writes.
- Translation contract test: given `instance.json` and widget primitive graph, output overlay contains exact concrete path set.
- Embed contract test: given `instance.json`, overlays, and widget software, output contains browser files and no forbidden JSON sidecars.
- Race test: job for version `N` cannot mark ready after version `N+1` save.
- Retry test: retry preserves saved version and attempt history.
- Failure test: translation or embed failure records `failed` without deleting previous public output.
- Static output test: generated public code does not call Roma, Bob, Venice render/config routes, internal Tokyo config endpoints, or San Francisco.

Manual validation:

1. Save an instance with one target locale.
2. Confirm `instance.json` shows queued/building states.
3. Confirm translation writes `overlays/{locale}.json`.
4. Confirm embed writes `index.html`, `styles.css`, and `script.js`.
5. Confirm Roma Widgets shows ready from `instance.json`.
6. Save again while the first jobs are still running.
7. Confirm the first jobs cannot mark the second save ready.

## Rollout / Cutover

1. Add status fields and saved-version guard semantics in the `instance.json` schema slice.
2. Add San Francisco job envelope validation and queue consumers for translation and embed jobs.
3. Wire Save to enqueue jobs after `instance.json` is durably written.
4. Keep old public output serving while new jobs run.
5. Enable Roma Widgets status display from `instance.json`.
6. Cut translation overlay production to the San Francisco production job path.
7. Cut embed generation to the San Francisco production job path.
8. Remove or block old best-effort translation/build helpers that bypass queue, retry, observability, or saved-version guards.

Cutover is complete when PRD 100 Save-time generation works through San Francisco-managed jobs and no active product path relies on UI-side helpers, loose scripts, or request-time public composition to produce widget output.
