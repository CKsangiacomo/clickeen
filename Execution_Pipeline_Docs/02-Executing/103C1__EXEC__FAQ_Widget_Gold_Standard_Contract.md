# PRD 103C.1 Execution - FAQ Widget Gold Standard Contract

Status: Superseded / Not product-green after 103C.0
Executed: 2026-05-17
Parent: PRD 103 - Instance Translation Agent Teardown And Rebuild

## What Changed

The superseded execution put the FAQ translation field list in the wrong authored place.

FAQ must use authored `editable-fields.json` for the translatable field contract.

The FAQ spec must not declare `overlays.text[]` as its own authority. The low-level overlay primitive is derived from authored content fields.

San Francisco FAQ Copilot must move toward the whole widget package instead of relying only on generic control/content heuristics.

`agent.md` must stay thin guidance, not a separate schema authority.

## Surviving Authority

```text
FAQ authored editable-fields.json
```

The contract covers:

- `header.title`
- `header.subtitleHtml`
- `cta.label`
- `sections[].title`
- `sections[].faqs[].question`
- `sections[].faqs[].answer`

## Derivations

- Translation paths must derive from authored `editable-fields.json`.
- Copilot must consume the whole FAQ widget package, not a per-field allowlist.
- Widget-definition `overlays.text[]`, if still needed, must be derived from authored `editable-fields.json` so existing storage/publish primitives keep working without becoming authority.
- Bob manual-edit coverage is verified against the contract through shared header controls and FAQ editor declarations.
- FAQ runtime validation coverage is verified against the same contract paths.

## Files Changed

- `tokyo/product/widgets/faq/spec.json`
- `tokyo/product/widgets/faq/agent.md`
- historical `tokyo/product/widgets/manifest.json` path, deleted in 103_01.3b
- historical `scripts/build-widget-catalog.mjs` path, deleted in 103_01.3b
- `packages/ck-contracts/src/overlay-primitives.ts`
- `packages/ck-contracts/src/overlay-primitives.test.ts`
- `sanfrancisco/src/agents/csPromptPayload.ts`
- `sanfrancisco/src/agents/csPromptPayload.test.ts`
- `sanfrancisco/package.json`

## Verification

- historical `pnpm build:widgets`
- current replacement: `pnpm validate:widgets`
- `pnpm --filter @clickeen/ck-contracts test`
- `pnpm --filter @clickeen/ck-contracts typecheck`
- `pnpm --filter @clickeen/sanfrancisco test`
- `pnpm --filter @clickeen/sanfrancisco typecheck`

TPM signoff: Superseded. A Clickeen user still edits one FAQ instance normally in Bob, but the product field list was put in the wrong authored place.

Dev Manager signoff: Superseded. FAQ translation authority is authored `editable-fields.json`.
