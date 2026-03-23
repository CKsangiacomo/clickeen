# Clickeen Architecture Tenets

> **Purpose**: Authoritative guide for AI agents and developers. All architectural decisions flow from these principles.

> **Canonical asset contract**: [AssetManagement.md](./AssetManagement.md)

---

## Summary Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLICKEEN ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              TENET 0: EDITING PLATFORM                  │   │
│   │         "Clickeen edits widgets. No fallbacks."         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│   ┌──────────────────────────┼──────────────────────────────┐   │
│   │                          ▼                              │   │
│   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│   │   │  TENET 1    │  │  TENET 2    │  │  TENET 3    │     │   │
│   │   │ Widget      │  │ Orchestrators│  │ System      │     │   │
│   │   │ Files =     │  │ = Dumb      │  │ Fails       │     │   │
│   │   │ Truth       │  │ Pipes       │  │ Visibly     │     │   │
│   │   └─────────────┘  └─────────────┘  └─────────────┘     │   │
│   │                          │                              │   │
│   │   ┌──────────────────────┼──────────────────────────┐   │   │
│   │   │                      ▼                          │   │   │
│   │   │   ┌─────────────────────────────────────────┐   │   │   │
│   │   │   │           TENET 4: DIETER TOKENS        │   │   │   │
│   │   │   │   "All styling uses Dieter tokens"      │   │   │   │
│   │   │   └─────────────────────────────────────────┘   │   │   │
│   │   │   ┌─────────────────────────────────────────┐   │   │   │
│   │   │   │        TENET 5: BORING SAAS SHELL       │   │   │   │
│   │   │   │ "Boot once. Trust current-account truth"│   │   │   │
│   │   │   └─────────────────────────────────────────┘   │   │   │
│   │   └─────────────────────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tenet 0: Clickeen Is an Editing Platform

Clickeen exists to **edit and customize widgets**. Users make choices, and those choices are saved exactly as made.

### Why This Matters

```
User Intent → Clickeen Saves → Embed Renders

     ┌──────────────────┐
     │   User chooses   │
     │   red button     │
     └────────┬─────────┘
              │
              ▼
     ┌──────────────────┐
     │   Clickeen saves │
     │   "red"          │
     └────────┬─────────┘
              │
              ▼
     ┌──────────────────┐
     │   Embed shows    │
     │   red button     │
     └──────────────────┘
```

If any system along this path "corrects" or "defaults" the value, the user's intent is lost.

### The Rule

**There are no fallbacks for instance identity or instance config in Clickeen.**

- If a config value is missing → the system fails visibly
- If a config value is wrong → the system fails visibly
- The widget files define everything; orchestrators pass data through unchanged

Note: request parameters (like `locale`) may have a deterministic default (Phase 1: `en`) when omitted. This is not identity and must not create DB fan-out.
Note: localization overlays are **not** “fallbacks for config.” The base config is always complete and renderable; locale overlays are exposed only when current for the active base fingerprint. Consumers must not silently substitute base, stale, or other locale output and must not lie about the rendered locale.

### Why No Fallbacks

| With Fallbacks | Without Fallbacks |
|----------------|-------------------|
| Bug is hidden | Bug is visible |
| User sees wrong output | Developer sees error |
| Hard to debug | Easy to fix |
| AI learns bad patterns | AI learns correct patterns |

---

## Tenet 1: Widget Files Are Complete Truth

Every widget is defined by **core runtime files + contract files** in Tokyo:

```
tokyo/widgets/{widgetname}/
├── spec.json              ← Schema + defaults + ToolDrawer panels
├── widget.html            ← HTML structure
├── widget.css             ← All styling
├── widget.client.js       ← Runtime behavior
├── agent.md               ← AI editing contract
├── limits.json            ← Entitlements caps/flags consumed by shared policy enforcement
├── localization.json      ← Locale-layer allowlist (translatable paths)
├── layers/*.allowlist.json← Per-layer allowlists (user/geo/industry/etc.)
└── pages/*.json           ← Prague marketing pages (overview/features/etc.)
```

### What This Means

- Core runtime files contain **everything** about widget behavior
- Contract files define limits/localization; Prague pages define the marketing surface
- No other system adds, removes, or modifies widget behavior
- If it's not in these files, it doesn't exist

### Data Flow

```
┌─────────────────┐
│   Tokyo         │
│ (core files)    │
└────────┬────────┘
         │
         │ provides definition
         ▼
┌─────────────────┐      ┌─────────────────┐
│   Bob           │ ←──→ │   Michael       │
│   (Editor)      │      │   (Database)    │
└────────┬────────┘      └─────────────────┘
         │
         │ user edits instanceData
         ▼
┌─────────────────┐
│   Venice        │
│   (Embed)       │
└─────────────────┘
```

---

## Tenet 2: Orchestrators Are Dumb Pipes

Bob, Roma, Tokyo-worker, and Venice are **orchestrators**. They move data between systems.

### What Orchestrators Do

| System | Role |
|--------|------|
| **Bob** | Loads widget definition from Tokyo, renders ToolDrawer, stores edits in memory |
| **Roma** | Resolves current account context and forwards product commands to owner-correct services |
| **Tokyo-worker** | Materializes saved/live/localization/public artifacts from owner truth |
| **Venice** | Reads published pointers + immutable runtime bytes and returns public embeds |
| **Michael** | Stores account/registry state; it does not own widget semantics |

### What Orchestrators Never Do

- Validate widget data beyond basic JSON structure
- Apply default values
- "Heal" or mutate stored configs (beyond deterministic overlay composition)
- Know widget-specific logic
- Generate widget HTML/CSS/JS

