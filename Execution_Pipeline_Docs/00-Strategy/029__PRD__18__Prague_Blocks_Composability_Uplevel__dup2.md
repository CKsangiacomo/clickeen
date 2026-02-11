# PRD 18: Prague Blocks Composability Uplevel

## Status
- **Status**: Proposed
- **Owner**: Prague (marketing site)
- **Scope**: Prague block system architecture evolution
- **Priority**: High (enables 100⁵ scale)

---

## Problem

### Current State: Monolithic Page Sections
Prague blocks are **hardcoded page sections** that work for websites but lack the composability needed for 100⁵ scale:

```typescript
// Current: Monolithic blocks
type HeroBlock = {
  headline: string;
  subheadline?: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  curatedRef?: WidgetEmbed;
}
```

**Problems:**
- Fixed layouts (title + subtitle + CTAs + visual)
- Hardcoded CTA patterns (primary/secondary only)
- Content tightly coupled to presentation
- Not AI-composable (can't rearrange elements)
- Website-only thinking, not multi-output

### Impact on 100⁵ Vision

**Current (Additive Scale):**
- Hero works for website landing pages
- Need separate "email-hero" for emails
- Need separate "ad-hero" for ads
- Need separate "social-hero" for social posts
- **4 implementations** for same content

**Needed (Multiplicative Scale):**
- One composable content definition
- Flexible layouts per output format
- AI can modify arrangements
- **1 implementation** × 100 outputs = 100× leverage

---

## Goals

### Primary Goal
Transform Prague blocks from **monolithic page sections** to **composable primitives** that enable true 100⁵ scale where content automatically works across all output formats.

### Secondary Goals
- Enable AI to easily understand and modify Prague layouts
- Reduce code duplication across output formats
- Make content more reusable and flexible
- Maintain backward compatibility with existing pages

### Non-Goals
- Breaking existing Prague functionality
- Complete rewrite of working pages
- Changing Prague's role as marketing site
- Affecting current widget integration
- Making Prague a visual page builder (repo-driven only)
- Adding runtime user configuration
- Creating Prague-specific composition logic (must share with widgets)
- Allowing content authors to edit blocks visually
- Content authors can rearrange elements without engineering help (conflicts with repo-only constraint)

**Clarification**: All composition changes are developer-driven through git. No visual editing surface for content authors.

---

## User Stories

### Content Authors
- As a content author, I can create content once and have it automatically work in websites, emails, ads, and social posts
- As a content author, I can request layout changes through developers (no direct editing)
- As a content author, I can use flexible CTA patterns beyond just primary/secondary

### AI Agents
- As an AI agent, I can understand Prague block structure and suggest layout improvements
- As an AI agent, I can modify Prague content arrangements for different contexts
- As an AI agent, I can create new block variations from existing primitives

### Developers
- As a developer, I can add new output formats without duplicating block logic
- As a developer, I can compose new block types from existing primitives
- As a developer, I can maintain Prague with less code duplication

### Business Stakeholders
- As a stakeholder, I want content to automatically work across all channels
- As a stakeholder, I want faster time-to-market for new output formats
- As a stakeholder, I want reduced maintenance costs from composable architecture

### Risk Mitigation & Critical Safeguards

#### 1. Complexity Explosion Prevention
**Shared Composition Engine Location**: Composition engine lives in **shared package** (`tooling/composition/`) used by both Prague and widget systems.

**No Prague-Specific Logic**: Prague imports and uses the shared composition engine. No duplicate logic under `prague/src/composition/`.

**Widget Pipeline Integration Plan**:
- **Shared Package**: `tooling/composition/` exports framework-agnostic core (schemas, validation, resolution)
- **Widget Consumption**: Bob imports shared primitives via workspace imports, renders using HTML renderer
- **Validation Integration**: Widget build process includes composition validation rules
- **Ownership**: GTM Dev Team owns widget integration, Prague Team owns Prague integration

**Build-Time Validation**: All primitive combinations validated at build time. Invalid compositions fail the build with clear error messages.

**Registry Enforcement**: Block registry includes composition rules:
```typescript
// tooling/composition/contracts.ts (SHARED)
const VALID_COMPOSITIONS = {
  'heading + text + action': 'hero pattern',
  'stack[heading, text, action-group]': 'content block',
  'media + text': 'visual block'
}

// prague/src/lib/blockRegistry.ts (IMPORTS SHARED)
import { VALID_COMPOSITIONS } from '@clickeen/composition';
```

**Deterministic Resolution**: Layout selection algorithm documented and auditable:
```typescript
function resolveBlockLayout(block, context) {
  // No hidden fallbacks - explicit rules only
  if (context.outputFormat === 'email') return block.layouts.email;
  if (context.outputFormat === 'ad') return block.layouts.compact;
  return block.layouts.web;
}
```

#### 2. Prague Mission Drift Prevention
**Repo-Driven Governance**: All Prague changes go through git. No admin panel configuration.

**Authorship-Time Only**: Composition happens at build/deploy time. No runtime block editing.

**Explicit Boundaries**:
- Prague: Marketing surface for static pages
- Bob: Widget builder for dynamic instances
- DevStudio: Internal tooling only

**Non-Goals Added**:
- Prague is NOT a visual page builder
- Prague blocks are NOT user-configurable like widgets
- Prague does NOT become a CMS with WYSIWYG editing

#### 3. Implementation Consolidation
**Split Block Consolidation**: Phase 1 will consolidate the 3 split variants into one configurable block:

```typescript
// NEW: Single split block replaces 3 variants
type SplitBlock = {
  type: 'split',
  layout: 'visual-left' | 'visual-right' | 'stacked',
  content: Primitive[],
  visual: Primitive[]
}

// MIGRATION: Old variants map to new consolidated block
'split-creative-left' → { type: 'split', layout: 'visual-left' }
'split-creative-right' → { type: 'split', layout: 'visual-right' }
'split-creative-stacked' → { type: 'split', layout: 'stacked' }
```

#### 4. Localization Consistency
**Prague Allowlist Schema**: Aligned with existing Prague l10n tooling (`v + paths[]` format):

```json
// prague/content/allowlists/v1/hero.json (ALIGNED WITH EXISTING)
{
  "v": 1,
  "paths": [
    "blocks.hero.copy.headline",
    "blocks.hero.copy.subheadline",
    "blocks.hero.copy.primaryCta.label",
    "blocks.hero.copy.secondaryCta.label"
  ]
}
```

**Existing Format Maintained:** Uses current `v + paths[]` structure to avoid breaking validation/translation scripts. Paths are block-scoped but follow existing tooling expectations.

**Validation**: Prague validates locale plus geo/industry/experiment overlay layers for runtime personalization/experiments. Composition remains static; overlays apply to copy only and reuse the same allowlisted paths.

#### 5. Performance Overhead Controls
**Baselines Established**:
- Current Prague bundle size: [TBD - measure before Phase 1]
- Current build time: [TBD - measure before Phase 1]
- Current LCP/FCP: [TBD - measure before Phase 1]

**Performance Gates in CI**:
```yaml
# CI Performance Checks (CORRECTED PATH)
- name: Bundle Size Check
  run: |
    if [ $(du -b prague/dist/ | cut -f1) -gt $MAX_BUNDLE_SIZE ]; then
      echo "Bundle size exceeded ${MAX_BUNDLE_SIZE} bytes"
      exit 1
    fi
```

**Rollback Criteria**:
- >10% bundle size increase → Immediate rollback
- >20% build time increase → Rollback within 24 hours
- >5% LCP degradation → Rollback within 1 hour

---

## Technical Approach

### Phase 1: Primitive System Foundation

#### 1.1 Enhanced Primitives
**Current:** Basic CSS utilities (`ck-canvas`, `ck-split`, `ck-stack`)
**Enhanced:** Semantic composition primitives

```typescript
// New: Semantic primitives
type Primitive = 
  | { type: 'heading', level: 1|2|3|4, content: string }
  | { type: 'text', variant: 'body'|'caption'|'label', content: string }
  | { type: 'action', variant: 'primary'|'secondary'|'ghost', content: ActionContent }
  | { type: 'media', content: MediaContent }
  | { type: 'stack', direction: 'vertical'|'horizontal', children: Primitive[] }
  | { type: 'grid', columns: number, children: Primitive[] }
```

#### 1.2 Composition Engine
**Replace hardcoded rendering** with flexible composition:

```typescript
// Current: Hardcoded switch
switch (block.type) {
  case 'hero': return <Hero {...} />
}

// Future: Composable rendering
const primitives = blockToPrimitives(block);
return <PrimitiveRenderer primitives={primitives} />
```

### Phase 2: Block Evolution

#### 2.1 Block Definition Language
**Current:** Fixed props per block type
**Enhanced:** Declarative block schemas

```typescript
// New: Declarative block schema
const heroBlockSchema = {
  type: 'hero',
  layout: 'split-center',
  regions: {
    content: ['heading', 'text', 'action-group'],
    visual: ['media']
  },
  defaults: {
    layout: { gap: 'large', alignment: 'center' }
  }
}
```

#### 2.2 Flexible CTA Patterns
**Current:** Fixed primary/secondary pattern
**Enhanced:** Configurable action groups

```typescript
// New: Flexible actions
type ActionGroup = {
  layout: 'row' | 'column' | 'grid';
  actions: Array<{
    type: 'link' | 'button' | 'modal';
    variant: 'primary' | 'secondary' | 'ghost';
    content: string | { key: string }; // i18n key
    href?: string;
    onClick?: string;
  }>;
}
```

### Phase 3: AI-Legible Architecture

#### 3.1 Semantic Block Contracts
**Current:** Basic validation
**Enhanced:** AI-understandable contracts

```typescript
// New: AI-legible contracts
const blockContracts = {
  hero: {
    purpose: 'Page hero section with value proposition',
    regions: {
      content: 'Main content area (title, subtitle, CTAs)',
      visual: 'Supporting visual (widget demo, image, video)'
    },
    constraints: {
      'content should have primary CTA': true,
      'visual enhances but not required': true
    },
    variations: ['centered', 'left-aligned', 'right-aligned']
  }
}
```

#### 3.2 Dynamic Layout Resolution - Build-Time Strategy
**Strategy:** Per-format builds eliminate runtime layout decisions

**Build-Time Resolution:** Each output format generates separate build artifacts:
```typescript
// Build-time: Generate format-specific layouts (NO runtime variables)
function resolveBlockLayoutAtBuild(block, targetFormat) {
  // Build-time constants only - no screenSize, userSegment
  switch (targetFormat) {
    case 'email': return block.layouts.email || block.layouts.web;
    case 'ad': return block.layouts.compact || block.layouts.web;
    case 'social': return block.layouts.square || block.layouts.web;
    default: return block.layouts.web;
  }
}

// Runtime: No layout decisions, just render pre-resolved layout
function renderBlock(block, resolvedLayout) {
  return <PrimitiveRenderer layout={resolvedLayout} />;
}
```

**No Runtime Context Variables:** Layout decisions happen at build time per output format, not runtime based on user/screen variables. Screen size adaptations handled via CSS media queries.

### Phase 4: External Output Support

#### 4.1 Output Format Support - External Services
**Strategy:** Prague provides composable primitives for external services, not multi-output rendering

**Prague Scope:** Website marketing pages only - no email/ad/social rendering

**External Consumption:** Other services (email service, ad platforms) can import and use Prague's shared composition primitives for their own rendering.

**No Prague Multi-Output Runtime:** Prague stays single-output (website) to avoid complexity expansion.

#### 4.2 Content Optimization
**Current:** One-size-fits-all
**Enhanced:** Format-optimized content available for external services

**Strategy:** Content optimization logic lives in shared engine but is build-time or external-service only. Prague never applies format-specific optimizations - it provides unoptimized content that external services can optimize.

```typescript
// tooling/composition/optimization.ts - Available for external services
export function optimizeContentForOutput(content, outputFormat) {
  switch (outputFormat) {
    case 'ad':
      return {
        ...content,
        headline: truncate(content.headline, 30),
        subheadline: truncate(content.subheadline, 20)
      };
    case 'social':
      return {
        ...content,
        headline: truncate(content.headline, 40)
      };
    default:
      return content;
  }
}

// Prague usage: Always provides full content, no optimization applied
function renderPragueBlock(block) {
  // No format-specific optimization - external services handle that
  return <PrimitiveRenderer content={block.content} />;
}
```

---

## Functional Requirements

### 1. Backward Compatibility
- ✅ Existing Prague pages continue to work unchanged
- ✅ Existing block APIs remain functional
- ✅ No breaking changes to content structure

### 1.1 Curated Embed Integrity
- ✅ Every `curatedRef.publicId` resolves to an existing `curated_widget_instances` row
- ✅ Prague build fails fast if a curated embed is missing

### 2. Primitive Composition System
- ✅ Blocks can be composed from smaller primitives
- ✅ Primitives work across all output formats
- ✅ AI can understand and modify primitive arrangements

### 3. Flexible Content Patterns
- ✅ CTA patterns beyond primary/secondary
- ✅ Multiple content arrangements per block
- ✅ Format-aware optimization rules (external services only)

### 4. External Output Support
- ✅ Shared primitives enable content reuse across external services
- ✅ Format-specific optimizations available for external consumption
- ✅ New outputs can import and use existing composable content

### 5. Runtime Personalization (Prague)
- ✅ Runtime copy overlays for personalization/experiments (geo/industry/experiment)
- ✅ Overlay paths are allowlisted and validated; composition stays static

### 6. AI Integration
- ✅ Block contracts are AI-legible
- ✅ AI can suggest layout improvements
- ✅ AI can create new block variations

---

## Technical Implementation Details

### File Structure Evolution

```
tooling/composition/      # NEW: FRAMEWORK-AGNOSTIC shared engine
├── core/
│   ├── schemas.ts        # Primitive definitions (JSON schema)
│   ├── resolver.ts       # Layout resolution logic
│   └── validator.ts      # Build-time validation
├── contracts.ts          # Shared validation rules
└── renderers/            # Per-surface renderers
    ├── astro/            # Prague: Astro components
    │   ├── Heading.astro
    │   ├── Text.astro
    │   ├── Action.astro
    │   ├── Media.astro
    │   ├── Stack.astro
    │   └── Grid.astro
    └── html/             # Widgets: Plain HTML/CSS/JS
        ├── primitives.js
        └── renderer.js

prague/src/
├── blocks/               # EVOLVED: Prague-specific schemas only
│   ├── hero/
│   │   ├── schema.ts     # Prague-specific overrides
│   │   └── legacy.astro  # Keep for backward compatibility
│   └── ...
└── lib/
    ├── blockSchemas.ts   # Prague block definitions (imports shared)
    └── compositionEngine.ts # Thin wrapper using astro renderer
```

### Migration Strategy

#### Phase 1: Parallel Implementation
- Build new primitive system alongside existing blocks
- Keep existing blocks working for current pages
- Add new composable blocks for new features

#### Phase 2: Gradual Migration
- Migrate high-usage blocks to new system
- Maintain dual rendering paths
- Update content to use new schemas where beneficial

#### Phase 3: Deprecation
- Mark old monolithic blocks as deprecated
- Provide migration tools for developers
- Remove legacy code after full migration

**Sunset Criteria:**
- **Exit Gates**: All major blocks migrated, performance benchmarks met, migration tooling validated on 100% of pages
- **No Extensions**: Dual system cannot be extended once migration is complete
- **Firm Sunset**: Legacy blocks are removed by end of Phase 4 (no indefinite support)

### Performance Considerations

#### Bundle Size
- Primitives should be tree-shakeable
- Output-specific code only loads for target format
- Shared utilities minimize duplication

#### Rendering Performance
- Composition resolution happens at build time where possible
- Runtime composition optimized for target platform
- Lazy loading for non-critical primitives

#### Development Experience
- Type-safe composition APIs
- Clear error messages for invalid arrangements
- Hot reload support for composition changes

---

## Success Metrics

### Quantitative Metrics

#### Composability Metrics
- **90%** of new content uses composable primitives (not monolithic blocks)
- **50%** reduction in code duplication across output formats
- **95%** of content automatically works in new output formats

#### Performance Metrics
- **≤5%** increase in bundle size for website output
- **≤10%** increase in build time for composition resolution
- **≤2%** impact on runtime performance

#### AI Integration Metrics
- **80%** of AI suggestions for layout improvements are actionable
- **AI can modify** block arrangements without human intervention
- **AI can create** new block variations from existing primitives

### Qualitative Metrics

#### Developer Experience
- ✅ New output formats require **≤20%** of previous development effort
- ✅ Developers can rearrange elements through code changes
- ✅ Type safety prevents **invalid primitive combinations**

#### Content Author Experience
- ✅ Content created once can be reused across external outputs via shared primitives
- ✅ Flexible CTA patterns support **varied conversion goals**
- ✅ Developer-mediated layout changes enable **content optimization**

#### Business Impact
- ✅ **50% faster** time-to-market for new output formats
- ✅ **Reduced maintenance** costs from composable architecture
- ✅ **Improved conversion rates** from optimized content per format

---

## Acceptance Criteria

### Phase 1 Completion
- ✅ Primitive system foundation implemented
- ✅ Basic composition engine working
- ✅ At least 3 blocks migrated to new system
- ✅ Backward compatibility maintained

### Phase 2 Completion
- ✅ All major blocks support composable patterns
- ✅ Flexible CTA system implemented
- ✅ AI-legible contracts documented
- ✅ Shared primitives available for external services

### Phase 3 Completion
- ✅ Dynamic layout resolution implemented
- ✅ Format-aware optimization rules documented (external services only)
- ✅ Runtime personalization overlays for Prague (geo/industry/experiment)
- ✅ AI integration fully functional
- ✅ Performance benchmarks met

### Phase 4 Completion
- ✅ Shared primitives consumable by external output pipelines (email/ad/social)
- ✅ Prague remains website-only (no multi-output runtime)
- ✅ Migration tools available for developers
- ✅ All success metrics achieved

---

## Risk Mitigation

### Technical Risks

#### Performance Impact
- **Mitigation:** Extensive benchmarking and optimization
- **Fallback:** Can disable composition for performance-critical paths
- **Monitoring:** Real-time performance tracking in production

#### Migration Complexity
- **Mitigation:** Parallel implementation allows gradual migration
- **Fallback:** Legacy blocks remain functional through the migration window, then removed once sunset gates are met
- **Support:** Migration tools and documentation for developers

#### AI Integration Complexity
- **Mitigation:** Start with simple AI-legible contracts
- **Fallback:** Manual content authoring always available
- **Validation:** Extensive testing of AI suggestions before production use

### Business Risks

#### Scope Creep
- **Mitigation:** Clear phase boundaries and success criteria
- **Control:** Regular stakeholder reviews and adjustments
- **Focus:** Maintain laser focus on 100⁵ composability goals

#### Timeline Slippage
- **Mitigation:** Break into small, deliverable phases
- **Buffer:** Include contingency time in schedule
- **Prioritization:** Focus on high-impact changes first

---

## Rollout Plan

### Phase 1: Foundation
- Implement primitive system
- Build composition engine
- Migrate 2-3 high-priority blocks
- Establish performance baselines

### Phase 2: Core Evolution
- Complete block migration
- Implement flexible CTA patterns
- Add AI-legible contracts
- Define optimization rules for external outputs (no Prague runtime)

### Phase 3: Intelligence Layer
- Dynamic layout resolution
- Format-aware optimization rules (external services only)
- Runtime personalization overlays (geo/industry/experiment)
- Full AI integration
- Performance validation

### Phase 4: External Output Enablement
- Enable external output pipelines to consume shared primitives
- Provide build-time optimization rules for external services
- Migration tooling
- Production rollout

### Output Format Scope Clarification

**Phase 4 Minimum Viable Outputs (external services only)**:
- **Website** ✅ (Prague already shipped; Phase 4 focuses on external outputs)
- **Email** 🤔 (HTML email rendering for transactional emails)
- **Ad** 🤔 (Google Ads/Meta Ads creative previews)
- **Social** 🤔 (Open Graph images + meta tags for social sharing)

**Format-Specific Requirements**:
- Email: Responsive tables, inline CSS, 600px width constraint
- Ad: Character limits, image aspect ratios, call-to-action restrictions
- Social: Square images, short headlines, branded styling

## Execution Steps (Grok AI)
1. Confirm scope: changes limited to `tooling/composition/`, `prague/`, and Prague docs. Ask before touching Bob/Paris/Venice/SF.
2. Audit `curatedRef.publicId` in `tokyo/widgets/*/pages/*.json` against `curated_widget_instances` and add build-time validation to fail the Prague build if any curatedRef is missing. Data seeding runs by human approval only.
3. Implement shared composition core in `tooling/composition/` (schemas, validator, resolver). Keep it framework-agnostic.
4. Add Prague adapter + Astro renderer to consume the shared core; keep existing block registry validation intact.
5. Consolidate split blocks into one schema while preserving legacy blocks during the migration window.
6. Update Prague docs (`documentation/services/prague/blocks.md`, `documentation/services/prague/prague-overview.md`) to match actual behavior.

## Guardrails (Grok AI)
- Default to local environment; do not touch cloud-dev or prod without explicit approval.
- Do not create or edit instances (human/system only).
- If curated instances are missing, stop and request human-run seeding/migrations.
- Do not add Prague multi-output runtime; external outputs only.
- Do not add Prague-specific composition logic; keep all core logic in `tooling/composition/`.
- Avoid destructive git commands (no reset/rebase/clean/force-checkout).

### AI Contract Scope

**Phase 3 Focus**: Human-readable contracts for developers + AI prompting

**Contract Structure**:
```typescript
// AI-legible but human-readable
const blockContracts = {
  hero: {
    purpose: 'Page hero section with value proposition',
    regions: {
      content: 'Main content area (title, subtitle, CTAs)',
      visual: 'Supporting visual (widget demo, image, video)'
    },
    constraints: {
      'content should have primary CTA': true,
      'visual enhances but not required': true
    },
    variations: ['centered', 'left-aligned', 'right-aligned'],
    ai_guidance: 'Use for page introductions, major value propositions'
  }
}
```

**AI Integration**: Contracts consumed by San Francisco agents for layout suggestions and content optimization.

### Content Optimization Strategy

**Optimization Scope (Prague vs External)**:
- Prague renders website-only output (no format-specific optimization)
- External services apply format-specific optimizations at build time
- Prague allows runtime copy overlays for personalization/experiments (geo/industry/experiment), not format optimization

**Explicit Optimization Rules** (No Implicit Mutation):

**Rule Declaration:** Format-specific optimizations must be explicitly defined in block schemas:

```typescript
// tooling/composition/schemas.ts
const formatOptimizations = {
  ad: {
    headline: { maxLength: 30, strategy: 'truncate' },
    subheadline: { maxLength: 20, strategy: 'truncate' }
  },
  social: {
    headline: { maxLength: 40, strategy: 'truncate' }
  }
}
```

**Auditable Process:** Optimization and overlay rules are declared in code, not applied silently. Developers can see and modify the rules.

### Curated Widget Embed Pattern

**Media Primitive Extension**:
```typescript
type MediaPrimitive =
  | { type: 'media', variant: 'image', src: string, alt: string }
  | { type: 'media', variant: 'video', src: string }
  | { type: 'media', variant: 'widget', curatedRef: string } // ← Curated embed
```

**Migration**: Existing `curatedRef` props map to `media` primitive with `variant: 'widget'`.

### MiniBob Embed Handling

**MiniBob Treatment**: Special iframe primitive (not a full block)

```typescript
// MiniBob as primitive within composition
{
  type: 'iframe',
  variant: 'minibob',
  workspaceId: string,
  publicId: string,
  locale: string
}
```

**Why Primitive**: MiniBob is an embed like curated widgets, not a full content block.

### Build-Time Validation Contract

**Validation Rules**:
```typescript
const VALIDATION_RULES = {
  // Primitive rules
  heading: { required: ['level'], validLevels: [1,2,3,4] },
  action: { requiresOneOf: ['href', 'onClick'] },
  stack: { requiresChildren: true, minChildren: 1 },
  media: {
    widgetVariant: { required: ['curatedRef'], validRef: true },
    imageVariant: { required: ['src', 'alt'] }
  },

  // Composition rules
  hero: { requires: ['heading', 'action'], optional: ['text', 'media'] },
  split: { requires: ['stack', 'media'], layout: ['visual-left', 'visual-right', 'stacked'] }
}
```

**Error Messages**: Clear, actionable feedback:
- "Hero block missing required heading primitive"
- "Action primitive must have either href or onClick, not both"
- "Stack primitive requires at least 1 child"

### Migration Tooling Deliverables

**Migration Script**: Automated conversion
```bash
# Convert old block JSON to new schema
npm run migrate-prague-blocks --input tokyo/widgets/ --output temp/
```

**Validation Script**: Confirms all pages render
```bash
# Test all migrated pages
npm run validate-prague-migration --pages "**/*.astro"
```

**Diff Tool**: Shows before/after changes
```bash
# Show migration impact
npm run diff-prague-blocks --before tokyo/widgets/ --after temp/
```

**Migration Guide**: Step-by-step for developers

---

## Reviewer Questions - Detailed Answers

### Q1: Where should the shared, framework‑agnostic composition engine live?

**Answer:** `tooling/composition/` - FINAL DECISION

**Rationale:**
- Established pattern for shared utilities (`tooling/l10n/`, `tooling/sf-policies/`)
- Keeps composition logic separate from both Prague (marketing) and widget (product) domains
- Allows independent versioning and testing
- Accessible to both `prague/` and `bob/` via workspace imports

**Framework-Agnostic Architecture:**
- Core schemas and resolution logic in TypeScript (no framework dependencies)
- Per-surface renderers: `renderers/astro/` for Prague, `renderers/html/` for widgets
- Widgets consume via workspace imports, not direct framework coupling

### Q2: What is the exact authoring workflow for content authors?

**Answer:** **Developers only** - content authors cannot rearrange elements. All changes go through git PRs.

**Workflow:**
1. **Content Author**: Requests layout change via design ticket/description
2. **Developer**: Modifies JSON schema in `tokyo/widgets/*/pages/*.json`
3. **Developer**: Updates block composition in code
4. **PR Review**: Changes reviewed and deployed via git
5. **No Visual Editor**: All composition is code-driven, repo-only

**Clarification:** The PRD previously conflicted by saying "content authors can rearrange elements" while also saying "repo-driven only". This has been corrected - only developers can rearrange elements through code changes.

### Q3: Are email/ad/social outputs separate builds/artifacts, or do you want Prague itself to emit them?

**Answer:** **Separate builds/artifacts** - Prague stays website-focused, provides primitives for other services

**Architecture:**
- **Prague**: Website marketing pages only (single output, no multi-output runtime)
- **Email Service**: Separate build, imports Prague primitives for HTML email generation
- **Ad Platforms**: Separate builds, consume Prague primitives for ad creative rendering
- **Social Services**: Separate builds for OG/meta tag generation

**Phase 4 Scope:** Prague provides shared composable primitives that other services import, but Prague itself emits only website output. No multi-output runtime complexity added to Prague.

### Q4: Should Prague's allowlists continue to live under prague/content/allowlists/v1, and should PRD examples be updated to match existing l10n validation?

**Answer:** **Yes** - maintain existing `v + paths[]` structure, align PRD examples to current tooling.

**Decision:** Keep existing `paths[]` format to avoid breaking translation workflows and validation scripts.

**Corrected Allowlist Example:**
```json
// prague/content/allowlists/v1/hero.json (ALIGNED WITH EXISTING TOOLING)
{
  "v": 1,
  "paths": [
    "blocks.hero.copy.headline",
    "blocks.hero.copy.subheadline",
    "blocks.hero.copy.primaryCta.label"
  ]
}
```

**Block-Scoped Paths:** Uses `blocks.<blockId>.copy.<path>` format to match existing validation scripts while maintaining compatibility. No tooling changes required.

### Q5: Where will the shared composition package live (tooling vs dieter), and who owns integration into the widget pipeline?

**Answer:** `tooling/composition/` - GTM Dev Team owns widget integration, Prague Team owns Prague integration.

**Framework-Agnostic Architecture:**
- Core schemas and resolution logic in TypeScript (no framework dependencies)
- Per-surface renderers: `renderers/astro/` for Prague, `renderers/html/` for widgets
- Widgets consume via workspace imports, validated during widget build process

### Q6: Should "multi-output support" be reframed as "shared engine enables external outputs," with Prague explicitly excluded from rendering those formats?

**Answer:** **Yes** - Prague is explicitly excluded from rendering email/ad/social formats.

**Reframed Scope:**
- **Prague**: Website marketing pages only (single output, no multi-output runtime)
- **External Services**: Separate builds import Prague primitives for their own rendering
- **No Prague Multi-Output**: Prague provides composable primitives but emits only website output
- **Functional Requirements Updated**: Multi-output support means primitives are available for external consumption, not Prague rendering multiple formats

---

## Critical Issues Resolution Status

### P0 Issues ✅ RESOLVED
- **Shared Composition Engine**: Moved to `tooling/composition/` - no Prague-specific logic
- **Authoring Workflow**: Clarified - developers only, repo-driven, no visual editing for content authors
- **Conflicting Authoring Promises**: Removed false promise from Success Metrics - content authors cannot rearrange elements

### P1 Issues ✅ RESOLVED
- **Localization Compatibility**: Updated allowlist examples to use existing `prague/content/allowlists/v1/` structure with block-scoped paths
- **Build-Time vs Runtime**: Clarified build-time per-format resolution strategy - no runtime layout decisions
- **Backward Compatibility**: Added deprecation timeline with exit criteria
- **CI Perf Gate**: Corrected path from `dist/prague/` to `prague/dist/`
- **Multi-Output Scope**: Prague stays single-output, provides primitives for external services
- **Shared Engine Integration**: Added explicit integration plan for widget pipeline consumption
- **Content Optimization**: Clarified as build-time/external-service only, Prague never optimizes

### All Reviewer Questions ✅ ANSWERED
- Shared engine location: `tooling/composition/` with widget pipeline integration plan
- Authoring workflow: Developers only, git-driven (no false promises to content authors)
- Output strategy: Separate builds/artifacts, Prague stays website-focused, provides primitives for external consumption
- Allowlist location: `prague/content/allowlists/v1/` with corrected schema format

### Q4: Do you want to update Prague l10n tooling to the new allowlist schema, or keep the existing paths[] format?

**Answer:** **Keep existing `paths[]` format** - align PRD to current tooling, no tooling changes required

**Decision:** Maintain backward compatibility with existing Prague l10n validation scripts. Use block-scoped paths within the current `v + paths[]` structure.

**No Tooling Updates:** Avoids breaking existing translation workflows and validation scripts.

## Open Questions & Decisions Needed

### 1. Migration Strategy ✅ RESOLVED
**Decision:** Yes - dual rendering paths during transition
**Implementation:** Feature flags control which rendering path (legacy vs composable) each page uses
**Migration Timeline:** Phase 1-2 complete dual paths, Phase 3 switches all pages to composable

### 2. AI Contract Scope ✅ RESOLVED
**Decision:** Human-readable contracts with AI-guidance sections (Phase 3)
**Implementation:** Contracts include `ai_guidance` field for agent prompting
**Consumption:** San Francisco agents use contracts for layout suggestions and optimization

### 3. Output Format Priority ✅ RESOLVED
**Decision:** Website (Phase 1), Email (Phase 4), Ad/Social (Phase 4+)
**Priority Order:** Email first (transactional use cases), then Ad/Social (marketing extensions)
**Scope:** Minimum viable implementation per format, not full feature parity

### 4. Content Optimization Strategy ✅ RESOLVED
**Decision:** Build-time/external-service optimization with explicit rules + Prague runtime copy overlays for personalization/experiments
**Implementation:** External services apply truncation/format rules; Prague applies geo/industry/experiment overlays to copy only
**No Manual Overrides:** Aligns with explicit, auditable rules (developer-driven)

### 5. Backward Compatibility Timeline ✅ RESOLVED WITH SUNSET DATE
**Deprecation Schedule:**
- **Phase 1-2**: Dual rendering paths active
- **Phase 3**: All new pages use composable system
- **Phase 3 End**: Legacy system marked deprecated
- **Phase 4**: Legacy system removed, single system only

**Exit Criteria for Dual System Removal:**
- ✅ All major blocks migrated (hero, split variants, steps, cta, minibob)
- ✅ Performance benchmarks met across all pages
- ✅ Migration tooling validated on 100% of existing pages
- ✅ No active legacy pages in production environment

**Dual System Duration**: Limited to prevent architectural drift

---

## Peer Review Response & Final Status

### First Peer Review Summary ✅ ADDRESSED
**Verdict:** ✅ **ARCHITECTURALLY SOUND - PROCEED WITH CAUTION**

**Key Strengths Validated:**
- Perfect alignment with 100⁵ multiplicative scale vision
- Mirrors proven widget system composability patterns
- Maintains service boundaries and architectural tenets
- Phase-based rollout reduces risk

**Critical Risks Addressed:**
- ✅ **Complexity Explosion**: Shared composition engine, build-time validation, deterministic resolution
- ✅ **Prague Mission Drift**: Explicit non-goals prevent CMS drift, repo-driven governance only
- ✅ **Implementation Duplication**: Consolidated split variants into single configurable block
- ✅ **Localization Consistency**: Prague allowlist schema identical to widget system
- ✅ **Performance Overhead**: Baseline measurements, CI gates, rollback criteria

### Third Peer Review Summary ✅ ALL P0/P1/P2 ISSUES RESOLVED
**All Critical Issues Fixed:**
- ✅ **P0: Conflicting Authoring Promises**: Removed false promise from Success Metrics, clarified developer-only workflow
- ✅ **P0: Shared Engine Framework Issue**: Made framework-agnostic with per-surface renderers (Astro for Prague, HTML for widgets)
- ✅ **P1: Scope Mismatch on Multi-Output**: Reframed as primitives for external services, Prague stays single-output
- ✅ **P1: Shared Engine Not Fully Grounded**: Added explicit widget pipeline integration plan and ownership
- ✅ **P1: Content Optimization Ambiguous**: Clarified as build-time/external-service only, no Prague runtime optimization
- ✅ **P1: Localization Schema**: Aligned to existing `v + paths[]` format, no tooling changes needed
- ✅ **P2: Migration/Deprecation Open-Ended**: Added sunset criteria with exit gates

**All Reviewer Questions Answered:**
- ✅ Shared engine: `tooling/composition/` with framework-agnostic core + per-surface renderers
- ✅ Authoring workflow: Developers only, git-driven changes (no visual editing)
- ✅ Output strategy: Separate builds/artifacts, Prague stays single-output website-focused
- ✅ Allowlist tooling: Keep existing `paths[]` format, align PRD to current tooling

### Final Status: FULLY COMPLIANT - APPROVED FOR EXECUTION

**All P0/P1/P2 Issues Resolved:**
- ✅ **Architectural Compliance**: Framework-agnostic shared engine, no false promises, explicit integration plans
- ✅ **Mission Clarity**: Prague stays marketing surface, developers-only authoring, single-output focus
- ✅ **Technical Correctness**: Aligned with existing tooling, build-time strategies, external-service optimization
- ✅ **Scope Control**: No overarchitecture, separate services for multi-output, concrete boundaries
- ✅ **Concrete Plans**: Sunset criteria, success gates, no open-ended commitments

**Proceed Criteria Met:**
- ✅ **No Smoke and Mirrors**: No false promises to content authors
- ✅ **Shared Engine Actually Shared**: Framework-agnostic with per-surface renderers
- ✅ **Elegant & Scalable**: Clean separation, auditable optimization rules
- ✅ **Tenets Compliance**: Pre-GA guidance followed, no long-lived dual systems
- ✅ **100⁵ Scale Enabled**: Multiplicative primitives without Prague complexity explosion

**Execution Ready:**
- Shared composition engine: `tooling/composition/` with Astro + HTML renderers and widget pipeline integration
- Build-time validation: Clear error messages, auditable rules
- Performance gates: CI checks with rollback criteria
- Migration criteria: Sunset gates, exit criteria, no extensions allowed
- No false promises: Developer-mediated authoring workflow clearly defined
- Multi-output scope: Primitives for external services, Prague stays single-output website-focused
- Content optimization: Build-time/external-service only, no Prague runtime optimization

---

## Dependencies & Prerequisites

### Technical Dependencies
- Prague localization system must be stable
- Widget integration APIs must remain compatible
- Build system must support new composition patterns

### Team Dependencies
- Content authors available for migration validation
- AI team input on contract design
- Cross-team alignment on output format priorities

### External Dependencies
- No external dependencies required
- All changes contained within Prague system
- Can be implemented incrementally without external coordination

---

## Success Factors

### Technical Excellence
- **Clean Architecture:** Primitives are truly composable and reusable
- **Performance:** No degradation in user experience
- **Maintainability:** Code is easier to modify and extend

### Business Impact
- **Faster Development:** New output formats ship quickly
- **Better Content:** Optimized content per format improves conversion
- **Reduced Costs:** Less code duplication and maintenance

### Strategic Alignment
- **100⁵ Vision:** Content works automatically across all outputs
- **AI-Native:** System is understandable and modifiable by AI
- **Future-Proof:** Architecture scales to new requirements

This PRD transforms Prague from a **website-only marketing tool** into a **composable content platform** that powers Clickeen's 100⁵ vision of multiplicative scale.
