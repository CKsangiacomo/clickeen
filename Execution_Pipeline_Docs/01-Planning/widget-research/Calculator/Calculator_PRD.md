# content.calculator — Calculator PRD

STATUS: PRD — DRAFT / NOT BUILT

Canonical competitor inventory: `Calculator_competitoranalysis.md` (this folder).
Governing contracts: `../WidgetBuildContract.md`, `../WidgetComplianceSteps.md`,
`../WidgetArchitecture.md`, `documentation/widgets/authoring/WidgetFiles.md`.

This PRD is the arbiter. Where the competitor analysis describes Elfsight's model
in Elfsight's vocabulary, this document rules in Clickeen's.

---

## 0) What this widget does

A Calculator lets a business publish an interactive computation — mortgage
payment, ROI, shipping cost, savings projection — where the visitor supplies
inputs and the widget returns one or more computed results plus a call to action.

It is the first Clickeen widget that accepts visitor input. Everything shipped to
date renders authored content only.

---

## 0.1) Types available (core framework)

Calculator ships **one Type: Standard** — a single form, one result panel, live
recomputation.

Why this matters:

- With one Type, the state model is fixed: `fields[] → calculations[] → results`.
- The variation axes inside the Type are **layout** (`side-by-side` / `stacked`)
  and **content** (which fields and formulas the author configures).
- A mortgage calculator and a tip calculator are the **same Type with different
  content**. They use identical controls and identical runtime. They are not
  Types, and they must not be modelled as an enum.

Named future Types, each requiring its own PRD because each changes the state
model rather than the data:

| Type | Why it is structurally different |
| --- | --- |
| `comparison` | Two parallel input sets and paired results — needs a second field collection and result pairing, not just a layout change |
| `stepped` | Fields revealed in stages with navigation — needs step grouping, progress state, and per-step validation |

Do not add `calculator.type` to state in scope one. A single-Type widget declares
no type enum, per FAQ's precedent.

---

## 0.2) How a user gets a working calculator

This is the product question, and it has three answers. The engine in §5 is only
one of them, and it is the one fewest users will touch.

### Path 1 — Start from a template (primary)

**Elfsight puts the template picker between "create" and the editor.** Clicking
Create Widget does not open an editor — it opens a full-screen **"Choose a
Template"** step. Verified end to end on 2026-07-31 by deleting a Calculator
instance and recreating it.

That step contains:

- a paged thumbnail grid, left rail, reading **"1 – 4 of 116"** — 116 templates
  for the Calculator app alone;
- category filters with counts — **Cost Calculators 32, Finance Calculators 30,
  Fitness & Health Calculators 17, Mortgage & Loan Calculators 16, Other
  Calculators 21**;
- a **live, interactive preview** filling the rest of the screen. The selected
  template is a working calculator: sliders move, dropdowns change, results
  recompute. The user tries it before committing;
- an explicit **"Continue with this template →"** commit, after which the editor
  opens fully populated — fields, calculations, header, results, and CTA all
  configured. Toast: *Widget "Untitled Calculator" was created.*

The app's empty state frames the same two paths in copy: *"Create a captivating
widget with the help of ready-made templates or configure a unique widget from
scratch."*

There is also a cross-app gallery at `dash.elfsight.com/templates` — **1,000+
templates** across all 95 apps, category-filtered and searchable, each card naming
its parent app. Applying from there is a query parameter at creation:
`/widget/{newId}?templatePid={templateId}`.

This is a platform pattern across every app, not a Calculator feature. It is the
single highest-leverage thing in their onboarding, and Clickeen has no
equivalent: today a user lands in Builder on factory defaults.

The Clickeen mechanism is the existing Clickeen-Owned Examples flow — no new
machinery:

```text
Clickeen authors each starter through Builder under the admin account CLICKEEN
-> product-owned files reference it as accountPublicId + instanceId
-> user copy creates a normal instance in the destination account
```

Per `FAQ_competitoranalysis.md`: *"Starter designs are just Clickeen-owned
instances users can clone (no separate preset system)."* There is no preset
system, no template registry, and no per-type defaults tree. A starter is an
ordinary saved instance.

What is **not** settled by that quote is *where the choice happens*. Copying an
instance is the storage mechanism; presenting a picker before the editor opens is
a Roma surface, and it does not exist. That is a platform decision beyond this
PRD — flagged in §17 — but a Calculator without it ships eight excellent starters
that nobody is shown.

The user picks **Construction Price Calculator**, gets working fields, ranges,
formulas, formatting and captions, and then changes labels, ranges, branding, and
the CTA.

Mechanism is the existing Clickeen-Owned Examples flow — no new machinery:

```text
Clickeen authors each starter through Builder under the admin account CLICKEEN
-> product-owned files reference it as accountPublicId + instanceId
-> user copy creates a normal instance in the destination account
```

Per `FAQ_competitoranalysis.md`: *"Starter designs are just Clickeen-owned
instances users can clone (no separate preset system)."* There is no preset
system, no template registry, and no per-type defaults tree. A starter is an
ordinary saved instance.

**This is the path the product is sold on.** Nobody buys a calculator widget to
write an amortization formula.

### Path 2 — Describe it and let an agent build it

The user types "monthly payment on a car loan with trade-in value" and an agent
produces the field set, formulas, formatting, and captions.

This is not a nice-to-have deferred feature — it is the second of three primary
entry points, and it is Elfsight's *first*. It is also the path Clickeen is best
positioned for: generating a `calculator.fields[]` + `calculator.calculations[]`
structure is a structured-output task against a schema this PRD already defines,
executed through San Francisco under an agent home.

