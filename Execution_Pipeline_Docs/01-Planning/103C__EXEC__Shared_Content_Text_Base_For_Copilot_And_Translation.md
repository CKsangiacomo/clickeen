# PRD 103C Execution - Shared Content/Text Base For Copilot And Translation

Status: Superseded / Not product-green after 103C.0
Executed: 2026-05-17
Parent: PRD 103 - Instance Translation Agent Teardown And Rebuild
Depends on: PRD 103C.1

## What Changed

Copilot and translation were made to consume the same FAQ content fields contract. That is now superseded by the corrected model: Translation consumes the FAQ `editable-fields.json` contract plus saved instance content; Copilot consumes the whole widget package.

The previous implementation built FAQ Copilot prompt context from a per-field allowlist. That is now drift.

Translation items must instead derive from authored `editable-fields.json` field paths applied to saved instance content.

The translator prompt includes `label` and `role`, so the Instance Translation Agent sees field meaning from the contract instead of inferring meaning from path names alone.

## Shared Field Identity

The shared FAQ field identity now includes:

- `path`
- `label`
- `role`
- `type`
- `textKind`
- current value

This is used by:

- Bob manual edit coverage checks
- San Francisco FAQ copilot prompt context
- Bob compiled widget payload and Copilot request payload
- Roma save follow-up translation item creation
- San Francisco translation prompt payload
- Tokyo/Roma overlay validation through the derived primitive graph

## Files Changed

- `packages/ck-contracts/src/overlay-primitives.ts`
- `packages/ck-contracts/src/overlay-primitives.test.ts`
- `bob/lib/compiler.server.ts`
- `bob/lib/types.ts`
- `bob/components/CopilotPane.tsx`
- `roma/lib/account-babel-save-followup.ts`
- `roma/app/api/account/instances/[instanceId]/copilot/route.ts`
- `sanfrancisco/src/agents/csPromptPayload.ts`
- `sanfrancisco/src/agents/csPromptPayload.test.ts`
- `sanfrancisco/src/agents/l10nTranslationCore.ts`
- `sanfrancisco/src/l10n-account-routes.ts`
- `sanfrancisco/src/l10n-account-routes.test.ts`
- historical `scripts/build-widget-catalog.mjs` path, deleted in 103_01.3b
- historical `tokyo/product/widgets/manifest.json` path, deleted in 103_01.3b

## Verification

- historical `pnpm build:widgets`
- current replacement: `pnpm validate:widgets`
- `pnpm --filter @clickeen/ck-contracts test`
- `pnpm --filter @clickeen/ck-contracts typecheck`
- `pnpm --filter @clickeen/sanfrancisco test`
- `pnpm --filter @clickeen/sanfrancisco typecheck`
- `pnpm --filter @clickeen/roma typecheck`

TPM signoff: Superseded. Copilot and Translation should share the widget folder source family, not the same narrow text field list.

Dev Manager signoff: Superseded. FAQ translation field authority must be authored `editable-fields.json`.
