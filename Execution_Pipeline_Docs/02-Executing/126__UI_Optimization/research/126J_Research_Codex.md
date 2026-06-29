# 126J Surfaces - Codex Source Research

Status: CODEX ONLY - Phase 1 step 3 redo.
Sources: first-party Google Material 3, Apple HIG, and OpenAI Apps SDK/UI
guidance only.
Purpose: source-grounded reference for visual surface primitives and layout
composition. This is not doctrine and does not converge with GLM.

## 0. Research Boundary

126J uses "surface" in the design primitive sense:

```text
surface primitives -> layouts -> screens/pages
```

This research is not about product areas, app boundaries, service ownership,
Dieter consumption counts, or route/runtime authorities.

It asks:

- How do the source systems think about visual planes and containers?
- How do they compose containers into layouts?
- When is a card/panel/sheet/sidebar/preview plane appropriate?
- What should Clickeen learn without importing a giant framework or a mobile app
  doctrine?

## 1. Source Index

Material 3:

- Layout overview:
  https://m3.material.io/foundations/layout/layout-overview/overview
- Applying layout:
  https://m3.material.io/foundations/layout/applying-layout
- Canonical layouts:
  https://m3.material.io/foundations/layout/canonical-layouts
- Cards:
  https://m3.material.io/components/cards
- Side sheets:
  https://m3.material.io/components/side-sheets/guidelines
- Dialogs:
  https://m3.material.io/components/dialogs
- Elevation:
  https://m3.material.io/styles/elevation
- Applying elevation:
  https://m3.material.io/styles/elevation/applying-elevation

Apple HIG:

- Layout:
  https://developer.apple.com/design/human-interface-guidelines/layout
- Sidebars:
  https://developer.apple.com/design/human-interface-guidelines/sidebars
- Split views:
  https://developer.apple.com/design/human-interface-guidelines/split-views
- Toolbars:
  https://developer.apple.com/design/human-interface-guidelines/toolbars
- Lists and tables:
  https://developer.apple.com/design/human-interface-guidelines/lists-and-tables
- Panels:
  https://developer.apple.com/design/human-interface-guidelines/panels
- Sheets:
  https://developer.apple.com/design/human-interface-guidelines/sheets
- Materials:
  https://developer.apple.com/design/human-interface-guidelines/materials

OpenAI:

- Apps SDK UI guidelines:
  https://developers.openai.com/apps-sdk/concepts/ui-guidelines
- Apps SDK UX principles:
  https://developers.openai.com/apps-sdk/concepts/ux-principles
- Build ChatGPT UI:
  https://developers.openai.com/apps-sdk/build/chatgpt-ui
- State management:
  https://developers.openai.com/apps-sdk/build/state-management

## 2. Material 3 Findings

### 2.1 Layout Organizes Content, Not Decoration

Material treats layout as the structure that arranges content, controls, and
navigation so users can understand hierarchy and act.

Relevance to Clickeen:

- A Clickeen surface standard should start from job and hierarchy, not visual
  skin.
- Bob, Roma, and DevStudio can have different screen layouts while sharing the
  same primitive vocabulary.
- 126J should not force every screen into the same page shape.

### 2.2 Canonical Layouts Are Families, Not Mandatory Templates

Material canonical layouts such as list-detail and supporting-pane describe
common relationships between content and supporting controls. They are useful
because they name a layout relationship.

Relevance to Clickeen:

- Roma account domains often need content list/detail/module relationships.
- Bob already uses a supporting-pane/editor relationship: tool panel plus
  preview workspace.
- DevStudio already uses sidebar/main/page/preview relationships.
- Clickeen should name its own current relationships instead of importing the
  full M3 canonical-layout catalog.

### 2.3 Cards Are For Bounded Content, Not Page Structure

Material cards group related content and actions. They are one container type,
not a default wrapper for every page section.

Relevance to Clickeen:

- Repeated records, stats, or compact object summaries can be cards.
- Whole pages, app sections, canvases, and preview hosts should not become card
  piles.
- This directly matches the Clickeen need: stop agents from using "card" as the
  universal answer to every UI container.

### 2.4 Side Sheets And Dialogs Are Layered Surfaces With Different Jobs

Material distinguishes side sheets, dialogs, and other layered surfaces by
attention and task relationship.

Relevance to Clickeen:

- Tool panels, inspectors, side panes, and dialogs are not interchangeable.
- 126J may identify side/inspector/panel planes.
- 126K owns dialogs and modal mechanics.

### 2.5 Elevation Is Hierarchy, Not Just Shadow

Material elevation expresses hierarchy through depth, tonal separation, and
shadow where appropriate.

Relevance to Clickeen:

- 126J should specify when a surface is simply separated by background versus
  when it is an elevated/floating plane.
- Clickeen should use existing Dieter color/radius/shadow tokens instead of
  each app inventing local shadow/radius recipes.
- This is not permission to import a large M3 elevation system.

## 3. Apple HIG Findings

### 3.1 Layout Preserves Relationship Across Contexts

