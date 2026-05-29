# EXEC 103_DB.4 Tokyo Translated-Locale Operation Cleanup

Status: Executed historical evidence / green runtime slice; surviving doctrine extracted to PRD 105C; superseded by PRD 105, 105A, 105B, and 105C where conflicting
Date Started: 2026-05-22
Parent PRD: `103_DB_Pivot__PRD__Operational_State_In_Supabase_Public_Artifacts_In_R2.md`
Execution slice: `103_DB.4 - Tokyo translated-locale operation cleanup`

Archive note: this document is no longer active execution authority. It is retained as evidence for translated-locale product operation cleanup. PRD 105 supersedes this document where physical translated-locale storage shape conflicts.

## Slice Intent

Roma and Bob must speak translated-locale product operations with Tokyo. They must not load or reason about overlay inventories, selected overlay pointers, overlay object IDs, R2 keys, or storage paths.

Tokyo may keep the translated value payload in its private storage implementation for this slice. The product contract is `{ accountId, instanceId, locale } -> translated values/readiness`, not `{ overlayId, inventory, selected pointer }`.

## Scope

- Replace active product API response shapes that expose overlay inventory or selected/current overlay identity.
- Keep manual translation edits simple: editing translated values overwrites the translated value payload for that locale. There is no override status/history in this slice.
- Keep generated translation payload storage behind Tokyo operations.
- Do not introduce translation job tables or new DB abstractions. Generate control state belongs to `103_DB.5`.

## Green Condition

- Bob/Roma/Tokyo list translated locales and read/write translated values through Tokyo product operations.
- No active product path exposes overlay inventory, selected/current pointers, overlay IDs, or storage paths.
- Local verification covers Tokyo translation operations plus Bob/Roma type contracts.
- Documentation records the surviving translated-locale boundary before the slice closes.

## Implemented

- Deleted Tokyo's exported overlay object, overlay inventory, overlay id allocation, selected overlay pointer, and published overlay projection operations from the active render domain.
- Replaced the old `overlays.ts` render module with `translated-locales.ts`.
- Kept the surviving product operation surface deliberately small:
  - `listTranslatedLocales({ accountId, instanceId })`
  - `readTranslatedLocaleValues({ accountId, instanceId, locale })`
  - `writeTranslatedLocaleValues({ accountId, instanceId, locale, values })`
- Kept translated values inside Tokyo-owned instance content state for this slice. Roma/Bob never receive storage keys, overlay IDs, selected/current pointers, or inventory objects.
- Renamed Bob's translation preview state from `inventory` to `translatedLocales` so the client model matches the product operation.
- Updated Roma copy that still described translations as overlays.

## Verification

Green local verification:

- `pnpm --filter @clickeen/tokyo-worker test`
- `pnpm --filter @clickeen/tokyo-worker typecheck`
- `pnpm --filter @clickeen/bob test`
- `pnpm --filter @clickeen/bob typecheck`
- `pnpm --filter @clickeen/roma typecheck`
- `pnpm verify:prd103-db-pivot`
- `pnpm lint`
- `pnpm typecheck`
- `git diff --check`

Runtime vocabulary scan:

- No active Bob/Roma/Tokyo product path references overlay inventory, selected overlay pointers, overlay object operations, or overlay IDs.
- Remaining `overlays` text is limited to a public-serving negative test/guard that rejects public `/overlays/*` access, and legacy compact-id contract tests outside this translated-locale product boundary.

## Closure

This slice is green. The active translated-locale contract is now product-shaped: Roma and Bob ask Tokyo for translated locales and translated values by `{ accountId, instanceId, locale }`. Storage object identity is no longer a product API or client concept.