It depends on §4 and §5 existing first. It does not depend on anything else.

### Path 3 — Build from scratch (escape hatch)

Add fields, name them, write formulas. This is §5 through §7. It is what makes
Paths 1 and 2 possible, and it is what covers the calculator Clickeen never
shipped a starter for.

### What this means for delivery

Path 3 is built first because the other two stand on it. But a release that ships
only Path 3 is not a product — it is a formula editor. The starter library (§14.1)
is part of scope one, not a follow-up.

---

## 1) Non-negotiables (architecture)

1. **Shell + Core.** Calculator is `Widget Shell + Widget Core`. `spec.json.defaults`
   authors Core only. Shell defaults come from `packages/widget-shell`. The banned
   list applies in full: no `header.*`, `headerCta.*`, `stage.*`, `pod.*`,
   `coreSize.*`, `localeSwitcher.*`, `appearance.headerCta.*`,
   `appearance.localeSwitcher*`, `appearance.podBorder`, `behavior.showBacklink`,
   `behavior.socialShare.*`, or Shell typography roles in this spec.
2. **Namespace is `calculator.*`.** No `core.*`. No generic root paths. The
   forbidden aliases (`button`, `cta`, `ctaText`, `ctaUrl`, `copy`, `headline`,
   `layout.variant`, …) are not used.
3. **The Core action button is Core state.** `calculator.action.*`. It is not
   `headerCta.*`. The shared Header CTA remains available and separate.
4. **`applyState(state)` is deterministic.** No timers, no randomness, no network,
   no healing. This is why `RAND` and `RANDBETWEEN` are excluded from the function
   set (§5.4) even though the competitor ships them.
5. **No string evaluation, ever.** Formulas are stored as a validated AST and
   walked by the runtime. No `eval`, no `Function`, no dynamic code construction.
6. **Visitor input is not widget state.** See §6.
7. **Fail-visible.** Invalid persisted state fails at its named boundary. Invalid
   visitor input is product behavior and is specified explicitly in §6.4 — it is
   not state healing.
8. **Five mixed panels only**: `content`, `layout`, `appearance`, `typography`,
   `settings`.
9. **Zero dead controls.** Every editor path has exactly one Binding Map row (§9).

---

## 2) Where the widget lives

```text
tokyo/product/widgets/calculator/
  spec.json
  editable-fields.json
  limits.json
  widget.html
  widget.css
  widget.client.js
```

Exactly six files. No widget-local helper files. Shared behavior stays in
`tokyo/product/widgets/shared/`.

`spec.json` requires `widgetname` (must equal the folder name), `displayName`,
and `description` as a **string** (may be empty). A missing `description` fails
tokyo-worker at module init with `widget_definition_description_missing`.

### 2.1 Registration outside the widget folder

Both generators auto-discover `tokyo/product/widgets/*/`, so Bob's editor, Roma's
catalog, and Tokyo-worker's definitions need no edits. Three files do, and all
three are blocking.

| File | Change | Failure if omitted |
| --- | --- | --- |
| `packages/ck-contracts/src/overlay-codebooks.ts` | add `calculator: 'CLC'` to `WIDGET_OVERLAY_CODES` — 3 chars, `^[0-9A-Z]{3}$`, unique | **tokyo-worker will not boot**: `widget_definition_widget_code_missing:calculator` at module init |
| `tokyo/roma/i18n/source/en/calculator.json` | new file; every key prefixed `calculator.`; `itemKey` needs plural forms: `"calculator.item": {"one":"Field","other":"Fields"}` | `pnpm build:i18n` fails |
| `tokyo-worker/src/generated/widget-definition-sources.ts` | regenerate **and commit** — it is generated but git-tracked | `pnpm validate:widgets` fails CI on drift |

Expected but not build-blocking, and silently skipped if forgotten:

| File | Change |
| --- | --- |
| `documentation/widgets/widgets/calculator.md` | new per-widget operator spec |
| `documentation/widgets/README.md` | add catalogue row |
| `documentation/widgets/shared/ShellCore.md` | add `calculator` → `calculator.*` to the Core namespace table |
| `bob/tests/run-typography-contract.ts` | hand-maintained `widgetTypes` array — **new widget is silently uncovered** unless added |
| `roma/tests/instance-package-fixtures.ts` | hand-maintained widget-type array |
| `e2e/widgets/prd106f-builder-certification.spec.ts` | certification entry plus a type-specific mutation branch — the largest per-widget test cost |
| `supabase/migrations/` | only if a curated/system instance is needed. `widget_type` is `text` with a format CHECK, not an enum |
| `prague/src/lib/widgetLabels.ts` | only with a marketing page; `resolvePragueWidgetLabelEntry` throws on unknown types |

Marketing pages: `tokyo/prague/pages/calculator/*.json` (Step 7.1), outside the
widget folder. Do not touch `prague/src/lib/blockRegistry.ts` — Prague page
blocks are an unrelated namespace that coincidentally shares some names.

---

## 3) Pre-Code Core Manifest

Required by `WidgetBuildContract.md` before any code is written.