### Diagram

```
         Tokyo (Source of Truth)
              │
    ┌─────────┼─────────┐
    │         │         │
    ▼         ▼         ▼
  Bob      Venice     Roma
    │         │         │
    │    (dumb pipes)   │
    │         │         │
    └─────────┼─────────┘
              │
              ▼
     Tokyo-worker / Michael
```

---

## Tenet 3: The System Fails Visibly

When something is wrong, the system **stops and shows an error**.

### Why Visible Failure

```
Widget Missing Field
        │
        ▼
┌─────────────────┐
│  System throws  │
│  error message  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Developer sees │
│  exact problem  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Fix is applied │
│  to widget file │
└─────────────────┘
```

### What This Enables

- Bugs are caught immediately
- AI agents see clear errors and learn correct patterns
- Widget developers know exactly what to fix
- No silent corruption of user data

---

## Tenet 4: Dieter Tokens Principle

All colors, typography, and spacing in widget configs use **Dieter design tokens**.

### Default Values Use Tokens

```json
{
  "appearance": {
    "headingColor": "var(--color-text)",
    "buttonBackground": "var(--color-primary)",
    "buttonTextColor": "var(--color-on-primary)"
  }
}
```

### User Overrides Allowed

Users can override with RGB/HEX values in controls:

```json
{
  "appearance": {
    "headingColor": "#FF5500",
    "buttonBackground": "rgb(100, 50, 200)"
  }
}
```

### Why Tokens First

| Benefit | Explanation |
|---------|-------------|
| Consistency | All widgets share the same design language |
| Theming | Change tokens once, all widgets update |
| AI-friendly | AI knows valid token names |
| User flexibility | Users can still use custom colors |

---

## Tenet 5: Boring SaaS Shells Operate From Minted Truth

Clickeen is a complex multi-system platform, but the product shell must behave like a boring SaaS app.

That means the normal product path is:

1. user signs in
2. the system mints identity, active account, and entitlements once
3. Roma boots with that truth
4. domains operate from the current account
5. internal systems talk directly to the real owner systems

### What This Means

- Roma is not supposed to rediscover the current account on every domain action.
- The browser is not the source of account truth for normal product flows.
- Internal systems must not keep asking each other to re-prove already-minted current-account truth.
- The browser expresses user intent; it is not an orchestration bus for server-owned identity/account state.
- Explicit `accountId` is exceptional, not normal. It belongs only on flows like switch-account, support/internal tools, or clearly cross-account actions.

### Why This Matters

Without this tenet, the system drifts into a broken product shape:

- bootstrap already knows the current account
- each domain asks again "what account is this?"
- server routes re-check already-minted truth
- browser code starts ferrying context between internal services

That creates duplication, drift, and blocked product domains.

With this tenet:

- the shell boots once
- the current account is trusted
- domains become boring
- systems compose cleanly
- complexity stays at the real ownership boundaries instead of leaking into every user flow

### The Rule

For ordinary product usage:

- mint current-account truth once at the correct authority boundary
- operate from that truth
- send commands to the real owner systems directly

If a normal product flow requires the browser to repeatedly restate "which account is this?", the architecture is wrong even if each local step looks explicit.

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        TOKYO                                │
│              (Widget Definitions + Dieter)                  │
│                                                             │
│   widgets/           dieter/                                │
│   ├── faq/           ├── tokens/                            │
│   └── shared/        └── icons/                             │
└─────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
    │    BOB      │    │   VENICE    │    │   PARIS     │
    │   Editor    │    │   Embed     │    │   API       │
    │             │    │             │    │             │
    │ Compiles    │    │ Renders     │    │ CRUD for    │
    │ spec.json   │    │ widget.html │    │ instances   │
    │ to UI       │    │ + CSS + JS  │    │             │
    └──────┬──────┘    └─────────────┘    └──────┬──────┘
           │                                     │
           └─────────────────┬───────────────────┘
                             │
                             ▼
                      ┌─────────────┐
                      │   MICHAEL   │
                      │  (Supabase) │
                      │             │
                      │ Stores      │
                      │ instanceData│
                      │ as JSON     │
                      └─────────────┘
```

---

## The Verification Question

When reviewing any code change, ask:

> **"Does this system know something only the widget should know?"**

If yes → the change violates architecture
If no → the change is correct

### Canonical examples (golden path)

| Change | Why it’s correct |
|--------|------------------|
| Bob renders ToolDrawer from `spec.json` | Bob compiles the widget definition into UI; it doesn’t invent widget semantics. |
| Venice fetches `widget.html` and serves it | Venice passes through widget assets; it doesn’t mutate widget meaning. |
| Roma opens/saves account instances through Tokyo-backed routes | Roma orchestrates the product command, but widget semantics still live in the widget package. |

---

## Platform Auto-Generated Panels

Bob automatically generates these standard panels for every widget:

| Panel | Purpose |
|-------|---------|
| **Typography** | Font families, sizes, weights for text roles |
| **Stage/Pod Layout** | Padding, alignment, width, corner radius |
| **Stage/Pod Appearance** | Background colors/fills |

These panels ensure consistency across all widgets. Widget developers use the standard structure.

---

## Quick Reference

| Tenet | One-liner |
|-------|-----------|
| **0** | No fallbacks for instance config/identity |
| **1** | 5 widget files = complete truth |
| **2** | Orchestrators are dumb pipes |
| **3** | System fails visibly |
| **4** | All styling uses Dieter tokens |
