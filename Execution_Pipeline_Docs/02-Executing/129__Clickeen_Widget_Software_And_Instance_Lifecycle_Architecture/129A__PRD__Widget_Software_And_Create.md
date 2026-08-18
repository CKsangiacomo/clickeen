# PRD 129A — Widget Software And Create

Status: **CLOUD-DEV DEPLOYED — OWNER QA PENDING**

Parent: `129__PRD__Clickeen_Widget_Software_And_Instance_Lifecycle_Architecture.md`

Owner: Clickeen product owner/architect

Date: 2026-08-17

## 1. Outcome

129A defines:

1. what every Clickeen Widget is as software;
2. what every Widget source folder must contain;
3. how a Widget declares its use of shared Clickeen capabilities;
4. how New, Duplicate, and Template choose starting truth; and
5. how every successful Create ends with one new unpublished editable instance
   opened in Bob.

129A does not define editing, Save, Publish, package generation, or public
serving. Those belong to 129B, 129C, and 129D.

Big Bang, Cards, Countdown, FAQ, and Logo Showcase all adopt this universal
contract in the local implementation.

## 2. Starting Implementation

The repository contains five Widget folders:

```text
tokyo/product/widgets/
  big-bang/
  cards/
  countdown/
  faq/
  logoshowcase/
```

Before this PRD 129 pass, each folder had the same flat shape:

```text
{widgetType}/
  spec.json
  editable-fields.json
  limits.json
  widget.html
  widget.css
  widget.client.js
  {widgetType}_tooldrawer_l10n_labels/
    en.json
```

The generator compiles Widget source into:

- a Bob editor artifact used to open and edit an instance; and
- a Roma materializer artifact used by the current package pipeline.

The flat source mixed responsibilities:

- `widget.html` mixes shared document composition with Widget Core structure;
- `widget.css` mixes the unique Widget presentation with the flat source
  convention;
- `widget.client.js` renders initial content, applies shared features, handles
  Bob preview updates, localizes content, and supplies visitor behavior;
- New and Duplicate generate public files before editing; and
- Duplicate does not open the duplicate in Bob.

These were the starting facts before the local all-Widget implementation. No
current Widget retains the flat source shape, and no compatibility architecture
reads both shapes.

## 3. Target Widget Source Folder

Every Widget uses this source shape:

```text
tokyo/product/widgets/{widgetType}/
  widget.html
  spec.json
  editable-fields.json
  limits.json
  discovery.json
  labels/
    en.json
  upsell/
    en.json
  core/
    core.html
    core.css
    core.js
```

Real Widget-owned support files may live beside the Core files when the Widget
actually uses them. A file is not added merely to satisfy a framework shape.

The following are mandatory for every Widget:

```text
widget.html
core/core.html
core/core.css
core/core.js
spec.json
editable-fields.json
limits.json
discovery.json
ToolDrawer en.json
upsell/en.json
```

`core.js` is mandatory. It may be small, but every Widget has an explicit,
agent-operable JavaScript owner for its unique behavior.

## 4. File Responsibilities

| Source | One responsibility |
| --- | --- |
| `widget.html` | The complete readable document composition used by this Widget: shared Stage, Pod, Shell, Header, and the Widget's Core location, plus the shared and Core source dependencies it uses |
| `core/core.html` | The Widget's unique content structure and content locations |
| `core/core.css` | The Widget's unique presentation |
| `core/core.js` | The Widget's unique behavior |
| `spec.json` | Widget identity, default state shape and values, and Bob editing declarations |
| `editable-fields.json` | Exact customer-content paths and stable array-item identities used for saved content and localization |
| `limits.json` | Bindings from Widget actions or state coordinates to generic system entitlement keys and Widget upsell message IDs |
| `discovery.json` | Internal description of what the Widget is, which customer-content parts matter to search and answer systems, and how those parts relate |
| `labels/en.json` | English product copy for the Widget-authored Bob controls |
| `upsell/en.json` | English Widget-context sentences for denied Widget-bound actions |

No file owns another authority's job.

## 5. `widget.html`, Shared Composition, And Core

Every Widget source folder contains its own `widget.html` so an agent can see
the complete document used by that Widget.

`widget.html` shows:

```text
Stage
  -> Pod
    -> Shell
      -> shared Header
      -> Widget Core
```

