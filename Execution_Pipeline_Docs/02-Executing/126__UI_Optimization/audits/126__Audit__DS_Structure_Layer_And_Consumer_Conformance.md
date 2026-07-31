# 126 Design System Structure Layer And Consumer Conformance - Audit

Status: POINT-IN-TIME STATIC AUDIT (2026-07-31) - source inspection only; no
runtime evidence; no execution credit.

Scope: every stylesheet and inline style in Roma and Bob, measured against the
Dieter source inventory, to test the product law that consumers use the design
system as-is.

Authority boundary:

- Inspected: `roma/**`, `bob/**`, `dieter/**` source on disk.
- Not touched: account/session/storage/route/runtime/deploy authorities, product
  data, cloud-dev surfaces.
- Verification surface: local source inspection only. No browser, no screenshots,
  no rendered evidence.

This file reports findings. It does not define doctrine, propose a component
roadmap, or make scope decisions.

## Executive Current Reality

The consume-as-is law is holding for controls and failing for structure, and the
failure is caused by absence rather than indiscipline.

Dieter's inventory is 29 components and one layout. Every component is a control
or an overlay. There is no nav, card, panel, surface, page header, form grid,
drawer, app shell, or empty state. Consumers therefore have nothing to consume
for the structural half of a screen, and both Roma and Bob independently invented
one.

The consumer CSS itself is small, tokenized, and disciplined. This audit did not
find sprawl. It found a missing layer, one component living in an app instead of
the design system, and four places where a consumer patches a Dieter internal
from outside.

## Method

Reproducible from repo root:

```bash
find roma bob -name "*.css" -not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/.vercel/*"
rg -o 'style=\{\{' roma bob --glob '*.tsx' --glob '!node_modules' --glob '!.next'
rg -l '<style jsx' roma bob --glob '!node_modules'
find roma bob -name "*.module.css" -not -path "*/node_modules/*"
ls dieter/components/ dieter/layouts/
```

## Finding 1 - The consumer CSS surface is small and tokenized

| Measure | Roma | Bob |
| --- | --- | --- |
| Stylesheets | 1 (`roma/app/roma.css`, 541 lines) | 1 (`bob/app/bob_app.css`, 529 lines) |
| CSS modules | 0 | 0 |
| styled-jsx blocks | 0 | 0 |
| Inline `style={{}}` | 13 across 5 files | 19 |
| `!important` | 1 (`[hidden]` guard) | 1 (`[hidden]` guard) |

Token usage is the norm in both files: `var(--space-N)`, `var(--role-*)`,
`var(--control-radius-*)`, `var(--control-size-*)`, `var(--duration-*)`,
`var(--easing-*)`. Logical properties (`padding-inline`, `margin-block-end`,
`inset-inline`) are used consistently.

Implication: any remediation framed as "delete the consumer CSS sprawl" is
aimed at a problem this audit could not find.

## Finding 2 - Dieter has no structure layer

`dieter/components/` (29, excluding `index.ts` and `shared/`):

```text
agent-activity  bulk-edit       button          choice-tiles    command-activity
dropdown-actions dropdown-border dropdown-edit  dropdown-fill   dropdown-shadow
dropdown-upload icon            menuactions     object-manager  operational-field
operational-table popaddlink    popover         popup           repeater
segmented       slider          table           tabs            textedit
textfield       toggle          tooltip         valuefield
```

`dieter/layouts/`:

```text
main-container
```

Every component above is a control or an overlay. The design system owns what
goes inside a screen and owns almost nothing about the screen.

Absent from the system: nav, card, panel/surface, page header, section header,
form grid, field wrapper, drawer, app shell, code block, empty state.

## Finding 3 - Two independent structural vocabularies

Because Finding 2 leaves structure unowned, each consumer authored its own.

Roma (`roma/app/roma.css`):

| Class family | Lines | Role |
| --- | --- | --- |
| `.roma-nav` + 8 children | 19-123 | App navigation, brand, links, subnav, footer, signout |
| `.roma-page-heading` | 125-131 | Page header |
| `.rd-canvas-module` | 177-189 | Content surface |
| `.roma-module-surface` | 204-214 | Content surface |
| `.roma-card` | 408-430 | Card |
| `.roma-codeblock` | 432-449 | Code block |
| `.roma-toolbar` | 451-465 | Toolbar |
| `.roma-form-grid`, `.roma-field` | 493-504 | Form layout |
| `.roma-grid`, `.roma-grid--three` | 399-406 | Grid layout |

Bob (`bob/app/bob_app.css`):

| Class family | Lines | Role |
| --- | --- | --- |
| `.builder-app` | 21-32 | App shell |
| `.editor-content` | 34-42 | Two-pane layout |
| `.topdrawer` + 10 children | 60-90, 155-209 | Top bar |
| `.tooldrawer` | 211-221 | Side panel |
| `.tdheader`, `.tdcontent`, `.tdmenu` | 223-252 | Panel structure |
| `.tdmenucontent` + 15 children | 254-375 | Panel content |
| `.workspace` + 12 variants | 415-529 | Canvas surface |

Two applications, two complete structural vocabularies, zero shared terms. Neither
app is at fault for this; there was no shared vocabulary available to either.

## Finding 4 - `tdmenucontent` is a shared component living in one app

`roma/components/widget-defaults-builder-controls.tsx` renders Bob's
`tdmenucontent` markup. Bob's stylesheet does not load in Roma. The component's
CSS was therefore copy-pasted into Roma, scoped under
`.widget-defaults-builder-fields`.

