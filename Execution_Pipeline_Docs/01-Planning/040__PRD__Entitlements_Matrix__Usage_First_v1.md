# PRD 40 — Entitlements Matrix v2 (Usage‑First Packaging + Cost Control)

**Status:** `01-Planning` (peer review)  
**Date:** 2026-02-02  
**Owner:** Product Dev Team (AI) + Human Architect  
**Impacted systems:** `config/entitlements.matrix.json`, `tooling/ck-policy`, Paris, Bob, Venice, Tokyo widgets (`limits.json`)

---

## 0) One‑sentence summary

Move Clickeen’s monetization model from “feature flags everywhere” to “usage‑first caps + budgets”, so **every tier can see/try everything** while we stay in control of **unit economics** and abuse.

---

## 1) Context / Why we are doing this

### The current problem
Today’s entitlements matrix (`config/entitlements.matrix.json`) is heavily biased toward **flags** (feature on/off) and includes many **micro caps** (text lengths, internal list shapes). This creates three issues:

1) **Wrong upsell mechanism**
- We want the upsell to be “how much you can use”, not “you can’t even see the feature”.
- Feature gating prevents activation, reduces time‑to‑value, and lowers upgrade intent.

2) **Costs are not controlled at the right layer**
- Our real cost drivers are *throughput* and *frequency*: views, refreshes, crawls, renders, uploads, and AI turns.
- Many existing entitlements don’t materially change cost or packaging (e.g., per‑field text length caps).

3) **Complexity explodes across the whole system**
- Flags and widget‑specific micro caps multiply states across Bob (editor), Venice (embed), Paris (policy enforcement), Tokyo‑worker (snapshots/l10n).
- This creates inconsistent enforcement, more edge cases, and a slower product loop.

### Advisor principle (translated to Clickeen)
Entitlements should express:
- **Economic drivers** (things that cost us money or can be abused), and/or
- **User‑visible packaging** (what the user can publish/scale).

If a constraint is a safety/validation limit that **no tier should exceed**, it is **not** an entitlement; it should live in **schema validation** or **compiler/UI constraints**.

---

## 2) Product principles (non‑negotiable for this PRD)

1) **Everything is visible (Free is not “broken”)**
- Free users can see and interact with the same feature set.
- Limits are expressed as “you can do it, but only up to X”.

2) **Monetize on scale, not access**
- Tiers change volume (caps) and throughput (budgets), not visibility.

3) **Cost control must map to real cost drivers**
- If we can’t point to a concrete compute/storage/refresh cost, it shouldn’t be in the tier matrix.

4) **Frozen Billboard is the enforcement pattern for view caps**
- For capped tiers (Free + Tier1), when they exceed `views.monthly.max`, the widget remains visible but becomes “frozen” (snapshot, EN‑only, upgrade overlay).

### 2.1 Explicit non‑goals (to keep scope tight)

- We are **not** finalizing pricing; tier values in this PRD are **defaults for v1** and are expected to be tuned.
- We are **not** introducing widget‑specific micro‑caps in the global matrix (except where a cap is genuinely connector‑unique).
- We are **not** changing tier names/profiles (`devstudio`, `minibob`, `free`, `tier1`, `tier2`, `tier3`) in this iteration.
- We are **not** adding new feature surfaces; this PRD only repackages existing/near‑term capabilities into a cleaner entitlement model.

---

## 3) Definitions (how the system interprets the matrix)

### Tiers (profiles)
The matrix must keep these profiles (existing contract):
`devstudio`, `minibob`, `free`, `tier1`, `tier2`, `tier3`

### Entitlement kinds
- **Flag** (`boolean`): “permission to exist” — should be rare.
- **Cap** (`number | null`): steady‑state maximum (“how much you can have”). `null` = unlimited.
- **Budget** (`number | null`): monthly (billing period) quota (“how much you can spend”). `null` = unlimited.

### Not an entitlement: schema constraints
A **schema constraint** is a hard product invariant (safety/validation) that applies to *all* tiers:
- It lives in `tokyo/widgets/*/spec.json` (schema) and/or Bob input constraints.
- It does **not** belong in `config/entitlements.matrix.json`.

### “Visible to all” vs “available at scale”
- “Visible to all” means the UI and runtime behaviors exist for every tier (including Free).
- “Available at scale” is where tiers differ: caps/budgets define *how much* the user can do before they hit an upgrade wall.

