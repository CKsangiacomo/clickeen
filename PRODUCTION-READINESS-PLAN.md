# CLICKEEN PHASE-1 PRODUCTION READINESS PLAN

## EXECUTIVE SUMMARY

**Status**: Core platform development complete, production deployment blockers identified  
**Scope**: Address 6 critical production risks preventing safe deployment  
**Timeline**: Estimated 2-3 days for P0 items, 4-5 days total  
**Impact**: Enables safe production deployment of Phase-1 system  

## RISK ASSESSMENT SUMMARY

| Priority | Issue | Impact | Effort |
|----------|-------|---------|---------|
| P0 BLOCKING | Database schema not deployed | Complete platform failure | High |
| P0 BLOCKING | POST /api/instance creates orphan rows | Database constraint violations | Medium |
| P0 CRITICAL | CORS production misconfiguration | API completely blocked | Low |
| P1 HIGH | Missing 5 widget renderers | 83% of widgets show debug view | Medium |
| P2 MEDIUM | Branding logic inconsistency | Incorrect API responses | Low |
| P2 MEDIUM | Rate limit SQL fallback broken | Per-IP limits don't work without Redis | Medium |
| P2 MEDIUM | Draft token reload bug | Extra DB queries, race conditions | Low |
| P3 LOW | Loader event bus naming drift | Integration confusion for developers | Low |
| P3 LOW | Bob env var naming drift | Documentation vs code inconsistency | Low |
| P3 LOW | Duplicate import | Code quality issue | Trivial |

---

## DETAILED IMPLEMENTATION PLAN

### 🚨 PHASE 1: CRITICAL BLOCKERS (P0) - Days 1-2

#### 1.1 Deploy Database Schema
**File**: `documentation/dbschemacontext.md` → Supabase deployment  
**Risk**: Without this, every API call fails with "relation does not exist"

**Tasks**:
- [ ] **Extract schema from documentation** - Parse `dbschemacontext.md` (4,432 lines of SQL)
- [ ] **Create migration files** in `supabase/migrations/<YYYYMMDDHHMMSS>__slug.sql` (per michael.md:390)
- [ ] **Deploy to Supabase** - Apply schema with RLS policies using Supabase CLI
- [ ] **Verify tables exist**: `widget_instances`, `widgets`, `embed_tokens`, `plan_features`, `plan_limits`, `usage_events`, `events`, `workspaces`, `widget_submissions`
- [ ] **Verify constraints**: Ensure `widget_instances.widget_id` FK constraint to `widgets.id`
- [ ] **Test basic queries** - Ensure Paris can read/write to all tables

**Validation**:
```bash
# Test that core tables exist and are accessible
curl -X GET http://localhost:3004/api/healthz
# Should return 200, not DB errors
```

**Estimated Effort**: 6-8 hours (schema extraction, migration creation, deployment, testing)

#### 1.2 Fix CORS Production Configuration  
**File**: `paris/middleware.ts:11`  
**Risk**: Production deployments block ALL API requests without `ALLOWED_ORIGINS` env var

**Current Code**:
```typescript
if (!raw) return process.env.NODE_ENV === 'development' ? DEFAULT_ALLOWED : [];
```

**Current Behavior**: ✅ **ALREADY CORRECT** - Fails closed in production
```typescript
// paris/middleware.ts:11 - Current implementation is correct
if (!raw) return process.env.NODE_ENV === 'development' ? DEFAULT_ALLOWED : [];
```

**Tasks**:
- [ ] **Verify current behavior** - Confirm production fails closed when ALLOWED_ORIGINS unset  
- [ ] **Add healthz check** - Surface CORS misconfiguration in health endpoint
- [ ] **Document deployment requirement** - ALLOWED_ORIGINS must include Bob/Prague origins only
- [ ] **Test CORS behavior** - Ensure 403 responses when origins not in allowlist
- [ ] **No code changes needed** - Current middleware already implements fail-closed policy

**Validation**:
```bash
# Test production CORS behavior
NODE_ENV=production node -e "console.log(require('./paris/middleware.ts').parseAllowed())"
# Should return safe defaults, not empty array
```

**Estimated Effort**: 1-2 hours (healthz integration, testing, documentation)

