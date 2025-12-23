# Bob — Widget Builder Application

## 🔑 CRITICAL: New Architecture (Read This First!)

**Bob is the temporary owner of instance config during editing.** (In Bob code, this working copy is stored in React state as `instanceData`.)

This is a fundamental architectural change that enables massive scalability and eliminates database pollution.

### The Two-Place Rule

**config exists in EXACTLY 2 places:**

1. **Michael (database)** - Published version (production source of truth; accessed via Paris)
2. **Bob's React state** - Working copy (during editing session)

**NOT in:**
- Database on every keystroke ❌
- Database on every field change ❌
- localStorage ❌
- ToolDrawer state ❌
- Some intermediate cache ❌

### The Two-API-Call Pattern (Target)

Bob makes EXACTLY 2 calls to Paris per editing session:

1. **Load** - `GET /api/instance/:publicId` → gets published config
2. **Publish** - `PUT /api/instance/:publicId` → saves working copy

**Between load and publish:**
- User edits in ToolDrawer → Bob updates React state
- Bob sends updated config to preview via postMessage
- Preview updates in real-time
- ZERO API calls to Paris
- ZERO database writes

**AI NOTE — This Workspace Snapshot (DevStudio harness)**
- DevStudio fetches the instance snapshot (via Bob’s `/api/paris/*` proxy to Paris) and posts `{ compiled, instanceData }` into Bob via `postMessage` (`devstudio:load-instance`).
- Bob’s live preview is a sandboxed iframe loading widget HTML from Denver; Bob streams config updates via `postMessage` (`ck:state-update`) which are applied by `denver/widgets/{widget}/widget.client.js`.
- The **Venice service** (`venice/` → `c-keen-embed`) is **embed-only** in this architecture; it is **not** called from Bob for previews and is **not** part of the edit loop.

### Operational Benefits

**Scalability:**
- 1 user or 10,000 users editing simultaneously → no server load difference
- All editing happens client-side in memory (good engineering practice)
- No server load from editing sessions (operational efficiency)
- Only published widgets hit the database (table stakes for modern editors)

**Database Efficiency:**
- Old model: Every visitor to clickeen.com playing with widgets → database instance created
- New model: Only users who click Publish → database instance created
- Landing page with 100 widgets + millions of visitors → ZERO database pollution (clean data)
- Operational benefit: Lower infrastructure costs, cleaner data

**Data Quality:**
- Database only contains published widgets users actually care about (operational cleanliness)
- No abandoned experiments
- No half-edited drafts
- Clean, maintainable data

**Why this is good engineering, not moat:** Any competent online editor (Google Docs, Figma, etc.) works this way. Storing intermediate edits would be wasteful. This is table stakes for modern products.

### Widget Definition Architecture

**Widget Definition (a.k.a. “Widget JSON”) = 50% of the software**

Each widget type provides a widget definition folder in Denver/CDN that contains:
1. `spec.json` — defaults + ToolDrawer spec (`html[]` with `<bob-panel>` + `<tooldrawer-field>`) compiled by Bob into `panels[]` (and optional `controls[]` for safe AI ops; FAQ-only in this repo snapshot)
2. `widget.html` / `widget.css` / `widget.client.js` — runtime assets loaded in a sandboxed preview iframe
3. (Optional) `agent.md` — AI-facing contract for safe edits (used when AI editing is enabled)

**Bob = the other 50% of the software**

Bob provides:
- Container and layout (ToolDrawer, Workspace, TopDrawer)
- `instanceData` state management (React state + updates)
- Data binding layer (`data-bob-path`, `data-bob-showif`)
- Preview sync (postMessage to iframe)
- Save to Paris (on publish only)

Together, **Bob + Widget Definition = complete widget instance editor**.

### Dieter Strategy

**Dieter is the mama of all HTML/CSS.**

Dieter contains:
- **Primitives** - button.css, toggle.css, textfield.css, expander.css
- **Widget-specific compositions** - expander-faq.css, card-testimonials.css, timer-countdown.css
- **Bob-specific** - bob-basetooldrawer.css