### Period alignment (important)
For v2, budgets/caps that are “monthly” should align to the same period used by metering enforcement:
- Current implementation for views uses a UTC month key (e.g. `YYYY-MM`) and resets at next month UTC boundary.
- If we later align to workspace billing cycles, we must update all monthly budgets/caps together (single source of truth).

---

## 4) Proposed design

### 4.0 Baseline product behavior (always on; not tiered)
These capabilities should be **available to every tier** (including Free). They are *not* pricing levers; we monetize on **scale**.

- **SEO/GEO output**: indexable embeds (schema + excerpt) are on by default (no `seoGeo.enabled` gating).
- **Localization UI**: localization is visible and usable for everyone; tiers differ by locale counts and publish budgets.
- **Personalization sources**: GBP/Facebook/Website are connectable by everyone; tiers differ by crawl depth and budgets.
- **Rich text links + media metadata**: allowed by default; security is handled by schema/compiler/runtime, not entitlements.
- **Website URL context**: always allowed (it helps personalization and does not increase unit cost on its own).

### 4.1 Minimize flags (only true binary packaging)
We keep only one true tier flag:
- `branding.remove` (Tier2+ can remove branding; otherwise branding must be present)

Everything else moves to caps/budgets or becomes non‑tiered validation.

### 4.2 Replace widget‑specific list caps with cap groups
We introduce generic cap groups:
- `cap.group.items.small.max`
- `cap.group.items.medium.max`
- `cap.group.items.large.max`

Widgets bind their “items” fields to a cap group in their `limits.json`.  
This keeps the matrix 10× simpler while keeping binding explicit and intentional.

### 4.3 Move “text length” and “HTML length” out of entitlements
The following current entitlements are **schema constraints**, not pricing knobs:
- `text.question.max`, `text.answer.max`, `text.caption.max`, `text.headerHtml.max`

They should move into:
- widget `spec.json` validation (`maxLength`), and/or
- compiler/UI constraints (hard limits).

All tiers share the same limits.

### 4.4 Localization packaging: always on, capped by tier
Localization is always available; tiers control *scale*:

- **Free**
  - Always includes `en`
  - Adds exactly **one** additional locale, chosen automatically from GEO/market
  - No locale picker
- **Tier1**
  - Always includes `en`
  - Allows choosing **3** additional locales (total = 4)
- **Tier2+**
  - Unlimited locales

Why this works:
- Every user experiences “Clickeen supports my language” immediately (activation).
- Free still has a hard, explainable limit (“EN + your market language”) that naturally drives upgrade intent.
- Costs scale with locale count (storage + overlay fetch), so the cap is an honest unit‑economics lever.

This requires two caps:
- `l10n.locales.max` (total locales, including `en`)
- `l10n.locales.custom.max` (how many non‑EN locales user can choose)

### 4.5 Personalization sources: always allowed, metered by usage
Personalization sources (GBP, Facebook, website) are **always connectable**.
Cost control comes from:
- crawl depth caps, and/or
- budgets for crawls/runs per month.

---

## 5) The new matrix (peer‑reviewable tables)

Legend:
- `∞` means unlimited (represented as `null` in `entitlements.matrix.json` for caps/budgets)
- Budgets are **monthly** unless specified otherwise

### 5.1 Flags (minimal)

| Capability | Token | Devstudio | Minibob | Free | Tier1 | Tier2 | Tier3 |
|---|---|---:|---:|---:|---:|---:|---:|
| Remove Clickeen branding | `branding.remove` | ✓ | × | × | × | ✓ | ✓ |

### 5.2 Caps (packaging + steady‑state limits)

| Capability | Token | Devstudio | Minibob | Free | Tier1 | Tier2 | Tier3 |
|---|---|---:|---:|---:|---:|---:|---:|
| Published widgets max | `instances.published.max` | ∞ | 0 | 1 | 1 | 5 | ∞ |
| Monthly views cap (freeze on exceed) | `views.monthly.max` | ∞ | ∞ | 10,000 | 100,000 | ∞ | ∞ |
| Locales per widget (total incl. EN) | `l10n.locales.max` | ∞ | 0 | 2 | 4 | ∞ | ∞ |
| Custom locales (user‑selectable, excl. EN) | `l10n.locales.custom.max` | ∞ | 0 | 0 | 3 | ∞ | ∞ |
| Overlay versions retained | `l10n.versions.max` | ∞ | 0 | 1 | 3 | 10 | 10 |
| Website crawl depth | `personalization.sources.website.depth.max` | ∞ | 1 | 1 | 2 | 3 | 5 |
| Upload size max (per file) | `uploads.size.max` | 100MB | 5MB | 10MB | 25MB | 100MB | 250MB |
| Items cap group (small) | `cap.group.items.small.max` | ∞ | 5 | 5 | 10 | 25 | ∞ |
| Items cap group (medium) | `cap.group.items.medium.max` | ∞ | 10 | 10 | 25 | 50 | ∞ |
| Items cap group (large) | `cap.group.items.large.max` | ∞ | 25 | 25 | 50 | 100 | ∞ |

