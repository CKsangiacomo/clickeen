# PRD 19: Paris Code Organization Uplevel

## Status
- **Status**: Executed (2026-01-27)
- **Owner**: Paris (HTTP API Gateway)
- **Scope**: Paris code organization evolution
- **Priority**: High (unblocks development velocity)

Closeout (why this is executed):
- Paris is already organized as a modular monolith:
  - domain modules: `paris/src/domains/*`
  - shared utilities: `paris/src/shared/*`
  - routing entrypoint: `paris/src/index.ts`

---

## Revision Note: Peer Review Response

**Original Proposal**: Multi-worker microservices architecture (6 separate Cloudflare Workers)

**Peer Review Verdict**: ⚠️ **ARCHITECTURE ANTI-PATTERN - DO NOT PROCEED**

**Key Issues Identified**:
- ❌ **Double cold starts**: 2x latency (gateway + domain worker)
- ❌ **HTTP overhead**: 10-50ms per request between workers
- ❌ **Operational complexity**: 8x deployment surfaces to manage
- ❌ **Architectural violation**: "Orchestrators = dumb pipes" principle
- ❌ **Performance anti-pattern**: Worker-to-worker proxying

**Revised Approach**: **Modular Monolith within Single Worker**
- ✅ **Zero performance overhead**: Single Worker, single cold start
- ✅ **Simple operations**: One deployment surface, shared resources
- ✅ **Architecture compliant**: Maintains Cloudflare Workers best practices
- ✅ **Same benefits**: Domain isolation, testing, maintainability
- ✅ **5-week timeline**: vs 8-week multi-worker complexity

---

## Problem

### Current State: 4,582 LOC Monolithic Worker
Paris has grown into an **unmaintainable monolith** that violates every software engineering principle:

```typescript
// One massive file with everything
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    // 1,000+ lines of routing logic
    if (pathname === '/api/healthz') return handleHealthz();
    if (pathname === '/api/instances') return handleInstances(req, env);
    if (pathname === '/api/workspaces/...') return handleWorkspaceX(req, env);
    // ... 50+ more route handlers
    // + 200+ utility functions
    // + All business logic mixed together
  }
}
```

### Impact on Development Velocity
- **Maintenance Hell**: Finding bugs requires navigating 4,582 LOC
- **Testing Complexity**: No isolated unit testing - everything is integration
- **Deployment Risk**: Single change deploys entire API surface
- **Optimization Friction**: Hot and cold paths are tangled, slowing safe performance work
- **Onboarding Barrier**: New developers drown in monolithic complexity

### Root Cause Analysis
1. **Organic Growth**: Started as simple API gateway, accumulated every HTTP endpoint
2. **No Domain Boundaries**: Instance, workspace, AI, L10n, personalization logic co-located
3. **Routing Explosion**: Massive switch statement handling all API routes
4. **Utility Function Dump**: 200+ helper functions in one file

---

## Goals

### Primary Goal
Transform Paris from a **4,582 LOC monolith** into a **modular, domain-driven architecture** that enables independent development and testing per domain while preserving the single-worker runtime.

### Secondary Goals
- Reduce time-to-understand for new developers (from weeks to days)
- Enable focused performance tuning without cross-domain coupling
- Improve testability with isolated unit tests
- Reduce deployment risk through domain isolation
- Establish clear ownership boundaries per domain

### Non-Goals
- Changing public APIs (backward compatibility maintained)
- Affecting runtime performance
- Requiring external service changes
- Breaking existing authentication/authorization

---

## User Stories

### Developers
- As a developer, I can understand and modify a domain without reading 4,582 LOC
- As a developer, I can unit test business logic in isolation
- As a developer, I can change a domain without touching unrelated modules
- As a developer, I can onboard to Paris development in days, not weeks

### Platform Engineers
- As a platform engineer, I can isolate faults to specific domains
- As a platform engineer, I can target hot paths without cross-domain coupling
- As a platform engineer, I can keep cold starts stable by simplifying routing and module load

