# 126J Surfaces - As-Built Audit - Codex

Status: CODEX ONLY - Phase 1 step 1 redo.
Scope: visual surface primitives and layout composition in current Bob,
DevStudio, Roma, and Dieter substrate.
Process: code owns current reality. This audit does not converge with GLM,
does not choose fixes, and does not run step 4+.

## 0. Corrected Domain Boundary

126J is not about "product surfaces" as apps, services, accounts, authorities,
or runtime boundaries.

126J is about the surface design primitive:

```text
surface primitives -> layouts -> screens/pages
```

In Clickeen terms:

- A surface is a visual plane or container that holds content, controls, or
  previewed product output.
- A layout organizes surfaces.
- A screen or page composes one or more layouts.
- Bob, DevStudio, and Roma are consumers of this system. They are not the
  definition of "surface."

The previous Codex/GLM framing that treated Bob, DevStudio, and Roma as the
"surfaces" was the wrong layer. Those audits found useful evidence about Dieter
consumption, but they do not answer 126J.

## 1. Dieter Surface Substrate

Dieter already provides the ingredients that current surfaces use:

- `dieter/tokens/dieter-color-tokens.css` defines `--role-surface` and
  `--role-surface-bg`.
- `dieter/tokens/dieter-foundation-tokens.css` defines `--space-*`,
  `--vertspace-*`, control radii, surface radius aliases, and elevation
  shadows.
- `documentation/engineering/UI/dieter.md` describes the matrioska model as
  tokens -> components -> screens.

Current reality:

- There is no dedicated Dieter `surface` component.
- There is no shared surface/layout framework machinery.
- Surface styling is assembled locally in Bob, DevStudio, and Roma from Dieter
  tokens: background, radius, padding, gap, border, and shadow.
- The current substrate can support a surface standard without adding new
  machinery.

What is good:

- Surface ingredients already point inward to Dieter tokens.
- Radius, spacing, and shadow primitives exist.
- This matches the 126 program's by-reference model.

What is bad:

- The codebase has no single surface vocabulary that tells agents when to use a
  canvas, module plane, card plane, tool panel, preview plane, or overlay plane.
- Because the vocabulary is absent, each surface consumer invents local class
  names and local composition rules.

## 2. Roma Current Surface Stack

Roma is the clearest directional example of the visual surface hierarchy, even
though it is still local Roma CSS.

Evidence:

- `roma/components/roma-shell.tsx` composes:
  - `.roma-layout`
  - `.roma-layout__nav`
  - `.roma-layout__main`
  - `.rd-domain`
  - `.rd-header`
  - `.rd-canvas`
- `roma/app/(authed)/domain-page-shell.tsx` wraps domain screens in `RomaShell`
  and uses `.roma-module-surface` for suspense fallback.
- `roma/app/roma.css` defines the local planes:
  - app background on `body`
  - `.roma-layout` as nav/main page layout
  - `.roma-layout__nav` as navigation plane
  - `.rd-domain` as domain page frame
  - `.rd-header` as page action/header band
  - `.rd-canvas` as the work/content canvas
  - `.rd-canvas-module` as a white content module plane
  - `.roma-module-surface` as another module plane
  - `.widget-defaults-widget` as a widget-defaults module plane
  - `.roma-grid` and `.roma-grid--three` as local grid layouts
  - `.roma-card` as repeated item/stat card plane
  - `.roma-table` as a table content plane
  - `.roma-toolbar` as a local action row
  - `.roma-modal-backdrop` and `.roma-modal` as overlay/dialog planes

What is good:

- Roma already proves the intended sequence:

  ```text
  shell -> domain frame -> header + canvas -> modules/cards/tables
  ```

- It distinguishes the page background from content modules.
- It has a real content canvas instead of making every page a pile of floating
  cards.
- It uses Dieter tokens for most spacing, radii, colors, and surface
  backgrounds.

What is bad:

- The surface vocabulary is local to Roma.
- Similar planes have multiple names: `.rd-canvas-module`,
  `.roma-module-surface`, `.widget-defaults-widget`, and `.roma-card`.
