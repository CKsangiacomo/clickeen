# PRD 103E - Translation Panel Contract Text Review

Status: Superseded by PRD 103J / historical Bob panel evidence
Owner: Product + Architecture
Date: 2026-05-17
Parent: PRD 103 - Instance Translation Agent Teardown And Rebuild
Depends on: PRD 103C.0 for UI wiring; PRD 103D for full product vertical proof

## 103J Supersession Note

This PRD is not executable as written. It remains useful only for the product rule that Bob reviews stored translated values and owns the user-facing Generate trigger. Its overlay/inventory and FAQ-specific wording is superseded by `103J__PRD__Generic_Widget_Translation_System.md`. Future Bob work must render generic editable-fields review rows and product-state copy from Tokyo generation truth; `Queued 0 of N`, Tokyo overlay inventory, and FAQ-only review are not acceptable.

## Purpose

Turn Bob's Translations panel from preview/inventory plumbing into the place where the user sees the Instance Translation Agent result.

Initial UX target is read-only review. Editing translated values belongs to PRD 103F.

The first implementation hardcoded FAQ review paths in Bob. After 103J, review must derive from the generic widget editable-fields contract and saved instance content.

Bob's production `TranslationsPanel` renders the translated rows through the generic content projection.

## Execution Contract

- Executable without drift: the panel reads stored current language values, not preview-only state.
- Superseded execution contract: the panel compared Roma settings with Tokyo overlays and displayed found current language values. After 103J, Bob reads Tokyo product generation/readiness truth and translated-locale values, not overlay inventory.
- End-to-end accuracy must prove Save base -> Generate in Translations panel -> Translation -> Bob panel review for generic editable-fields text.
- All systems must say `current language values`, `Tokyo generation state`, `translated locale values`, and `translations ready`.
- Blast radius includes Bob panel UI, preview dropdown, translated-locale application, language value storage reads, and tests.
- Pre-work limit: do not build a full translation management UI before the read-only content-JSON review path works.

## UX Target

```text
Translations

Language: Spanish

Header
Title
[translated value]

CTA
Label
[translated value]

Content
Booking
FAQ question
[translated question]
FAQ answer
[translated answer]
```

## Readiness Copy

Bob does not own translation status.

```text
X of Y translations ready
```

- `Y` comes from the target locales in Tokyo generation/readiness truth.
- `X` comes from Tokyo translated-locale readiness for those target locales.
- If `X === Y`, all translations are ready and Bob does not refresh the dropdown while the user stays in the panel.
- If `X !== Y`, Bob shows product-state copy and refreshes Tokyo generation/readiness truth whenever the user opens the panel/dropdown.
- The dropdown contains only the base locale plus translated languages that Tokyo reports ready.

## Acceptance

- User selects a language.
- Bob shows translated fields from authored content JSON / generated translation projection.
- FAQ renders from the same generic review path as future widgets.
- Preview still works.
- Missing translated locales are represented by Tokyo readiness/product-state copy.
- The review UI reads stored current language values, not preview-only state.
- The Translations panel owns the only user-facing `Generate translations` trigger.
- `Generate translations` uses the current saved instance and Tokyo language values; it does not send Bob form text or a Bob-computed diff.
- The dropdown refresh behavior follows Tokyo generation/readiness state, not overlay inventory.
- Selecting a ready translated locale displays translated values. Selecting a locale that is not ready shows only `Translation not ready yet.`
- Fail if Bob needs `buildFaqTranslationReview()` or widget-specific path hardcoding to show translated values.

## Verification

- Bob unit coverage proves the generic editable-fields review reads stored current language values and reports missing fields inside an existing translated locale value map.
- Bob UI coverage proves `TranslationsPanel` renders review rows, readiness count, complete-dropdown behavior, incomplete-dropdown refresh, and missing-overlay empty message.
- `pnpm --filter @clickeen/bob test` is green.
- `pnpm --filter @clickeen/bob typecheck` is green.
- TPM signoff: user can inspect what Clickeen translated in Bob through the widget contract.
- Dev Manager signoff: panel review is backed by Tokyo generation/readiness truth, current language values, and generic editable-fields contracts; Roma settings provide account locale policy only.