#### 1.3 Fix POST /api/instance Orphan Rows Bug
**File**: `paris/app/api/instance/route.ts:110`  
**Risk**: Database constraint violations - missing required `widget_id` and `widget_type` fields

**Problem**: Insert record lacks required foreign key to `widgets` table:
```typescript
const record: Record<string, unknown> = {
  public_id: publicId,
  status,
  config,
  template_id: payload.templateId,
  schema_version: schemaVersion,
  // MISSING: widget_id (UUID NOT NULL FK to widgets.id)
  // MISSING: widget_type (text NOT NULL)
};
```

**Solution Options**:
1. **Create widget row first** (like `/api/instance/from-template` does)
2. **Deprecate POST /api/instance** in favor of from-template flow only

**Tasks**:
- [ ] **Choose approach** - Create widget or deprecate endpoint
- [ ] **If create widget**: Add widget creation before widget_instance insert
- [ ] **If deprecate**: Document endpoint as not for GA, redirect to from-template
- [ ] **Add `widget_type` field** to insert record
- [ ] **Test constraint compliance** - Verify inserts succeed with proper FK

**Validation**:
```bash
# Test instance creation doesn't violate FK constraints
curl -X POST http://localhost:3004/api/instance -H "Content-Type: application/json" \
  -d '{"publicId":"test_123","widgetType":"forms.contact","schemaVersion":"2025-09-01","config":{}}'
# Should return 201, not 500 FK violation
```

**Estimated Effort**: 4-6 hours (investigation, widget creation logic, testing)

---

### ⚠️ PHASE 2: HIGH PRIORITY (P1) - Days 3-4

#### 2.1 Implement Missing Widget Renderers & Catalog Entries
**Files**: `venice/lib/renderers/` (5 new files needed) + `paris/lib/catalog.ts` (expand)  
**Risk**: 83% of widget types render as JSON debug dumps instead of functional widgets

**Current State**: Only `formsContact.ts` exists, catalog.ts has only 1 widget type  
**Required**: FAQ, Testimonials, Announcement, Newsletter, Social Proof renderers + catalog entries

**Tasks**:
- [ ] **Add widget catalog entries** - Expand `WIDGET_CATALOG` array in `paris/lib/catalog.ts`
- [ ] **Implement FAQ renderer** - `venice/lib/renderers/faq.ts`
- [ ] **Implement Testimonials renderer** - `venice/lib/renderers/testimonials.ts` 
- [ ] **Implement Announcement renderer** - `venice/lib/renderers/announcement.ts`
- [ ] **Implement Newsletter renderer** - `venice/lib/renderers/newsletter.ts`
- [ ] **Implement Social Proof renderer** - `venice/lib/renderers/socialProof.ts`
- [ ] **Update routing logic** - Add cases to `venice/app/e/[publicId]/route.ts`
- [ ] **Add type definitions** - Extend widget type unions
- [ ] **Create test instances** - One per widget type for validation

**Implementation Pattern** (based on existing `formsContact.ts`):
```typescript
export function renderFaqPage({
  instance,
  theme,
  device, 
  backlink,
}: {
  instance: InstanceLike;
  theme: 'light' | 'dark';
  device: 'desktop' | 'mobile'; 
  backlink: boolean;
}) {
  const cfg = instance.config || {};
  const questions = cfg.questions || [];
  // ... render FAQ widget HTML
}
```

**Validation**:
```bash
# Test each widget type renders properly
curl "http://localhost:3003/e/test_faq_instance"
curl "http://localhost:3003/e/test_testimonial_instance"
# Should return HTML, not JSON debug view
```

**Estimated Effort**: 14-18 hours (5 renderers × 2-3 hours each, plus catalog entries, plus routing updates)

---

### 🔧 PHASE 3: MEDIUM PRIORITY (P2) - Day 5

#### 3.1 Fix Branding Logic Inconsistency
**Files**: `paris/lib/instances.ts:113` and `paris/app/api/instance/[publicId]/route.ts:74`  
**Risk**: API returns inconsistent branding decisions, confusing clients

**Problem**: Two different branding calculation methods
- `shapeInstanceResponse()`: Uses `record.status !== 'published'` (status-based)
- GET route: Uses `!features.brandingRemovable` (plan-based)

