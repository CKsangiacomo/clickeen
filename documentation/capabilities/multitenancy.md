# Multi-Tenancy — The Figma Model

Canonical account-management architecture lives in `documentation/architecture/AccountManagement.md`.
Active current truth is one user, one account, and role on `users`.
This file records product packaging semantics for tenancy, collaboration, roles,
and tiers.

## Core Principle

Clickeen is multi-tenant from day 1 with no artificial limits on collaboration. This is the Figma model: make it easy for teams to adopt, and stickiness compounds.

---

## Status

Active enforcement is:

- Global entitlements matrix: `packages/ck-policy/entitlements.matrix.json`
- Per-widget limits mapping: `tokyo/product/widgets/{widget}/limits.json` for editor/runtime capability context; account-level publish, upload/storage, tier, and downgrade enforcement belongs to Roma/system account operations
- Comments collaboration is product packaging without shipped comment APIs/UI in this repo snapshot.
- Cloud-dev uses the seeded Clickeen/admin account. The schema remains account-scoped, and Roma presents the current account only.

Seat, instance-count, and widget-type packaging in this file becomes enforcement
only through explicit Roma/system account operations.

Runtime policy uses stable ids only: `free`, `tier1`, `tier2`, `tier3`, and `tier4`. There are no commercial tier names in the product contract. `free`, `tier1`, `tier2`, and `tier3` are widget-only tiers. `tier4` is the first tier that includes customer-owned pages built from widget instances.

---

## Tier Packaging

| Tier       | Viewers | Editors | Widget Types | Instances | Content       | Features                  |
| ---------- | ------- | ------- | ------------ | --------- | ------------- | ------------------------- |
| **Free**   | ∞       | 1       | 1            | 1         | Limited       | Limited                   |
| **Tier 1** | ∞       | 3-5     | 1            | 1         | higher limits | branding removed          |
| **Tier 2** | ∞       | ∞       | 3            | 5         | higher limits | + SEO/GEO, auto-translate |
| **Tier 3** | ∞       | ∞       | All          | ∞         | ∞             | + Supernova               |
| **Tier 4** | ∞       | ∞       | All          | ∞         | ∞             | + pages                   |

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
- 1 widget type
- 1 published instance
- Higher content caps (e.g., 10 FAQs per section)
- Website URL for AI (Copilot context) enabled
- No SEO/GEO, no auto-translate, no Supernova
- Branding optional

**Tier 2:**

- Unlimited editors
- Up to 3 widget types
- Up to 5 published instances
- Higher content limits
- SEO/GEO enabled
- Auto-translate enabled
- No Supernova
- No branding

**Tier 3:**

- Everything in Tier 2
- Unlimited widget types and published instances
- Unlimited auto-translate locales within the supported locale set
- Supernova effects enabled
- Priority support

**Tier 4:**

- Everything in Tier 3
- Customer-owned pages built from widget instance stacks
- Commercial home for account pages built from widget instance stacks
- Availability is controlled by account policy/profile, not by a separate product mode

**Key rules:**

- **Viewers are always unlimited** at every tier (including Free)
- **Viewers can comment** (feedback loop, collaboration without editing)
- **Upgrade drivers:** SEO/GEO and translation → Tier 2, effects → Tier 3, pages/sites → Tier 4
- **No limits on collaboration** once you hit Tier 2

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

User: _finds a different tool_

**Good model (Clickeen):**

> "Invite anyone to view and comment. Upgrade when you need more editors."

User: _invites whole team, becomes dependent on Clickeen_

### 3) Switching Costs Compound

More people in the account = harder to leave.

If 20 people are viewing and commenting on widgets, switching means:

- Re-training everyone
- Losing all comment history
- Breaking embedded widgets

**Multi-tenant = stickiness moat.**

---

## Roles

| Role       | View | Comment | Edit | Create | Manage Team | Billing |
| ---------- | ---- | ------- | ---- | ------ | ----------- | ------- |
| **Viewer** | ✅   | ✅      | ❌   | ❌     | ❌          | ❌      |
| **Editor** | ✅   | ✅      | ✅   | ✅     | ❌          | ❌      |
| **Admin**  | ✅   | ✅      | ✅   | ✅     | ✅          | ❌      |
| **Owner**  | ✅   | ✅      | ✅   | ✅     | ✅          | ✅      |

