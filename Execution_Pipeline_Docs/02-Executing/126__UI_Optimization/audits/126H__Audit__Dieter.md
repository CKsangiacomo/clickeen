# 126H - Dieter Pre-Execution Audit

Status: CODEX PRE-EXECUTION AUDIT - three-lane review green.
PRD: `../126H__PRD__Dieter.md`.
Scope: Dieter foundation substrate, generated Dieter artifacts, Dieter docs, and
known app/runtime consumers of Dieter foundation tokens.

No runtime code changes, product data changes, Cloudflare operations, R2 writes,
or generated artifact edits were performed by this audit.

## Authority Gate

| Authority | Current owner |
| --- | --- |
| Product surface authority | Dieter system UI substrate, consumed by Bob/Roma/Prague/DevStudio/Admin and product packages |
| Source coordinate | `dieter/**`, especially `dieter/tokens/**` and `dieter/components/**` |
| Generated coordinate | `tokyo/product/dieter/**`, produced by `pnpm build:dieter` / `scripts/build-dieter.js` |
| Route/API boundary | None for this audit; 126H does not mutate account routes or product APIs |
| Runtime/deploy surface | None touched; post-execution deploy verification belongs to the normal Cloudflare path only after code changes |
| Verification surface | Source search, docs search, `pnpm build:dieter` after future Dieter source changes |

Compliance reason: 126H is a substrate-source and documentation pass. It must
not turn into a runtime repair, product-data edit, or deploy operation.

## Source Evidence Snapshot

- Active token entrypoint is `dieter/tokens/tokens.css`, importing foundation,
  color, and typography in that order.
- Active foundation source is `dieter/tokens/dieter-foundation-tokens.css`.
- Active build script is root `scripts/build-dieter.js`; the old
  `dieter/scripts/build-dieter.js` path is not current.
- `@ck/dieter` currently has `"main": "index.html"`, so it is not a normal
  programmatic package entrypoint.
- `dieter/components/` currently has 26 component directories.
- `--vspace-*` has no current source/doc hits in the checked Dieter/UI-doc
  paths; `--hspace-*` does.
- `--shadow-elevated` is not consumed by Dieter components, but it is consumed
  by Roma and Prague app/runtime code:
  `roma/app/roma.css`, `prague/src/components/StepsPrimitive.astro`,
  `prague/src/blocks/subpage-cards/subpage-cards.astro`, and
  `prague/public/styles/primitives.css`.
- Focus/touch foundation tokens are consumed by Admin/DevStudio, Roma, and
  Prague app/runtime code, so deleting token definitions requires consumer
  cleanup or explicit routing before deletion.
- Numeric radius aliases are consumed by Admin/DevStudio generator and generated
  foundation pages, not only Dieter components.

Compliance reason: the PRD must be grounded in current files, not inferred
from earlier audit text.

## As-Built Findings To Carry Into Execution

### Foundation Entrypoint

`dieter/tokens/tokens.css` is the composed source entrypoint:

```css
@import url('./dieter-foundation-tokens.css');
@import url('./dieter-color-tokens.css');
@import url('./dieter-typography.css');
```

The foundation file is not fully standalone because shadow tokens reference
color tokens. This is current architecture and must be documented as by-reference
composition, not treated as a broken import.

### Space And Vertical Rhythm

Current source has real `--vertspace-*` tokens. That scale stays.

Current source still has stale `--hspace-*` references in Dieter component CSS
and generated mirrors:

- `dieter/components/dropdown-fill/dropdown-fill.css`
- `dieter/components/dropdown-actions/dropdown-actions.css`
- `dieter/components/dropdown-edit/dropdown-edit.css`
- `dieter/components/dropdown-upload/dropdown-upload.css`
- `dieter/components/dropdown-border/dropdown-border.css`
- `dieter/components/dropdown-shadow/dropdown-shadow.css`
- `dieter/components/textfield/textfield.css`
- `dieter/components/textedit/textedit.css`
- `dieter/components/tabs/tabs.css`
- `tokyo/product/dieter/components/**` generated mirrors
- `admin/src/css/dieter-previews.css`

Execution must remove stale spellings after moving callers to the decided
current token. It must not document stale names as legacy, prohibited, or future
options after removal.

### Radius

Current foundation defines `--control-radius-*` plus numeric aliases
`--radius-3` and `--radius-4`. Component source also references undefined
`--radius-2` in `dieter/components/bulk-edit/bulk-edit.css`.

Current numeric radius consumers:

