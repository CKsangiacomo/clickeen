# Widgets Operator Manual

STATUS: CURRENT SYSTEM OPERATOR SPEC

This folder documents current Clickeen widget operation. Use it when changing
widget source, Bob editor controls, Translation Agent editable paths, the
presentation frame, Shell composition, or shared widget utilities.

Clickeen widget law:

- A Widget is software: its structured contract and mandatory unique Core
  HTML/CSS/JavaScript define what it is and does.
- Widget instances are saved account-owned widgets.
- Stage, Pod, Header, Bob editing, Roma account operations, materialization,
  localization, assets, connectors, Tokyo storage/serving, and future
  capabilities are shared Clickeen services.
- Every Widget uses a shared service through the same structured contract. A
  shared service may be augmented generically for all applicable Widgets, but
  it never gains Widget-specific meaning or branches.
- Account tiers, entitlement values, denial decisions, target plans, and
  upgrade CTAs are system-owned. Each Widget supplies only its exact
  capability/coordinate binding and complete localized context for explaining
  a denied Widget action.
- Every tier may use every Widget and retain editable instances. Public
  capacity is separate: `instances.published.max` applies only at Publish, and
  Free may publish and serve one instance.

Widget software lives in git:

```text
tokyo/product/widgets/{widgetType}/
```

Saved account instances live in Tokyo/R2 through Tokyo-worker:

```text
accounts/{accountPublicId}/instances/{instanceId}/
```

Bob is one shared editing service and edits one instance in browser memory.
Roma is one shared current-account/Save/Publish/materialization service. Tokyo-worker
stores and serves the exact artifacts supplied by those owners. Shared Widget
composition and capabilities live under `tokyo/product/widgets/shared/`.

The reusable Widget folder and the account instance are different authorities.
The folder authors software. One saved instance owns one complete logical state
containing its exact shared Header/Stage/Pod/capability values and its exact
Core values. Bob edits that complete state; only explicit allowed Publish asks
Roma's generic materializer to generate the served complete `index.html`,
complete `styles.css`, and mandatory `runtime.js`; Tokyo-worker only writes and
serves those exact files.

```text
Widget Core -> generic Clickeen capability
```

Never:

```text
shared Clickeen service -> Widget-specific semantics
```

Clickeen is a closed system of named authorities. An authority accepts
non-Clickeen input at the boundary it owns and emits one exact structured
artifact. Other Clickeen authorities trust and consume that artifact
completely. They do not revalidate, sanitize, normalize, repair, coerce,
filter, project it through an editor allowlist, compare it with a second
schema, or substitute another value. Verification proves authored contracts
outside the product path; it is never a runtime dependency.

## Agent Lookup Model

| Question | Owning source/service |
| --- | --- |
| What makes this Widget unique? | `{widgetType}/core/` |
| What state and ToolDrawer controls exist? | `spec.json` and adjacent English labels |
| What customer text can be translated? | `editable-fields.json` |
| What does the system know about this Widget for search/answer output? | internal `discovery.json` |
| What is entitlement-controlled? | `limits.json`, through generic system policy keys |
| What should a Widget-specific denial say? | `limits.json` message identity plus `upsell/{locale}.json` |
| How are all Widgets edited? | Bob once, through the same compiled contract |
| How is a draft previewed? | Deploy-built Widget software plus Bob's one browser-memory draft; never the stored public package |
| How are all Widgets saved? | Roma stores editable source through the same Save command |
| When are public files generated? | Only explicit allowed Publish invokes Roma's one Widget-neutral materializer |
| How are saved artifacts stored/served? | Tokyo-worker once, without Widget semantics |
| Who generates the served files? | Roma's Widget-neutral `@clickeen/ck-runtime-materializer` generates complete HTML/CSS/JavaScript on Publish; Tokyo-worker never generates Widget code |

## Operator Authority

