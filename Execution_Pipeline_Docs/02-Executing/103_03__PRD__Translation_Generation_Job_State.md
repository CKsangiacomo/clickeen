# PRD 103_03 - Translation Generation Job State

Status: Automated Green / Human Smoke Pending
Owner: Product + Architecture
Date: 2026-05-20
Parent: `103_00__PRD__Pre_103_Architecture_Gate.md`

## Purpose

Close the architectural gap exposed by human smoke on the FAQ instance `UZ3JEJSHII`.

The Translations panel showed `Generating translations...` while Tokyo received only repeated translated-locale inventory reads and no Generate product command. The UI local spinner was not tied to a Tokyo-owned generation job. Bob was polling translated-locale readiness and treating it like job state.

That is not acceptable SaaS behavior.

This PRD makes translation generation a first-class product operation with a named owner, visible job state, terminal outcomes, and deterministic recovery. The automated implementation is green; deployed Roma/Bob human smoke remains pending before release signoff.

## Product Truth

Translation generation is an explicit Translations-panel command.

The product command is:

```text
Generate translations for this account-owned instance from the current saved base content.
```

The product must behave like one system:

1. Bob sends the user's Generate intent to Roma.
2. Roma authenticates the account/user and forwards one product command.
3. Tokyo owns the generation job.
4. Tokyo computes the delta from `instance.content.json`, the widget `editable-fields.json` contract, current translated locale values, and account target locales.
5. Tokyo queues per-locale work for San Francisco.
6. San Francisco translates concrete text fields and reports every terminal outcome back to Tokyo.
7. Tokyo updates translated locale values and job state.
8. Bob reads Tokyo job state and translated locale readiness.

Bob must never infer generation status from a local spinner or from translated locale inventory alone.

Roma must not build translation jobs.

San Francisco must not be the source of product job truth.

## Live Failure This PRD Fixes

On 2026-05-20 human smoke found:

- `instance.content.json` had 12 editable fields.
- One field was changed: `sections.0.faqs.0.question`.
- Tokyo had 14 complete translated locales.
- The other 14 locales were missing only that changed question translation.
- Several missing locales had invalid partial state: `localeStatus: ok` without a translated string value.
- Clicking Generate put Bob in a generating state.
- Tokyo tail showed repeated `GET /__internal/instances/UZ3JEJSHII/translations`.
- Tokyo did not receive `POST /__internal/instances/UZ3JEJSHII/translations/generate`.
- San Francisco did not receive queue work or emit translation completion events.

The deterministic root problem is not the LLM. No new translation job was running from that click.

The architectural root problem is that Bob can claim "generating" without a Tokyo-owned generation job.

## In Scope

- Define the Tokyo-owned translation generation job product model.
- Define Generate command semantics when no job exists, when a matching job is already active, and when a newer Generate supersedes older work.
- Define server-side duplicate/rage-click protection.
- Define Bob/Roma/Tokyo/San Francisco contracts for accepted, running, completed, failed, stale, and superseded outcomes.
- Define cleanup for impossible translated-locale states such as `ok` without a string value.
- Define verification proving the FAQ `14/28` changed-field case can deterministically reach `28/28` or a visible failed state.
- Update docs and tests so inventory readiness and job state cannot be confused again.

## Out Of Scope

- Save-triggered translation generation. Save persists base content only.
- Manual translation override persistence or protection state. Manual edits are temporary translated-locale value overwrites and may be replaced by regeneration.
- Generic workflow framework work not required for translation generation.
- Source-version, generation-lane, overlay-ID, selected-pointer, or storage-path product vocabulary.
- Broad publish readiness redesign beyond preventing translation job state from being confused with public artifacts.

## Final Product Model

### Generation Job

Tokyo owns one current translation generation job per account instance.

The job is product state, not Bob state and not San Francisco telemetry.

Minimum job summary exposed to Bob/Roma:

```text
instanceId
baseLocale
targetLocales
status: idle | queued | running | completed | failed | superseded
requestedAt
updatedAt
totalLocales
completedLocales
failedLocales
supersededLocales
pendingLocales
currentReadyLocales
message/reason for terminal failure when applicable
```

Implementation primitive locked in slice `103_03.1`:

```text
accounts/{accountPublicId}/instances/{instanceId}/translation-generation-job.json
```

This is a private Tokyo R2 implementation detail behind product operations. Bob, Roma, and San Francisco must not read or write that object directly. They only use:

- `generateTranslations(instanceId)`;
- `readTranslationGeneration(instanceId)`;
- `completeTranslationLocale(job, locale, values)`;
- `failTranslationLocale(job, locale, reason)`.

This primitive may not be hidden in `instance.content.json`, `instance.config.json`, `instance.json`, overlay objects, generated files, or Bob local state. It is also not `language-generation.json`, `sourceVersion`, `languageSource`, overlay inventory, or a generated public artifact.

### Delta

Tokyo computes delta only from product truth:

- current saved `instance.content.json`;
- widget `editable-fields.json`;
- account target locales;
- current translated locale values by locale;
- content field `ok` / `changed` pickup status.

Tokyo must treat a locale value as ready only when every required translated field has a string value. `localeStatus: ok` without a string value is invalid and must be treated as not ready.

### Job Basis

Each queued locale job carries the exact content paths and base text values it is translating.

