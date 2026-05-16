# PRD 099 Execution Report

Status: Complete
Completed: 2026-05-15

## Intent

PRD 099 simplified Tokyo/R2 around one durable ownership model:

```text
tokyo-assets-dev/
  accounts/
  dieter/
  fonts/
  product/
  prague/
```

Only `accounts/` is runtime-managed account state. `dieter/`, `fonts/`, `product/`, and `prague/` are git-authored deploy roots. Widget software lives under `product/widgets/`. Accounts own instances and assets only. Public embed/render reads are account-scoped through `/widget/{accountPublicId}/{instanceId}` and `/renders/accounts/{accountPublicId}/instances/{instanceId}/...`.

## Slice Results

| Slice | Result |
| --- | --- |
| 099A | R2 inventory and evidence lock complete. |
| 099B | Git-authored deploy roots synced to R2. |
| 099C | Account runtime storage contract cut over to account public IDs. |
| 099D | Tokyo Worker public render routes cut over to account-scoped PBX routes. |
| 099E | Venice public PBX cut over to `/widget/{accountPublicId}/{instanceId}`. |
| 099F | Roma/Bob/Admin management plane converged on account instances/assets. |
| 099G | Admin account recreated as `00000001`; three real widget instances recreated. |
| 099H | R2 stale roots/private UUID folders deleted with restore manifest, rollback rehearsal, final inventory, and CI guardrails. |

## Final R2 State

Evidence: `evidence/099H__r2_inventory_final.json`

- Root inventory is exactly `accounts/`, `dieter/`, `fonts/`, `product/`, `prague/`.
- Stale root objects remaining: `0`.
- Private UUID account objects remaining: `0`.
- Admin account assets now live under `accounts/00000001/assets/`.
- Admin instances live under `accounts/00000001/instances/`.
- Widget software serves from `product/widgets/`.

## Operational Guardrails

- Root `pnpm lint` now runs `scripts/verify/prd99-storage-guard.mjs`.
- Active code paths are guarded against root `public/instances`, root `published/widgets`, root `/l10n/widgets`, private UUID account folders, account-owned widget paths, and legacy `wgt_` / `ins_` identifiers.
- Historical PRD/execution text is not part of the active product guard.
- Tokyo Worker no longer exposes the root `/l10n/*` route.

## Restore And Rollback Evidence

- Dry-run deletion plan: `evidence/099H__r2_cleanup_dry_run.json`
- Restore manifest: `evidence/099H__restore_manifest.json`
- Restore object bodies: `evidence/099H_restore_objects/`
- Rollback rehearsal: `evidence/099H__rollback_rehearsal_result.json`
- Delete result: `evidence/099H__r2_delete_result.json`

## Final Verification

- `pnpm --filter @clickeen/tokyo-worker test`: green
- `pnpm --filter @clickeen/tokyo-worker typecheck`: green
- `node --check tokyo/dev-server.mjs && bash -n scripts/dev-up.sh`: green
- `pnpm lint`: green
- `pnpm typecheck`: green
- `pnpm --filter @clickeen/venice test`: green
- Live route smoke: `evidence/099H__live_route_smoke.json`

## Archived Operator Tooling

One-time PRD99 operator scripts are archived under `scripts/` in this executed PRD folder and are not part of active product/deploy paths.
