# Bob — Widget Builder Application

## Tool Drawer Architecture (ToolDrawer)

**How the drawer works:**
- Left side: **tdmenu** (48px wide) — vertical icon menu with LG-28 Dieter buttons
- Right side: **tdmenucontent** — control panels that change based on which icon is active
- Gap between columns: `var(--space-6)` (24px)

**Adding controls:**
- Each icon in tdmenu triggers a different control panel in tdmenucontent
- Panel structure: heading-3 title at top (e.g., "Content"), followed by form controls
- Controls go inside `.stack` div with `gap: '12px'` and `padding: 'var(--space-2)'`
- Use Dieter components at LG size: textfield (`data-size="lg"`), dropdown, buttons, etc.
- The heading text matches what the panel is for (e.g., "Content" for the pencil icon panel)

**Spacing locked in stone (bob.module.css):**
- `.tooldrawer` gap: `var(--space-1)` (4px) — between header and content
- `.tdcontent` gap: `var(--space-6)` (24px) — between icon menu and control panel
- `.tdmenu` padding: `var(--space-2)` (8px) — around icon buttons
- `.tdmenu` gap: `var(--space-2)` (8px) — between icon buttons
- `.tdmenucontent` padding-top: `var(--space-2)` (8px) — top padding
- Heading marginBottom: `var(--space-2)` (8px) — space below title

**Example pattern for new control panels:**
```tsx
{activeMenu === 'iconName' && widgetTypeState === 'widgetType' ? (
  <>
    <div className="heading-3" style={{...}}>Panel Name</div>
    <div className="stack" style={{ display: 'grid', gap: '12px', padding: 'var(--space-2)' }}>
      <div className="diet-input" data-size="lg">...</div>
      <div className="diet-dropdown">...</div>
    </div>
  </>
) : null}
```

---

## What is Bob?

Bob is Clickeen's **widget builder** for registered users. It's where customers configure, preview, and publish their widgets.

**Simple version:** Bob is a web app where users customize widgets and see them update live before embedding them on their site.

---

## Where does Bob live?

- **Route:** `/bob`
- **Codebase:** `bob/` directory (Next.js App Router)
- **Entry point:** `bob/app/bob/bob.tsx`
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

1. **Edit widget config** — Modify content, colors, settings (widget type already chosen before Bob opens)
2. **Switch templates** — Change widget layout/style without losing content
3. **Preview live** — See real-time preview as they edit (same HTML that will appear on their site)
4. **Save changes** — Persist config updates to Paris (authenticated Bob only, explicit action)
5. **Publish & get code** — Publish widget and copy embed snippet

**CRITICAL:** Bob does NOT have widget type selection. User picks widget type on marketing site, Prague creates instance, then opens Bob with that specific widget loaded.

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
- Shows **real widget** rendered by Venice (not a mockup)
- **Instant typing feedback**: postMessage patches update CSS variables while typing (no reload lag)
- **Smooth Save**: Cross-fade between iframe states (no white flash)
- Shows exactly what will appear on their website
- Preview system requires tokenized widgets (CSS variables for patchable fields)

### 2. Save UX Model

**MiniBob (on clickeen.com website):**
- NO Save button
- Only "Publish" button → triggers signup flow → widget saved to account
- Anonymous editing with draft tokens

**In-App Bob (authenticated users):**
- "Copy Code" button always visible
- "Save" button appears when dirty (local state ≠ server state)
- Clicking Save:
  1. Sends PUT to Paris with updated config
  2. Triggers cross-fade to new iframe state (no white flash)
  3. Hides Save button until next change
- NO auto-save, NO debouncing on Save (explicit user action only)
- NO "Saved" toast or notifications

**Dirty Detection:**
- Compare current control values vs last saved snapshot
- Dirty = any schema field differs from server state
- Save button visibility tied to dirty state

### 3. Widget Naming
- Top left: Editable widget name
- Click to rename inline (uses Dieter `textrename` component)
- Enter to save, Escape to cancel

### 4. Theme & Device Toggles
- Center top: Switch between Desktop/Mobile view
- Right top: Switch between Light/Dark theme
- Changes are instant (postMessage patches in preview iframe)

