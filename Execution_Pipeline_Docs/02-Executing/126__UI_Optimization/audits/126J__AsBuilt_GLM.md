# 126J Surfaces — As-built audit: GLM (Phase-1 step 1, REDONE)

> GLM independent pass, redone at the corrected domain layer. **Not converged.**
> The prior GLM as-built for 126J was wrong-layer: it inventoried Dieter
> *consumption* per app (component counts, Roma parallel-system class counts).
> That is a Dieter-adoption audit, not a surfaces audit. This pass replaces it.
> Verified via `grep` + `ls` across `dieter/`, `roma/`, `bob/`, `admin/`.

## 0. Corrected domain boundary

126J owns the **surface design primitive** and how it composes upward:

```text
surface primitives -> layouts -> screens/pages
```

- A **surface** is a visual plane or container that holds content, controls, or
  previewed product output (a nav plane, a header band, a canvas, a module plane,
  a card, a tool panel, a preview plane, an overlay plane).
- A **layout** arranges surfaces (positions, sizes, reflows).
- A **screen/page** composes one or more layouts.

Bob, DevStudio, and Roma are **consumers** of this system. They are not the
definition of "surface." This matches the user direction and the redone Codex
as-built §0. An app is not a surface; an app *uses* surfaces.

## 1. Dieter surface substrate

Dieter supplies surface *ingredients* but no surface *primitive*.

Evidence (this pass):

- `dieter/components/` contains 26 component dirs: agent-activity, bulk-edit,
  button, choice-tiles, command-activity, dropdown-actions, dropdown-border,
  dropdown-edit, dropdown-fill, dropdown-shadow, dropdown-upload, icon,
  menuactions, object-manager, popaddlink, popover, repeater, segmented, shared,
  slider, tabs, textedit, textfield, textrename, toggle, valuefield.
- There is **no** `surface`, `card`, `panel`, `page`, or `layout` component. The
  atomic layer jumps from controls (button, dropdown-*, tabs…) straight to
  overlay hosts (bulk-edit, object-manager, popover). The mid-layer container
  that holds them is not a Dieter primitive.
- `dieter/tokens/dieter-color-tokens.css:15-16` defines the surface color role:
  `--role-surface: var(--color-system-white)` and
  `--role-surface-bg: var(--color-system-white)`. Both resolve to white — a flat,
  single-level surface model. No surface-elevation/tint ramp exists in tokens.

Reading: Dieter can *style* a surface (the color role, plus radius/spacing/shadow
tokens from 126H), but Dieter does not *declare* what a surface is. Every
consumer assembles surfaces locally from those ingredients.

## 2. Roma surface stack (account/domain composition)

Roma is the clearest directional example of surface → layout → screen, even
though every class is local Roma CSS.

Shell composition (`roma/components/roma-shell.tsx:35-53`):

```text
.roma-layout
  └ .roma-layout__nav        (aside — navigation plane)
  └ .roma-layout__main       (main)
      └ .rd-domain           (domain page frame)
          └ .rd-header       (header/action band: rd-header-left/title, rd-header-right)
          └ .rd-canvas       (section — work/content canvas; {children})
```

Surface vocabulary in `roma/app/roma.css` (this pass):

- shell layout: `.roma-layout` (:19), `.roma-layout__nav` (:31),
  `.roma-layout__main` (:134)
- domain frame: `.rd-domain` (:139)
- header/action band: `.rd-header` (:148) + left/title/right (:159-205)
- work canvas: `.rd-canvas` (:205), `.rd-canvas--builder` (:217),
  `.rd-canvas-module` (:226), `.rd-canvas-module__actions` (:242)
- **second** module-plane name: `.roma-module-surface` (:248)
- grid layout helpers: `.roma-grid` (:527), `.roma-grid--three` (:532)
- item/stat card plane: `.roma-card` (:536)
- action row: `.roma-toolbar` (:571), `.roma-toolbar-count` (:582)
- overlay planes (126K): `.roma-modal-backdrop` (:678), `.roma-modal` (:688),
  `.roma-modal__actions` (:707)
- responsive reflow: media-query block at :725+ retargets `.roma-layout`,
  `.roma-layout__nav`, `.rd-header`, `.roma-grid--three`

Reading: Roma already proves the intended sequence
`shell -> domain frame -> header + canvas -> modules/cards/tables`, distinguishes
page background from content modules, and has a real canvas. The model is right;
the vocabulary is local and duplicated (`.rd-canvas-module` and
`.roma-module-surface` are two names for the same module-plane role).

## 3. Bob surface stack (operational editor)

Bob is a dense operational editor. Surface composition
(`bob/components/BuilderApp.tsx:69-91`):

```text
.builder-app
  └ .builder-app__content
      └ ToolDrawer  (.tooldrawer)
      └ Workspace   (.workspace)
  └ UpsellPopup    (overlay)
```

Surface vocabulary in `bob/app/bob_app.css` (this pass):

- viewport frame: `.builder-app` (:22), two-column layout `.builder-app__content` (:32)
- top context/action band: `.topdrawer` (:46), `.topdrawer-actions` (:56),
  `.topdrawer-context-wrap` (:62), `.topdrawer-context` (:70),
  `.topdrawer-instance-title*` (:78-137)