- `dieter/components/bulk-edit/bulk-edit.css`
- `dieter/components/object-manager/object-manager.css`
- `dieter/components/popover/popover.css`
- `dieter/components/repeater/repeater.css`
- generated mirrors in `tokyo/product/dieter/components/**`
- `admin/scripts/generate-foundation-pages.mjs`
- `admin/src/html/foundations/colors.html`
- `admin/src/html/foundations/icons.html`
- `admin/src/html/foundations/typography.html`
- `admin/src/css/utilities.css`
- `admin/src/css/layout.css`
- `admin/src/css/dieter-previews.css`

Execution must move callers to `--control-radius-*` and remove numeric aliases.
It must not add `--radius-2` or keep `--radius-3` / `--radius-4` as compatibility.
Generator source changes must precede regenerated DevStudio HTML.

### Focus And Touch

Current foundation/source docs mention:

- `--focus-ring-width`
- `--focus-ring-offset`
- `--focus-ring-color`
- `--min-touch-target`

Human direction and 126A bound this clearly: Clickeen is not a mobile app, 126H
does not import 44px target doctrine, and 126H does not create keyboard/focus
support machinery. Execution removes these from current Dieter law unless
another owning PRD explicitly preserves a specific token for current product
behavior.

Current app/runtime consumers that must be cleaned or routed before token
definition deletion:

- `admin/src/css/utilities.css`
- `admin/scripts/generate-foundation-pages.mjs`
- `admin/src/html/foundations/colors.html`
- `admin/src/html/foundations/typography.html`
- `admin/src/html/tools/entitlements.html`
- `roma/app/roma.css`
- `prague/public/styles/primitives.css`
- `prague/src/components/InstanceEmbed.astro`
- `prague/src/blocks/site/nav/Nav.astro`

`--focus-ring-color` is a 126B color-boundary token. 126H records it because
consumers reference it, but 126H does not decide color law.

### Shadows And Elevation

Dieter has three foundation shadow tokens:

- `--shadow-elevated`
- `--shadow-floating`
- `--shadow-inset-control`

`--shadow-floating` and `--shadow-inset-control` have Dieter component
consumers. `--shadow-elevated` has app/runtime consumers in Roma and Prague.
Therefore `--shadow-elevated` cannot be removed as "unused" during 126H.

Execution must keep it as current shared source while those consumers exist.
Raw repeated Dieter component shadows are a 126I component cleanup target, not a
reason for 126H to create a Material-style elevation system.

### Layering

Current Dieter component CSS uses raw `z-index` literals in:

- `dieter/components/dropdown-fill/dropdown-fill.css`
- `dieter/components/popover/popover.css`
- `dieter/components/object-manager/object-manager.css`
- `dieter/components/bulk-edit/bulk-edit.css`
- `dieter/components/textedit/textedit.css`
- `dieter/components/tabs/tabs.css`
- `dieter/components/segmented/segmented.css`

126H records the drift only. It must not add a `--z-*` token family. Layering
behavior belongs to 126I components and 126K dialogs/modals.

### Motion Boundary

Foundation defines duration tokens, but 126F owns motion law. `--duration-snap`,
`--duration-spin`, and `--easing-standard` are routed to 126F. 126H must not
decide motion/easing values or create choreography.

### Icon Boundary

Foundation owns `--icon-size-*` as substrate tokens. Icon origination,
consumption, sizing rules, render paths, and account-asset separation belong to
126C and 126I. 126H must not reopen icon origination.

### Documentation Drift

Known current docs requiring repair during execution:

- `documentation/engineering/UI/dieter.md` lists `dieter/scripts/*` as source
  truth even though active build is root `scripts/build-dieter.js`.
- `documentation/engineering/UI/dieter.md` says about 27 components; current
  count is 26.
- `documentation/engineering/UI/dieter.md` says build path is
  `dieter/scripts/build-dieter.js`; active build is `scripts/build-dieter.js`.
- `documentation/engineering/UI/dieter.md` says dark-ready; 126B says no dark
  mode and no dark-ready scaffolding.
- `documentation/engineering/UI/dieter.md` lists focus/touch tokens as current
  doctrine.
- `documentation/engineering/UI/README.md` maps UI docs to stale 126 letters.
- `documentation/services/dieter.md` lists `dieter/icons/svg_new/` as a current
  optional icon override input. 126C and 126G say that lane is not current
  product law; living Dieter docs must remove it as source truth.
- `scripts/build-dieter.js` still contains the `svg_new` copy block. That stale
  source cleanup is routed to 126C/126G execution and must not be represented in
  126H docs as current Dieter source law.

## Detailed Blast Radius