### 5. Assist Mode (AI Copilot)
- Left drawer header: Toggle between "Manual" and "AI Copilot"
- **Manual mode**: User configures via form controls (text fields, dropdowns, etc.)
- **AI Copilot mode**: User configures via natural language conversation
  - Agent reads widget config/schema from Paris
  - User types: "Make the button red" or "Change text to 'Click here'"
  - Agent maps intent to config changes and calls Paris PUT
  - Agent explains what changed
  - Uses same Paris API endpoints as manual controls
- **LLM Providers**:
  - Free tier: Uses DeepSeek (cost-effective)
  - Paid tier: Uses OpenAI or Anthropic (premium quality)
  - Provider configurable via environment variable

---

## Technical Architecture

### How Bob Works

```
User edits in Bob
    ↓
Bob calls Paris API (save config)
    ↓
Bob refreshes preview iframe
    ↓
Iframe loads Venice (GET /e/:publicId)
    ↓
Venice renders widget HTML (server-side)
    ↓
User sees live preview
```

### Dependencies

**Paris (API):**
- Bob talks to Paris to load/save widget configs
- All data operations go through Paris
- Bob never touches database directly

**Venice (Preview):**
- Bob embeds Venice in an iframe for preview
- Venice renders widgets server-side (SSR)
- Same HTML that will appear on customer's site

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
│   │   ├── bob.tsx           # Main Bob component
│   │   ├── bob.module.css    # Bob-specific styles
│   │   └── page.tsx          # Next.js page wrapper
│   ├── layout.tsx            # App layout
│   ├── page.tsx              # Root page
│   └── api/
│       └── healthz/          # Health check endpoint
├── lib/
│   ├── icons.ts              # Dieter icon helper
│   └── venice.ts             # Venice URL resolver
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

### World-Class Preview UX (Phase-1)

Bob implements a **double-buffered preview system** with instant typing feedback:

**Preview Architecture:**
- **A/B Double-Buffer**: Two iframes (A and B), load next state in hidden iframe, cross-fade swap on load
- **postMessage Patches**: Instant preview updates while typing via CSS variable updates (no reload)
- **Explicit Save**: No auto-save, user clicks Save to persist to Paris
- **Smooth Transitions**: Cross-fade between iframe states (no white flash)

**Tokenization Prerequisite:**
- Widgets MUST be tokenized (use CSS variables for patchable fields)
- Example: `border-radius: var(--btn-radius, 12px)` not `border-radius: 999px`
- postMessage patches update CSS variables directly in preview iframe
- See `documentation/widgets/testbutton.md` for tokenization reference

**Preview-Only Features:**
- Gated by `?preview=1` query param in Venice
- Venice injects patch script ONLY when preview=1
- Production embeds (`?preview=1` absent) never include preview features
- Draft tokens passed server-side via preview proxy (browser never sees them)

### Iframe URL Patterns

**Standard Preview (Save triggers reload):**
```
{veniceBase}/e/{publicId}?ts={timestamp}&theme={theme}&device={device}
```

**Preview with Patch Support (Phase-1+):**
```
/api/preview/e/{publicId}?preview=1&theme={theme}&device={device}
```

**Parameters:**
- `publicId` — Widget instance ID
- `ts` — Timestamp for cache busting (forces full reload)
- `preview=1` — Enables preview-only features (patch script, draft tokens)
- `theme` — `light` or `dark`
- `device` — `desktop` or `mobile`

### Preview Proxy Route

**Location:** `bob/app/api/preview/e/[publicId]/route.ts`

**Purpose:** Server-side proxy that injects draft tokens for preview

**Flow:**
1. Bob calls `/api/preview/e/:publicId?preview=1` (server route)
2. Proxy fetches from Venice with `preview=1` query param
3. Proxy injects `X-Draft-Token` header server-side (tokens never exposed to browser)
4. Venice receives header, loads draft config, injects patch script
5. Returns HTML with `Cache-Control: no-store`

**Why needed:** Draft tokens MUST stay server-side for security

