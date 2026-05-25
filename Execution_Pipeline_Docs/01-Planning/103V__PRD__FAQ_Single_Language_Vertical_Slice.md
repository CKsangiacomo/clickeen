# PRD 103V - FAQ Single-Language Vertical Slice

Status: Complete / Green after panel-owned Generate reproof
Owner: Product + Architecture
Date: 2026-05-20
Parent: PRD 103 - Instance Translation Agent Teardown And Rebuild
Depends on: PRD 103B, PRD 103D, PRD 103E

## Purpose

Prove the smallest end-to-end product path before broader execution continues:

```text
edit one FAQ field in Bob
save
click Generate in the Translations panel
translate one target language
store current language values
show translated FAQ text in Bob
```

This is the anti-theatre slice. It blocks broad San Francisco cleanup, publish expansion, policy hardening, and override UX until the core product path works.

The verifier is paired with product-path tests for panel-owned Generate, Tokyo translated-locale value write/read, San Francisco queue execution, and Bob panel rendering.

## Execution Contract

- Executable without drift: this slice must run through the FAQ `editable-fields.json` contract, saved `instance.content.json` values, Instance Translation Agent contract, changed-text diff, merge authority, and Bob review UI defined by earlier slices.
- New systems are not allowed unless they directly remove a blocker in this thin path.
- End-to-end accuracy is limited to one FAQ instance, one edited text field, one target locale, and one visible translated result in Bob.
- All systems must say `saved instance`, `changed field`, `Instance Translation Agent`, `current language values`, and `Translations panel`.
- Blast radius includes Bob edit/save, Translations panel Generate, San Francisco translation execution, Tokyo language value write/read, and Bob Translations panel.

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
- User clicks Generate in the Translations panel.
- Clickeen detects only the changed field.
- Instance Translation Agent translates that field for one target locale.
- Generic Tokyo translated-value completion writes a complete current language value set for that locale.
- Bob Translations panel shows the translated FAQ text through the editable-fields/current-language-values review path.
- Preview can use the same current language values.
- No `spec.json` translation field list, `overlays.text[]`, compiled-control regex, or preview-only state is used as authored text authority.
- The proof includes Tokyo translated-locale value write/read and Bob production panel rendering.

## Verification

- This FAQ-only proof is superseded by `pnpm verify:prd103-publish-language-files`, which covers FAQ plus non-FAQ widgets through the generic `editable-fields.json` translation path.
- The generic proof is accompanied by product integration tests for panel-owned Generate, Tokyo translated-locale value write/read, San Francisco queue execution, and Bob panel rendering.
- `pnpm --filter @clickeen/tokyo-worker test` is green.
- `pnpm --filter @clickeen/ck-contracts test` is green.
- `pnpm --filter @clickeen/ck-contracts typecheck` is green.
- `pnpm --filter @clickeen/roma typecheck` is green.
- `pnpm --filter @clickeen/bob typecheck` is green.
- `pnpm --filter @clickeen/sanfrancisco typecheck` is green.
- TPM signoff: the one FAQ edit / one language user story is represented by the vertical verifier.
- Dev Manager signoff: this FAQ-only thin path is superseded by the generic 103J path using `editable-fields.json`, `instance.content.json`, generic saved text fields, Instance Translation Agent job shape, Tokyo translated-value completion, and Bob current-language review, not a `spec.json` translation field list, `overlays.text[]`, or preview-only state.

## Green Evidence

- `pnpm verify:prd103-publish-language-files` - green
- `pnpm --filter @clickeen/tokyo-worker test` - green; Tokyo Generate queues only the edited FAQ answer for an existing translated locale.
- `pnpm --filter @clickeen/ck-contracts test` - green
- `pnpm --filter @clickeen/ck-contracts typecheck` - green
- `pnpm --filter @clickeen/roma test` - green
- `pnpm --filter @clickeen/roma typecheck` - green
- `pnpm --filter @clickeen/bob test` - green
- `pnpm --filter @clickeen/bob typecheck` - green
- `pnpm --filter @clickeen/sanfrancisco test` - green
- `pnpm --filter @clickeen/sanfrancisco typecheck` - green
- `pnpm validate:widgets` - green
- `node scripts/verify/primitive-drift.mjs` - green
