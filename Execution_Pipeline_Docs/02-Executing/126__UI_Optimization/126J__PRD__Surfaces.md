# 126J - PRD: Surfaces

Status: PRE-EXECUTION DOCTRINE RECORDED - step-5 living doctrine reconciled; D2 workspace capability and surface ownership propagated; step-6/7/8 artifacts pending.
Parent: `126__PRD__UI_Optimization_Program.md`.
Audit input: `audits/126J__AsBuilt_Codex.md`.
Research input: `research/126J_Research_Codex.md`.
KB doc target: `documentation/engineering/UI/surfaces.md`.

This PRD redrafts 126J after correcting the domain meaning. It is not about
apps, services, product authorities, or Dieter consumption counts. It is about
the visual surface primitive and how surfaces compose into layouts and screens.

## 1. Role

126J defines Clickeen's surface and layout composition law:

```text
surface primitives -> layouts -> screens/pages
```

Definitions:

- A surface is a visual plane or container that holds content, controls, or
  rendered product output.
- The app background is the non-surface backdrop behind those planes.
- A layout organizes surfaces.
- A screen/page composes one or more layouts.
- Bob, DevStudio, and Roma consume the surface system. They are not themselves
  "the surfaces."

This matters because agents currently see local classes like module, card,
panel, preview, canvas, shell, and section, then improvise. 126J removes that
interpretation gap.

## 2. 126 Pre-GA No Legacy Compatibility Tenet

Clickeen is pre-GA. This PRD must not preserve old UI drift through
compatibility shims, temporary aliases, parallel old/new paths, or "support both"
transitions unless the human explicitly makes that behavior product law in this
PRD.

Once the 126J standard is decided:

- Fix source and docs to the standard.
- Remove incorrect local one-offs when the owning execution PRD touches that
  surface.
- Do not document removed names or removed behavior as supported alternatives.
- Do not add guards, deny lists, checks, or validation machinery to enforce this
  tenet. Clean the code and docs.

## 3. Human Product Direction Captured

The human direction for 126J is:

- "Surfaces" means the surface design primitive: containers and planes that
  hold content.
- Surfaces are organized and used in layouts.
- Layouts compose screens and pages.
- This applies to DevStudio, Roma, and Bob.
- Bob is already directionally closer to the target shape.
- 126J must not drift into app/product/service taxonomy.
- 126J must not add machinery.

This PRD follows that direction.

## 4. Current Reality Summary

### Dieter

Dieter has the ingredients:

- surface color roles;
- spacing;
- vertical rhythm;
- control radii and surface radius aliases;
- elevation shadows;
- component CSS/stencils.

Dieter does not currently have:

- a dedicated surface component;
- shared surface/layout framework machinery.

That is acceptable. 126J does not require building any of those.

### Roma

Roma already has a directional account-page stack:

```text
account shell -> domain frame -> header + canvas -> modules/cards/tables
```

Useful current primitives:

- navigation plane;
- domain frame;
- page header/action band;
- work/content canvas;
- module/content plane;
- repeated card plane;
- table plane;
- toolbar/action row;
- modal/overlay plane.

Current gap:

- The stack is local Roma CSS and names similar surface planes in several ways.
  126M owns Roma execution after this standard is final.

### Bob

Bob already has a directional operational-editor stack:

```text
full viewport frame -> top context/action band -> tool panel + preview workspace
```

Useful current primitives:

- editor frame;
- context/action band;
- inspector/tool panel;
- control content area;
- preview/workspace plane;
- preview iframe plane;
- status overlay;
- modal/overlay plane.

Current gap:

- These are local Bob classes and are not documented as shared Clickeen surface
  law. Bob should not be refactored by 126J, but its successful structure should
  inform the standard.

### DevStudio

DevStudio already has a directional reveal/docs stack:

```text
docs shell -> sidebar + main -> page -> sections -> previews
```

Useful current primitives:

- docs shell;
- sidebar navigation plane;
- main page area;
- page content plane;
- page section plane;
- component preview plane;
- token-editor overlay panel.

Current gap:

- The living `surfaces.md` doc currently describes app-level Dieter consumption
  instead of surface primitives.
- DevStudio page/section/preview planes are local to DevStudio and must be
  mapped to the Clickeen standard during 126L.

## 5. Proposed Clickeen Surface Standard

126J defines the following primitive meanings. These are product/design-system
words, not a mandate to build a framework.

### 5.1 Non-Surface App Backdrop

The app background is the environment behind work surfaces.

Use for:

- whole app/screen backdrop;
- page background;
- workspace outside the active content plane.

Rules:

- It is not a surface or content container.
- Do not put page content directly on a decorative background when it needs a
  content plane.
- Use Dieter color tokens by reference.

### 5.2 Navigation Plane

A navigation plane holds product navigation or section navigation.

Use for:

- Roma account navigation;
- DevStudio docs navigation;
- compact navigation drawers when responsive layouts collapse.

Rules:

- It organizes movement, not content modules.
- It must not become a card list by default.
- It uses surface/background/radius/spacing tokens by reference.

### 5.3 Header / Action Band

A header/action band holds the screen title, current context, and primary
actions for that screen or work area.

Use for:

- Roma domain headers;
- Bob top context/actions;
- DevStudio page headers.

Rules:

- It is a layout band, not a card.
- It can be transparent when the surrounding layout already provides the plane.
- Save/status/action behavior belongs to 126E interactions; 126J only owns where
  the action band sits in layout.

### 5.4 Canvas / Work Area

A canvas/work area is the primary surface region where the screen's work
happens.

Use for:

- Roma domain content area;
- Bob workspace;
- DevStudio main reveal area.

Rules:

- It can contain modules, cards, previews, tables, or tool panels depending on
  the product job.
- It is not itself an item card.
- It should preserve operational density where users are managing data or
  editing product artifacts.

### 5.5 Module / Section Plane

A module/section plane groups a bounded set of related content or controls.

Use for:

- account settings sections;
- billing/usage sections;
- widget-defaults sections;
- DevStudio documentation sections;
- bounded editor/settings groups.

Rules:

- Use this for a real content group.
- Do not wrap every text block or page band in a new module just to create visual
  decoration.
- Do not nest module planes inside module planes unless the product structure
  truly has nested groups.

### 5.6 Item / Card Plane

An item/card plane represents one repeated item, object summary, stat, or compact
selectable record.

Use for:

- repeated account objects;
- compact metrics;
- selectable options when a component does not already own the selection UI.

Rules:

- Cards are not the default page structure.
- Cards must not replace tables/lists where structured operational data is the
  better fit.
- Do not put page sections inside cards because the agent wants a quick visual
  wrapper.

### 5.7 Tool / Inspector Panel

A tool/inspector panel holds controls that edit or inspect the current product
artifact.

Use for:

- Bob ToolDrawer;
- future Roma/DevStudio inspectors where a real editing/inspection workflow
  needs one.

Rules:

- It is a work panel, not a modal and not a card.
- It should be dense and predictable.
- The components inside the panel belong to 126I.

### 5.8 Preview Plane

A preview plane renders product output for inspection.

Use for:

- Bob widget preview iframe/workspace;
- DevStudio component preview regions;
- any future page/widget/product output preview.

Rules:

- A preview plane is not a card.
- It must preserve the truth of the rendered artifact.
- It can have host/device framing when the product requires preview context.
- Public widget runtime behavior remains widget-owned; 126J governs the system
  UI plane that hosts a preview, not the widget's internal UI.

### 5.9 Overlay / Dialog Plane

An overlay/dialog plane is a layered surface above the current screen.

Use for:

- blocking dialogs;
- focused modal tasks;
- account notices;
- upsell/entitlement prompts;
- token editor panel.

Rules:

- 126J only identifies that overlays are layered surfaces.
- 126K owns modal/dialog mechanics, ARIA, dismissal, backdrop, and behavior.
- Do not build overlay machinery in 126J.

### 5.10 Layout Helpers

Stacks, grids, toolbars, and action rows organize surfaces and content.

Rules:

- They are layout helpers, not content surfaces.
- A toolbar/action row holds actions. It is not a card.
- A grid arranges repeated planes or content regions. It is not itself a
  surface.
- If an exact shared helper API is needed, 126I/components or the owning screen
  PRD decides it. 126J does not build a layout framework.

## 6. Deterministic Agent Rules

When an agent codes UI after 126J:

1. Identify the product job first: navigation, context/actions, main work,
   content group, repeated item, inspector controls, preview, or overlay.
2. Choose the matching surface primitive from this PRD.
3. Use Dieter tokens by reference for color, spacing, radius, and elevation.
4. Use existing Dieter components for controls.
5. Do not turn every group into a card.
6. Do not invent a new local container name when an existing surface primitive
   describes the job.
7. Do not introduce new global surface/layout framework machinery.
8. Route modal mechanics to 126K, component APIs to 126I, DevStudio screen
   execution to 126L, and Roma screen execution to 126M.

## 7. Gap List

126J identifies these gaps:

- `documentation/engineering/UI/surfaces.md` is about app-level Dieter
  consumption and must be rewritten to the corrected surface/layout meaning.
- Roma has the right directional account-page composition but local overlapping
  names for module/content/card surfaces.
- Bob has a strong operational-editor composition but no shared documentation
  that tells future agents why its preview plane/tool panel/action band are
  different primitives.
- DevStudio has shell/page/section/preview planes, but they are local docs-tool
  constructs and not mapped to Clickeen surface law.