**Solution**: Standardize on plan-based logic everywhere

**Tasks**:
- [ ] **Update shapeInstanceResponse** - Remove hardcoded branding logic
- [ ] **Create helper function** - `calculateBranding(client, workspaceId)` 
- [ ] **Update all callers** - Pass branding as parameter instead of calculating inline
- [ ] **Add caching** - Cache plan features for workspace to avoid repeated queries
- [ ] **Test edge cases** - Free vs paid plans, published vs draft status

**Code Changes**:
```typescript
// paris/lib/instances.ts - Remove hardcoded branding
export function shapeInstanceResponse(record: InstanceRecord, branding?: BrandingConfig) {
  return {
    // ... other fields
    branding: branding || { hide: false, enforced: true }, // Safe default
    // ...
  };
}

// New helper
export async function calculateBranding(client: AdminClient, workspaceId: string) {
  const plan = await fetchWorkspacePlan(client, workspaceId);
  const features = await fetchPlanFeatures(client, plan);
  return { hide: false, enforced: !features.brandingRemovable };
}
```

**Estimated Effort**: 4-5 hours (refactoring, testing, validation)

#### 3.2 Fix Rate Limit SQL Fallback IP Tracking
**File**: `paris/lib/rate-limit.ts:88` and `paris/app/api/usage/route.ts`  
**Risk**: Per-IP limits don't work when Redis unavailable, only per-instance limits apply

**Problem**: SQL fallback checks `metadata->>ip` but POST `/api/usage` never stores IP in metadata

**Current Code**:
```typescript
// paris/lib/rate-limit.ts:88 - SQL fallback looks for IP in metadata
.eq('metadata->>ip', ip)

// But usage endpoint doesn't store IP anywhere
```

**Solution Options**:
1. **Accept per-instance-only** limiting under SQL fallback (remove IP filter)
2. **Store hashed IP** in `metadata.ipHash` for rate limiting only

**Tasks**:
- [ ] **Choose approach** - No IP tracking vs hashed IP storage
- [ ] **If hash approach**: Store `metadata.ipHash = sha256(ip + salt)` in usage events
- [ ] **Update SQL fallback** - Query correct metadata field or remove IP filter
- [ ] **Test both Redis and SQL** - Verify rate limits work in both modes
- [ ] **Document privacy implications** if storing IP hashes

**Estimated Effort**: 3-4 hours (implementation choice, testing, validation)

#### 3.3 Fix Draft Token Reload Bug  
**File**: `paris/app/api/claim/route.ts:66,95`  
**Risk**: Extra DB queries, potential race conditions during claim flow

**Problem**: Sets `draft_token = null` then tries to reload by that NULL token

**Current Code**:
```typescript
// Line 66: Invalidate token
.update({ draft_token: null, claimed_at: new Date().toISOString() })

// Line 95: Try to reload by invalidated token
const refreshed = await loadInstanceByDraftToken(client, draftToken);
```

**Solution**: Use `publicId` for reload after claim

**Tasks**:
- [ ] **Change reload method** - Use `loadInstance(client, publicId)` instead
- [ ] **Remove redundant query** - Eliminate `loadInstanceByDraftToken` call
- [ ] **Add error handling** - Handle case where instance not found
- [ ] **Test claim flow** - Ensure proper state transitions

**Code Changes**:
```typescript
// After setting draft_token = null, reload by publicId
const refreshed = await loadInstance(client, claimed.publicId);
if (!refreshed) {
  return NextResponse.json({ error: 'INSTANCE_NOT_FOUND' }, { status: 404 });
}
```

**Estimated Effort**: 2-3 hours (code change, testing, validation)

---

### 🧹 PHASE 4: LOW PRIORITY (P3) - Day 6

#### 4.1 Fix Loader Event Bus Naming Drift
**Files**: `venice/app/embed/v1/loader.ts:21` vs documentation  
**Risk**: Integration confusion - docs show `window.ckeenBus`, code uses `window.Clickeen`

**Current Implementation**:
```typescript
// venice/app/embed/v1/loader.ts:21
const bus = (window.Clickeen = window.Clickeen || { listeners: {}, queue: [], ready: false });
```

