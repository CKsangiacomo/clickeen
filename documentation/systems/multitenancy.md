# Multi-Tenancy — The Figma Model

## Core Principle

Clickeen is multi-tenant from day 1 with no artificial caps on collaboration. This is the Figma model: make it easy for teams to adopt, and stickiness compounds.

---

## The Model

| Tier | Viewers | Editors/Seats | Widgets | Content Caps |
|------|---------|---------------|---------|--------------|
| **Free** | ∞ | Limited (e.g., 1-2) | Limited | Limited |
| **Tier 1** | ∞ | Capped (e.g., 5) | More | Higher |
| **Tier 2** | ∞ | ∞ | ∞ | ∞ |
| **Tier 3** | ∞ | ∞ | ∞ | ∞ |

**Key rules:**
- **Viewers are always unlimited** at every tier (including Free)
- **Viewers can comment** (feedback loop, collaboration without editing)
- **Editor seats are the upgrade driver** for Free → Tier 1 → Tier 2
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

## Tier Gating (Seats)

| Tier | Max Editors | Max Viewers |
|------|-------------|-------------|
| **Free** | 1-2 | ∞ |
| **Tier 1** | 5 | ∞ |
| **Tier 2** | ∞ | ∞ |
| **Tier 3** | ∞ | ∞ |

**Upgrade triggers:**
- "Invite as editor" blocked when at seat limit
- Message: *"You've reached your editor limit. Upgrade to add more."*
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

