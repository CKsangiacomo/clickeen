# PRD — Multitenancy (Workspaces) + Subject Policy System

Status: Superseded. Legacy strategy doc; remaining work is captured in `Execution_Pipeline_Docs/03-Executed/033__PRD__07-14_Remaining_Work_Closeout.md`.
Source of truth: `documentation/`.

Status: Draft (peer review)
Owner: Clickeen core platform
Related docs:
- `documentation/capabilities/multitenancy.md`
- `documentation/services/michael.md`
- `documentation/services/paris.md`
- `documentation/widgets/_templates/SubjectPolicyMatrices.md`

---

## 0) Why this exists (and why now)

We can build more widgets (LogoShowcase, Countdown, …) without full auth/billing, but we **cannot** do it safely without a durable, centralized policy system:

- Widgets must not hardcode MiniBob vs DevStudio vs Free vs Tier 1/2/3 behavior.
- Feature gating must be deterministic and enforced both in UI and ops validation.
- “Unlimited viewers” + seat-limited editors requires a real workspace model in persistence.

This PRD defines the **platform-level contracts** so we don’t drift into widget-specific hacks.

---

## 0.1) Reviewer hardening (required for scale)

To be “scale-flawless” (no scattered `if (tier)`), we must add these platform primitives:

1. **One shared policy engine package** used by Bob + Paris + Venice + San Francisco.
2. **A canonical capability registry** (global keys for flags/caps/budgets + display names + enforcement notes).
3. **A single gate decision API**: `can(policy, actionKey, payload)` → allow/deny + `upsell=UP` + `reasonKey`.
4. **Budgets semantics** (what is a “session”, reset rules, persistence rules).
5. **Enforcement symmetry** across all surfaces (Bob UI/ops, Paris publish, Venice embed behavior).

This PRD specifies these as non-optional contracts.

---

## 1) Goals / non-goals

### Goals (must ship)
1. **Workspace becomes the organizing unit** for instances (Figma model).
2. **Roles**: viewer/editor/admin/owner; viewers unlimited and do not count toward seat caps.
3. **Single policy object** drives:
   - UI gating (UI is visible; actions are gated on interaction via Upsell)
   - ops enforcement (what changes are allowed)
   - budgets (session counters like Copilot turns, uploads)
4. **Paris is enforcement authority** for:
   - membership checks (role)
   - entitlements (tier features + caps)
   - publish authorization (writes to Michael)

### Non-goals (explicitly out of scope for this PRD)
- Full billing implementation (Stripe) and plan purchase flow
- Full invite email flow
- Enterprise SSO
- Comments UI/UX (table may be created; UX can ship later)

---

## 2) Canonical terms

**Workspace**: team container; owns instances and membership.

**Member roles**:
- `viewer`: can view + comment; cannot edit; does not count toward seat caps
- `editor`: can edit/create; counts toward seat caps in Free/Tier 1
- `admin`: editor + manage team (no billing)
- `owner`: admin + billing

**Policy profile**: a resolved runtime profile used by Bob:
- Dev subjects: `devstudio`, `minibob`
- Account tiers: `free`, `tier1`, `tier2`, `tier3`

**Subject mode**: the caller surface (editor-only), already shipped:
- `devstudio` or `minibob`

**Michael**: Supabase Postgres (source of truth).

---

## 2.1) What we explicitly reject from OLD schema


We explicitly reject:
- Widget definition state in DB (`widgets.config`, `widgets.public_key`, etc). Widget software lives in Tokyo.
- Draft-token lifecycle (`widget_instances.status='draft'`, `draft_token`, `claimed_at`, `expires_at`). We are strict: `published|unpublished` only.
- “Everything tables” (plan_features/plan_limits/events/usage_events/embed_tokens/…); those are deferred until a concrete surface requires them.

We only reuse:
- Workspace/member/RLS policy patterns
- Billing separation (if/when we ship billing)

---

## 3) Platform invariants (strict)

