# PRD 103B - Instance Translation Agent Contract

Status: Complete
Owner: Product + Architecture
Date: 2026-05-17
Parent: PRD 103 - Instance Translation Agent Teardown And Rebuild
Depends on: PRD 103C.1, PRD 103C, PRD 103D.0

## Purpose

Replace loose text production with a real product agent contract:

```text
translate saved instance
```

The agent returns current language values for one saved widget instance and target locale.

This sub-PRD must not create a new job framework unless the thin FAQ vertical slice cannot run without it. Existing San Francisco translation primitives should be wrapped below the agent boundary when that is sufficient.

## Execution Contract

- Executable without drift: the request is instance/job-shaped, not endpoint-shaped text values.
- New systems are allowed only if they collapse the current endpoint/follow-up/producer split into the product agent boundary.
- End-to-end accuracy must include saved instance identity, whole changed fields, existing language values, merge, Bob review, and Publish.
- All systems must say `Instance Translation Agent`, `translate saved instance`, and `current language values`.
- Blast radius includes the Translations panel Generate trigger, San Francisco execution, grants/policy, Tokyo-worker storage, Bob review, publish generation, logs, and tests.

## Request Contract

The request includes:

```text
accountId
instanceId
widgetType
saveVersion or baseRevision
baseLocale
targetLocale
widgetContractVersion
currentSavedTextGraph
previousSavedTextGraph
changedFields
deletedFields
existingLanguageValues
policyRuntimeProfile
jobId
```

`policyRuntimeProfile` means the existing `ck-policy` runtime policy or a reference resolvable through it. It does not mean a new policy object.

The request is rejected if it is only:

```text
{ path, value, locale }[]
```

## Result Contract

The result is:

```text
current language values for accountId + instanceId + targetLocale
```

not:

```text
translated text payload
```

## Acceptance

- The operation is named `translate saved instance` or equivalent product language.
- The agent receives field identity, field intent, rich/plain text type, and surrounding FAQ context where needed.
- The agent can receive existing language values for unchanged paths.
- The agent output can be passed to `buildCurrentLanguageValues()`.
- Product logs/errors include agent ID, job ID, account ID, instance ID, target locale, policy version, provider, and model.
- Old text-value route behavior is deleted from the active API.
- No new queue, scheduler, or orchestration framework is introduced unless required to execute the single-language FAQ vertical slice correctly.

## Verification

- Fixture rejects loose text-values request.
- Fixture translates changed FAQ question while carrying unchanged answer.
- Failure fixture rejects missing changed field and unknown returned field.
- TPM signoff: this is Clickeen translating one saved FAQ instance.
- Dev Manager signoff: the agent boundary is job-shaped.
