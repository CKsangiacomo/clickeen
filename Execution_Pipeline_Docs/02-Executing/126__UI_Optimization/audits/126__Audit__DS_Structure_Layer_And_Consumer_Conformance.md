# 126 Design System Structure Layer And Consumer Conformance — Audit And Response

Status: POINT-IN-TIME STATIC AUDIT, SUPERSEDED IN PART BY THE AUTHORITY
RECONCILIATION AND IMPLEMENTATION RESPONSE BELOW.

Original measured state: working tree at `6af4a665` plus uncommitted changes to
`roma/app/roma.css`, `bob/app/bob_app.css`, and
`dieter/layouts/main-container/main-container.css`, 2026-07-31. Original
verification surface: local source inspection only.

This document now separates the valid findings from incorrect conclusions in the
original audit and records the implemented response. It does not redefine product
doctrine.

## Authority Reconciliation

The surface vocabulary in `documentation/engineering/UI/surfaces.md` names
visible UI planes so an author can reason consistently about composition. It is
not a promise that Dieter ships one generic component for every noun.

The current ownership boundaries are:

- Dieter owns reusable tokens, controls, visual contracts, Popup, Table, and the
  `main-container > left-nav + page` application layout.
- Roma and DevStudio consume the application layout and own their navigation,
  routes, page content, domain composition, and behavior.
- Bob does not consume the application layout. It owns its specialized
  `TopDrawer > EditorContent > ToolDrawer | Workspace` editor composition.
- Consumer-local module, card, inspector, workspace, and preview structures are
  valid when they express product composition rather than duplicate a shared
  visual or control contract.

Therefore the original recommendation implied by “nine nouns, roughly five
implementations” was wrong. Four generic Dieter surface components are neither
required nor authorized by the doctrine. Adding them would create an abstract
layer without a proven shared contract.

## Corrected Method

Source counts must exclude generated and dependency trees:

```bash
find roma bob -name "*.css" \
  -not -path "*/node_modules/*" \
  -not -path "*/.next/*" \
  -not -path "*/.vercel/*" \
  -not -path "*/.cloudflare/*"
rg -o 'style=\{\{' roma bob --glob '*.tsx' \
  --glob '!**/node_modules/**' --glob '!**/.next/**' \
  --glob '!**/.vercel/**' --glob '!**/.cloudflare/**'
```

The original method did not consistently exclude generated trees: `find`
omitted `.cloudflare`, while the `rg` commands omitted both `.vercel` and
`.cloudflare`. The original stylesheet count also missed Bob's active
seven-line `tdheader.css` stylesheet.

## Findings And Disposition

### 1. Consumer CSS is small and tokenized — confirmed

The original audit correctly found no general consumer CSS sprawl. Roma and Bob
mostly use Dieter spacing, role, control, motion, radius, and typography
contracts. Local structural CSS is not itself nonconformance.

Disposition: preserve valid product composition; remove only duplicated,
obsolete, or cross-authority presentation.

### 2. Surface vocabulary was only partly implemented — rejected

The vocabulary describes UI planes. Dieter implementation is required when a
reusable contract exists, not merely because a noun exists in doctrine.

Current reusable contracts include:

| Concern | Authority |
| --- | --- |
| Application layout and page | Dieter `main-container` layout |
| Navigation plane container | Dieter `left-nav`; consumer owns its tree |
| Header and actions | Dieter `page__header` and `page__actions` |
| Table | Dieter Table |
| Dialog | Dieter Popup and Popover |
| Bob inspector/editor layout | Bob ToolDrawer and Workspace |
| Roma modules and cards | Roma domain composition |

`operational-table` is not a current component. It was removed in favor of the
single Dieter Table contract.

Disposition: do not add generic module, card, inspector, or preview components.

### 3. Both consumers use `main-container` — corrected

Roma consumes `main-container`. Bob intentionally does not. Bob's ToolDrawer,
Workspace, Preview, TopDrawer, and editor structures are the documented Bob
composition, not unauthorized replacements for the Roma/DevStudio shell.