1. Widgets are **workspace-owned** (instances belong to a workspace, not to a user).
2. Viewers are **always unlimited**.
3. Editors are the upgrade lever:
   - Free: 1 editor
   - Tier 1: 3–5 editors
   - Tier 2+: unlimited editors
4. Bob makes exactly **2 Paris calls** per editing session:
   - Load instance
   - Publish instance
   No other persistence calls during editing.
5. All gating must be **fail-closed**:
   - If policy is missing → treat as most restricted (or block action with explicit error)
6. No widget-specific “if (minibob)” checks; all branching flows through a single `policy`.
7. Upsell UX is **popup-only** (durable; required across product):
   - We **always show the full entitlement UI** (including “Add …” buttons, gated toggles, and gated inputs).
   - We do **not** hide or disable controls for entitlements/caps/budgets; the gate happens on interaction.
   - Gate trigger: user interaction → `can(...)` / `canConsume(...)` → if denied, open the single Upsell popup (`UP`) and do not mutate state.
   - Ops/publish denials for entitlements/caps/budgets must surface as the same Upsell popup (not toasts/banners), using `reasonKey`.
   - Exception: controls may still be hidden for **relevance** (Type/Layout `show-if`). This is the **only** allowed reason to hide controls; entitlements/caps/budgets must never hide UI.

---

## 3.1) Shared policy engine (single source of truth in code)

We will add a new workspace package:

- `tooling/ck-policy/` (package name: `@clickeen/ck-policy`)

This package must be dependency-free (pure TypeScript) and imported by:
- `bob/` (UI gating + ops validation + budgets)
- `paris/` (authoritative publish validation + entitlements)
- `venice/` (embed-time behavior decisions driven by policy)
- `sanfrancisco/` (AI capability gating + budgets for agent execution)

No policy keys may be invented outside this package.

---

## 3.2) Canonical capability registry (no key drift)

All flags/caps/budgets must be defined as registry entries with stable keys.

Key namespacing (required):
- `platform.*` (global product capabilities)
- `context.*` (shared context inputs used by Copilot/AI)
- `embed.*` (SEO/GEO, embed mode decisions)
- `brand.*` (backlink removal, etc.)
- `workspace.*` (seats, membership)
- `widget.<widgetType>.*` (widget-specific caps/features)

Examples (illustrative; keys must live in the registry):
- `seoGeo.enabled`
- `context.websiteUrl.enabled`
- `brand.removeBacklink.enabled`
- `workspace.editors.max`
- `widget.faq.sections.max`
- `widget.logoshowcase.logoLinks.enabled`

### 3.2.1 Capability keys vs stored values (do not mix)

Capability keys answer **“is this allowed?”**.
Stored values answer **“what is the value?”**.

Rule:
- **Capability keys** always end in `.enabled` (or are explicit caps/budgets/actions).
- **Values** live in the state tree or workspace settings, and are addressed by state paths/columns.

Example: Website URL (Copilot context)
- Capability key (gating): `context.websiteUrl.enabled`
- Stored value (workspace setting): `workspaces.website_url` (or `workspace.websiteUrl` in API payloads)

Example: SEO/GEO optimization
- Capability key (gating): `seoGeo.enabled`
- Stored value (instance config): `seoGeo.enabled`

Bob/Paris/Venice/SF must never treat state paths as capability keys.

Registry entry shape (v1):
```ts
type CapabilityKind = 'flag' | 'cap' | 'budget' | 'action';

type Capability = {
  key: string; // canonical
  kind: CapabilityKind;
  labelKey: string; // i18n key for UI
  descriptionKey?: string; // i18n key (optional)
  enforcement: 'ui' | 'ops' | 'paris' | 'venice' | 'sf' | 'multi';
};
```

### 3.2.2 Typed keys (prevent drift at compile time)

`tooling/ck-policy` must export string-literal unions derived from the registry:
- `CapabilityKey`
- `FlagKey`
- `CapKey`
- `BudgetKey`
- `ActionKey`

This prevents key invention across packages (Bob/Paris/Venice/SF) even if runtime storage is JSON.

---

## 3.3) Gate decision API (single contract everywhere)

Every gated decision must call one shared function:

