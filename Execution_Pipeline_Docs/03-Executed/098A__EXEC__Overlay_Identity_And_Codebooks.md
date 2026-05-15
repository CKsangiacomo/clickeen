# PRD 098A - Overlay Identity And Codebooks

Status: Executed  
Parent: `Execution_Pipeline_Docs/01-Planning/098__PRD__Overlay_Primitive_And_Locales_First_Application.md`  
Owner: DEV + TPM  
Sequence: 1 of 6  

## Core Tenet: PRD 098 Truth Is The Only Truth

PRD 098 is a hard-cut refactor to the new overlay identity model. The existing handful of pre-GA account/widget/instance records must be renamed, moved, recreated, or deleted so they conform to PRD 098 truth.

The old product identity shape:

```text
uuid accountId + widgetType folder + ins_* instanceId
```

does not survive as a product/storage truth.

The surviving PRD 098 product/storage coordinate is:

```text
accountPublicId + widgetCode + compactInstanceId
```

No service may support both as active product truth. No compatibility bridge, redirect, mapping helper, fallback, dual reader, or old-path support is allowed. Existing pre-GA objects must be refactored to the new coordinate or discarded.

If execution finds old IDs or old paths still needed by a product flow, the fix is to move that product flow to PRD 098 truth, not to preserve the old truth.

## Purpose

Unblock PRD 098 by making `overlayId` a real SKU-like product object ID.

This slice does not build translation. It creates the identity contract that the rest of PRD 098 depends on:

```text
[account][widget][instance][language][experiment][personalization][version][checksum]
```

The account and instance segments must be real platform identity, not values derived from UUIDs or `ins_...` at overlay-write time.

## Product Outcome

Customers should not notice a feature change from this slice. The product outcome is architectural: every later overlay can be named, stored, selected, served, and debugged from its ID without Tokyo opening the overlay body.

For the user, this protects the simple product promise:

- open one account-owned widget
- edit it in Builder
- save it
- language overlays attach to that same widget without the system asking itself what it is looking at

## Non-Negotiables

- `overlayId` is the only overlay identity.
- No separate content-addressed overlay name exists.
- No runtime helper maps UUIDs or `ins_...` into overlay ID segments.
- No service implements its own checksum.
- No service parses overlay IDs by delimiter.
- No lowercase overlay ID characters.
- No compatibility identity bridge for old pre-GA IDs.
- Account and instance compact IDs are minted and stored once by their canonical owner.
- Existing UUIDs may remain private relational row keys where needed, but product/storage object identity for PRD 098 uses the compact IDs.

## Surviving Authorities

| Concern | Authority |
| --- | --- |
| Account compact ID | Berlin/Michael account record, exposed through account bootstrap and account authz capsule |
| Instance compact ID | Tokyo-worker account instance creation and duplicate paths |
| Widget codebook | Shared platform contract, validated against widget catalog |
| Language codebook | Shared platform contract, built from supported locale list and frozen for PRD 098 |
| Overlay ID layout/checksum | `@clickeen/ck-contracts` shared implementation |

## Architecture Decision

### Account identity

Add a first-class compact account ID to the account model.

Required DB shape:

```sql
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS public_id CHAR(8);

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_public_id_format
    CHECK (public_id ~ '^[0-9A-Z]{8}$');

CREATE UNIQUE INDEX IF NOT EXISTS accounts_public_id_unique
  ON public.accounts (public_id);
```

`accounts.id` may remain a UUID for private relational joins. `accounts.public_id` becomes the compact platform account identity used in overlay IDs and overlay-era storage keys.

This is not an overlay-specific mapping. It is a real account object ID.

Generation rule:

- Use the shared uppercase base36 platform ID generator from `@clickeen/ck-contracts`.
- Generate 8 characters using cryptographically secure random bytes.
- Insert with the unique index as the collision guard.
- On collision, retry generation before returning account creation.
- Backfill existing pre-GA accounts once in the migration.
- Never recompute `public_id` from `accounts.id`.

Runtime naming:

- `accountId` remains the private UUID where existing Berlin/Michael relational APIs still require it.
- `accountPublicId` is the compact account product/storage identity.
- Overlay-era Tokyo paths use `accountPublicId`, not UUID, when naming overlay coordinates.

### Instance identity

Change account instance creation so Tokyo-worker mints 10-character uppercase base36 instance IDs.

Current code:

```ts
return `ins_${crypto.randomUUID()}`;
```

Target behavior:

```text
^[0-9A-Z]{10}$
```

For PRD 098, pre-GA `ins_...` instances are not migrated. Product-owned seed/dev instances may be recreated. Any cloud-dev object that still requires `ins_...` is a cutover task, not a compatibility requirement.

Generation rule:

