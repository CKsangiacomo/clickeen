# PRD 103G - Save/Publish Generated Language Files

Status: Historical green evidence / surviving doctrine extracted to PRD 105F; superseded by PRD 105, 105C, 105D, 105E, and 105F where conflicting
Owner: Product + Architecture
Date: 2026-05-20
Parent: `103__PRD__Saved_Instance_Localization_Runtime.md`
Depends on: PRD 103J, PRD 103K

Archive note: this document is no longer active execution authority. PRD 105 supersedes this document where "generated language files" implies default per-locale HTML/JS artifacts.

## Purpose

Make generated language files a direct product outcome of Save, Translation, and Publish.

Translation that only works in Bob preview is not complete.

PRD 103K proves whether translated values match the current saved base content. This slice proves generated base and translated language files are produced from saved instance state and in-sync translated language values, then served statically.

## Execution Contract

- Executable without drift: generated files come from the saved instance state plus current translated locale values; publish serves those files.
- New readiness/status systems are not allowed.
- End-to-end accuracy must prove public static files serve base and enabled translated-language versions for the generic widget path.
- All systems must say `generated language files`, `translated locale values`, and `publish`.
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

- Current translated locale values can generate language files.
- Generated base and enabled-language files are produced from the saved instance and current translated locale values.
- Publish serves generated base and language files.
- Publish serves generated files; it does not assemble translations or inspect translation internals.
- Publish does not call Bob, Roma editor state, or San Francisco LLMs.
- Missing generated files are a generation problem, not a new publish status subsystem.
- Published language files include the same translated values Bob review used.
- Public visitor serving remains static.

## Verification

- Post-publish verification loads the public widget in base locale and at least one translated locale.
- Verification starts from a saved account widget instance with real Tokyo translated-locale values, not a handcrafted public-file fixture.
- `pnpm verify:prd103-publish-language-files` is green.
- `pnpm --filter @clickeen/tokyo-worker test` is green.
- `pnpm --filter @clickeen/roma test` is green.
- TPM signoff: the public embed fulfills the same language promise Bob shows.
- Dev Manager signoff: no runtime assembly path was reintroduced.

## Green Evidence

- `pnpm verify:prd103-publish-language-files` - green
- `pnpm --filter @clickeen/tokyo-worker test` - green
- `pnpm --filter @clickeen/roma test` - green