**Code splitting (standard practice):** We never load all of Dieter. Each widget only loads the CSS/JS for components it actually uses. This is fundamental good engineering, not a competitive advantage.

FAQ widget loads:
- `diet-expander-faq.css`
- `diet-button.css`
- `diet-textfield.css`

Countdown widget loads:
- `diet-expander-countdown.css`
- `diet-color-picker.css`
- `diet-dropdown.css`

**Result:** Dieter can have 10 components or 1,000 components—doesn't matter. Each widget stays efficient because it only loads what it uses. This allows Dieter to scale without slowing down individual widgets (operational benefit of good architecture).

For complete architecture details, see [WidgetArchitecture.md](../widgets/WidgetArchitecture.md).

---

## Runtime & AI Contracts (Bob ↔ Widget Definition)

Bob interacts with widget definitions via explicit, stable contracts (not ad-hoc parsing or “click the UI” instructions).

### 1) Preview Messaging Contract (Bob → widget.client.js)

Bob streams the working config to the widget preview iframe via `postMessage`:

- `type`: `ck:state-update`
- `widgetname`: widget type (e.g. `"faq"`)
- `state`: working config object (Bob code calls this `instanceData`)
- `device` / `theme`: preview hints

Widget runtimes MUST:
- Resolve the widget root (e.g. via `data-ck-widget="..."`) and query within it (root-scoped; avoid global selectors for internals).
- Listen for `ck:state-update` and call `applyState(state)` to mutate DOM in-place.
- Treat `window.CK_WIDGET.state` as optional (Venice may set it for SSR-first paint; Bob preview may not).

### 2) Compiled `controls[]` + Ops Contract (Bob ↔ AI/automation)

To make AI editing safe and deterministic, Bob uses:
- `compiled.controls[]`: a machine-readable allowlist of editable paths (FAQ-only in this repo snapshot).
- Ops protocol: `{ op, path, ... }` (set/unset/insert/remove/move) applied preview-first to in-memory `instanceData`.
- Fail-closed validation: ops are rejected unless they match `controls[]` and satisfy type/enum rules; Undo is supported.

Per-widget AI guidance lives in `denver/widgets/{widget}/agent.md` (AI-only contract; not used by runtime).

### DevStudio Bootstrap (Repo Snapshot)

DevStudio loads an instance and posts it into Bob:
- `type`: `devstudio:load-instance`
- payload: `{ compiled, instanceData }`

Bob does not create instances in this harness; it edits the provided working copy and streams preview updates.

---

## Tool Drawer Architecture (ToolDrawer)

ToolDrawer renders the HTML that each widget provides. There is no schema or control list inside Bob.

**Current flow (canonical):**
- The widget spec (`denver/widgets/{widget}/spec.json`) defines panels using a small markup DSL (e.g., `<bob-panel>` blocks and `<tooldrawer-field>` macros).
- `compileWidget` expands `<tooldrawer-field>` into Dieter component markup, detects which Dieter assets are needed, builds Denver asset URLs, and (optionally) emits `controls[]` for fail-closed ops/AI editing.
- At runtime, ToolDrawer injects the active panel’s compiled HTML, loads the required Dieter CSS/JS, runs Dieter hydrators, and binds values via `data-bob-path` + `data-bob-showif` using `setValue` (with defaults fallback).
- No widget-specific logic or hardcoded control lists live in Bob. Adding/changing controls = edit the widget spec; Bob just renders and binds.

**Why:** Single Bob for 100+ widgets; widget JSON is the software; Bob is the shell (state, layout, bindings, publish). Controls, structure, and behavior come from the widget + Dieter assets, not from Bob code.

---

## What is Bob?

Bob is Clickeen's **widget builder** for registered users. It's where customers configure, preview, and publish their widgets.

**Simple version:** Bob is a web app where users customize widgets and see them update live before embedding them on their site.

### 🔒 CRITICAL: Widget Definition vs Widget Instance

**Bob edits instances (config), NOT widget definitions.** (Bob’s working copy is stored as `instanceData` in React state.)