### 5.3 Budgets (primary cost control)

| Capability | Token | Devstudio | Minibob | Free | Tier1 | Tier2 | Tier3 |
|---|---|---:|---:|---:|---:|---:|---:|
| Copilot turns / month | `budget.copilot.turns` | ∞ | 4 | 20 | 100 | 300 | ∞ |
| Uploads / month (count) | `budget.uploads.count` | ∞ | 5 | 10 | 50 | 200 | ∞ |
| Personalization runs / month | `budget.personalization.runs` | ∞ | 10 | 20 | 100 | 300 | ∞ |
| Website crawls / month | `budget.personalization.website.crawls` | ∞ | 5 | 10 | 30 | 100 | ∞ |
| Snapshot regenerations / month | `budget.snapshots.regens` | ∞ | 10 | 20 | 100 | 300 | ∞ |
| L10n publish operations / month | `budget.l10n.publishes` | ∞ | 10 | 20 | 100 | 300 | ∞ |

### 5.4 Token reference (semantics + enforcement)
This table is the “contract” engineers implement against. If a token can’t be tied to a real cost driver or user‑visible packaging, it shouldn’t be here.

| Token | Kind | User‑visible meaning | Primary cost driver | Enforced in | When exceeded |
|---|---|---|---|---|---|
| `branding.remove` | flag | Can remove Clickeen backlink/branding on public embeds | Acquisition (not cost) | Venice runtime + publish enforcement | Force backlink on (no silent removal) |
| `instances.published.max` | cap | How many published widgets a workspace can have at once | Snapshot storage + support load | Paris publish + Bob UI | Block publish; offer “unpublish or upgrade” |
| `views.monthly.max` | cap | Monthly public embed views for Free/Tier1 | CDN/edge + rendering + abuse vector | Venice runtime (freeze), Paris usage counters | Freeze to snapshot + upgrade overlay (“Frozen Billboard”) |
| `l10n.locales.max` | cap | Total locales per widget (incl. `en`) | Overlay fetch + storage + ops | Bob UI + Paris locale endpoints | Prevent adding more locales; upsell |
| `l10n.locales.custom.max` | cap | User‑selectable locales (excl. `en`) | Overlay fetch + storage + ops | Bob UI + Paris locale endpoints | Free shows EN+GEO only; Tier1 caps chooser |
| `l10n.versions.max` | cap | Versions retained for overlays | Storage + debugging overhead | Paris (persist) | Drop/GC old versions; do not block core publish |
| `personalization.sources.website.depth.max` | cap | Crawl depth allowed for website personalization | Crawl compute + storage | Paris personalization jobs | Clamp depth; explain upgrade |
| `uploads.size.max` | cap | Max file size per upload | Storage + bandwidth | Paris upload endpoint + Bob preflight | Reject upload; show size limit + upgrade |
| `cap.group.items.small.max` | cap | Generic “small list” max (bound by widget spec) | Rendering + payload size | Bob + Paris publish (via limits.json) | Sanitize/reject extra items; upsell |
| `cap.group.items.medium.max` | cap | Generic “medium list” max (bound by widget spec) | Rendering + payload size | Bob + Paris publish (via limits.json) | Sanitize/reject extra items; upsell |
| `cap.group.items.large.max` | cap | Generic “large list” max (bound by widget spec) | Rendering + payload size | Bob + Paris publish (via limits.json) | Sanitize/reject extra items; upsell |
| `budget.copilot.turns` | budget | Monthly AI assistant turns | AI compute | Paris (metered) + Bob UX | Block turn; “Upgrade for more turns” |
| `budget.uploads.count` | budget | Monthly number of uploads | Storage + bandwidth | Paris (metered) | Block upload after budget; upgrade CTA |
| `budget.personalization.runs` | budget | Monthly personalization “generate/improve” actions | AI compute + connector calls | Paris (metered) | Block run; downgrade to manual |
| `budget.personalization.website.crawls` | budget | Monthly website crawls | Crawl compute | Paris (metered) | Block crawl; reuse last crawl; upgrade CTA |
| `budget.snapshots.regens` | budget | Monthly snapshot regenerations (publish/update) | Rendering compute + storage | Tokyo‑worker/Paris (metered) | Reuse last snapshot; mark “stale”; upgrade CTA |
| `budget.l10n.publishes` | budget | Monthly l10n publish ops | Overlay compute + storage | Paris (metered) | Block publish of new locales; keep existing |