```text
Widget type: calculator
Model classification: new-widget-namespace

Shell paths kept:
- header.* / headerCta.* / stage.* / pod.* / coreSize.*
- Shell typography roles: title, body, button, localeSwitcher
- localeSwitcher.* / shared appearance.* / shared behavior.*

Shared shell invariants:
- stage.canvas.mode defaults to "viewport" (Builder label: Full)
- pod.widthMode is "full"
- behavior.showBacklink bound to shared branding runtime
- behavior.socialShare.* bound to shared social-share runtime
- Settings uses the shared `settings-behavior` node

Core paths:            see §4
Legacy body paths:     none — no prior saved shape exists
Core DOM roles:        see §8
Panels:                see §7
Binding Map:           see §9
Editable fields:       see §10
Limits:                see §11
Typography:            see §12

Saved instance compatibility:
- New paths/roles added: all of calculator.* (new widget)
- Old saved state shape: none — this widget has never shipped
- Compatibility path: not applicable, stated explicitly per Step -0.25
- Old-state smoke payload: not applicable
```

---

## 4) Canonical state (`spec.json.defaults.calculator`)

### 4.1 Fields — visitor inputs

`calculator.fields[]`, stable `id`, ordered.

| Path | Type | Notes |
| --- | --- | --- |
| `.id` | string | stable, required, unique |
| `.token` | string | `^[a-z][a-z0-9_]{0,39}$` — the formula reference name |
| `.type` | enum | `slider` \| `number` \| `dropdown` \| `choice` \| `image-choice` \| `heading` |
| `.label` | string | translatable |
| `.helpText` | string (inline HTML) | translatable, sanitized |
| `.defaultValue` | number | seeds the visitor's initial value |
| `.min` / `.max` / `.step` | number | `slider`, `number` |
| `.options[]` | array | `dropdown`, `choice`, `image-choice`: `{ id, label, value, imageFill? }` — `label` translatable; `imageFill` is a fill (`image` mode) required when type is `image-choice` |
| `.format` | enum | `number` \| `currency` \| `percent` |
| `.currencyCode` | string | ISO 4217, when `format == currency` |
| `.decimals` | number | 0–6 |

`heading` is a structural row: `label` and `helpText` only, no `token`, no value,
excluded from evaluation.

### 4.2 Calculations — computed results

`calculator.calculations[]`, stable `id`, ordered.

| Path | Type | Notes |
| --- | --- | --- |
| `.id` | string | stable, required, unique |
| `.token` | string | same grammar as field tokens; the two namespaces are shared and must not collide |
| `.name` | string | translatable |
| `.expression` | object | **validated AST**, see §5 |
| `.showInResults` | boolean | |
| `.rank` | enum | `primary` \| `secondary` |
| `.format` / `.currencyCode` / `.decimals` | as §4.1 | |
| `.caption` | string (inline HTML) | translatable, sanitized |
| `.showDivider` | boolean | |

### 4.3 Results panel

| Path | Type |
| --- | --- |
| `calculator.results.title` | string, translatable |
| `calculator.results.footerHtml` | string (inline HTML), translatable |
| `calculator.results.showReset` | boolean |
| `calculator.results.resetLabel` | string, translatable |

### 4.4 Core action

| Path | Type |
| --- | --- |
| `calculator.action.enabled` | boolean |
| `calculator.action.label` | string, translatable |
| `calculator.action.href` | string |
| `calculator.action.openMode` | `same-tab` \| `new-tab` \| `new-window` |
| `calculator.action.style` | `primary` \| `secondary` |

### 4.5 Layout and surface

| Path | Type |
| --- | --- |
| `calculator.layout.arrangement` | `side-by-side` \| `stacked` |
| `calculator.layout.resultsPlacement` | `end` \| `below` (applies when `side-by-side`) |
| `calculator.layout.fieldGap` | number px |
| `calculator.appearance.formBackground` | fill (`color,gradient`) |
| `calculator.appearance.cardwrapper.*` | results card surface — radius / border / shadow / insideShadow |

Declaring `calculator.appearance.cardwrapper` (with `insideShadow`) auto-injects
the `&lt;singular&gt; surface` cluster into the appearance panel. Do **not** hand-declare
those fields.

### 4.6 UI labels and item key

```json
"itemKey": "calculator.item",
"uiLabels": { "core": { "singular": "Field", "plural": "Fields", "sizeCluster": "Calculator size" } }
```

### 4.7 Normalization

```json
"normalization": { "idRules": [
  { "arrayPath": "calculator.fields", "idKey": "id" },
  { "arrayPath": "calculator.calculations", "idKey": "id" },
  { "arrayPath": "calculator.fields[].options", "idKey": "id" } ] }
```

Core-namespace only. No Shell paths.

---

## 5) The expression contract

The single largest piece of new engineering, and the one no existing contract
covers. This section owns it explicitly.

### 5.1 Storage form

`calculator.calculations[].expression` is a **JSON AST**, never a string.

```json
{ "op": "div",
  "args": [
    { "op": "mul", "args": [ { "op": "ref", "token": "loan_amount" },
                             { "op": "ref", "token": "monthly_rate" } ] },
    { "op": "sub", "args": [ { "op": "const", "value": 1 },
                             { "op": "pow", "args": [ … ] } ] } ] }
```

Node kinds: `const` (`value`: finite number), `ref` (`token`: field or calculation
token), `add` / `sub` / `mul` / `div` / `pow` (`args`: exactly 2), `neg`
(`args`: 1), `fn` (`name`, `args`).

### 5.2 Where parsing happens

| Stage | Responsibility |
| --- | --- |
| Bob | Parses the author's typed formula for live preview and inline error display. Preview only. |
| **Roma save** | **Authoritative.** Re-parses, validates, and rejects the save on any error. The AST it stores is the one that ships. |
| Runtime | Walks the stored AST. Never parses. Never evaluates text. |

Rejecting at save is what makes this fail-visible at a named boundary rather than
a runtime surprise.

### 5.3 Validation rules — all reject the save