**Viewers:**

- Can see all widgets in the account
- Can leave comments (feedback, suggestions, approvals)
- Cannot edit or create widgets
- Are outside editor seat limits

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
└── WidgetInstances[] in Tokyo
    ├── { instanceId, widgetType, config, displayName, ... }
    └── ...
```

**Instances belong to accounts, not users.** If an editor leaves, the account-owned instances stay. Widget software belongs to the product plane under `product/widgets/`, not to any account.

## Account-Only Tenancy (Shipped)

Accounts are the primary tenant boundary:

- Collaboration boundary (roles, comments, instance ownership)
- Ownership/metering boundary for uploads (Tokyo asset authority uses the account's `accountPublicId`; browser path is Roma account routes only)
- Policy/entitlement context for editor surfaces (Roma/Bob)
- Management-plane boundary for publish/unpublish/delete/downgrade/cap/tier correctness

```
account
  ├── widget instances (account-owned)
  ├── members/roles (account boundary)
  ├── account-owned assets
  ├── published projections for account-owned instances
  └── authz + entitlement context
```

Key boundary rules:

- Instances, assets, locales, and membership are all account-scoped.
- Roma asset reads are account-canonical (`/api/account/assets`).
- Roma injects a short-lived authz capsule (`x-ck-authz-capsule`) for account-scoped product-control calls.
- Curated platform content uses the normal Clickeen/admin account `CLICKEEN`; references carry `accountPublicId + instanceId`.
- Tokyo-worker and Venice are PBX layers. Roma/system account operations decide billing tier, cap eligibility, downgrade correctness, and published projection eligibility.

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
    path: string; // e.g., "sections[0].faqs[2].answer"
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

| Product area                 | Free         | Tier 1   | Tier 2  | Tier 3         | Tier 4         |
| ---------------------------- | ------------ | -------- | ------- | -------------- | -------------- |
| **Viewers**                  | ∞            | ∞        | ∞       | ∞              | ∞              |
| **Editors**                  | 1            | 3-5      | ∞       | ∞              | ∞              |
| **Widget types**             | 1            | 1        | 3       | ∞              | ∞              |
| **Published instances**      | 1            | 1        | 5       | ∞              | ∞              |
| **Content**                  | Limited      | Higher   | Higher  | ∞              | ∞              |
| **SEO/GEO**                  | ❌           | ❌       | ✅      | ✅             | ✅             |
| **Website URL (AI context)** | ✅           | ✅       | ✅      | ✅             | ✅             |
| **AI Model Quality**         | Basic (Fast) | Standard | Premium | Premium (SOTA) | Premium (SOTA) |
| **Auto-translate**           | ❌           | ❌       | ✅      | ✅             | ✅             |
| **Supernova**                | ❌           | ❌       | ❌      | ✅             | ✅             |
| **Pages**                    | ❌           | ❌       | ❌      | ❌             | ✅             |
| **Branding**                 | Required     | Optional | None    | None           | None           |

**Upgrade triggers:**

- "I need more widget types" → Tier 2
- "I need more published instances" → Tier 2
- "I want SEO/GEO" → Tier 2
- "Add another editor" blocked at seat limit → Tier 2
- "I want auto-translate" → Tier 2
- "I want Supernova effects" → Tier 3
- "I want landing pages" → Tier 4
- Viewers are never blocked

---

## Why This Is The Figma Model

| Figma                             | Clickeen                                         |
| --------------------------------- | ------------------------------------------------ |
| Unlimited viewers on any file     | Unlimited viewers on any widget                  |
| Pay per editor seat               | Upgrade tiers unlock more editors                |
| Comments on designs               | Comments on widgets                              |
| Workspace = organizing unit       | Account = organizing unit                        |
| Switching cost = team is embedded | Switching cost = widgets are embedded everywhere |

---

## Why Multi-Tenant from Day 1

### 1) Large-Account Ready Without "Contact Sales"

Agencies, marketing teams, and enterprises can self-serve. No sales call required for collaboration.

### 2) AI + Multi-Tenant = Leverage

```
Traditional SaaS:
- 5-seat limit → sales call → negotiation
- Cost: $150K/year sales rep

