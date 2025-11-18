# Bob & Widget Architecture: Building for Scale

## The Challenge

We're building Clickeen to support **hundreds of widget types** and **tens of thousands of users** creating personalized widget instances.

The old approach—building custom React components for every widget type—doesn't scale. 100 widgets = 100+ components to build and maintain. Engineers get confused about which components to use. Wrapper components proliferate across the codebase. It becomes unmaintainable fast.

We need a different approach.

## The Solution: Widget JSON as Software

**Core insight**: A widget editor isn't one piece of software. It's TWO pieces working together:

**Bob = 50% of the software** (the generic editor shell)
- Loads widget instances
- Holds instanceData in memory during editing
- Provides the layout and preview
- Manages state and saves to Paris

**Widget JSON = 50% of the software** (the widget-specific intelligence)
- Defines what controls to show
- Defines how controls map to instanceData
- Provides validation and defaults
- Contains the actual HTML/CSS for the UI

Together, **Bob + Widget JSON = a complete widget instance editor**.

Without the JSON, Bob is an empty shell. Without Bob, the JSON is just data. Together, they work.

## How Bob Works

Bob ([bob.tsx](../../bob/app/bob/bob.tsx)) is the widget builder container and **temporary owner of instanceData** during editing.

### The Data Flow

```
1. User opens widget instance
2. Bob loads published instanceData from Paris (ONE API call)
3. Bob stores instanceData in React state → this is the working copy
4. User edits in ToolDrawer → instanceData changes
5. Bob updates its state
6. Bob sends updated instanceData to preview iframe via postMessage
7. Preview updates in real-time
8. User clicks "Publish"
9. Bob sends instanceData to Paris (SECOND API call)
10. Done
```

### Key Architectural Decision

**instanceData only exists in 2 places:**

1. **Paris** - Published version (production source of truth)
2. **Bob's React state** - Working copy (during editing)

**NOT in:**
- Database on every keystroke ❌
- ToolDrawer component state ❌
- Some intermediate cache ❌
- localStorage ❌

### Why This Matters

**No database pollution** - We don't save every keystroke to Paris. User edits in memory, publishes when ready.

**No complex sync logic** - Bob is the single source of truth during editing. No conflicts, no race conditions, no syncing nightmares.

**Scales effortlessly** - 1 user or 10,000 users, doesn't matter. Editing happens client-side in memory.

## How Widget JSON Works

Each widget type provides a JSON file that contains:

1. **HTML** - Dieter markup for controls
2. **Data binding** - How controls map to instanceData paths
3. **Helper functions** - JavaScript for complex operations (add/delete/reorder)

### Example Structure

```json
{
  "controls": {
    "content": "<div class='diet-input' data-size='lg'>
                  <label>Widget Title</label>
                  <input data-path='title' />
                </div>",
    "scripts": {
      "addQuestion": "function(categoryIndex) { ... }",
      "deleteQuestion": "function(categoryIndex, qIndex) { ... }"
    }
  }
}
```

### The Contract

Every control does **ONE thing**: Edit the instanceData that Bob holds in state.

- Textfield changes `instanceData.title`
- Toggle changes `instanceData.showTitle`
- Button adds item to `instanceData.categories[0].items`
- Delete button removes `instanceData.categories[1]`

Bob provides a simple API: `updateInstanceData(path, value)`

Widget controls call this function. Bob handles the rest (state update, preview sync, everything).

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

FAQ widget loads:
- `diet-expander-faq.css`
- `diet-button.css`
- `diet-textfield.css`

Countdown widget loads:
- `diet-expander-countdown.css`
- `diet-color-picker.css`
- `diet-dropdown.css`

Newsletter widget loads:
- Whatever IT needs

**Result**: Dieter can have 10 components or 1,000 components—doesn't matter. Each widget stays lean because it only loads what it uses.

No bloat. No performance penalty. Infinite scalability.

## Why This Architecture Enables the Moats

This architecture is foundational to Clickeen's competitive advantages, especially AI-Native design:

### 1. Simple to Build
Engineers write HTML/CSS (skills they already have), put it in widget JSON, done. No React expertise required.

### 2. Simple to Use
"Need to build a new widget? Go to Dieter, find something similar, copy the HTML, customize it."

One place to look. One pattern to follow. Hard to mess up.

### 3. Scales to Hundreds of Widgets
Each widget is self-contained software (JSON with HTML/CSS). No shared state. No dependencies. Just add more widgets.

### 4. Operational Efficiency
All editing happens client-side in memory. No database hits until publish. No server load from editing sessions. This is good engineering practice, not a competitive advantage.

### 5. Easy to Maintain
- Update a Dieter component → all widgets using it get the update
- Fix a bug in Bob → all widgets benefit
- Add a new widget → doesn't affect existing ones

### 6. Enables AI-First Future
Want to add AI editing mode? Bob handles it, all widgets get it for free.
Want to add AI-powered suggestions? Bob handles it, all widgets get it for free.
Want to add AI-generated templates? Bob handles it, all widgets get it for free.

**The key insight:** This widget-agnostic architecture is what makes AI-Native design possible. By treating all widgets as structured data (JSON with schemas), AI can understand, modify, and generate new widgets without touching specific code. This is the moat—not the architecture itself, but the AI legibility it enables.

The generic 50% (Bob) keeps getting better with AI. The widget-specific 50% (JSON) stays simple and AI-understandable.

## The Complete Picture

