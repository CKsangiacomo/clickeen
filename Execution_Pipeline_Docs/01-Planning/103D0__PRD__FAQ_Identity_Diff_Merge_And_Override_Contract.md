# PRD 103D.0 - FAQ Identity, Diff, And Merge Contract

Status: Superseded by PRD 103J / historical proof
Owner: Product + Architecture
Date: 2026-05-17
Parent: PRD 103 - Instance Translation Agent Teardown And Rebuild
Depends on: PRD 103C.1, PRD 103C

## Purpose

Define the historical data contract that prevented language values from drifting when FAQ content was inserted, deleted, reordered, or translated. The active implementation is now the generic identity-bearing extraction in `packages/ck-contracts/src/translated-value-primitives.ts`.

Contract helper tests are useful, but this PRD is product-green only because Bob review and Publish now prove they read the same current language values.

## Execution Contract

- Executable without drift: diff, merge, Bob review, and Publish must use the same field identity.
- New systems are allowed only if they replace duplicated merge/diff behavior with one authority.
- End-to-end accuracy must cover reorder, insert, delete, changed question, changed answer, restored FAQ, and partial agent failure.
- All systems must say `field identity` and `current language values`.
- Blast radius includes FAQ IDs, saved text graph extraction, translation job input, language value storage, Bob review, manual overlay edits, publish generation, and tests.

## Field Identity

Repeated FAQ fields use stable item identity, not array index:

```text
instanceId
widgetType
field role/path
sectionId where applicable
faqId where applicable
locale
```

Array index is display order only.

## Merge Authority

Historical implementation introduced a FAQ-only merge helper. That helper is deleted; Tokyo's generic translated-value path is now the active merge authority.

Input:

- previous saved text graph
- current saved text graph
- previous language values
- translation agent result for changed/new fields
- deleted field identities

Output:

```text
complete current language values for one instance + locale
```

Merge rules:

- changed text -> new translation
- new text -> new translation
- unchanged text -> carried forward
- deleted text -> removed
- unknown returned field -> rejected
- missing changed field -> locale job failure
- partial agent failure -> last good current language values remain untouched

## Manual Overlay Edits

Manual edits are not a second merge/provenance system. Bob edits the selected current-language overlay values object, Roma writes the full values object, and Tokyo validates/versions it through the existing overlay primitive.

## Acceptance

- Reordering sections or FAQ items does not retranslate unchanged text.
- Reordering does not attach a translation to the wrong question/answer.
- Deleting an FAQ removes only that FAQ's language values.
- Inserting a FAQ translates only new FAQ fields.
- Duplicate or missing section/FAQ IDs fail before translation.
- Generic translated-value merge behavior is idempotent for stable field identities.
- Publish consumes the same current language values Bob reviews.
- Manual overlay edit and publish behavior is covered by 103F.

## Verification

- Unit fixtures cover all identity/merge cases.
- Product fixture proves Bob review and Publish read the same current language values.
- Until 103E and 103G are green, this remains contract-green only.
- TPM signoff: a user never sees translations jump to the wrong FAQ.
- Dev Manager signoff: merge has one authority.
