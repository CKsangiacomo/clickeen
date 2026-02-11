# PRD — Version Limits for Localization Overlays (Asset Versioning Deferred)

Status: Executed / superseded. Overlay version limits are implemented; legacy table references remain in this doc.
Source of truth: `documentation/` and `Execution_Pipeline_Docs/03-Executed/033__PRD__07-14_Remaining_Work_Closeout.md`.

Status: Draft
Owner: Product Dev Team (Backend)
Surface: Paris, Tokyo Worker, Michael (Database)
Environment: Cloud-dev first, then production

## Summary

Implement tier-based version limits for:
1. **Localization overlays** (per-instance, per-locale translations)

Without limits, power users can abuse translation budgets by triggering redundant translations. This PRD establishes l10n version caps aligned with tier value and implements automatic garbage collection.

**Scope update (2026-01-24):**
- Asset upload versioning is deferred (not in current execution).
- Rollback UI/API is deferred (no user-facing history yet).

**Version limits:**
- Free: 1 version (current only)
- Tier 1: 3 versions (basic rollback later)
- Tier 2: 10 versions (compliance-grade history)
- Tier 3: 10 versions (compliance-grade history)

This prevents translation waste ($5.7K/year savings on 100 power users).

## Problem

### 1. Deferred: Asset Storage Abuse (not in scope in current execution)

Asset upload versioning is explicitly deferred. The section below is retained as historical context only.

**Current state:** Unlimited asset versions per instance.

**Abuse scenario:**
```
Free user uploads logo.jpg → 5MB
User re-uploads 100 times (testing crops)
→ 100 versions × 5MB = 500MB wasted
→ User only uses latest version
→ 99 orphaned versions stored forever
```

**At scale (10K free users):**
- 10,000 × 500MB = 5TB wasted storage
- R2 cost: $75/month for garbage
- **Pure waste** - no user value

### 2. Translation Cost Abuse

**Current state:** Every instance edit triggers l10n overlay generation for all entitled locales.

**Abuse scenario:**
```
Tier 1 user edits instance 20 times/month
Each edit → new baseFingerprint
Each fingerprint → new l10n overlay (14 locales)
→ 20 edits × 14 locales = 280 translations/month
→ User only cares about latest version
→ 19 stale versions × 14 locales = 266 wasted translations
```

**Cost per power user:**
- 266 wasted translations × $0.02 = $5.32/month wasted
- 100 power users = $532/month = $6,384/year wasted

### 3. Deferred: Rollback Capability (not in scope in current execution)

