STATUS: NORMATIVE — SINGLE SOURCE OF TRUTH (PHASE-1)
This document is authoritative for the Bob system. It MUST NOT conflict with:
1) supabase/migrations/ (DB schema truth)
2) documentation/CRITICAL-TECHPHASES/Techphases.md (Global Contracts)
3) documentation/CRITICAL-TECHPHASES/Techphases-Phase1Specs.md (Phase-1 Contracts)
If any conflict is found, STOP and escalate to the CEO. Do not guess.

# System: Bob — Builder Application (shell + editor)

## 0) Quick Facts
- **Role**: The core application for registered users to build, manage, and expand their widget usage.
- **Route**: `/bob`
- **Repo path**: `bob/` (Next.js App Router)
- **Deploy surface**: Vercel project `c-keen-app`
- **Dependencies**: Paris (API), Venice (Preview), Dieter (Design System)

## 1) Why Bob Exists: The Product-Led Growth (PLG) Motion
Bob is the engine for user retention and expansion in the Clickeen platform. While the public-facing **MiniBob** on the marketing site handles **acquisition** by providing a frictionless playground for anonymous users, Bob is the destination for registered users.

Its purpose is to convert free users into paying customers by providing a powerful and intuitive management experience that naturally leads to upgrades.

**Bob's Role in the Funnel:**
1.  **Onboarding**: A user lands in Bob immediately after registering. The widget they configured in MiniBob is already saved in their account, providing a seamless transition.
2.  **Management**: Bob is the central hub where users edit their existing widgets, create new ones, and view collected data.
3.  **Expansion & Upgrade**: This is where users encounter natural upgrade paths. When they want to create a second widget, remove branding, or use a premium template, Bob presents the value proposition for a paid plan.

In short, **MiniBob gets users in the door; Bob keeps them and grows their value.**

## 2) How Bob is Used: The User Journey
The user experience is designed around a single, unified workspace. There is no separate "dashboard" or "library" screen.

1.  **Entry**: A user enters Bob and sees their list of saved widget instances.
2.  **Editing**: Selecting a widget opens the main builder layout:
    *   **ToolDrawer (Left)**: The primary editor UI, containing all configuration controls for the selected widget.
    *   **Workspace (Center)**: A live, production-parity preview of the widget, rendered in an `iframe` by the `Venice` system.
    *   **TopDrawer (Top)**: A collapsible panel for browsing and switching between different visual templates.
3.  **Saving**: Changes made in the `ToolDrawer` are reflected in the `Workspace` preview almost instantly. All saves follow a strict, non-destructive "Canonical Save Flow" contract with the `Paris` API.
4.  **Publishing**: Once satisfied, the user copies the embed code to place the widget on their site.

## 3) Core Concepts (Shared Vocabulary)
- **TopDrawer**: The template gallery panel.
- **ToolDrawer**: The left-side editor container for widget configuration.
- **Workspace**: The central `iframe` that previews the `Venice` SSR output.
- **SecondaryDrawer**: A right-side drawer, reserved for future features and disabled by default.
- **Canonical Save Flow**: The strict GET → PUT (prompt → POST) contract with the `Paris` API to prevent data loss.
- **Template Protocol**: The rules for how Bob handles switching between `CARRYABLE` and `NON_CARRYABLE` templates.

## 4) Layout & Taxonomy
The Bob interface is composed of a top bar and a three-column body, corresponding to the CSS classes in `bob.module.css`.

### Top-level Structure
- **topdrawer**: A full-width bar at the top of the layout.
  - **topdmain**: The main (left) area inside the `topdrawer`.
  - **topdright**: The right-aligned area inside the `topdrawer`.
- **Three-column body** (beneath `topdrawer`):
  - **tooldrawer**: The left column, containing the primary editor UI.
  - **workspace**: The main, center column, which hosts the live preview.
  - **secondarydrawer**: The right column, reserved for future features.

### Column Taxonomies
- **tooldrawer**
  - `tdheader`: Header area at the top of the left column.
  - `tdcontent`: Scrollable content area below the header.
- **workspace**
  - `wsheader`: Header area at the top of the center column, containing theme/device toggles.
  - `widget_preview`: The main content area below the header, which contains the `iframe`.
- **secondarydrawer**
  - `sdheader`: Header area at the top of the right column.
  - `sdcontent`: Scrollable content area below the header.

## 4) Builder Workflow (NORMATIVE)
Bob MUST adhere to the following architectural rules:

- **Single Surface**: All work happens within the `/bob` route. There are no separate "library" or "dashboard" screens.
- **Visible Workspace**: The `Venice` preview is always visible and centered during editing.
- **Responsive Drawers**: All drawers (`TopDrawer`, `ToolDrawer`) must have smooth, adaptive transitions and support independent scrolling. On mobile, they open as full-height sheets.
- **Accessibility First**: All interactive elements must be keyboard-accessible with visible focus states, and all dynamic content changes must be announced via ARIA attributes.

## 5) Technical Contracts (NORMATIVE)