### Venice Base URL
Resolved by `bob/lib/venice.ts` → `getVeniceBase()`:
- **Local dev:** `http://localhost:3002`
- **Production:** `https://c-keen-embed.vercel.app`

**Environment variable:** `NEXT_PUBLIC_VENICE_URL`

---

## Paris API Integration

### Endpoints Bob Uses

**Instance Management:**
- `GET /api/instance/:publicId` — Load widget config
- `PUT /api/instance/:publicId` — Save changes
- `POST /api/instance/from-template` — Create new widget

**Other:**
- `GET /api/entitlements` — Check plan limits (free vs paid)
- `GET /api/templates?widgetType=` — Get available templates
- `POST /api/claim` — Claim draft widget into account

### Canonical Save Flow (IMPORTANT)

Bob MUST follow this pattern when saving:

```typescript
// 1. Check if instance exists
const res = await fetch(`/api/instance/${publicId}`);

// 2. If exists, update it
if (res.status === 200) {
  await fetch(`/api/instance/${publicId}`, {
    method: 'PUT',
    body: JSON.stringify(changes)
  });
}

// 3. If doesn't exist, prompt user before creating
if (res.status === 404) {
  if (confirm("Create new widget?")) {
    await fetch('/api/instance/from-template', {
      method: 'POST',
      body: JSON.stringify(newWidget)
    });
  }
}
```

**Why?** Never silently create new widgets. Always check first, prompt user if creating new.

---

## Common Mistakes (for AIs)

### ❌ WRONG: Treating PUT as upsert
```typescript
// This creates widgets without user consent if they don't exist
await fetch(`/api/instance/${publicId}`, {
  method: 'PUT',
  body: JSON.stringify(config)
});
```

### ✅ RIGHT: Check first, prompt before create
```typescript
const existing = await fetch(`/api/instance/${publicId}`);
if (existing.ok) {
  // Update existing
  await fetch(`/api/instance/${publicId}`, { method: 'PUT', ... });
} else if (existing.status === 404) {
  // Prompt user before creating new
  if (userConfirmed) {
    await fetch('/api/instance/from-template', { method: 'POST', ... });
  }
}
```

### ❌ WRONG: Iframe without cache-bust
```typescript
// CDN will serve stale HTML
iframe.src = `/e/${publicId}`;
```

### ✅ RIGHT: Always include timestamp
```typescript
iframe.src = `/e/${publicId}?ts=${Date.now()}&theme=${theme}&device=${device}`;
```

---

## Error Handling

Bob must handle these error states from Venice/Paris:

| Error | What it means | What Bob should do |
|-------|---------------|-------------------|
| `TOKEN_INVALID` | Auth token is bad | Show warning, prompt re-login |
| `TOKEN_REVOKED` | Token was cancelled | Drop token, refresh preview |
| `NOT_FOUND` | Widget doesn't exist | Offer to create new one |
| `CONFIG_INVALID` | Bad configuration | Show field-level errors inline |
| `RATE_LIMITED` | Too many requests | Throttle UI, show retry message |
| `SSR_ERROR` | Venice render failed | Show fallback, offer retry |

---

## Environment Configuration

### Required Variables
- `NEXT_PUBLIC_VENICE_URL` — Venice base URL for preview iframe
  - Dev: `http://localhost:3002`
  - Prod: `https://c-keen-embed.vercel.app`
- `NEXT_PUBLIC_PARIS_URL` — Paris API base URL
  - Dev: `http://localhost:3001`
  - Prod: `https://c-keen-api.vercel.app`
