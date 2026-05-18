# PRD 103C.0 - Widget Source Split And Content JSON

Status: Complete / Test floor green
Owner: Product + Architecture
Date: 2026-05-18
Parent: PRD 103 - Instance Translation Agent Teardown And Rebuild

## Purpose

Stop treating FAQ's 3k+ line `spec.json` as a sustainable authored source format.

For hundreds of widgets, the widget folder must expose small authored files by responsibility. Translation depends on authored `content.json`, and Copilot must not be reduced to a text-field allowlist.

## Product Truth

Translation Agent works on one authored content JSON:

```text
content.json
  -> customer-visible text fields
  -> current saved values
  -> target locale
  -> current language values
```

Copilot Agent works on the whole widget package:

```text
widget folder
  -> content model
  -> editor controls
  -> defaults
  -> normalization
  -> limits
  -> widget.html
  -> widget.css
  -> widget.client.js
  -> agent.md
```

## Target FAQ Source Shape

```text
tokyo/product/widgets/faq/
  spec.json              # small entrypoint or generated compatibility artifact
  content.json           # customer-visible content fields for Translation
  editor.json            # Bob/ToolDrawer panels and controls
  defaults.json          # default instance config
  normalization.json     # ids/coercion rules
  limits.json
  catalog.json
  widget.html
  widget.css
  widget.client.js
  agent.md
```

`spec.json` may remain as a generated compatibility artifact during migration, but it must not remain the hand-authored source of every concern.

## Current Restart Scope

FAQ now has an authored `content.json` for customer-visible translation fields. The immediate restart is not to split every FAQ source file before moving again. The immediate restart is to make the existing generated/catalog path and Tokyo overlay tests consume the content-derived contract, without restoring FAQ translation declarations in `spec.json`.

This slice is green when `pnpm --filter @clickeen/tokyo-worker test` passes on content-derived overlay contract fixtures.

## FAQ Content JSON Scope

FAQ `content.json` includes:

```text
header.title
header.subtitleHtml
cta.label
sections[].title
sections[].faqs[].question
sections[].faqs[].answer
```

FAQ `content.json` excludes:

```text
sections[].id
sections[].faqs[].id
sections[].faqs[].defaultOpen
```

IDs are identity. `defaultOpen` is behavior/config state. Neither is customer-visible text.

## Non-Negotiables

- Do not create another authored translation layer beside `content.json`.
- `content.json` is the authored translation source.
- Delete `per-field Copilot allowlist` from the content-field model.
- Translation derives from `content.json`.
- Bob translation review derives from `content.json`.
- Copilot receives the widget package view, not the translation field list alone.
- Editor/ToolDrawer controls reference authored fields; they do not become a second translation source.

## Acceptance

- FAQ authored source is split or has an executable migration plan that creates the split before more PRD 103 execution.
- `content.json` can expand a saved FAQ config into concrete customer-visible text fields.
- A validation test fails if translated FAQ text exists outside `content.json`.
- A validation test fails if translated fields are declared in FAQ `spec.json`.
- Tokyo overlay fixtures are generated from, or explicitly derived from, FAQ `content.json`.
- A future widget can implement translation by adding its `content.json`, not by writing custom translation code.
- A future widget can implement Copilot by supplying the widget package view, not by adding per-field Copilot allowlist flags.

## Verification

- Fixture: FAQ `content.json` expands current defaults into header, CTA, section title, question, and answer paths.
- Fixture: `defaultOpen` and IDs are absent from translation input.
- Fixture: generated compatibility, if still needed, is byte-for-byte derived from `content.json`.
- `pnpm --filter @clickeen/tokyo-worker test` is green without reintroducing FAQ translation declarations in `spec.json`.
- TPM signoff: the product model is explainable as “Translation reads content JSON; Copilot reads the widget package.”
- Dev Manager signoff: no duplicate authored text authority remains.