**Widget Definition (a.k.a. “Widget JSON”) = THE SOFTWARE** (Denver/CDN):
- Complete functional software for a widget type
- In-repo source: `denver/widgets/{widgetType}/spec.json` + `widget.html`, `widget.css`, `widget.client.js`, `agent.md`
- **NOT EDITABLE by users**
- Shared by all instances of that type

**Widget Instance = THE DATA** (database row):
- User’s specific widget with custom `config`
- Lives in Michael (Supabase/Postgres): `widget_instances.config` + `widgets.type`
- **EDITABLE by users in Bob**
- Contains: `publicId`, `widgetType` (string like `"faq"`), `config` (user’s actual values)
- Millions of instances share the same `widgetType` but have different `config`

**When user edits in Bob:**
- DevStudio/Bob loads the widget definition from Denver (compiled for the editor via Bob `GET /api/widgets/[widgetname]/compiled`)
- DevStudio/Bob loads the instance snapshot via Paris `GET /api/instance/:publicId`
- User edits → updates config only (in React state)
- Widget definition remains unchanged
- Publish (planned) saves config via Paris `PUT /api/instance/:publicId`

**The separation:**
- Widget definition = THE SOFTWARE (platform-controlled; Denver/CDN)
- Instance `config` = THE DATA (user-controlled; Michael via Paris)
- Bob provides the UI to edit user data within platform rules

---

## Where does Bob live?

- **Route:** `/bob`
- **Codebase:** `bob/` directory (Next.js App Router)
- **Entry point:** `bob/app/bob/page.tsx`
- **Deployed to:** Vercel project `c-keen-app`

---

## Key Architectural Rules

**Single Working Surface:**
- Bob combines configuration and preview in ONE interface
- NO separate library/gallery screen for browsing widgets
- NO widget dashboard or list view
- User goes directly from authentication → widget configuration → preview → publish
- Focus: building/editing ONE widget at a time

**UI Layout (locked):**
- TopDrawer: Widget name + action buttons (push-down layout)
- ToolDrawer (left sidebar): Configuration controls
- Workspace (center): Live preview iframes
- SecondaryDrawer (right, Phase-1 OFF by default): Reserved for future features

---

## Bob vs MiniBob

**Status (this repo snapshot):** MiniBob/Prague gallery flows are not implemented. Bob is bootstrapped by DevStudio `postMessage` and does not currently read `publicId`/`minibob` query params.

**MiniBob:**
- Bob embedded in Prague (marketing site) via iframe with `?minibob=true` query param
- Anonymous users (no login required)
- Bob conditionally hides UI elements when `minibob=true`:
  - NO Save button
  - NO SecondaryDrawer
  - Only "Publish" button visible
- Goal: Get people to sign up

**Bob (authenticated):**
- Accessed at `c-keen-app/bob` without `minibob` param
- Registered users only (requires login)
- Full UI:
  - "Copy Code" button always visible
  - "Save" button appears when dirty
  - SecondaryDrawer available (Phase-1: off by default)
- Goal: Convert free users to paid, retain customers

**User flow:**
1. Browse gallery on clickeen.com (Prague)
2. Click widget card → Prague creates draft instance with default template
3. Prague opens MiniBob with `?publicId=wgt_xxx`
4. Edit config and/or switch templates in MiniBob
5. Click "Publish" → Sign up
6. Redirected to authenticated Bob with widget claimed to workspace

**Technical implementation:**
- Single codebase (`bob/`)
- Detects `?minibob=true` query param
- Conditionally renders UI based on `isMiniBob` context
- NO separate MiniBob deployment

---

## What does Bob do?

Bob provides a single workspace where users can:

1. **Edit widget config** — Modify content, colors, settings (widget type chosen upstream)
2. **Switch templates** — Change widget layout/style without losing config (planned)
3. **Preview live** — See real-time preview as they edit (same HTML that will appear on their site)
4. **Publish & get code** — Publish widget (save via Paris) and copy embed snippet (planned)