### Business Stakeholders
- As a stakeholder, I want faster feature development velocity
- As a stakeholder, I want reduced bug surface area and deployment risk
- As a stakeholder, I want scalable architecture that supports growth
- As a stakeholder, I want maintainable codebase for long-term success

---

## Technical Approach

### Architecture: Modular Monolith Within Single Worker

Refactor the **4,582 LOC monolithic file** into a **modular monolith** with clear domain separation, while maintaining the performance and simplicity of a single Cloudflare Worker.

#### Core Principles
- **Domain Separation**: Clear boundaries between business domains
- **Shared Utilities**: Common functions in local `shared/` directory
- **Single Deployment**: One Worker, multiple internal modules
- **Testability First**: Isolated unit testing per domain
- **Performance Preserved**: Zero overhead from modular organization

#### Boundary Rules (Non-Negotiable)
- Domain modules only import from `shared/` and their own folder
- Cross-domain calls go through explicit exports in `domains/<domain>/index.ts`
- No new endpoints or response shape changes during refactor
- No worker-to-worker network calls in request paths

#### Modular Architecture

```
paris/
├── src/
│   ├── index.ts                # Main entry + routing (clean)
│   ├── domains/                # Domain modules (business logic)
│   │   ├── instances/
│   │   │   ├── crud.ts         # Instance CRUD operations
│   │   │   ├── curated.ts      # Curated instance management
│   │   │   ├── validation.ts   # Instance-specific validation
│   │   │   └── index.ts        # Domain exports
│   │   ├── workspaces/
│   │   │   ├── management.ts   # CRUD operations
│   │   │   ├── business-profile.ts
│   │   │   ├── locales.ts      # Locale management
│   │   │   ├── website-creative.ts
│   │   │   └── index.ts
│   │   ├── ai/
│   │   │   ├── grants.ts       # Grant issuance logic
│   │   │   ├── policies.ts     # Policy resolution
│   │   │   ├── budgets.ts      # Budget management
│   │   │   ├── entitlements.ts # Entitlement checking
│   │   │   └── index.ts
│   │   ├── l10n/
│   │   │   ├── status.ts       # Status reporting
│   │   │   ├── generation.ts   # Queue management
│   │   │   ├── publishing.ts   # Publish queue management
│   │   │   ├── allowlists.ts   # Allowlist management
│   │   │   └── index.ts
│   │   └── personalization/
│   │       ├── preview.ts      # Preview generation
│   │       ├── onboarding.ts   # Onboarding workflows
│   │       ├── jobs.ts         # Job management
│   │       └── index.ts
│   └── shared/                 # Shared utilities (local)
│       ├── auth.ts             # Authentication utilities
│       ├── validation.ts       # Common validation functions
│       ├── supabase.ts         # Database client utilities
│       ├── types.ts            # Shared TypeScript types
│       ├── errors.ts           # Error handling utilities
│       └── env.ts              # Environment detection
├── test/                       # Comprehensive testing
│   ├── domains/
│   │   ├── instances.test.ts
│   │   ├── workspaces.test.ts
│   │   ├── ai.test.ts
│   │   └── l10n.test.ts
│   └── integration/
│       └── api.test.ts
└── package.json
```

### Phase 1: Shared Utilities Organization (Safe Migration)

#### 1.1 Create Shared Directory Structure
```bash
mkdir -p src/shared src/domains
```

#### 1.2 Extract Common Functions
Move 200+ utility functions into focused shared modules:

```typescript
// src/shared/auth.ts
export function requireEnv(env: Env, key: keyof Env) { ... }
export function asBearerToken(header: string | null) { ... }
export function assertDevAuth(req: Request, env: Env) { ... }

// src/shared/validation.ts
export function isRecord(value: unknown): value is Record<string, unknown> { ... }
export function isUuid(value: string): boolean { ... }
export function assertWorkspaceId(value: unknown) { ... }

// src/shared/supabase.ts
export async function supabaseFetch(env: Env, pathnameWithQuery: string, init?: RequestInit) { ... }
export function requireTokyoBase(env: Env): string { ... }
```

