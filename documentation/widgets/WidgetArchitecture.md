# Bob & Widget Architecture: Building for Scale

STATUS: NORMATIVE — Source of Truth (Sep 2025)

## The Challenge

We're building Clickeen to support **hundreds of widget types** and **tens of thousands of users** creating personalized widget instances.

The old approach—building custom React components for every widget type—doesn't scale. 100 widgets = 100+ components to build and maintain. Engineers get confused about which components to use. Wrapper components proliferate across the codebase. It becomes unmaintainable fast.

We need a different approach.

## The Solution: Widget Definitions + Stateless Compiler + Live Editing

**Core insight**: A widget editor isn't one piece of software. It's THREE pieces working together:

**Tokyo = Widget Definitions** (the source of truth)
- Owns widget structure, UI, styles, and runtime
- For each widget {widget}: `tokyo/widgets/{widget}/spec.json`, `widget.html`, `widget.css`, `widget.client.js` (and `agent.md` when AI editing is enabled)
- DevStudio fetches specs from Tokyo and posts into Bob
- Never changes during a session

**Bob = 50% of the software** (the generic editor shell)
- Loads and parses widget spec (spec.json)
- Holds the working config in memory during editing (in code: `instanceData`)
- Provides the UI shell and ToolDrawer
- Manages live preview via postMessage
- On Publish: sends working config → Paris as `config`

**Widget Runtime = 50% of the software** (the widget-specific client)
- `widget.client.js`: Applies config to DOM in real-time
- `widget.html`: Semantic markup for the widget
- `widget.css`: Styles for the widget
- Lives in Tokyo; loaded by Bob's preview and Venice's SSR

Together, **Tokyo + Bob + widget.client.js = a complete widget editing and rendering system**.

## Widget Documentation Convention (for building new widgets)

Each widget has a folder under `documentation/widgets/{WidgetName}/` with:
- `CompetitorAnalysis/` — screenshots + saved competitor pages (reference material)
- `{WidgetName}_competitoranalysis.md` — competitor behavior inventory (what the market ships)
- `{WidgetName}_PRD.md` — Clickeen PRD (what we will build, mapped to the Clickeen system)

This keeps “competitor research” and “our spec” separate and prevents documentation drift.

## The Data Flow

```
1. User opens widget instance
   ↓
2. Bob fetches spec.json from Tokyo (defines ToolDrawer structure)
   ↓
3. Bob compiler parses spec.json → CompiledWidget (panels[], asset URLs, optional controls[] allowlist)
   ↓
4. Bob loads instance `config` from Paris (published configuration)
   ↓
5. Bob seeds working state = merge(widget defaults, instance config)
   ↓
6. User edits in ToolDrawer
   ↓
7. Bob updates working state only (NO API calls, NO DB touch)
   ↓
8. Bob sends postMessage to workspace iframe:
   {
     type: 'ck:state-update',
     widgetname,
     state: workingState,
     device,
     theme
   }
   ↓
9. widget.client.js receives message
   ↓
10. applyState(workingState) mutates DOM in place
    (text nodes, lists, counts, etc.)
   ↓
11. Preview updates instantly, NO iframe reload
   ↓
12. User clicks "Publish"
   ↓
13. Bob sends ONE PUT to Paris: working state → `config`
   ↓
14. Done (DB now has the new published config)
```

### Key Architectural Decisions

**Preview = Live Editing State (NOT DB)**
- During editing: working config exists only in Bob's memory
- Bob → Workspace: postMessage with working config
- Workspace → widget.client.js: applyState(working config)
- No iframe reloads, no DB calls, no syncing

**Publish = Promote working config to DB**
- User clicks Publish
- Bob sends working config to Paris
- Paris saves it as the published `config`
- Next load: working config seeds from published config

**Database Isolation**
- **Before Publish:** DB is untouched (zero pollution, zero locks)
- **After Publish:** DB has the new published config
- 10,000 users editing simultaneously = 10,000 in-memory working states, zero DB load