```
Bob (Generic Editor - 50%)
├── Loads instanceData from Paris
├── Holds instanceData in React state
├── Renders ToolDrawer with controls from widget JSON
├── Provides updateInstanceData(path, value) API
├── Syncs to preview iframe via postMessage
└── Publishes to Paris on user click

Widget JSON (Widget-Specific - 50%)
├── HTML for controls (using Dieter components)
├── Data binding (data-path attributes)
├── Helper functions (add/delete/reorder)
└── Validation and defaults

Dieter (Mama Library)
├── Primitive components (button, toggle, input)
├── Composed components (expander-faq, card-testimonials)
└── Each widget loads only what it needs
```

## Standard Widget Patterns

### Typography Menu (REQUIRED for All Widgets)

Every widget MUST include a "Typography" menu item in ToolDrawer that allows users to customize fonts.

**User Capabilities:**
- Select from 10 pre-loaded Google Fonts (same 10 across all widgets)
- Paste custom Google Fonts embed code for any font they want

**Widget JSON Structure:**
```json
{
  "typography": {
    "defaultFont": "Inter Tight",
    "availableFonts": [
      {
        "name": "Inter Tight",
        "googleFontsUrl": "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;600&display=swap"
      },
      {
        "name": "Roboto",
        "googleFontsUrl": "https://fonts.googleapis.com/css2?family=Roboto:wght@400;600&display=swap"
      }
      // ... 8 more fonts (10 total, same across all widgets)
    ]
  }
}
```

**instanceData Storage:**
```json
{
  "typography": {
    "selectedFont": "Roboto",  // Name from availableFonts
    "customFontUrl": null      // or Google Fonts URL if user pasted custom
  }
}
```

**Venice Rendering:**
- Load the selected Google Font in widget's `<head>` via `<link>` tag
- Apply font to widget via CSS variable or direct font-family
- If customFontUrl is set, use that instead of availableFonts lookup

**Performance:** Don't worry about loading 10 fonts - performance is acceptable.

### Image Uploads (Logo Showcase, Testimonials, etc.)

**MiniBob (unauthenticated users on landing pages):**
- Images converted to **base64 data URLs** client-side
- Stored in instanceData as data URLs (in memory only)
- Preview works immediately with uploaded images
- **Lost on page refresh** (encourages signup to save permanently)
- Zero server storage cost, zero abuse risk, zero database pollution

**Authenticated Bob (signed-in users):**
- Images uploaded to **Denver** (permanent asset storage)
- instanceData stores Denver CDN URLs (not data URLs)
- Images persist across sessions
- Can publish widget with permanent image URLs

**Implementation Pattern:**
```javascript
// MiniBob: Convert upload to data URL
function handleImageUpload(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result; // "data:image/png;base64,..."
    updateInstanceData('logos.0.imageUrl', dataUrl);
  };
  reader.readAsDataURL(file);
}

// Authenticated Bob: Upload to Denver, store URL
async function handleImageUpload(file) {
  const url = await uploadToDenver(file); // Returns CDN URL
  updateInstanceData('logos.0.imageUrl', url);
}
```

**Why This Works:**
- Landing page visitors can play with real images without server cost
- Natural conversion: "Sign up to save your logos permanently"
- Matches competitor UX (e.g., Elfsight) without the storage costs
- Simple detection: `imageUrl.startsWith('data:')` = temporary upload

**ToolDrawer HTML Pattern:**
```html
<section class="toolpanel" data-panel="typography">
  <h3>Typography</h3>

  <!-- Font selector dropdown (10 pre-loaded fonts) -->
  <div class="diet-dropdown">
    <button class="diet-btn diet-btn--block diet-btn--split" data-path="typography.selectedFont">
      <span class="diet-btn__label">Inter Tight</span>
      <span class="diet-btn__icon">↓</span>
    </button>
    <div class="diet-dropdown__surface">
      <!-- Options for all 10 fonts -->
    </div>
  </div>

  <!-- Custom font URL input -->
  <div class="diet-input">
    <label>Custom Google Font URL</label>
    <input type="text" data-path="typography.customFontUrl" placeholder="Paste Google Fonts embed URL" />
  </div>
</section>
```

## For Engineers: How to Build a Widget

1. **Go to Dieter** - Find components similar to what you need
2. **Copy the HTML** - Get the markup for controls
3. **Customize if needed** - Create a widget-specific composition (e.g., `diet-expander-newwidget`)
4. **Put HTML in widget JSON** - Add it to your widget's JSON file
5. **Add data binding** - Use `data-path` attributes to map controls to instanceData
6. **Add helper functions** - If you need add/delete/reorder, write small JS functions
7. **Add Typography menu** - Include the standard 10 Google Fonts + custom font input (REQUIRED)
8. **Done** - Bob handles the rest

One pattern. One place. Simple.

## Implementation Benefits

This architecture provides excellent development experience:

- **Fast development** - Build widgets in hours, not days (internal efficiency)
- **No bike-shedding** - Clear patterns, clear conventions (team velocity)
- **Hard to mess up** - Architecture guides you to the right solution (code quality)
- **Scales forever** - 10 widgets or 1,000 widgets, same simplicity (maintainability)
- **Performance by default** - Only load what you use (good engineering practice)
- **Easy maintenance** - One place for UI, one place for logic (operational excellence)

We're building something elegant, simple, and scalable.

Like Dieter Rams would approve of.
