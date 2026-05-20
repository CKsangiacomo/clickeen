# PRD 103C.0 - Widget Source Split And Content JSON

Status: Superseded by 103_01.3a/103_01.3b/103_01.4 / Historical test floor only
Owner: Product + Architecture
Date: 2026-05-18
Parent: PRD 103 - Instance Translation Agent Teardown And Rebuild

PRD 103_00 NOTE: this slice is no longer current source-model authority. Its `content.json` name was superseded by `tokyo/product/widgets/faq/editable-fields.json` in `103_01.3a`; generated widget manifest/catalog authority was deleted in `103_01.3b`; the full widget-source/bootstrap gate closed in `103_01.4`. This document remains historical only and cannot authorize widget-owned account content, `agent.md`, widget SEO/GEO source, or generated manifest/catalog authority.

## Purpose

Stop treating FAQ's 3k+ line `spec.json` as a sustainable authored source format.

For hundreds of widgets, the widget folder must expose small authored files by responsibility. This historical slice named the translation field contract `content.json`; PRD 103_01.3a superseded that name with `editable-fields.json`. Copilot must not be reduced to a text-field allowlist.

## Product Truth

Historical wording below used `content.json`. Current wording is `editable-fields.json`: the widget declares editable/translatable field paths, while the account instance owns current saved values.

```text
editable-fields.json
  -> customer-visible text fields
  -> current saved values
  -> target locale
  -> current language values
```

Historical note: this slice originally discussed Copilot package contents before 103_01 deleted `agent.md` and widget SEO/GEO source. Current Copilot/package authority must come from active 103_01, 103I, and later 103_02 contracts, not from this historical list.

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
  -> current service/docs guidance, not widget agent.md
```

## Target FAQ Source Shape

```text
tokyo/product/widgets/faq/
  spec.json              # small entrypoint or generated compatibility artifact
  editable-fields.json   # editable/translatable field contract for Translation
  editor.json            # Bob/ToolDrawer panels and controls
  defaults.json          # default instance config
  normalization.json     # ids/coercion rules
  limits.json
  catalog.json
  widget.html
  widget.css
  widget.client.js
  # widget agent.md is deleted and forbidden by current widget-source validation
```

`spec.json` may remain as a generated compatibility artifact during migration, but it must not remain the hand-authored source of every concern.

## Current Restart Scope

Historically, FAQ had an authored `content.json` for customer-visible translation fields. PRD 103_01.3a moved that contract to `editable-fields.json`. The remaining restart work from this historical slice was closed by 103_01: generated manifest/catalog authority was deleted, and FAQ translation declarations now live in `editable-fields.json` instead of `spec.json`.

This historical slice was green when `pnpm --filter @clickeen/tokyo-worker test` passed on the then-current field-contract fixtures. Current green proof is recorded in 103_01.3a.

## FAQ Content JSON Scope

Current FAQ `editable-fields.json` includes:

```text
header.title
header.subtitleHtml
cta.label
sections[].title
sections[].faqs[].question
sections[].faqs[].answer
```

Current FAQ `editable-fields.json` excludes:

```text
sections[].id
sections[].faqs[].id
sections[].faqs[].defaultOpen
```

IDs are identity. `defaultOpen` is behavior/config state. Neither is customer-visible text.

## Non-Negotiables

- Do not create another authored translation layer beside `editable-fields.json`.
- `editable-fields.json` is the editable/translatable field contract.
- Delete `per-field Copilot allowlist` from the content-field model.
- Translation field selection derives from `editable-fields.json`.
- Bob translation review derives from `editable-fields.json`.
- Copilot receives the widget package view, not the translation field list alone.
- Editor/ToolDrawer controls reference authored fields; they do not become a second translation source.

## Acceptance

- FAQ authored source is split or has an executable migration plan that creates the split before more PRD 103 execution.
- `editable-fields.json` can expand saved FAQ content into concrete customer-visible text fields.
- A validation test fails if translated FAQ text exists outside `editable-fields.json`.
- A validation test fails if translated fields are declared in FAQ `spec.json`.
- Tokyo translation fixtures are generated from, or explicitly derived from, FAQ `editable-fields.json`.
- A future widget can implement translation by adding its `editable-fields.json`, not by writing custom translation code.
- A future widget can implement Copilot by supplying the widget package view, not by adding per-field Copilot allowlist flags.

## Verification

- Fixture: FAQ `editable-fields.json` expands current saved content into header, CTA, section title, question, and answer paths.
- Fixture: `defaultOpen` and IDs are absent from translation input.
- Fixture: generated compatibility, if still needed, is byte-for-byte derived from `editable-fields.json`.
- `pnpm --filter @clickeen/tokyo-worker test` is green without reintroducing FAQ translation declarations in `spec.json`.
- TPM signoff: the product model is explainable as “Translation reads editable fields and saved instance content; Copilot reads the widget package.”
- Dev Manager signoff: no duplicate authored text authority remains.