### Why This Matters

**No database pollution** - Every keystroke doesn't hit the DB. Editing is in-memory only. Publish sends final state once.

**No complex sync logic** - Bob is single source of truth during editing. No conflicts, no race conditions, no sync nightmares.

**Scales effortlessly** - 1 user or 10,000 simultaneous editors: same memory footprint per user, zero server load from editing.

**Live preview without reload** - postMessage + applyState = instant visual feedback on every keystroke.

**Separation of concerns** - Tokyo owns widget logic; Bob owns editing flow; Paris owns published data.

## How Widget Definitions Work (Tokyo)

Each widget type consists of a **Tokyo widget folder** with **4 runtime files** plus an **AI contract** file:

### 1. spec.json — Widget Structure & ToolDrawer Definition

**Location:** `tokyo/widgets/{widget}/spec.json`

**Purpose:** Defines ToolDrawer panels and defaults; compiled by Bob into panel HTML and (optionally) a machine-readable `controls[]` allowlist for safe ops/AI edits.

**Structure (snippet):**
```json
{
  "widgetname": "faq",
  "defaults": { "title": "Frequently Asked Questions", "showTitle": true },
  "html": [
    "<bob-panel id='content'>",
    "  <tooldrawer-field type='toggle' size='md' path='showTitle' label='Show title' />",
    "  <tooldrawer-field type='textfield' size='lg' path='title' label='FAQ title' show-if=\"showTitle == 'true'\" />",
    "</bob-panel>"
  ]
}
```
Rules:
- `spec.json.html[]` is a tiny markup DSL. Bob expands `<tooldrawer-field>` into Dieter component markup and binds via `data-bob-path` (and wrappers like `data-bob-showif`).
- Complex controls (repeaters / nested item blocks) may embed additional `data-bob-path` inside the repeated item markup; the compiler must treat these as editable paths too.
- Panels are segmented by `<bob-panel id='...'>` blocks; Bob handles layout/switching.
- No control schemas or Bob-side rendering logic; the HTML is the source of truth.

### 2. widget.html — Widget Markup

**Location:** `tokyo/widgets/{widget}/widget.html`

**Purpose:** Semantic HTML structure that widget.client.js will update.

**Rules:**
- Pure HTML (no placeholder/stencil syntax, no JSX)
- Add stable `data-role` attributes for JS selectors
- Use semantic elements (`<details>`, `<summary>`, `<form>`, etc.)
- Self-contained within the standard wrappers: `.stage` → `.pod` → widget root (`data-ck-widget="..."`)

**Example (FAQ):**
```html
<div class="stage" data-role="stage">
  <div class="pod" data-role="pod">
    <div class="ck-widget ck-faq-widget" data-ck-widget="faq" data-role="faq-widget">
      <section class="ck-faq" data-role="faq" data-layout="accordion" data-icon="plus" data-variant="default">
        <h2 class="ck-faq__title" data-role="faq-title">Frequently Asked Questions</h2>
        <ul class="ck-faq__list" data-role="faq-list"></ul>
      </section>
    </div>
  </div>
</div>
```

### 3. widget.css — Widget Styles

**Location:** `tokyo/widgets/{widget}/widget.css`

**Purpose:** All CSS needed for the widget (inlined in Venice SSR, linked in Bob preview).

**Rules:**
- Scoped to `.ck-widget` or `.ck-{widgetname}` class
- Use Dieter design tokens (CSS custom properties)
- Include responsive rules
- Import Dieter components if needed