- Some classes describe product domains instead of the surface primitive they
  represent.
- Roma modals belong to 126K, but they currently live beside page/module/card
  surface code in the same CSS file.
- Roma's current stack is directional, not doctrine. Without 126J, agents can
  copy it inconsistently or invent alternatives in DevStudio/Roma refactors.

## 3. Bob Current Surface Stack

Bob is an operational editor with a compact, high-density surface structure.

Evidence:

- `bob/components/BuilderApp.tsx` composes:
  - `.builder-app`
  - `.topdrawer`
  - `.builder-app__content`
  - `ToolDrawer`
  - `Workspace`
  - `UpsellPopup`
- `bob/app/bob_app.css` defines:
  - `.builder-app` as full viewport editor frame
  - `.builder-app__content` as a two-column editor layout
  - `.topdrawer` as transparent top action/context band
  - `.tooldrawer` as a white tool panel
  - `.tdcontent`, `.tdmenu`, `.tdmenucontent` as inspector/control layout
  - `.workspace` as preview/work area
  - `.workspace-iframe` as the rendered widget preview plane
  - `.workspace-status-overlay` as non-blocking status overlay
  - `.ck-upsellOverlay`, `.ck-upsellModal`, `.ck-publishOverlay`,
    `.ck-publishModal` as overlay/dialog planes

What is good:

- Bob is dense and operational, not decorative.
- It clearly separates:
  - top context/actions
  - editing/tool panel
  - preview workspace
  - overlay states
- The workspace preview plane is not treated as a generic card. It is a product
  preview host with different host/device variants.
- Most surface values are token-backed.

What is bad:

- Bob's surface classes are local and undocumented as reusable Clickeen surface
  law.
- Tool panel, preview plane, action band, and overlay planes are not named in a
  shared standard.
- The workspace contains detailed preview-plane behavior, but there is no 126J
  rule telling agents that preview planes are different from content modules and
  item cards.
- Dialog/overlay styling appears in Bob app CSS, while the modal mechanics
  belong to 126K.

## 4. DevStudio Current Surface Stack

DevStudio is a documentation/reveal tool. Its surface structure is a docs shell
with generated content pages and preview containers.

Evidence:

- `admin/src/main.ts` creates:
  - `.docs-shell`
  - `.docs-shell__sidebar`
  - `.docs-shell__main`
  - navigation groups and links
  - `.devstudio-token-editor` overlay and
    `.devstudio-token-editor__panel`
- `admin/src/main.ts` wraps fragments with `.devstudio-page` when a fragment
  does not already provide page chrome.
- `admin/src/css/layout.css` defines:
  - `.docs-shell` as sidebar/main app layout
  - `.docs-shell__sidebar` as sticky navigation plane
  - `.docs-shell__main` as main page area
  - `.devstudio-page` as page content plane
  - `.devstudio-page-layout` as outer page/layout plane
  - `.devstudio-page__header` as page header/action row
  - `.devstudio-page-section` as section plane
- `admin/src/css/dieter-previews.css` defines:
  - `.dieter-preview`
  - `.section`
  - `.component-wrapper`
  - `.compiler-preview-wrapper`
  - `.bob-preview-wrapper`
  - `.dieter-component-preview-*`

What is good:

- DevStudio has a clear shell/sidebar/main layout.
- It separates navigation, page content, page sections, preview wrappers, and
  token-editor overlay.
- The generated preview wrappers are honest reveal surfaces: they hold component
  examples and specs.

What is bad:

- DevStudio's living surface doc currently describes app-level Dieter
  consumption, not visual surface primitives.
- `wrapWithPageChrome` creates page surface chrome dynamically, which makes the
  actual surface stack less obvious to agents reading generated HTML fragments.
- Page, section, component preview, and token editor planes are local DevStudio
  concepts, not mapped to a shared Clickeen surface standard.
- Some DevStudio preview CSS still carries non-126J token cleanup issues that
  belong to the owning foundation/color PRDs. 126J must not preserve or rename
  those issues as surface doctrine.

## 5. Current Living Doc Drift