#### 1.3 Update Imports Within Main File
Replace inline function definitions with shared imports:

```typescript
// Before (monolithic)
function requireEnv(env: Env, key: keyof Env) { ... }
function asBearerToken(header: string | null) { ... }

// After (modular)
import { requireEnv, asBearerToken } from '../shared/auth';
```

### Phase 2: Domain Extraction (Safe Migration)

#### 2.1 Create Domain Directory Structure
```bash
mkdir -p src/domains/{instances,workspaces,ai,l10n,personalization}
```

#### 2.2 Extract Domain Logic
Move business logic from main file to domain-specific modules:

```typescript
// src/domains/instances/crud.ts
export async function handleInstances(req: Request, env: Env): Promise<Response> {
  // Instance-specific logic only
}

// src/domains/instances/curated.ts
export async function handleCuratedInstances(req: Request, env: Env): Promise<Response> {
  // Curated instance logic only
}

// src/domains/instances/index.ts
export * from './crud';
export * from './curated';
export * from './validation';
```

#### 2.3 Update Main Router
Replace inline route handlers with domain imports:

```typescript
// src/index.ts (simplified routing)
import { handleInstances, handleCuratedInstances } from './domains/instances';
import { handleWorkspaceGet, handleWorkspaceUpdate } from './domains/workspaces';
// ... other domain imports

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    // Clean routing logic
    if (pathname === '/api/instances') return handleInstances(req, env);
    if (pathname === '/api/curated-instances') return handleCuratedInstances(req, env);
    if (pathname.startsWith('/api/workspaces/')) return routeWorkspace(req, env);
    // ... clean routing
  }
};
```

### Phase 3: Testing & Optimization (Enhancement)

#### 3.1 Domain-Specific Testing
Add targeted unit tests for extracted domains:

```typescript
// test/domains/instances.test.ts
describe('Instance CRUD', () => {
  it('should create instance', async () => {
    const mockEnv = createMockEnv();
    const req = createMockRequest('/api/instance', 'POST', validInstanceData);
    const response = await handleCreateInstance(req, mockEnv);
    expect(response.status).toBe(201);
  });
});
```

#### 3.2 Performance Optimization
- Tree-shake unused utilities through better imports
- Maintain bundle size within baseline (no significant growth)

#### 3.3 Documentation & Ownership
- Update docs only if behavior changes
- Note module ownership briefly (no new doc surfaces)

---

## Functional Requirements

### 1. Backward Compatibility
- ✅ All existing APIs continue to work unchanged
- ✅ Same request/response formats maintained
- ✅ Authentication/authorization unchanged

### 2. Domain Isolation
- ✅ Each domain module handles only its business logic
- ✅ No cross-domain dependencies in runtime code
- ✅ Shared utilities accessed via local shared modules

### 3. Deployment Simplicity
- ✅ Single Worker deployment remains (no worker-to-worker routing)
- ✅ Changes ship through one pipeline (no per-domain deploys)
- ✅ Rollback is whole-worker, consistent with current operations

### 4. Testing & Quality
- ✅ Targeted unit tests for extracted domain logic
- ✅ Small set of integration tests for critical cross-domain flows
- ✅ Verification focuses on regression prevention, not new gates

### 5. Performance & Scalability
- ✅ No worker-to-worker hops in request paths
- ✅ Cold start and latency remain within baseline (no regression)
- ✅ Bundle size stays stable (no significant growth)

---

## Technical Implementation Details

### Shared Modules (Local)

Keep shared utilities inside Paris to avoid package overhead:
```
paris/src/shared/
├── auth.ts                 # Authentication utilities
├── validation.ts           # Input validation
├── supabase.ts             # Database operations
├── types.ts                # TypeScript definitions
├── errors.ts               # Error handling
├── env.ts                  # Environment detection
└── index.ts                # Public API exports
```
No publishing step; modules are imported directly by domains.

