# PRD 103G - Save/Publish Generated Language Files

Status: Complete / Green after 103V reproof
Owner: Product + Architecture
Date: 2026-05-20
Parent: PRD 103 - Instance Translation Agent Teardown And Rebuild
Depends on: PRD 103D, PRD 103E

## Purpose

Make generated language files a direct product outcome of Save, Translation, and Publish.

Translation that only works in Bob preview is not complete.

103V proves the real product path. This slice proves generated base and translated language files are produced from saved instance state and current language values, then served statically.

## Execution Contract

- Executable without drift: generated files come from the saved instance state plus current language values; publish serves those files.
- New readiness/status systems are not allowed.
- End-to-end accuracy must prove public static files serve base FAQ and enabled language FAQ versions.
- All systems must say `generated language files`, `current language values`, and `publish`.
- Blast radius includes Tokyo public artifact materialization, Tokyo/R2 instance files, Roma publish calls, public serving, Bob copy-code behavior, tests, and docs.

## Flow

```text
saved instance content/config
  + current translated locale values
  -> generated base file
  -> generated language files
  -> publish
  -> static public serving
```

Visitor traffic must not call Bob, Roma editor state, Berlin, or San Francisco LLMs.

## Acceptance

- Current language values can generate language files.
- Generated base and enabled-language files are produced from the saved instance and current language values.
- Publish serves generated base and language files.
- Publish serves generated files; it does not assemble translations or inspect translation internals.
- Publish does not call Bob, Roma editor state, or San Francisco LLMs.
- Missing generated files are a generation problem, not a new publish status subsystem.
- Published language files include the same translated values Bob review used.
- Public visitor serving remains static.

## Verification

- Post-publish verification loads the public FAQ in base locale and at least one translated locale.
- Verification starts from a saved FAQ instance with real Tokyo translated-locale values, not a handcrafted public-file fixture.
- `pnpm verify:prd103-publish-language-files` is green.
- `pnpm --filter @clickeen/tokyo-worker test` is green.
- `pnpm --filter @clickeen/roma test` is green.
- TPM signoff: the public embed fulfills the same language promise Bob shows.
- Dev Manager signoff: no runtime assembly path was reintroduced.

## Green Evidence

- `pnpm verify:prd103-publish-language-files` - green
- `pnpm --filter @clickeen/tokyo-worker test` - green
- `pnpm --filter @clickeen/roma test` - green