`documentation/engineering/UI/surfaces.md` is currently wrong for the corrected
126J domain.

Current doc reality:

- It is titled "how DevStudio, Roma, and Bob consume Dieter."
- It calls Bob the editor/bar, DevStudio reveal/governance, and Roma convergence
  target.
- It tracks Dieter consumption counts and component adoption.

What is useful:

- The doc records real by-reference Dieter consumption facts.
- Those facts can still help 126L/126M and Dieter adoption work.

What is wrong for 126J:

- It treats apps/product areas as "surfaces."
- It does not define the visual primitives that hold content and controls.
- It does not describe how surfaces compose into layouts and layouts compose
  screens.
- It points future agents toward the wrong abstraction layer.

The living doc must be rewritten after 126J convergence so future agents do not
repeat the mistake.

## 6. Cross-System As-Built Findings

### 6.1 Surface Ingredients Exist, Surface Law Does Not

Tokens and local implementations exist. The missing piece is the Clickeen law
that says what each container is for.

The code currently has:

- page frames
- navigation planes
- headers/action bands
- canvases/work areas
- module/section planes
- item/card planes
- tool/inspector panels
- preview planes
- overlay/dialog planes
- grids/stacks/action rows

The code does not have:

- a shared written definition of those primitives;
- deterministic agent instructions for when to use each one;
- a clear boundary between surface primitives, layout helpers, components, and
  app-specific screens.

### 6.2 Bob Is Directional For Operational Editor Layout

Bob shows the target kind of operational structure:

```text
full viewport frame -> context/action band -> tool panel + workspace preview
```

This is useful evidence, not a universal template. Roma and DevStudio do not
become Bob. They consume the same surface vocabulary according to their own job.

### 6.3 Roma Is Directional For Account Page Composition

Roma already points at the right sequence:

```text
account shell -> domain frame -> header + canvas -> modules/cards/tables
```

The problem is not that Roma has no surface thinking. The problem is that the
surface thinking is local, duplicated, and not yet Dieter/Clickeen doctrine.

### 6.4 DevStudio Is Directional For Reveal/Documentation Layout

DevStudio already points at:

```text
docs shell -> sidebar + main -> page -> sections -> previews
```

This is useful for 126L, but 126J must define the shared primitive boundaries
first so DevStudio cleanup does not become another local reinvention.

### 6.5 Overlay Planes Are Adjacent, Not Owned Here

Bob, Roma, and DevStudio all have overlay/dialog planes. 126J can identify that
they are layered surfaces. 126K owns dialog/modal mechanics, ARIA, dismissal,
backdrops, and overlay behavior.

126J must not build a modal framework.

### 6.6 Layout Helpers Are Adjacent, Not Owned As Components Here

Grids, stacks, toolbars, and action rows organize surfaces. They are layout
composition helpers. 126J should define their role, but 126I/components and the
screen refactor PRDs own exact component/API decisions if any are needed.

126J must not create generic layout machinery.

## 7. Current Gaps To Carry Into PRD

- The current `surfaces.md` living doc has the wrong subject.
- No shared Clickeen definition exists for surface primitive, layout, and
  screen/page composition.
- Bob, Roma, and DevStudio each use real surface stacks, but with local names
  and local composition rules.
- Roma has multiple local names for the same kind of module/content plane.
- DevStudio wraps page chrome dynamically and has local page/section/preview
  planes that are not mapped to shared law.
- Bob's preview plane is a real product preview host and must not be treated as
  a card/module.
- Overlay surfaces must be routed to 126K instead of being solved by 126J.
- Layout helpers must be documented without inventing a generic layout
  framework.

## 8. Compliance Notes

Architecture:

- Keeps Dieter tokens as the inner authority.
- Keeps components, surfaces, layouts, and screens as separate layers.
- Does not reinterpret apps as surfaces.

Product:

- No redesign.
- No product behavior change.
- No app refactor in this audit.
- Bob, Roma, and DevStudio keep their current product roles.

Product law:

- No new framework machinery.
- No compatibility aliases or legacy support paths.
- No guards/checks added by this audit.
- No step 4+ convergence.