**CRITICAL:** Bob does NOT have widget selection. User picks widget on marketing site, Prague creates an instance with a widget type, then opens Bob with that instance loaded.

**NEW ARCHITECTURE:** Bob holds config in React state during editing. All edits happen in memory. Only when user clicks "Publish" does Bob save via Paris (persisted in Michael). No auto-save. No intermediate database writes. See "New Architecture" section above for details.

---

## How do users interact with Bob?

Users work in **one screen** with three areas:

```
┌─────────────────────────────────────────────────────┐
│  TopDrawer: Widget name + Publish button            │
├──────────┬──────────────────────────┬───────────────┤
│          │                          │               │
│ Tool     │   Workspace              │  Secondary    │
│ Drawer   │   (Live Preview)         │  Drawer       │
│ (Left)   │   [iframe showing        │  (Right)      │
│          │    widget]               │               │
│ Edit     │                          │  Future:      │
│ controls │   Theme: Light/Dark      │  Assist       │
│ go here  │   Device: Desktop/Mobile │               │
│          │                          │               │
└──────────┴──────────────────────────┴───────────────┘
```

**Left (ToolDrawer):** Configuration controls — forms, options, settings
**Center (Workspace):** Live preview iframe showing widget as it will appear on their site
**Right (SecondaryDrawer):** Reserved for future AI assist features (currently off)

---

## Key UX Features

### 1. Live Preview with World-Class UX
- Center of the screen, always visible
- Shows the **real widget runtime** (Denver `widget.html` + `widget.client.js`) in a sandboxed iframe
- **Instant feedback**: Bob streams `instanceData` via `postMessage` (no iframe reload on each change)
- Shows exactly what will appear on their website
- Prefer tokenized widgets (CSS vars) for patchable fields, but DOM rebuilds are allowed where appropriate (e.g., lists)

### 2. Publish UX Model (NEW ARCHITECTURE)

**MiniBob (on clickeen.com website):**
- NO Save button
- Only "Publish" button → triggers signup flow → widget saved to account
- Anonymous editing with all instanceData in memory (no database writes)

**In-App Bob (authenticated users):**
- "Copy Code" button always visible
- "Publish" button always visible
- Clicking Publish:
  1. Sends PUT to Paris with instanceData from Bob's React state
  2. Saves to database (first database write of the session)
  3. Triggers preview iframe refresh to show published state
  4. User can copy embed code
- NO auto-save, NO intermediate saves (explicit user action only)
- NO "Save" button (only "Publish")
- NO dirty detection needed (all edits stay in memory until publish)

**Why No Save Button:**
- Bob owns instanceData in React state during editing
- All edits happen in memory (instant, no network latency)
- Preview updates via postMessage (instant feedback)
- Only "Publish" writes to database
- Simpler UX: Edit → Publish → Done (no intermediate save step)

### 3. Widget Naming
- Top left: Editable widget name
- Click to rename inline (uses Dieter `textrename` component)
- Enter to save, Escape to cancel

### 4. Theme & Device Toggles
- Center top: Switch between Desktop/Mobile view
- Right top: Switch between Light/Dark theme
- Changes are instant (postMessage patches in preview iframe)

### 5. Assist Mode (Manual + Copilot)
- Left drawer header: Toggle between "Manual" and "Copilot"
- **Manual mode**: User edits `instanceData` via ToolDrawer controls; FAQ answers include “Generate with AI” (returns ops, applied preview-first, Undo supported)
- **Copilot mode (this repo snapshot)**: Ops Sandbox for pasting ops JSON and applying/undoing (chat Copilot is Milestone 5)
- **AI is always fail-closed**: AI returns structured ops; Bob validates against compiled `controls[]` before applying

---

## Technical Architecture

### How Bob Works (NEW ARCHITECTURE)