### Routing Implementation

#### Internal Dispatch (Single Worker)
```typescript
// paris/src/index.ts
import { handleInstances, handleCuratedInstances } from './domains/instances';
import { routeWorkspace } from './domains/workspaces';

if (pathname === '/api/instances') return handleInstances(req, env);
if (pathname === '/api/curated-instances') return handleCuratedInstances(req, env);
if (pathname.startsWith('/api/workspaces/')) return routeWorkspace(req, env);
```
No worker-to-worker proxying in request paths.

### Migration Strategy Details

#### Phase 1 Timeline: 1 Week
- Create shared directory structure
- Extract 50 most-used utility functions
- Update imports within main file
- Verify no breaking changes

#### Phase 2 Timeline: 3 Weeks
- Create domain directory structure
- Extract instance domain (highest traffic)
- Extract workspace domain (most complex)
- Extract remaining domains (AI, L10n, Personalization)
- Update main router imports

#### Phase 3 Timeline: 1 Week
- Implement targeted unit testing
- Performance optimization and cleanup
- Documentation updates only if behavior changes

### Testing Strategy

#### Unit Testing per Domain
```typescript
// ai-paris/test/grants.test.ts
describe('AI Grants', () => {
  it('should issue grant for valid request', async () => {
    const mockEnv = createMockEnv();
    const req = createMockRequest('/api/ai/grant');

    const response = await handleAiGrant(req, mockEnv);
    expect(response.status).toBe(200);
  });
});
```

#### Integration Testing
```typescript
// test/integration/cross-domain.test.ts
describe('Cross-domain workflows', () => {
  it('should handle instance creation with workspace context', async () => {
    // Test full workflow across domains
  });
});
```

#### Performance Testing
- Cold start time within baseline (no regression)
- Bundle size within baseline (no significant growth)
- Memory usage within baseline

---

## Success Metrics

### Quantitative Metrics

#### Code Quality
- **LOC Reduction**: Main file reduced from 4,582 to <500 LOC routing
- **Domain Modules**: Each domain <800 LOC (instances ~600, workspaces ~700, AI ~400)
- **Test Coverage**: Targeted coverage increases for extracted domains
- **Bundle Size**: Single bundle within baseline (+5% max)
- **Cyclomatic Complexity**: <10 per function

#### Performance
- **Cold Start Time**: No regression from baseline (single Worker)
- **Response Time**: No degradation from baseline
- **Error Rate**: <1% (same as current)
- **Memory Usage**: No regression from baseline

#### Development Velocity
- **Deployment Frequency**: Single deployment surface, faster iterations
- **Time to Onboard**: New developer productive in 3 days
- **Bug Fix Time**: <1 hour for domain-specific bugs
- **Feature Development**: 2x faster with clear domain boundaries

### Qualitative Metrics

#### Developer Experience
- ✅ Clear domain ownership and boundaries
- ✅ Isolated testing and debugging
- ✅ Single deployment preserved
- ✅ Reduced cognitive load per domain

#### Operational Excellence
- ✅ Predictable operations with one deploy surface
- ✅ Fault isolation via code boundaries and logs
- ✅ Faster rollback via last-known-good deploy
- ✅ Clear logging and metrics by domain tag

---

## Risk Mitigation

### Technical Risks

#### Migration Complexity
- **Mitigation**: Phased extraction with no behavior changes
- **Testing**: Targeted integration tests for critical flows
- **Rollback**: Deploy last known good artifact and revert commit

#### Cross-Domain Dependencies
- **Mitigation**: Clear domain boundaries, shared utilities module
- **Communication**: Documented interfaces between domains
- **Testing**: Integration tests for cross-domain workflows

#### Performance Impact
- **Mitigation**: Baseline performance checks before/after each extraction
- **Optimization**: Focus on hot paths without cross-domain coupling
- **Monitoring**: Basic logging/metrics tagged by domain

### Business Risks

#### Service Disruption
- **Mitigation**: Zero-downtime deployment strategy
- **Testing**: Targeted staging smoke tests
- **Monitoring**: Real-time monitoring during rollout