- Overlay/dialog planes appear in multiple apps and must be routed to 126K.
- Layout helpers exist locally as stacks/grids/toolbars/action rows, but the
  difference between helper and surface is not documented.

## 8. Execution Direction After Convergence

This PRD does not execute code. After human convergence and peer review, the
execution direction is:

1. Rewrite `documentation/engineering/UI/surfaces.md` so it defines the
   corrected primitive:

   ```text
   surface primitives -> layouts -> screens/pages
   ```

   Compliance: fixes documentation at the source of future agent confusion
   instead of adding enforcement machinery.

2. During 126L, map DevStudio shell/page/section/preview/token-editor planes to
   this standard and remove local drift where the standard makes it unnecessary.

   Compliance: DevStudio screen cleanup stays in DevStudio's owning PRD.

3. During 126M, map Roma shell/domain/header/canvas/module/card/table planes to
   this standard and collapse duplicated local surface names.

   Compliance: Roma account UI cleanup stays in Roma's owning PRD and does not
   happen as a side effect of 126J.

4. Preserve Bob's successful editor structure as a reference for operational UI,
   and only change Bob where a later owning PRD identifies a real gap.

   Compliance: prevents 126J from becoming a Bob rewrite.

5. Keep overlay mechanics in 126K and component implementation details in 126I.

   Compliance: preserves domain boundaries and avoids universal machinery.

## 9. Out Of Scope

- App/service/product-authority taxonomy.
- Dieter consumption counts by Bob/DevStudio/Roma.
- Bob rewrite.
- DevStudio UI rewrite.
- Roma UI rewrite.
- Modal/dialog behavior implementation.
- Component API implementation.
- New global surface/layout framework machinery.
- Validation/check machinery.
- Public widget runtime UI doctrine.

## 10. Compliance To Architecture, Product, And Product Law

Architecture:

- Keeps Dieter as the token/component authority.
- Defines the missing layer between components and screens.
- Keeps 126I, 126J, 126K, 126L, and 126M ownership separate.
- Treats public widgets as separate product runtimes, not Dieter/system UI.

Product:

- No redesign.
- No product behavior change.
- No save, translation, asset, account, deploy, or data-path change.
- Preserves Bob, DevStudio, and Roma product jobs while making their shared UI
  layer legible.

Product law:

- No invented framework machinery.
- No legacy compatibility path.
- No guards/checks to memorialize bad concepts.
- No reinterpretation of "surfaces" into app/service taxonomy.
- No step 4+ execution in this PRD.

## 11. Human-Converged Surface Law

The product owner decision register accepts this 126J definition:

```text
surface primitives -> layouts -> screens/pages
```

and the primitive set:

- navigation plane;
- header/action band;
- canvas/work area;
- module/section plane;
- item/card plane;
- tool/inspector panel;
- preview plane;
- overlay/dialog plane;
- layout helpers as non-surface organizers.

The app background is the non-surface backdrop behind that set.

Operational layouts also follow the accepted global workspace-capability law:
resolution governs sharpness, usable workspace governs composition, and form
factor governs the expected experience. Desktop and full-screen tablets in
either orientation retain the desktop workspace; mobile landscape uses compact
composition; mobile portrait receives an explicit orientation/size boundary.
This is capability-based layout law, not a universal pixel breakpoint or device
registry.

The accepted composition remains intentionally simple: full mode is persistent
left navigation plus a flexible work area; compact mode is a menu button plus a
full-width work area with the same navigation in an overlay drawer. Bob nests
the same pattern as ToolDrawer plus preview/workspace. D2 does not authorize new
domain layouts, mobile screen variants, or a shared shell framework.

There is no open 126J conceptual decision. D2 doctrine is now propagated. The
remaining work is the exact step-6 gap audit, the step-7 executable PRD, and
step-8 peer review before any step-9 execution.

## Frozen GLM Addendum — Phase 1 Step 2 (independent pass, correct layer)

This addendum is point-in-time review evidence. Its proposals and counts are not
current doctrine; the settled surface law earlier in this PRD controls.

GLM's independent as-built (`audits/126J__AsBuilt_GLM.md`, redone at the correct
layer) and research (`research/126J_Research_GLM.md`, redone at the correct
layer) confirm Codex's corrected domain layer and sharpen it. This is feedback
only; it does not merge, override, or rewrite Codex's text. Every claim below is
backed by a `file:line` GLM read independently for its own as-built.

### Layer correction confirmed

Both passes now agree: 126J = `surface primitives -> layouts -> screens/pages`.
Apps (Bob/DevStudio/Roma) are consumers, not surfaces. The prior wrong-layer
artifacts — the Dieter-consumption comparison — are superseded on both sides.

### What Codex's redraft gets right