It also declares the shared CSS/JavaScript sources that the Widget uses and the
mandatory `core/core.css` and `core/core.js` sources.

Shared Stage, Pod, Shell, Header, typography, branding, social share, locale
switcher, and other system implementations remain shared. Their implementation
is not copied into the Widget folder. `widget.html` composes their standard
document locations and declares their use.

All unique Widget content structure, presentation, and behavior lives under
`core/`. Shared service application must not be moved into a renamed Core
client blob.

### 5.1 Approved HTML source contract

`widget.html` and `core/core.html` are standard Mustache HTML templates.

`widget.html` contains exactly one Core partial reference:

```mustache
{{> core}}
```

The Widget generator resolves that partial from the adjacent
`core/core.html`. Recursive Core includes are not part of the contract.

The exact instance state is the Mustache view. The reserved system rendering
context is a separate `ck` object. Its current fields are:

```text
ck.instanceId                 exact instance identity
ck.locale                     exact render locale
ck.previewMode                optional Bob preview mode
ck.discovery                  gated internal Discovery contract, or false
ck.shared.headerCtaNewTab     shared Header CTA placement fact
ck.shared.headerCtaNewWindow  shared Header CTA placement fact
ck.shared.localeSwitcherStage shared locale-switcher placement fact
ck.shared.localeSwitcherPod   shared locale-switcher placement fact
ck.shared.socialShareStage    shared social-share placement fact
ck.shared.socialSharePod      shared social-share placement fact
```

These are system rendering facts, not Widget editable state. No Widget adds
Bob session machinery or serving state to this object.

Branches controlled by `ck.previewMode` may add preview metadata, editing
affordances, or route preview interactions to Bob. They must never change
Widget-authored content or Core structure.

The HTML contract uses ordinary Mustache behavior:

- `{{path}}` for escaped text or attribute values;
- `{{{path}}}` for exact rich text already accepted by the owning editing
  boundary;
- `{{#path}}...{{/path}}` for truthy sections and repeated arrays;
- `{{^path}}...{{/path}}` for false or empty sections; and
- normal parent-context lookup inside nested repeated arrays.

For FAQ, `core/core.html` directly authors the section and question loops,
question/answer content locations, stable item IDs, accessibility references,
and the relationship between each question and answer. Layout mode is authored
as exact HTML data and ARIA attributes plus CSS/visitor behavior; the shared
materializer does not contain an FAQ conditional or path list.

The same template source is compiled once by the existing Widget generator and
carried in the existing Bob editor and Roma materializer artifacts. Bob renders
it with the current browser-memory draft. Roma renders it with the exact saved
source during allowed Publish. Visitor JavaScript never performs this initial
render.

This is a source/materialization contract, not a public runtime template
engine. No browser fetch, runtime template discovery, Widget registry, or
Widget-specific shared-service branch is added.

### 5.2 One source, two independent consumers

The same Widget software supports two separate product paths:

```text
Widget software + Bob browser-memory draft
-> temporary Bob preview

Widget software + exact saved instance + allowed Publish
-> Roma materializer
-> stored serving package
```

The deploy build includes the Widget software needed for preview in the
existing generated Bob editor artifact. That input is reusable Widget software,
not an account-instance package and not files read from Tokyo-worker's
`accounts/**` storage.

129B owns how Workspace consumes that software and draft. 129C owns how Roma
uses the same authored source contract to generate published files. Neither
consumer becomes the other.

## 6. Core Contract

Core is the actual Widget-specific software.

For FAQ, Core owns the product model and complete structure, presentation, and
behavior for:

- sections;
- optional section titles;
- questions;
- answers;
- list, accordion, and card/multicolumn layouts;
- FAQ links and deep links; and
- the semantic relationships between each question and answer.

Exact customized content values remain instance source. Core owns where and
how those values are expressed, not the customer's saved values themselves.

Core does not own:

- Stage, Pod, Shell, or Header implementation;
- Bob, Roma, Tokyo-worker, or Dieter behavior;
- account tier or policy decisions;
- Popup mechanics or commercial CTA behavior;
- localization storage;
- package generation; or
- public serving.

`core.js` owns unique FAQ behavior. It does not render the first meaningful
FAQ page from an empty shell, apply every shared system feature, host Bob, or
localize public content. Publish must receive enough authored Core structure to
generate complete HTML without using `core.js` as the initial renderer.