```
Bob loads widget instance
    ↓
Bob calls Paris GET /api/instance/:publicId (API CALL #1 - Load)
    ↓
Bob stores instanceData in React state (working copy)
    ↓
User edits in ToolDrawer
    ↓
Bob updates instanceData in React state (NO API call)
    ↓
Bob sends updated instanceData to preview via postMessage
    ↓
Preview iframe updates in real-time (NO reload)
    ↓
User continues editing (all in memory, instant feedback)
    ↓
User clicks "Publish"
    ↓
Bob calls Paris PUT /api/instance/:publicId (API CALL #2 - Publish)
    ↓
instanceData saved to database
    ↓
Preview iframe refreshes to show published state
    ↓
Done (exactly 2 API calls total)
```

**Key Points:**
- ONLY 2 API calls to Paris per session (load and publish)
- All editing happens in Bob's React state (in memory)
- Preview updates via postMessage (instant, no reload)
- No intermediate database writes
- No auto-save, no dirty detection

### Dependencies

**Paris (API gateway to Michael):**
- `GET /api/instance/:publicId` returns the instance snapshot (`widgetType`, `config`, branding, etc.)
- `PUT /api/instance/:publicId` persists `config` (publish/save wiring is planned in Bob UI)
- Bob never touches the database directly; persistence goes through Paris

**Denver (CDN):**
- Source of widget definitions/assets (`denver/widgets/{widget}/…`)
- Bob’s preview iframe loads widget HTML from `compiled.assets.htmlUrl` (a Denver URL)
- Bob’s compile API reads `denver/widgets/{widget}/spec.json` and expands Dieter markup

**Venice (Embed runtime):**
- Not part of the edit loop; embed-only front door for third-party pages

**Dieter (Design System):**
- Bob UI uses Dieter components (buttons, toggles, etc.)
- Dieter CSS/tokens for consistent styling
- Icons from Dieter registry

---

## File Structure

```
bob/
├── app/
│   ├── bob/
│   │   └── page.tsx          # Bob route
│   ├── layout.tsx            # App layout
│   ├── page.tsx              # Root page
│   └── api/
│       ├── widgets/[widgetname]/compiled/route.ts  # Compiles Denver widget spec for editor UI
│       └── paris/            # DevStudio-friendly proxy to Paris API
├── lib/
│   ├── icons.ts              # Dieter icon helper
│   ├── compiler.server.ts    # Expands widget specs using Dieter assets
│   └── session/              # Editing session state + postMessage bootstrap
├── public/
│   └── dieter/               # Dieter assets (synced from dieter/)
└── package.json
```

---

## Layout Structure (CSS)

Bob layout uses CSS Grid with these classes:

### Root Container
- `.root` — Main grid: top bar + body

### TopDrawer (Top Bar)
- `.topdrawer` — Top bar container
- `.topbar` — Horizontal layout: left + right
- `.topdmain` — Left area (widget name)
- `.topdright` — Right area (Publish button)

### Body Grid (Three Columns)
- `.grid` — Three-column grid: 280px | fluid | 280px

**Left Column (ToolDrawer):**
- `.tooldrawer` — Left drawer container
- `.tdheader` — Sticky header (Assist toggle)
- `.tdcontent` — Scrollable content

**Center Column (Workspace):**
- `.workspace` — Center container
- `.wsheader` — Sticky header (Theme/Device toggles)
- `.wsheaderRow` — Three-part header: left | center | right
- `.widget_preview` — Iframe container

**Right Column (SecondaryDrawer):**
- `.secondarydrawer` — Right drawer container
- `.sdheader` — Sticky header
- `.sdcontent` — Scrollable content

---

## Preview Iframe Integration

### Preview UX (Phase-1)

**Current preview implementation (this repo snapshot):**
- Bob’s preview is a sandboxed iframe that loads widget HTML from Denver (via `compiled.assets.htmlUrl`).
- Bob streams config updates via `postMessage` (`ck:state-update`); the widget runtime (`widget.client.js`) applies changes in-place.
- Venice is not used for editing previews, and there is no Bob `/api/preview/*` proxy in this codebase.

**Tokenization (recommended, not required):**
- Prefer CSS variables for patchable style fields so `applyState` can update styles without expensive DOM rebuilds.
- Example: `border-radius: var(--btn-radius, 12px)` rather than baking values into many selectors.

