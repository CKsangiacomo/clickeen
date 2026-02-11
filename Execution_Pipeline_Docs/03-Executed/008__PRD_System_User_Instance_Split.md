# PRD - Clickeen-authored (baseline + curated) vs User Instance Split (One-way Publish)

Status: Executed / superseded. This design has been implemented; details now live in `documentation/`.
Source of truth: `documentation/` and `Execution_Pipeline_Docs/03-Executed/033__PRD__07-14_Remaining_Work_Closeout.md`.

Status: Draft (peer review)
Owner: Clickeen core platform
Related docs:
- `documentation/architecture/CONTEXT.md`
- `documentation/strategy/WhyClickeen.md`
- `documentation/services/michael.md`
- `documentation/services/paris.md`
- `documentation/services/venice.md`
- `Execution_Pipeline_Docs/02-Executing/003__Localization_Instance_L10n_Refactor.md`

---

## 0) Why this exists (and why now)

We are mixing two very different concerns in the same storage and pipelines:

- **Clickeen-authored instances** (baseline + curated) are Clickeen-authored assets that must be deterministic and stable.
- **User instances** are customer-owned data with different permissions and lifecycles.

Today we try to keep local and cloud-dev in sync for both, which creates:
- Bidirectional sync complexity (local <-> cloud) that produces drift and failures.
- Confusing ownership (who can edit what, where).
- Fragile localization pipelines that depend on the wrong source of truth.

We need a hard architectural split so Clickeen-authored instances are authored locally and published one-way, while user instances live only in cloud storage with workspace isolation.

---

## 1) Goals and non-goals

### Goals (must ship)
1. **Hard separation** of Clickeen-authored instances and user instances in storage and API flows.
2. **One-way publish** for Clickeen-authored instances: local is canonical, cloud-dev is a published mirror.
3. **User instances never live in local DB** (local DevStudio is not a user instance authoring surface).
4. **i10n overlays** are generated and published from the correct canonical source for each scope.
5. **No bidirectional sync** between local and cloud for instances.

### Why user instances never live locally
- Local DevStudio is Clickeen-authored authoring only (no workspace context).
- User instances belong to workspaces and require RLS enforcement.
- Mixing user data into local DB would violate workspace isolation and reintroduce bidirectional sync problems.

### Non-goals (explicitly out of scope)
- Cloud-hosted DevStudio (future).
- Full production auth model (this is still dev/local gated).
- Rewriting widget runtime or Tokyo packaging.
- Migrating historical user instances across environments.

---

## 2) Canonical terms

**Clickeen-authored instance**: Clickeen-authored instance used for baselines and curated showcases.
- **Baseline**: `wgt_main_{widgetType}`
- **Curated**: `wgt_curated_{curatedKey}`

**User instance**: Customer-owned instance.
- `wgt_{widgetType}_u_{instanceKey}`

**Clickeen-authored store**: Storage that holds baseline + curated instances only (local canonical).

**User store**: Storage that holds user instances only (cloud canonical).

**One-way publish**: Local Clickeen-authored instances are pushed to cloud-dev; cloud-dev never writes back.

---

## 3) Invariants (strict)

1. Clickeen-authored instances and user instances never share the same table.
2. Prefixes are authoritative:
   - `wgt_main_*` and `wgt_curated_*` are Clickeen-authored.
   - `wgt_*_u_*` are user.
3. Clickeen-authored instances are editable only in local DevStudio.
4. Cloud-dev can read Clickeen-authored instances but must never write them.
5. User instances are editable only in cloud-dev and never written to local DB.
6. i10n overlays are generated from the canonical instance store for that scope.

---

## 4) Architecture overview

### 4.1 Data model (Michael)

Add a new table for Clickeen-authored instances:

`curated_widget_instances`
- `id` UUID
- `public_id` TEXT (unique, curated/baseline prefix only)
- `widget_type` TEXT (denormalized, validated at write time)
- `kind` TEXT (`baseline` | `curated`)
- `status` TEXT (`published` | `unpublished`)
- `config` JSONB (required object)
- `created_at`, `updated_at`

Keep existing `widget_instances` for user instances only.

Add a constraint on `widget_instances.public_id` (after backfill) to forbid `wgt_main_*` and `wgt_curated_*`.

**RLS enforcement**
- `curated_widget_instances`: no workspace isolation; write access restricted to service role or dev auth only.
- `widget_instances`: `workspace_id` required; RLS enforces workspace isolation.
- `widget_instance_locales`: system overlays use `workspace_id = NULL`; user overlays use `workspace_id` scoped by RLS.

**Why `widget_type` instead of `widget_id` for curated**
- Curated instances are content-addressed artifacts, not transactional user data.
- Publishing local -> cloud-dev must not depend on `widgets` table state or UUID sync.
- Widget types are stable identifiers (breaking change = new widget type).
- Validation is fail-fast at write time (Paris checks against Tokyo widget registry).
- Simpler reads (no join required for `widget_type`).

### 4.2 Localization overlays

Keep `widget_instance_locales` as the canonical overlay store:
- Clickeen-authored overlays use `workspace_id = NULL`.
- User overlays use `workspace_id = <workspace>`.
- No FK required (already none). This allows overlays to reference `curated_widget_instances.public_id`.

Optional hardening (post-cutover):
- Add a `scope` column: `curated | user` to remove ambiguity.

### 4.3 Paris API routing

Route by `public_id` prefix:

**Validation contract (fail-fast)**

Before accepting a write to `curated_widget_instances`, Paris must validate `widget_type` against the Tokyo widget registry:

```typescript
// Paris: POST /curated-instances or PUT /curated-instances/:id

// Source of truth: Tokyo widget registry (filesystem)
// Cached in Atlas KV (refreshed on deploy) or read from Tokyo manifest
const validWidgetTypes = await getValidWidgetTypes();
// Returns: ['faq', 'testimonial', 'pricing', ...]

if (!validWidgetTypes.includes(payload.widget_type)) {
  throw new ValidationError(
    `Invalid widget_type: "${payload.widget_type}". ` +
      `Must be one of: ${validWidgetTypes.join(', ')}`
  );
}

// Proceed with write...
```

Implementation options:
- Atlas KV cache (recommended): DevStudio publish updates KV with current widget types from Tokyo. Paris reads from KV (fast, no disk I/O).
- Tokyo manifest file: Tokyo exposes `/widgets/manifest.json` listing all valid types. Paris fetches on startup + caches in memory.
- Hardcoded allowlist (interim): Paris maintains a static list during limited widget catalog phase. Update when new widgets ship.

Cache invalidation: when a new widget type is added to Tokyo, the cache must be updated before curated instances can reference it. Recommend: DevStudio publish workflow includes a "refresh widget registry" step.

- `wgt_main_*` and `wgt_curated_*` use `curated_widget_instances`.
- `wgt_*_u_*` use `widget_instances`.

Writes:
- Clickeen-authored writes allowed only with `PARIS_DEV_JWT` and `ENV_STAGE` in `local` or `cloud-dev` (one-way publish from local to cloud-dev).
- User writes allowed only on cloud-dev (or local when explicitly in user mode).

### 4.4 Bob and DevStudio (naming clarity)

Local DevStudio (Bob in Clickeen-authored mode):
- Edit baseline + curated instances only.
- Publish updates to local Clickeen-authored store.
- Provide an explicit "Publish to cloud-dev" action that pushes data one-way.

Cloud DevStudio (Bob in curated read-only mode):
- Browse or preview curated instances without editing.

Authenticated Bob (user workspace mode):
- Edit user instances only.

### 4.5 Venice and Prague

Venice loads instance data via Paris:
- Clickeen-authored IDs resolve from `curated_widget_instances`.
- User IDs resolve from `widget_instances`.

Prague continues to use curated IDs; no change in public URLs.

### 4.6 Materialization pipeline (Tokyo)

This is a hybrid architecture by design:
- **Truth (DB)**: Supabase holds the canonical instance config and overlays.
- **Delivery (CDN)**: Tokyo R2 stores materialized, immutable artifacts.
- **Publisher bridge**: San Francisco + Tokyo Worker convert DB truth into CDN delivery.

After publish:
1. Paris writes the canonical config (DB truth).
2. San Francisco generates locale ops (l10n overlays).
3. Tokyo Worker materializes config + overlays into R2.
4. Venice fetches from Paris (authoring context) or Tokyo (runtime delivery) as appropriate.

---

## 5) Clickeen-authored publish pipeline (one-way)

**Trigger**: Local DevStudio publish or an explicit CLI/script.

**Actions**:
1. Push Clickeen-authored instance snapshot to cloud-dev `curated_widget_instances` (truth in DB).
2. Enqueue l10n generate jobs (San Francisco generates ops for the curated locale allowlist).
3. Enqueue l10n publish jobs:
   - Apply ops to base instance config.
   - Hash the resulting artifact (SHA-256).
   - Upload to Tokyo R2 with content-addressed filename: `{publicId}/{locale}.{hash}.json`.
4. Update manifest pointer: `{publicId}/manifest.json` -> points to current hash per locale.
5. Venice always resolves via manifest, so no CDN invalidation is required.

**Result**:
- Truth (Supabase): mutable pointer, queryable.
- Delivery (Tokyo R2): immutable artifacts, globally cached.
- Atomicity: manifest swap ensures instant cutover with no stale data.

This is the only path to cloud-dev updates for Clickeen-authored instances.

---

## 6) Migration plan (additive, minimal, non-destructive)

Phase 0 - Naming alignment (already planned):
- Ensure Clickeen-authored IDs follow `wgt_main_*` and `wgt_curated_*`.

Phase 1 - Add new table:
- Add `curated_widget_instances` in Michael (local + cloud-dev).

Phase 2 - Backfill:
- Copy existing Clickeen-authored rows from `widget_instances` into `curated_widget_instances` (map `widget_id -> widget_type` via `widgets` table once).
- Validate parity (config hash, status).

Phase 3 - API routing:
- Update Paris to route by prefix and enforce write rules.

Phase 4 - DevStudio split:
- Local DevStudio edits Clickeen-authored only.
- Cloud DevStudio is read-only for curated.
- Authenticated Bob edits user only.

Phase 5 - Constraints:
- Add `widget_instances` constraint to forbid Clickeen-authored prefixes.
- Optional: remove duplicated Clickeen-authored rows from `widget_instances`.

---

## 7) Acceptance criteria

1. Local DevStudio can edit `wgt_main_*` and `wgt_curated_*` without touching cloud.
2. "Publish to cloud-dev" mirrors Clickeen-authored instances and triggers l10n overlays.
3. Cloud-dev never writes Clickeen-authored instances.
4. User instances never appear in local DB.
5. Venice and Prague load curated instances reliably in both local and cloud-dev.
6. i10n overlays are generated consistently from Clickeen-authored data and are visible via Tokyo.

---

## 8) Risks and mitigations

- **Data drift during cutover**: run a parity check (config hash comparison) before enforcing constraints.
- **Tool confusion**: label DevStudio selectors as "Clickeen-authored" vs "User".
- **Overlays tied to old IDs**: run a single overlay backfill after renaming IDs.
- **Deleted curated instances**: avoid hard delete; add a `deprecated` status and fall back to baseline at runtime.

---

## 9) Open decisions (need answers)

1. Should DevStudio expose a switch to read user instances from cloud-dev while running locally.
