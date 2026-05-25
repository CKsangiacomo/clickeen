# PRD 103B Execution - Instance Translation Agent Contract

Status: Green
Executed: 2026-05-17
Parent: PRD 103 - Instance Translation Agent Teardown And Rebuild
Depends on: PRD 103C.1, PRD 103C, PRD 103D.0

## 103J Course-Correction Note

This execution remains evidence for a job-shaped San Francisco boundary, but its Roma save-follow-up and FAQ saved-text graph wording is historical. Current product translation authority is `103J__PRD__Generic_Widget_Translation_System.md`: Bob initiates Generate from the Builder translations panel, Roma forwards to Tokyo, Tokyo owns generation state and queue production, and San Francisco receives widget-generic saved text fields.

## What Changed

Added a job-shaped San Francisco Instance Translation Agent route:

```text
POST /v1/agents/instance-translation/translate-saved-instance
```

At this historical execution point, Roma called this route from the save follow-up as the translation boundary. 103J supersedes that active path with panel-owned Generate and Tokyo-owned generation state.

The new request requires:

- `operation: translate_saved_instance`
- `accountId`
- `instanceId`
- `widgetType`
- `baseLocale`
- `targetLocale`
- `jobId`
- `currentSavedTextGraph`

`baseLocale` comes from account `localePolicy`. `targetLocale` is one locale from account `selectedTargetLocales`; the worker does not derive translation scope from instance files.

Loose `{ path, value, locale }[]` text-value requests are rejected by the new agent boundary.

The old text-value handler has been removed from the active San Francisco API by 103I.

## Result Shape

The new agent returns:

```text
currentLanguageValues
```

for one saved instance and one target locale, with the agent operation, job ID, account ID, instance ID, widget type, and target locale on the response envelope.

## Files Changed

- `sanfrancisco/src/l10n-account-routes.ts`
- `sanfrancisco/src/l10n-account-routes.test.ts`
- `sanfrancisco/src/index.ts`
- `roma/lib/babel-text-producer.ts`

## Verification

- `pnpm --filter @clickeen/sanfrancisco test`
- `pnpm --filter @clickeen/sanfrancisco typecheck`
- `pnpm --filter @clickeen/roma typecheck`
- `pnpm --filter @clickeen/ck-contracts typecheck`

Fixtures cover:

- rejecting loose text-values requests at the Instance Translation Agent boundary
- returning current language values for one saved FAQ instance
- preserving existing direct-value behavior under the internal implementation

TPM signoff: Green. This is now Clickeen translating one saved FAQ instance, not a loose text API pretending to be a product agent.

Dev Manager signoff: Green. The boundary is job-shaped and no queue/scheduler/orchestration framework was introduced.