## 7. Structured Contracts

### 7.1 `spec.json`

The existing systemic editor contract remains the source of truth for:

- `widgetname` and display metadata;
- exact Widget defaults;
- canonical Content, Layout, Appearance, Typography, and Settings panels;
- shared editor clusters;
- Widget Core fields and conditions;
- presets; and
- stable-id normalization rules.

The current Bob compiler and Dieter control DSL remain the contract. 129A does
not replace them with another schema or duplicate every existing control rule
inside this PRD.

Shared Clickeen defaults are composed with the Widget's Core defaults once by
the existing generic compiler. The result is the complete default instance
shape used by New.

### 7.2 `editable-fields.json`

The existing contract remains:

```json
{
  "widgetType": "faq",
  "fields": [
    {
      "path": "faq.sections[].faqs[].question",
      "label": "Question",
      "role": "question",
      "type": "richtext",
      "arrayItemIdentity": [
        "faq.sections[].id",
        "faq.sections[].faqs[].id"
      ]
    }
  ]
}
```

The file declares customer-content ownership and identity. It does not become
a general Widget schema, DOM template language, or Bob allowlist for the rest
of the instance.

Each saved content entry keeps its concrete physical path and carries a stable
`identityKey`. Scalar keys combine Widget type, role, and field pattern.
Repeated keys additionally combine every declared `arrayItemIdentity` path and
stable ID. Translation overlays and materialized content slots use that stable
key, never the current array index.

FAQ retains these content families:

- Header title;
- Header subtitle;
- Header CTA label;
- section title;
- question; and
- answer.

### 7.3 ToolDrawer labels

The adjacent `labels/en.json` file keeps the existing strict label shape:

```json
{
  "widgetType": "faq",
  "locale": "en",
  "labels": {}
}
```

The build resolves every referenced Widget label once into the Bob editor
artifact. Bob does not fetch this file while editing.

### 7.4 `limits.json`

System policy owns tiers, entitlement values, enforcement timing, current and
target plans, and the commercial CTA.

`limits.json` owns only the binding between a Widget action/state coordinate
and a generic system capability, plus the Widget message used when that action
is denied.

Each customer-facing entry contains:

```text
kind
system capability key
Widget path or metric
messageId
```

Widget-authored enforcement timing is removed. No tier value, plan name,
pricing rule, Popup behavior, or CTA destination belongs in `limits.json`.

FAQ uses these exact bindings:

| System capability | Widget coordinate | `messageId` |
| --- | --- | --- |
| `branding.remove` | `behavior.showBacklink` | `branding.remove` |
| `widget.socialShare.enabled` | `behavior.socialShare.enabled` | `social-share.enable` |
| `embed.seoGeo.enabled` | `behavior.seoGeo.enabled` | `seo-geo.enable` |
| `items.group.small.max` | `faq.sections[]` count | `sections.max` |
| `items.group.medium.max` | `faq.sections[].faqs[]` per-section count | `questions-per-section.max` |
| `items.group.large.max` | `faq.sections[].faqs[]` total count | `questions-total.max` |

### 7.5 `upsell/en.json`

The approved FAQ source is:

```json
{
  "widgetType": "faq",
  "locale": "en",
  "messages": {
    "branding.remove": "Your current plan is {currentPlan}. Upgrade to {targetPlan} to remove Clickeen branding from this FAQ.",
    "social-share.enable": "Your current plan is {currentPlan}. Upgrade to {targetPlan} to enable social sharing for this FAQ.",
    "seo-geo.enable": "Your current plan is {currentPlan}. Upgrade to {targetPlan} to enable SEO/GEO optimization for this FAQ.",
    "sections.max": "Your current plan is {currentPlan}. Upgrade to {targetPlan} to add more sections to this FAQ.",
    "questions-per-section.max": "Your current plan is {currentPlan}. Upgrade to {targetPlan} to add more questions to this section.",
    "questions-total.max": "Your current plan is {currentPlan}. Upgrade to {targetPlan} to add more questions to this FAQ."
  }
}
```

The Widget owns only the complete contextual sentence. The system supplies
the exact current and target plan names and the CTA. Roma composes one shared
Popup; Dieter owns its mechanics.

Every `messageId` in `limits.json` must resolve exactly once. Missing or unused
messages fail the Widget build. There is no generic fallback sentence.

