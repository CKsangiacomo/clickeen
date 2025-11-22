# Bob & Widget Architecture: Building for Scale

STATUS: NORMATIVE — Source of Truth (Sep 2025)

## The Challenge

We're building Clickeen to support **hundreds of widget types** and **tens of thousands of users** creating personalized widget instances.

The old approach—building custom React components for every widget type—doesn't scale. 100 widgets = 100+ components to build and maintain. Engineers get confused about which components to use. Wrapper components proliferate across the codebase. It becomes unmaintainable fast.

We need a different approach.

## The Solution: Widget Definitions + Stateless Compiler + Live Editing

**Core insight**: A widget editor isn't one piece of software. It's THREE pieces working together:

**Denver = Widget Definitions** (the source of truth)
- Owns widget structure, UI, styles, and runtime
- For each widget {widget}: `denver/widgets/{widget}/spec.json`, `widget.html`, `widget.css`, `widget.client.js`
- DevStudio fetches specs from Denver and posts into Bob
- Never changes during a session

**Bob = 50% of the software** (the generic editor shell)
- Loads and parses widget spec (spec.json)
- Holds editingState in memory during editing
- Provides the UI shell and ToolDrawer
- Manages live preview via postMessage
- On Publish: sends editingState → Paris as instanceData

**Widget Runtime = 50% of the software** (the widget-specific client)
- `widget.client.js`: Applies editingState to DOM in real-time
- `widget.html`: Semantic markup for the widget
- `widget.css`: Styles for the widget
- Lives in Denver; loaded by Bob's preview and Venice's SSR

Together, **Denver + Bob + widget.client.js = a complete widget editing and rendering system**.

## The Data Flow

```
1. User opens widget instance
   ↓
2. Bob fetches spec.json from Denver (defines ToolDrawer structure)
   ↓
3. compiler.ts parses spec.json → CompiledWidget (panels[], controls[], asset URLs)
   ↓
4. Bob loads instanceData from Paris (published configuration)
   ↓
5. Bob seeds editingState = merge(spec defaults, instanceData)
   ↓
6. User edits in ToolDrawer
   ↓
7. Bob updates editingState only (NO API calls, NO DB touch)
   ↓
8. Bob sends postMessage to workspace iframe:
   {
     type: 'ck:state-update',
     widgetname,
     state: editingState,
     device,
     theme
   }
   ↓
9. widget.client.js receives message
   ↓
10. applyState(editingState) mutates DOM in place
    (text nodes, lists, counts, etc.)
   ↓
11. Preview updates instantly, NO iframe reload
   ↓
12. User clicks "Publish"
   ↓
13. Bob sends ONE PUT to Paris: editingState → instanceData
   ↓
14. Done (DB now has the new config)
```

### Key Architectural Decisions

**Preview = Live Editing State (NOT DB)**
- During editing: editingState exists only in Bob's memory
- Bob → Workspace: postMessage with editingState
- Workspace → widget.client.js: applyState(editingState)
- No iframe reloads, no DB calls, no syncing

**Publish = Promote editingState to DB**
- User clicks Publish
- Bob sends editingState to Paris
- Paris saves as instanceData
- Next load: editingState seeds from published instanceData

**Database Isolation**
- **Before Publish:** DB is untouched (zero pollution, zero locks)
- **After Publish:** DB has the new instanceData
- 10,000 users editing simultaneously = 10,000 editingStates in memory, zero DB load

### Why This Matters

**No database pollution** - Every keystroke doesn't hit the DB. Editing is in-memory only. Publish sends final state once.

**No complex sync logic** - Bob is single source of truth during editing. No conflicts, no race conditions, no sync nightmares.

**Scales effortlessly** - 1 user or 10,000 simultaneous editors: same memory footprint per user, zero server load from editing.

**Live preview without reload** - postMessage + applyState = instant visual feedback on every keystroke.

**Separation of concerns** - Denver owns widget logic; Bob owns editing flow; Paris owns published data.

## How Widget Definitions Work (Denver)

Each widget type consists of **4 files in Denver**:

### 1. spec.json — Widget Structure & ToolDrawer Definition

**Location:** `denver/widgets/{widget}/spec.json`

**Purpose:** Defines ToolDrawer panels as HTML using Dieter components; parsed by compiler.ts.

