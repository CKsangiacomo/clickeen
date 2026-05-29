# PRD 105I - Admin Account Coordinate And Context Verification

Status: Active execution sub-PRD
Owner: Product + Architecture
Date: 2026-05-27
Parent: `105__PRD__Instance_Folder_Tenets.md`
Depends on: `105A__PRD__DB_R2_Operation_Authority.md`, `105B__PRD__Core_DB_Model_Verification.md`, `105C__PRD__Tokyo_Runtime_Boundary_Verification.md`, `105H__PRD__Execution_Verification_Protocol.md`

## Purpose

Verify the Clickeen/admin account coordinate and delete fake account-context behavior before Prague dogfoods public widgets.

This PRD extracts the surviving doctrine from PRD 104A and 104B under the PRD 105 reset.

The core rule:

```text
CLICKEEN is the one active compact account coordinate for Clickeen-owned showcase content.
No account behavior is derived from a magic account id.
```

## Source Documents Reviewed

This PRD extracts from:

```text
104__PRD__Prague_Dogfood_Boundary_And_Admin_Account_Coordinate.md
104A__PRD__Admin_Account_Coordinate_Migration.md
104B__PRD__Berlin_Roma_Account_Context_Cleanup.md
```

Those documents become historical planning evidence after this extraction. They must not remain active execution authority.

## Product Contract

The Clickeen/admin account coordinate is:

```text
CLICKEEN
```

`CLICKEEN` is an 8-character uppercase base36 compact account id. It is not:

- a slug;
- an alias;
- a vanity route;
- a redirect target;
- a special product mode;
- a platform capability.

`00000001` is historical evidence only. It must not survive as an alias, fallback, redirect, compatibility coordinate, or active account identity.

## Account Context Contract

Account context answers:

```text
which account is active?
```

It must not answer:

```text
is this account special because its id string matches CLICKEEN?
```

Delete or verify deleted:

- `isPlatform`;
- `accountIsPlatform`;
- fake `accountSlug` derived from compact id;
- fake display names derived from compact id;
- branches on `accountId === "00000001"`;
- branches on `accountId === "CLICKEEN"`;
- any replacement capability such as `isAdmin`, `isPlatformAccount`, `platformRole`, `accountCapabilities`, or `superuser` introduced only to preserve the old behavior.

If future work needs platform/admin capabilities, it must introduce a real policy/capability with a separate product reason. This PRD does not create it.

## Coordinate Cohesion Contract

Every active system must speak the same account coordinate for Clickeen-owned content:

| Boundary | Active language |
| --- | --- |
| Supabase | `accounts.id = "CLICKEEN"` |
| Berlin | account context emits the compact account id, without magic-id behavior |
| Roma | existing `accountPublicId` field carries the same compact account id |
| Tokyo | account-scoped operations authorize/read/write against `CLICKEEN` |
| R2 | active account folder is `accounts/CLICKEEN/` |
| Public serving | public URL coordinate is `/CLICKEEN/{instanceId}` |
| Prague data | page refs use `accountPublicId: "CLICKEEN"` when embedding Clickeen-owned widgets |

`accountPublicId` may remain as the current API/embed field name during cutover. It is not a second identity.

## Required Migration Sequence

If active runtime still uses `00000001`, the sequence is mandatory:

1. Delete fake Berlin/Roma account-context behavior first.
2. Copy source documents/assets from `accounts/00000001/` to `accounts/CLICKEEN/`.
3. Verify source config/content/assets are readable under `accounts/CLICKEEN/`.
4. Apply an append-only Supabase migration or reviewed data operation that moves active admin rows to `CLICKEEN`.
5. Republish/rematerialize public artifacts under `accounts/CLICKEEN/`.
6. Verify public serving works for `dev.clk.live/CLICKEEN/{instanceId}`.
7. Verify old `dev.clk.live/00000001/{instanceId}` returns `404` with no redirect or alias.
8. Tombstone/delete old `accounts/00000001/` keys only after CLICKEEN proof passes.

Supabase identity must not move before source documents exist at the new R2 coordinate.

## DB Verification

Old migrations may seed `00000001` on fresh rebuilds. Do not edit immutable historical migrations.

Active verification must prove zero current rows reference `00000001` in:

```text
accounts
users
account_invitations
instances
```

It must also prove admin account tier/status/locale policy, memberships, and admin-owned instances survived the move.

## R2 Verification

Active verification must prove:

- source keys formerly under `accounts/00000001/` exist under `accounts/CLICKEEN/`;
- `instance.config.json` and `instance.content.json` are readable for admin-owned instances;
- account assets used by admin-owned instances are readable under `accounts/CLICKEEN/assets/`;
- public generated files align with PRD 105 under each instance folder:

```text
index.html
styles.css
runtime.js
overlays/locales/{locale}.json when translated locale overlays exist
```

Do not prove the migration by creating default `{locale}.html`, `script.{locale}.js`, or operation-controller JSON.

## Blast Radius

Expected implementation areas:

```text
berlin/src/bootstrap/**
packages/ck-policy/**
roma/lib/**
roma/components/**
tokyo-worker/src/auth.ts
supabase/migrations/**
scripts/health/**
scripts/ops/**
tokyo/prague/pages/**/*.json
documentation/**
prague/README.md
Execution_Pipeline_Docs/02-Executing/**
```

Do not edit for this PRD unless a stop condition is raised:

```text
bob/**
sanfrancisco/src/**
dieter/**
tokyo/product/widgets/**
translation workflow runtime
```

## Drift Stop Conditions

Stop and revise if execution requires:

- adding `accountSlug`;
- adding vanity/alias routing;
- redirecting `00000001` to `CLICKEEN`;
- preserving both `00000001` and `CLICKEEN` as active product coordinates;
- hardcoding behavior on `CLICKEEN`;
- introducing replacement platform/admin capability without a separate PRD;
- changing customer account id generation;
- changing translation generation or materialization architecture to complete this migration.

## Verification Scope

This PRD is green only when active code/docs are checked for:

- no active account/auth context exposes `isPlatform` or `accountIsPlatform`;
- no fake `accountSlug` derived from account id remains in signed/auth account context;
- no active branch checks `accountId === "00000001"` or `accountId === "CLICKEEN"`;
- no active code treats `CLICKEEN` as special behavior;
- active Supabase state uses `CLICKEEN` and has zero current `00000001` references;
- active R2 source/public files use `accounts/CLICKEEN/`;
- old public `00000001` paths return `404` without redirect or alias;
- active Prague page refs use `CLICKEEN`;
- active docs teach `CLICKEEN` as the current compact coordinate and mark `00000001` historical only;
- runtime proof uses a fresh Berlin/Roma session or cleared auth cookies after capsule shape changes.

## Archive Decision For Source Batch

After this PRD is created, the 104 parent/admin-account/context docs must move to `03-Executed` as historical planning evidence with the rest of the 104 batch.

Required archive status:

```text
Historical planning evidence.
Surviving admin account coordinate and account-context doctrine extracted to PRD 105I.
Superseded by PRD 105/105A/105B/105C/105H/105I where conflicting.
```

## Non-Scope

This PRD does not:

- implement Prague dogfood page boundary cleanup;
- implement Prague locale behavior cleanup;
- implement translation workflow repair;
- choose a new operation ledger;
- implement zero-touch translation;
- implement automatic rematerialization;
- implement SEO/GEO locale pages.