**Example:**
```css
/* FAQ Widget Styles */
.ck-faq-widget {
  font-family: var(--font-ui);
  color: var(--color-text);
}

.ck-faq-title {
  font-size: var(--control-text-lg);
  font-weight: 500;
  margin-bottom: var(--space-lg);
}

.ck-faq-question {
  background: var(--color-bg-subtle);
  border-radius: var(--space-xs);
  margin-bottom: var(--space-md);
}

.ck-faq-question-trigger {
  cursor: pointer;
  padding: var(--space-md);
  display: flex;
  gap: var(--space-md);
}

/* Theme overrides from instanceData */
.ck-faq-widget[data-item-bg="#f0f0f0"] .ck-faq-question {
  background: #f0f0f0;
}

@media (max-width: 768px) {
  .ck-faq-title {
    font-size: var(--control-text-md);
  }
}
```

### 4. widget.client.js — Live Update Logic

**Location:** `tokyo/widgets/{widget}/widget.client.js`

**Purpose:** Applies state/config changes to DOM in real-time (Bob preview + Venice SSR).

**Required Function:**
```javascript
function applyState(state) {
  // Apply state to DOM
  // Mutate DOM elements, update text, rebuild lists, etc.
  // NO iframe reloads, NO re-renders
}
```

**Lifecycle:**

1. **On Load (Optional initial state):**
   ```javascript
   // Venice may set an initial state. (Bob preview usually relies on postMessage.)
   if (window.CK_WIDGET?.state) {
     applyState(window.CK_WIDGET.state);
   }
   ```

2. **On postMessage (Bob Editing):**
   ```javascript
   window.addEventListener('message', (event) => {
     if (!event.data || event.data.type !== 'ck:state-update') return;
     if (event.data.widgetname !== 'faq') return; // filter to your widget type

     applyState(event.data.state);
   });
   ```

3. **applyState Implementation (FAQ Example):**
   ```javascript
   function applyState(state) {
     const scriptEl = document.currentScript;
     const widgetRoot =
       (scriptEl && scriptEl.closest && scriptEl.closest('[data-ck-widget="faq"]')) ||
       document.querySelector('[data-ck-widget="faq"]');
     if (!widgetRoot) return;

     // Update title (root-scoped)
     const titleEl = widgetRoot.querySelector('[data-role="faq-title"]');
     if (titleEl) titleEl.textContent = state.title;

     // Rebuild list (root-scoped)
     const listEl = widgetRoot.querySelector('[data-role="faq-list"]');
     if (listEl) {
       // Build markup from state.sections[].faqs[]...
     }

     // Apply colors from state
     widgetRoot.style.setProperty('--faq-item-bg', state.itemBackgroundColor);
   }
   ```

### 5. agent.md — AI Contract (Recommended; required for AI editing)

**Location:** `tokyo/widgets/{widget}/agent.md`

**Purpose:** A short, widget-specific contract for agents/Copilot that makes intent and structure explicit without parsing arbitrary HTML/CSS/JS.

Include:
- Editable paths (high level, with examples)
- Parts map (stable selectors via `data-role` / `data-ck-widget`)
- Enums (`data-layout`, `data-state`, `data-variant`, etc.) and allowed values
- List semantics (insert/remove/move expectations for repeaters)
- Constraints (max lengths, allowed inline HTML, link rules, etc.)

---

## How Bob's Compiler Works

### Compiler: spec.json → CompiledWidget

**Input:** spec.json (fetched from Tokyo)

**Output:** CompiledWidget object

```typescript
interface CompiledWidget {
  widgetname: string;
  displayName: string;
  defaults: Record<string, unknown>;
  panels: Array<{ id: string; label: string; html: string }>;
  controls?: Array<{
    panelId: string;
    type: string;
    path: string;
    label?: string;
    showIf?: string;
    options?: Array<{ label: string; value: string }>;
  }>;
  assets: {
    htmlUrl: string;
    cssUrl: string;
    jsUrl: string;
    dieter?: { styles: string[]; scripts: string[] };
  };
}
```

