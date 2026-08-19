# Widget Authoring Checklist

STATUS: CURRENT ARCHITECTURE AND TRANSITION OPERATOR SPEC

Use this checklist for Widget source, shared Widget capability, or Widget
documentation changes.

## Before Editing

1. Read `AGENTS.md` and every mandatory architecture/strategy document.
2. Read `documentation/services/bob.md`.
3. Read `documentation/services/roma.md`.
4. Read `documentation/services/tokyo-worker.md`.
5. Read `documentation/widgets/authoring/` and
   `documentation/widgets/shared/` completely.
6. Read the exact Widget operator spec.
7. Read only the exact Widget source authorized for this pass.

## Authority Gate

Before any edit, name:

```text
Product surface
Widget/Core owner
Shared capability owners, if any
Account/session coordinate
Storage coordinate
Route/API boundary
Runtime/deploy surface
Verification surface
```

Then answer:

1. Is this unique Widget behavior or presentation? It belongs in that
   Widget's Core.
2. Is this editable/operable state or copy? It belongs in the Widget's
   structured contract and exact adjacent copy owner: ToolDrawer labels for
   editor controls or `upsell/{locale}.json` for entitlement-denial context.
3. Can an existing shared capability do the work? Use it unchanged.
4. Is a shared capability genuinely missing for the current Widget flow? Prove
   the need before changing its owner.
5. Can that augmentation serve every applicable Widget through the same
   contract? If not, stop.
6. Would Bob, Roma, Tokyo-worker, Dieter, or shared runtime need to understand
   the Widget's identity, paths, or meaning? If yes, the boundary is wrong.

## Source Contract

For an authorized Widget, confirm:

1. Per-Widget `widget.html` and mandatory `core/core.html`, `core/core.css`, and
   `core/core.js` are present.
2. No flat `widget.css` or `widget.client.js` alternate path is present.
3. `spec.json`, `editable-fields.json`, `limits.json`, `discovery.json`, the
   exact adjacent `labels/en.json` ToolDrawer file, and `upsell/en.json` are
   present.
4. `widget.html` shows Stage/Pod/Shell/Header/Core composition; Core HTML owns
   the unique Widget structure, not shared implementations.
5. Core CSS owns unique presentation and consumes Dieter/shared tokens.
6. Core JavaScript owns the Widget's focused behavior.
7. Core JavaScript does not construct the first meaningful page, materialize,
   localize, validate, or host the instance, restate CSS, or orchestrate all
   shared services.

All five current Widgets satisfy this canonical source shape locally. Their
retired flat files have no alternate source or compatibility path.

## Structured Contract

1. Every unique Widget state path is declared in `spec.json`.
2. Every Widget-authored ToolDrawer word is a `$label:{key}` resolved by the
   exact adjacent English file.
3. Every customer-visible text path is declared in `editable-fields.json`.
4. Every repeatable translatable value has its stable item identity.
   The derived overlay coordinate must use those IDs, never an array index.
5. Every customer-facing entitlement binding maps its Widget coordinate to one
   generic system policy key and one exact Widget-local `messageId` through
   `limits.json`; it does not declare edit/load/Save/publish/serve enforcement
   contexts owned by the system capability.
6. Every referenced message identity resolves to one complete localized
   template in `upsell/en.json`; every template uses only the declared system
   placeholders and contains no hardcoded plan name, CTA, route, or fallback.
7. Stage, Pod, Header, Core-size, typography, localization, branding, and share
   use their shared contracts; Core does not create local substitutes.
8. Core and public package source contain no tier, limit-decision, denial, or
   upsell behavior.
9. Only shared Header and the primary Content section start open; other
   ToolDrawer sections use the collapsed default.

## Shared-Service Gate

If the pass changes a shared service:

1. State the concrete current Widget flow proving the generic gap.
2. Define one consumer-neutral contract.
3. Prove the contract has no Widget-name branch or semantic path knowledge.
4. Keep unique meaning in Core.
5. Keep all applicable Widgets on the same service lifecycle.
6. Do not add a second adapter, compatibility reader, or legacy fallback.

Bob is the shared editing service, not the Widget. Roma is the shared
current-account/materialization service, not the Widget. Tokyo-worker stores
and serves exact owner output; it is not a Widget interpreter.

## Closed-System Trust Gate

An owning ingress accepts raw human/browser/third-party input once. After a
named Clickeen authority emits a structured artifact, all downstream Clickeen
authorities trust it completely.

Confirm the change adds no downstream:

- semantic validator or schema comparison;
- ToolDrawer-control allowlist used as persistence schema;
- filtering of unrendered or unknown-to-the-consumer fields;
- normalization, coercion, sanitization, repair, or default injection;
- service-response shape guard for a Clickeen owner result;
- package/source fingerprint reconciliation used to re-prove materializer
  output;
