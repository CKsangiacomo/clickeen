# PRD 18: Prague Blocks Composability Uplevel

## Status
- **Status**: Proposed
- **Owner**: Prague (marketing site)
- **Scope**: Prague block system architecture evolution
- **Timeline**: Q2 2026 (3-4 months)
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

---

## User Stories

### Content Authors
- As a content author, I can create content once and have it automatically work in websites, emails, ads, and social posts
- As a content author, I can easily rearrange elements within a block without engineering help
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

---

## Technical Approach

### Phase 1: Primitive System Foundation (Month 1)

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

### Phase 2: Block Evolution (Month 2)

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

### Phase 3: AI-Legible Architecture (Month 3)

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

#### 3.2 Dynamic Layout Resolution
**Current:** Fixed layouts
**Enhanced:** Context-aware layout selection

```typescript
// New: Context-aware layouts
function resolveBlockLayout(block, context) {
  const { outputFormat, screenSize, userSegment } = context;
  
  switch (outputFormat) {
    case 'email': return block.layouts.email || block.layouts.web;
    case 'ad': return block.layouts.compact || block.layouts.web;
    case 'social': return block.layouts.square || block.layouts.web;
    default: return block.layouts.web;
  }
}
```

### Phase 4: Multi-Output Support (Month 4)

#### 4.1 Output Format Adapters
**Current:** Website-only
**Enhanced:** Format-specific rendering

```typescript
// New: Output adapters
const outputAdapters = {
  website: {
    primitives: webPrimitives,
    styles: webStyles,
    interactions: webInteractions
  },
  email: {
    primitives: emailPrimitives,
    styles: emailStyles,
    interactions: emailInteractions
  },
  ad: {
    primitives: adPrimitives,
    styles: adStyles,
    interactions: adInteractions
  }
}
```

#### 4.2 Content Optimization
**Current:** One-size-fits-all
**Enhanced:** Format-optimized content

```typescript
// New: Content optimization
function optimizeContentForOutput(content, outputFormat) {
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
```

---

## Functional Requirements

### 1. Backward Compatibility
- ✅ Existing Prague pages continue to work unchanged
- ✅ Existing block APIs remain functional
- ✅ No breaking changes to content structure

### 2. Primitive Composition System
- ✅ Blocks can be composed from smaller primitives
- ✅ Primitives work across all output formats
- ✅ AI can understand and modify primitive arrangements

### 3. Flexible Content Patterns
- ✅ CTA patterns beyond primary/secondary
- ✅ Multiple content arrangements per block
- ✅ Context-aware content optimization

### 4. Multi-Output Support
- ✅ Same content renders appropriately for each output
- ✅ Format-specific optimizations applied
- ✅ New outputs get all existing content automatically

### 5. AI Integration
- ✅ Block contracts are AI-legible
- ✅ AI can suggest layout improvements
- ✅ AI can create new block variations

---

## Technical Implementation Details

### File Structure Evolution

```
prague/src/
├── primitives/           # NEW: Core composition primitives
│   ├── Heading.astro
│   ├── Text.astro
│   ├── Action.astro
│   ├── Media.astro
│   ├── Stack.astro
│   └── Grid.astro
├── blocks/               # EVOLVED: Now composition schemas
│   ├── hero/
│   │   ├── schema.ts     # NEW: Declarative schema
│   │   └── legacy.astro  # Keep for backward compatibility
│   └── ...
├── composition/          # NEW: Composition engine
│   ├── PrimitiveRenderer.astro
│   ├── BlockResolver.ts
│   └── OutputAdapter.ts
└── lib/
    ├── blockSchemas.ts   # NEW: Block definitions
    └── compositionEngine.ts # NEW: Rendering logic
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
- Provide migration tools for content authors
- Remove legacy code after full migration

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
- ✅ Content authors can rearrange elements **without engineering help**
- ✅ Type safety prevents **invalid primitive combinations**

#### Content Author Experience
- ✅ Content created once works **automatically across all outputs**
- ✅ Flexible CTA patterns support **varied conversion goals**
- ✅ AI assistance improves **content effectiveness**

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
- ✅ Multi-output rendering working

### Phase 3 Completion
- ✅ Dynamic layout resolution implemented
- ✅ Context-aware content optimization
- ✅ AI integration fully functional
- ✅ Performance benchmarks met

### Phase 4 Completion
- ✅ Full multi-output support across website, email, ad, social
- ✅ Content automatically works in new output formats
- ✅ Migration tools available for content authors
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
- **Fallback:** Legacy blocks remain functional indefinitely
- **Support:** Migration tools and documentation for content authors

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

### Phase 1: Foundation (Weeks 1-4)
- Implement primitive system
- Build composition engine
- Migrate 2-3 high-priority blocks
- Establish performance baselines

### Phase 2: Core Evolution (Weeks 5-8)
- Complete block migration
- Implement flexible CTA patterns
- Add AI-legible contracts
- Optimize for multiple outputs

### Phase 3: Intelligence Layer (Weeks 9-12)
- Dynamic layout resolution
- Context-aware optimization
- Full AI integration
- Performance validation

### Phase 4: Multi-Output Scale (Weeks 13-16)
- Complete output format support
- Content optimization pipelines
- Migration tooling
- Production rollout

---

## Open Questions & Decisions Needed

### 1. Migration Strategy
**Question:** Should we maintain dual rendering paths during transition?
**Options:** 
- Yes: Safer migration, allows gradual rollout
- No: Cleaner architecture, but higher risk
**Recommendation:** Yes - dual paths with feature flags

### 2. AI Contract Scope
**Question:** How detailed should AI-legible contracts be?
**Options:**
- Minimal: Basic structure and constraints
- Comprehensive: Full semantic understanding
**Recommendation:** Start minimal, expand based on AI capabilities

### 3. Output Format Priority
**Question:** Which output formats to prioritize beyond website?
**Options:** Email, ads, social, print, etc.
**Recommendation:** Email first (highest ROI), then ads and social

### 4. Content Optimization Strategy
**Question:** How much content adaptation per output format?
**Options:**
- Minimal: Same content, different layout
- Moderate: Length/emphasis optimization
- Extensive: Format-specific content variations
**Recommendation:** Moderate - optimize length and emphasis, avoid full rewrites

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