Tokyo accepts a completion only if the current saved content for those paths still matches the text the job translated. If the user has edited and saved newer base text, Tokyo marks the old completion stale/superseded and does not apply it.

This is not `sourceVersion`. It is direct comparison of the concrete text values being translated.

### Repeated Generate

Generate must be deterministic:

- If there is no active job, Tokyo creates a job from the current saved content and target locales.
- If the same current delta already has an active job, Tokyo returns the existing job summary and does not enqueue duplicate locale jobs.
- If base content changed or missing locales changed while an older job is active, Tokyo supersedes the older job and creates a new job from the latest saved content.
- Old queued/worker completions may still arrive. Tokyo rejects them as superseded/stale and records the terminal outcome on the old job.

### Rage-Click Protection

Rate limiting and duplicate suppression are server-side.

Bob disabling a button is UX only. It is not a correctness mechanism.

Tokyo must prevent one browser session from enqueueing duplicate work for the same instance/content/target set. Account-level and instance-level Generate limits must be enforced through product policy or a named Tokyo-owned technical guard before implementation closes.

### San Francisco Terminal Outcomes

San Francisco must report every terminal locale outcome back to Tokyo:

- completed;
- stale/superseded;
- provider/model failed;
- validation failed;
- retry exhausted;
- job rejected as invalid.

Console logs and San Francisco telemetry are not product state.

If San Francisco cannot translate a locale, Tokyo must know and Bob must be able to show the failed locale instead of spinning forever.

### Bob UX

Bob must show generation state from Tokyo.

Allowed UX states:

- Generate translations;
- Queued;
- Generating `X/Y`;
- Completed `Y/Y`;
- Failed with failed locales and retry/regenerate action;
- Superseded/restarted when a newer Generate takes over.

Bob may still show translated-locale readiness, but readiness is not generation job state.

The Translations panel must never enter an indefinite local generating state unless Tokyo has accepted or returned an active generation job.

## Product Operations

Required operations:

| Operation | Owner | Purpose |
| --- | --- | --- |
| `generateTranslations(instanceId)` | Tokyo, called through Roma | Create, resume, or supersede the current generation job from saved content. |
| `readTranslationGeneration(instanceId)` | Tokyo, called through Roma/Bob | Return current generation job state and progress. |
| `completeTranslationLocale(job, locale, values)` | Tokyo, called by San Francisco | Apply translated values only if the job basis still matches current saved content. |
| `failTranslationLocale(job, locale, reason)` | Tokyo, called by San Francisco | Record terminal failed/stale/retry-exhausted outcome. |
| `listTranslatedLocales(instanceId)` | Tokyo | Return readiness inventory only; not job truth unless explicitly bundled with generation summary. |
| `readTranslatedLocaleValues(instanceId, locale)` | Tokyo | Return exact current translated value map. |

Roma remains the account/session boundary. It does not inspect storage, compute delta, own job status, or retry translation work.

## Data Cleanup Requirement

Before this PRD closes, Tokyo must repair or reject impossible translated-locale content states created by older code:

```text
localeStatus[locale] = ok
translatedValues[locale] is missing or not a string
```

Allowed behavior:

- Generate treats that field/locale as missing and queues it.
- Completion writes translated value and status atomically.
- A repair-only operator command may normalize existing invalid states.

Not allowed:

- Bob hides the locale while claiming generation is running.
- Tokyo leaves `ok` without value as a ready state.
- Product runtime silently invents translated text or marks the field done.

## Verification

This PRD cannot close without all of the following:

1. Unit proof: Bob does not enter generating state unless Generate returns an accepted/existing Tokyo job.
2. Unit proof: Tokyo Generate creates one job for the FAQ `14/28` case and queues exactly the 14 missing changed-question locales.
3. Unit proof: repeated Generate for the same unresolved delta does not enqueue duplicate jobs.
4. Unit proof: Generate after a newer saved base text supersedes older work and queues from the latest content.
5. Unit proof: San Francisco terminal failures are reported to Tokyo and visible in job state.
6. Unit proof: `localeStatus: ok` without a translated string is treated as missing, not ready.
7. Integration proof: one changed FAQ question moves from `14/28` to `28/28` or visible failed locales, with job state observable throughout.
8. Human smoke: click Generate in Roma/Bob and confirm Tokyo receives the Generate product command, San Francisco receives/finishes work or reports failure, Bob leaves the generating state deterministically.

## Acceptance Criteria

- Bob cannot display "Generating translations..." from local state alone.
- Tokyo owns generation job state and exposes it through product operations.
- San Francisco cannot permanently fail a translation job without reporting the terminal outcome to Tokyo.
- Repeated Generate clicks do not create duplicate queue storms.
- Newer Generate work supersedes older in-flight work deterministically.
- Invalid partial translated-locale state is handled as missing or repaired.
- The FAQ smoke case no longer gets stuck at `14/28` without a product-visible reason.

## Do Not Implement

- Do not reintroduce Save-triggered translation generation.
- Do not add `sourceVersion`.
- Do not add `language-generation.json`.
- Do not add `languageSource`.
- Do not add overlay IDs, selected overlay pointers, generation lanes, or public artifact file presence as job state.
- Do not use Bob local state as the source of job truth.
- Do not use San Francisco telemetry tables as product job truth.
- Do not fix this by only extending the polling timeout.