Duplicated rules, verbatim bodies:

| Rule | Bob | Roma |
| --- | --- | --- |
| `.tdmenucontent__cluster` | `bob_app.css:317-321` | `roma.css:303-307` |
| `.tdmenucontent__cluster-header` | `bob_app.css:331-338` | `roma.css:317-324` |
| `[data-collapsed='true']` header variant | `bob_app.css:340-342` | `roma.css:326-328` |
| `.tdmenucontent__cluster-toggle .diet-btn-ic__icon` | `bob_app.css:344-346` | `roma.css:330-332` |
| collapsed toggle rotate | `bob_app.css:348-350` | `roma.css:334-336` |
| `.tdmenucontent__cluster-body` | `bob_app.css:352-356` | `roma.css:338-343` (merged with `__group`) |
| `.tdmenucontent__cluster-body[hidden]` | `bob_app.css:358-360` | `roma.css:345-347` |
| `.tdmenucontent__group-label` | `bob_app.css:368-371` | `roma.css:349-352` |
| `.tdmenucontent__cluster-label` | `bob_app.css:373-375` | `roma.css:354-356` |

Two further rules are equivalent rather than verbatim: the cluster margin rules
at `bob_app.css:323-329` and `roma.css:309-315` share bodies but differ in parent
selector (`.tdmenucontent__fields` vs `.widget-defaults-builder-fields`). Roma
also merges Bob's separate `__cluster-body` and `__group` rules into one grouped
selector. The copies have already begun to diverge structurally.

A change to this component's appearance currently requires two edits in two
applications, with no mechanism that fails when only one is made.

## Finding 5 - Consumer patches of Dieter internals

Five sites where a consumer restyles a component it does not own. Ownership
verified in Dieter source:

| Site | Target | Owned at |
| --- | --- | --- |
| `roma.css:330-336` | `.diet-btn-ic__icon` transition and transform | `dieter/components/button/button.css:377` |
| `bob_app.css:344-350` | `.diet-btn-ic__icon` transition and transform | `dieter/components/button/button.css:377` |
| `roma.css:133-135`, `528-530` | `.diet-btn-ic` display | `dieter/components/button/button.css` |
| `roma.css:143-150` | `.page`, `.page__content` padding and `max-inline-size` | `dieter/layouts/main-container/main-container.css:66,90` |
| `bob_app.css:180-191` | `.diet-popover` position, display, z-index, size | `dieter/components/popover/popover.css:28` |

The popover case is the most consequential. Dieter already ships the exact
pattern Bob is hand-rolling: `.diet-popover-host` with
`.diet-popover-host[data-state='open'] > .diet-popover` at
`dieter/components/popover/popover.css:1-21`. Bob reimplements that host and its
open-state toggle as `.topdrawer-more[data-state='open'] > .topdrawer-more__menu`
rather than consuming it. This is a consumer duplicating an available design
system behavior, not filling a gap.

The first four are low in volume and precisely locatable. All five are
enforceable today.

## Finding 6 - Minor drift

- **Duplicate definition in one file.** `.rd-canvas-module` (`roma.css:177-189`)
  and `.roma-module-surface` (`roma.css:204-214`) declare the same nine
  properties with the same values under two names.
- **Three naming conventions in Roma.** `.roma-*`, `.rd-*`, and unnamespaced
  `.widget-defaults-*` coexist, indicating at least two authoring eras.
- **Hardcoded control heights where tokens exist.** `min-height: 36px`
  (`roma.css:286`), `min-height: 32px` (`bob_app.css:228`), `min-height: 24px`
  (`bob_app.css:412`), `grid-template-columns: 36px 1fr` (`bob_app.css:233`).
- **Hand-rolled shadows.** `bob_app.css:456`, `466`, `499` declare
  `0 18px 64px` and `0 16px 48px` box-shadows while `--shadow-elevated` is used
  correctly at `bob_app.css:110`.
- **Capability boundary is untokenized.** The documented 600px workspace boundary
  appears as literal `599px` in four media queries (`roma.css:527`,
  `bob_app.css:92`, `bob_app.css:135`) with no token backing it.
- **Two different resets.** `roma.css:1-3` sets `box-sizing` only;
  `bob_app.css:2-6` also zeroes all margin and padding. Identical markup starts
  from different baselines in the two applications.

## Implications For Enforcement

A guard that bans consumer-local CSS today would fail both applications, because
the structural half has no design-system equivalent to move to. Finding 5 is
enforceable now and is a small, bounded list. Findings 3 and 4 are not
enforceable until the structure they refer to exists somewhere consumable.

The sequencing question this raises — whether the structure layer belongs in
Dieter, and in what form — is a product and design-system decision, not an audit
output. It is named here because it gates any conformance rule broader than
Finding 5.

## Scope Limits

This audit measured CSS conformance. It did not measure user experience.

Not covered, and not inferable from this evidence: information architecture,
navigation model, density, flow quality, empty and error states as rendered,
responsive behavior in practice, or whether any surface is good to use. A fully
conformant application can still be poor to use. Those questions require rendered
evidence.

The authenticated screenshot path is already wired and was not exercised for this
audit: `playwright.config.ts` targets `https://roma.dev.clickeen.com` with stored
state at `e2e/.auth/roma-dev.json`, mintable via `pnpm e2e:auth:roma-dev`.