```ts
import type { ActionKey, BudgetKey } from '@clickeen/ck-policy';

type GateDecision =
  | { allow: true }
  | { allow: false; upsell: 'UP'; reasonKey: string; detail?: string };

function can(policy: Policy, actionKey: ActionKey, payload?: unknown): GateDecision;
```

Properties:
- `actionKey` must come from the registry (`kind: 'action'`).
- If denied, `upsell` is always `UP` (system chooses “Create account” vs “Upgrade”).
- `reasonKey` is an i18n key (fail-visible + globally consistent) and must come from a shared set (no ad-hoc strings in Bob/Paris/Venice/SF).
- UI binding (durable): in editor surfaces (Bob/DevStudio/MiniBob), any deny (`allow:false` / `ok:false`) must open the same Upsell popup (`UP`). No entitlement-driven disables/hides.

Mental model (required to avoid “two ways to gate” drift):
- UI interactions call `can(policy, '<actionKey>', payload)` where `<actionKey>` is one of the `ActionKey` union values (e.g. `widget.faq.qa.add`, `embed.seoGeo.toggle`, `instance.publish`).
- `can(...)` is the single choke point that checks role + flags + caps (and calls `canConsume(...)` when budgets apply).
- UI must not implement cap logic directly (no “if used >= max then …”). Caps live inside policy and are enforced by `can(...)`.

Budgets:
```ts
type BudgetDecision =
  | { ok: true; nextUsed: number }
  | { ok: false; upsell: 'UP'; reasonKey: string };

function canConsume(policy: Policy, budgetKey: BudgetKey, amount?: number): BudgetDecision;
function consume(policy: Policy, budgetKey: BudgetKey, amount?: number): Policy;
```

### 3.3.1 Required `ActionKey`s (v1 minimum)

To prevent drift, we explicitly enumerate the minimum required action keys that must exist in the registry and be used everywhere:

- `instance.create`
- `instance.publish`
- `context.websiteUrl.set`
- `embed.seoGeo.toggle`
- `platform.upload`
- `widget.faq.section.add`
- `widget.faq.qa.add`

Rule: Widget-specific interactions must be expressed as widget-scoped action keys (e.g. `widget.<widgetType>.<noun>.<verb>`) rather than generic “action.addItem”.

### 3.3.2 Budgets semantics (v1)

Budgets are a **sales** primitive (MiniBob demo limits), not a persistence primitive.

V1 semantics (strict):
- A “session” = a single editor page-load lifecycle (Load → user edits → Publish or exit).
- Budgets are tracked in Bob memory only (not persisted to DB in v1).
- Reset rules: budgets reset when the user reloads the editor (new session).
- MiniBob: budgets are small and enforced aggressively; deny triggers Upsell popup.
- DevStudio: budgets are unlimited.
- Logged-in Bob (real workspaces): budgets are treated as unlimited in v1 unless a PRD explicitly defines a non-infinite budget.

Required `BudgetKey`s (v1 minimum):
- `platform.uploads.files` (count of upload interactions per session)

---

## 4) Data model (Michael / Supabase)

Current reality (`supabase/migrations/20251228000000__base.sql`) defines only `widgets` + `widget_instances`.
To support multitenancy, we add workspace tables and attach instances to workspaces.

### 4.1 Tables (minimum)

#### `public.workspaces`
Required columns:
- `id uuid primary key default gen_random_uuid()`
- `tier text not null check (tier in ('free','tier1','tier2','tier3'))`
- `name text not null`
- `website_url text` (nullable; gated by `context.websiteUrl.enabled`)
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Recommended:
- `slug text unique` (for URLs; optional to ship)
- `billing_email text` (owner-managed; optional to ship)

#### `public.workspace_members`
- `workspace_id uuid not null references public.workspaces(id) on delete cascade`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `role text not null check (role in ('owner','admin','editor','viewer'))`
- `joined_at timestamptz not null default now()`
- `primary key (workspace_id, user_id)`

#### `public.widget_instances` (modify existing)
Add:
- `workspace_id uuid not null references public.workspaces(id) on delete cascade`
- index: `(workspace_id, updated_at desc)`

