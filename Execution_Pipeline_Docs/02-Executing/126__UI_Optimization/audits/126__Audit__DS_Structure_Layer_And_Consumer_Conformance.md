# 126 Design System Structure Layer And Consumer Conformance - Audit

Status: POINT-IN-TIME STATIC AUDIT - source inspection only; no runtime evidence;
no execution credit.

Measured state: working tree at `6af4a665` plus uncommitted modifications to
`roma/app/roma.css`, `bob/app/bob_app.css`, and
`dieter/layouts/main-container/main-container.css`, 2026-07-31.

Evidence is cited by selector rather than by line number. The measured files are
under active edit; selectors survive line drift and line numbers do not.

Scope: every stylesheet and inline style in Roma and Bob, measured against the
Dieter source inventory and the surface vocabulary declared in
`documentation/engineering/UI/surfaces.md`.

Authority boundary:

- Inspected: `roma/**`, `bob/**`, `dieter/**` source on disk.
- Not touched: account/session/storage/route/runtime/deploy authorities, product
  data, cloud-dev surfaces, and the in-flight working-tree changes.
- Verification surface: local source inspection only. No browser, no screenshots,
  no rendered evidence.

This file reports findings. It does not define doctrine, propose a component
roadmap, or make scope decisions.

## Executive Current Reality

126 is making the presentation layer agent-operable: thirteen doctrine domains in
`documentation/engineering/UI/`, 24 of 29 components carrying a machine-readable
`.spec.json`, a declared surface vocabulary and application taxonomy in
`surfaces.md`, and a governed token-edit lane in DevStudio. This audit measures
how far implementation has followed declaration.

`surfaces.md` names nine surface types. Dieter implements roughly five. The four
declared-but-unimplemented types — **module/section, item/card, inspector/tool,
preview** — are where, and essentially only where, Roma and Bob hand-wrote
structural CSS.

That is the finding. It is not indiscipline and not a missing layer. It is a
partially-implemented vocabulary, and the consequence is specific to an
agent-operated system: a noun declared in doctrine with nothing consumable behind
it is worse than an undeclared one, because a correct reading of `surfaces.md`
leads an author — human or agent — to use the word and then write CSS for it.
Both consumer stylesheets contain the result.

The consumer CSS itself is small, tokenized, and disciplined. This audit found no
sprawl.

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
| Stylesheets | 1 (`roma/app/roma.css`, 477 lines) | 1 (`bob/app/bob_app.css`, 454 lines) |
| CSS modules | 0 | 0 |
| styled-jsx blocks | 0 | 0 |
| Inline `style={{}}` | 13 across 5 files | 19 |
| `!important` | 1 (`[hidden]` guard) | 1 (`[hidden]` guard) |

Token usage is the norm in both files: `var(--space-N)`, `var(--role-*)`,
`var(--control-radius-*)`, `var(--control-size-*)`, `var(--duration-*)`,
`var(--easing-*)`. Logical properties are used consistently.

Any remediation framed as "delete the consumer CSS sprawl" is aimed at a problem
this audit could not find.

## Finding 2 - The surface vocabulary is declared and about half implemented

`documentation/engineering/UI/surfaces.md` declares the application taxonomy:

```text
main-container
├── left-nav
└── page
    ├── page__header
    │   └── page__actions
    └── page__content
```

and names nine surface types: navigation plane, header/action band,
canvas/work area, module/section, item/card, table/list, inspector/tool,
preview, overlay/dialog.

Implementation status:

| Declared surface | Dieter implementation | State |
| --- | --- | --- |
| Page shell | `.main-container`, `.page`, `.page__content` | Implemented |
| Navigation plane | `.left-nav`, incl. compact drawer, scrim, transitions | Container implemented; nav items not |
| Header/action band | `.page__header`, `.page__actions` | Implemented |
| Table/list | `table`, `operational-table` | Implemented |
| Overlay/dialog | `popover`, `popup`, `tooltip` | Implemented |
| **Module/section** | none | **Declared, not implemented** |
| **Item/card** | none | **Declared, not implemented** |
| **Inspector/tool** | none | **Declared, not implemented** |
| **Preview / canvas work area** | none | **Declared, not implemented** |

The app shell is real, tokenized (`--layout-left-nav-width`,
`--layout-page-padding`, `--layout-compact-left-nav-width`), and carries the
600px compact behavior including the navigation scrim and drawer transition. The
gap is not the shell. It is four interior surface types that doctrine names and
nothing implements.

## Finding 3 - Consumers conform at the shell and hand-roll the four gaps

Roma and Bob both consume `main-container`. Neither reimplements the app shell.
What each authored maps onto the unimplemented surface types:

| Declared surface | Roma authored | Bob authored |
| --- | --- | --- |
| Module/section | `.rd-canvas-module` | — |
| Item/card | `.roma-card` | — |
| Inspector/tool | — | `.tooldrawer`, `.tdheader`, `.tdcontent`, `.tdmenu*` |
| Preview / canvas | — | `.workspace` + variants |
| Navigation items | `.roma-nav__link`, `.roma-nav__subnav`, `.roma-nav__signout` | — |
| Not in doctrine | `.roma-form-grid`, `.roma-field`, `.roma-grid`, `.roma-toolbar` | `.topdrawer*`, `.builder-app`, `.editor-content` |

The overlap between what consumers authored and what doctrine declared but did
not implement is near total. This is gap-filling, not divergence by preference.

The two applications share no terms for the same concepts, because each named its
gap-filler locally. Nothing connects Roma's module/section to Bob's.

`.roma-nav__signout` is a distinct case: it reimplements a button
(`border: 0`, background, cursor, hover, disabled) while Dieter ships `button` at
466 lines. That is not gap-filling.

