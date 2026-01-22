# How We Build Widgets

STATUS: CANONICAL (AI-executable)
OWNER: Platform / Widget System

This document is the canonical build contract for widget definitions in:
- `tokyo/widgets/{widgetType}/`

This document is optimized for AI agents: contracts, schemas, checklists, templates.
No conversational guidance.

---

## 1) ONE-PAGE QUICKSTART (AI)

### SCOPE
- Task: build or update ONE widget definition under `tokyo/widgets/{widgetType}/`.
- Scope is LIMITED to the widget folder files listed below.

### FILES
Core (always present):
- `spec.json`
- `widget.html`
- `widget.css`
- `widget.client.js`
- `agent.md`

Contract (present unless PRD explicitly opts out):
- `limits.json`
- `localization.json`

### STOP CONDITIONS (ASK HUMAN)
Stop and ask if any are true:
- widgetType not explicitly provided
- no PRD or PRD conflicts with contracts below
- change requires new Dieter primitive or token
- change requires editing `tokyo/widgets/shared/*`
- change requires editing Bob/Paris/Venice/Prague/Dieter
- cannot enumerate final state paths before writing ToolDrawer controls
- cannot provide Binding Map rows (Section 7) for all new controls

### BUILD ORDER (NON-NEGOTIABLE)
1) Define state model (paths + arrays + items + subparts)
2) Update `spec.json` defaults (Stage/Pod + Typography included)
3) Update `widget.html` DOM skeleton with stable `data-role`
4) Update `widget.css` using tokens + CSS vars + single breakpoint
5) Update `widget.client.js` bindings
   - Stage/Pod binding first
   - Typography binding second
   - widget-specific bindings after
6) Update ToolDrawer panels in `spec.json` (only for already-bound paths)
7) Update `agent.md` (AI editing contract + Binding Map)

### DEFINITION OF DONE (GATES)
All must be true:
- Stage/Pod state exists and is applied via shared runtime on every update
- Desktop + mobile Stage/Pod values exist and affect preview
- Every ToolDrawer control produces a visible change (no dead controls)
- All visible text is covered by Typography roles (no ad-hoc font styling)
- Runtime is deterministic and scoped to the widget root
- `agent.md` lists editable paths and allowed ops consistent with widget state model
- Contract files exist (`limits.json`, `localization.json`) unless PRD explicitly opts out
- No non-persistable URLs (`data:` / `blob:`) in defaults or saved configs

---

## 2) STAGE/POD CONTRACT (LAYOUT ENGINE)

### PURPOSE
- Stage/Pod is the shared container system used by every widget.
- Pod drives most layout feel (width, padding, radius, surface background).
- Stage provides the outer canvas (alignment, padding around pod).

### MUST (STATE SHAPE IN `spec.json`)
`defaults.stage` MUST exist and include:
- `background`
- `alignment`
- `canvas.mode`
- `padding.desktop` and `padding.mobile`
  - each padding object MUST include: `linked, all, top, right, bottom, left`

`defaults.pod` MUST exist and include:
- `background`
- `padding.desktop` and `padding.mobile` (same shape as stage padding)
- `widthMode`
- `contentWidth`
- radius fields:
  - `radiusLinked`
  - `radius`
  - `radiusTL`, `radiusTR`, `radiusBR`, `radiusBL`

### MUST (HTML WRAPPER IN `widget.html`)
`widget.html` MUST include:
- stage element: `data-role="stage"`
- pod element: `data-role="pod"`
- widget root element:
  - `data-role="root"`
  - `data-ck-widget="{widgetType}"`

Hierarchy MUST be:
`[data-role="stage"]` contains `[data-role="pod"]` contains `[data-role="root"][data-ck-widget]`

### MUST (RUNTIME BINDING IN `widget.client.js`)
`widget.client.js` MUST call:
- `window.CKStagePod.applyStagePod(state.stage, state.pod, root)`

Call MUST occur on:
- initial state load (`window.CK_WIDGET.state` when present)
- every `ck:state-update`

### MUST (EDITOR CONTROLS FOR STAGE/POD FILLS)
ToolDrawer MUST expose Stage/Pod backgrounds in Appearance panel:
- `stage.background` dropdown-fill
- `pod.background` dropdown-fill

Each MUST declare `fill-modes` explicitly.

### DROPDOWN-FILL DEFAULTS FOR STAGE/POD
Default allowed fill modes:
- `stage.background`: `color,gradient,image,video`
- `pod.background`: `color,gradient,image,video`

If PRD requires restricting media fills, restrict via `fill-modes`.

### MUST NOT
- Do not re-implement container layout (stage/pod sizing/alignment/padding) in widget-specific CSS/JS beyond calling CKStagePod.
- Do not add fallback/healing logic if stage/pod fields are missing.

