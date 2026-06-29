# 126L DevStudio UI - Codex Source Research

Status: CODEX ONLY - Phase 1 step 3.
Sources: first-party Google Material 3, Apple HIG, and OpenAI Apps SDK/UI
guidance only.
Purpose: external reference for DevStudio UI screen planning. This is not
doctrine and does not converge with GLM.

## 0. Research Boundary

126L is about the DevStudio UI surface: navigation shell, source reveal,
governance/editor surfaces, generated documentation/showcase pages, inspection
views, and controls used by the one human to steer source-controlled truth.

This research does not choose Clickeen fixes.

## 1. Source Index

Material 3:

- Design system overview: https://m3.material.io/
- Adaptive design overview:
  https://m3.material.io/foundations/adaptive-design/overview
- Layout overview:
  https://m3.material.io/foundations/layout/layout-overview/overview
- Applying layout:
  https://m3.material.io/foundations/layout/applying-layout
- Navigation drawer:
  https://m3.material.io/components/navigation-drawer/guidelines
- Navigation rail:
  https://m3.material.io/components/navigation-rail/overview
- Lists:
  https://m3.material.io/components/lists/overview
- Tabs:
  https://m3.material.io/components/tabs
- Text fields:
  https://m3.material.io/components/text-fields/overview
- Buttons:
  https://m3.material.io/components/buttons/guidelines
- Dialogs:
  https://m3.material.io/components/dialogs

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
- Inspectors:
  https://developer.apple.com/design/human-interface-guidelines/inspectors
- Controls:
  https://developer.apple.com/design/human-interface-guidelines/controls
- Text fields:
  https://developer.apple.com/design/human-interface-guidelines/text-fields
- Modality:
  https://developer.apple.com/design/human-interface-guidelines/modality

OpenAI:

- Apps SDK UI guidelines:
  https://developers.openai.com/apps-sdk/concepts/ui-guidelines
- Apps SDK UX principles:
  https://developers.openai.com/apps-sdk/concepts/ux-principles
- Build ChatGPT UI:
  https://developers.openai.com/apps-sdk/build/chatgpt-ui
- Design components:
  https://developers.openai.com/apps-sdk/plan/components
- App submission guidelines:
  https://developers.openai.com/apps-sdk/app-submission-guidelines

## 2. Material 3 Findings

### 2.1 Layout Directs Attention And Action

Material treats layout as the way a product arranges content so people can
understand hierarchy, move through information, and act.

Implications for later DevStudio convergence:

- DevStudio should be evaluated as a work cockpit, not a marketing page.
- Navigation, content regions, previews, token/editor controls, and status
  feedback are all part of the UI system.
- Source-derived reveal does not remove the need for clear information
  hierarchy.

### 2.2 Adaptive Navigation Should Match Information Architecture

Material navigation drawers/rails/bars map to destination count, hierarchy, and
available surface size.

Implications for later DevStudio convergence:

- DevStudio's Foundations, Components, and Policy groups need a declared
  navigation model.
- Responsive sidebar behavior should be judged against hierarchy and repeated
  work, not against appearance alone.

### 2.3 Controls And Text Fields Are System Components

Material text fields, buttons, tabs, and related controls are defined as
component families with states, labels, and interaction behavior.

Implications for later DevStudio convergence:

- Token editor controls should be treated as a governed control surface.
- Preview and source inspection controls should use declared components where
  possible.

### 2.4 Dialogs Are A Separate Interruption Layer

Material dialogs are prompts requiring user action and are not generic
containers.

Implications for later DevStudio convergence:

- The token editor overlay must be classified by actual behavior before any
  future modal decision.
- Dialog/modal doctrine belongs to 126K; 126L consumes that later.

## 3. Apple HIG Findings

### 3.1 Layout And Hierarchy Must Stay Recognizable

Apple emphasizes layout that adapts while preserving recognizable structure.

Implications for later DevStudio convergence:

- DevStudio can preserve its frozen/reveal structure while improving component
  consistency later.
- Any future visual changes must distinguish convergence from redesign.

### 3.2 Sidebars, Split Views, And Toolbars Fit Inspection Apps

Apple sidebars support app areas and collections. Split views show hierarchy
and detail. Toolbars carry view title and actions.

Implications for later DevStudio convergence:

- DevStudio's current sidebar plus page detail structure is directionally
  compatible with an inspection/governance cockpit.
- Later planning should make current-view actions and source authority visible.

### 3.3 Inspectors Fit Source/Selection Detail

Apple inspector guidance maps to showing and editing details of selected
objects without hiding the broader workspace.

Implications for later DevStudio convergence:

- Token/value editing, component metadata, and policy cells can be judged as
  inspector/editor surfaces.
- DevStudio should avoid hiding source context when editing values.

### 3.4 Lists And Tables Fit Operational Data

Apple lists/tables are appropriate for grouped data, repeated rows, and
selection/detail workflows.

Implications for later DevStudio convergence:

- Entitlement matrices, AI runtime matrices, token lists, and component catalogs
  should be evaluated as operational data surfaces.

## 4. OpenAI Findings

### 4.1 Custom UI Should Be Focused And Accessible

OpenAI Apps SDK UI guidance emphasizes focused UI, readable contrast, text
resizing, alt text, system-like typography/spacing, and predictable actions.

Implications for later DevStudio convergence:

- DevStudio should stay dense and operational, with controls and data arranged
  for repeated human review.
- Accessibility and predictable actions are part of the cockpit contract.

### 4.2 Hosted UI Should Preserve Tool/State Boundaries

OpenAI Apps SDK separates tool results, component rendering, hosted state, and
backend authority.

Implications for later DevStudio convergence:

- DevStudio source reveal and Pages Function writes should keep authority
  boundaries visible.
- Token editor UI state must remain separate from source-controlled token truth.

### 4.3 Display Mode Guidance Supports Focused Work Surfaces

OpenAI distinguishes inline cards, fullscreen workflows, and host-owned modal
behavior. Larger workflows need the correct surface instead of overloading small
cards.

Implications for later DevStudio convergence:

- DevStudio should not cardify complex governance workflows.
- Token/component/policy work can require full working surfaces and clear
  dismissal/action boundaries.

## 5. Cross-Source Synthesis For Later Human Convergence

Shared source themes:

- Governance UI is operational, not decorative.
- Navigation and hierarchy must be clear and stable.
- Source/detail/editor relationships should be explicit.
- Controls must be labeled, accessible, and predictable.
- Modals/overlays are separate interaction layers, not generic editors.
- UI state and source truth need distinct ownership.

Non-binding Clickeen mapping:

- DevStudio's source-derived reveal role is directionally aligned.
- The generated component/foundation pages are aligned with source-truth reveal.
- Local shell/chrome drift and token editor overlay behavior need classification
  before final PRD work.

## 6. Non-Binding Recommendations

These are research notes for later human convergence only:

- Evaluate DevStudio as an inspection/governance cockpit.
- Preserve source-derived reveal as the core product role.
- Classify shell/nav, preview pages, token editor, and policy tools separately.
- Keep 126K modal doctrine separate from 126L screen planning.
- Avoid turning DevStudio into a general admin/bypass surface.
- Avoid redesigning generated reveal pages before source-derived authority is
  settled by human convergence.

## 7. Step Boundary

This research does not:

- choose target Clickeen doctrine;
- converge Codex and GLM findings;
- update `documentation/services/devstudio.md`;
- update `documentation/engineering/UI/*`;
- update code;
- regenerate pages;
- change product behavior;
- select a migration plan.
