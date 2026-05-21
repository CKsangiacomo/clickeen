# PRD 103C.1 - FAQ Widget Gold Standard Contract

Status: Restart / Partial / Not product-green
Owner: Product + Architecture
Date: 2026-05-17
Parent: PRD 103 - Instance Translation Agent Teardown And Rebuild

## Purpose

Make FAQ the corrected widget authored source shape that all later widgets copy.

This must complete before Copilot, Translation, merge, Bob review, or San Francisco execution work can be considered complete.

This does not authorize a generalized widget schema platform. Build the smallest FAQ source split that removes duplicate FAQ text truth and can be copied by the next widget.

## Product Contract

FAQ declares customer-visible content fields once in authored `content.json`:

```text
header.title
header.subtitleHtml
cta.label
sections[].title
sections[].faqs[].question
sections[].faqs[].answer
```

It does not include IDs or behavior/config state such as `defaultOpen`.

Each content field declares:

```text
path
type
label
role
array item identity
limits
```

Text kind and other rendering details can exist when the widget needs them, but they are not a second translation authority.

## Execution Contract

- Executable without drift: Translation, language values, Bob review, and generated overlay values must consume FAQ `content.json`.
- Copilot must consume the whole FAQ widget package, not `content.json` alone.
- New systems are allowed only when they replace duplicate declarations or derive old declarations from authored source.
- End-to-end accuracy must prove one FAQ edit is visible to Bob manual editing, Copilot, Translation, Bob review, and Publish.
- All systems must use the same field names and product language.
- Blast radius includes FAQ `spec.json`, new authored source files, object-manager/repeater controls, `content.json`, `overlays.text[]`, `agent.md`, Bob control compilation, Copilot prompt payloads, translation extraction, runtime validation, tests, and docs.
- Pre-work limit: do not build generalized tooling for all widgets until FAQ proves the pattern with one working contract fixture.

## Required Decisions

Record the fate of each duplicate source:

- `spec.json` translation fields: delete; `content.json` is the authored source.
- `overlays.text[]`: delete or derive from `content.json`.
- Copilot control heuristics: replace with FAQ widget package understanding.
- `agent.md`: generate from contract or keep as thin guidance only.
- Object-manager/repeater markup paths: UI/edit affordance only, not product text authority.

## Current State

FAQ has the first `content.json` and generated translation contract plumbing. This PRD is not complete until the Tokyo overlay tests use that derived contract and Bob/Roma prove the same fields through real product paths.

## Acceptance

- FAQ has one authored `content.json` for header, CTA, sections, questions, and answers.
- FAQ editor controls derive from or reference authored content fields.
- FAQ translation paths derive from `content.json`.
- FAQ Copilot context derives from the whole FAQ widget package.
- FAQ runtime validation/rendering consumes the same canonical state shape.
- `agent.md` no longer acts as a separate schema authority.
- Generated overlay compatibility, where still present, derives from `content.json`.
- Validation fails if a translated FAQ field exists outside `content.json`.
- Future widget PRDs can cite this contract shape as the standard.
- No abstraction is introduced unless FAQ itself needs it immediately.

## Verification

- Test fixture expands a current FAQ config into translatable content fields and repeated item identities.
- Tokyo overlay contract tests are green without a hand-authored FAQ translation field list in `spec.json`.
- Bob can open, edit, validate, preview, and save FAQ from the canonical contract.
- TPM signoff: the user still edits one FAQ instance normally in Bob.
- Dev Manager signoff: FAQ text has one authority.
