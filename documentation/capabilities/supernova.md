# Supernova Capability

STATUS: DIRECTIONAL CAPABILITY NOTE - NOT CURRENT RUNTIME CONTRACT

Supernova is a product direction for premium visual capability. It is not
implemented as a current runtime contract.

This page is intentionally directional. Do not use it to infer current routes,
storage paths, entitlement keys, widget schema, provider integrations, deploy
surfaces, or verification commands.

## Current Code Search Authority

| Claim to verify | Current source to inspect |
| --- | --- |
| Entitlement keys | `packages/ck-policy/src/registry.ts` |
| Widget software roots | `tokyo/product/widgets/` |
| Roma account widget routes | `roma/app/api/account/instances/**` |
| Tokyo public serving routes | `tokyo-worker/src/routes/clk-live-routes.ts` |
| Tokyo account storage domains | `tokyo-worker/src/domains/` |
| Agent homes | `agents/` |

## Current Runtime Truth

There is no current Supernova runtime contract.

Current system truth:

- no `supernova` entitlement key exists in `packages/ck-policy`;
- no `tokyo/supernova` or `tokyo/product/supernova` deploy root exists;
- no Supernova provider route exists;
- no Supernova R2 asset namespace exists;
- no Bob Supernova panel is current product truth;
- no Roma Supernova save/publish policy exists;
- no Tokyo-worker Supernova storage/serving path exists.

Widget software currently lives under:

```text
tokyo/product/widgets/{widgetType}/
```

Account runtime storage currently lives under:

```text
accounts/{accountPublicId}/
```

Any future Supernova implementation must follow current account/storage/product
law instead of inventing separate product coordinates, separate asset roots, or
parallel runtime authorities.

## Current Operator Rule

There is no Supernova operation to run today.

Operators must not:

- add a Supernova entitlement to docs without matching policy and runtime code;
- put Supernova files under a new storage root;
- call an image/provider/generation endpoint as if it were product-owned;
- add Bob or Roma UI language that implies a shipped Supernova capability;
- treat Prague or any other non-Tokyo-worker surface as the public Supernova runtime.

Current product work still goes through normal widget software, account instance
source/package files, Roma save/publish routes, and Tokyo-worker public package
serving.

## Direction

Directionally, Supernova means premium visual expression for Clickeen surfaces:
motion, advanced interaction, rich visual effects, and generated visual assets
where explicitly authorized.

The direction is valid. The implementation is not specified here.

Before Supernova can become current product truth, implementation must define:

- entitlement key and tier policy;
- widget schema/control contract;
- Bob editor controls;
- Roma save/publish enforcement;
- account-scoped storage paths;
- generated asset ownership and source authority;
- AI/provider execution boundary if generation is involved;
- public runtime loading rules;
- accessibility/reduced-motion behavior;
- performance budget;
- deploy path;
- verification commands.

## Guardrails

Future Supernova work must obey current architecture:

- agents operate structured artifacts;
- account data lives under `accounts/{accountPublicId}/...`;
- widget software lives under `product/widgets/{widgetType}/`;
- public runtime serves stored/generated artifacts and does not call models;
- no fallbacks or silent substitution;
- no unowned provider calls;
- no invented runtime roots without an owning authority.

## Verification

Current verification is negative:

| Claim | Current verification |
| --- | --- |
| Supernova entitlement exists | no key in `packages/ck-policy/src/registry.ts` |
| Supernova runtime exists | no Supernova route in `roma/`, `bob/`, `tokyo-worker/`, `agents/`, or `tokyo/product/` |
| Supernova storage exists | no Supernova account or product root in Tokyo-worker domains or `tokyo/product/` |
| Supernova widget schema exists | no Supernova widget contract under `tokyo/product/widgets/` |
| Supernova public serving exists | no Supernova-specific Tokyo-worker public serving contract; normal `clk.live` package serving still exists |

If Supernova is implemented later, replace this directional note with a current
operator manual only after the code, storage, policy, deploy, and verification
paths exist.