---

## Paris API Integration

Paris is the persistence API for instance `config` (stored in Michael). Paris does not host widget definitions.

**Current repo snapshot (DevStudio harness):**
- DevStudio fetches instances via Bob proxy `GET /api/paris/instances` and posts `{ compiled, instanceData }` into Bob via `postMessage` (`devstudio:load-instance`).
- Bob’s Publish button is present but not wired to a Paris `PUT` yet.

**Planned (Bob UI wiring):**
- Load: `GET /api/paris/instance/:publicId` (→ Paris `GET /api/instance/:publicId`)
- Publish: `PUT /api/paris/instance/:publicId` with `{ config }` (→ Paris `PUT /api/instance/:publicId`)

**Not available in this repo snapshot:**
- `/api/instance/from-template`, `/api/templates` (not implemented)
- Instance creation in Paris is disabled (`POST /api/instance` returns 422)

## Environment Configuration

### Required Variables
- `NEXT_PUBLIC_DENVER_URL` — Denver base URL (required; used to load Dieter + widget preview assets)
  - Dev: `http://localhost:4000`
- `PARIS_BASE_URL` — Paris API base URL for Bob’s server-side proxy (`/api/paris/*`)
  - Dev: `http://localhost:3001`
  - Fallback: `NEXT_PUBLIC_PARIS_URL`
- `PARIS_DEV_JWT` — Optional server-side dev JWT (for Bob’s Paris proxy); if set, Bob injects `Authorization: Bearer …` when forwarding.

### Optional Variables (AI Assist)
- `OPENAI_API_KEY` — Enables FAQ “Generate with AI” (server-side in Bob)
- `OPENAI_MODEL` — Defaults to `gpt-4o-mini`
- `OPENAI_BASE_URL` — Defaults to `https://api.openai.com/v1`
- `AI_RATE_LIMIT_WINDOW_MS` / `AI_RATE_LIMIT_MAX` — In-memory rate limiting for AI endpoints (dev guardrail)

### Feature Flags
- `enableSecondaryDrawer` — Toggle right drawer (default: `false`)

**Note:** Do not create alternate variable names. Stick to these exact names to avoid config drift.

---

## Dev Setup (This Repo Snapshot)

### Quick Start (Local Dev)

Use the repo’s dev-up helper:

```bash
./scripts/dev-up.sh
```

Then open:
- DevStudio widget workspace: `http://localhost:5173/src/html/tools/dev-widget-workspace.html`
- Bob (standalone, will be blank until bootstrapped): `http://localhost:3000/bob`

### Common Issues
- Bob crashes on startup: set `NEXT_PUBLIC_DENVER_URL` (Bob requires it to load Dieter assets).
- DevStudio says “Supabase returned zero instances”: seed at least one `widgets` + `widget_instances` row in Michael (see `supabase/migrations/` for schema).
- DevStudio can't reach Paris: check `PARIS_BASE_URL` and `curl http://localhost:3001/api/healthz`.

## Using Dieter Components in Bob

Bob's tool drawer uses Dieter design system components for all controls. Follow these patterns:

### Button Usage

**Trigger buttons** (primary actions):
```tsx
<button
  className="diet-btn diet-btn--block diet-btn--split"
  data-variant="primary"
  data-size="md"
>
  <span className="diet-btn__label">Label</span>
  <span className="diet-btn__icon" aria-hidden="true">
    {/* SVG icon */}
  </span>
</button>
```

**Action buttons** (secondary):
```tsx
<button className="diet-btn" data-variant="neutral" data-size="md">
  <span className="diet-btn__label">Label</span>
</button>
```

### Dropdown Component