**Tasks**:
- [ ] **Audit documentation** - Find references to `window.ckeenBus`
- [ ] **Choose canonical name** - Either `window.Clickeen` or `window.ckeenBus`  
- [ ] **Update docs or code** - Align naming consistently
- [ ] **Consider alias** - Add backward compatibility if needed

**Estimated Effort**: 1-2 hours (audit, decision, updates)

#### 4.2 Fix Bob Environment Variable Naming Drift  
**Files**: `bob/app/components/StudioShell.tsx:30` vs documentation  
**Risk**: Documentation inconsistency - Bob uses `NEXT_PUBLIC_EMBED_BASE`, docs may reference `NEXT_PUBLIC_VENICE_URL`

**Current Code**:
```typescript
// bob/app/components/StudioShell.tsx:30
const envBase = process.env.NEXT_PUBLIC_EMBED_BASE?.replace(/\/$/, '');
```

**Tasks**:
- [ ] **Audit documentation** - Check for `NEXT_PUBLIC_VENICE_URL` references
- [ ] **Standardize naming** - Choose one canonical env var name
- [ ] **Update code or docs** - Align naming consistently
- [ ] **Test Bob integration** - Ensure Venice URL configuration works

**Estimated Effort**: 1-2 hours (audit, standardization, testing)

#### 4.3 Clean Up Duplicate Import
**File**: `paris/app/api/instance/route.ts:3,5`  
**Risk**: Minimal - code quality issue only

**Current Code**:
```typescript
import { getServiceClient } from '@paris/lib/supabaseAdmin';
import { loadInstance, shapeInstanceResponse } from '@paris/lib/instances';
import { getServiceClient } from '@paris/lib/supabaseAdmin'; // DUPLICATE
```

**Solution**: Remove duplicate import on line 5

**Estimated Effort**: 5 minutes

---

## VALIDATION & TESTING PLAN

### Pre-Deployment Checklist

#### Database Schema Validation
- [ ] All tables exist in Supabase
- [ ] RLS policies are active and working
- [ ] Sample data can be inserted/queried
- [ ] Paris API can connect and execute queries

#### Catalog Validation
- [ ] Confirm `WIDGET_CATALOG` has all 6 widget types (FAQ, Testimonials, Announcement, Newsletter, Contact, Social Proof)
- [ ] Verify `/api/widgets` endpoint returns complete catalog
- [ ] Test template metadata for each widget type

#### API Functionality Tests  
- [ ] All endpoints return 200 for valid requests
- [ ] CORS headers present for allowed origins
- [ ] Rate limiting works (Redis + SQL fallback)
- [ ] Authentication flows work end-to-end

#### Widget Rendering Tests
- [ ] Each widget type renders proper HTML (not debug JSON)
- [ ] All themes work (light/dark)
- [ ] All devices work (desktop/mobile) 
- [ ] Backlink logic works correctly

#### End-to-End Flow Tests
- [ ] Anonymous user can create draft widget
- [ ] User can claim draft widget
- [ ] Claimed widget shows correct branding based on plan
- [ ] Widget submissions work and are rate limited
- [ ] Usage tracking works

### Performance Validation
- [ ] SSR budget under 28KB gzipped (run `venice/scripts/check-budgets.js`)
- [ ] API response times under 500ms
- [ ] Redis circuit breaker works correctly
- [ ] Database query counts are reasonable

---

## DEPLOYMENT STRATEGY

### Environment Requirements

#### Production Environment Variables
```bash
# Required for CORS
ALLOWED_ORIGINS="https://clickeen.com,https://www.clickeen.com,https://c-keen-bob.vercel.app,https://c-keen-embed.vercel.app"

# Database
DATABASE_URL="postgresql://..."
SUPABASE_URL="https://..."
SUPABASE_SERVICE_ROLE_KEY="..."

# Optional Redis (falls back to SQL)  
RATE_LIMIT_REDIS_URL="redis://..."
RATE_LIMIT_REDIS_PREFIX="ck:rl:"
```

#### Staging Deployment Steps
1. Deploy schema to staging database
2. Deploy updated code to staging environment  
3. Run validation test suite
4. Performance testing with realistic load
5. End-to-end user flow testing