- Unknown token reference.
- Reference to a `heading` field.
- Cycle in the calculation dependency graph, including self-reference.
- Unknown function name.
- Wrong arity for a known function.
- Non-finite constant.
- Depth greater than 32 or more than 256 nodes.
- Token collision between a field and a calculation.

### 5.4 Function set

`MAX` `MIN` `SUM` (variadic, ≥1) · `ROUND` `ROUNDUP` `ROUNDDOWN` (value, digits) ·
`ABS` (1) · `IF` (condition, then, else) · `AND` `OR` (variadic, ≥2) · `NOT` (1) ·
`EQ` `NE` `GT` `GTE` `LT` `LTE` (2).

**`RAND` and `RANDBETWEEN` are excluded.** The competitor ships both; `applyState`
determinism forbids them. This is a deliberate divergence, not an omission.

`CONTAINS` is excluded from scope one — it implies string operands, and every
field type in §4.1 resolves to a number.

Division by zero, `pow` producing a non-finite value, and any operation yielding
`NaN` or `±Infinity` resolve to the **unavailable** result state (§6.4). They do
not throw and do not substitute a value.

### 5.5 Author-facing formula input — decision

Dieter has no formula control, and `WidgetBuildContract.md` stop conditions make
"needs a new Dieter primitive" a blocker unless the PRD owns it.

**Decision: scope one uses `textfield` for the expression**, with save-time
validation returning the exact parse error and offending position. The insert
menus for fields, calculations, and functions are named future scope requiring a
`formula-field` Dieter component under its own PRD.

Reasoning: this keeps scope one entirely inside existing contracts and ships a
working formula engine. The authoring affordance is a UX improvement over a
capability that already works, which is the right order.

---

## 6) Visitor input model

No existing contract covers runtime input. This section owns it.

### 6.1 The split

| Concern | Owner | Lifetime |
| --- | --- | --- |
| Field definitions, formulas, labels, formatting | authored state | saved in the instance |
| Visitor's entered values | runtime-local map, keyed by field id | the page view |

Visitor values are **never** written to widget state, never posted to Roma, never
persisted, and never leave the browser.

### 6.2 The two functions

```text
applyState(state)   renders form structure, labels, ranges, options, and seeds
                    each input from `field.defaultValue`. Deterministic. Never
                    reads visitor input.

recompute()         reads the runtime-local input map, evaluates the calculation
                    DAG in topological order, and writes only result nodes.
                    Never mutates authored state.
```

`applyState` resets visitor input to authored defaults — correct, because a state
update means the author changed the widget.

### 6.3 Evaluation order

Calculations form a DAG over field and calculation tokens. Topological order is
computed at save (and stored alongside the ASTs) so the runtime does not re-derive
it. Cycles are impossible at runtime because §5.3 rejects them at save.

### 6.4 Invalid or unavailable results

A result is **unavailable** when any input it depends on is empty or out of range,
or when evaluation produces a non-finite value.

An unavailable result renders its configured unavailable string (default `—`) in
place of the value, keeps its label and caption, and sets
`data-state="unavailable"` on the result node. It does not hide, does not show a
stale value, and does not substitute zero.

This is product behavior, not state healing.

### 6.5 Number formatting

`Intl.NumberFormat(runtimeLocale, …)` using the locale already delivered in the
`ck:state-update` payload, with `.format`, `.currencyCode`, and `.decimals` from
the field or calculation. Deterministic given a locale. No widget-local locale
tables and no locale fallback logic.

---

## 7) Editor panels

Five panels, mixed, Shell shared nodes before Core controls.

### content

1. `{ "kind": "shared", "id": "header-content" }`
2. Cluster **Fields** — `repeater` on `calculator.fields`, `index-token`
   `__INDEX__`, `label-path` `label`, add/remove/move labels from `itemKey`.
   Row template: `dropdown-actions` (type), `textfield` (label), `textfield`
   (token), `dropdown-edit` (help text), `valuefield` ×4 (default, min, max,
   step — `showIf` type `in` `["slider","number"]`), nested `repeater` on
   `.options` (`index-token` `__OPTION__`, `showIf` type `in`
   `["dropdown","choice"]`), `dropdown-actions` (format), `textfield`
   (currency code, `showIf` format equals `currency`), `valuefield` (decimals).
3. Cluster **Calculations** — `repeater` on `calculator.calculations`. Row
   template: `textfield` (name), `textfield` (token), `textfield` (expression),
   `toggle` (show in results), `segmented` (rank), `dropdown-actions` (format),
   `textfield` (currency code), `valuefield` (decimals), `dropdown-edit`
   (caption), `toggle` (divider).
4. Cluster **Results** — `textfield` (title), `dropdown-edit` (footer),
   `toggle` (show reset), `textfield` (reset label, `showIf` showReset isTrue).
5. Cluster **Action** — `toggle` (enabled) then `textfield` (label),
   `textfield` (href), `dropdown-actions` (open mode), `dropdown-actions`
   (style), each `showIf` enabled isTrue.

### layout

1. `{ "kind": "shared", "id": "header-layout" }`
2. `{ "kind": "shared", "id": "core-size" }`
3. Cluster **Form layout** — `choice-tiles` (arrangement),
   `dropdown-actions` (results placement, `showIf` arrangement equals
   `side-by-side`), `valuefield` (field gap).
4. `{ "kind": "shared", "id": "stagepod-layout" }`

### appearance

1. Cluster **Form** — `dropdown-fill` on `calculator.appearance.formBackground`,
   `fill-modes: "color,gradient"`.
2. `{ "kind": "shared", "id": "header-appearance" }`
3. `{ "kind": "shared", "id": "stagepod-appearance" }`

