# PRD 103V - FAQ Single-Language Vertical Slice

Status: Complete / Product vertical proof green
Owner: Product + Architecture
Date: 2026-05-17
Parent: PRD 103 - Instance Translation Agent Teardown And Rebuild
Depends on: PRD 103B, PRD 103D, PRD 103E

## Purpose

Prove the smallest end-to-end product path before broader execution continues:

```text
edit one FAQ field in Bob
save
translate one target language
store current language values
show translated FAQ text in Bob
```

This is the anti-theatre slice. It blocks broad San Francisco cleanup, publish expansion, policy hardening, and override UX until the core product path works.

The verifier is paired with product-path tests for Roma save follow-up, Tokyo overlay write/read, and Bob panel rendering.

## Execution Contract

- Executable without drift: this slice must run through FAQ `content.json`, Instance Translation Agent contract, changed-text diff, merge authority, and Bob review UI defined by earlier slices.
- New systems are not allowed unless they directly remove a blocker in this thin path.
- End-to-end accuracy is limited to one FAQ instance, one edited text field, one target locale, and one visible translated result in Bob.
- All systems must say `saved instance`, `changed field`, `Instance Translation Agent`, `current language values`, and `Translations panel`.
- Blast radius includes Bob edit/save, Roma save trigger, San Francisco translation execution, Tokyo language value write/read, and Bob Translations panel.

## Scope

In scope:

- one FAQ instance
- one base locale
- one target locale
- one changed text field
- read-only Bob translation review

Out of scope:

- manual overrides
- multi-language fanout optimization
- full San Francisco folder reshaping
- publish language files
- model tier changes beyond using existing `ck-policy`
- generalized widget support

## Acceptance

- User edits one FAQ title, question, or answer in Bob.
- Save persists the base FAQ.
- Clickeen detects only the changed field.
- Instance Translation Agent translates that field for one target locale.
- `buildCurrentLanguageValues()` writes a complete current language value set for that locale.
- Bob Translations panel shows the translated FAQ text through the authored content JSON review path.
- Preview can use the same current language values.
- No `spec.json` translation field list, `overlays.text[]`, compiled-control regex, or preview-only state is used as authored text authority.
- The proof includes Tokyo overlay write/read and Bob production panel rendering.

## Verification

- `pnpm verify:prd103-faq-vertical` must cover one changed FAQ answer from authored `content.json`, one Spanish target locale, job-shaped Instance Translation Agent request normalization, complete current language value merge, content-JSON Bob review rendering, preview overlay resolution, and the missing-translation failure fixture.
- If `pnpm verify:prd103-faq-vertical` stays helper-only, it must be accompanied by product integration tests for Roma save follow-up, Tokyo overlay write/read, and Bob panel rendering.
- `pnpm --filter @clickeen/tokyo-worker test` is green.
- `pnpm --filter @clickeen/ck-contracts test` is green.
- `pnpm --filter @clickeen/ck-contracts typecheck` is green.
- `pnpm --filter @clickeen/roma typecheck` is green.
- `pnpm --filter @clickeen/bob typecheck` is green.
- `pnpm --filter @clickeen/sanfrancisco typecheck` is green.
- TPM signoff: the one FAQ edit / one language user story is represented by the vertical verifier.
- Dev Manager signoff: the thin path uses authored `content.json`, `selectFaqFieldsNeedingTranslation()`, Instance Translation Agent job shape, `buildCurrentLanguageValues()`, and Bob current-language review, not a `spec.json` translation field list, `overlays.text[]`, or preview-only state.
