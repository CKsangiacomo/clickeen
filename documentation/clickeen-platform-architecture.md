# CLICKEEN Platform Architecture — Phase 1

This document describes system boundaries, data flows, and how the platform fits together.

**For definitions and glossary:** See `CONTEXT.md`
**For strategy and vision:** See `WhyClickeen.md`
**For system details:** See `systems/*.md`

**Authority order:** DB Schema (`supabase/migrations/`) > System PRDs > Widget PRDs > CONTEXT.md

---

## AI-First Company

Clickeen is designed to be **built by AI** and **run by AI**:

| Layer | Responsibility |
|-------|----------------|
| **Human (1)** | Vision, architecture, taste, strategic decisions |
| **AI Coding** | Build product from specs (Cursor, Claude, GPT) |
| **AI Agents (San Francisco)** | Run the company: sales, support, marketing, localization, ops |

**San Francisco is the Workforce OS** — the system that operates the AI agents who run the company.

See: `systems/sanfrancisco.md`

---

## System Map

All systems deploy to **Cloudflare** (except Michael which is Supabase):

| System | Repo Path | Deploy | Responsibility | Status |
|--------|-----------|--------|----------------|--------|
| **Prague** | `prague/` | Cloudflare Pages | Marketing site, gallery | Placeholder |
| **Bob** | `bob/` | Cloudflare Pages + Workers | Widget builder, compiler, ToolDrawer, preview | ✅ Active |
| **Venice** | `venice/` | Cloudflare Workers | SSR embed runtime, pixel, loader | ⚠️ Debug shell |
| **Paris** | `paris/` | Cloudflare Workers | HTTP API, instances, tokens, entitlements | ✅ Active |
| **San Francisco** | `sanfrancisco/` | Cloudflare Workers (D1/KV/R2/Queues) | AI Workforce OS: agents, learning, orchestration | 📋 Planning |
| **Michael** | `supabase/` | Supabase Postgres | Database with RLS | ✅ Active |
| **Dieter** | `dieter/` | (build artifact) | Design system: tokens, 16+ components | ✅ Active |
| **Tokyo** | `tokyo/` | Cloudflare R2 | Widget definitions, Dieter assets, shared runtime | ✅ Active |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           EDITING FLOW                                  │
│                                                                         │
│  ┌─────────┐    GET /api/instance/:publicId    ┌─────────┐             │
│  │   Bob   │ ◄──────────────────────────────── │  Paris  │             │
│  │ Builder │                                   │   API   │             │
│  └────┬────┘                                   └────┬────┘             │
│       │                                             │                   │
│       │ postMessage                                 │                   │
│       │ { type: 'ck:state-update', state }         │                   │
│       ▼                                             │                   │
│  ┌─────────┐                                        │                   │
│  │ Preview │ ◄── widget.client.js                  │                   │
│  │ iframe  │     from Tokyo                        │                   │
│  └─────────┘                                        │                   │
│       │                                             │                   │
│       │ User clicks Publish                         │                   │
│       │                                             ▼                   │
│       └──────────────────────────────────────► ┌─────────┐             │
│            PUT /api/instance/:publicId         │ Michael │             │
│                                                │   DB    │             │
│                                                └─────────┘             │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                           EMBED FLOW                                    │
│                                                                         │
│  ┌──────────────┐    GET /e/:publicId    ┌─────────┐    ┌─────────┐   │
│  │ Third-party  │ ──────────────────────►│ Venice  │───►│  Paris  │   │
│  │   Website    │                        │  Edge   │    │   API   │   │
│  └──────────────┘ ◄──────────────────────└─────────┘    └────┬────┘   │
│                     SSR HTML                                  │        │
│                                                               ▼        │
│                                                          ┌─────────┐   │
│                                                          │ Michael │   │
│                                                          │   DB    │   │
│                                                          └─────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Bob's Two-API-Call Architecture

Config exists in EXACTLY 2 places during editing:
1. **Michael (database)** — Published version
2. **Bob's React state** — Working copy (`instanceData`)