**Structure (HTML snippet per panel):**
```json
{
  "widgetname": "faq",
  "defaults": { "title": "Frequently Asked Questions", "showTitle": true },
  "html": [
    "<bob-panel id='content'>",
    "  <div class=\"diet-toggle diet-toggle--split\" data-size=\"md\">",
    "    <label class=\"diet-toggle__label label-s\">Show title</label>",
    "    <label class=\"diet-toggle__switch\">",
    "      <input class=\"diet-toggle__input sr-only\" type=\"checkbox\" role=\"switch\" aria-label=\"Show title\" data-bob-path=\"showTitle\" />",
    "      <span class=\"diet-toggle__knob\"></span>",
    "    </label>",
    "  </div>",
    "  <div class=\"diet-textfield\" data-size=\"md\">",
    "    <div class=\"diet-textfield__control\">",
    "      <label class=\"diet-textfield__display-label label-s\">FAQ title</label>",
    "      <input class=\"diet-textfield__field\" type=\"text\" aria-label=\"FAQ title\" placeholder=\"Frequently Asked Questions\" data-bob-path=\"title\" data-bob-showif=\"showTitle == 'true'\" />",
    "    </div>",
    "  </div>",
    "</bob-panel>"
  ]
}
```
Rules:
- Controls use Dieter markup and must include `data-bob-path` (and optional `data-bob-showif`) for binding.
- Panels are segmented by `<bob-panel id='...'>` blocks; Bob handles layout/switching.
- No control schemas or Bob-side rendering logic; the HTML is the source of truth.

### 2. widget.html — Widget Markup

**Location:** `denver/widgets/{widget}/widget.html`

**Purpose:** Semantic HTML structure that widget.client.js will update.

**Rules:**
- Pure HTML (no template syntax, no JSX)
- Add `data-*` attributes for JS selectors
- Use semantic elements (`<details>`, `<summary>`, `<form>`, etc.)
- **DO NOT** include styles; link to CSS file
- Self-contained within `<div class="ck-widget">` container

**Example (FAQ):**
```html
<div class="ck-widget ck-faq-widget" data-widget-id="{{publicId}}">
  <h1 class="ck-faq-title" data-field="title">FAQ Title</h1>

  <div class="ck-faq-search-container" data-field="search">
    <input
      type="search"
      class="ck-faq-search"
      placeholder="Search questions..."
      data-field="search-input"
    />
  </div>

  <div class="ck-faq-categories" data-field="categories">
    <details class="ck-faq-question" data-question-id="q1">
      <summary class="ck-faq-question-trigger">
        <span class="ck-faq-icon">+</span>
        <span class="ck-faq-question-text" data-field="question-text">How do I get started?</span>
      </summary>
      <div class="ck-faq-answer" data-field="answer">
        <p>Follow our quick start guide.</p>
      </div>
    </details>
  </div>

  <footer class="ckeen-backlink">
    <a href="https://clickeen.com" target="_blank">Made with Clickeen</a>
  </footer>
</div>
```

### 3. widget.css — Widget Styles

**Location:** `denver/widgets/{widget}/widget.css`

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

**Location:** `denver/widgets/{widget}/widget.client.js`

**Purpose:** Applies editingState changes to DOM in real-time (Bob preview + Venice SSR).

**Required Function:**
```javascript
function applyState(state) {
  // Apply state to DOM
  // Mutate DOM elements, update text, rebuild lists, etc.
  // NO iframe reloads, NO re-renders
}
```

**Lifecycle:**

1. **On Load (Bob Preview):**
   ```javascript
   // Read initial state from Bob
   if (window.CK_WIDGET?.state) {
     applyState(window.CK_WIDGET.state);
   }
   ```

2. **On postMessage (Bob Editing):**
   ```javascript
   window.addEventListener('message', (event) => {
     if (!event.data || event.data.type !== 'ck:state-update') return;
     if (event.data.widgetname !== 'faq') return;

     applyState(event.data.state);
   });
   ```

3. **applyState Implementation (FAQ Example):**
   ```javascript
   function applyState(state) {
     // Update title
     const titleEl = document.querySelector('[data-field="title"]');
     if (titleEl) titleEl.textContent = state.title;

     // Update search visibility
     const searchContainer = document.querySelector('[data-field="search"]');
     if (searchContainer) {
       searchContainer.style.display = state.showSearchBar ? 'block' : 'none';
     }

     // Rebuild questions list
     const categoriesEl = document.querySelector('[data-field="categories"]');
     if (categoriesEl) {
       categoriesEl.innerHTML = state.categories.map((cat) => `
         <h2>${cat.title}</h2>
         ${cat.questions.map((q) => `
           <details class="ck-faq-question">
             <summary>
               <span class="ck-faq-question-text">${q.question}</span>
             </summary>
             <div class="ck-faq-answer">${q.answer}</div>
           </details>
         `).join('')}
       `).join('');
     }

     // Apply colors from state
     document.documentElement.style.setProperty(
       '--faq-item-bg',
       state.itemBackgroundColor
     );
   }
   ```