**Algorithm:**
1. Parse `spec.json` as JSON
2. Parse `html[]` markup: `<bob-panel>` blocks → `panels[]`
3. Expand `<tooldrawer-field>` macros into Dieter markup (adds `data-bob-path`, wrappers for `show-if`, etc.)
4. Collect editable paths into `controls[]` (FAQ-only for now)
5. Generate asset URLs (Tokyo base URL + widget name)
6. Return CompiledWidget

**Compiler output is contract-level:** it powers ToolDrawer rendering and (when present) powers fail-closed ops/AI editing.

## How ToolDrawer Works (Generic Rendering)

ToolDrawer renders the compiled panel HTML; Bob injects it, hydrates Dieter components, and binds values via `data-bob-path`.

### ToolDrawer Input

From Bob's compilation:
```
CompiledWidget {
  panels[]: {
    id: "content",
    label: "Content",
    html: "<div ... data-bob-path='showTitle'>...</div><div ... data-bob-path='title' data-bob-showif=\"showTitle == 'true'\"></div>"
  },
  assets: {
    dieter: { styles: [...], scripts: [...] },
    htmlUrl/cssUrl/jsUrl: ...
  }
}

instanceData = {
  title: "My FAQ",
  showTitle: true
}
```

### ToolDrawer Algorithm

For the active panel:

1. Inject the panel HTML (from the spec) into the drawer.
2. Load Dieter CSS/JS for any `diet-*` components detected in that panel; call `Dieter.hydrateAll` after scripts load.
3. Walk elements with `data-bob-path`:
   - Apply `data-bob-showif` (hide if false against `instanceData` with defaults fallback).
   - Set the field value from `instanceData[path]`.
   - Bind input/change to `setValue(path, nextValue)`.
4. Bob updates `instanceData` in memory and posts `{ type: 'ck:state-update', widgetname, state }` to the preview iframe.

### Key Insight

No control schemas or hardcoded control lists exist in Bob. All control structure/markup lives in the widget spec; Bob just loads the needed Dieter assets, hydrates, and binds state for every widget. Same ToolDrawer for all 100+ widgets. 

---

## How Workspace + Preview Works

Workspace is Bob's preview iframe host.

### Workspace Input

From Bob:
```
compiled.assets = {
  htmlUrl: "https://tokyo.clickeen.com/widgets/faq/widget.html",
  cssUrl: "https://tokyo.clickeen.com/widgets/faq/widget.css",
  jsUrl: "https://tokyo.clickeen.com/widgets/faq/widget.client.js"
}

instanceData = {
  title: "My FAQ",
  categories: [...],
  // ... all state
}
```

### Workspace Flow

1. **On Mount:**
   - Create iframe pointing to `compiled.assets.htmlUrl`
   - `widget.html` is responsible for loading `widget.css`, `widget.client.js`, and any shared helpers
   - Bob only needs to set `iframe.src`

2. **Initial Render:**
   - After the iframe loads, Bob posts the first `{ type: 'ck:state-update', state: instanceData }`
   - (Optional) Venice may also set `window.CK_WIDGET.state` for SSR-first paint; widgets should support both

3. **On instanceData Change (Every Keystroke):**
   - **NO iframe reload**
   - Send postMessage to iframe:
     ```javascript
     iframe.contentWindow?.postMessage({
       type: 'ck:state-update',
       widgetname: 'faq',
       state: instanceData,
       device: 'desktop',
       theme: 'light'
     }, '*');
     ```

4. **In iframe (widget.client.js):**
   - widget.client.js listens for messages
   - On `ck:state-update`: calls `applyState(newState)`
   - applyState mutates DOM elements in place (text nodes, lists, visibility, colors, etc.)
   - **No iframe reloads, no react re-renders**

### Performance Benefit

Even with 10,000 simultaneous users editing:
- Each user has one working `instanceData` in memory (tiny)
- One postMessage per keystroke (efficient)
- Widget.client.js does simple DOM mutations (fast)
- NO server calls, NO database calls

---

## The Dieter Strategy