- §1/§3 state the correct layer and capture the human direction verbatim.
- §5 primitive set is the right shape and covers the surface roles the code
  already implements. App background, nav plane, header band, canvas, module
  plane, card plane, inspector panel, preview plane, overlay plane, and layout
  helpers map onto what Roma/Bob/DevStudio already build.
- Anti-machinery discipline holds: no `<Surface>` component mandate, no layout
  engine, no surface registry. Naming the roles IS the deterministic framework.
- Ownership boundaries (126K overlays, 126I components, 126L/126M screens) are
  respected throughout.
- §5.8 preview-plane rule correctly splits the system-UI preview plane from
  widget runtime — consistent with the 126D/126F two-lane authority.

### Independent file:line evidence for §4/§5 (GLM grep, this pass)

- **No Dieter surface primitive:** the reviewed tree now has 25 component
  directories including non-rendered `shared`;
  none is `surface`/`card`/`panel`/`page`/`layout`. Confirms §4 "Dieter does not
  currently have a dedicated surface component."
- **Surface color role is flat:** `dieter-color-tokens.css:15-16` —
  `--role-surface` and `--role-surface-bg` both `var(--color-system-white)`.
- **Roma composition:** `roma-shell.tsx:35-53` is literally
  `roma-layout -> __nav + __main -> rd-domain -> rd-header + rd-canvas{children}`.
  Surface classes in `roma.css`: layout (:19/:31/:134), domain (:139), header
  (:148), canvas (:205/-module :226), second module name `.roma-module-surface`
  (:248), grid (:527), card (:536), toolbar (:571), modal (:688), responsive
  reflow (:725+).
- **Bob composition:** `BuilderApp.tsx:69-91` is
  `builder-app -> builder-app__content(ToolDrawer + Workspace) + UpsellPopup`.
  Classes in `bob_app.css`: frame (:22), content (:32), topdrawer (:46+),
  tooldrawer (:146), tdmenucontent (:189-312), workspace (:444),
  workspace-iframe (:456, host/canvas variants :480).
- **DevStudio composition:** `docs-shell` (:20) + collapsible `__sidebar` (:28) +
  `__main` (:131); page planes `devstudio-page*` (:181-218); reveal wrappers in
  `dieter-previews.css` (:4/:101/:140).
- **Living doc wrong-layer:** `surfaces.md` is titled "how DevStudio, Roma, and
  Bob consume Dieter," stale track refs `126C`/`126D` (should be `126L`/`126M`).

### What Codex under-claims or misses

1. **The flat-surface-depth gap is absent from §7.** `--role-surface` and
   `--role-surface-bg` both resolve to white — a single-level surface model with
   no depth/elevation/tonal ramp in tokens. Every north star has systematic
   surface depth (M3 elevation + tonal overlays; Apple materials). This is a
   real, source-grounded gap and the one substantive omission. 126J should name
   it and route the depth decision to 126B/126H; it must not build a ramp here.
2. **Roma's duplicated module-plane names aren't pinned.** §4 says "names similar
   planes in several ways" without citation. GLM: `.rd-canvas-module`
   (`roma.css:226`) and `.roma-module-surface` (:248) are two names for the same
   module-plane role — concrete drift for 126M to collapse.
3. **Bob's preview-plane distinction needs its evidence.** §5.8 says a preview
   plane is not a card — correct. The proof is `.workspace`/`.workspace-iframe`
   (`bob_app.css:444`/`:456`) with host/canvas variants (`data-host`,
   `--workspace-canvas-*` at :480). Citing it makes the rule stick for agents.
4. **DevStudio's dynamic page chrome hides the stack.** `wrapWithPageChrome`
   builds `.devstudio-page` dynamically, so agents reading generated HTML cannot
   see the surface stack. Worth stating explicitly as a 126L legibility target,
   not just a loose note.

### Where Codex's research is still at the app layer

Codex's research (`research/126J_Research_Codex.md`) cites the right sources (M3
canonical layouts, Apple split-views/sidebars, OpenAI display modes) but its §0
framing — "how major product surfaces organize work" — is still the app layer.
The same sources read more usefully at the primitive layer: what a surface *is*,
how layouts arrange surfaces, how surface depth is expressed. GLM's redone
research reframes them at that altitude. The two are compatible; GLM's is at the
right altitude for 126J.

### Minor framing point

§5.1 lists "App Background" as a surface primitive. The app background is the
backdrop *behind* surfaces, not a surface itself. Minor, but calling the backdrop
a "surface" could mislead agents into treating the background as a content
container. Consider framing it as the non-surface backdrop, or moving it out of
the primitive set into a preamble.

### Net

Codex's redraft is a strong correct-layer baseline. GLM's independent pass
confirms the layer correction, supplies the missing `file:line` evidence for the
§4/§5 claims, adds the one substantive omission (flat surface depth → 126B/126H),
and reframes the research altitude. The §11 convergence decision is well-formed;
the primitive set is sound.