#### Production Deployment Steps
1. Deploy schema to production database (during maintenance window)
2. Deploy code with feature flags (if available)
3. Gradual rollout with monitoring
4. Full traffic cutover after validation

---

## RISK MITIGATION

### Rollback Plans
- **Schema Issues**: Keep backup of current database state
- **API Issues**: Immediate rollback to previous deployment
- **Widget Rendering**: Graceful fallback to debug view for unknown types

### Monitoring Requirements
- **Database connectivity** - Alert if connection fails
- **CORS errors** - Alert on 403 responses from unknown origins  
- **Widget render errors** - Track which widget types fail
- **Performance degradation** - Alert on response time increases

---

## SUCCESS CRITERIA

### Definition of Done
- [ ] All P0 issues resolved and validated
- [ ] All P1 issues resolved and validated  
- [ ] Production deployment successful without errors
- [ ] All widget types render correctly
- [ ] Performance targets met (SSR <28KB, API <500ms)
- [ ] Monitoring and alerting in place

### Quality Gates
1. **Code Review**: All changes peer reviewed
2. **Testing**: Automated test suite passes
3. **Performance**: Budget and response time targets met  
4. **Security**: CORS and authentication working correctly
5. **Documentation**: Deployment and troubleshooting docs updated

---

## TIMELINE SUMMARY

| Phase | Duration | Focus | Deliverables |
|-------|----------|--------|--------------|
| Phase 1 | Days 1-2 | P0 Critical Blockers | Schema deployed, CORS fixed, instance creation fixed |
| Phase 2 | Days 3-4 | P1 Widget Renderers | 5 new renderers + catalog entries |
| Phase 3 | Days 5-6 | P2 Logic Fixes | Branding consistency, rate limits, token bug fixed |
| Phase 4 | Day 6 | P3 Code Quality | Clean imports, final validation |

**Total Estimated Effort**: 5-6 days  
**Recommended Team Size**: 1-2 developers  
**Risk Level After Completion**: Low (production-ready)

## PEER REVIEW CORRECTIONS APPLIED

**✅ Bob Integration Assessment Updated**: StudioShell already has functional iframe preview integration calling `/e/:publicId?ts=<ms>` with TopDrawer, Workspace, and theme/device controls. No "integration gaps" exist.

**✅ Catalog Implementation Clarified**: `paris/lib/catalog.ts` exists with working functions. Gap is in widget-specific entries (only 1 of 6 widget types present), not missing infrastructure.

## CRITICAL PEER REVIEW CORRECTIONS APPLIED

**🚨 NEW P0 BLOCKING ISSUE IDENTIFIED**: POST `/api/instance` creates orphan rows due to missing `widget_id` FK constraint. This causes database violations.

**✅ CORS Policy Corrected**: Removed production fallback allowlist per Phase-1 fail-closed policy. Production should deny-by-default when `ALLOWED_ORIGINS` unset.

**✅ Schema Path Corrected**: Use `supabase/migrations/**` not `michael/migrations/**` per michael.md:390 documentation.

**✅ Rate Limiting Bug Added**: SQL fallback broken for per-IP limits when Redis unavailable - `metadata->>ip` query fails because IP not stored in usage events.

## FINAL PEER REVIEW CORRECTIONS APPLIED

**🚨 CORS Policy Corrected**: Current `paris/middleware.ts:11` implementation is already correct (fail-closed). Removed incorrect plan suggestions for "loud error logging" - keep existing behavior.

**✅ Naming Drift Issues Added**: 
- **Loader Event Bus**: `window.Clickeen` (code) vs `window.ckeenBus` (docs) - P3 integration consistency  
- **Bob Env Vars**: `NEXT_PUBLIC_EMBED_BASE` (code) vs `NEXT_PUBLIC_VENICE_URL` (docs) - P3 documentation alignment

**📋 Final Issue Count**: **10 Total Issues** (3 P0, 1 P1, 3 P2, 3 P3) - Comprehensive production readiness coverage.

---

*This plan addresses all production-blocking issues identified in the codebase analysis while maintaining the existing feature-complete architecture. Upon completion, the Phase-1 system will be ready for safe production deployment.*