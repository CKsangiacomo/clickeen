# PRD106C4_Cards_Widget

Status: Draft execution PRD
Owner: Widget system + Bob
Date: 2026-06-05
Parent: `PRD106C_Prague astro blocks migration to widget instances.md`
Series step: 7.2
Depends on: `PRD106A2_WidgetShellExtraction.md`, `PRD106C_Prague astro blocks migration to widget instances.md`
Unlocks: Cards widget instances for PRD106D route migration.
Authority owned by this PRD: Cards widget body state, controls, defaults, DOM, CSS, runtime, and editable fields.
Authority explicitly not owned by this PRD: Widget Shell, Page Composer, Split, Big Bang, CTA, Prague route cutover.

## PRD Tenets

- Execute one step at a time.
- Do not start Step N+1 until Step N is green.
- The current step is the only execution permission.
- Green requires named completion evidence.
- A blocker report stops execution; it does not unlock the next step.
- Do not solve missing decisions by inventing product behavior.

## Mandatory PRD106 Execution Contract

This PRD is step-gated. Execute exactly one numbered step at a time.

Before executing any step:

1. Read `106__Umbrella__Composition_Vision.md`.
2. Confirm PRD106A2 is green or explicitly fenced.
3. Confirm PRD106C assigns card/step/moat behavior to this PRD.
4. Execute only the current step. Long reference sections are context, not
   execution permission.

A step is green only when its named completion evidence exists. A blocker report
is evidence to stop, not evidence to proceed.

## Dependency Gate

| Dependency | Required green evidence | Status |
| --- | --- | --- |
| PRD106A2 | Shared Widget Shell package accepted. | REQUIRED |
| PRD106C | Cards target and Prague source scope accepted. | REQUIRED |

## Current Step Gate

Current executable step:

```text
Step 1: Define Cards body contract.
```

Required evidence before marking green:

- Cards item state paths are listed.
- Steps is represented as a Cards treatment, not a new widget.
- Shell-owned paths are excluded.

Stop conditions:

- Cards requires new Header/CTA/Stage/Pod state.
- Prague columns become page-level layout architecture.

## Execution Steps

| Step | Action | Required evidence | Green criteria | Stop condition |
| ---: | --- | --- | --- | --- |
| 1 | Define Cards body contract. | State/control/editable-field table. | Only `items[]` and approved body layout/treatment paths are added. | Shell path needed. |
| 2 | Build Cards defaults and object-manager controls. | Spec/body diff. | 2-6 non-empty cards with stable IDs. | Blank scaffold or unstable identity. |
| 3 | Build Cards DOM/CSS/runtime body. | Diff and preview evidence. | Cards render inside `.ck-headerLayout__body`. | Runtime assumes singleton instance. |
| 4 | Validate translation/editable fields. | Editable-fields diff/tests. | Concrete item paths use stable item identity. | Wildcard or missing identity. |
| 5 | Verify Bob/Roma materialization. | Compile/save/package evidence. | Cards package is Shell plus body. | Duplicate Shell code appears. |

## Purpose

Build the surviving `cards` widget that absorbs Prague `subpage-cards`,
`steps`, `global-moat`, `platform-strip`, and `control-moat`.

Cards uses the shared Widget Shell extracted from FAQ:

```text
Stage -> Pod -> ck-headerLayout(Header + Cards content)
```

Cards is not a new editor architecture. It is the shared Widget Shell with Cards
content added. A "steps" section is a Cards treatment, not a separate widget.

## Implementation Base

Consume `packages/widget-shell/`. The package owns:

- `header.*`
- `cta.*`
- `stage.*`
- `pod.*`
- shared `header-content`
- shared `header-layout`
- shared `header-appearance`
- shared `stagepod-layout`
- shared `stagepod-appearance`
- standardized `typography`
- locale switcher pattern
- branding/settings placement
- `editable-fields.json` translation mechanism

Do not carry FAQ-specific body content/runtime:

- `sections[]`
- Q/A manager
- accordion/list/multicolumn runtime
- FAQ deep links
- FAQ question/answer paths

Add only Cards-specific content and controls.

## Prague Evidence

| Prague block | What it does | Cards responsibility |
| --- | --- | --- |
| `subpage-cards` | Header plus linked cards | Linked Cards treatment. |
| `steps` | Header plus repeated value cards | Steps/ordered Cards treatment. |
| `global-moat` | Header plus feature cards | Standard Cards treatment. |
| `platform-strip` | Header plus feature cards | Standard Cards treatment. |
| `control-moat` | Header plus feature/value cards | Standard or Steps treatment. |

Prague route helpers (`market`, `locale`, `resolvePragueHref`, fixed
`features/examples/pricing` page names) do not become widget truth.

## Target Files

Surviving widget source:

- `tokyo/product/widgets/cards/spec.json`
- `tokyo/product/widgets/cards/editable-fields.json`
- `tokyo/product/widgets/cards/limits.json`
- `tokyo/product/widgets/cards/widget.html`
- `tokyo/product/widgets/cards/widget.css`
- `tokyo/product/widgets/cards/widget.client.js`

Existing card/step widget source may be used as implementation material, but
the surviving Prague migration target is `cards`.

## Instance Shape

Shell state comes from `packages/widget-shell/`. Cards-specific state:

| Path | Owner | Meaning |
| --- | --- | --- |
| `items[]` | mixed | Ordered cards. Minimum 2, maximum 6. |
| `items[].id` | config | Stable item identity for reorder/translation. |
| `items[].title` | content | Card title. |
| `items[].body` | content | Card supporting copy. |
| `items[].href` | config | Optional card URL. |
| `items[].ctaLabel` | content | Optional card CTA label. |
| `items[].iconEnabled` | config | Shows card icon. |
| `items[].iconName` | config | Dieter icon name. |
| `items[].imageEnabled` | config | Shows card image. |
| `items[].image` | config | Widget/account media reference. |
| `items[].imageAlt` | content | Authored alt text if image is user-visible. |
| `layout.treatment` | config | `cards`, `linked-cards`, `steps`. |
| `layout.columns` | config | Desktop card columns, 2-4. |
| `layout.cardGap` | config | Card gap. |
| `layout.cardPadding` | config | Card padding. |

Use existing FAQ-style card/surface paths for card frame appearance. Do not add
new `appearance.cardRadius` or `appearance.cardShadow` paths when
`appearance.cardwrapper.*` already exists.

## Defaults

New Cards instances must render a complete section immediately.

Required defaults:

- `header.enabled`: `true`
- `header.title`: "Everything visitors need to know"
- `header.showSubtitle`: `true`
- `header.subtitleHtml`: "Use cards to explain benefits, steps, links, or key details in a clean responsive section."
- `header.placement`: `top`
- `header.alignment`: `center`
- `header.ctaPlacement`: `below`
- `cta.enabled`: `false`
- `layout.treatment`: `cards`
- `layout.columns`: `3`
- three default items:
  - "Clear answers" / "Give visitors the information they need without making them search."
  - "Easy updates" / "Edit once in Clickeen and keep every embedded section current."
  - "Built to scale" / "Use the same widget pattern for links, features, or step-by-step flows."
- object-manager `default-item` must create a non-empty card with a stable generated ID.

No default visible string may be empty.

## Bob Panels And Controls

### Content Panel

| Cluster | Control | Path | Type | Why |
| --- | --- | --- | --- | --- |
| Header | Shared Header content | shared `header-content` | shared | Widget Shell package. |
| Cards | Cards manager | `items` | `object-manager` | Add/reorder/remove 2-6 cards. |

Object-manager item template:

| Control | Path | Type | Show If | Why |
| --- | --- | --- | --- | --- |
| Title | `items.__INDEX__.title` | `textfield` | Always | Card title. |
| Supporting copy | `items.__INDEX__.body` | `textedit` | Always | Card supporting copy. |
| Link URL | `items.__INDEX__.href` | `textfield` | `layout.treatment in linked-cards,cards` | Optional card destination. |
| CTA label | `items.__INDEX__.ctaLabel` | `textfield` | `layout.treatment == linked-cards` | Optional card CTA text for linked-card treatment. |
| Show icon | `items.__INDEX__.iconEnabled` | `toggle` | Always | Enables icons for standard/steps cards. |
| Icon name | `items.__INDEX__.iconName` | `textfield` | `iconEnabled == true` | Dieter icon token/name. |
| Show image | `items.__INDEX__.imageEnabled` | `toggle` | Always | Enables image cards if needed. |
| Image | `items.__INDEX__.image` | `upload` | `imageEnabled == true` | Product media coordinate using Bob's existing upload stencil. |
| Image alt | `items.__INDEX__.imageAlt` | `textfield` | `imageEnabled == true` | Authored alt text. |

### Layout Panel

| Cluster | Control | Path | Type | Values / bounds | Why |
| --- | --- | --- | --- | --- | --- |
| Header | Shared Header layout | shared `header-layout` | shared | Widget Shell package. |
| Card layout | Treatment | `layout.treatment` | `choice-tiles` | `cards`, `linked-cards`, `steps` | Absorbs Prague card/step variants. |
| Card layout | Columns | `layout.columns` | `choice-tiles` | `2`, `3`, `4` | Desktop card count per row. |
| Card layout | Card gap | `layout.cardGap` | `valuefield` | 8-64, step 2 | Responsive spacing. |
| Card layout | Card padding | `layout.cardPadding` | `valuefield` | 16-64, step 2 | Card density. |
| Shared | Stage/Pod layout | shared `stagepod-layout` | shared | Widget Shell package. |

Do not add `layout.maxWidth`; Pod content width owns shell width.

### Appearance Panel

| Cluster | Control | Path | Type | Why |
| --- | --- | --- | --- | --- |
| Header CTA | Shared Header CTA appearance | shared `header-appearance` | shared | Widget Shell package. |
| Cards | Card frame | `appearance.cardwrapper.*` | existing FAQ card controls | Radius, border, and shadow using working FAQ paths. |
| Shared | Stage/Pod appearance | shared `stagepod-appearance` | shared | Widget Shell package. |

Behavior toggles stay in Settings, matching FAQ.

### Settings Panel

| Cluster | Control | Path | Type | Why |
| --- | --- | --- | --- | --- |
| Clickeen Branding | Show Made with Clickeen | `behavior.showBacklink` | `toggle` | Existing widget behavior. |
| Clickeen Branding | Enable social share | `behavior.socialShare.enabled` | `toggle` | Existing widget behavior. |

### Typography Panel

Required typography roles:

| Role | Applies to |
| --- | --- |
| `title` | Header title |
| `body` | Header subtitle |
| `cardTitle` | Card titles |
| `cardBody` | Card supporting copy |
| `button` | Header/card CTA labels |

## Editable Fields

`editable-fields.json` must include:

- `header.title`
- `header.subtitleHtml`
- `cta.label`
- `items[].title` with `items[].id` identity
- `items[].body` with `items[].id` identity
- `items[].ctaLabel` with `items[].id` identity
- `items[].imageAlt` with `items[].id` identity when images are enabled

## Acceptance

- Fresh Cards instance renders non-blank output with three cards.
- Cards is implemented as Widget Shell package plus Cards content.
- Prague FAQ `subpage-cards`, `steps`, `global-moat`, and `platform-strip` can be represented by Cards.
- `steps` is a Cards treatment, not a separate widget.
- Cards object manager enforces or validates 2-6 cards.
- Route-specific Prague helpers do not appear in Cards runtime/state.
- Cards does not define duplicate Header/CTA/Stage/Pod shell state.
- Bob exposes the controls above with correct paths and show/hide behavior.
- Cards materializes to `index.html`, `styles.css`, and `runtime.js`.
- Two Cards instances on one composed page do not collide in CSS/runtime.