---

## How Bob's Compiler Works

### compiler.ts: spec.json → CompiledWidget

**Input:** spec.json (fetched from Denver)

**Output:** CompiledWidget object

```typescript
interface CompiledWidget {
  widgetName: string;
  panels: {
    id: string;              // "content", "layout", "style", "advanced", "settings"
    label: string;           // "Content", "Layout", "Style", "Advanced", "Settings"
    controls: Control[];
  }[];
  defaults: Record<string, any>;
  assets: {
    htmlUrl: string;         // https://denver.clickeen.com/widgets/faq/widget.html
    cssUrl: string;          // https://denver.clickeen.com/widgets/faq/widget.css
    jsUrl: string;           // https://denver.clickeen.com/widgets/faq/widget.client.js
  };
}

interface Control {
  key: string;              // "title"
  type: string;             // "textfield", "toggle", "slider", "segmented", etc.
  label: string;
  path: string;             // "title", "categories.0.name", etc.
  size?: string;            // "sm", "md", "lg"
  placeholder?: string;
  min?: number;
  max?: number;
  unit?: string;
  options?: string;         // "accordion,list,multicolumn"
  showIf?: string;          // Conditional visibility (evaluated against editingState)
}
```

**Algorithm:**
1. Parse spec.json XML
2. Extract `<bob-panel>` elements → panels[]
3. Extract `<tooldrawer-field>` per panel → controls[]
4. Extract `<defaults>` → defaults object
5. Generate asset URLs (DENVER base URL + widget name)
6. Return CompiledWidget

**No rendering, no validation, no fake defaults** — just structural parsing.

## How ToolDrawer Works (Generic Rendering)

ToolDrawer renders the exact HTML the widget spec provides; Bob only binds and hydrates.

### ToolDrawer Input

From Bob's compilation:
```
CompiledWidget {
  panels[]: {
    id: "content",
    label: "Content",
    html: "<div class='diet-toggle' ... data-bob-path='showTitle'>...</div><div class='diet-textfield' ... data-bob-path='title' data-bob-showif=\"showTitle == 'true'\"></div>"
  },
  assets: {
    dieter: { styles: [...], scripts: [...] },
    htmlUrl/cssUrl/jsUrl: ...
  }
}

editingState = {
  title: "My FAQ",
  showTitle: true
}
```

### ToolDrawer Algorithm

For the active panel:

1. Inject the panel HTML (from the spec) into the drawer.
2. Load Dieter CSS/JS for any `diet-*` components detected in that panel; call `Dieter.hydrateAll` after scripts load.
3. Walk elements with `data-bob-path`:
   - Apply `data-bob-showif` (hide if false against editingState).
   - Set the field value from `editingState[path]`.
   - Bind input/change to `setValue(path, nextValue)`.
4. Bob re-renders and posts `{ type: 'ck:state-update', widgetname, state }` to the preview iframe.

### Key Insight

No control schemas or hardcoded control lists exist in Bob. All control structure/markup lives in the widget spec; Bob just loads the needed Dieter assets, hydrates, and binds state for every widget. Same ToolDrawer for all 100+ widgets. 

---

## How Workspace + Preview Works

Workspace is Bob's preview iframe host.

### Workspace Input

From Bob:
```
compiled.assets = {
  htmlUrl: "https://denver.clickeen.com/widgets/faq/widget.html",
  cssUrl: "https://denver.clickeen.com/widgets/faq/widget.css",
  jsUrl: "https://denver.clickeen.com/widgets/faq/widget.client.js"
}

editingState = {
  title: "My FAQ",
  categories: [...],
  // ... all state
}
```

### Workspace Flow

1. **On Mount:**
   - Create iframe pointing to `compiled.assets.htmlUrl`
   - Load CSS via `<link href="{cssUrl}">`
   - Load JS via `<script src="{jsUrl}">`

2. **Initial Render:**
   - Set `window.CK_WIDGET = { widgetname, publicId, state: editingState, device, theme }`
   - widget.client.js reads this and calls `applyState(editingState)` to sync DOM

