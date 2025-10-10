# Migration History Divergence Analysis (Optional P2)

**Status:** Optional process improvement
**Priority:** P2 (not blocking staging deployment)
**Purpose:** Understand why `supabase db push` failed and prevent future divergence

---

## Quick Diagnosis Commands

Run these to identify the exact divergence:

```bash
# List remote migration history
supabase db remote list -p ebmqwqdexmemhrdhkmwn

# List local migration files
ls -1 supabase/migrations/

# Show diff (migrations in remote but not local)
comm -23 \
  <(supabase db remote list -p ebmqwqdexmemhrdhkmwn | awk '{print $1}' | sort) \
  <(ls -1 supabase/migrations/ | sed 's/\.sql$//' | sort)

# Show diff (migrations in local but not remote)
comm -13 \
  <(supabase db remote list -p ebmqwqdexmemhrdhkmwn | awk '{print $1}' | sort) \
  <(ls -1 supabase/migrations/ | sed 's/\.sql$//' | sort)
```

---

## Expected Findings

**Hypothesis 1: Manual SQL Applied to Remote**
- Someone ran SQL directly in Supabase dashboard
- Remote has schema changes but no migration file
- **Fix:** Extract schema changes into new migration file

**Hypothesis 2: Local Migrations Deleted**
- Remote has old migration IDs that were removed from local
- Common during Phase-1 bootstrap (squashing pre-production migrations)
- **Fix:** Document in ADR that pre-Phase-1 migrations were intentionally removed

**Hypothesis 3: Multiple Developers Pushed Simultaneously**
- Two developers created migrations with same timestamp
- One got applied to remote, other exists only locally
- **Fix:** Use more precise timestamps (include seconds/milliseconds)

**Hypothesis 4: Supabase CLI Version Mismatch**
- Old CLI version used different migration ID format
- Remote uses format X, local uses format Y
- **Fix:** Upgrade CLI to latest version, regenerate migrations if needed

---

## Resolution Options

### Option 1: Accept Divergence (Current State) ✅ RECOMMENDED

**Rationale:**
- Remote schema is correct (both required indexes verified)
- Local migrations are canonical going forward
- No production impact from history mismatch

**Action:** None required

**Trade-offs:**
- ✅ Zero risk
- ✅ No downtime
- ❌ `supabase db push` won't work (must apply migrations manually or via SQL editor)

---

### Option 2: Repair Migration History

**Command:**
```bash
# Pull remote schema into local migrations
supabase db pull -p ebmqwqdexmemhrdhkmwn

# Review generated migration file
cat supabase/migrations/<timestamp>_remote_schema.sql

# If acceptable, commit as new baseline
git add supabase/migrations/<timestamp>_remote_schema.sql
git commit -m "Sync migration history with remote (baseline)"
```

**Risks:**
- ⚠️ Generates large diff (entire schema snapshot)
- ⚠️ Loses granular migration history
- ⚠️ Future `db push` may try to re-apply old migrations

**When to use:** Only if you need `supabase db push` for future deployments

---

### Option 3: Manual History Reconciliation

**Process:**
1. Identify missing migrations (use commands above)
2. For each missing migration:
   - If in remote but not local: Extract SQL, create new migration file
   - If in local but not remote: Apply to remote via SQL editor
3. Mark migrations as applied: `supabase migration repair <timestamp> -p ebmqwqdexmemhrdhkmwn`

**Risks:**
- ⚠️ High manual effort
- ⚠️ Easy to make mistakes
- ⚠️ Requires database freeze during reconciliation

**When to use:** Only if perfect history audit trail is required (e.g., SOC2 compliance)

---

## Recommendation

**ACCEPT CURRENT DIVERGENCE** (Option 1) ✅

**Rationale:**
- Remote schema is correct (verified)
- Local migrations are clean and canonical
- Future migrations will apply cleanly (additive only)
- No benefit to rewriting history

**Document in ADR:**
```markdown
## ADR: Accept Migration History Divergence (2025-10-07)

**Context:** `supabase db push` failed due to remote migration IDs not present in local directory.

**Decision:** Accept divergence; use manual migration application via SQL editor or `supabase migration up` for local testing.

**Rationale:**
- Remote schema verified correct (both Phase-1 indexes present)
- History reconciliation would require production freeze
- Future migrations are additive and will apply cleanly

**Consequences:**
- `supabase db push` will not work until history reconciled (acceptable for Phase-1)
- Migrations must be applied via Supabase dashboard SQL editor or CLI migration up
- Future phases may reconcile if strict history lineage becomes requirement
```

---

## Analysis Results

**Run the diagnostic commands above and paste results here:**

### Remote Migration History
```
[Paste output of: supabase db remote list -p ebmqwqdexmemhrdhkmwn]
```

### Local Migration Files
```
[Paste output of: ls -1 supabase/migrations/]
```

### Divergence Diff
```
[Paste output of comm commands showing missing migrations]
```

### Root Cause
```
[Fill in after analyzing diff - likely Hypothesis #2 from above]
```

---

## Action Required

**None** - This is optional P2 analysis for process improvement only.

If migration history alignment becomes a requirement in future phases, revisit Option 2 or Option 3 above.