---

## 6) “How it works” (system behavior)

### 6.1 Policy resolution contract (unchanged)
1) `config/entitlements.matrix.json` is the source of tier values.
2) `tooling/ck-policy` loads the matrix and resolves a `policy` for `{ profile, role }`.
3) Paris attaches `policy` to instance responses consumed by Bob and Venice.

### 6.2 Enforcement layers (where each lever is enforced)

**Caps**
- Editor‑time: Bob blocks/sanitizes configuration to comply with caps.
- Publish‑time: Paris rejects publish if the workspace exceeds caps (e.g., published instances limit).
- Runtime: Venice uses caps (views cap) indirectly via PRD37 enforcement state + snapshots.

**Budgets**
- Server‑side only (Paris) with HMAC‑signed events from Venice/Bob where needed.
- Budgets are never enforced from the browser directly.

### 6.3 Frozen Billboard (views cap) interaction with l10n
- Free/Tier1 exceed `views.monthly.max` → instance enters enforcement state `mode=frozen`.
- Venice serves **frozen snapshot** (static, cached) and injects upgrade overlay.
- Frozen snapshots are **EN only** (no locale overlays) to minimize cost and keep behavior deterministic.

Why EN‑only is correct:
- It removes overlay fetch/compute at the exact moment the account is “over budget”.
- It makes frozen delivery purely static/CDN‑cacheable (lowest possible unit cost).
- It avoids confusing states (“why is my locale stale but English changed?”) and keeps the upgrade incentive clear.

### 6.4 UX rules in Bob (the “show everything, monetize on scale” pattern)

- **Nothing disappears**: features remain visible in UI for Free; when a user hits a cap/budget, the action becomes “upgrade to continue”.
- **Localization packaging**
  - Free: shows `en` + GEO locale (auto). Locale picker is present but disabled with “Upgrade to choose locales”.
  - Tier1: `en` fixed + 3 selectable locales.
  - Tier2+: unlimited.
- **Frozen instances** (views cap exceeded)
  - Widget remains viewable in dashboard.
  - Editing actions that would increase cost are blocked (edit/publish/duplicate) with an upgrade path.
  - Unpublish remains allowed (user control).

---

## 7) Implementation plan (what we need to change in code)

### 7.1 Update the matrix + typed registry (required)
Files:
- `config/entitlements.matrix.json`
- `tooling/ck-policy/src/registry.ts`

Actions:
1) Remove legacy keys that are no longer entitlements:
   - `seoGeo.enabled`
   - `l10n.enabled`
   - `l10n.layer.*.enabled`
   - `personalization.*.enabled`
   - `personalization.sources.(gbp|facebook).enabled`
   - `context.websiteUrl.enabled`, `links.enabled`, `media.meta.enabled`
   - `list.*` and `text.*`
   - legacy budgets (`budget.uploads`, `budget.edits`) replaced by explicit keys
2) Add new keys:
   - `l10n.locales.custom.max`
   - `personalization.sources.website.depth.max` (rename from `.depth`)
   - `uploads.size.max`
   - `cap.group.items.{small,medium,large}.max`
   - `budget.uploads.count`
   - `budget.personalization.runs`
   - `budget.personalization.website.crawls`
   - `budget.snapshots.regens`
   - `budget.l10n.publishes`

### 7.2 Update widget `limits.json` bindings (required)
Files:
- `tokyo/widgets/*/limits.json`

Actions:
- Replace `list.*` keys with cap group keys.
- Remove per‑tier gating for `links.enabled` and `media.meta.enabled`:
  - links/media become allowed for all tiers (enforced via validation/sanitization, not entitlements).
- Remove per‑tier gating for `seoGeo.enabled`:
  - SEO/GEO becomes a user setting, not a tier permission.
- Keep `branding.remove` enforcement (already used to force backlink for non‑entitled tiers).

### 7.3 Move text/html length to schema validation (required)
Files:
- `tokyo/widgets/*/spec.json` (schema)
- (optional) Bob UI constraints for inputs

Actions:
- Add/confirm `maxLength` constraints in widget schema for all text fields.
- Remove reliance on `text.*` entitlements entirely.