| Slice | Files / paths | Execution requirement | Must not do |
| --- | --- | --- | --- |
| Foundation source | `dieter/tokens/dieter-foundation-tokens.css`; `dieter/tokens/tokens.css` | Keep the current substrate map where decided; remove stale aliases/tokens only when callers are updated or routed. | No new token taxonomy, focus system, z-index system, or compatibility aliases. |
| Generated Dieter output | `tokyo/product/dieter/tokens/**`; `tokyo/product/dieter/components/**`; `tokyo/product/dieter/manifest.json` | Update only through `pnpm build:dieter` after source changes. | No hand-editing generated output. |
| Vertical rhythm | Listed `dieter/components/**` files with `--hspace-*`; generated mirrors; `admin/src/css/dieter-previews.css` | Move stale spellings to `--vertspace-*` or correct owning token. | Do not document removed names as living patterns. |
| Radius | `bulk-edit`, `object-manager`, `popover`, `repeater`; generated mirrors; `admin/scripts/generate-foundation-pages.mjs`; `admin/src/html/foundations/colors.html`; `admin/src/html/foundations/icons.html`; `admin/src/html/foundations/typography.html`; `admin/src/css/utilities.css`; `admin/src/css/layout.css`; `admin/src/css/dieter-previews.css` | Move numeric aliases to `--control-radius-*`; update generator source before generated DevStudio pages. | Do not add `--radius-2`; do not preserve numeric alias family. |
| Focus/touch | foundation/color token files; generated mirrors; `admin/src/css/utilities.css`; `admin/scripts/generate-foundation-pages.mjs`; `admin/src/html/foundations/colors.html`; `admin/src/html/foundations/typography.html`; `admin/src/html/tools/entitlements.html`; `roma/app/roma.css`; `prague/public/styles/primitives.css`; `prague/src/components/InstanceEmbed.astro`; `prague/src/blocks/site/nav/Nav.astro`; `documentation/engineering/UI/dieter.md`; `documentation/engineering/UI/color.md` | Remove from current 126H law only after consumer cleanup or explicit routing to an owning PRD; keep `--focus-ring-color` routed to 126B. | No mobile/touch doctrine; no keyboard/focus framework; no aliases. |
| Shadows | foundation token files; Dieter shadow consumers; Roma/Prague `--shadow-elevated` app consumers | Preserve product-used `--shadow-elevated`; route raw component shadow cleanup to 126I. | Do not remove a product-used token as unused; do not add elevation levels. |
| Layering | raw `z-index` Dieter components | Record for 126I/126K. | No `--z-*` token family. |
| Package/artifact docs | `dieter/package.json`; `documentation/services/dieter.md`; `documentation/engineering/UI/dieter.md` | State current artifact shape honestly. | No invented package registry/entrypoint. |
| Living UI docs | `documentation/engineering/UI/README.md`; UI detail docs listed in PRD | Align doc ownership, track mapping, and current substrate claims. | No legacy behavior documentation after removal. |
| Product data/deploy | account runtime paths; Cloudflare/R2 | No change in 126H pre-execution audit. | No product mutation, no deploy claim. |

## V1-V8 Audit

| ID | Audit result |
| --- | --- |
| V1 Silent substitution | Controlled: undefined `--radius-2` / `--color-surface` must not become invented aliases. |
| V2 Silent healing | Controlled: stale `--hspace-*`, any `--vspace-*`, and numeric radius aliases are removed after caller cleanup, not normalized into compatibility. |
| V3 Silent omission | Controlled: each non-126H concern is routed to 126B/126C/126F/126I/126K/126L/126M instead of dropped; Admin/DevStudio, Roma, and Prague token consumers are included before token deletion. |
| V4 Fail-open control | Controlled: fallback-masked stale names are not treated as valid law. |
| V5 Corruption-as-absence | Controlled: broken token references and would-be deleted token consumers are explicit bugs/blast radius, not absence. |
| V6 Partial-success masquerade | Controlled: `--shadow-elevated` has Roma/Prague consumers and cannot be called unused; focus/touch and radius token removal cannot be called complete while app/runtime consumers still reference the removed names. |
| V7 Masquerade/redress | Controlled: no alias layer, no legacy docs, no redressed old names. |
| V8 Runtime test dependency | Controlled: checks verify source/doc truth; they do not become product runtime gates. |

## Green Criteria

126H is pre-execution ready only when all three review lanes confirm:

- file-level blast radius is concrete enough for execution;
- no stale/legacy behavior is preserved as current doctrine;
- no new framework, registry, scanner, validator, focus system, touch doctrine,
  z-index family, or elevation expansion is introduced;
- docs updates are named, including `documentation/engineering/UI/README.md`,
  `documentation/engineering/UI/dieter.md`, and `documentation/services/dieter.md`;
- verification includes build/typecheck/governance checks for touched source and
  before/after visual evidence for affected Dieter/Admin/Roma/Prague UI;
- V1-V8 risks are explicitly controlled.