- `PARIS_DEV_JWT` — Server-side dev JWT (for Bob's Paris proxy, dev only)
  - Optional in dev; if not set, proxy expects client to send Authorization header

### Feature Flags
- `enableSecondaryDrawer` — Toggle right drawer (default: `false`)

**Note:** Do not create alternate variable names. Stick to these exact names to avoid config drift.

---

## Dev Setup & Common Issues

### Quick Start (Local Dev)

**Prerequisites:**
1. Supabase local running on ports 54321 (API) / 54322 (DB)
2. Paris running on 3001
3. Venice running on 3002
4. Bob running on 3000

**Start Services:**
```bash
# Terminal 1 - Paris
cd paris
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU \
PORT=3001 pnpm dev

# Terminal 2 - Venice
cd venice
NEXT_PUBLIC_PARIS_URL=http://localhost:3001 \
PORT=3002 pnpm dev

# Terminal 3 - Bob
cd bob
NEXT_PUBLIC_VENICE_URL=http://localhost:3002 \
NEXT_PUBLIC_PARIS_URL=http://localhost:3001 \
PORT=3000 pnpm dev
```

**Open Bob:**
```
http://localhost:3000/bob?publicId=wgt_xxxxxx
```

**Important:** Replace `wgt_xxxxxx` with a real widget publicId from your database.

---

### Creating a Test Widget

Bob requires a valid widget instance to preview. Create one via Paris API:

```bash
# 1. Get a JWT token
JWT=$(curl -s -X POST "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123456"}' \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# 2. Create a test button widget
curl -X POST "http://localhost:3001/api/instance/from-template" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{
    "widgetType": "testbutton",
    "templateId": "testbutton-pill",
    "schemaVersion": "2025-09-01"
  }'

# Response will include publicId like wgt_xxxxxx
# Save that publicId and use it in Bob URL
```

**For published preview (no auth required):**
```bash
# 3. Publish the widget (so Venice doesn't require tokens)
PUBLIC_ID="wgt_xxxxxx"  # from step 2
curl -X PUT "http://localhost:3001/api/instance/$PUBLIC_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{"status":"published"}'
```

**Or via direct DB update (bypass validation):**
```bash
docker exec supabase_db_clickeen psql -U postgres \
  -c "UPDATE widget_instances SET status = 'published' WHERE public_id = 'wgt_xxxxxx';"
```

---

### Common Issues & Fixes

#### Issue 1: "Preview unavailable" message shown

**Symptoms:** Bob loads but shows gray placeholder with "Provide a valid publicId"

**Root causes:**
1. **No publicId in URL** - Bob defaults to "demo" which doesn't exist
2. **`force-static` in page.tsx** - searchParams not read at runtime
3. **publicId state not syncing** - URL param not passed to component

**Fix:**
1. Check URL has `?publicId=wgt_xxxxxx`
2. Verify `bob/app/bob/page.tsx` has `export const dynamic = 'force-dynamic';` (NOT `force-static`)
3. Verify page.tsx passes `searchParams.publicId` to `<Bob publicId={...} />`

**Code check:**
```typescript
// bob/app/bob/page.tsx - MUST be force-dynamic
export const dynamic = 'force-dynamic';  // ✅ Correct
// NOT: export const dynamic = 'force-static';  // ❌ Breaks query params
```

---

#### Issue 2: "Widget unavailable - AUTH_REQUIRED" (403 error)

**Symptoms:** Bob loads, shows widget ID in error, but Venice returns 403

**Root cause:** Widget is in `draft` status and Venice requires authentication token for draft widgets

**Fix:** Publish the widget (see "Creating a Test Widget" above, step 3)

**Why this happens:**
- Draft widgets require `X-Embed-Token` or `Authorization` header
- Iframe `src` cannot send custom headers
- For Phase-1, widgets must be published to preview in Bob

**Future fix:** Use loader path or server-side preview proxy to inject tokens

---

#### Issue 3: Port mismatch - Venice not found

**Symptoms:** Preview iframe shows "could not connect" or times out

**Root cause:** Venice running on wrong port (e.g., 3032 instead of 3002)

**Fix:**
```bash
# Check what port Venice is actually on
lsof -i :3002  # Should show node process
# If empty, check Venice logs for actual port

# Restart Venice on correct port
cd venice
PORT=3002 pnpm dev
```

**Why this happens:** Next.js auto-assigns ports if default is taken. Always explicitly set `PORT=3002` when starting Venice.

---

#### Issue 4: Bob's Paris proxy returns 404

**Symptoms:** Tool drawer edits don't save, console shows 404 from `/api/paris/instance/...`

**Root cause:** Bob's proxy route expects Paris at `NEXT_PUBLIC_PARIS_URL` or `http://localhost:3001`

**Fix:**
```bash
# Check Paris is running
curl http://localhost:3001/api/healthz
# Should return: {"ok":true}

# If not running, start Paris
cd paris
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU \
PORT=3001 pnpm dev
```

---

#### Issue 5: Schema validation error on Publish

**Symptoms:** Clicking Publish button shows error: "unknown schema version"

**Root cause:** Widget's schema doesn't exist in `widget_schemas` table (ALIGN-1 issue)

**Temporary fix:** Publish via direct DB update (see "Creating a Test Widget" above)

**Permanent fix (TODO):** Seed schemas in DB or add Geneva fallback to static catalog for `lab.*` types

---

### Debugging Checklist

When Bob isn't working, check in this order:

1. **Services running?**
   ```bash
   lsof -i :3001  # Paris
   lsof -i :3002  # Venice
   lsof -i :3000  # Bob
   ```

2. **Valid publicId?**
   ```bash
   # Check widget exists
   curl http://localhost:3001/api/instance/wgt_xxxxxx
   # Should return 200 with widget JSON
   ```

3. **Widget published?**
   ```bash
   # Check status in DB
   docker exec supabase_db_clickeen psql -U postgres \
     -c "SELECT public_id, status FROM widget_instances WHERE public_id = 'wgt_xxxxxx';"
   # Should show: published
   ```

4. **Venice renders widget?**
   ```bash
   curl -s http://localhost:3002/e/wgt_xxxxxx | head -20
   # Should return HTML with <title>
   ```

5. **Bob page dynamic?**
   ```bash
   grep "force-dynamic" bob/app/bob/page.tsx
   # Should return: export const dynamic = 'force-dynamic';
   ```

If all checks pass and Bob still doesn't work, check browser console for errors.

---

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

## AI Copilot Architecture

Bob's AI Copilot feature allows users to edit widgets via natural language instead of manual form controls.

### How It Works

**Agent context:**
- Widget config (GET from Paris `/api/instance/:publicId`)
- Widget schema (what fields are editable, types, enums)
- Current user's plan (free vs paid)

**User flow:**
1. User toggles to "AI Copilot" mode in tool drawer
2. If free tier: Show paywall ("Upgrade to use AI Copilot")
3. If paid tier: Chat interface appears in tool drawer
4. User types natural language: "Make the button red"
5. Agent maps intent to config change: `{ color: "red" }`
6. Agent calls Paris PUT `/api/paris/instance/:publicId` (via Bob proxy)
7. Agent responds: "Changed button color to red"
8. Preview iframe updates automatically (cache-bust timestamp)

### Implementation Notes

**Keep it simple:**
- Agent LLM provider varies by user plan (see below)
- Agent gets widget config/schema as system context
- Agent has tool to call Paris PUT with config changes
- Chat UI replaces form controls in tool drawer when AI Copilot mode active

**LLM Provider Strategy:**
- Free tier: DeepSeek (cost-effective, ~$0.14/1M tokens)
- Paid tier: OpenAI or Anthropic (premium quality)
- Provider selected based on user's plan from entitlements API
- All providers use same agent architecture/tools

**Don't overcomplicate:**
- No special APIs needed - uses same Paris endpoints as manual mode
- No complex prompt engineering - schema provides structure
- No streaming initially - simple request/response
- Same agent code works with all LLM providers

**Environment:**
- `DEEPSEEK_API_KEY` - Required for free tier AI Copilot
- `OPENAI_API_KEY` - Optional, for paid tier (alternative to Anthropic)
- `ANTHROPIC_API_KEY` - Optional, for paid tier (alternative to OpenAI)
- If no keys set, AI Copilot mode shows error: "AI Copilot not configured"

---

## For AIs Reading This

**Key principles:**
1. Bob is a **builder app** for registered users (not the marketing playground)
2. Bob **never touches the database directly** — all data through Paris API
3. Preview iframe shows **real Venice HTML** (not mocks)
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