### 7.4 Update Paris logic that currently depends on removed flags (required)
Files (examples; exact call sites will be updated during execution):
- `paris/src/domains/l10n/index.ts` (remove `requirePolicyFlag(policy, 'l10n.enabled')` and layer flags)
- `paris/src/domains/workspaces/index.ts` (locales selection should no longer be blocked by `l10n.enabled`)
- `paris/src/domains/usage/index.ts` (locale resolution should use caps, not `l10n.enabled`)

### 7.5 Update Bob UI that currently depends on removed flags (required)
Files:
- `bob/components/LocalizationControls.tsx` (and any other policy‑flag checks)

Actions:
- Always render localization UI.
- Enforce:
  - Free: show EN + GEO locale (read‑only; no picker)
  - Tier1: EN fixed + up to 3 user‑selectable locales
  - Tier2+: unlimited
- Ensure UI communicates:
  - “EN is always included”
  - “Upgrade to add more locales”

### 7.6 Budgets instrumentation + enforcement (phased)
We already have a signed, server‑side usage event pattern (`/api/usage`) for views.

Phase 1 (v2 matrix only):
- Add budget keys and wire them into policy (no enforcement yet) so UI can display packaging.

Phase 2 (enforcement):
- Extend signed usage events to cover:
  - personalization runs
  - website crawls
  - snapshot regenerations (triggered by publish/update)
  - l10n publish ops
- Store counters in KV (cheap) keyed by `{periodKey, workspaceId}` (or `{publicId}` where appropriate).
- Enforce budgets in Paris endpoints that trigger expensive work (deny or degrade with clear upgrade messaging).

### 7.7 Migration mapping (old → new)
This is the critical peer‑review section: it shows how we delete complexity without losing enforcement precision.

| Current token (v1) | Replace with (v2) | Rationale |
|---|---|---|
| `seoGeo.enabled` | Baseline always on | Not a meaningful cost driver; activation win |
| `l10n.enabled` | Baseline always on + `l10n.locales.max` | Tier on scale, not visibility |
| `l10n.layer.*.enabled` | Baseline always on (UI visible) + future “segment budgets” if needed | Avoid flag explosion; replace with meaningful scale levers |
| `personalization.preview.enabled` | Baseline always on | Preview is activation, not cost |
| `personalization.onboarding.enabled` | Baseline always on | Onboarding is activation; control cost via budgets |
| `personalization.sources.gbp.enabled` / `personalization.sources.facebook.enabled` | Baseline always on + budgets (future) | “Why block users from giving us data?” |
| `context.websiteUrl.enabled` | Baseline always on | Low/no incremental cost; improves personalization |
| `links.enabled` / `media.meta.enabled` | Baseline always on + sanitization | Not tier packaging; security handled elsewhere |
| `list.*` | `cap.group.items.{small,medium,large}.max` | Stop widget‑specific micro caps in matrix |
| `text.*` | Schema constraints in `spec.json` | Safety/validation; not tier differentiation |
| `budget.edits` | Fold into `budget.copilot.turns` (or replace with explicit v2 key) | One AI budget primitive is easier to reason about |
| `budget.uploads` | `budget.uploads.count` + `uploads.size.max` | Split count vs size (real cost drivers) |
| `views.monthly.max` | Keep | Direct cost + abuse driver; supports Frozen Billboard |
| `instances.published.max` | Keep | Clear packaging + cost driver |

---

## 8) Open questions for peer review (yes/no where possible)

1) Do we agree to remove **all** non‑branding flags from the paid matrix (including `seoGeo.enabled`)?
2) Are the tier numbers acceptable for:
   - `views.monthly.max`: Free 10k, Tier1 100k
   - `instances.published.max`: Free/Tier1 1, Tier2 5
   - locales packaging: Free 2 (EN+GEO), Tier1 4 (EN+3 chosen), Tier2 unlimited
3) Upload size caps: do these values match our storage economics?
4) Are we comfortable treating links/media metadata as baseline product behavior (non‑tiered)?

---

## 9) Acceptance criteria (what “done” means)

1) A Free user can see and use the same feature set, but is limited by caps/budgets.
2) Localization is always available; Free has EN + GEO locale (no picker); Tier1 can pick 3 locales; Tier2+ unlimited.
3) View caps enforce Frozen Billboard (no disappearing widgets; EN‑only snapshots when frozen).
4) The entitlements matrix is materially smaller in flags and no longer contains schema‑only constraints.