**Pure Dieter dropdown pattern:**
```tsx
<div>
  {/* Simple label outside dropdown */}
  <label style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.02em', opacity: 0.72, marginBottom: 8, display: 'block' }}>
    Label
  </label>

  {/* Dropdown container */}
  <div className="diet-dropdown" data-state={isOpen ? 'open' : 'closed'} data-demo="dropdown">
    {/* Trigger button */}
    <button
      type="button"
      className="diet-btn diet-btn--block diet-btn--split"
      data-size="md"
      data-variant="primary"
      data-dropdown-trigger
      aria-haspopup="menu"
      aria-expanded={isOpen}
      onClick={() => setIsOpen(!isOpen)}
    >
      <span className="diet-btn__label">Selected Value</span>
      <span className="diet-btn__icon" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>

    {/* Dropdown surface with options */}
    <div className="diet-dropdown__surface" role="menu" data-dropdown-surface>
      <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
        <button
          type="button"
          className="diet-btn"
          data-size="md"
          data-variant="neutral"
          style={{ justifyContent: 'flex-start' }}
          onClick={() => {
            // Handle selection
            setIsOpen(false);
          }}
        >
          <span className="diet-btn__label">Option 1</span>
        </button>
        <button
          type="button"
          className="diet-btn"
          data-size="md"
          data-variant="neutral"
          style={{ justifyContent: 'flex-start' }}
          onClick={() => {
            // Handle selection
            setIsOpen(false);
          }}
        >
          <span className="diet-btn__label">Option 2</span>
        </button>
      </div>
    </div>
  </div>
</div>
```

### Text Field Component

```tsx
<label className="diet-input" data-size="md">
  <span className="diet-input__label">Field Label</span>
  <div className="diet-input__inner">
    <input
      className="diet-input__field"
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Placeholder"
    />
  </div>
</label>
```

### Common Mistakes with Dieter Components

**❌ WRONG: Wrapping dropdown in text field**
```tsx
// DO NOT DO THIS - dropdowns are not text fields
<label className="diet-input">
  <span className="diet-input__label">Color</span>
  <div className="diet-input__inner">
    <div className="diet-dropdown">...</div>
  </div>
</label>
```

**✅ RIGHT: Dropdown standalone with simple label**
```tsx
<div>
  <label style={labelStyles}>Color</label>
  <div className="diet-dropdown">...</div>
</div>
```

**❌ WRONG: Mixing button variants in dropdown**
```tsx
// DO NOT conditionally style option buttons
<button className="diet-btn" data-variant={isSelected ? 'primary' : 'neutral'}>
```

**✅ RIGHT: All option buttons neutral**
```tsx
// Option buttons are always neutral - trigger shows current selection
<button className="diet-btn" data-variant="neutral">
```

**❌ WRONG: Missing button structure classes**
```tsx
// Missing diet-btn--block and diet-btn--split
<button className="diet-btn" data-variant="primary">
```

**✅ RIGHT: Full structure for split buttons**
```tsx
<button className="diet-btn diet-btn--block diet-btn--split" data-variant="primary">
```

### Required Dieter CSS Files

Bob's layout must include these stylesheets:

```tsx
// bob/app/layout.tsx
<head>
  <link rel="stylesheet" href="/dieter/tokens.css" />
  <link rel="stylesheet" href="/dieter/components/button.css" />
  <link rel="stylesheet" href="/dieter/components/dropdown.css" />
  <link rel="stylesheet" href="/dieter/components/segmented.css" />
  <link rel="stylesheet" href="/dieter/components/textfield.css" />
  <link rel="stylesheet" href="/dieter/components/textrename.css" />
</head>
```

**Note:** Always check `dieter/dieteradmin/src/html/dieter-showcase/*.html` for canonical component structure before implementing.

---

## Bob's Server-Side Paris Proxy

Bob uses a server-side proxy to call Paris API without exposing JWTs to the browser.

### Proxy Route

**Location:** `bob/app/api/paris/instance/[publicId]/route.ts`

**How it works:**
1. Client calls `/api/paris/instance/:publicId` (local Bob route)
2. Proxy forwards request to Paris at `NEXT_PUBLIC_PARIS_URL`
3. Proxy adds server-side `PARIS_DEV_JWT` for authentication (dev only)
4. Returns Paris response to client