The `Field surface` cluster and the `Locale switcher` appearance cluster are
auto-injected. Do not declare them.

### typography

```json
{ "id": "typography", "shared": { "id": "typography", "roleLabels": {
  "fieldLabel": "Field label", "fieldHelp": "Field help text",
  "resultLabel": "Result name", "resultValue": "Result value",
  "resultCaption": "Result caption" } } }
```

### settings

`{ "kind": "shared", "id": "settings-behavior" }` only. The `Locale switcher`
settings cluster is auto-injected.

---

## 8) DOM contract

```text
[data-role="stage"]
  [data-role="pod"]
    [data-role="root"][data-ck-widget="calculator"]
      .ck-headerLayout
        .ck-header …
        .ck-headerLayout__body
          [data-role="calculator-body"][data-arrangement]
            [data-role="form"]
              [data-role="field"][data-field-id][data-field-type]
                [data-role="field-label"]
                [data-role="field-control"]
                [data-role="field-help"]
            [data-role="results"]
              [data-role="results-title"]
              [data-role="result"][data-result-id][data-rank][data-state]
                [data-role="result-label"]
                [data-role="result-value"]
                [data-role="result-caption"]
                [data-role="result-divider"]
              [data-role="results-footer"]
              [data-role="reset"]
              [data-role="action"]
```

Core lives inside `[data-role="pod"]`. Header is a sibling of
`.ck-headerLayout__body`, never reparented.

Required Shell classes on the wrappers: `ck-headerLayout` on the outer `<section>`,
`ck-header` on the `<header>`, `ck-headerLayout__body` on the Core container.

`widget.html` must load exactly four shared stylesheets (`header.css`,
`localeSwitcher.css`, `stagePod.css`, `socialShare.css`) plus `/dieter/tokens/tokens.css`
and `./widget.css`, and the thirteen shared runtime modules in order — `fill`,
`appearance`, `runtime`, `header`, `localeSwitcher`, `surface`, `typography-data`,
`typography`, `coreSize`, `stagePod`, `branding`, `socialShare`, `previewL10n` —
followed by `./widget.client.js`, all `defer`.

### 8.1 CSS variable contract

Three families. `widget.css` **consumes** them and never defines them.

| Prefix | Written by | Example |
| --- | --- | --- |
| `--typo-{varKey}-*` | `CKTypography` on the scope element | `--typo-result-value-size` |
| `--ck-cardwrapper-*` | `CKSurface.applyCardWrapper` | `--ck-cardwrapper-radius` |
| `--calculator-*` | `applyAppearanceVars` / `applyLayoutVars` | `--calculator-field-gap` |

Rules: declare Core-owned properties once on `.ck-calculator-widget`, seeded from
Dieter tokens. Always consume with a fallback —
`font-size: var(--typo-result-value-size, var(--fs-40));`. Dieter tokens only for
spacing, type, and radius; no raw px except structural minimums. Variant switching
via data attributes set by the client (`[data-arrangement]`, `[data-rank]`,
`[data-state]`), never class toggling. Neutralize the widget root — the Pod owns
chrome. End the file with
`[data-ck-widget='calculator'] [hidden] { display: none !important; }`.

One breakpoint: `900px`.

---

## 9) Binding Map

One row per editable path. Abbreviated to the Core rows; Shell rows are owned by
the shared modules.

| Path | Target | Mechanism | Implementation |
| --- | --- | --- | --- |
| `calculator.fields[]` | `[data-role="form"]` | deterministic DOM update | rebuild rows on signature change |
| `.fields[].label` | `[data-role="field-label"]` | DOM text | sanitized inline HTML |
| `.fields[].helpText` | `[data-role="field-help"]` | DOM html | sanitized inline HTML |
| `.fields[].type` | `[data-role="field"]` | data attribute | `data-field-type` |
| `.fields[].min/.max/.step/.defaultValue` | `[data-role="field-control"]` | element attrs | on the input/select |
| `.fields[].options[]` | `[data-role="field-control"]` | DOM update | option rebuild |
| `.calculations[]` | `[data-role="results"]` | deterministic DOM update | rebuild on signature change |
| `.calculations[].name` | `[data-role="result-label"]` | DOM text | |
| `.calculations[].expression` | `[data-role="result-value"]` | computed | evaluated by `recompute()` |
| `.calculations[].rank` | `[data-role="result"]` | data attribute | `data-rank` |
| `.calculations[].showDivider` | `[data-role="result-divider"]` | hidden attribute | |
| `.calculations[].caption` | `[data-role="result-caption"]` | DOM html | |
| `.results.title` | `[data-role="results-title"]` | DOM text | |
| `.results.footerHtml` | `[data-role="results-footer"]` | DOM html | |
| `.results.showReset` / `.resetLabel` | `[data-role="reset"]` | hidden + text | |
| `.action.*` | `[data-role="action"]` | attrs + text | `href`, `target`, `rel`, `data-variant` |
| `.layout.arrangement` | `[data-role="calculator-body"]` | data attribute | `data-arrangement` |
| `.layout.resultsPlacement` | `[data-role="calculator-body"]` | data attribute | `data-results-placement` |
| `.layout.fieldGap` | `[data-role="form"]` | CSS var | `--calc-field-gap` |
| `.appearance.formBackground` | `[data-role="form"]` | CSS var | via `CKAppearance` |
| `.appearance.cardwrapper.*` | `[data-role="results"]` | CSS vars | via `CKSurface.applyCardWrapper` |

---

## 10) Translation coverage (`editable-fields.json`)