---

## 3) TAXONOMY (NO “ITEM” CONFUSION)

### PURPOSE
- Prevent state/DOM mismatch and repeated “item vs root” mistakes.
- Provide a single vocabulary for arrays/items/subparts.

### TERMS (NON-NEGOTIABLE)
- Stage: outer container behind widget
- Pod: container holding widget
- Widget Root: the single `[data-ck-widget="{widgetType}"][data-role="root"]`
- Array: a list in state (e.g. `sections[]`)
- Array Container: DOM element that renders an Array
- Item: one element of an Array (e.g. `sections[i]`)
- Item Container: DOM wrapper for one Item
- Subpart: element inside an item (text/icon/badge/etc.)

### RULES
- “Item” MUST refer only to an array element.
- Widget Root MUST NOT be called an item.
- Every Array MUST have:
  - one DOM Array Container (stable `data-role`)
  - one DOM Item Container (stable `data-role`)
- Every runtime-mutated element MUST have a stable `data-role`.

### REQUIRED `data-role` PATTERN
Use `data-role` for behavior hooks ONLY.
Use classnames for styling ONLY.

Minimum required roles:
- `stage`
- `pod`
- `root`

Additional required roles:
- one role for each Array Container
- one role for each Item Container
- subpart roles for anything runtime updates (text blocks, icons, badges)

---

## 4) WRAPPER STYLING SYSTEM (REPETITIVE BY DESIGN)

### PURPOSE
- Wrapper styling is intentionally repetitive so AIs can implement it mechanically.
- All wrappers share the same styling dimensions: fill, border, radius, shadow (+ optional divider).

### SURFACES (WRAPPERS)
Potential wrapper surfaces:
- `stage` (shared)
- `pod` (shared)
- `root` (widget root surface)
- `array.<key>` (array container wrapper)
- `item.<key>` (item wrapper)
- `part.<key>` (subpart wrapper)

Only define surfaces that exist in the widget.

### STANDARD APPEARANCE KEYS (REUSABLE PATTERN)
For any surface `S`, use:
- `appearance.S.fill`            (dropdown-fill value object)
- `appearance.S.border`          (object)
- `appearance.S.radius`          (object or token)
- `appearance.S.shadow`          (enum/token)

Optional:
- `appearance.S.divider`         (object) (arrays/items only)

### STANDARD LAYOUT KEYS (REUSABLE PATTERN)
For any surface `S`, use:
- `layout.S.padding.desktop|mobile` (same padding shape as Stage/Pod)
- `layout.S.gap` (arrays only)
- `layout.S.alignment` (only if meaningful)

### MUST
- Wrapper styling MUST use the standard keys above.
- Wrapper appearance MUST bind via one of:
  - CSS variables
  - data-attribute variants
  - deterministic DOM update (only when necessary)

### MUST NOT
- Do not invent widget-specific styling keys that duplicate the standard model.
  Examples prohibited:
  - `tileBg`, `cardBorderColor`, `rowRoundness` (use standard surface keys instead)

---

## 5) DROPDOWN-FILL CONTRACT (FILL MODES + MEDIA RULES)

### PURPOSE
- Prevent accidental media fill enablement everywhere.
- Ensure AIs declare fill capabilities explicitly.

### MUST
- Every dropdown-fill control MUST declare `fill-modes`.
- If `fill-modes` includes `image` or `video`, that surface is considered media-capable.

### DEFAULT MATRIX
Unless PRD explicitly requires otherwise:

- Stage/Pod backgrounds:
  - `stage.background`: `color,gradient,image,video`
  - `pod.background`:   `color,gradient,image,video`

- Other wrapper fills (root/array/item/part):
  - default: `color,gradient`
  - enable `image`/`video` ONLY IF PRD explicitly requires

### PERSISTABILITY RULE (CRITICAL)
Final configs MUST NOT contain:
- `data:` URLs
- `blob:` URLs

If media fills are enabled, assume the system will persist assets and rewrite references.
Do not ship defaults that require non-persistable URLs.

---

## 6) TYPOGRAPHY CONTRACT (MANDATORY FOR ALL TEXT)

### PURPOSE
- Typography is the scalable text system: roles -> CSS vars -> deterministic rendering.
- All text must be driven by roles to keep design consistent across widgets, templates, and localization.

### MUST
If the widget renders any user-visible text:
- `defaults.typography.roles` MUST define roles for all text parts.
- `widget.client.js` MUST call:
  - `window.CKTypography.applyTypography(state.typography, root, roleMap)`
- `widget.css` MUST use typography CSS variables emitted by typography runtime.

### MUST NOT
- Do not set fonts ad-hoc per element (inline styles or hard-coded font stacks).
- Do not create separate “text color” controls outside typography unless PRD requires it.