### Venice Integration (Preview)
- **Iframe Source**: The Workspace `iframe` MUST load the `Venice` SSR output via `GET /e/:publicId`. No client-side rendering fallbacks are permitted.
- **Preview URL (NORMATIVE)**: The `iframe` `src` MUST follow the format `src=/e/:publicId?ts={ms}&theme=light|dark&device=desktop|mobile`.
  - Always include `ts`, `theme`, and `device` query params to keep caches and analytics consistent.
- **Error Handling**: Bob MUST gracefully handle and display all error states from `Venice` (`TOKEN_INVALID`, `SSR_ERROR`, etc.) within the UI.
- **Seamless Reloads ("No Flash" Policy)**: Previews MUST refresh without a white flash. Preload the new HTML and **cross-fade over 150–200ms**.
- **Focus/Scroll Preservation**: Bob MUST preserve the user's scroll position and keyboard focus across preview reloads.
- **Iframe Error Recovery**: If the `iframe` fails to load, keep the previous HTML visible, overlay a subtle error, and retry with capped exponential backoff (1s → 2s → 5s). After three failures, stop and show a "Preview unavailable" message.

### Paris Integration (Data & Auth)
- **Canonical Save Flow**: Bob MUST NEVER treat `PUT /api/instance/:publicId` as an upsert. The flow is strictly:
1. `GET /api/instance/:publicId` with user authentication.
2. If the instance exists (200 OK), `PUT` the changes.
3. If the instance does not exist (404 Not Found), prompt the user ("Create new instance?") before sending a `POST` request.
- **API Boundary**: Bob communicates exclusively with the `Paris` API. Direct database access is strictly forbidden.
- **Authentication**: Every API request to `Paris` MUST be authenticated with the user's JWT.
- **Entitlements**: Bob MUST respect plan limits and feature gates (`403 PLAN_LIMIT`, `403 PREMIUM_REQUIRED`) returned by `Paris`.
- **422 Field-Path Contract**: Bob MUST handle per-field validation errors from Paris (`[{ path, message }]`) and surface them inline at the matching UI controls.

### Template Switching
- Bob MUST determine if a template switch is **`CARRYABLE`** (preserves compatible fields) or **`NON_CARRYABLE`**.
- For `NON_CARRYABLE` switches, Bob MUST prompt the user with a confirmation dialog (`Save & switch`, `Discard & switch`, `Cancel`) to prevent accidental data loss.
- **Protocol (NORMATIVE)**: Template switching logic MUST enforce a **3-second response budget**. A lack of reply emits a `bob:template.change.timeout` event, restores the previous template, and shows an inline error.
- **Catalog Alignment**: If Paris returns a `422` error with a message indicating an unknown template ID during a switch, Bob MUST show a "This template is currently unavailable" message and prevent the switch. This gracefully handles potential data misalignment between the static catalog and the database.

## 6) UX & Motion Principles (NORMATIVE)
- **Timing**: Use `150–300ms` for micro-interactions and `300–400ms` for macro-transitions (e.g., drawer open/close).
- **Easing**: Use `cubic-bezier(0.4, 0, 0.2, 1)` for all transitions. No bouncing.
- **Preference**: Favor fades over movement. Acknowledge every user action within `~50ms`.
- **No Jank**: Animate size changes and preserve scroll/focus to prevent layout shifts.

### Loading-State Hierarchy
- **<100ms**: No indicator.
- **100–300ms**: Subtle opacity dip (e.g., 100% → 85%).
- **300–1000ms**: Thin progress affordance (bar or spinner).
- **>1000ms**: Lightweight skeleton.

## Appendix A — Error Taxonomy & Messaging
- TOKEN_INVALID / TOKEN_REVOKED: show inline warning, prompt re-authentication/refresh.
- NOT_FOUND: treat as missing instance; offer create flow.
- CONFIG_INVALID: show field-level errors from `path` entries.
- RATE_LIMITED: throttle UX; show retry suggestion.
- SSR_ERROR: show fallback state with retry.

## Appendix B — Feature Flags
- `enableSecondaryDrawer` (default false): toggles Assist drawer.
- `enableMiniBob`: This flag is deprecated. MiniBob is a distinct surface on the `Prague` marketing site, not a feature of Bob.

## Appendix C — Common Implementation Mistakes (NORMATIVE)

❌ **Wrong:** Treating `PUT /api/instance/:publicId` as an upsert.
```ts
// If 404, this silently POSTs a new instance without user consent. (WRONG)
await fetch(`/api/instance/${publicId}`, { method: 'PUT', body: JSON.stringify(payload) });
```
✅ **Right:** Follow the Canonical Save Flow (GET → PUT, prompt before POST).
```ts
const res = await getInstance(publicId);
if (res.status === 200) return updateInstance(publicId, payload);
if (res.status === 404 && userConfirmedCreate()) return createInstance(payload);
```

❌ **Wrong:** Reloading the iframe without a cache-busting `ts` param.
```ts
iframe.src = `/e/${publicId}`; // WRONG — CDN may serve stale HTML
```
✅ **Right:** Append `ts`, theme, and device on every refresh.
```ts
iframe.src = `/e/${publicId}?ts=${Date.now()}&theme=${theme}&device=${device}`;
```

---
Studio.md has been merged into this document. The old Studio system is retired; do not resurrect `documentation/systems/Studio.md`. All builder requirements live here.