## 8. `discovery.json`

### 8.1 Purpose

`discovery.json` is internal Widget software. It tells the system:

1. what the Widget is;
2. its Clickeen-owned baseline Discovery defaults;
3. which exact customer-content paths carry its important meaning; and
4. how those content parts relate.

It is used by Roma's materializer during Publish. It is not user content, a Bob
editor definition, generated metadata, or a public runtime configuration.

### 8.2 Approved systemic shape and FAQ source

Every `discovery.json` uses only these top-level facts:

```text
widgetType
kind
baseline
parts
relationships
```

FAQ uses this exact source:

```json
{
  "widgetType": "faq",
  "kind": "faq",
  "baseline": {
    "title": "FAQ by Clickeen",
    "description": "Questions and answers published with Clickeen."
  },
  "parts": [
    {
      "id": "section-title",
      "path": "faq.sections[].title",
      "role": "grouping-heading",
      "identityPaths": ["faq.sections[].id"]
    },
    {
      "id": "question",
      "path": "faq.sections[].faqs[].question",
      "role": "question",
      "identityPaths": ["faq.sections[].id", "faq.sections[].faqs[].id"]
    },
    {
      "id": "answer",
      "path": "faq.sections[].faqs[].answer",
      "role": "answer",
      "identityPaths": ["faq.sections[].id", "faq.sections[].faqs[].id"]
    }
  ],
  "relationships": [
    {
      "kind": "answers",
      "from": "question",
      "to": "answer",
      "identityPaths": ["faq.sections[].id", "faq.sections[].faqs[].id"]
    }
  ]
}
```

`parts` name exact customer-content paths and their Widget-owned roles.
`relationships` connect part identities using the exact repeated-item identity
paths already owned by the Widget.

The generic render seam attaches a matching part and its related relationships
to each exact editable content slot only when the combined Publish Discovery
gate is enabled. Widget Core owns how those annotations become its unique
search/answer markup. The shared renderer does not branch on Widget type.

### 8.3 What does not belong in the file

`discovery.json` does not contain:

- account tiers;
- the **Enable SEO/GEO** state path or entitlement value;
- HTML tags, JSON-LD templates, meta-tag strings, or output syntax;
- materializer code;
- public routes;
- customer overrides; or
- Bob controls.

The shared system owns the tier rule and **Enable SEO/GEO** control. Roma's
materializer owns the generated technical output. 129C specifies that output.

### 8.4 Boundary

The approved source schema is universal and contains no FAQ logic in a shared
service. It does not approve an output template or SEO framework; 129C still
owns the exact generated technical output.

## 9. Shared Clickeen Capabilities

Every Widget uses shared Clickeen capabilities through the same compiled
contracts.

FAQ currently uses:

| Capability | Shared owner | FAQ declaration/state |
| --- | --- | --- |
| Stage and Pod | shared Widget foundation | `stage.*`, `pod.*`, shared appearance |
| Header and CTA | shared Widget foundation | `header.*`, `headerCta.*` |
| Core sizing | shared Widget foundation | `coreSize.*` |
| Typography and fonts | shared Widget foundation and account font service | shared roles plus FAQ section/question/answer roles |
| Fill, border, shadow, surface | shared Widget foundation and Dieter | shared appearance plus FAQ card/link/icon values |
| Locale switcher | shared Widget foundation | `localeSwitcher.*` |
| Branding backlink | shared Widget foundation and policy | `behavior.showBacklink` |
| Social share | shared Widget foundation and policy | `behavior.socialShare.*` |
| Customer-content localization | editable-fields contract, Roma, Translation Agent, Tokyo-worker | exact Header/section/question/answer paths |
| Assets | Roma account assets and Tokyo-worker storage | exact saved asset references selected through shared controls |
| Edit limits and upsell | system policy, Bob, Roma, Dieter | `limits.json` plus Widget upsell message |
| SEO/GEO | shared system policy plus Widget Discovery | `behavior.seoGeo.enabled`, `embed.seoGeo.enabled`, and internal `discovery.json` |

A Widget may use future connectors, integrations, CRM, or other Clickeen
capabilities through their same generic contracts. The capability does not move
into Core, and the shared service does not acquire a Widget-type branch.

## 10. Default Instance Truth

Every Widget has one complete default instance state produced by:

```text
shared Clickeen Widget defaults
+
Widget Core defaults from spec.json
```

This default is software truth. It is not copied into Bob, Roma, or Tokyo as a
second Widget-specific implementation.

The internal `discovery.json`, ToolDrawer labels, and upsell messages are
Widget software, not saved instance values.

The shared default instance state contains:

```json
{
  "behavior": {
    "seoGeo": {
      "enabled": false
    }
  }
}
```

The shared Settings control is named **Enable SEO/GEO**. This is one generic
saved coordinate used by applicable Widgets; it is not FAQ Core state.

## 11. Create Modes

### 11.1 New

Input:

```text
Widget type
+
Widget default instance state
+
account-owned shared Widget Defaults
+
new account instance identity
```

Output:

```text
new unpublished instance.config.json
+
new unpublished instance.content.json
+
unpublished serve-state.json
+
Bob opened on that exact instance
```

New does not invoke the materializer and creates no serving package.

### 11.2 Duplicate

Duplicate starts from the selected source instance's exact saved source and
creates a new instance identity.

It ends with the new unpublished duplicate opened in Bob. It never leaves the
user on the source instance or only refreshes an inventory list.

Duplicate does not invoke the materializer and creates no serving package.

The implemented generic Duplicate:

- copies the exact saved config and base content;
- creates a new compact instance identity;
- uses the destination account's current base locale;
- resets translated-field status to `ok`;
- preserves exact saved asset references already present in source;
- copies no locale overlay or public package;
- starts unpublished with no display name; and
- opens the duplicate in Bob.

### 11.3 Template

Template starts from a selected normal saved instance owned by the CLICKEEN
admin account, not from a new Widget source format. The list of those
admin-selected saved instances is the Template catalog.

It creates a new account-owned unpublished editable instance and opens it in
Bob.

The remaining product work is the cross-account Duplicate operation that reads
the selected CLICKEEN-admin source and writes the new customer-owned source.
Catalog listing and cross-account copy are follow-on implementation through the
existing account/instance authorities. They do not create a template table,
schema, source shape, storage root, or compatibility path. Account-owned asset,
locale, and overlay transfer behavior belongs to that explicit cross-account
copy implementation; it is not guessed by Create, Bob, or Serve.

## 12. Create Policy

New, Duplicate, and Template are available across all Widget types on Free.

A downgrade does not remove access to a Widget type, lock existing editable
instances, or delete their source. Create remains separate from the account's
published-instance capacity.

The former created-instance capability `widgets.instances.max` did not belong
in Create. The local implementation removes it from both the Create flow and
system policy; no current product action consumes it.

Public capacity is enforced later by `instances.published.max` when the user
clicks Publish. Edit-specific limits remain at their governed edit actions.

## 13. Create Handoff To Bob

Every successful Create mode completes only when Bob has opened the exact new
instance.

Bob receives:

- the new instance identity as session context;
- the exact complete editable instance state recomposed from config and
  content;
- the compiled Widget editor contract;
- the Widget software needed for preview;
- exact account policy and fonts; and
- the existing translation, Copilot, and account command setup.

Create completion is not an inventory refresh and does not depend on a saved
public package.

The exact source-only Bob preview mechanism is implemented under 129B. It uses
the canonical Widget input defined by the two source rules in Section 5.1 and
never falls back to a serving package.

## 14. All-Widget Migration Scope

Every current Widget moves from:

```text
{widgetType}/widget.html
{widgetType}/widget.css
{widgetType}/widget.client.js
```

to:

```text
{widgetType}/widget.html
{widgetType}/core/core.html
{widgetType}/core/core.css
{widgetType}/core/core.js
```

Each Widget's existing structured contracts remain and gain only the approved
`discovery.json`, `upsell/en.json`, and exact `limits.json` message bindings.

The migrations remove the flat `widget.css`, `widget.client.js`, and legacy
ToolDrawer-label paths. Each Widget's unique responsibilities move to its Core;
shared-system implementation stays shared. No alias or compatibility wrapper
remains.

Widget behavior and saved state remain unchanged except for explicitly
approved new shared capability state.

## 15. Pre-GA Repository Scope