**Dieter is the mama of all HTML/CSS.**

Dieter isn't just "design system primitives" like button, toggle, textfield. It's **all UI patterns we use across Clickeen**—including widget-specific composed components.

### Component Structure

```
dieter/components/
  // Primitives
  button.css
  toggle.css
  textfield.css
  expander.css

  // Widget-specific compositions
  expander-faq.css
  expander-countdown.css
  card-testimonials.css
  timer-countdown.css

  // Bob-specific
  bob-basetooldrawer.css
```

### Why Widget-Specific Components Live in Dieter

1. **One place** - Engineers know where to look for ALL UI components
2. **Composable** - Built FROM Dieter primitives, but customized for widget needs
3. **Reusable** - "Need a new widget? Copy `expander-faq`, rename it, modify it"
4. **Maintainable** - Update parent component, all compositions update too

### The Performance Win

**We never load all of Dieter.** Each widget only loads the CSS/JS for components it actually uses.

FAQ widget loads (in widget.css):
- Dieter tokens (`--font-ui`, `--space-lg`, etc.)
- Dieter primitives (button, toggle, etc. if needed)
- Custom FAQ styles

Countdown widget loads (in widget.css):
- Dieter tokens
- Custom countdown styles

**Result**: Dieter can have 10 components or 1,000 components—doesn't matter. Each widget only includes what it needs.

No bloat. No performance penalty. Infinite scalability.

## Why This Architecture Enables the Moats

This architecture is foundational to Clickeen's competitive advantages, especially AI-Native design:

### 1. Simple to Build
Engineers write a small Tokyo widget folder (runtime: `spec.json`, `widget.html`, `widget.css`, `widget.client.js`) plus `agent.md` when AI editing is enabled. No React expertise required; `spec.json` is JSON with a tiny markup DSL; `widget.client.js` is straightforward DOM updates.

### 2. Simple to Use
"Need to build a new widget? Go to Tokyo, find something similar, copy the widget folder, customize it."

One place to look. One pattern to follow. Hard to mess up.

### 3. Scales to Hundreds of Widgets
Each widget is self-contained (Tokyo folder). No shared widget code in Bob. Add more widgets by adding more folders.

### 4. Operational Efficiency
All editing happens client-side in memory. No database hits until publish. No server load from editing sessions. 10,000 simultaneous editors = 10,000 in-memory working states, zero DB load.

### 5. Easy to Maintain
- Update Dieter tokens → all widgets update automatically
- Fix a bug in Bob or the compiler → all widgets benefit
- Add a new widget → doesn't affect existing ones
- Widget specs are data, not code—easier to version and diff

### 6. Enables AI-First Future
Want to add AI editing mode? The platform contract (compiled `controls[]` + ops protocol + `agent.md`) makes AI edits deterministic and fail-closed.
Want to add AI-powered suggestions? Same contract can generate safe ops and apply them preview-first.
Want to generate new widgets? AI can read `spec.json` + `agent.md` patterns and generate new widget folders from examples.

