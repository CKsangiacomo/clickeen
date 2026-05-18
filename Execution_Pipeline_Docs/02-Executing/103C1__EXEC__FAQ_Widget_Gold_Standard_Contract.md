# PRD 103C.1 Execution - FAQ Widget Gold Standard Contract

Status: Superseded / Not product-green after 103C.0
Executed: 2026-05-17
Parent: PRD 103 - Instance Translation Agent Teardown And Rebuild

## What Changed

The superseded execution put the FAQ translation field list in the wrong authored place.

FAQ must use authored `content.json`.

The FAQ spec must not declare `overlays.text[]` as its own authority. The low-level overlay primitive is derived from authored content fields.

San Francisco FAQ Copilot must move toward the whole widget package instead of relying only on generic control/content heuristics.

`agent.md` must stay thin guidance, not a separate schema authority.

## Surviving Authority

```text
FAQ authored content.json
```

The contract covers:

- `header.title`
- `header.subtitleHtml`
- `cta.label`
- `sections[].title`
- `sections[].faqs[].question`
- `sections[].faqs[].answer`

## Derivations

- Translation paths must derive from authored `content.json`.
- Copilot must consume the whole FAQ widget package, not a per-field allowlist.
- Current widget catalog `overlays.text[]`, if still needed, must be generated from authored `content.json` so existing storage/publish primitives keep working without becoming authority.
- Bob manual-edit coverage is verified against the contract through shared header controls and FAQ editor declarations.
- FAQ runtime validation coverage is verified against the same contract paths.

## Files Changed

- `tokyo/product/widgets/faq/spec.json`
- `tokyo/product/widgets/faq/agent.md`
- `tokyo/product/widgets/manifest.json`
- `scripts/build-widget-catalog.mjs`
- `packages/ck-contracts/src/overlay-primitives.ts`
- `packages/ck-contracts/src/overlay-primitives.test.ts`
- `sanfrancisco/src/agents/csPromptPayload.ts`
- `sanfrancisco/src/agents/csPromptPayload.test.ts`
- `sanfrancisco/package.json`

## Verification

- `pnpm build:widgets`
- `pnpm build:widgets:check`
- `pnpm --filter @clickeen/ck-contracts test`
- `pnpm --filter @clickeen/ck-contracts typecheck`
- `pnpm --filter @clickeen/sanfrancisco test`
- `pnpm --filter @clickeen/sanfrancisco typecheck`

TPM signoff: Superseded. A Clickeen user still edits one FAQ instance normally in Bob, but the product field list was put in the wrong authored place.

Dev Manager signoff: Superseded. FAQ translation authority is authored `content.json`.
