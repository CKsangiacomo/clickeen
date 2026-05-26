# PRD 104B - Berlin Roma Account Context Cleanup

Status: Draft for execution planning
Owner: Product + Architecture
Parent: [PRD 104](./104__PRD__Prague_Dogfood_Boundary_And_Admin_Account_Coordinate.md)

## Purpose

Delete the current `isPlatform` account/auth context path and remove magic-id display/platform behavior from Berlin/Roma account context.

This PRD exists because the current code derives product behavior from a bootstrap account id:

```ts
name: accountId === '00000001' ? 'Clickeen Admin' : 'Personal'
slug: accountId.toLowerCase()
isPlatform: accountId === '00000001'
```

That is not product truth. It is a bootstrap artifact.

## Product Contract

After this PRD:

```text
Account identity answers: which account is this?
No account/auth context exposes the current isPlatform field.
No signed/account context exposes fake accountSlug as account truth.
No behavior is derived from accountId === 00000001 or accountId === CLICKEEN.
```

If future work needs platform capabilities, introduce explicit account policy/capability with a named product reason outside this migration.

If future work needs real account names/slugs, introduce account metadata with a named product reason outside this migration. The current PRD 103 account schema does not provide DB-backed `name` or `slug`, so this PRD must not pretend those values come from account data.

## Required Scope

Required behavior:

- The current `isPlatform` field is removed from the account/auth context path.
- Fake account display name and slug derived from account id are removed from the signed/account context path.
- Roma and `ck-policy` no longer require or parse the current `isPlatform` / `accountIsPlatform` field.
- Roma and `ck-policy` no longer require or parse fake `accountSlug` as account truth.
- No branch on `accountId === '00000001'` or `accountId === 'CLICKEEN'` survives.
- No replacement capability is introduced in this PRD.
- If a screen needs a temporary account label, it may render the compact account id as plain identity display. It must not mint a fake product name or slug.

## Account Context Shape Decision

104B deletes:

```text
BerlinAccountContext.isPlatform
RomaActiveAccount.isPlatform
RomaAccountAuthzCapsulePayload.accountIsPlatform
fake accountSlug in signed/auth account context
slug: accountId.toLowerCase()
name: accountId === '00000001' ? 'Clickeen Admin' : 'Personal'
```

104B must not introduce:

```text
isAdmin
isPlatformAccount
platformRole
accountCapability
accountCapabilities
adminRole
superuser
```

Account display metadata is blocked unless a real source exists. Before execution changes Berlin display-name fallback, execution must prove current account data provides name/slug. If not, remove `accountName/accountSlug` from the signed/auth account context and update Roma UI to avoid requiring them.

Do not preserve `accountSlug` as `accountId.toLowerCase()`. That is the same fake identity pattern in a softer form.

## Blast Radius

Expected implementation areas:

```text
berlin/src/bootstrap/state.ts
berlin/src/bootstrap/types.ts
berlin/src/bootstrap/capsule.ts
packages/ck-policy/src/authz-capsule.ts
roma/lib/account-authz-capsule.ts
roma/lib/current-account-route.ts
roma/components/use-roma-me.ts
roma/components/roma-account-context.tsx
roma/components/home-domain.tsx
roma/components/billing-domain.tsx
roma/components/usage-domain.tsx
roma/components/ai-domain.tsx
roma/components/assets-domain.tsx
roma/components/team-domain.tsx
roma/components/team-member-domain.tsx
roma/components/settings-domain.tsx
tokyo-worker/src/auth.ts
tokyo-worker/src/domains/render/translation-operations.test.ts
roma/**/*.test.ts
```

Implementation may touch adjacent Berlin/Roma account-context tests if required.

Do not edit:

```text
supabase/migrations/**
tokyo-worker/src/routes/**
prague/**
bob/**
sanfrancisco/src/**
dieter/**
```

## Execution Controls