- tool/inspector panel: `.tooldrawer` (:146), `.tooldrawer-copilot` (:320),
  `.tdcontent` (:166), `.tdmenu` (:182), `.tdmenucontent` (:189) + a large
  inspector sub-tree (header, mode-switch, translate, footer, fields, clusters,
  groups: :201-312), `.tdmenu-empty` (:312)
- preview/work plane: `.workspace` (:444), `.workspace-iframe` (:456),
  `.workspace-status-overlay` (:466), `.workspace-status-overlay--error` (:476),
  with host/canvas variants (`data-host='canvas'`, resize vars at :480-482)

Reading: Bob separates top-actions / tool-inspector / preview-workspace / overlay
cleanly. The workspace preview plane is a real product-preview host with
host/device variants — it is **not** a card/module and must not be treated as one.
The inspector (`.tdmenucontent*`) is a large first-class surface with its own
empty/cluster/group structure. All local names; none named as shared Clickeen
surface law.

## 4. DevStudio surface stack (reveal/docs composition)

DevStudio is a docs/reveal shell. Surface composition (`admin/src/main.ts`
builds `.docs-shell` → `__sidebar` + `__main`, wraps fragments in
`.devstudio-page`).

Surface vocabulary (this pass):

- docs shell: `.docs-shell` (`layout.css:20`), `.docs-shell__sidebar` (:28,
  collapsible via `data-sidebar`/`data-sidebar-state`), `.docs-shell__brand*`
  (:43-57), `.docs-shell__nav` (:74), `.docs-shell__main` (:131),
  `.docs-shell__menu-toggle` (:229); large collapsed/expanded sidebar state CSS
  at :145-273
- page planes: `.devstudio-page` (:181), `.devstudio-page-layout` (:188),
  `.devstudio-page__header` (:204), `.devstudio-page-section` (:218)
- reveal/preview planes (`dieter-previews.css`): `.dieter-preview` (:4),
  `.component-wrapper` (:95, :101), `.compiler-preview-wrapper` /
  `.bob-preview-wrapper` (:140-141), `.dieter-component-preview-*-wrapper`
  (:182-205)

Reading: DevStudio separates navigation, page content, page sections, preview
wrappers, and the token-editor overlay. The preview wrappers are honest reveal
surfaces (they hold component examples/specs). All local DevStudio concepts, not
mapped to a shared surface standard.

## 5. The surface vocabulary that exists in code (unnamed)

Across the three consumers, the same surface roles recur under different local
names. The code has, but does not name:

- page/app frame
- navigation plane
- header / action band
- canvas / work area
- module / section plane (Roma alone has ≥3 names: `rd-canvas-module`,
  `roma-module-surface`, `roma-card`)
- tool / inspector panel
- preview / reveal plane
- overlay / dialog plane (126K)
- grid / stack / action-row layout helpers

Nothing in the codebase states which surface role a new screen should use. Each
consumer invents its own class names and composition rules.

## 6. Layouts compose screens (the upward composition)

The composition is real in code, not theoretical:

- Roma: `roma-layout` (nav+main) → `rd-domain` (header+canvas) → domain children.
  One shell composes 14 domain screens via `{children}` on `.rd-canvas`.
- Bob: `builder-app` → `builder-app__content` (ToolDrawer + Workspace). One frame
  composes the editor screen.
- DevStudio: `docs-shell` (sidebar+main) → `devstudio-page` → sections/previews.
  One shell composes all reveal pages.

So "layouts organize surfaces, screens compose layouts" is already how the three
apps are built. The missing piece is a shared, named surface vocabulary so agents
compose deterministically instead of re-inventing per app.

## 7. Living doc is wrong-layer

`documentation/engineering/UI/surfaces.md` is titled "how DevStudio, Roma, and
Bob consume Dieter." It is a Dieter-consumption comparison (component counts,
parallel-system class counts), with stale track refs (`126C__PRD__DevStudio_UI`,
`126D__PRD__Roma_UI` — should be 126L/126M). It does not define the surface
primitive or how surfaces compose into screens. It points future agents at the
wrong abstraction layer and must be rewritten after convergence.

## 8. Known gaps (carried to PRD, no fixes chosen)

- No shared Clickeen definition of surface primitive / layout / screen
  composition.
- No Dieter surface component; surfaces are assembled locally per consumer.
- Dieter surface color role is flat (one level, white/white); no surface-depth
  ramp in tokens.
- Roma has multiple local names for the same module-plane role.
- Bob's preview plane is a product-preview host, not a card/module — no rule says
  so.
- DevStudio wraps page chrome dynamically, hiding the real surface stack from
  agents reading generated HTML.
- Layout helpers (grids, toolbars, action rows) exist but are not named as a
  layer distinct from components.
- Overlay planes live beside page/module surface code; mechanics belong to 126K.
- The living `surfaces.md` has the wrong subject and stale track refs.

## 9. Compliance notes

- This audit records current source reality at the surface-primitive layer. It
  does not choose fixes, does not converge with Codex, does not run step 4+.
- It treats apps as consumers, not as surfaces.
- It does not invent a surface component, layout engine, or modal framework.
- It routes overlay mechanics to 126K and component behavior to 126I.

— end GLM as-built, 126J (redone).