3. **On editingState Change (Every Keystroke):**
   - **NO iframe reload**
   - Send postMessage to iframe:
     ```javascript
     iframe.contentWindow?.postMessage({
       type: 'ck:state-update',
       widgetname: 'faq',
       state: editingState,
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
- Each user has one editingState in memory (tiny)
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
Engineers write 4 files (spec.json, widget.html, widget.css, widget.client.js). No React expertise required. Spec.json is declarative XML; HTML/CSS are standard; widget.client.js is simple DOM manipulation.

### 2. Simple to Use
"Need to build a new widget? Go to Denver, find something similar, copy the 4 files, customize them."

One place to look. One pattern to follow. Hard to mess up.

### 3. Scales to Hundreds of Widgets
Each widget is self-contained (4 files in Denver). No shared state. No dependencies. Just add more widgets. Each gets its own spec.json + assets.

### 4. Operational Efficiency
All editing happens client-side in memory. No database hits until publish. No server load from editing sessions. 10,000 simultaneous editors = 10,000 in-memory editingStates, zero DB load.

### 5. Easy to Maintain
- Update Dieter tokens → all widgets update automatically
- Fix a bug in Bob or compiler.ts → all widgets benefit
- Add a new widget → doesn't affect existing ones
- Widget specs are data, not code—easier to version and diff

### 6. Enables AI-First Future
Want to add AI editing mode? Bob handles it, all widgets get it for free.
Want to add AI-powered suggestions? Bob handles it, all widgets get it for free.
Want to generate new widgets? AI reads spec.json (declarative), generates new widgets from examples.

**The key insight:** This architecture is what makes AI-Native design possible. By treating all widgets as structured data (spec.json + assets), AI can:
- Read spec.json to understand widget structure
- Modify instance data to edit widgets
- Generate new widgets by copying and modifying examples
- All without touching widget-specific code (it's just data)

The generic 50% (Bob + compiler.ts) keeps getting better with AI. The widget-specific 50% (Denver files) stays simple and AI-understandable.

## The Complete Picture

```
Denver (Widget Definitions)
├── widgets/faq/
│   ├── spec.json          (declarative ToolDrawer structure)
│   ├── widget.html        (semantic markup)
│   ├── widget.css         (scoped styles)
│   └── widget.client.js   (applyState function)
├── widgets/countdown/
│   └── (same 4 files)
└── (100+ more widgets)

Bob (Generic Editor)
├── Fetches spec.json from Denver
├── compiler.ts parses → CompiledWidget
├── Holds editingState in React state
├── Generic ToolDrawer renders controls from CompiledWidget
├── Syncs editingState to preview iframe via postMessage
└── Publishes editingState to Paris on user click

Workspace (Preview Host)
├── Loads widget.html from Denver
├── Loads widget.css from Denver
├── Loads widget.client.js from Denver
├── Sets window.CK_WIDGET with initial editingState
├── On postMessage: calls widget.client.js applyState(editingState)
└── NO iframe reloads, NO re-renders

Dieter (Design System)
├── Primitive components (button, toggle, input)
├── Composed components (expander-faq, card-testimonials)
├── Tokens (colors, spacing, typography)
└── Each widget.css imports only what it needs

Paris (Database)
├── Stores published instanceData (indexed by publicId)
├── Only touched on Publish (when editingState becomes instanceData)
└── Zero writes during editing
```

## The Complete Data Flow

```
1. User opens widget instance
   ↓ Bob calls GET /api/instance/:publicId to Paris
2. Paris returns published instanceData
   ↓ Bob fetches spec.json from Denver
3. compiler.ts parses spec.json → CompiledWidget
   ↓ Bob creates editingState = merge(spec.defaults, instanceData)
4. ToolDrawer renders from CompiledWidget (panels[] + controls[])
5. User types in a control
   ↓ setValue(path, value) updates editingState
   ↓ Bob sends postMessage to Workspace iframe
6. widget.client.js receives ck:state-update message
   ↓ applyState(editingState) mutates DOM
   ↓ Preview updates instantly (no reload)
7. User clicks "Publish"
   ↓ Bob sends PUT /api/instance/:publicId with editingState as body
   ↓ Paris saves editingState as the new instanceData
8. Done. Next user that opens this widget gets the new instanceData.
```

## How Venice Uses The Same Files

Venice (embed renderer) uses the same widget files from Denver:

```
1. User embeds widget via <script src="...">
2. Venice loads published instanceData from Paris (or fetches if not cached)
3. Venice fetches widget files from Denver:
   - widget.html (renders as-is)
   - widget.css (inlines in <style> tag)
   - widget.client.js (includes in <script> tag)
4. Venice renders:
   <style>/* widget.css inlined */</style>
   <div><!-- widget.html content --></div>
   <script>/* widget.client.js */</script>