- Delete the current `isPlatform` path. Do not re-source it from `CLICKEEN`.
- Do not introduce `isAdmin`, `isPlatformAccount`, `platformRole`, or any replacement capability in this PRD.
- If a real downstream product behavior breaks without `isPlatform`, stop and create a separate capability/policy PRD. Do not patch it locally with a new magic field.
- Delete fake `accountSlug` from signed/auth account context unless a real DB-backed account slug already exists.
- Do not derive account display name or slug from account id.
- Old Roma auth capsules may fail validation after the shape changes. Runtime proof must use a fresh Berlin/Roma session or cleared auth cookies.

## Capsule Shape Rules

Remove `accountIsPlatform` from:

```text
RomaAccountAuthzCapsulePayload
ck-policy normalization/validation
Berlin capsule minting
Berlin authz-version digest/hash input
Roma active account parsing
Tokyo/Roma test fixtures
```

Remove fake `accountSlug` from:

```text
RomaAccountAuthzCapsulePayload unless backed by real account metadata
ck-policy required capsule validation
Berlin capsule minting
Roma account context
Roma UI surfaces that render "Slug:"
destructive account confirmation logic if it depends on activeAccount.slug
```

`accountName` may survive only if it is backed by real account metadata. If no such source exists, remove it from the signed/auth account context and render account identity from `accountPublicId` where minimal display is required.

## Documentation Update Matrix

Active docs to update:

```text
documentation/services/berlin.md
documentation/services/roma.md
documentation/architecture/CONTEXT.md
documentation/architecture/Overview.md
documentation/capabilities/multitenancy.md
documentation/services/devstudio.md
documentation/architecture/AccountManagement.md
```

Required documentation changes:

- Berlin signed capsule docs must not describe `accountIsPlatform` as current authz truth.
- Roma docs must not require or parse `isPlatform`.
- Account docs must say display metadata is account data when it exists, never derived from compact id.
- Replace “platform-owned account” and “seeded platform-owned account” with “seeded Clickeen/admin account” or “Clickeen-owned example content.”

Historical docs allowed to retain old platform wording:

```text
immutable supabase/migrations/**
old executed evidence explicitly marked pre-104B
```

## Verification

Static checks:

```sh
rg -n "isPlatform|accountIsPlatform" berlin roma packages tokyo-worker -S
rg -n "accountId === '00000001'|accountId === \"00000001\"|accountId === 'CLICKEEN'|accountId === \"CLICKEEN\"" berlin roma packages tokyo-worker -S
rg -n "Clickeen Admin|slug: accountId\\.toLowerCase\\(|accountSlug|activeAccount\\.slug|accountContext\\.accountSlug" berlin roma packages tokyo-worker -S
rg -n "isPlatform|accountIsPlatform|isAdmin|isPlatformAccount|platformRole|accountCapabilities|superuser" berlin roma packages tokyo-worker -S
rg -n "isPlatform|accountIsPlatform|platform-owned account|seeded platform-owned|platform account" documentation berlin roma packages -S
```

Expected result:

- no active `isPlatform` / `accountIsPlatform` account/auth context field remains;
- no account-id magic branch remains;
- no fake `accountSlug` derived from account id remains;
- no active docs describe `isPlatform` / `accountIsPlatform` as current account context;
- no active docs describe the Clickeen/admin account as a platform capability.

Runtime proof:

```text
Berlin bootstrap returns account context without isPlatform/accountIsPlatform.
Roma accepts account context without isPlatform/accountIsPlatform.
Roma account pages render without slug/platform fields.
Roma Builder still opens an account-owned instance.
Tokyo/Roma capsule verification still succeeds with the reduced capsule shape.
Runtime proof uses a fresh Berlin/Roma session or cleared auth cookies.
```

## Acceptance

104B is complete when:

- the current `isPlatform` account/auth context path is deleted;
- Berlin no longer derives display/platform behavior from a hardcoded account id;
- no fake `accountSlug` derived from account id remains in signed/auth account context;
- Roma and `ck-policy` no longer require the current field;
- no replacement capability is introduced without a separate PRD;
- Roma account pages render without slug/platform fields;
- Tokyo/Roma capsule verification still passes with the reduced capsule shape;
- tests prove the real account path still opens.