- Use the same shared uppercase base36 platform ID generator from `@clickeen/ck-contracts`.
- Generate 10 characters using cryptographically secure random bytes.
- Collision check against the target account/widget storage namespace before writing the instance.
- On collision, retry before returning create/duplicate.
- Never derive the compact instance ID from `ins_...`, UUID, display name, widget type, or timestamp.

### Widget codebook

Widget code is 3 uppercase base36 characters. It is a platform codebook value, not inferred from widget type.

Initial expected codes:

| widgetType | widget segment |
| --- | --- |
| `faq` | `FAQ` |
| `countdown` | `CTD` |
| `logoshowcase` | `LGS` |

The codebook must live in one shared contract. Widget catalog build must verify that every supported widget has exactly one code and that codes are unique.

Physical home:

- `packages/ck-contracts/src/overlay-identity.ts` owns ID layout, parser, builder, checksum, and platform ID generation.
- `packages/ck-contracts/src/overlay-codebooks.ts` owns widget and language codebooks.
- Other services import these files through `@clickeen/ck-contracts`; they do not copy constants.

### Language codebook

Language segment is 4 uppercase base36 characters. It is a platform Babel coordinate.

The first implementation must cover every account locale currently supported by `packages/l10n/locales.json`.

Rules:

- Codes are not generated by uppercasing locale strings at call sites.
- Codes are not guessed by individual services.
- Unsupported locale means the producer request fails before San Francisco is called.
- Base language can use the same codebook, but PRD 098 only writes non-base language overlays.

### Version and checksum

Version:

```text
00..99
```

Checksum:

```text
CRC-16/XMODEM over first 33 characters
modulo 1296
encode as two uppercase base36 chars
zero-padded
```

## New LOC Blast Radius

Expected new code is limited to:

- one Supabase migration for `accounts.public_id`
- one shared identity/codebook module pair in `@clickeen/ck-contracts`
- Berlin mint/backfill/expose plumbing for `accountPublicId`
- Roma account-context parsing for `accountPublicId`
- Tokyo-worker compact instance minting and validators
- focused tests for ID generation, parsing, checksum, and codebooks

New code must not include:

- a legacy ID adapter
- a UUID-to-overlay segment map
- a route framework
- a generic identity service
- a new package

## Deletion LOC Blast Radius

Expected deletions/replacements include:

- `ins_${crypto.randomUUID()}` product instance minting
- validators or UI assumptions that require `instanceId` to start with `ins_`
- service-local overlay checksum or segment parsing if already introduced
- docs that describe `ins_...` as the product instance ID format

Do not delete unrelated UUID relational identity. UUIDs can remain private DB row keys until a separate PRD changes them.

## Service Blast Radius

### `packages/ck-contracts`

Add shared overlay ID contract:

- fixed segment offsets
- parser
- builder
- checksum
- codebook types
- validation errors with named reasons
- tests for valid IDs, invalid alphabet, invalid checksum, invalid widths, and version wrap inputs

Must not:

- expose a UUID compacting helper
- expose an `ins_...` compacting helper
- call any value a content address or fingerprint

### `berlin`

Account identity owner.

Affected surfaces:

- account creation/reconciliation path
- bootstrap state
- account authz capsule payload
- account-management account response shape if Roma reads accounts there

Berlin must mint `accounts.public_id` for new accounts and expose it to Roma. Pre-GA accounts missing `public_id` are backfilled by the Supabase migration. Berlin must not derive or repair `public_id` per request.

### `supabase/migrations`

Add the account public ID column and backfill current pre-GA accounts.

Backfill is acceptable because pre-GA data is not a public compatibility contract. It is not a dual-reader migration.

### `roma`

Roma must carry both:

- private relational `accountId` where existing Berlin routes still require UUID
- compact `accountPublicId` for overlay and Tokyo product object contracts

Roma must not compute compact IDs itself.

Affected surfaces:

- account bootstrap parsing
- current-account route context
- Tokyo product-control calls once PRD 098C starts
- later Roma save orchestration in PRD 098D

### `tokyo-worker`

Instance identity owner.

Affected surfaces:

- create account instance from defaults
- duplicate account instance
- route validators for account instance IDs
- R2 key builders for account instance storage after the hard cut
- published widget lookup path after compact instance cutover

Tokyo-worker must mint compact instance IDs and stop minting `ins_${uuid}` for new product instances.

### `bob`

No UI change expected. Bob must accept compact instance IDs in session payloads and routes through Roma.

### `venice`

No runtime behavior change expected until PRD 098F. Venice must not assume `instanceId` starts with `ins_`.

### `sanfrancisco`

No generation behavior change expected until PRD 098D. Contract types must accept compact account and instance IDs when they are passed by Roma.

## Implementation Steps