Keep existing invariants:
- `public_id` taxonomy stays canonical
- `config` must be a json object
- `status` is `published|unpublished`

#### Optional now / likely soon: `public.comments`
(If we want the schema ready for “viewer comment moat” without shipping full UI)

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null references public.workspaces(id) on delete cascade`
- `widget_instance_id uuid not null references public.widget_instances(id) on delete cascade`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `text text not null`
- `target_path text` (nullable)
- `resolved boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### 4.2 RLS (production-grade)

RLS is required to prevent direct-client access leaks. Even if Paris uses service role, RLS protects against future accidental exposures.

**Workspaces**
- Select: members can read their workspace
- Update: owner/admin only

**Workspace members**
- Select: members can read membership list
- Insert/Delete/Update role: owner/admin only

**Widget instances**
- Select:
  - members can read all instance rows for their workspace
  - embed/runtime should be public-read for `published` instances via Venice (Venice should *not* call Supabase directly; it calls Paris)
- Insert/Update/Delete: editor/admin/owner only

---

## 5) Paris API (authoritative enforcement)

### 5.1 Auth model

Current repo uses `PARIS_DEV_JWT` (dev-only). For real workspaces:
- Bob sends Supabase Auth access token (JWT) to Paris.
- Paris validates JWT and resolves `user_id` + membership.
- Paris performs DB writes with service role but **must enforce membership/entitlements** before write.

Hard rule (unchanged):
- `PARIS_DEV_JWT` must never be present in Cloudflare Pages production env vars.

### 5.2 Instance endpoints (workspace-aware)

We need a workspace-aware contract for `GET/PUT instance`.
Recommended endpoints (explicit and greppable):

- `POST /api/workspaces/:workspaceId/instances` (create/clone; returns new instance snapshot)
- `GET /api/workspaces/:workspaceId/instance/:publicId`
- `PUT /api/workspaces/:workspaceId/instance/:publicId`
- `GET /api/workspaces/:workspaceId/instances` (list)

Response shape stays identical to current Phase-1 instance payload:
```json
{
  "publicId": "wgt_faq_u_4f8k2m1x",
  "status": "published",
  "widgetType": "faq",
  "config": {},
  "updatedAt": "..."
}
```

### 5.2.1 Embed read endpoint (Venice contract; not workspace-scoped)

Venice embed and Shadow DOM render paths load instances by `publicId` only and do not know `workspaceId`.
Therefore, Paris must expose a non-workspace-scoped **read** endpoint used by Venice:

- `GET /api/instance/:publicId` (Venice only; embed/preview)

Rules:
- This endpoint returns the instance snapshot needed for embed/render and MUST NOT return editor policy.
- Published instances are readable by Venice without user membership.
- Unpublished instances are readable only in dev subjects (DevStudio/MiniBob) or with editor auth (implementation detail; enforced in Paris).
- Editor surfaces (Bob) must not use this endpoint for editing flows; they use workspace-scoped endpoints.

### 5.2.2 Where `workspaceId` comes from (v1 mechanisms)

We must not introduce extra Paris calls into the editor hot loop. Therefore, `workspaceId` must be known **before** the editor performs its Load call.

V1 mechanisms (explicit):
- **Real Bob (logged in):** editor routes are workspace-scoped and include `workspaceId` in the URL (e.g. `/bob/workspaces/:workspaceId/instance/:publicId`). Workspace selection (and any list calls) happens outside the editor session.
- **DevStudio tooling (dev):** uses a single default dev workspace id configured by env var (e.g. `VITE_CK_DEV_WORKSPACE_ID`) and always calls workspace-scoped endpoints.
- **Prague MiniBob (dev):** uses a single default demo workspace id configured at build time (Astro `PUBLIC_CK_DEMO_WORKSPACE_ID`) and loads the demo instance from that workspace.

Hard rule: do not add a “resolve publicId → workspaceId” Paris endpoint for the editor; that would violate the 2-call pattern.

### 5.3 Enforcement rules (minimum)