Roma's modules, cards, fields, grids, and toolbars are likewise authorized
domain composition. Different product concepts do not need identical class
names merely because both are visible surfaces.

Disposition: no generic structure migration.

### 4. `tdmenucontent` presentation was duplicated — confirmed and closed

Roma Widget Defaults consumes Bob's compiled control markup but previously
copied its cluster/group CSS into `roma.css`. The copies could drift, and both
consumers reached through Dieter's Button markup to rotate
`.diet-btn-ic__icon`.

Implemented response:

- Bob now exports `@clickeen/bob/control-host.css` beside
  `@clickeen/bob/control-host`.
- Bob and Roma import that same stylesheet.
- The compiler emits the owned hook
  `.tdmenucontent__cluster-toggle-icon`; shared presentation no longer targets a
  Dieter internal selector.
- Duplicated cluster, group, field-stack, hidden-state, and icon-state rules were
  deleted from both app stylesheets.
- Roma retains only the width rule belonging to its Widget Defaults host.

This is the smallest correct shared seam: one markup producer, one presentation
authority, and two consumers. It does not expose Bob session, preview, save, or
persistence behavior.

### 5. Consumer patches of Dieter internals — split into valid and invalid cases

Confirmed violations:

- The shared compiled-control toggle targeted `.diet-btn-ic__icon`.
- Roma Sign Out rebuilt Button appearance locally.

Both are closed. The toggle has an owned hook. Sign Out now composes Dieter's
`diet-btn-txt` contract; its local CSS controls only navigation placement
(`width` and alignment).

The remaining selectors cited by the original audit are valid composition:

- `.roma-nav-trigger` controls responsive visibility of a consumer-owned
  trigger; it does not redefine Button appearance.
- `.roma-builder-page` selects the documented full-bleed Builder page variant.
- `.topdrawer-more__menu` places a Dieter Popover inside its Bob-owned host.

Disposition: retain these rules until a real repeated contract proves otherwise.

### 6. Minor drift — corrected and narrowed

Confirmed residue:

- `TdHeader` was a one-use wrapper with a separate stylesheet.
- Its `32px` minimum height duplicated an existing control-size token.

Both are closed. ToolDrawer now renders its header directly, the orphaned
component and stylesheet are deleted, and the header uses
`var(--control-size-xl)`.

The other cited observations are not established violations:

- `.roma-*`, `.rd-*`, and `.widget-defaults-*` identify different ownership
  scopes; coexistence alone does not prove stale naming eras.
- Literal grid widths, row heights, and the `599px` media-query edge were not
  proven to be interchangeable with existing tokens.
- Bob preview shadows describe editor presentation and were not proven equal to
  Dieter's general elevated shadow.
- Different app resets are not automatically drift because Bob and Roma have
  different composition boundaries.

Disposition: do not replace precise values or names speculatively.

## Implemented Simplification

The response is deletion-led:

1. Establish one Bob-owned stylesheet for compiled control-host presentation.
2. Import it in Bob and Roma.
3. Remove both local copies.
4. Give the compiled toggle its own stable hook.
5. Compose Dieter Button for Roma Sign Out and delete local visual recreation.
6. Inline the one-use ToolDrawer header and delete its component/CSS files.
7. Update service and UI doctrine so future agents follow the authority boundary.

No generic surface framework, registry, compatibility wrapper, or migration
layer was introduced.

## Enforcement Result

The enforceable rule is ownership-based:

- shared visual/control behavior has one named authority;
- consumers compose that authority without styling its internals;
- product-specific structure stays with the owning product surface;
- a new abstraction requires demonstrated reuse, not vocabulary coincidence;
- a moved rule must be deleted from its old owners in the same change.

A blanket ban on consumer structural CSS is explicitly rejected. It would make
Roma and Bob unable to express their different product compositions and would
encourage unnecessary Dieter abstractions.

## Scope Limits

This audit and response concern source structure and design-system conformance.
They do not by themselves prove information architecture, density, interaction
quality, empty/error states, responsive behavior, or visual quality. Those
require runtime verification through the owning deployed surfaces.