#### Development Slowdown
- **Mitigation**: Parallel development during migration
- **Training**: Brief walkthrough of module layout
- **Documentation**: Notes kept minimal and only when behavior changes

---

## Rollout Plan

### Phase 1: Foundation (Week 1)
- Create shared utilities organization
- Extract common functions and types
- Establish domain boundaries and ownership
- Use existing test setup; add domain tests where needed

### Phase 2: Core Migration (Weeks 2-4)
- Extract all domains (instances, workspaces, AI, L10n, personalization)
- Update main router with domain imports
- Maintain single Worker deployment
- Targeted testing throughout

### Phase 3: Completion (Week 5)
- Performance optimization and cleanup
- Documentation updates only if behavior changes
- Production rollout

### Go-Live Criteria
- ✅ All domains extracted and tested
- ✅ Performance benchmarks met (no degradation)
- ✅ Single Worker deployment maintained
- ✅ Docs updated only if behavior changed

---

## Dependencies & Prerequisites

### Technical Dependencies
- Existing Paris worker deployment pipeline
- Existing lint/test tooling
- Baseline performance snapshot for comparison

### Team Dependencies
- Clear domain ownership assignment
- Alignment on domain boundaries and shared module conventions
- Brief walkthrough of the new folder structure

---

## Success Factors

### Technical Excellence
- **Modular Design**: Clear separation of concerns within single Worker
- **Testable Code**: Isolated unit testing capability per domain
- **Performance Preserved**: Zero overhead from modular organization
- **Maintainable Codebase**: Focused, understandable domains

### Business Impact
- **Faster Development**: Clear domain boundaries without deployment complexity
- **Reduced Risk**: Single deployment surface, simpler rollbacks
- **Better Reliability**: Same runtime isolation as current, clearer code boundaries
- **Cost Efficiency**: Single Worker scaling, shared resources

### Strategic Alignment
- **Engineering Excellence**: Elegant solution matching Cloudflare Workers architecture
- **Scalability**: Supports growth via a maintainable single-worker architecture
- **Developer Productivity**: Reduced cognitive load and faster onboarding
- **Future-Proof**: Architecture aligned with edge-first principles

---

This modular monolith approach transforms Paris from a **4,582 LOC development bottleneck** into a **maintainable, high-performance foundation** that preserves Cloudflare Workers architecture while enabling clear domain boundaries and isolated testing.

---

## Execution Plan: Paris Code Organization Uplevel

### Overview
**Timeline**: 5 phases (dependency-driven execution)
**Approach**: Incremental migration with zero downtime
**Verification**: Targeted tests and baseline performance checks
**Rollback**: Deploy last known good artifact and revert commit if needed

### Phase 1: Shared Utilities Organization

#### 1.1 Directory Structure Setup
```bash
# Create new directory structure
mkdir -p src/shared src/domains
mkdir -p test/domains test/integration
```

**Success Criteria**: Directory structure created, no breaking changes

#### 1.2 Extract Core Shared Utilities
**Target**: 50 most-used utility functions from main file

**Priority Order**:
1. **Authentication** (`src/shared/auth.ts`)
   - `requireEnv()`, `asBearerToken()`, `assertDevAuth()`

2. **Validation** (`src/shared/validation.ts`)
   - `isRecord()`, `isUuid()`, `assertWorkspaceId()`

3. **Database** (`src/shared/supabase.ts`)
   - `supabaseFetch()`, `requireTokyoBase()`

4. **Types** (`src/shared/types.ts`)
   - All interface definitions

5. **Errors** (`src/shared/errors.ts`)
   - `ckError()`, `apiError()`

**Implementation**:
```typescript
// src/shared/auth.ts
export function requireEnv(env: Env, key: keyof Env) { ... }
export function asBearerToken(header: string | null): string | null { ... }
export function assertDevAuth(req: Request, env: Env) { ... }
```

**Testing**: Unit tests for each shared utility