At publish time (`PUT`):
1. caller must be `editor|admin|owner`
2. instance must belong to `workspaceId`
3. tier entitlements enforced:
   - feature flags (SEO/GEO, Supernova, auto-translate)
   - caps (instances, widget types, content caps)
4. config must pass strict persistence rules (no `data:`/`blob:` persisted)

### 5.3.1 Error contract (required for deterministic UX)

Paris must return a standard error shape so Bob can deterministically choose:
- Upsell popup (`UP`) for entitlements/caps/budgets/roles, vs
- Strict validation errors for “you must fix the data” issues (e.g. non-persistable values), vs
- Generic auth/server errors.

Required response shape:
```json
{
  "error": {
    "kind": "DENY" | "VALIDATION" | "AUTH" | "NOT_FOUND" | "INTERNAL",
    "reasonKey": "coreui.errors.…",
    "upsell": "UP",
    "detail": "optional debug string",
    "paths": ["optional.state.path", "another.path"]
  }
}
```

Rules:
- `kind: "DENY"` MUST include `upsell: "UP"` and is always surfaced via the Upsell popup.
- `kind: "VALIDATION"` MUST NOT include `upsell` and is surfaced as a strict publish error (no mutation).
- `paths[]` is required for non-persistable value rejections (`data:`/`blob:`) so Bob can point to the offending controls.

---

## 5.4 Policy returned on Load (no extra calls)

Bob must not compute entitlements locally. To keep the **2-call pattern** intact, Paris returns the resolved policy alongside the instance payload during **Load**.

New Load response (v1):
```json
{
  "publicId": "wgt_main_faq",
  "status": "unpublished",
  "widgetType": "faq",
  "config": {},
  "updatedAt": "...",
  "policy": {
    "profile": "tier1",
    "role": "editor",
    "flags": {
      "seoGeo.enabled": true,
      "context.websiteUrl.enabled": true,
      "platform.uploads.enabled": true
    },
    "caps": {
      "workspace.editors.max": 3,
      "workspace.instances.max": 10,
      "workspace.widgetTypes.max": null
    },
    "budgets": {
      "platform.uploads.files": { "max": null, "used": 0 }
    }
  }
}
```

Bob caches this in memory for the editing session and uses it for:
- UI gating
- ops validation
- budgets (consume locally; publish enforces authoritatively)

## 6) Bob policy system (single object)

### 6.1 Resolved policy shape (v1)

```ts
import type { FlagKey, CapKey, BudgetKey } from '@clickeen/ck-policy';

type PolicyProfile = 'devstudio' | 'minibob' | 'free' | 'tier1' | 'tier2' | 'tier3';
type Role = 'viewer' | 'editor' | 'admin' | 'owner';

type Policy = {
  profile: PolicyProfile;
  role: Role;
  // Policy is TOTAL (all keys present). Missing keys are a contract violation.
  // Unlimited is represented as `null` (JSON-safe).
  flags: Record<FlagKey, boolean>;
  caps: Record<CapKey, number | null>;
  budgets: Record<BudgetKey, { max: number | null; used: number }>;
};
```

### 6.2 Resolution rules

- In DevStudio iframe tooling:
  - `profile=devstudio` (everything enabled)
- In Prague MiniBob:
  - `profile=minibob` (most restricted demo)
- In real Bob (logged in):
  - Paris resolves `profile` from `workspaces.tier` and `role` from `workspace_members.role` and returns the total `policy` on Load.

Non-negotiable: Bob must **never** compute tier policy locally. It only consumes the `policy` returned by Paris on Load (except for fixed dev subjects `devstudio|minibob`).

### 6.3 Enforcement locations

1. **UI gating** (entitlements): controls are visible, but gated actions open the Upsell popup.
   - Example: user is at `maxLogosPerStrip`; “Add logo” remains visible; clicking it triggers Upsell.
2. **Ops validation**: before applying ops, reject disallowed mutations with explicit errors (fail-closed).
   - If a control is gated and an op still arrives (Copilot/import/manual), reject and surface Upsell.