Shape is validated by `readWidgetEditableFieldsContract`. `widgetType` must equal
`spec.widgetname`. Every field needs `path`, `label`, `type` (`string` |
`richtext`), `role`, `arrayItemIdentity`, `limits`. Array-backed text **must**
carry `arrayItemIdentity` so the Translation Agent can address the right item.
The three Shell rows are mandatory and verbatim.

```jsonc
{
  "widgetType": "calculator",
  "fields": [
    { "path": "header.title", "label": "Header title", "type": "richtext",
      "role": "title", "arrayItemIdentity": [], "limits": [] },
    { "path": "header.subtitleHtml", "label": "Header subtitle", "type": "richtext",
      "role": "body", "arrayItemIdentity": [], "limits": [] },
    { "path": "headerCta.label", "label": "Header CTA label", "type": "string",
      "role": "header-cta-label", "arrayItemIdentity": [], "limits": [] },

    { "path": "calculator.fields[].label", "label": "Field label", "type": "string",
      "role": "field-label", "arrayItemIdentity": ["calculator.fields[].id"], "limits": [] },
    { "path": "calculator.fields[].helpText", "label": "Field help text", "type": "richtext",
      "role": "field-help", "arrayItemIdentity": ["calculator.fields[].id"], "limits": [] },
    { "path": "calculator.fields[].options[].label", "label": "Option label", "type": "string",
      "role": "option-label",
      "arrayItemIdentity": ["calculator.fields[].id", "calculator.fields[].options[].id"], "limits": [] },
    { "path": "calculator.calculations[].name", "label": "Result name", "type": "string",
      "role": "result-name", "arrayItemIdentity": ["calculator.calculations[].id"], "limits": [] },
    { "path": "calculator.calculations[].caption", "label": "Result caption", "type": "richtext",
      "role": "result-caption", "arrayItemIdentity": ["calculator.calculations[].id"], "limits": [] },
    { "path": "calculator.results.title", "label": "Results title", "type": "string",
      "role": "results-title", "arrayItemIdentity": [], "limits": [] },
    { "path": "calculator.results.footerHtml", "label": "Results footer", "type": "richtext",
      "role": "results-footer", "arrayItemIdentity": [], "limits": [] },
    { "path": "calculator.results.resetLabel", "label": "Reset label", "type": "string",
      "role": "reset-label", "arrayItemIdentity": [], "limits": [] },
    { "path": "calculator.action.label", "label": "Action label", "type": "string",
      "role": "action-label", "arrayItemIdentity": [], "limits": [] }
  ]
}
```

**Not translatable, deliberately:** `token`, `expression`, `href`, `format`,
`currencyCode`, `decimals`, `min`, `max`, `step`, `defaultValue`, and
`options[].value`. Translating a token or an expression would break evaluation;
translating `value` would break the meaning of a selection.

Computed result values are not authored text and are not declared. They are
formatted at runtime per §6.5.

---

## 11) Entitlements and limits

| Key | Kind | Path(s) | Metric/Mode | Enforcement | Notes |
| --- | --- | --- | --- | --- | --- |
| `branding.remove` | flag | `behavior.showBacklink` | boolean (deny false) | load=ignore ops=reject publish=reject | reject gated edits/saves |
| `widget.socialShare.enabled` | flag | `behavior.socialShare.enabled` | boolean (deny true) | load=ignore ops=reject publish=reject | reject gated edits/saves |
| `items.group.medium.max` | limit | `calculator.fields[]` | count | ops+publish reject | free 9 / tier1 25 / tier2 50 |
| `items.group.small.max` | limit | `calculator.calculations[]` | count | ops+publish reject | free 3 / tier1 10 / tier2 25 |

All four keys already exist in `packages/ck-policy/entitlements.matrix.json`. This
PRD introduces **no new policy keys** and requests no matrix changes.

`limits.json` shape, validated by `parseLimitsSpec`. Note that `count` and
`count-total` metrics **require** `[]` in the path:

```jsonc
{ "limits": [
  { "kind": "flag", "key": "branding.remove",
    "path": "behavior.showBacklink", "mode": "boolean", "deny": false,
    "enforce": { "ops": "reject", "publish": "reject" } },
  { "kind": "flag", "key": "widget.socialShare.enabled",
    "path": "behavior.socialShare.enabled", "mode": "boolean", "deny": true,
    "enforce": { "ops": "reject", "publish": "reject" } },
  { "kind": "limit", "key": "items.group.medium.max",
    "path": "calculator.fields[]", "metric": "count" },
  { "kind": "limit", "key": "items.group.small.max",
    "path": "calculator.calculations[]", "metric": "count" } ] }
```

### 11.1 Where enforcement actually happens

Verified against runtime, and it does not match what the entitlement metadata
claims.

`evaluateLimits` has exactly **one** caller in the repo:
`validateAccountInstanceSavePolicy` in `roma/lib/account-instance-save-policy.ts`,
invoked from the instance PATCH save route and the duplicate route, both before
package materialization, both passing `context: 'publish'`.

**Bob does not enforce limits.** `applyWidgetOps` validates path segments, control
allowlisting, index range, and value types — it never reads `limits` or `policy`.
The `ops` and `load` contexts are never passed at runtime. The `enforce.ops`
value above is currently **inert**; it is written because it is the house
boilerplate, not because it gates anything.

Consequence for this widget: a free-tier author can add a 40th field in the
Builder and will be rejected at save, not at the moment of the op. That is
acceptable behavior but it is a worse authoring experience than the metadata
implies, and the spec should not claim otherwise.

