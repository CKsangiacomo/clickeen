# Peer Review — 127A Page Source and Policy (CODEX)

Date: 2026-08-04

Reviewed document: `127A__PRD__Page_Source_And_Policy.md`

Status: **SUPERSEDED REVIEW REWRITTEN AFTER PRODUCT-OWNER DECISIONS**

## Final disposition after both reviews

The product owner resolved the three remaining execution questions:

1. This is pre-GA and has no product users. Roma Pages and Page routes may be
   unavailable while 127A–127E replace the obsolete Page model. No compatibility
   machinery is required or wanted.
2. The shared source contract is pinned to
   `packages/ck-contracts/src/page-source.ts`, exported as
   `@clickeen/ck-contracts/page-source`, and consumed directly by Roma and
   Tokyo-worker.
3. The internal operating profile is named **Tier99** (`tier99`). It is used
   only by exact account `CLICKEEN` for Admin/Ops work, is never sold or assigned
   through customer flows, and is not the account member role named `admin`.

With those decisions incorporated into 127A, this review's final verdict is:
**127A IS READY FOR ACCEPTANCE AND EXECUTION.** The GLM review remains useful as
a blast-radius inventory, but its old migration and compatibility findings do
not override the rewritten 127A.

This file replaces the earlier Codex review. The earlier version proposed
locale-lock machinery, several command contracts, compare-and-swap work, a
general Page-source migration, and a special Tier99 rollout. Those proposals
were not accepted and are not execution requirements.

## Product-owner decisions

1. **Create page does not create or save anything.** It opens a browser draft.
   No Page ID, Tokyo object, compiler call, or list row exists until the user
   explicitly chooses **Save**. Leaving a dirty draft uses the existing Dieter
   unsaved-changes confirmation.
2. **There is no three-contract product model.** The product has a browser
   draft and one saved Page source. Internal request types may exist where code
   needs them, but they are not separate product authorities.
3. **Account locale policy remains the locale authority.** 127A validates an
   ordinary Page against it on Save. It does not add a locale lock, scanner,
   cleanup workflow, or second locale lifecycle.
4. **Templates have no translations.** They retain reusable base source and
   its `baseLocale`, but no selected locale list or overlays. They cannot run
   Translation Agent, compile, or publish.
5. **There is no generalized legacy Page migration.** Confirmed disposable
   cloud-development Page data is deleted through the existing Page authority.
   If real customer Page data is discovered, execution stops for the product
   owner instead of inventing a migration.
6. **`pages.max` uses the existing policy system.** It is added to the normal
   registry, matrix, policy snapshot, server limit check, and structured
   upgrade response. No Page-specific meter or policy service is created.
7. **Tier99 is the internal Admin/Ops account tier.** Add it to existing tier
   types, matrices, consumers, schema, and tests with explicit values. Assign it
   only to exact account `CLICKEEN`; never expose it through customer sale or
   assignment flows. It is not inheritance, a member role, super-admin, a new
   runtime, or a special subsystem.
8. **Page persistence already has an authority.** Keep authenticated Roma Page
   routes → Tokyo-worker → the account Page source. Do not add another storage
   coordinator, registry, ledger, or direct R2 writer.
9. **Validation follows existing codebase rules.** Use current ID, locale,
   account, asset, policy, and strict-source validators. Add only Page-specific
   structural checks that the stored Page actually requires.
## Revised verdict

**GREEN FOR PRODUCT DIRECTION; EXECUTION STILL REQUIRES NORMAL ACCEPTANCE.**

The rewritten 127A is now bounded to four real changes:

```text
one strict Page/Page-template source contract
+ first-Save creation through Roma → Tokyo-worker
+ pages.max in the existing policy system
+ tier99 in the existing tier system
```

The rejected machinery has been removed from the execution plan. Later slices
remain responsible for compilation, publication, public serving, currency,
Page Builder, templates UI, and Catalog UI.

## Architecture review

### Correct

- A Page stores ordered same-account Instance references, not copied Instance
  source.
- Ordinary Pages use `baseLocale`, selected locales, and exact overlays.
- Templates use the same object authority but reject locale selections and
  overlays.
- Roma owns authenticated commands and account policy; Tokyo-worker owns Page
  source storage.
- `pages.max` and Tier99 extend current policy/tier authorities instead of
  creating parallel systems.
- Opening a draft is client state; explicit Save is the first mutation.
- Disposable legacy development data is removed rather than preserved through
  compatibility machinery.

### Required implementation discipline

- Make `isTemplate` a server-enforced discriminator. Ordinary Page routes
  cannot silently create or convert templates.
- Reject template payloads that contain selected locales or overlays; do not
  strip them during normalization.
- Reject translation and publication commands against templates at the server
  boundary.
- Count templates under the same saved-object limits as their ordinary object
  type. Because templates cannot publish, they do not consume publish limits.
- Add Tier99 explicitly wherever tiers are exhaustively enumerated and keep
  unknown tiers fail-closed.
- Delete replaced Page types and branches; do not retain an old/new dual reader.

## Product review

The customer behavior is now understandable:

```text
Create page
→ edit an unsaved draft
→ Save
→ one Page is created

Save as template
→ save the source
→ create one separately named base-source snapshot
→ no translations or publication state are copied

Use template
→ start an ordinary object
→ choose locales and translate later through normal account workflows
```

This keeps Widgets and Pages distinct while giving both the same clear
Your/My templates/Catalog model. It also prevents a template from pretending to
be a localized or public object before a customer creates and localizes their
own copy.

## Blast radius

127A must inspect and update only the current owners of these truths:

- shared Page source contracts and strict validators;
- Roma Page routes and Page draft activation in 127E;
- Tokyo-worker Page source validation/storage;
- `@clickeen/ck-policy` registry, matrix, and policy snapshots;
- Berlin, San Francisco, Roma, Admin/DevStudio, and shared contracts that
  exhaustively enumerate tiers;
- Michael/Supabase account-tier enum and the exact `CLICKEEN` account row;
- tests for the changed authorities;
- current documentation only after deployment.

The blast radius does not justify a Queue, Page database, migration service,
template registry, locale lifecycle, reservation counter, or policy adapter.

## Documentation required after deployment

- `documentation/architecture/CONTEXT.md`
- `documentation/architecture/Overview.md`
- `documentation/architecture/OverlayArchitecture.md`
- `documentation/capabilities/localization.md`
- `documentation/capabilities/multitenancy.md`
- `documentation/services/berlin.md`
- `documentation/services/michael.md`
- `documentation/services/roma.md`
- `documentation/services/tokyo-worker.md`

The docs must state explicitly:

- Create page is an unsaved browser draft until Save;
- ordinary Pages use account `baseLocale` plus exact overlays;
- templates retain base source and `baseLocale` but have no locale selections,
  overlays, or translations;
- `pages.max` is a normal entitlement;
- Tier99 is a normal additional tier with no new authority.

## V1–V8 review focus

- No locale, policy value, Page data, or tier is invented.
- Invalid Page/template source is rejected rather than repaired.
- No selected locale, overlay, placement, legacy Page ID, or tier consumer is
  silently omitted.
- Account, role, policy, locale, template, and tier checks fail closed.
- Corrupt source is never treated as a blank Page.
- Save, template creation, data deletion, deployment, and Tier99 assignment
  report their exact outcomes.
- No migration, compatibility, locale-lock, or special Tier99 machinery
  survives under another name.
- Normal Page behavior does not depend on tests, probes, or fixtures.