**Current state:** Users cannot roll back to previous translation versions (even though they're stored).

**Pain point:**
- User publishes bad translation → no revert
- **Stored versions provide zero value to user**

## Goals

1. **Prevent translation waste** - Cap l10n overlay versions to reduce redundant translation costs
2. **Automatic cleanup** - Delete stale overlay versions without manual intervention
3. **Tier-based value** - L10n version history becomes a paid feature (upgrade incentive)

## Non-Goals

- Changing how l10n overlays are generated (pipeline stays the same)
- Asset upload versioning (explicitly deferred)
- Rollback UI/API (deferred until limits + cleanup are proven stable)
- Applying version limits to curated instances (Clickeen-owned, unlimited)

## Proposed Architecture

### 1. Version Limits by Tier (l10n overlays only)

| Tier | L10n Overlay Versions | Rationale |
|------|-----------------------|-----------|
| **Free** | 1 (current only) | No version history, minimal storage |
| **Tier 1** | 3 versions | Limited rollback capability (future) |
| **Tier 2** | 10 versions | Full version history for compliance |
| **Tier 3** | 10 versions | Full version history for compliance |

Entitlement key:
- `l10n.versions.max` (cap)

**Applied to:**
- User instances only (user instance l10n overlays)
- NOT curated instances (Clickeen-owned, unlimited versions)

### 2. Deferred: Asset Version Storage Schema (not in scope)

Reference-only design; asset upload versioning is not being implemented in this execution.

#### 2.1 Database Schema (Michael)

**New table: `asset_versions`**
```sql
CREATE TABLE asset_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES widget_instances(id) ON DELETE CASCADE,
  asset_key text NOT NULL,  -- e.g., "original.jpg", "logo.png"
  version_number int NOT NULL,  -- 1, 2, 3, ... (latest = highest)
  r2_path text NOT NULL,  -- e.g., "workspace-assets/{workspaceId}/{instanceId}/original-v2.jpg"
  file_size_bytes bigint NOT NULL,
  content_type text NOT NULL,  -- e.g., "image/jpeg"
  uploaded_at timestamptz DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id),
  UNIQUE(instance_id, asset_key, version_number)
);

CREATE INDEX idx_asset_versions_instance ON asset_versions(instance_id);
CREATE INDEX idx_asset_versions_workspace ON asset_versions(workspace_id);
```

**RLS policies:**
```sql
-- Users can read their workspace's asset versions
CREATE POLICY asset_versions_select ON asset_versions
  FOR SELECT
  USING (workspace_id IN (SELECT id FROM workspaces WHERE user_is_member(auth.uid())));

-- System can write (Paris service-role only)
CREATE POLICY asset_versions_insert ON asset_versions
  FOR INSERT
  WITH CHECK (true);  -- Paris validates ownership before insert
```

#### 2.2 Storage Layout (Tokyo R2)

**Current (no versioning):**
```
tokyo/workspace-assets/{workspaceId}/{instanceId}/
└── original.jpg  ← always overwritten
```

**With versioning:**
```
tokyo/workspace-assets/{workspaceId}/{instanceId}/
├── original.jpg        ← latest (version 3)
├── original.v2.jpg     ← version 2
└── original.v1.jpg     ← version 1 (oldest kept)
```

**Filename pattern:**
- Latest: `{assetKey}` (e.g., `original.jpg`)
- Older: `{assetKey}.v{N}` (e.g., `original.v2.jpg`)

**Why not content-hash filenames?**
- User assets are unique per instance (not shared)
- Version number is simpler (no hash collisions)
- Easier to debug (version numbers are sequential)

### 3. Localization Overlay Versioning

#### 3.1 Current State (Already Version-Aware)

L10n overlays are already versioned via `baseFingerprint`:

**Supabase `widget_instance_locales` table:**
```sql
widget_instance_locales (
  public_id text,
  locale text,
  ops jsonb,
  user_ops jsonb,
  base_fingerprint text,  -- ← This IS the version key
  base_updated_at timestamptz,
  source text,
  workspace_id uuid,
  UNIQUE(public_id, locale)  -- ← Only keeps latest per (instance, locale)
)
```

**Tokyo R2 l10n artifacts (deterministic path; no manifest):**
```
tokyo/l10n/instances/wgt_faq_u_startup123/fr/1226c80e.ops.json  ← fingerprint 1 (current)
tokyo/l10n/instances/wgt_faq_u_startup123/fr/abc12345.ops.json  ← fingerprint 2 (stale, should delete)
tokyo/l10n/instances/wgt_faq_u_startup123/fr/def67890.ops.json  ← fingerprint 3 (stale, should delete)
```

**Problem:** Old fingerprint files are NOT deleted automatically (storage leak).

#### 3.2 Proposed: Version Tracking Table

**New table: `l10n_overlay_versions`**
```sql
CREATE TABLE l10n_overlay_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  public_id text NOT NULL,
  locale text NOT NULL,
  base_fingerprint text NOT NULL,
  base_updated_at timestamptz NOT NULL,
  r2_path text NOT NULL,  -- e.g., "l10n/instances/{publicId}/fr/1226c80e.ops.json"
  created_at timestamptz DEFAULT now(),
  UNIQUE(public_id, locale, base_fingerprint)
);

CREATE INDEX idx_l10n_versions_instance ON l10n_overlay_versions(public_id, locale);
CREATE INDEX idx_l10n_versions_workspace ON l10n_overlay_versions(workspace_id);
```

**Purpose:**
- Track all published l10n overlay versions (not just latest)
- Enable garbage collection of stale fingerprints
- Support rollback to previous overlays (same-base only in v1)

**Versioning note (v1):**
- `base_fingerprint` is the version key and maps to a deterministic R2 path.
- Re-translate without base changes overwrites the same path; add a `translationVersion` suffix only if we need multiple versions per base.

### 4. Version Limit Enforcement

#### 4.1 Deferred: Asset Upload Flow (not in scope)

Reference-only; asset upload versioning is deferred.

**Before (no limits):**
```
User uploads image → Paris → Tokyo Worker
  ↓
Tokyo Worker uploads to R2 (overwrites existing)
  ↓
Paris updates instance config with new URL
```

**After (with limits):**
```
1. User uploads image → Paris receives file
2. Paris checks workspace tier → Free (limit: 1 version)
3. Paris queries: "How many versions exist for (instanceId, assetKey)?"
4. If count >= limit:
   - Delete oldest version from R2
   - Delete oldest version from DB
5. Upload new version to R2 (as latest)
6. Insert new version record into DB
7. Update instance config with new URL
```

**Version rotation (Tier 1, limit: 3):**
```
Current state:
- original.jpg (v3)
- original.v2.jpg (v2)
- original.v1.jpg (v1)

User uploads new version:
1. Delete original.v1.jpg (oldest)
2. Rename: original.v2.jpg → original.v1.jpg
3. Rename: original.jpg → original.v2.jpg
4. Upload new file as original.jpg
5. Update DB version numbers
```

**For Free tier (limit: 1):**
```
Current state:
- original.jpg (v1)

User uploads new version:
1. Delete original.jpg
2. Upload new file as original.jpg
3. Update DB (replace existing record)
```

#### 4.2 L10n Overlay Publishing Flow (with Version Limit)

**After l10n overlay is published to R2 (deterministic key; no manifest):**
```
1. Tokyo Worker publishes overlay to R2
   - Path: l10n/instances/{publicId}/{locale}/{baseFingerprint}.ops.json
2. Tokyo Worker inserts record into l10n_overlay_versions
3. Tokyo Worker checks workspace tier → Tier 1 (limit: 3 versions)
4. Tokyo Worker queries: "How many versions exist for (publicId, locale)?"
5. If count > limit:
   - Delete oldest version from R2
   - Delete oldest version from DB
```

**Cleanup logic:**
```typescript
async function cleanupL10nVersions(
  publicId: string,
  locale: string,
  workspaceId: string
) {
  const tier = await getWorkspaceTier(workspaceId);
  const versionLimit = L10N_VERSION_LIMITS[tier]; // Free: 1, Tier 1: 3, Tier 2/3: 10

  // Get all versions for (publicId, locale) ordered by created_at DESC
  const versions = await db.query(`
    SELECT * FROM l10n_overlay_versions
    WHERE public_id = $1 AND locale = $2
    ORDER BY created_at DESC
  `, [publicId, locale]);

  // Keep only newest N versions
  const toDelete = versions.slice(versionLimit);

  // Delete from R2
  for (const version of toDelete) {
    await r2.delete(version.r2_path);
  }

  // Delete from DB
  await db.query(`
    DELETE FROM l10n_overlay_versions
    WHERE id = ANY($1)
  `, [toDelete.map(v => v.id)]);
}
```

### 5. Deferred: Rollback API (not in scope)

Rollback UI/API is deferred until version limits + cleanup are stable.

#### 5.1 Asset Rollback

**Endpoint:** `POST /api/workspaces/{workspaceId}/instances/{instanceId}/assets/{assetKey}/rollback`

**Request body:**
```json
{
  "versionNumber": 2  // Roll back to version 2
}
```

**Flow:**
1. Verify workspace tier (Tier 1/2/3)
2. Fetch version record from `asset_versions`
3. Copy `{assetKey}.v{N}` → `{assetKey}` (promote old version to current)
4. Update instance config with rolled-back asset URL
5. Increment version counter (rolled-back version becomes new latest)

**Result:** Old version becomes current, original current is archived.

#### 5.2 L10n Overlay Rollback

**Endpoint:** `POST /api/workspaces/{workspaceId}/instances/{instanceId}/locales/{locale}/rollback`

**Request body:**
```json
{
  "baseFingerprint": "758d73cb..."  // Roll back to this fingerprint (same-base only)
}
```

**Flow:**
1. Verify workspace tier (Tier 1/2/3)
2. Fetch l10n overlay for specified fingerprint
3. Validate fingerprint matches current base (same-base rollback only)
4. Update `widget_instance_locales` table (set current fingerprint to old one)
5. Enqueue publish job (re-materializes rolled-back overlay at deterministic path)

**Result:** Old translation becomes current for the same base config. Cross-base rollback requires reverting the base config first (out of scope here).

## Implementation Plan

### Phase 1: L10n Overlay Version Limits (Priority: High)

**Week 1-2:**
1. Create `l10n_overlay_versions` table in Michael
2. Update Tokyo Worker l10n publish handler:
   - Insert version record after R2 upload
   - Run cleanup logic (delete stale versions)
   - Use deterministic pathing (no manifest updates)
3. Backfill existing l10n overlays into version tracking table (if needed)

**Acceptance criteria:**
- Free tier: Only 1 fingerprint per (instance, locale) in R2
- Tier 1: Max 3 fingerprints per (instance, locale) in R2
- Tier 2/3: Max 10 fingerprints per (instance, locale) in R2
- Stale overlays deleted automatically
- Deterministic l10n path used (`l10n/instances/{publicId}/{locale}/{baseFingerprint}.ops.json`), no manifest updates

### Phase 2: Monitoring & Alerts (Priority: Low, optional)

**Week 3:**
1. Add metrics for `l10n_versions.total_count` (by workspace_id)
2. Add alert if version cleanup fails

**Acceptance criteria:**
- Dashboards show l10n version counts per tier
- Alerts fire if cleanup job fails

### Deferred (not in scope)
- Asset version limits (uploads)
- Rollback API + UI

## Rollback Plan

**If version limits cause issues:**
1. Disable version limit enforcement (allow unlimited temporarily)
2. Restore deleted versions from R2 backups (if available)
3. Revert DB migrations (drop `l10n_overlay_versions`)
4. Roll back Paris/Tokyo Worker deployments

**Mitigation:** Test thoroughly in cloud-dev with synthetic power users before prod rollout.

## Acceptance Criteria

- Free tier users: 1 l10n version per (instance, locale)
- Tier 1 users: 3 l10n versions per (instance, locale)
- Tier 2/3 users: 10 l10n versions per (instance, locale)
- Stale versions deleted automatically (no manual cleanup required)
- No storage leaks (R2 file count matches DB version count)
- Curated instances: unlimited versions (not affected by limits)

## Cost Impact

### Without Version Limits (Current)

**L10n translation waste (100 power users):**
- 100 users × $5.32/month wasted = $532/month = $6,384/year

### With Version Limits

**L10n translation cost (100 power users, 3 version limit):**
- 3 versions × 14 locales = 42 translations/user/month
- 100 users × 42 × $0.02 = $84/month = $1,008/year

**Estimated savings:** $6,384 - $1,008 = **$5,376/year**

## Risks & Mitigations

### Risk 1: Users Lose Important L10n Versions

**Scenario:** Translation history exceeds cap and older overlays are deleted.

**Mitigation:**
- Tier 1/2/3 have 3-10 versions (buffer for rollbacks later)
- Users can upgrade if they need longer history

### Risk 2: Cleanup Job Fails, Storage Leaks

**Scenario:** Cleanup logic has bug, old versions not deleted, storage cost grows.

**Mitigation:**
- Add monitoring alert if version count exceeds tier limit
- Add daily cron job to audit and cleanup orphaned versions
- Test cleanup logic extensively in cloud-dev

## Decisions (Locked)

- Version limits apply to user instances only (not curated)
- L10n versions tracked by baseFingerprint (existing mechanism)
- Free tier: 1 version (no history)
- Tier 1: 3 versions (basic rollback later)
- Tier 2/3: 10 versions (compliance)
- Cleanup happens synchronously on publish (not async cron job)

## Open Questions

1. Should we notify users when versions are deleted?
   - **Recommendation:** No (silent cleanup). Users expect "latest version is current", not version history.

2. Should curated instances have version limits?
   - **Recommendation:** No. Clickeen owns curated instances, we control upload frequency.

3. Should we allow users to "pin" a version (prevent deletion)?
   - **Recommendation:** Not in MVP. Add in Phase 4 if users request it.

4. Should we support restoring deleted versions (soft delete)?
   - **Recommendation:** No. Hard delete (saves storage cost). Backups are for disasters only.

## Notes

- This PRD is foundational for cost control at scale
- Version limits prevent abuse without degrading UX for normal users
- Tier 1/2/3 get l10n history as a value-add feature (future UI)
- Implementation is low-risk (cleanup logic is fail-safe)