Clickeen:
- Invite 50 viewers → they upgrade themselves when needed
- Product prompts nudge at the right moment
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

The shared Builder core models the Roma-hosted account Builder path.

**Current architecture:**

- Builder authoring is the Roma-hosted account path only.
- Bob receives one open payload and one policy object from Roma.
- MiniBob/demo surfaces are Prague/funnel surfaces outside shared Bob account authoring.

**Plan limits:**

- Plan limits are **usage counters** for cost drivers we want bounded in demo/free usage (ex: uploads, Copilot turns, crawls).
- Plan limits are **decided and enforced by the account management plane** (Roma/system account operations) before or during the product mutation that would exceed policy. Storage/serve systems return usage facts and perform technical safety checks. Bob uses the resolved policy for UX gating + upsell messaging.
- Plan limits are defined by the real account policy plus explicit demo-surface gates, not by a fake `minibob` subject profile and not by individual widgets.

**How this appears in widget PRDs (required):**

- PRDs list **which entitlement keys** a widget uses and **how they map** to widget state (paths + metrics).
- Tier values live only in the global matrix: `packages/ck-policy/entitlements.matrix.json`.
- Widget capability metadata lives in `tokyo/product/widgets/{widget}/limits.json` (flags/limits). Plan limits are global and enforced by Roma/system account operations.
- Template: `documentation/widgets/_templates/SubjectPolicyMatrices.md` (no per-widget tier matrices).

**Upsell popup standard (durable):**

- Every rejected plan limit uses the same **Upsell** popup (no per-row copy).
- The system chooses the destination and CTA deterministically:
  - If the viewer has no account/session (Prague demo / anonymous): upsell takes them to **Create Free Account**
  - If the viewer is logged in but blocked by plan/tier: upsell takes them to **Upgrade Plan**
- PRDs do **not** encode "free vs paid" in per-row copy; it is derived from the matrix deltas and current viewer profile.

**Builder boot today:**

- Roma opens Bob through one message payload: `postMessage { type:'ck:open-editor', ... }`.
- Shared Builder core does not accept or switch on `subjectMode`.
- Shared Builder core does not URL-bootstrap account sessions.

**What still matters:**

- Uploads and Copilot remain bounded by server-side policy limit enforcement.
- Widget type creation is bounded by the account policy system-widget path: Roma filters unavailable system widget options and rejects direct create requests that would exceed `widgets.types.max`.
- Monthly public view limits remain a named pre-GA enforcement gap, not a customer-facing active claim. Before GA, public view usage is observed from the serving plane, and over-limit policy plus published-projection correctness is driven by Roma/system account operations.
- Shared Builder carries the Roma account Builder identity.

**Why this scales:**

- The editor stays one product path: account opens widget, Bob edits, Roma saves.
- Demo/funnel surfaces can evolve separately without contaminating the shared Builder core.

### Server-Side Enforcement

Current shipped behavior:

- Account member listing is read-only via `GET /api/account/team` and `GET /api/account/team/members/:memberId` for authorized users.
- Publish and editor behavior use policy/entitlement enforcement already wired in runtime.
- System widget creation uses `widgets.types.max` to hide unavailable create options and reject direct create requests.
- There is no shipped seat-limit write-path enforcement yet.
- There is no shipped `SEAT_LIMIT_EXCEEDED` runtime error yet.
- `views.monthly.max` public embed enforcement is not active runtime behavior until telemetry, management-plane enforcement, and public miss/deny behavior are specified.

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

### Active Account Schema

Active account truth is:

```text
accounts own account/billing/status truth
users own one account association and role
Tokyo owns account instance operations
```

Role truth for active current lives on `users`.

---

## Summary

1. **Viewers are always unlimited** — at every tier, including Free
2. **Viewers can comment** — collaboration without editing
3. **Editor seats are the upgrade lever** — capped in Free/Tier 1, unlimited in Tier 2/3
4. **Instances belong to accounts** — portable, team-owned
5. **No sales call for teams** — self-serve collaboration from day 1

This is the Figma model applied to widgets: make adoption frictionless, let stickiness compound, charge for serious usage.