Apple frames layout around clear relationships between content, controls, and
navigation across window sizes and contexts.

Relevance to Clickeen:

- Clickeen should define stable relationships: navigation plane, header/action
  band, canvas, module, card, inspector, preview.
- Responsive changes should preserve those relationships instead of creating a
  different product structure.
- This supports the current Roma mobile collapse pattern without importing a
  mobile-app touch-target doctrine.

### 3.2 Sidebars, Split Views, And Toolbars Express Hierarchy

Apple sidebars, split views, and toolbars are layout primitives for navigation,
selection, details, and actions.

Relevance to Clickeen:

- Roma's nav/main/domain/header/canvas split is the right kind of account app
  structure to make explicit.
- Bob's tool drawer plus workspace is an editor split.
- DevStudio's sidebar plus main docs page is a reveal/docs split.
- The shared standard should document the primitive relationship, not force a
  shared React component.

### 3.3 Lists And Tables Are Operational Content Surfaces

Apple distinguishes lists/tables from generic content cards. Dense operational
data gets structured surfaces, not decorative wrappers.

Relevance to Clickeen:

- Roma account domains should preserve operational density where tables/lists
  are the right surface.
- A table plane is not a card and should not be styled as one by default.
- This matters for Clickeen because customers operate account/product data in
  Roma, not a marketing website.

### 3.4 Panels And Sheets Have Narrow Jobs

Apple panels and sheets support focused inspection, auxiliary controls, or
modal tasks. They are not generic page sections.

Relevance to Clickeen:

- Bob's tool drawer is an inspector/tool panel.
- DevStudio's token editor is an overlay panel.
- Roma account notice and monetization flows are modal/overlay concerns.
- 126J should classify these planes and route modal behavior to 126K.

### 3.5 Materials Are Background Treatments, Not Product Doctrine

Apple materials help distinguish background and foreground regions. They are
platform-specific visual treatments.

Relevance to Clickeen:

- Clickeen can learn the distinction between background, foreground, and
  floating planes.
- Clickeen should not import Apple material effects, blur systems, or platform
  visual treatments.

## 4. OpenAI Findings

### 4.1 Hosted UI Must Fit The Host Surface

OpenAI Apps SDK guidance treats UI as a hosted experience inside ChatGPT. The
UI must respect the host container and choose the right display mode for the
task.

Relevance to Clickeen:

- The key lesson is fit-to-host: a preview plane, embedded widget, editor, and
  account page do not have the same container contract.
- Bob's workspace iframe is a preview host, not a normal content card.
- Public widgets are product runtimes with their own JS and should not be
  forced into Dieter/system surface rules.

### 4.2 Keep UI Focused And Avoid Full-App Rebuilds Inside Small Containers

OpenAI guidance pushes embedded UI toward focused task surfaces rather than
rebuilding a whole app inside a small host.

Relevance to Clickeen:

- Clickeen agents should not nest full app shells inside modules/cards.
- A module should do one product job.
- If a surface needs navigation, inspector, preview, or modal behavior, use the
  named primitive instead of stacking generic containers.

### 4.3 State And UI Must Stay In Sync

OpenAI hosted UI guidance includes state-management concerns because the host
and component need shared truth.

Relevance to Clickeen:

- Surface choice must match product truth: preview plane for rendered output,
  inspector/tool panel for editing controls, module plane for bounded content,
  overlay plane for blocking or focused tasks.
- This connects 126J to 126E interactions: state vocabulary says what happened;
  126J says where that state is displayed when it is a surface/layout concern.

## 5. Cross-Source Synthesis

The three source systems agree on the important point:

- surfaces are containers/planes with jobs;
- layouts organize those planes into hierarchy;
- not every group is a card;
- side panels, previews, sheets, dialogs, lists, tables, and modules are
  different primitives;
- visual depth supports hierarchy, but it should not become decoration.

For Clickeen, the right source-grounded approach is:

- define the current Clickeen surface vocabulary;
- map Bob, Roma, and DevStudio to that vocabulary;
- use Dieter tokens by reference for colors, radius, spacing, and shadows;
- keep modal mechanics in 126K;
- keep component APIs in 126I;
- keep DevStudio/Roma screen refactors in 126L/126M;
- avoid importing M3/Apple/OpenAI as frameworks.

## 6. Non-Binding Recommendations For Human Convergence

1. Define surface primitive law around a small Clickeen set:
   app background, nav plane, header/action band, canvas/work area,
   module/section plane, item/card plane, tool/inspector panel, preview plane,
   and overlay/dialog plane.

2. State explicitly that layouts organize surfaces and screens/pages compose
   layouts.

3. State explicitly that Bob, Roma, and DevStudio are consumers of the surface
   standard, not the definition of "surfaces."

4. Make card use narrow: repeated items/object summaries only, not default page
   structure.

5. Keep the standard as documentation plus small CSS/component convergence in
   owning PRDs. Do not create new global surface/layout framework machinery.

6. Rewrite the living `surfaces.md` after convergence so future agents do not
   repeat the app-boundary mistake.