**The key insight:** This architecture is what makes AI-Native design possible. By treating all widgets as structured data (spec.json + assets), AI can:
- Read spec.json to understand widget structure
- Modify instance data to edit widgets
- Generate new widgets by copying and modifying examples
- All without touching widget-specific code (it's just data)

The generic 50% (Bob + compiler) keeps getting better. The widget-specific 50% (Tokyo widget folders) stays simple and AI-understandable.

### 7. No Separate Starter System

Starter designs are implemented as **widget instances**, not a separate system.

Competitors maintain two parallel systems:
- Gallery presets (separate CRUD, versioning, copy logic)
- Widget instances (user’s widgets)

Clickeen has one system:
- Widget instances (some created by Clickeen as starters, others created by users)

**How starter designs work:**
1. Clickeen team creates widget instances using Bob Editor (via DevStudio)
2. Instances named with `ck-` prefix: `ck-faq-christmas`, `ck-countdown-blackfriday`
3. These are flagged as available for users to clone
4. User clones → gets their own copy → customizes freely

**Benefits:**
- One system to maintain
- Clickeen dog-foods the same editor users use
- Any instance can become a shareable starter (future: user marketplace)
- Full customization (starters are not locked-down)

## The Complete Picture

```
Tokyo (Widget Definitions)
├── widgets/faq/
│   ├── spec.json          (ToolDrawer spec + defaults)
│   ├── widget.html        (semantic markup)
│   ├── widget.css         (scoped styles)
│   ├── widget.client.js   (applyState + DOM updates)
│   └── agent.md           (AI contract; required for AI editing)
├── widgets/countdown/
│   └── (same runtime files; agent.md optional until AI editing enabled)
└── (100+ more widgets)

Bob (Generic Editor)
├── Fetches spec.json from Tokyo
├── Compiler builds → CompiledWidget (panels + assets + optional controls[])
├── Holds working config in React state (`instanceData`)
├── Generic ToolDrawer renders controls from CompiledWidget
├── Syncs instanceData to preview iframe via postMessage
├── (When enabled) validates/apply ops fail-closed via controls[]
└── Publishes instanceData to Paris on user click (as `config`)

Workspace (Preview Host)
├── Loads widget.html from Tokyo (which loads widget.css + widget.client.js)
├── Receives postMessage: widget.client.js calls applyState(instanceData)
└── NO iframe reloads, NO re-renders

Dieter (Design System)
├── Primitive components (button, toggle, input)
├── Composed components (expander-faq, card-testimonials)
├── Tokens (colors, spacing, typography)
└── Each widget.css imports only what it needs

Paris (Database)
├── Stores published config (indexed by publicId)
├── Only touched on Publish (when instanceData becomes the new published config)
└── Zero writes during editing
```

## The Complete Data Flow

```
1. User opens widget instance
	   ↓ Bob calls GET /api/instance/:publicId to Paris
2. Paris returns published config
	   ↓ Bob fetches spec.json from Tokyo
3. Compiler parses spec.json → CompiledWidget
	   ↓ Bob creates instanceData = merge(spec.defaults, config)
4. ToolDrawer renders from CompiledWidget (panels[])
5. User types in a control
	   ↓ setValue(path, value) updates instanceData
	   ↓ Bob sends postMessage to Workspace iframe
6. widget.client.js receives ck:state-update message
	   ↓ applyState(instanceData) mutates DOM
	   ↓ Preview updates instantly (no reload)
7. User clicks "Publish"
	   ↓ Bob sends PUT /api/instance/:publicId with instanceData as config
	   ↓ Paris saves config as the new published config
8. Done. Next user that opens this widget gets the new published config.
```

## How Venice Uses The Same Files

Venice (embed renderer) uses the same widget files from Tokyo:

```
1. User embeds widget via <script src="...">
2. Venice loads published config from Paris (or fetches if not cached)
3. Venice fetches widget files from Tokyo:
	   - widget.html (renders as-is)
	   - widget.css (inlines in <style> tag)
	   - widget.client.js (includes in <script> tag)
	   - agent.md (NOT used at runtime; AI-only)
4. Venice renders:
	   <style>/* widget.css inlined */</style>
	   <div><!-- widget.html content --></div>
	   <script>/* widget.client.js */</script>
5. widget.client.js runs:
	   - Optionally reads window.CK_WIDGET.state (Venice may set this for SSR-first paint)
	   - Always listens for postMessage patches in preview contexts
	   - Calls applyState(state) to sync DOM
6. Widget is now live and interactive (same DOM logic as Bob preview)
```

**Same runtime files, used in 2 places:**
- Bob: Live editing preview
- Venice: Production embed rendering

---

## Standard Widget Patterns

### Required Patterns for All Widgets

#### 1. Responsive Design
All widgets MUST work on desktop, tablet, and mobile.

**In spec.json:**
```html
<tooldrawer-field
  type="slider"
  label="Column Count (Desktop)"
  path="columnCountDesktop"
  min="1"
  max="4"
/>
<tooldrawer-field
  type="slider"
  label="Column Count (Tablet)"
  path="columnCountTablet"
  min="1"
  max="3"
  show-if="layoutMode == 'multicolumn'"
/>
```

**In widget.css:**
```css
@media (max-width: 1024px) {
  /* Tablet styles */
}
@media (max-width: 768px) {
  /* Mobile styles */
}
```

#### 2. Color Customization
Most widgets allow color customization via Dieter color pickers.

**In spec.json:**
```html
<tooldrawer-field
  type="color-picker"
  label="Item Background Color"
  path="itemBackgroundColor"
/>
```

**In widget.css:**
```css
.ck-widget-item {
  background: var(--widget-item-bg, #ffffff);
}
```

**In widget.client.js applyState:**
```javascript
widgetRoot.style.setProperty('--widget-item-bg', state.itemBackgroundColor);
```

#### 3. Theme Support
Widgets support light and dark themes.

**In widget.css:**
```css
.ck-widget { color: var(--color-text); }
.ck-widget[data-theme="dark"] { color: var(--color-text-dark); }
```

#### 4. Accessibility
All widgets MUST be keyboard-navigable and screen-reader accessible.

**In widget.html:**
```html
<button aria-label="Open menu">...</button>
<div role="navigation">...</div>
<input aria-required="true" />
```

**In widget.css:**
```css
button:focus-visible { outline: 2px solid var(--color-focus); }
```

#### 5. Root-Scoped Queries
Widget JS must query within the widget root so multiple widgets can coexist.

**In widget.client.js:**
```javascript
const widgetRoot = document.currentScript?.closest('[data-ck-widget]') ?? document.querySelector('[data-ck-widget]');
if (!widgetRoot) return;
const titleEl = widgetRoot.querySelector('[data-role="..."]');
```

#### 6. State Encoding via `data-*` Enums
Encode UI state with explicit, low-cardinality enums so CSS + agents can reason about state.

**In widget.html:**
```html
<section data-role="faq" data-layout="accordion" data-variant="default" data-state="ready"></section>
```

## For Engineers: How to Build a Widget

### Step 1: Create Tokyo Directory Structure
```
tokyo/widgets/{widgetname}/
├── spec.json
├── widget.html
├── widget.css
├── widget.client.js
└── agent.md            # recommended; required for AI editing
```

### Step 2: Write spec.json (ToolDrawer Structure)

`spec.json` is JSON with an `html: string[]` array that contains `<bob-panel>` blocks and `<tooldrawer-field>` macros.

```json
{
  "widgetname": "mywidget",
  "defaults": { "title": "My Widget" },
  "html": [
    "<bob-panel id='content'>",
    "  <tooldrawer-field type='textfield' size='md' path='title' label='Title' />",
    "</bob-panel>",
    "<bob-panel id='layout'>",
    "  <tooldrawer-field type='slider' size='md' path='layout.gap' label='Gap (px)' min='0' max='80' />",
    "</bob-panel>"
  ]
}
```

### Step 3: Write widget.html (Semantic Markup)

Create pure HTML structure with stable `data-role` selectors and the standard wrappers:

```html
<div class="stage" data-role="stage">
  <div class="pod" data-role="pod">
    <div class="ck-widget ck-mywidget-widget" data-ck-widget="mywidget" data-role="mywidget">
      <h2 class="ck-mywidget-title" data-role="title">My Widget</h2>
      <div class="ck-mywidget-content" data-role="content"></div>
    </div>
  </div>
</div>
```

### Step 4: Write widget.css (Scoped Styles)

Style everything scoped to `.ck-widget` or `.ck-{widgetname}`:

```css
.ck-mywidget-widget {
  font-family: var(--font-ui);
  color: var(--color-text);
}

.ck-mywidget-title {
  font-size: var(--control-text-lg);
}

/* Use CSS variables for dynamic values */
.ck-mywidget-widget {
  --widget-width: var(--user-width, 100%);
  width: var(--widget-width);
}

@media (max-width: 768px) {
  /* Mobile styles */
}
```

### Step 5: Write widget.client.js (applyState Function)

Implement `applyState(state)` with **root-scoped queries** and a `ck:state-update` listener:

```javascript
(function () {
  const widgetRoot =
    document.currentScript?.closest('[data-ck-widget="mywidget"]') ??
    document.querySelector('[data-ck-widget="mywidget"]');
  if (!widgetRoot) return;

  function applyState(state) {
    const titleEl = widgetRoot.querySelector('[data-role="title"]');
    if (titleEl) titleEl.textContent = String(state?.title ?? '');
  }

  window.addEventListener('message', (event) => {
    if (!event.data || event.data.type !== 'ck:state-update') return;
    if (event.data.widgetname !== 'mywidget') return;
    applyState(event.data.state || {});
  });
})();
```

### Step 6: Write agent.md (AI Contract)

If the widget supports AI editing, add `agent.md` describing:
- Editable paths and list semantics (insert/remove/move)
- Parts map (selectors + meaning)
- Allowed enums (`data-layout`, `data-state`, `data-variant`, etc.)
- Content constraints (allowed inline HTML, max lengths, link rules)

### Step 7: Test in Bob

1. Bob fetches your spec.json from Tokyo
2. Compiler builds it → CompiledWidget
3. ToolDrawer renders controls
4. Edit in preview
5. Changes flow through postMessage → applyState

### Step 8: Venice Will Use Same Runtime Files

Once published, Venice uses the exact same runtime files (`widget.html`, `widget.css`, `widget.client.js`) to render the widget in production embeds. (`agent.md` is AI-only and not used at runtime.)

## Checklist: New Widget Implementation

- ✅ spec.json created with all 5 panels and controls
- ✅ widget.html has stable `data-role` parts and `data-ck-widget`
- ✅ widget.css scoped to `.ck-widget` or `.ck-{widgetname}`
- ✅ widget.css uses Dieter tokens (--space-*, --color-*, --font-*)
- ✅ widget.client.js implements applyState(state) function
- ✅ widget.client.js uses root-scoped queries and listens for `ck:state-update`
- ✅ widget.html has proper semantic elements and ARIA labels
- ✅ widget.css includes @media queries for mobile/tablet
- ✅ All colors/sizes/fonts in config → applied in applyState
- ✅ (If AI-enabled) agent.md describes editable paths/parts/enums
- ✅ No custom React components needed
- ✅ No widget-specific parsing needed in Bob

## Implementation Benefits

This architecture provides excellent development experience:

- **Fast development** - Write one widget folder, Bob handles the rest (hours, not days)
- **No framework learning** - Plain HTML, CSS, and JavaScript (skills most engineers have)
- **Reusable patterns** - Copy an existing widget folder, customize (DRY)
- **Performance by default** - Lightweight DOM mutations, no re-renders (fast by design)
- **Easy to debug** - Simple control flow, no complex state machinery
- **Scale forever** - 10 widgets or 1,000 widgets, same process
- **AI-legible** - spec.json + agent.md are explicit contracts for AI to read/modify/generate safely

## The Philosophy

Each widget is **50% widget definition** (spec.json + widget runtime + agent contract) and **50% Bob** (editor, ToolDrawer, Preview, Publish).

- Widget logic stays simple: declarative data + DOM mutations
- Bob stays generic: parses any spec.json, renders any control, syncs any state
- Together: a complete, scalable widget editing platform

We're building something elegant, simple, and scalable.

Like Dieter Rams would approve of.