#### 1.3 Update Main File Imports
Replace inline definitions with imports:

```typescript
// Before
function requireEnv(env: Env, key: keyof Env) { ... }

// After
import { requireEnv } from './shared/auth';
```

**Success Criteria**:
- ✅ All imports updated
- ✅ No TypeScript errors
- ✅ All existing tests pass
- ✅ Bundle size unchanged (±5%)

#### 1.4 Verification
- **Performance Baseline**: Capture current cold start and bundle size for comparison
- **Smoke Checks**: Exercise a small set of critical endpoints
- **Code Review**: Verify boundaries and import paths

**Deliverables**:
- ✅ `src/shared/` directory with 50+ utility functions
- ✅ Updated main file imports
- ✅ Targeted tests for shared utilities (where reused heavily)
- ✅ Baseline captured for later regression checks

### Phase 2: Domain Extraction

#### 2.1 Domain Structure Creation
**Create domain directories**:
```bash
mkdir -p src/domains/{instances,workspaces,ai,l10n,personalization}
```

**Domain Mapping** (from main file analysis):
- **instances**: `handleInstances`, `handleCuratedInstances`, `handleCreateInstance`, `handleGetInstance`
- **workspaces**: `handleWorkspace*` functions (15+ handlers)
- **ai**: `handleAiGrant`, `handleAiOutcome`
- **l10n**: `handleL10n*` functions (6 handlers)
- **personalization**: `handlePersonalization*` functions (4 handlers)

#### 2.2 Extract Instance Domain
**Files to create**:
```
src/domains/instances/
├── crud.ts         # handleInstances, handleGetInstance, handleUpdateInstance
├── curated.ts      # handleCuratedInstances
├── create.ts       # handleCreateInstance
├── validation.ts   # Instance-specific validation
└── index.ts        # Public exports
```

**Implementation**:
```typescript
// src/domains/instances/crud.ts
export async function handleInstances(req: Request, env: Env): Promise<Response> {
  // Move logic from main file
}

// src/domains/instances/index.ts
export * from './crud';
export * from './curated';
export * from './create';
export * from './validation';
```

**Update main router**:
```typescript
// src/index.ts
import { handleInstances, handleCuratedInstances } from './domains/instances';

if (pathname === '/api/instances') return handleInstances(req, env);
if (pathname === '/api/curated-instances') return handleCuratedInstances(req, env);
```

#### 2.3 Extract Workspace Domain
**Most complex domain** (15+ handlers):
```
src/domains/workspaces/
├── management.ts      # CRUD operations
├── business-profile.ts # Business profile handlers
├── locales.ts         # Locale management
├── website-creative.ts # Website creative generation
└── index.ts
```

**Testing**: Comprehensive unit tests for workspace operations

#### 2.4 Extract Remaining Domains
**AI Domain**:
```
src/domains/ai/
├── grants.ts      # Grant issuance
├── policies.ts    # Policy resolution
├── budgets.ts     # Budget management
└── index.ts
```

**L10n Domain**:
```
src/domains/l10n/
├── status.ts      # Status reporting
├── generation.ts  # Queue management
├── publishing.ts  # Publish management
└── index.ts
```

**Personalization Domain**:
```
src/domains/personalization/
├── preview.ts     # Preview generation
├── onboarding.ts  # Onboarding workflows
└── index.ts
```

#### 2.5 Router Consolidation
**Clean up main routing logic**:
- Remove 1,000+ line routing switch
- Replace with clean domain-based routing
- Add comprehensive error handling

**Final router structure**:
```typescript
// src/index.ts
import { handleInstances, handleCuratedInstances } from './domains/instances';
import { handleWorkspaceGet, handleWorkspaceUpdate } from './domains/workspaces';
// ... other domain imports

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    // Health check
    if (pathname === '/api/healthz') return handleHealthz();

    // Domain routing
    if (pathname === '/api/instances') return handleInstances(req, env);
    if (pathname === '/api/curated-instances') return handleCuratedInstances(req, env);
    if (pathname.startsWith('/api/workspaces/')) return routeWorkspace(req, env);
    if (pathname.startsWith('/api/ai/')) return routeAI(req, env);
    if (pathname.startsWith('/api/l10n/')) return routeL10n(req, env);
    if (pathname.startsWith('/api/personalization/')) return routePersonalization(req, env);

    return json({ error: 'NOT_FOUND' }, { status: 404 });
  }
};
```

