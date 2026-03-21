# Multi-Tenancy — The Figma Model

Canonical account-management architecture now lives in `documentation/architecture/AccountManagement.md`.
This file focuses on tenancy, collaboration, roles, and packaging semantics.

## Core Principle

Clickeen is multi-tenant from day 1 with no artificial caps on collaboration. This is the Figma model: make it easy for teams to adopt, and stickiness compounds.

---

## Status (shipped vs target)

This doc mixes shipped behavior with target packaging. Shipped enforcement today is limited to:
- Global entitlements matrix: `packages/ck-policy/entitlements.matrix.json`
- Per-widget limits mapping: `tokyo/widgets/{widget}/limits.json` (ops + publish reject; load sanitize for blocked flags)
- Comments collaboration is target packaging only right now (comment APIs/UI are not shipped in this repo snapshot).
- Cloud-dev is intentionally collapsed to the seeded platform-owned account after PRD 60. The schema remains account-scoped, but Roma does not expose cross-account switching there.

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

Every viewer is a potential editor. Every editor is a potential account owner.

### 2) No Friction for Adoption

**Bad model:**
> "You've hit 3 viewers. Upgrade to add more."

User: *finds a different tool*

**Good model (Clickeen):**
> "Invite anyone to view and comment. Upgrade when you need more editors."

User: *invites whole team, becomes dependent on Clickeen*

### 3) Switching Costs Compound

More people in the account = harder to leave.

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
- Can see all widgets in the account
- Can leave comments (feedback, suggestions, approvals)
- Cannot edit or create widgets
- Do not count toward seat limits

**Editors:**
- Can create and edit widgets
- Count toward seat limits (Free/Tier 1)
- Unlimited in Tier 2/3

---

## Account Structure

```
Account
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

**Widgets belong to accounts, not users.** If an editor leaves, their widgets stay.

## Account-Only Tenancy (Shipped)

Accounts are the primary tenant boundary:
- Collaboration boundary (roles, comments, instance ownership)
- Ownership/metering boundary for uploads (Tokyo asset authority always requires `account_id`; browser path is Roma account routes only)
- Policy/entitlement context for editor surfaces (Roma/Bob)

```
account
  ├── widget instances (account-owned)
  ├── members/roles (account boundary)
  ├── account-owned assets
  └── authz + entitlement context
```

Key boundary rules:
- Instances, assets, locales, and membership are all account-scoped.
- Roma asset reads are account-canonical (`/api/account/assets`).
- Roma injects a short-lived authz capsule (`x-ck-authz-capsule`) for account-scoped Paris calls.
- Curated platform content is owned by a platform account row and remains globally readable; runtime policy must use `accounts.is_platform` plus `owner_account_id`, not `ADMIN_ACCOUNT_ID`.

---

## Commenting System (target; not shipped)

Viewers need a way to provide feedback without editing. Comments are:
- Tied to a widget instance
- Optionally tied to a specific field/element (like Figma's comment pins)
- Resolvable (mark as done)
- Visible to all account members

### Comment Schema

```typescript
type Comment = {
  id: string;
  accountId: string;
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
| **AI Model Quality** | Basic (Fast) | Standard (Selectable) | Premium | Premium (SOTA) |
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
| Workspace = organizing unit | Account = organizing unit |
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

## Runtime Subjects — current truth

The shared Builder core no longer models runtime `subjectMode` or boot-mode switching.

**Current architecture:**
- Builder authoring is the Roma-hosted account path only.
- Bob receives one open payload and one policy object from Roma.
- MiniBob/demo surfaces are not shared Builder subjects and should not shape shared Bob architecture.

**Budgets (MiniBob + Free conversion gates):**
- Budgets are **usage counters** for cost drivers we want bounded in demo/free usage (ex: uploads, Copilot turns, crawls, snapshot regenerations).
- Budgets are **metered and enforced server-side** at the point where cost is incurred (Paris/Tokyo-worker/Venice); Bob uses the resolved policy for UX gating + upsell messaging.
- Budgets are defined by the real account policy plus explicit demo-surface gates, not by a fake `minibob` subject profile and not by individual widgets.

**How this appears in widget PRDs (required):**
- PRDs list **which entitlement keys** a widget uses and **how they map** to widget state (paths + metrics).
- Tier values live only in the global matrix: `packages/ck-policy/entitlements.matrix.json`.
- Widget enforcement lives in `tokyo/widgets/{widget}/limits.json` (flags/caps). Budgets are global and metered server-side.
- Template: `documentation/widgets/_templates/SubjectPolicyMatrices.md` (no per-widget tier matrices).

**Upsell popup standard (durable):**
- Every rejected limit or budget uses the same **Upsell** popup (no per-row copy).
- The system chooses the destination and CTA deterministically:
  - If the viewer has no account/session (Prague demo / anonymous): upsell takes them to **Create Free Account**
  - If the viewer is logged in but blocked by plan/tier: upsell takes them to **Upgrade Plan**
- PRDs do **not** encode "free vs paid" in per-row copy; it is derived from the matrix deltas and current viewer profile.

**Builder boot today:**
- Roma opens Bob through one message payload: `postMessage { type:'ck:open-editor', ... }`.
- Shared Builder core does not accept or switch on `subjectMode`.
- Shared Builder core does not URL-bootstrap account sessions.

**What still matters:**
- Uploads and Copilot remain bounded by server-side policy/budget enforcement.
- Shared Builder should not carry `if (minibob)` checks or other fake editor identities.

**Why this scales:**
- The editor stays one product path: account opens widget, Bob edits, Roma saves.
- Demo/funnel surfaces can evolve separately without contaminating the shared Builder core.

### Paris Enforcement

Current shipped behavior:
- Account member listing is read-only via `GET /api/account/team` and `GET /api/account/team/members/:memberId` for authorized users.
- Publish and editor behavior use policy/entitlement enforcement already wired in runtime.
- There is no shipped seat-cap write-path enforcement in Paris yet.
- There is no shipped `SEAT_LIMIT_EXCEEDED` runtime error yet.

Planned behavior (not shipped):
- Add member management write endpoints.
- Enforce `maxEditors` on add/update editor-role operations.
- Keep viewer invites uncapped.

### Bob UX

Current shipped behavior:
- Role/policy-aware editing gates are enforced by resolved account policy.

Planned behavior (not shipped):
- Explicit seat-remaining UI and editor seat warning states.
- Invite modal enforcing seat caps at submission time.

### Michael Schema

```sql
CREATE TABLE account_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, user_id)
);

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  widget_instance_id UUID NOT NULL REFERENCES public.widget_instances(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  target JSONB NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Summary

1. **Viewers are always unlimited** — at every tier, including Free
2. **Viewers can comment** — collaboration without editing
3. **Editor seats are the upgrade lever** — capped in Free/Tier 1, unlimited in Tier 2/3
4. **Widgets belong to accounts** — portable, team-owned
5. **No sales call for teams** — self-serve collaboration from day 1

This is the Figma model applied to widgets: make adoption frictionless, let stickiness compound, charge for serious usage.