- runtime probe or test dependency.

Authentication/authorization and raw external-input acceptance remain at their
owning ingress boundaries. A genuinely absent required owner result fails at
that owner and is never substituted.

## Materialization And Public Artifact

For the exact saved instance, verify:

1. Bob edits one complete logical shared-plus-Core state; Roma prepares its
   semantic config/content payloads, Tokyo writes one atomic
   `instance.source.json`, and Builder reopen
   recomposes every exact value.
2. New composes a non-persisted browser draft. First Save creates editable
   source and later Save updates it. Only explicit allowed Publish invokes
   Roma's materializer; Tokyo performs only physical source/package writes.
3. Bob opens and previews a never-published instance from deploy-built Widget
   software plus the one current draft. Builder open and Workspace perform no
   stored instance-package read, and public `runtime.js` contains no Bob editor
   protocol.
4. The instance folder contains exact `instance.source.json`,
   `serve-state.json`, and overlay topology with no alternate package/root.
   First Save writes unpublished serve-state first and source last; only the
   exact source key makes the instance visible. Published serve-state
   atomically contains status, `publishedAt`, and all three logical package
   members; the public file paths are not separate R2 objects.
5. `index.html` contains complete semantic base-locale Header and Core content.
6. Questions, answers, headings, links, names, and accessibility relationships
   are visible in raw HTML before JavaScript.
7. A requested non-base locale is applied from the exact trusted overlay into
   semantic HTML before response.
   Reordered content follows stable item identity; a newly added identity stays
   explicit untranslated source content until Generate Translations; a deleted
   identity has no current content slot.
8. `styles.css` contains complete shared and Core presentation.
9. `runtime.js` is mandatory Widget/shared visitor behavior, never an initial
   instance renderer or serving engine; Bob preview does not dictate the public
   package.
10. Disabling JavaScript does not remove initial public meaning.
11. Visitor requests do not compile Widget source, call Bob/Roma/models, or
   reconstruct content.

## Edit Boundaries

| Change | Owning source |
| --- | --- |
| Unique Core state or product behavior | Widget `spec.json` plus `core/` as applicable |
| Unique semantic markup | `core/core.html` |
| Unique presentation | `core/core.css` |
| Unique interaction | `core/core.js` |
| Widget ToolDrawer copy | `spec.json` label token plus adjacent English label file |
| Widget-context entitlement denial copy | `limits.json` message identity plus `upsell/{locale}.json` complete template |
| Customer-visible text coordinate | `spec.json` plus `editable-fields.json` |
| Customer-visible text in an HTML attribute | the Widget's authored element plus exact `data-ck-content-attribute` target on the stable content slot |
| Tier values, entitlement decision, and target plan | Existing generic account policy authority |
| Popup composition and system CTA | Roma using the trusted compiled Widget message contract and Dieter Popup |
| Shared Stage/Pod/Header/runtime capability | Existing source under `tokyo/product/widgets/shared/` |
| Generic editing capability | Bob compiler/control host plus Dieter when presentation is needed |
| Current-account Publish/materialization capability | Roma's existing generic Publish command/materializer boundary |

Do not move unique Widget work into a shared owner because it is convenient.

The compiler proves every limit-to-message reference before deployment. Bob
and Roma consume that complete Clickeen artifact without another runtime
validator, Widget-specific branch, generic-copy fallback, or message repair.

## Verification

For the current canonical all-Widget repository:

```bash
node scripts/widgets/generate-artifacts.mjs
node scripts/widgets/generate-artifacts.mjs --check
git diff --check -- tokyo/product/widgets documentation/widgets
```

Focused `--widget {widgetType}` generation and normal all-Widget generation use
the same universal compiler. The selector is build tooling, not runtime
compatibility.

Inspect raw materialized HTML and run the current browser behavior matrix. For
deployed truth, verify through Roma, Tokyo-worker, and `clk.live` or
`dev.clk.live` after an authorized release.

For every repeated translatable field, verify reorder/add/delete explicitly:
the same ID keeps its translation after reorder, a new ID stays untranslated
until Generate, and a deleted ID is absent. For attribute content, verify the
selected-locale response changes the exact authored attribute rather than the
element body.

Checks and V1-V8 are implementation/reconciliation evidence. They never
authorize runtime guards, validators, probes, equality checks, filters, or
repair paths. Correct the producing authority; consumers continue to trust its
output.

## Hard Stop

Stop when the authorized Widget change is complete. Do not inspect or redesign
another Widget merely because the shared structure makes it possible.
