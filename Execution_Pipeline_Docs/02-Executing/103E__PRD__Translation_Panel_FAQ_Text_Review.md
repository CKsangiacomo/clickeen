# PRD 103E - Translation Panel Contract Text Review

Status: Reopened / Panel-owned generation cutover in progress
Owner: Product + Architecture
Date: 2026-05-17
Parent: PRD 103 - Instance Translation Agent Teardown And Rebuild
Depends on: PRD 103C.0 for UI wiring; PRD 103D for full product vertical proof

## Purpose

Turn Bob's Translations panel from preview/inventory plumbing into the place where the user sees the Instance Translation Agent result.

Initial UX target is read-only review. Editing translated values belongs to PRD 103F.

The first implementation hardcoded FAQ review paths in Bob. Review must derive from authored content JSON or its generated translation projection.

Bob's production `TranslationsPanel` renders the translated rows through the generic content projection.

## Execution Contract

- Executable without drift: the panel reads stored current language values, not preview-only state.
- New systems are not allowed; the panel compares Roma settings with Tokyo overlays and displays found current language values.
- End-to-end accuracy must prove Save base -> Generate in Translations panel -> Translation -> Bob panel review for authored content JSON text.
- All systems must say `current language values`, `Roma settings`, `Tokyo overlays`, and `translations ready`.
- Blast radius includes Bob panel UI, preview dropdown, overlay application, language value storage reads, and tests.
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

- `Y` comes from Roma settings: enabled target locales excluding the base locale.
- `X` comes from Tokyo overlays found for those enabled target locales.
- If `X === Y`, all translations are ready and Bob does not refresh the dropdown while the user stays in the panel.
- If `X !== Y`, Bob shows the count and refreshes Tokyo overlay inventory whenever the user clicks the dropdown.
- The dropdown contains only the base locale plus translated languages that have Tokyo overlays.

## Acceptance

- User selects a language.
- Bob shows translated fields from authored content JSON / generated translation projection.
- FAQ renders from the same generic review path as future widgets.
- Preview still works.
- Missing language overlays are represented only by the `X of Y translations ready` count.
- The review UI reads stored current language values, not preview-only state.
- The Translations panel owns the only user-facing `Generate translations` trigger.
- `Generate translations` uses the current saved instance and Tokyo language values; it does not send Bob form text or a Bob-computed diff.
- The dropdown refresh behavior follows the two product cases: complete overlays do not refresh while the panel stays open; incomplete overlays refresh when the user clicks the dropdown.
- Selecting a language with an overlay displays translated values. Selecting a language without an overlay shows only `Translation not ready yet.`
- Fail if Bob needs `buildFaqTranslationReview()` or widget-specific path hardcoding to show translated values.

## Verification

- Bob unit coverage proves the content-JSON review reads stored current language values and reports missing fields inside an existing overlay.
- Bob UI coverage proves `TranslationsPanel` renders review rows, readiness count, complete-dropdown behavior, incomplete-dropdown refresh, and missing-overlay empty message.
- `pnpm --filter @clickeen/bob test` is green.
- `pnpm --filter @clickeen/bob typecheck` is green.
- TPM signoff: user can inspect what Clickeen translated in Bob through the widget contract.
- Dev Manager signoff: panel review is backed by Tokyo overlays, current language values, and authored content JSON; Roma settings provide only the expected language count.