| Concern | Authority |
| --- | --- |
| Widget software source | `tokyo/product/widgets/{widgetType}/` |
| Common defaults and shared control contracts | `packages/widget-foundation/src/` |
| Shared widget utilities | `tokyo/product/widgets/shared/` |
| Bob editor panels and controls | structural declarations in `spec.json.editor.panels[]`, adjacent `labels/en.json`, and `bob/lib/compiler*` |
| Dieter controls | `dieter/components/**` source |
| Customer-visible text paths | `editable-fields.json` |
| Widget capability-to-policy bindings | `limits.json` |
| Widget-context entitlement-denial copy | `upsell/{locale}.json` |
| Internal Widget Discovery declaration | `discovery.json`; Publish materializer is the only generated-output owner |
| Tier values, entitlement decisions, target plans, and upgrade actions | Roma/account policy |
| Published package materialization | Roma materializer invoked by the account Publish command |
| Saved widget instances | Tokyo-worker under `accounts/{accountPublicId}/instances/{instanceId}/` |

## Internal Discovery Contract

Every Widget's internal `discovery.json` tells Clickeen what the Widget is,
which exact customer-content parts matter to search and answer systems, and
which relationships connect those parts. It is authored Widget software, not a
user-customizable SEO form and not a public runtime configuration file.

The system baseline supplies the Widget title and description used by every
tier. Free and Tier 1 retain the Clickeen baseline. Tier 2+ account policy may
allow the user to turn on `Enable SEO/GEO`; when that exact saved value is on,
the explicit Publish materializer also expresses the declared important parts
and relationships in the generated semantic HTML. The toggle changes editable
source only until Publish. Save never generates or changes the served package,
and visitor requests never invoke discovery generation.

If Clickeen adds richer SEO/GEO product features later, they extend this
internal contract and the one Publish materializer. Bob, Core JavaScript, and
Tokyo-worker do not become SEO renderers.

## Limits And Composed Upsell Experience

Limits are generic system policy, not Widget policy. The account tier matrix
owns the exact entitlement value. A Widget's `limits.json` binds one of its
unique coordinates to that generic policy key and references one exact
Widget-local message identity. The matching `upsell/{locale}.json` owns a
complete localized popup-body template that explains the denied action in the
Widget's vocabulary.

Ownership remains partitioned even though the user sees one Popup:

| Popup input | Owner |
| --- | --- |
| Current plan and exact target plan | Account policy |
| Denied capability and decision | Account policy at the owning command/edit boundary |
| Contextual message template | Widget `upsell/{locale}.json` |
| Popup composition, system CTA copy, and CTA behavior | Roma |
| Popup mechanics and presentation | Dieter |

For example, FAQ may explain “add more questions,” while the system supplies
the exact `{currentPlan}` and `{targetPlan}` values. The Widget never hardcodes
plan names, selects the next tier, owns an upgrade route, or opens a Popup.
Roma never hardcodes an FAQ, Cards, Countdown, Big Bang, or Logo Showcase
message.

The compiler emits one complete trusted Widget artifact containing exact
limit-to-message bindings and exact locale templates. Bob uses that artifact
at its generic browser-memory edit boundary; Roma uses it when composing a
Widget-bound denial from Bob or from a Widget-editing surface hosted by Roma.
Ordinary Roma account commands such as first Save, Duplicate, Publish, upload,
or locale changes use system-owned contextual copy because they contain no unique
Widget meaning. Neither consumer revalidates the artifact or substitutes
generic copy. Missing or unused source identities fail authoring/build before
deployment; there is no runtime fallback.

This contract is product/editor UI only. Core and the saved/public Widget
package contain no tier, entitlement, denial, Popup, CTA, or upsell behavior.

`limits.json` describes capability consumption; it does not choose whether
enforcement occurs on edit, load, Save, publish, or serve. The shared system
capability owns that user-intent boundary.

Current local implementation: every built Widget has exact `limits.json`
message identities and `upsell/en.json`. Bob applies one decision before draft
mutation and sends Roma `{ capability, messageId, required }`; Roma selects the
first qualifying higher tier and opens one Popup. There is no compatibility
message, fallback copy, or second Save-time decision.

## Canonical Generated Package Law

Published account Widget packages are stored product bytes. Widget-local Core
source, selected shared Widget HTML/CSS/JavaScript, Widget identity, exact
saved state, and base locale are resolved only when explicit allowed Publish
asks Roma to materialize the package:

```text
index.html  -> complete semantic Header and Core content
styles.css  -> complete shared and Core presentation
runtime.js  -> mandatory Widget and shared visitor behavior
```

The exact saved state is one logical document and one atomic storage artifact:

```text
instance.source.json
-> source metadata + exact config + exact base-locale content
-> complete logical instance for Bob and Roma materialization
```