## Finding 4 - `tdmenucontent` is a shared component living in one app

`roma/components/widget-defaults-builder-controls.tsx` renders Bob's
`tdmenucontent` markup. Bob's stylesheet does not load in Roma, so the
component's CSS was copy-pasted into Roma, scoped under
`.widget-defaults-builder-fields`.

Duplicated selectors, present in both files:

```text
.tdmenucontent__cluster
.tdmenucontent__cluster-header
.tdmenucontent__cluster[data-collapsed='true'] > .tdmenucontent__cluster-header
.tdmenucontent__cluster-toggle .diet-btn-ic__icon
.tdmenucontent__cluster[data-collapsed='true'] ... .diet-btn-ic__icon
.tdmenucontent__cluster-body
.tdmenucontent__cluster-body[hidden]
.tdmenucontent__group-label
.tdmenucontent__cluster-label
```

The copies have already begun to diverge: Roma merges Bob's separate
`__cluster-body` and `__group` rules into one grouped selector, and the cluster
margin rules differ in parent selector (`.tdmenucontent__fields` vs
`.widget-defaults-builder-fields`).

A change to this component currently requires two edits in two applications, with
no mechanism that fails when only one is made. `tdmenucontent` has no
`.spec.json`, no registry entry, and no owning authority — so the only available
operation was copy-paste.

## Finding 5 - Consumer patches of Dieter internals

Sites where a consumer restyles a component it does not own:

| Consumer selector | Target | Owned by |
| --- | --- | --- |
| `.widget-defaults-builder-fields ... .diet-btn-ic__icon` (Roma) | icon transition/transform | `dieter/components/button/button.css` |
| `.tdmenucontent__cluster-toggle .diet-btn-ic__icon` (Bob) | icon transition/transform | `dieter/components/button/button.css` |
| `.roma-nav-trigger.diet-btn-ic` (Roma) | display | `dieter/components/button/button.css` |
| `.main-container > .page.roma-builder-page`, `.roma-builder-page > .page__content` (Roma) | padding, `max-inline-size` | `dieter/layouts/main-container/main-container.css` |
| `.topdrawer-more > .topdrawer-more__menu.diet-popover` (Bob) | placement | `dieter/components/popover/popover.css` |

The Roma `main-container` override is the structurally interesting one: the
builder route needs a full-bleed page, and no full-bleed variant is declared, so
Roma escapes the shell's padding and width constraints from outside.

## Finding 6 - Minor drift

- **Naming eras.** Roma carries `.roma-*`, `.rd-*`, and unnamespaced
  `.widget-defaults-*` simultaneously, indicating at least two authoring
  generations. No rule tells an author which prefix to use.
- **Hardcoded control heights where `--control-size-*` exists.** `36px` in Roma's
  `.widget-defaults-group > summary`; `32px`, `24px`, and a `36px` grid track in
  Bob's `.tdheader`, `.translations-panel__locale-row`, and `.tdcontent`.
- **Hand-rolled shadows.** Bob's `.workspace` variants declare literal
  `0 18px 64px` and `0 16px 48px` box-shadows while `--shadow-elevated` is used
  correctly elsewhere in the same file.
- **Capability boundary is untokenized.** The documented 600px workspace boundary
  appears as literal `599px` in media queries across both consumers and
  `main-container.css`, with no token backing it. Product law that an agent
  cannot resolve to an implementation.
- **Two different resets.** Roma sets `box-sizing` only; Bob also zeroes all
  margin and padding. Identical markup starts from different baselines in the two
  applications.

## Closed By In-Flight Work

The working-tree changes under `8c4a493b` / `6af4a665` have already resolved:

- **The duplicate module/section pair.** `.roma-module-surface` is deleted;
  `.rd-canvas-module` survives as the single definition.
- **`.roma-codeblock`** is deleted.
- **The popover host reimplementation.** Bob now composes
  `.topdrawer-more.diet-popover-host`, adopting Dieter's declared host and its
  `[data-state='open']` machinery. A placement override remains.

Roma is down 84 lines and Bob 58 in the current working tree. The direction of
that work matches this audit's findings.

## Implications For Enforcement

Enforceable now, no prerequisite:

- The Finding 5 DS-internal patches.
- `.roma-nav__signout` reimplementing `button`.
- Hardcoded control heights where `--control-size-*` exists; hand-rolled shadows
  where `--shadow-*` exists.

Blocked until the four declared surfaces have implementations: Findings 3 and 4.
A guard banning consumer-authored structural CSS would fail both applications
today, because module/section, item/card, inspector/tool, and preview have
nothing consumable behind them.

For an agent-operated presentation layer the ordering matters in one specific
way. Doctrine is what an agent reads; implementation is what it can use. While
those disagree, a correct reading of `surfaces.md` still produces hand-authored
CSS, and every surface built in that window adds to Findings 3 and 4. The
divergence is self-sustaining until the vocabulary is closed.

Whether those four are implemented in Dieter, and in what form, is a design
system and product decision, not an audit output. It is named here because it
gates every conformance rule beyond the list above.

## Scope Limits

This audit measured CSS conformance. It did not measure user experience.

Not covered and not inferable from this evidence: information architecture,
navigation model, density, flow quality, empty and error states as rendered,
responsive behavior in practice, or whether any surface is good to use. A fully
conformant application can still be poor to use.

The authenticated screenshot path is wired and was not exercised:
`playwright.config.ts` targets `https://roma.dev.clickeen.com` with stored state
at `e2e/.auth/roma-dev.json`, mintable via `pnpm e2e:auth:roma-dev`.