Hard runtime caps, independent of tier: fields 1–40, calculations 1–20, options
per field 2–50. These are enforced by `assertCalculatorState` and by the editor
control `min`/`max` attributes, per the house rule that hard product cardinality
is declared in both places.

---

## 12) Typography roles

Five widget roles, each requiring an explicit `roleScales` entry because none is
a global role.

| Role | Label | Default size preset | Scale xs → xl |
| --- | --- | --- | --- |
| `fieldLabel` | Field label | `s` | 13 / 14 / 16 / 18 / 20 |
| `fieldHelp` | Field help text | `xs` | 11 / 12 / 13 / 14 / 16 |
| `resultLabel` | Result name | `s` | 13 / 15 / 17 / 19 / 22 |
| `resultValue` | Result value | `l` | 24 / 32 / 40 / 48 / 56 |
| `resultCaption` | Result caption | `xs` | 11 / 12 / 13 / 14 / 16 |

Shell roles `title`, `body`, `button`, `localeSwitcher` are inherited and not
redeclared. `resultValue` is a candidate for fluid display sizing on the same
basis as countdown's `timer` role.

---

## 13) Runtime requirements (`widget.client.js`)

IIFE, no exports, no module system. Registration and apply order, matching the
shipped countdown runtime exactly:

```text
window.CKWidgetRuntime.register('calculator', init)
runtime.bindStateUpdates('calculator', instanceId, handler, { requireWidgetName: true })

applyState(state, runtimeContext):
   1. assertCalculatorState(state)        fail-fast, no repair
   2. CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot, state.appearance)
   3. CKTypography.applyTypography(state.typography, coreScopeEl, roleMap, { locale, instanceId })
   4. CKHeader.applyHeader(state, widgetRoot)
   5. CKCoreSize.applyCoreSize(state.coreSize, coreEl)
   6. CKLocaleSwitcher.applyLocaleSwitcher(state, widgetRoot, { … })
   7. applyAppearanceVars(state)          CKAppearance + CKSurface.applyCardWrapper
   8. applyLayoutVars(state)              Core CSS vars and data-attributes
   9. renderCore(state)                   form + results DOM, seed inputs, then recompute()
  10. CKBranding.applyBacklink(widgetRoot, state)
  11. CKSocialShare.apply(widgetRoot, state, { instanceId, widgetType, widgetLabel, previewMode })
```

Typography role map — `varKey` drives the emitted CSS variable name:

```js
{ title: { varKey: 'title' }, body: { varKey: 'body' }, button: { varKey: 'button' },
  localeSwitcher: { varKey: 'locale-switcher' },
  fieldLabel: { varKey: 'field-label' }, fieldHelp: { varKey: 'field-help' },
  resultLabel: { varKey: 'result-label' }, resultValue: { varKey: 'result-value' },
  resultCaption: { varKey: 'result-caption' } }
```

Preview localization uses `CK_PREVIEW_L10N.loadLocalizedState` behind a monotonic
request-id guard so a slow locale load cannot overwrite a newer state.

If a required shared helper is absent, throw `[Calculator] Missing CK<Module>.<fn>`.
No local fallbacks. Every state read is asserted with an explicit
`[Calculator] state.<path> must be <type>` message.

Reads state from `window.CK_WIDGETS[instanceId]`. Never `window.CK_WIDGET`.

State assertion rejects: missing paths, wrong types, unknown enum values, invalid
AST node shapes, unknown tokens, out-of-range numerics. It does not repair.

Input handling is bound once per rendered form and calls `recompute()` only.
`recompute()` performs no DOM structure changes.

Reads state from `window.CK_WIDGETS[instanceId]`. Never `window.CK_WIDGET`.
Preview localization through `CK_PREVIEW_L10N`.

---

## 14) Scope

**In.** One Type (Standard). Six field types (slider, number, dropdown, choice,
image-choice, heading — five input plus one structural); calculations with the
§5.4 function set; primary/secondary result ranking; number/currency/percent
formatting; results title, footer, reset; one Core action; side-by-side and
stacked arrangement; the full Shell surface; **and the starter library in §14.1**.

### 14.1 Starter library (in scope one)

Elfsight ships **116 Calculator templates in five categories**. That is the bar
for a mature product, not a scope-one target. But their category split is the
useful signal, because it says what people actually publish:

| Their category | Count | Read |
| --- | --- | --- |
| Cost Calculators | 32 | service-business estimators — construction, cleaning, interior design, windows, renovation, car rental, events. Every one ends in Get a Quote / Book Now |
| Finance Calculators | 30 | business finance — ROI, margin, break-even |
| Mortgage & Loan Calculators | 16 | the classic lending set |
| Fitness & Health Calculators | 17 | consumer utilities — BMI, calorie, macro |
| Other Calculators | 21 | long tail |

The dominant pattern — 48 of 116 across Cost plus Mortgage & Loan — is a
**lead-generation estimator for a service business**. The buyer is a contractor
or agency who wants qualified enquiries, and the CTA is the point of the widget,
not an accessory to it.

Scope one ships **eight** Clickeen-owned instances authored under `CLICKEEN`,
weighted to that dominant pattern rather than spread evenly. Every one uses only
the §5.4 function set and the six field types — if a starter needs capability we
do not have, either the function set or the starter list is wrong, and it is
better to find that out while writing them.