### ROLE MAP RULE
The roleMap MUST include a mapping for each text role used in DOM/CSS.
Role names MUST be stable across:
- `spec.json` defaults
- runtime applyTypography roleMap
- `agent.md` (AI editing contract)
- localization allowlist paths (if translatable)

---

## 7) BINDING MAP CONTRACT (NO DEAD CONTROLS)

### PURPOSE
- Prevent “controls that compile but do nothing.”
- Force a deterministic mapping from state path to visible effect.

### MUST
For every ToolDrawer control path, define a Binding Map row.

Allowed mechanisms (exactly one per control):
1) CSS variable binding
2) data-attribute variant binding
3) deterministic DOM update binding

### REQUIRED TABLE FORMAT
Binding Map table MUST exist in the PRD and MUST be summarized in `agent.md`.

| Path | Target | Mechanism | Implementation |
|---|---|---|---|
| `layout.type` | widget root | data-attr | `root.setAttribute('data-layout', state.layout.type)` |
| `appearance.item.fill` | item wrapper | CSS var | `root.style.setProperty('--item-fill', ...)` |
| `content.title` | `[data-role="title"]` | DOM text | `el.textContent = state.content.title` |

### MUST NOT
- Do not add a control path if it has no Binding Map row.
- Do not rely on implicit behavior or heuristics.

---

## 8) TOOLDRAWER CONTRACT (PANELS + GROUPS)

### PURPOSE
- Maintain consistent editor UX across all widgets.
- Keep AI-generated ToolDrawer structures predictable and scalable.

### PANELS (STANDARD)
Use these panels only:
- `content`
- `layout`
- `appearance`
- `typography`
- `settings` (only if necessary)

### MUST
- Content panel: content model + arrays/items + any “type/mode” selectors
- Layout panel: spacing/arrangement variants; padding/gap/alignment; layout selectors
- Appearance panel: wrapper styling (fill/border/radius/shadow); Stage/Pod fills
- Typography panel: roles only; no ad-hoc text styling controls elsewhere

### SHOW-IF DISCIPLINE
- Use `show-if` to gate controls by variant keys (type/layout).
- Do not duplicate entire panels per variant.

---

## 9) CONTRACT FILES (DEFAULT REQUIRED)

### 9.1 limits.json
### PURPOSE
- Platform cap enforcement at product boundary.

### MUST
- `limits.json` exists unless PRD explicitly opts out.
- It MUST be valid JSON and follow the platform limits schema used by Paris.
- It MUST be updated only when PRD requires changes.

### 9.2 localization.json
### PURPOSE
- Allowed translatable paths for localization overlays (set-only ops).

### MUST
- `localization.json` exists unless PRD explicitly opts out.
- It MUST include all translatable text paths.
- It MUST use `*` for array indices.
- It MUST NOT include prohibited segments (`__proto__`, `constructor`, `prototype`).