3. **Budgets**: session counters decremented in one place; exhaustion triggers Upsell.
4. **Publish enforcement** (Paris): if publish is rejected for entitlements/caps/budgets, Bob must surface the same Upsell popup (`UP`) using the returned `reasonKey` (not a raw error toast).

---

## 7) Tier entitlements and caps (minimum set)

We should treat entitlements as a platform matrix, not widget-specific logic.

Minimum v1 policy keys:

Flags (allowed?):
- `seoGeo.enabled` (tier1+; gates the instance field `seoGeo.enabled`)
- `context.websiteUrl.enabled` (Free+; blocked in MiniBob; gates workspace setting `workspaces.website_url`)
- `platform.uploads.enabled` (enabled everywhere in v1; paired with budgets in MiniBob)

Caps (hard limits; enforced in `can(...)` and on publish where applicable):
- `workspace.editors.max` (Free/Tier1; Tier2+ = `null`)
- `workspace.instances.max` (Free/Tier1; Tier2+ = `null`)
- `workspace.widgetTypes.max` (Free; Tier1+ = `null`)

Budgets (sales limits; per-session in v1):
- `platform.uploads.files` (MiniBob limited; DevStudio/Tier = `null`)

Instance caps (Free/Tier1) should count only **user instances**:
`public_id like 'wgt_%_u_%'` (curated + baseline use `wgt_curated_*` / `wgt_main_*`).

### 7.1 Code-first entitlements (v1; no entitlement tables)

We reject “everything tables” for v1. That only works if entitlements are explicitly **code-first**:
- DB stores: `workspaces.tier` and membership roles.
- Code (shared policy engine) defines: `tier → policy(flags/caps/budgets)` mapping.
- Paris is authoritative on publish; Bob consumes policy on load.

We do not ship `plan_features`/`plan_limits` tables in v1.

Future-proofing rule (durable):
- If/when we add billing + plan tables, the only thing that changes is the **source** of tier/entitlements; the resolved `Policy` shape, registry keys, and `can(...)` contract must remain identical everywhere.

---

## 8) Migration strategy (no legacy/back-compat)

We are strict: no “maybe null workspace” rows, no silent fallbacks.

Migration steps:
1. Create `workspaces`, `workspace_members` (and optionally `comments`).
2. Add `workspace_id` to `widget_instances` (NOT NULL).
3. Create a single “dev workspace” row and backfill all existing instances to it.
4. Add constraints + indexes.
5. Update Paris to require `workspaceId` on instance APIs (new endpoints).
6. Update Bob + Prague + DevStudio bootstrap to supply `workspaceId` (see `5.2.2 Where workspaceId comes from` for the explicit v1 mechanism per surface).

Note: this requires updating `documentation/services/michael.md` because it currently claims “no workspaces”.

---

## 9) Acceptance criteria

1. Bob can load + publish instance inside a workspace using 2-call pattern.
2. Entitlement UI is always visible; gating happens on interaction via the single Upsell popup (`UP`) with `reasonKey` (no entitlement-driven hides/disables).
3. Viewer cannot publish or edit; actions are denied deterministically and ops are rejected.
4. MiniBob cannot enable SEO/GEO; action is blocked with deterministic error + upsell path.
5. Free tier enforcement:
   - cannot exceed editor seat cap
   - cannot create >1 user instance (or configured cap)
6. Tier 1+ enables SEO/GEO toggle and persists correctly.
7. No direct client writes to Supabase tables (RLS + Paris enforcement).

---

## 10) Open decisions (need explicit yes/no)

Decisions (locked):
1. Expand Michael now: **YES**.
2. Workspace-aware endpoints now: **YES**.
3. Comments table now: **YES (provision DB + RLS now; ship UX/API later)**.
4. Shared policy engine package: **YES (`tooling/ck-policy`)**.
   - Package name: `@clickeen/ck-policy`
   - Requires adding `tooling/ck-policy` to `pnpm-workspace.yaml`.
5. Policy authority in Bob: **YES (Bob receives `policy` from Paris on Load; no local tier logic)**.
