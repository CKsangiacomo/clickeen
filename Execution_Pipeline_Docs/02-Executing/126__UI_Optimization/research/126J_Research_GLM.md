# 126J — Source research: Surfaces (GLM, Phase-1 step 3, REDONE)

> GLM independent pass, redone at the corrected domain layer. **Not converged.**
> The prior GLM research for 126J was wrong-layer: it asked "do M3/Apple/OpenAI
> have clickeen's parallel-system problem?" — a 126M Roma question. This pass
> asks the actual 126J question: **what is the surface primitive, and how do
> surfaces compose into layouts and screens?** First-party sources only.

## Research lens

126J owns `surface primitives -> layouts -> screens/pages`. The research question
for each source is:

1. What **surface roles/primitives** does the source name (nav plane, header
   band, canvas, module plane, inspector, preview plane, overlay)?
2. How do **layouts** arrange those surfaces into screens?
3. How is **surface depth/hierarchy** expressed?
4. What is the source's **composition model** (controls → surfaces → screens)?

## Material 3

Sources: m3.material.io/foundations/layout (overview, canonical-layouts,
list-detail), /components (navigation-bar, navigation-rail, navigation-drawer,
lists, cards, side-sheets), /styles/elevation (overview, applying-elevation),
/foundations/design-tokens.

- **Canonical layouts are surface compositions.** Feed, list-detail, and
  supporting-pane are named arrangements of surfaces. List-detail is literally
  two surfaces (list pane + detail pane) composed by a layout, collapsing to one
  pane on smaller surfaces. This is the clearest first-party model of
  `surfaces -> layout -> screen`.
- **Navigation is a surface primitive that scales by available size.** Bar
  (small), rail (medium), drawer (large/expanding) are the *same* nav-plane role
  expressed at different surface sizes. A nav plane is a declared surface, not
  per-screen invention.
- **Elevation IS surface depth.** M3 elevation (levels 0–5) is not just shadow;
  it is foreground/background hierarchy expressed through shadows **and tonal
  overlays** — a surface at a higher elevation gets a different tone. Surfaces
  have a named depth ramp, not a flat single level.
- **Surface color roles name the plane.** M3 defines `surface`, `on-surface`,
  `surface-variant`, and a `surface-container` family (low/medium/high). The
  surface is a first-class colorable plane with built-in hierarchy. This is the
  most direct first-party analog to clickeen's `--role-surface`.
- **Cards are a named surface role** for grouped content, distinct from the
  canvas/list/detail surfaces around them.

Implication for clickeen: M3 treats the surface as a declared, depth-bearing,
colorable plane and gives named composition patterns (list-detail,
supporting-pane) for arranging surfaces into screens. clickeen currently has a
flat single-level surface color role (`--role-surface`/`-bg` both white) and no
named composition patterns.

## Apple HIG

Sources: developer.apple.com/design/human-interface-guidelines/ (layout,
sidebars, split-views, toolbars, lists-and-tables, panels, modality, sheets,
materials).

- **Split view is the canonical multi-surface composition.** Sidebar + content,
  or sidebar + content + inspector — a split view composes two or three surfaces
  into one screen and lets the user resize/rearrange them. This is Apple's
  `surfaces -> layout -> screen` primitive.
- **Recurring surface roles are named and distinct:** sidebar (nav/navigation +
  collections), toolbar (header/action band carrying title + actions), inspector
  / panel (tool/detail surface), list/table (structured content surface). These
  map almost 1:1 onto the unnamed roles clickeen already has in code
  (nav plane, header band, tool/inspector panel, canvas).
- **Materials express surface depth via translucency** (regular/thin/thick/
  ultra-thick), separating foreground controls from background content. Surface
  depth is systematic, not ad hoc.
- **Sheets/modality are a distinct overlay surface** with explicit blocking
  semantics — a separate surface role, not a styled card.
- **Layout adapts while staying recognizable.** A surface reflows across sizes
  without becoming a different product.

Implication for clickeen: Apple names exactly the surface roles clickeen's three
apps already implement locally (sidebar=nav, toolbar=header band,
inspector=tool panel, content=canvas). The vocabulary clickeen is missing already
exists as first-party doctrine. Apple's split view is the direct model for Bob's
(tool panel + workspace) and Roma's (nav + main → header + canvas).

## OpenAI Apps SDK

Sources: developers.openai.com/apps-sdk/ (concepts/ui-guidelines,
concepts/ux-principles, build/chatgpt-ui, build/state-management).

- **Display modes are surface modes.** Inline card, carousel, fullscreen, and
  picture-in-picture are *different surface shapes for different jobs*: compact
  single-purpose action, comparable set, deep workspace, persistent live
  auxiliary. Not every surface should be the same shape.
- **Hosted UI is an embedded surface.** A component renders as an iframe/bridge
  view *inside* a host — a surface within a host shell, not a standalone app
  replica. This models surfaces that live inside a larger frame (relevant to
  widget runtime and any agent-hosted UI).
- **Structured results render on a surface.** Tool results, model-visible
  content, and component `_meta` are separated; the surface reveals structured
  state, not decoration.
- **Composition favors small focused surfaces.** Inline cards for focused
  actions/data; fullscreen only for deeper tasks. Discourages nested scrolling,
  deep navigation inside cards, ornamental UI, wholesale app replication.

Implication for clickeen: OpenAI validates that different surface modes are
legitimate when jobs differ (Bob editor = fullscreen workspace; a widget control
= inline card; live agent activity = persistent auxiliary). It also reinforces
the boundary between a surface and the product truth it reveals.

## Cross-source synthesis

- **All three treat the surface as the composition unit between controls and
  screens.** None collapses "surface" down to a component or up to an app. The
  layer clickeen is missing is exactly the layer all three address.
- **Surface roles recur across all three:** navigation plane, header/action band,
  content canvas, inspector/tool panel, grouped-content card, overlay. clickeen
  has all of these in code under local names.
- **Surface depth/hierarchy is systematic in every source** (M3 elevation+tonal,
  Apple materials). clickeen's surface model is flat (one white level).
- **Composition patterns are named** (M3 list-detail/supporting-pane, Apple split
  view). clickeen composes screens the same way but names nothing.
- **Different surface modes are legitimate when jobs differ** — editor, reveal,
  account-operations are legitimately different surface compositions, not one
  ideal shell.

## Non-binding relevance for clickeen (not doctrine)

- 126J can name a surface vocabulary (page frame, nav plane, header band, canvas,
  module plane, card, inspector/tool panel, preview/reveal plane, overlay)
  without inventing a component — it is a naming/composition standard, not a
  `<Surface>` primitive mandate.
- The flat surface-depth model is a real, source-grounded gap (every north star
  has systematic depth), but expanding it touches 126B color and 126H elevation;
  126J should name the gap, not build a depth ramp here.
- M3 list-detail / Apple split-view give first-party backing for the layouts
  clickeen already uses (Bob tool+workspace, Roma nav+main).
- Overlay surfaces route to 126K; layout-helper components (grid/toolbar/action
  row) route to 126I. 126J owns the surface-role vocabulary and the
  surface→layout→screen composition law, not the mechanics.

## Compliance notes

- First-party Google Material, Apple Developer/HIG, and OpenAI documentation
  only. No third-party blogs, Reddit, StackOverflow, or secondary explainers.
- Findings are directional reference at the surface-primitive layer, reframed
  from the same first-party sources Codex indexed. Not doctrine.
- No research item authorizes a step-4 fix or selects a Clickeen standard. Human
  convergence decides.

— end GLM research, 126J (redone).