5. widget.client.js runs:
   - Reads window.CK_WIDGET.state (Venice sets this)
   - Calls applyState(state) to sync DOM
6. Widget is now live and interactive (same DOM logic as Bob preview)
```

**Same 4 files, used in 2 places:**
- Bob: Live editing preview
- Venice: Production embed rendering

---

## Standard Widget Patterns

### Required Patterns for All Widgets

#### 1. Responsive Design
All widgets MUST work on desktop, tablet, and mobile.

**In spec.json:**
```xml
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
  showIf="layoutMode == 'multicolumn'"
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
```xml
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
document.documentElement.style.setProperty(
  '--widget-item-bg',
  state.itemBackgroundColor
);
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

## For Engineers: How to Build a Widget

### Step 1: Create Denver Directory Structure
```
denver/widgets/{widgetname}/
├── spec.json
├── widget.html
├── widget.css
└── widget.client.js
```

### Step 2: Write spec.json (ToolDrawer Structure)

Define 5 panels and their controls in declarative XML:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<widget id="mywidget">
  <defaults>
    <title>My Widget</title>
    <!-- More defaults -->
  </defaults>

  <bob-panel id="content" label="Content">
    <tooldrawer-field type="textfield" label="Title" path="title" />
    <!-- More content controls -->
  </bob-panel>

  <bob-panel id="layout" label="Layout">
    <tooldrawer-field type="slider" label="Width" path="width" min="200" max="1200" />
    <!-- More layout controls -->
  </bob-panel>

  <!-- Panels 3, 4, 5 similarly -->
</widget>
```

### Step 3: Write widget.html (Semantic Markup)

Create pure HTML structure with `data-*` attributes for selectors:

```html
<div class="ck-widget ck-mywidget-widget">
  <h1 class="ck-mywidget-title" data-field="title">Widget Title</h1>

  <div class="ck-mywidget-content" data-field="content">
    <!-- Content here -->
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

Implement the one required function:

```javascript
function applyState(state) {
  // Update title
  const titleEl = document.querySelector('[data-field="title"]');
  if (titleEl) titleEl.textContent = state.title;

  // Update width
  document.documentElement.style.setProperty(
    '--user-width',
    (state.width || 100) + 'px'
  );

  // Rebuild lists if needed
  const contentEl = document.querySelector('[data-field="content"]');
  if (contentEl) {
    contentEl.innerHTML = state.items.map(item => `
      <div class="ck-item">${item.title}</div>
    `).join('');
  }
}
```

### Step 6: Test in Bob

1. Bob fetches your spec.json from Denver
2. compiler.ts parses it → CompiledWidget
3. ToolDrawer renders controls
4. Edit in preview
5. Changes flow through postMessage → applyState

### Step 7: Venice Will Use Same Files

Once published, Venice uses the exact same 4 files to render the widget in production embeds. Zero additional work needed.

## Checklist: New Widget Implementation

- ✅ spec.json created with all 5 panels and controls
- ✅ widget.html has `data-field` attributes for all dynamic content
- ✅ widget.css scoped to `.ck-widget` or `.ck-{widgetname}`
- ✅ widget.css uses Dieter tokens (--space-*, --color-*, --font-*)
- ✅ widget.client.js implements applyState(state) function
- ✅ widget.client.js handles all control types from spec.json
- ✅ widget.html has proper semantic elements and ARIA labels
- ✅ widget.css includes @media queries for mobile/tablet
- ✅ All colors/sizes/fonts in instanceData → applied in applyState
- ✅ No custom React components needed
- ✅ No widget-specific parsing needed in Bob

## Implementation Benefits

This architecture provides excellent development experience:

- **Fast development** - Write 4 files, Bob handles the rest (hours, not days)
- **No framework learning** - Plain HTML, CSS, and JavaScript (skills most engineers have)
- **Reusable patterns** - Copy existing widget's 4 files, customize (DRY)
- **Performance by default** - Lightweight DOM mutations, no re-renders (fast by design)
- **Easy to debug** - Simple control flow, no complex state machinery
- **Scale forever** - 10 widgets or 1,000 widgets, same process
- **AI-legible** - spec.json is declarative data, easy for AI to read/modify/generate

## The Philosophy

Each widget is **50% logic** (spec.json + applyState) and **50% Bob** (editor, ToolDrawer, Publish).

- Widget logic stays simple: declarative data + DOM mutations
- Bob stays generic: parses any spec.json, renders any control, syncs any state
- Together: a complete, scalable widget editing platform

We're building something elegant, simple, and scalable.

Like Dieter Rams would approve of.