### Phase 3: Testing & Optimization

#### 3.1 Targeted Testing
**Unit Tests per Domain**:
```typescript
// test/domains/instances.test.ts
describe('Instance Domain', () => {
  describe('CRUD Operations', () => {
    it('should create instance', async () => {
      // Test implementation
    });
  });
});
```

**Integration Tests**:
```typescript
// test/integration/api.test.ts
describe('API Integration', () => {
  it('should handle full request flow', async () => {
    // End-to-end testing
  });
});
```

**Performance Tests**:
- Cold start time within baseline (no regression)
- Bundle size within baseline (no significant growth)
- Memory usage within baseline

#### 3.2 Code Quality & Optimization
- Keep existing lint and TS config; avoid introducing new global rules during the refactor.
- Remove dead code and unused utilities uncovered during extraction.
- Maintain bundle size by avoiding new dependencies.

### Verification & Risk Mitigation (Lightweight)

- **Targeted Checks**: Smoke a small set of critical endpoints after each extraction.
- **Baseline Comparison**: Compare cold start and bundle size to the captured baseline.
- **Rollback**: Deploy last known good artifact and revert commit if needed.
- **Monitoring**: Watch error rate and latency deltas during local and staging runs.

### Success Metrics Tracking

#### Code Quality Metrics
- **LOC Reduction**: Main file <500 LOC (from 4,582)
- **Domain Sizes**: Each domain <800 LOC
- **Test Coverage**: Targeted increases for extracted domains
- **Bundle Size**: Within baseline (+5% max)

#### Performance Metrics
- **Cold Start**: No regression from baseline
- **Response Time**: No increase from baseline
- **Memory Usage**: No regression from baseline
- **Error Rate**: <1%

#### Development Velocity
- **Build Time**: <30 seconds
- **Test Execution**: <2 minutes
- **Deployment Time**: <5 minutes

### Execution Dependencies

| Phase | Dependencies | Key Activities | Success Criteria |
|-------|--------------|----------------|------------------|
| 1 | None | Extract 50+ utilities, update imports | Targeted checks pass, baseline unchanged |
| 2 | Phase 1 complete | Create structure, extract all domains | Domain isolation working |
| 3 | Phase 2 complete | Clean routing logic, error handling | Main file <500 LOC |
| 4 | Phase 3 complete | Targeted verification, optimization | Baseline checks complete |
| 5 | Phase 4 complete | Final validation and deploy | Ready for deployment |

### Dependencies & Resources

#### Team Resources
- **1 Lead Engineer**: Overall coordination, architecture decisions
- **2-3 Engineers**: Domain extraction and testing
- **DevOps Support (optional)**: Only if pipeline tweaks are required

#### Technical Dependencies
- **TypeScript (current repo version)**: No config changes required
- **Node.js 18+**: Build system compatibility
- **Wrangler 3.0+**: Cloudflare Workers deployment
- **Vitest**: Testing framework for isolated tests

#### External Dependencies
- **Supabase**: Database connectivity (no changes)
- **Cloudflare Workers**: Runtime environment (no changes)
- **Existing APIs**: Backward compatibility maintained

### Communication Plan

#### Daily Standups
- Progress updates
- Blocker identification
- Verification findings

#### Weekly Reviews
- Architecture decisions
- Baseline deltas
- Risk assessment

#### Documentation Updates
- Update docs only if behavior changes
- Add a short note on the new module layout

This execution plan provides a **clear, measurable path** to transform Paris from a monolithic bottleneck into a modular, maintainable system while preserving performance and operational simplicity.
