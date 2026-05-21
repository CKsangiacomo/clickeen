# PRD 103D - Changed Field Translation

Status: Reopened / Panel Generate delta proof in progress
Owner: Product + Architecture
Date: 2026-05-17
Parent: PRD 103 - Instance Translation Agent Teardown And Rebuild
Depends on: PRD 103B, PRD 103D.0

## Purpose

Translate only the FAQ fields that are missing, new, or changed when the user triggers Generate from the Translations panel, then build complete current language values for each enabled language.

This is not word-level diffing. If a user changes one word in an answer, Clickeen sends the whole answer field to the Instance Translation Agent. If a user changes a question, Clickeen sends the whole question field. If a user changes a title, Clickeen sends the whole title field.

Initial implementation should prove one target locale first through PRD 103V. Multi-language fanout can broaden only after the single-language path works.

## Execution Contract

- Executable without drift: changed-field translation must use authored FAQ `content.json` and `buildCurrentLanguageValues()`.
- New systems are allowed only when they replace full-graph retranslating or duplicate merge behavior.
- End-to-end accuracy must prove Save base -> Generate -> changed/missing fields -> agent -> complete language values -> Bob review.
- All systems must say `changed fields`, `deleted fields`, `current language values`, and `locale job`.
- Blast radius includes save snapshots, field graph extraction, translation queue/job, merge, language storage, Bob states, failure handling, and tests.

## Non-Goal

No word-level text diffing, sentence patching, token patching, or partial translation merge. The smallest unit is the editable FAQ field/content unit:

- header title
- header subtitle
- CTA label
- section title
- FAQ question
- FAQ answer

## Flow

```text
Save FAQ
  -> persist base locale only
Generate translations
  -> extract current saved field graph from content.json
  -> compare against the PRD-approved previous/current field authority by stable field identity
  -> identify new/changed/deleted/unchanged fields
  -> run Instance Translation Agent for whole new/changed fields
  -> buildCurrentLanguageValues()
  -> store current language values
```

## Current State

The production path is being cut over from save follow-up to panel-owned Generate. The changed-field delta authority for existing translated overlays is blocked until named in product terms.

## Acceptance

- New fields are translated as whole fields.
- Changed fields are translated as whole fields.
- If a user changes one word, Clickeen sends the whole editable object value for that field, not a word-level diff.
- Unchanged fields are not sent to the AI translator again.
- Deleted fields are removed from current language values.
- Reordered unchanged FAQ fields are not translated again.
- Reordered unchanged FAQ fields keep the correct language value by stable ID.
- Stored language values are complete for the current FAQ, not partial agent output.
- Unknown returned fields are rejected.
- Missing changed fields fail the locale job.
- Partial agent failure does not overwrite the last good current language set.
- The first passing proof may be one FAQ field and one target locale, as long as the code path is the real production path.

## Verification

- Fixtures cover new, changed, missing, deleted, unchanged, reordered, and partial failure.
- A production Generate test covers one FAQ answer edit through the named delta authority and job enqueue.
- Usage/audit records show only whole changed/new fields were sent to the model.
- Failed translation attempts must not write partial overlays; Bob only displays overlays Tokyo returns.
- TPM signoff: user sees dependable translation after Save.
- Dev Manager signoff: full-graph retranslating is gone from the product path.