1. Add shared overlay ID parser/builder/checksum/codebook contract in `packages/ck-contracts`.
2. Add account public ID migration and backfill.
3. Update Berlin account creation/reconcile/bootstrap/capsule to persist and expose compact account ID.
4. Update Roma account context to carry compact account ID from Berlin.
5. Update Tokyo-worker instance minting to produce compact instance IDs.
6. Update route validators and local tests so compact instance IDs are accepted and `ins_...` is no longer minted on create/duplicate.
7. Validate widget and language codebooks in shared tests.
8. Update architecture docs only where identity behavior changed.

## UX And Product Notes

- Builder URLs may change for newly created pre-GA instances because instance IDs become compact.
- Existing cloud-dev instances can be recreated. Do not preserve them with a compatibility bridge.
- If a user opens an old `ins_...` URL during the hard cut, a clear "instance not found" is acceptable pre-GA. It must not be silently mapped.

## Documentation Updates Required

This slice is not done until these docs are updated or explicitly marked unchanged in the PR description with a reason:

- `documentation/architecture/CONTEXT.md`
  - Update `instanceId` and account identity language so PRD 098 product/storage identity uses compact account/instance IDs.
  - Remove or qualify statements that examples use `ins_...` as the active product instance ID format.
  - Add the rule that overlay IDs are SKU-like fixed-layout IDs and are parsed by shared contract only.
- `documentation/architecture/AccountManagement.md`
  - Document `accountPublicId` as first-class account product/storage identity beside private relational account UUID.
- `documentation/services/michael.md`
  - Document `accounts.public_id`, its uniqueness/format constraint, and that it is not derived from `accounts.id`.
- `documentation/services/berlin.md`
  - Document account creation/backfill exposure of `accountPublicId` through bootstrap/account authz payloads.
- `documentation/services/roma.md`
  - Document that Roma carries both private `accountId` and compact `accountPublicId`; Roma must not compute the compact ID.
- `documentation/services/tokyo-worker.md`
  - Document compact 10-character product instance IDs for new account instances and remove `ins_...` as current product minting behavior.
- `documentation/services/venice.md`
  - Update public identity examples so Venice no longer assumes `ins_...` instance IDs.
- `documentation/architecture/OverlayArchitecture.md`
  - Add the fixed overlay ID layout and the rule that no separate overlay content address/name exists.

## Verification Gates

This slice is not green until all pass:

```bash
pnpm --filter @clickeen/ck-contracts test
pnpm --filter @clickeen/ck-contracts typecheck
pnpm --filter @clickeen/berlin typecheck
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/tokyo-worker typecheck
pnpm typecheck
```

Required scans:

```bash
rg -n "compact.*uuid|uuid.*compact|ins_.*overlay|overlay.*ins_|valuehash|valueHash|overlayHash|contentHash" packages berlin roma tokyo-worker bob venice sanfrancisco tokyo/product/widgets
rg -n "ins_\\$\\{crypto\\.randomUUID\\(\\)\\}|ins_[0-9a-fA-F-]{36}" tokyo-worker roma berlin packages
```

Expected:

- no runtime overlay compacting helper
- no new code path deriving overlay ID segments from UUID or `ins_...`
- no service-local checksum implementation outside `@clickeen/ck-contracts`

## Stop Conditions

Stop immediately if:

- compact account ID is not available from Berlin account truth
- compact instance ID requires a mapping table from `ins_...`
- any service needs to inspect an overlay body to understand account/widget/instance/language
- any implementation introduces a second overlay identity

## Definition Of Done

- Compact account IDs are stored account truth.
- Compact instance IDs are minted by Tokyo-worker for product instances.
- Shared overlay ID builder/parser/checksum exists and is tested.
- All services consume shared contract.
- No overlay ID segment is derived from legacy IDs at write time.

## Execution Result

Executed locally on May 14, 2026.

What changed:

- Added shared compact ID and overlay identity contracts in `@clickeen/ck-contracts`.
- Added fixed-layout overlay IDs with shared parser/builder/checksum and codebooks for widget/language segments.
- Added account public ID storage/backfill and Berlin bootstrap/capsule exposure.
- Updated Roma to carry account public identity from Berlin instead of computing it.
- Updated Tokyo-worker product instance identity to compact 10-character IDs.
- Rewrote pre-GA Prague/demo instance references to compact instance IDs.
- Updated architecture and service documentation for PRD 098 identity truth.

Verification:

- `pnpm --filter @clickeen/ck-contracts test` -> 13 passed.
- `pnpm --filter @clickeen/ck-contracts typecheck` -> covered by `pnpm typecheck`.
- `pnpm --filter @clickeen/berlin typecheck` -> passed.
- `pnpm --filter @clickeen/roma typecheck` -> passed.
- `pnpm --filter @clickeen/tokyo-worker typecheck` -> passed.
- `pnpm typecheck` -> passed.

Scans:

- Product-path scan found no `overlayHash`, `valueHash`, `contentHash`, `ins_*` overlay derivation, or service-local overlay identity implementation.