**The Pattern:**
```
1. Load:    GET /api/instance/:publicId  → Bob gets published config
2. Edit:    All changes in React state   → ZERO API calls
3. Preview: postMessage to iframe        → widget.client.js updates DOM
4. Publish: PUT /api/instance/:publicId  → Saves to Michael
```

**Between load and publish:** Zero database writes. 10,000 users editing = 10,000 in-memory states, zero server load.

---

## Widget Runtime Architecture

### Tokyo Widget Folder

Each widget type has a complete definition in Tokyo:

```
tokyo/widgets/{widgetType}/
├── spec.json          # Defaults + ToolDrawer DSL
├── widget.html        # Semantic HTML with data-role attributes
├── widget.css         # Scoped styles using Dieter tokens
├── widget.client.js   # applyState() for live DOM updates
└── agent.md           # AI contract (required for AI editing)
```

### Shared Runtime Modules

All widgets use shared modules from `tokyo/widgets/shared/`:

| Module | Global Function | Purpose |
|--------|-----------------|---------|
| `stagePod.js` | `CKStagePod.applyStagePod(stage, pod, scopeEl)` | Stage/pod layout, padding, radius, alignment |
| `typography.js` | `CKTypography.applyTypography(typography, root, roleConfig)` | Typography with dynamic Google Fonts (17 curated fonts) |
| `branding.js` | `CKBranding` | "Made with Clickeen" backlink |

### Stage/Pod Architecture

All widgets use a consistent wrapper structure:

```html
<div class="stage" data-role="stage">           <!-- Workspace backdrop -->
  <div class="pod" data-role="pod">             <!-- Widget surface -->
    <div data-ck-widget="{widgetType}">         <!-- Widget root -->
      <!-- Widget content -->
    </div>
  </div>
</div>
```

Layout options applied via `CKStagePod.applyStagePod()`:
- **Stage:** background, padding (linked/unlinked), alignment
- **Pod:** background, padding (linked/unlinked), corner radius (linked/per-corner), width mode (wrap/full/fixed)

### Preview Protocol

Bob sends state updates to the preview iframe via postMessage:

```javascript
iframe.contentWindow.postMessage({
  type: 'ck:state-update',
  widgetname: 'faq',
  state: instanceData,
  device: 'desktop',
  theme: 'light'
}, '*');
```

`widget.client.js` listens and calls `applyState(state)` to update DOM in place (no reload).

---

## Bob's Compiler Architecture

The compiler (`bob/lib/compiler/`) transforms `spec.json` into a `CompiledWidget`:

```typescript
interface CompiledWidget {
  widgetname: string;
  displayName: string;
  defaults: Record<string, unknown>;
  panels: Array<{ id: string; label: string; html: string }>;
  controls: Array<{ path: string; kind: string; ... }>;  // AI ops allowlist
  assets: { htmlUrl, cssUrl, jsUrl, dieter: { styles[], scripts[] } };
}
```

### Compiler Modules (Auto-Generation)

Located in `bob/lib/compiler/modules/`:

| Module | Trigger | Generated Panel |
|--------|---------|-----------------|
| `typography.ts` | `defaults.typography.roles` exists | Typography panel with font family, size preset, style, weight per role |
| `stagePod.ts` | `defaults.stage` or `defaults.pod` exists | Stage/Pod layout panel with padding, radius, width, alignment controls |

### Stencil System

`<tooldrawer-field>` macros are expanded using Dieter component stencils:
- Stencil HTML: `tokyo/dieter/components/{component}/{component}.html`
- Specs: `tokyo/dieter/components/{component}/{component}.spec.json`
- Adds `data-bob-path` for binding, `data-bob-showif` for conditionals

---

## Dieter Component Library

16+ specialized components for widget editing:

| Component | Purpose |
|-----------|---------|
| `toggle` | Boolean switch |
| `textfield` | Text input |
| `slider` | Numeric range |
| `dropdown-actions` | Select from options |
| `dropdown-fill` | Color/image picker |
| `dropdown-edit` | Rich text with formatting palette |
| `choice-tiles` | Visual option cards |
| `segmented` | Radio-style segments |
| `tabs` | Tab navigation |
| `object-manager` | Array add/remove/reorder |
| `repeater` | Nested item blocks |
| `popover` | Floating panel |
| `popaddlink` | URL input with validation |
| `textedit` | Text editing |
| `textrename` | Inline rename |
| `button` | Actions |

Each component has: CSS contract, HTML stencil, hydration script, spec.json.

---

## Venice Embed Architecture

**Current Status:** Debug shell (renders config JSON). Full SSR rendering planned.

### Endpoints

| Route | Purpose |
|-------|---------|
| `GET /e/:publicId` | SSR widget HTML |
| `/embed/v{semver}/loader.js` | Overlay/popup loader |
| `/embed/pixel` | Usage tracking (fire-and-forget) |

### Caching Strategy

| State | Cache-Control |
|-------|---------------|
| Published | `public, max-age=300, s-maxage=600, stale-while-revalidate=1800` |
| Draft | `public, max-age=60, s-maxage=60, stale-while-revalidate=300` |
| Preview (`?ts`) | `no-store` |

### Front-Door Pattern

All third-party embed traffic terminates at Venice:
- Browsers **never** call Paris directly
- Venice validates tokens/branding/entitlements
- Venice proxies to Paris over private channel
- Venice enforces branding flags from Paris responses

---

## Data Flows

### 1. Editing Flow

```
User opens widget → Bob GET /api/instance/:publicId
                  → Paris reads from Michael
                  → Bob stores in React state
                  → User edits (state changes, postMessage to preview)
                  → User clicks Publish
                  → Bob PUT /api/instance/:publicId
                  → Paris writes to Michael
```

### 2. Embed View Flow

```
Visitor loads embed → Venice GET /e/:publicId
                    → Venice calls Paris for instance
                    → Paris reads from Michael
                    → Venice renders SSR HTML (planned: from Tokyo assets)
                    → Venice fires usage pixel
```

### 3. Form Submission Flow

```
User submits form → POST /s/:publicId to Venice
                  → Venice validates + proxies to Paris
                  → Paris POST /api/submit/:publicId
                  → Paris writes to Michael (widget_submissions)
                  → Rate limited, no PII in events
```

---

## Plans & Entitlements

| Plan | Active Widgets | Branding | Premium Templates |
|------|----------------|----------|-------------------|
| Free | 1 | Enforced | Preview only |
| Paid | Unlimited | Removable | Full access |

Paris returns effective entitlements; Venice enforces branding flags exactly.

---

## Performance Budgets

| Metric | Target | Hard Limit |
|--------|--------|------------|
| Embed size (gzipped) | ≤80KB | 200KB |
| Edge TTFB | ≤100ms | — |
| TTI (4G) | <1s | — |

---

## Security & Privacy

- **RLS:** Supabase row-level security on all tables
- **Embed tokens:** 128-bit random, rotatable, revocable
- **Rate limiting:** Per-IP and per-instance on writes
- **Embeds:** No third-party scripts, no cookies, no storage
- **Secrets:** Only in Paris (c-keen-api)
- **CSP:** Strict; no third-party; `form-action 'self'`

---

## Current Implementation Status

### Widgets Implemented

| Widget | Status | Notable Patterns |
|--------|--------|------------------|
| FAQ | ✅ Complete | object-manager → repeater (nested), dropdown-edit (rich text) |
| Countdown | ✅ Complete | Standard controls |

### What's Working

- Bob compiler with stencil expansion
- Auto-generated Typography and Stage/Pod panels
- Shared runtime modules (CKStagePod, CKTypography)
- Two-API-Call pattern
- Ops validation against controls[] allowlist
- Paris instance API with entitlements
- Dieter component library (16+ components)

### What's Planned

- Venice full SSR rendering (currently debug shell)
- Prague marketing site
- Additional widget types