The current all-Widget generator rebuilds Big Bang, Cards, Countdown, FAQ, and
Logo Showcase from the same canonical source contract. Its generic
`--widget <widgetType>` selector supports focused local generation through the
same compiler and contains no Widget condition or old/new source discriminator.
The selector is build tooling, not a production compatibility workflow. No
runtime recognizes two Widget architectures.

## 16. Approved Changes In 129A

- define the universal Widget folder contract;
- add mandatory Core HTML/CSS/JavaScript ownership;
- add internal Discovery source;
- add Widget upsell source and limits message binding;
- make New source-only and remove its created-instance gate;
- make Duplicate source-only and open the duplicate in Bob;
- define the Template catalog as normal listed CLICKEEN-admin saved instances
  and keep cross-account duplication as its follow-on operation;
- remove Bob-open dependence on a stored serving package; and
- move every current Widget out of the flat Widget client shape.

## 17. Not In 129A

- Bob preview implementation;
- edit mutation and limit mechanics;
- Save implementation;
- Publish materialization;
- technical SEO/GEO output;
- package storage/replacement mechanics;
- public serving and locale-response mechanics;
- runtime validation machinery;
- migration of remote account instances or Widget Defaults;
- deployment.

## 18. Deployed Implementation Boundary

All five current Widget source compositions, focused and all-Widget generation,
Discovery, limit/message bindings, the shared SEO/GEO coordinate, upsell copy,
New, and Duplicate are implemented and deployed to cloud-dev.

Template creation is not an active product surface and the cross-account copy
was not implemented. Its architecture is settled: the catalog is a list of
normal CLICKEEN-admin saved instances and creation is a cross-account Duplicate
into one new unpublished customer instance. No template model, alternate
storage root, compatibility path, or fallback was added.

## 19. Local Verification Contract

- every current Widget source tree matches the approved universal contract;
- an agent can locate complete composition, Core HTML, Core CSS, Core
  JavaScript, defaults/editor declarations, customer fields, limits,
  Discovery, ToolDrawer copy, and upsell copy from each Widget folder;
- no current Widget `widget.css`, `widget.client.js`, or legacy ToolDrawer-label
  path remains;
- no shared service contains a Widget-specific branch;
- New writes source only and opens the exact new instance in Bob;
- Duplicate writes source only and opens the duplicate in Bob;
- no Create mode writes `index.html`, `styles.css`, or `runtime.js`;
- the generated Bob editor input contains the approved deploy-built Widget
  software needed for source-only preview and no instance serving package;
- Free Create is not limited by public capacity;
- existing Widget behavior and exact saved coordinates are preserved; and
- focused and all-Widget implementation checks plus the independent V1-V8
  audit pass.

## 20. Required Final V1-V8 Audit

| ID | Required result | Reason |
| --- | --- | --- |
| V1 | Pass | Implemented New/Duplicate/Discovery/composition truth is exact; the settled Template catalog uses normal admin saved-instance truth and its unimplemented cross-account copy receives no fallback. |
| V2 | Pass | Create copies approved starting truth without repair or coercion. |
| V3 | Pass | Every required Widget source responsibility and Create output has an owner. |
| V4 | Pass | Removing the wrong Create gate does not remove edit or Publish enforcement. |
| V5 | Pass | A source-only unpublished instance is explicit valid truth, not corrupt-package recovery. |
| V6 | Pass | Create completes only after the new source exists and Bob opens the exact new instance. |
| V7 | Pass | No renamed client blob, legacy branch, source-kind discriminator, or alternate Create path is approved. |
| V8 | Pass | Source checks and verification remain build/operator evidence only. |

This table states the required result. The independent post-implementation
audit is the implementation evidence.

## 21. Reconciliation State

```text
all five canonical Widget sources: present in cloud-dev
focused and all-Widget generated artifacts: present in cloud-dev
New source-only Create: present in cloud-dev
Duplicate source-only Create and Bob open: present in cloud-dev
Template catalog model: normal listed CLICKEEN-admin saved instances
Template cross-account Duplicate: not implemented
retired flat Widget source paths: removed from git and cloud-dev R2; exact URLs return 404
account product data: unchanged
stored positional-overlay Generate/delete cutover: pending
republish of affected pre-stable-slot public packages: pending
product commit: e2ac3589
main push: performed
deploy: cloud-dev Worker/R2 run 32087699030 and Bob/Roma Pages deployments passed
live product: cloud-dev active; owner QA pending
```