Shared state such as `header.*`, `stage.*`, `pod.*`, `coreSize.*`, shared
appearance/typography/chrome, and the Widget namespace such as `faq.*` all
belong to that instance. They are not persisted in the Widget source folder and
do not become separate Header/Stage/Pod instances.

New composes a browser-memory draft without persistence. First Save creates
editable source and later Save updates it. Neither creates public files. Roma
invokes the generic materializer only on explicit allowed Publish and generates
the required HTML/CSS/JavaScript. Tokyo-worker physically writes atomic source
or serve-state truth to
`accounts/{accountPublicId}/instances/{instanceId}/`; it does not compile or
render them.

Initial public content exists before `runtime.js` runs. Base content is
materialized into the published `index.html`; a requested non-base locale is
applied from the exact trusted overlay into semantic HTML before the response.
The browser does not create or localize the initial Widget.

Later widget software or shared runtime changes do not mutate already-stored
account package truth. They require a named account command or a future broad
re-resolution command with exact coordinates. Public serving must not compare
stored account package bytes to current widget source on visitor requests.

Physical storage is exact: First Save writes an unpublished `serve-state.json`
first and `instance.source.json` last; only the source key makes the instance
visible. Save/Rename each replace source once. Publish writes status,
`publishedAt`, and logical `{ indexHtml, stylesCss, runtimeJs }` together in one
atomic `serve-state.json`; the three public paths are not separate R2 objects.

This is a pre-GA cutover. After deployment, all legacy cloud-dev saved
instances require explicit source cutover or recreation; those retained as
public then require explicit Publish/Republish. There is no compatibility
reader or migration-on-read, and this documentation pass performed no remote
operation.

Dieter icon URLs and account asset references remain external delivery
references owned by their own roots. Dieter CSS and JavaScript do not.

Current local implementation: all five built Widgets use the canonical Core
topology, compiled-source Bob preview, non-persisting New plus source-only Save,
Publish-only
complete materialization, and Edge locale expression. The all-Widget generator
builds and verifies one artifact pair per Widget with no compatibility source
kind or Widget-specific materializer path.

Runtime code and generated artifacts prove local implementation truth. Product
QA, deploy, stored-package verification, and live cloud-dev proof remain
pending; deployed configuration and the serving surface separately prove live
product truth.

## Current Widgets

| Widget | Operator Spec | Source |
| --- | --- | --- |
| Big Bang | `widgets/big-bang.md` | `tokyo/product/widgets/big-bang/` |
| Cards | `widgets/cards.md` | `tokyo/product/widgets/cards/` |
| Countdown | `widgets/countdown.md` | `tokyo/product/widgets/countdown/` |
| FAQ | `widgets/faq.md` | `tokyo/product/widgets/faq/` |
| Logo Showcase | `widgets/logoshowcase.md` | `tokyo/product/widgets/logoshowcase/` |

## Folder Map

| Folder | Purpose |
| --- | --- |
| `authoring/` | Source-file contract, Bob/ToolDrawer controls, and widget execution checklist. |
| `shared/` | Presentation frame, Shell/Core contract, and shared runtime utility behavior. |
| `widgets/` | Per-widget operator specs for built widgets. |

## Shared Manuals

| Manual | Purpose |
| --- | --- |
| `authoring/WidgetFiles.md` | Structured Widget contract, Core source, transition state, and generated-package boundaries. |
| `authoring/ToolDrawerControls.md` | Bob panels, ToolDrawer fields, and Dieter controls. |
| `authoring/WidgetAuthoringChecklist.md` | Current execution checklist for widget edits. |
| `shared/ShellCore.md` | Presentation frame and Shell/Header/Core ownership, state paths, and DOM shape. |
| `shared/ShellUtilities.md` | Branding, social share, and locale switcher. |

## Folder Rules

This folder contains current operator truth only.

Do not put PRDs, planning docs, competitor research, screenshots, copied apps,
scraped pages, other-surface planning material, or unbuilt widgets in this
folder.

Research and planning material belongs under `Execution_Pipeline_Docs/`.

## Baseline Verification

Run after widget source or widget documentation changes:

```bash
pnpm validate:widgets
git diff --check -- tokyo/product/widgets documentation/widgets
```

For product behavior, verify through Roma/Bob/Tokyo-worker and the relevant
`clk.live` or `dev.clk.live` serving surface. Do not use local-only behavior as
proof of deployed product truth.