| Starter | Category | Fields | Calculations | Exercises |
| --- | --- | --- | --- | --- |
| Mortgage payment | Mortgage & Loan | loan amount, rate, term (sliders) | monthly payment, total interest | `pow`, nested arithmetic, currency |
| Loan repayment | Mortgage & Loan | amount, rate, months | monthly payment, total repaid | same engine, simpler shape |
| Construction cost | Cost | area (slider), build type (dropdown), extras (multi-choice) | total, labour, materials | three results, dropdown-driven rates |
| Cleaning cost | Cost | area, cleaning type (choice), frequency (choice) | total per visit, monthly | two `choice` fields, `IF` |
| Interior design cost | Cost | room type, area, options (multi-choice) | total | multi-select summing into a total |
| Project quote | Cost | hourly rate, hours, package (image-choice) | subtotal, total | `image-choice`, strong CTA |
| ROI | Finance | investment, return | ROI %, net gain | percent formatting |
| Profit margin | Finance | revenue, cost | margin %, markup %, profit | percent and currency in one result set |

Dropped from the earlier draft of this list, and why: **tip**, **discount**, and
**savings growth**. All three are consumer utilities with no commercial intent,
and a business does not embed a tip calculator on its site to generate work.

Correction to an earlier reading in `Calculator_competitoranalysis.md`: a search
of the cross-app gallery returned only cost estimators, which suggested Elfsight
ships no consumer utilities. The in-app picker disproves that — Fitness & Health
is a 17-template category. The accurate statement is that consumer utilities
exist but are a minority, and the commercial estimators dominate.

Each starter also ships a title, per-field help text, result captions, and a
configured Core action. A starter with unlabelled fields and no captions teaches
the user nothing about what good looks like.

**Out of scope one, with reasoning.**

| Item | Why |
| --- | --- |
| `comparison` and `stepped` Types | change the state model, not the data; own PRDs (§0.1) |
| Formula insert menus | needs a `formula-field` Dieter component; own PRD |
| AI calculator generation (Path 2) | depends on §4 and §5 shipping first. Named as a primary entry point in §0.2, not a nice-to-have — it should follow immediately, under an agent-plane PRD |
| Conditional field/result visibility | second dependency graph on top of §5; land the evaluator first |
| Print / Download result | export surface; no contract covers it |
| Lead-capture form | a network action inside a widget; nothing authorizes it and `applyState` determinism forbids fetching |
| `RAND` / `RANDBETWEEN` | determinism (§1.4) |
| `CONTAINS` / string operands | every field type resolves to a number |
| Shareable result URLs | encodes visitor input into the address; distribution mechanic, own decision |

---

## 15) Delivery steps

Gated. Do not start a step until the previous one has its named evidence.

| Step | Work | Green evidence |
| --- | --- | --- |
| 1 | Expression AST + evaluator + validator as a pure module | unit tests over the §5.4 set, cycle and arity rejection, non-finite handling |
| 2 | `spec.json` defaults for all of §4 | `pnpm validate:widgets` passes; every §7 control path resolves in defaults |
| 3 | `widget.html` + `widget.css` per §8 | every runtime selector exists; Core renders at `coreSize.mode: auto` |
| 4 | `widget.client.js` — `applyState` and `recompute` | all §9 rows update visibly; branding and social-share smokes pass |
| 5 | Editor panels per §7 | zero dead controls; conditional rows reveal correctly |
| 6 | `editable-fields.json` + `limits.json` | validate:widgets; entitlement rejection verified at free tier **on save**, per §11.1 |
| 7 | Save-time formula validation in Roma | invalid formula rejected with exact error; valid AST stored |
| 8 | Registration (§2.1) | overlay code added; `calculator.json` i18n source with plural forms; `widget-definition-sources.ts` regenerated and committed; tokyo-worker boots |
| 9 | **Starter library (§14.1)** | all eight authored through Builder under `CLICKEEN`, published, and copy-tested into a second account; each renders correct results against hand-checked figures |
| 10 | Verification | full Step 8 battery from `WidgetComplianceSteps.md`, plus `pnpm build:i18n` |

Step 9 is a real gate, not a content chore. Authoring eight calculators through
the Builder is the first honest test of whether the authoring surface works —
if writing the mortgage formula in a `textfield` is painful for us, §17.1 is
answered, and it is answered before a customer finds out.

Step 8 is called out separately because two of its three items are silent
failures — the overlay code stops tokyo-worker from booting, and a missing i18n
source file fails a build most widget work never touches.

Step 1 is deliberately first and independent — the evaluator is the only genuinely
novel engineering, and it can be built and proven before any widget scaffolding
exists.

---

## 16) Risks

| Risk | Mitigation |
| --- | --- |
| Expression engine becomes an open-ended compatibility surface | closed function set, fixed in this PRD; additions require a PRD amendment |
| Authors write formulas they cannot debug in a plain textfield | save-time errors carry exact position and reason; insert menus named as next scope |
| Visitor input model leaks into saved state | §6.1 is explicit; review gate at Step 4 |
| Currency formatting expectations vary by locale | `Intl.NumberFormat` with the delivered runtime locale; no widget-local tables |
| Results panel becomes a lead-capture form by increment | explicitly out of scope, §14, and would require its own shared-surface PRD |

---

## 17) Open decisions

Two, both genuine forks rather than deferred work.

### 17.1

1. **Does `formula-field` get built as a Dieter component in scope one?** §5.5
   recommends no, and recommends shipping with `textfield` plus save-time
   validation. Building it in scope one is defensible if authoring quality is the
   priority over shipping the engine.

   Step 9 answers this empirically. If authoring the eight starters in a plain
   `textfield` is painful for the team that wrote the parser, it will be worse
   for a customer, and the recommendation flips.
2. **Does `resultValue` get fluid display sizing?** Countdown's `timer` role has
   it. It matters if the primary result is intended to be the visual anchor of
   the widget, which §7's `primary`/`secondary` ranking implies.
