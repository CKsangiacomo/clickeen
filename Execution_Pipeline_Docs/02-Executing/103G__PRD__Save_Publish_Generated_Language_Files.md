# PRD 103G - Save/Publish Generated Language Files

Status: Complete / Publish language files proof green
Owner: Product + Architecture
Date: 2026-05-17
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
- Blast radius includes San Francisco generation jobs, Tokyo/R2 instance files, publish route, public serving, Bob copy, tests, and docs.

## Flow

```text
saved instance version
  + current language values
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
- Published language files include the same field identities Bob review used.
- Public visitor serving remains static.

## Verification

- Post-publish verification loads the public FAQ in base locale and at least one translated locale.
- Verification starts from a saved FAQ instance with a real Tokyo overlay, not a handcrafted fixture.
- `pnpm verify:prd103-publish-language-files` is green.
- TPM signoff: the public embed fulfills the same language promise Bob shows.
- Dev Manager signoff: no runtime assembly path was reintroduced.