**Client usage:**
```typescript
// ✅ Correct - uses proxy (relative path)
const res = await fetch(`/api/paris/instance/${publicId}`);

// ❌ Wrong - calls Paris directly (exposes JWT, causes CORS)
const res = await fetch(`http://localhost:3001/api/instance/${publicId}`);
```

### Paris Client Library

**Location:** `bob/lib/paris.ts`

**Key function:**
```typescript
async function parisFetch(path: string, init?: RequestInit) {
  // If path starts with /api/, use it as-is (proxy route)
  // Otherwise, prepend Paris base URL (for server-side calls)
  const url = path.startsWith('/api/')
    ? path
    : `${getParisBase()}${path}`;

  return fetch(url, { ...init, cache: 'no-store' });
}
```

**Pattern:**
- Paths starting with `/api/` → proxy route (client-side safe)
- Paths without `/api/` → direct Paris URL (server-side only)

### Authentication in Dev

**Environment variable:** `PARIS_DEV_JWT`

**Where to get it:**
```bash
# Generate JWT for test user
JWT=$(curl -s -X POST "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123456"}' \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# Save to file
echo $JWT > /tmp/jwt.txt

# Start Bob with JWT
cd bob
PARIS_DEV_JWT=$(cat /tmp/jwt.txt) PORT=3000 pnpm dev
```

**Why needed:** PUT/POST requests to Paris require authentication. The proxy adds this server-side so client doesn't need to handle JWTs.

### Common Proxy Issues

**Issue:** Tool drawer controls don't save (401 Unauthorized)

**Cause:** Bob proxy missing `PARIS_DEV_JWT` env var

**Fix:** Restart Bob with JWT:
```bash
PARIS_DEV_JWT=$(cat /tmp/jwt.txt) PORT=3000 pnpm dev
```

---

**Issue:** Saves fail with "Loading..." in tool drawer

**Cause:** `parisFetch()` calling Paris directly instead of using proxy

**Fix:** Ensure client-side calls use `/api/paris/instance/:publicId` path (starts with `/api/`)

---

## AI Assist / Copilot Architecture

Bob’s AI editing is built on the same contracts as Manual editing so it stays safe and scalable.

### Current (this repo snapshot)
- Compiler emits `controls[]` (FAQ-only) so machines know exactly what’s editable.
- Ops engine applies `{ op, path, ... }` to in-memory `instanceData`, validates fail-closed against `controls[]`, and supports Undo.
- Field-level AI: FAQ answers can be generated via a Bob API route that returns ops (preview-first; no persistence).
- Copilot pane is an “Ops Sandbox” for testing ops payloads (chat Copilot is Milestone 5).

### Planned (Milestone 5)
- Chat Copilot that sees `compiled.controls[]`, `denver/widgets/{widget}/agent.md`, and current `instanceData`.
- Copilot outputs ops; Bob validates/applies them via the same fail-closed engine.
- Publish remains an explicit user action; Copilot must not write to Paris directly.

---

## For AIs Reading This

**Key principles:**
1. Bob is a **builder app** for registered users (not the marketing playground)
2. Bob **never touches the database directly** — all data through Paris API
3. Preview iframe shows the **real widget runtime** from Denver (not mocks)
4. **Always check before creating** — never silently POST new widgets
5. **Always include `?ts=` param** on iframe refreshes
6. **Use pure Dieter component patterns** — don't wrap components in inappropriate containers
7. **Client calls use proxy routes** — never expose JWTs to browser

**When implementing Dieter components:**
- Check `dieter/dieteradmin/src/html/dieter-showcase/*.html` for canonical structure
- Don't nest components incorrectly (e.g., dropdown inside text field)
- Don't conditionally style option buttons - they're always neutral
- Include all required CSS classes (`diet-btn--block`, `diet-btn--split`, etc.)

**When confused:**
- Check actual code in `bob/app/bob/bob.tsx`
- Look at Paris API contracts in `documentation/systems/Paris.md`
- Look at Venice preview contracts in `documentation/systems/Venice.md`
- Look at Dieter showcase HTML for component patterns
