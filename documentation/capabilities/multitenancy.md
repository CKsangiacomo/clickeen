# Multi-Tenancy — The Figma Model

## Core Principle

Clickeen is multi-tenant from day 1 with no artificial caps on collaboration. This is the Figma model: make it easy for teams to adopt, and stickiness compounds.

---

## Status (shipped vs target)

This doc mixes shipped behavior with target packaging. Shipped enforcement today is limited to:
- Global entitlements matrix: `config/entitlements.matrix.json`
- Per-widget limits mapping: `tokyo/widgets/{widget}/limits.json` (ops + publish reject; load sanitize for blocked flags)

Anything else in this doc (seats, instance counts, widget type counts) is directional until implemented.

---

## The Model (target packaging)

| Tier | Viewers | Editors | Widget Types | Instances | Content | Features |
|------|---------|---------|--------------|-----------|---------|----------|
| **Free** | ∞ | 1 | 1 | 1 | Limited | Limited |
| **Tier 1** | ∞ | 3-5 | All | 5-10 | Higher caps | + SEO/GEO |
| **Tier 2** | ∞ | ∞ | All | ∞ | ∞ | + Auto-translate |
| **Tier 3** | ∞ | ∞ | All | ∞ | ∞ | + Supernova |

### Tier Details

**Free:**
- 1 editor (solo use)
- 1 widget type (e.g., only FAQ)
- 1 instance (can't embed on multiple pages)
- Limited content (e.g., max 4 FAQs per section, max 2 sections)
- Limited features (no SEO/GEO, no auto-translate)
- Website URL for AI (Copilot context) enabled
- No Supernova
- "Made with Clickeen" branding

**Tier 1:**
- 3-5 editors
- All widget types
- 5-10 instances
- Higher content caps (e.g., 10 FAQs per section)
- SEO/GEO enabled
- Website URL for AI (Copilot context) enabled
- No auto-translate, no Supernova
- Branding optional

**Tier 2:**
- Unlimited editors
- All widget types
- Unlimited instances
- Unlimited content
- All features including auto-translate (up to 3 locales)
- No Supernova
- No branding

**Tier 3:**
- Everything in Tier 2
- Unlimited auto-translate locales
- Supernova effects enabled
- Priority support

**Key rules:**
- **Viewers are always unlimited** at every tier (including Free)
- **Viewers can comment** (feedback loop, collaboration without editing)
- **Upgrade drivers:** instances → Tier 1, team size → Tier 2, effects → Tier 3
- **No caps on collaboration** once you hit Tier 2

---

## Why Unlimited Viewers Matters

### 1) Virality Within Organizations

```
Day 1:  Marketer creates FAQ widget
Day 3:  Shares view link with PM → PM comments
Day 7:  PM shares with Product → Product comments
Day 14: Designer joins as editor to improve styling
Day 30: 15 people viewing/commenting, 3 editors
```

Every viewer is a potential editor. Every editor is a potential workspace owner.

### 2) No Friction for Adoption

**Bad model:**
> "You've hit 3 viewers. Upgrade to add more."

User: *finds a different tool*

**Good model (Clickeen):**
> "Invite anyone to view and comment. Upgrade when you need more editors."

User: *invites whole team, becomes dependent on Clickeen*

### 3) Switching Costs Compound

More people in the workspace = harder to leave.

If 20 people are viewing and commenting on widgets, switching means:
- Re-training everyone
- Losing all comment history
- Breaking embedded widgets

**Multi-tenant = stickiness moat.**

---

## Roles

| Role | View | Comment | Edit | Create | Manage Team | Billing |
|------|------|---------|------|--------|-------------|---------|
| **Viewer** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Editor** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Owner** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Viewers:**
- Can see all widgets in the workspace
- Can leave comments (feedback, suggestions, approvals)
- Cannot edit or create widgets
- Do not count toward seat limits

**Editors:**
- Can create and edit widgets
- Count toward seat limits (Free/Tier 1)
- Unlimited in Tier 2/3

---

## Workspace Structure

```
Workspace
├── Plan: { tier, billingEmail, ... }
├── Members[]
│   ├── { userId, role: 'owner', joinedAt }
│   ├── { userId, role: 'editor', joinedAt }
│   ├── { userId, role: 'viewer', joinedAt }
│   └── ...
├── WidgetInstances[]
│   ├── { publicId, widgetType, config, createdBy, ... }
│   └── ...
└── Comments[]
    ├── { widgetId, userId, text, createdAt, resolved }
    └── ...
```

**Widgets belong to workspaces, not users.** If an editor leaves, their widgets stay.

---

## Commenting System

Viewers need a way to provide feedback without editing. Comments are:
- Tied to a widget instance
- Optionally tied to a specific field/element (like Figma's comment pins)
- Resolvable (mark as done)
- Visible to all workspace members

### Comment Schema

```typescript
type Comment = {
  id: string;
  workspaceId: string;
  widgetInstanceId: string;
  userId: string;
  text: string;
  target?: {
    path: string;      // e.g., "sections[0].faqs[2].answer"
    elementId?: string; // DOM element reference
  };
  resolved: boolean;
  createdAt: Date;
  updatedAt: Date;
};
```

### UX (Bob)

- Viewer mode: Can view widget, leave comments, cannot edit
- Editor mode: Full editing + can see/resolve comments
- Comment indicator: Badge on widget showing unresolved comment count

---

## Tier Gating (target packaging)

| Capability | Free | Tier 1 | Tier 2 | Tier 3 |
|------------|------|--------|--------|--------|
| **Viewers** | ∞ | ∞ | ∞ | ∞ |
| **Editors** | 1 | 3-5 | ∞ | ∞ |
| **Widget types** | 1 | All | All | All |
| **Instances** | 1 | 5-10 | ∞ | ∞ |
| **Content** | Limited | Higher | ∞ | ∞ |
| **SEO/GEO** | ❌ | ✅ | ✅ | ✅ |
| **Website URL (AI context)** | ✅ | ✅ | ✅ | ✅ |
| **Auto-translate** | ❌ | ❌ | ✅ (3 locales) | ✅ (∞) |
| **Supernova** | ❌ | ❌ | ❌ | ✅ |
| **Branding** | Required | Optional | None | None |

**Upgrade triggers:**
- "I need another widget type" → Tier 1
- "I need more instances" → Tier 1
- "I want SEO/GEO" → Tier 1
- "Add another editor" blocked at seat limit → Tier 2
- "I want auto-translate" → Tier 2
- "I want Supernova effects" → Tier 3
- Viewers are never blocked

---

## Why This Is The Figma Model

| Figma | Clickeen |
|-------|----------|
| Unlimited viewers on any file | Unlimited viewers on any widget |
| Pay per editor seat | Upgrade tiers unlock more editors |
| Comments on designs | Comments on widgets |
| Workspace = organizing unit | Workspace = organizing unit |
| Switching cost = team is embedded | Switching cost = widgets are embedded everywhere |

---

## Why Multi-Tenant from Day 1

### 1) Enterprise-Ready Without "Contact Sales"

Agencies, marketing teams, and enterprises can self-serve. No sales call required for collaboration.

### 2) AI + Multi-Tenant = Leverage

```
Traditional SaaS:
- 5-seat limit → sales call → negotiation
- Cost: $150K/year sales rep

Clickeen:
- Invite 50 viewers → they upgrade themselves when needed
- SDR Copilot nudges at the right moment
- Cost: $0.001 per conversation
```

### 3) PLG Flywheel

```
Free user → invites team as viewers → viewers comment
→ viewers want to edit → upgrade to add seats
→ more editors → more widgets → more embeds
→ more embeds seen → more signups → repeat
```

---

## Technical Notes

## Dev Subjects (DevStudio + MiniBob) — Durable policy architecture

While we are building (before full auth/billing enforcement ships), we still need deterministic gating/caps across surfaces.

**Durable architecture:**
- **Input**: a single `subjectMode` that describes the calling surface.
- **Output**: a single `policy` object (flags + caps + budgets) used by Bob for gating and ops validation.

**Budgets (MiniBob + Free conversion gates):**
- Budgets are per-session counters for actions we want to keep bounded in demo/free usage (example: uploads, Copilot turns).
- When a budget is exhausted, Bob blocks the action and shows a conversion gate (e.g. “Create a free account to continue”).
- Budgets are defined by the subject policy (e.g. `minibob` vs `devstudio`), not by individual widgets.

**How this appears in widget PRDs (required):**
- PRDs list **which entitlement keys** a widget uses and **how they map** to widget state (paths + metrics).
- Tier values live only in the global matrix: `config/entitlements.matrix.json`.
- Widget enforcement lives in `tokyo/widgets/{widget}/limits.json` (flags/caps). Budgets are global, per-session.
- Template: `documentation/widgets/_templates/SubjectPolicyMatrices.md` (no per-widget tier matrices).

**Upsell popup standard (durable):**
- Every rejected limit or budget uses the same **Upsell** popup (no per-row copy).
- The system chooses the destination and CTA deterministically:
  - If the viewer has no account/session (MiniBob / anonymous): upsell takes them to **Create Free Account**
  - If the viewer is logged in but blocked by plan/tier: upsell takes them to **Upgrade Plan**
- PRDs do **not** encode "free vs paid" in per-row copy; it is derived from the matrix deltas and current viewer profile.

**Current dev subjects:**
- `devstudio`: internal “everything enabled” subject used by DevStudio.
- `minibob`: internal “demo” subject used by Prague MiniBob.

**How the subject is set today (shipped in Bob):**
- Bob accepts the subject via either:
  - URL: `?subject=minibob|devstudio` (preferred), plus backward compatibility with `?minibob=true`
  - Bootstrap message: `postMessage { type:'devstudio:load-instance', subjectMode:'minibob'|'devstudio', ... }`

**What Bob enforces today (example):**
- `seoGeo.enabled` is sanitized to `false` on load and rejected on ops/publish when the policy flag is off.
- `branding.remove` maps to `behavior.showBacklink` and is sanitized on load when blocked.
- `context.websiteUrl.enabled` is a workspace-level flag; when website URL is surfaced, enforcement happens at the usage boundary (not by hiding UI).
- Enforcement is centralized via `limits.json` + policy, so we do not scatter `if (minibob)` checks.

**Why this scales:**
- New surfaces add a new `subjectMode` without changing widget code.
- Later, real workspaces/roles/plans become another subject source, but Bob still consumes a single resolved `policy`.

### Paris Enforcement

- Workspace plan includes `maxEditors`
- Adding an editor beyond limit returns `403 SEAT_LIMIT_EXCEEDED`
- Adding viewers always succeeds (no limit check)
- Publish checks workspace entitlements (widget-level features)

### Bob UX

- Role-aware UI: viewers see "View Only" mode, cannot access edit controls
- Invite modal: dropdown for role (Viewer / Editor)
- Seat limit warning: shows remaining editor seats

### Michael Schema

```sql
CREATE TABLE workspace_members (
  workspace_id UUID REFERENCES workspaces(id),
  user_id UUID REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE comments (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  widget_instance_id UUID REFERENCES widget_instances(id),
  user_id UUID REFERENCES users(id),
  text TEXT NOT NULL,
  target_path TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Summary

1. **Viewers are always unlimited** — at every tier, including Free
2. **Viewers can comment** — collaboration without editing
3. **Editor seats are the upgrade lever** — capped in Free/Tier 1, unlimited in Tier 2/3
4. **Widgets belong to workspaces** — portable, team-owned
5. **No sales call for teams** — self-serve collaboration from day 1

This is the Figma model applied to widgets: make adoption frictionless, let stickiness compound, charge for serious usage.