### REFERENCE SHAPE
```json
{
  "v": 1,
  "paths": [
    { "path": "title", "type": "string" },
    { "path": "sections.*.heading", "type": "string" },
    { "path": "sections.*.faqs.*.question", "type": "string" },
    { "path": "sections.*.faqs.*.answer", "type": "richtext" }
  ]
}
10) RUNTIME DETERMINISM (widget.client.js)
PURPOSE
Ensure preview and embed behave identically.

Ensure state updates are pure and repeatable.

MUST
Implement applyState(state) as a pure DOM update.

Scope all selectors and mutations to the widget root.

Use stable data-role selectors only.

Apply Stage/Pod and Typography before widget-specific bindings.

MUST NOT
No fetch/network work in applyState.

No timers/intervals.

No randomness (IDs, timestamps, random ordering).

No “healing” missing state fields; state shape is defined by spec.json.

11) BUILD PROCESS (DETAILED STEPS)
STEP 1 — STATE MODEL (WRITE FIRST)
MUST produce:

list of state paths

list of arrays and items

list of subparts requiring roles or styling

STEP 2 — spec.json DEFAULTS
MUST:

include Stage/Pod defaults

include Typography roles for all text

include defaults for every control path

STEP 3 — widget.html STRUCTURE
MUST:

implement Stage/Pod/root wrappers and stable roles

provide roles for arrays/items/subparts

STEP 4 — widget.css
MUST:

use tokens and CSS vars

implement variants via data attributes and CSS vars

use single breakpoint policy

STEP 5 — widget.client.js
MUST:

call CKStagePod + CKTypography

implement Binding Map rows via allowed mechanisms

STEP 6 — ToolDrawer PANELS
MUST:

add controls only for already-bound paths

declare fill-modes for dropdown-fill controls

enforce grouping and show-if discipline

STEP 7 — agent.md
MUST:

list editable paths

define allowed ops for arrays (insert/remove/move semantics)

summarize Binding Map

list prohibited paths

12) CHECKLISTS (AI)
12.1 Pre-flight
 widgetType explicit

 PRD exists and is consistent

 state model enumerated (paths + arrays + items)

 Stage/Pod defaults present

 Typography roles enumerated for all visible text

 Wrapper surfaces enumerated and mapped to standard schema

 Binding Map rows exist for every planned control

12.2 spec.json
 defaults.stage exists with per-device padding

 defaults.pod exists with width/radius/padding

 defaults.typography.roles exists when widget has text

 every ToolDrawer control path exists in defaults

 panels used only: content/layout/appearance/typography/settings

 Stage/Pod background fills exposed in Appearance

 every dropdown-fill declares fill-modes explicitly

 controls align to Binding Map

12.3 widget.html
 stage/pod/root wrappers exist with required attributes

 widget root uses data-ck-widget="{widgetType}"

 every runtime-mutated element has stable data-role

 scripts included inside widget root

 no inline styles/scripts

12.4 widget.css
 uses Dieter tokens (no hard-coded colors)

 uses CSS vars for wrapper styling and typography

 layout variants controlled by data attrs/CSS vars

 single breakpoint policy

12.5 widget.client.js
 deterministic applyState

 calls CKStagePod + CKTypography

 implements all Binding Map rows

 no global selectors; scoped to root

 no fetch/timers/randomness

12.6 agent.md
 editable paths listed (matches spec.json)

 array ops rules explicit (insert/remove/move)

 Binding Map summary present

 prohibited paths listed

 localization-sensitive paths identified (if applicable)

12.7 limits.json
 exists (unless PRD opts out)

 valid JSON

 aligned to widget PRD caps

12.8 localization.json
 exists (unless PRD opts out)

 valid JSON

 includes all translatable text paths

 uses * for arrays

 no prohibited segments

13) TEMPLATES (MINIMAL CORRECT)
13.1 widget.html (minimal)
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="/dieter/tokens/tokens.css" />
    <link rel="stylesheet" href="./widget.css" />
  </head>
  <body>
    <div class="stage" data-role="stage">
      <div class="pod" data-role="pod">
        <div class="ck-widget" data-ck-widget="WIDGETTYPE" data-role="root">
          <!-- widget content -->
          <div data-role="title"></div>

          <script src="../shared/typography.js" defer></script>
          <script src="../shared/stagePod.js" defer></script>
          <script src="../shared/branding.js" defer></script>
          <script src="./widget.client.js" defer></script>
        </div>
      </div>
    </div>
  </body>
</html>
13.2 widget.client.js (minimal deterministic skeleton)
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const scriptEl = document.currentScript;
  if (!(scriptEl instanceof HTMLElement)) return;

  const root = scriptEl.closest('[data-role="root"]');
  if (!(root instanceof HTMLElement)) {
    throw new Error('[widget] widget.client.js must execute inside [data-role="root"]');
  }

  function applyState(state) {
    if (!state || typeof state !== 'object') return;

    if (window.CKStagePod) window.CKStagePod.applyStagePod(state.stage, state.pod, root);

    if (window.CKTypography) {
      window.CKTypography.applyTypography(state.typography, root, {
        title: { varKey: 'title' },
        body: { varKey: 'body' }
      });
    }

    const title = root.querySelector('[data-role="title"]');
    if (title instanceof HTMLElement && typeof state.title === 'string') {
      title.textContent = state.title;
    }
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || msg.type !== 'ck:state-update') return;
    applyState(msg.state);
  });

  if (window.CK_WIDGET && window.CK_WIDGET.state) {
    applyState(window.CK_WIDGET.state);
  }
})();
13.3 agent.md (minimal contract skeleton)
# {widgetType} — Agent Contract

## Editable Paths
- (list paths; must exist in spec.json defaults)

## Arrays and Ops
- (define arrays and allowed insert/remove/move semantics)

## Binding Map Summary
| Path | Target | Mechanism |
|---|---|---|
| ... | ... | css-var / data-attr / dom |

## Prohibited
- (paths that must never be edited)
14) DEBUGGING (REFERENCE ONLY; READ LAST)
Symptom: control changes do nothing

Check: Binding Map exists for path

Check: widget.client.js applies that path via css-var/data-attr/dom

Check: target has correct data-role

Symptom: layout changes do nothing

Check: CKStagePod call exists and runs on every update

Check: stage/pod defaults exist in spec.json

Symptom: fonts inconsistent

Check: typography roles exist

Check: CKTypography apply call exists

Check: widget.css uses typography vars

Symptom: localization breaks or fails

Check: localization.json includes translatable paths

Check: no structural changes were attempted via localization overlays