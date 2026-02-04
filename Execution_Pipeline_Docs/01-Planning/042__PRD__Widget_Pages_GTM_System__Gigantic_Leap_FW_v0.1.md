# Widget Pages GTM System — “Gigantic Leap FW” (Overview/Templates/Examples/Features)

**Status:** PLANNING  
**PRD #:** 042  
**Priority:** P0 (GTM leverage; scales across 100s of widgets)  
**Owner:** GTM Dev (Prague/Tokyo) + Product Dev (Bob/Widgets)  
**Date:** 2026-02-04  

Source strategy doc: [documentation/widgets/WidgetGTMStrategy.md](../../documentation/widgets/WidgetGTMStrategy.md)

---

## 1) Problem Statement

Today, widget pages are structurally “good enough” but not systematically excellent.

What’s missing is a repeatable, high-signal system that:
- Communicates value fast (clear promise + differentiator)
- Proves capability immediately (live + real embeds)
- Makes Clickeen moats obvious (control moat + global moat + platform trust)
- Scales across many widgets and page intents without bespoke design work

We want a **systemic** upgrade where every widget gets a set of pages that feel premium, convert, and remain easy to maintain.

---

## 2) Core Decision

We ship a **standardized widget-page framework** composed of:
- A shared set of narrative “sections” (hero → live try → proof showoffs → moat blocks → trust strip → CTA)
- A small number of **new blocks** to enable premium interactions (carousel, mobile showcase, feature explorer)
- A content model + templates that can be stamped out per widget and per page type

This is the “gigantic leap forward”: pages become a productized system, not handcrafted marketing pages.

---

## 3) Current State (as-is)

### 3.1 Content architecture
- Widget pages are JSON-driven under `tokyo/widgets/<widget>/pages/<page>.json`.
- Prague renders blocks with strict validation via `prague/src/lib/blockRegistry.ts`.
- Runtime rendering uses `prague/src/components/WidgetBlocks.astro`.

### 3.2 Localization system constraints
- Prague build runs `scripts/prague-l10n/verify.mjs` which requires:
  - An allowlist per block type in `prague/content/allowlists/v1/blocks/<type>.allowlist.json`
  - Overlays per page/locale/fingerprint under `tokyo/l10n/prague/<pageId>/locale/<locale>/<fingerprint>.ops.json`

### 3.3 Existing blocks
- `hero`, `split`, `steps`, `big-bang`, `minibob`, `cta-bottom-block`, etc.

---

## 4) Goals

### 4.1 Product / GTM goals
1) Every widget has a coherent, premium set of pages:
   - `overview`
   - `templates`
   - `examples`
   - `features`
2) Pages demonstrate capability via:
   - Live try (“minibob”)
   - LocaleShowcase
   - Curated embed showoffs
3) Pages clearly communicate moats:
   - Control moat (design + translate controls)
   - Global moat (“Clickeen excellence” cards)
   - Platform strip (infra trust)

### 4.2 Platform goals
4) The system scales across 100s of widgets with minimal per-widget engineering.
5) Strict contracts remain intact: no “marketing-only hacks” that bypass validation.
6) Localization pipeline remains deterministic and easy to keep green.

---

## 5) Non-goals (v0.1)

- No new CMS backend: pages remain JSON-driven.
- No redesign of the entire Prague layout system.
- No “AI auto-generate all copy” promise: content may be assisted, but remains deliberate.
- No broad refactors unrelated to enabling the new page system.

---

## 6) Proposed Solution

### 6.1 Standard page wireframes (system contract)

These are *intent-based* page types that all widgets should implement.

**Overview**
- hero (PRD-driven promise)
- minibob (+ LocaleShowcase)
- split showoffs (proof)
- big-bang (impact statement)
- control moat (3 cards)
- global moat (6 cards)
- platform strip (3 trust cards)
- cta-bottom-block

**Templates**
- hero (templates promise)
- desktop carousel (NEW)
- mobile showcase (NEW)
- splits showcasing named template styles
- big-bang
- control moat
- light/dark showcase (phase 2; can be split/toggle)
- cta-bottom-block (Install template)

**Examples**
- hero (ICP promise)
- desktop carousel (REUSE; examples)
- splits for primary ICPs
- big-bang
- mobile showcase (REUSE; examples)
- global moat (tuned to ICP pains)
- platform strip (ICP trust)
- cta-bottom-block

**Features**
- hero (killer feature)
- feature explorer (NEW: categories aligned to editor)
- deep-dive splits
- big-bang
- control moat
- global moat
- platform strip (technical excellence)
- cta-bottom-block

### 6.2 New blocks to build (v0.1 scope)

#### A) `embed-carousel`
Purpose: premium “gallery” that cycles curated embeds (desktop).
- Two embeds visible side-by-side on desktop
- Auto-scroll / auto-advance with pause-on-hover
- Deterministic order; supports N items
- Uses existing curated embed primitive(s)

Required copy paths (allowlisted):
- `copy.title` (string, optional)
- `copy.subhead` (string, optional)
- `copy.items[].label` (string, optional)

Required meta:
- `items[]`: list of curated refs or publicIds
- display options (speed, visibleCount, aspect)

#### B) `mobile-showcase`
Purpose: mobile proof section with 4 mobile embeds side-by-side.
- Horizontal stack; responsive overflow
- Optional captions

Required copy paths (allowlisted):
- `copy.title` (string, optional)
- `copy.items[].label` (string, optional)

Required meta:
- `items[]`: curated refs/publicIds

#### C) `feature-explorer`
Purpose: map product capabilities to a browsable UI.
- Left: category pills (Content/Layout/Appearance/Typography/Translation/Settings)
- Right: grid of feature cards (icon + name + short description)
- Category state in URL hash optional (phase 2)

Required copy paths (allowlisted):
- `copy.title` (string, optional)
- `copy.categories[].label` (string)
- `copy.categories[].features[].name` (string)
- `copy.categories[].features[].description` (string)

Required meta:
- icons (token names)
- layout options (columns)

### 6.3 Content templates + scaffolding

We need a repeatable way to generate new widget pages:
- Provide canonical `overview/templates/examples/features` page JSON templates
- Each template includes the standard section ordering and minimal placeholder copy
- Add a script (phase 2) to scaffold `tokyo/widgets/<widget>/pages/*.json` from templates

---

## 7) Requirements

### 7.1 Functional requirements
- New blocks render correctly in Prague.
- Blocks are fully contract-validated:
  - Added to `BlockType` and registry
  - Allowed meta fields defined
- Blocks are localizable:
  - Allowlist files exist for each block type
  - `scripts/prague-l10n/verify.mjs` passes

### 7.2 UX requirements
- Carousels feel “Apple premium”: smooth motion, no jank, sensible spacing.
- All blocks must be responsive and look correct at common breakpoints.
- A11y:
  - Keyboard focus for controls
  - Reduced motion support where relevant

### 7.3 Performance requirements
- Avoid heavy client JS by default.
- Lazy-load embeds where possible.
- No layout thrash from carousel.

---

## 8) Success Metrics

- Coverage: % of widgets with all 4 page types implemented.
- Conversion: uplift in create/start events from widget pages (baseline vs new system).
- Quality: reduction in “page feels inconsistent/bespoke” feedback.
- Reliability: Prague build stays green (including l10n verify) over time.

---

## 9) Rollout Plan

### Phase 0 (Now)
- Lock the system spec (this PRD) and the page wireframes.

### Phase 1 (v0.1)
- Implement `embed-carousel`, `mobile-showcase`, `feature-explorer` blocks.
- Add allowlists for new block types.
- Ship one end-to-end widget as reference (FAQ or Countdown) across 4 pages.

### Phase 2 (v0.2)
- Add light/dark toggle showcase behavior.
- Add scaffolding script for faster widget onboarding.
- Expand ICP/template catalogs.

---

## 10) Acceptance Criteria

- `pnpm --filter @clickeen/prague typecheck` passes.
- `pnpm --filter @clickeen/prague build` passes (including `scripts/prague-l10n/verify.mjs`).
- At least one widget has:
  - `overview`, `templates`, `examples`, `features` pages present in Tokyo
  - No runtime errors rendering blocks
  - New blocks render correctly and are responsive

---

## 11) Open Questions

1) What is the canonical data shape for carousel items: `publicId` vs `curatedRef`?
2) Should carousel/mobileshowcase be purely server-rendered (preferred) or require light client state?
3) Should features explorer categories be fully universal across widgets, or allow widget-specific categories?

---

## 12) Risks / Mitigations

- **Localization friction**: new blocks require allowlists + overlays.
  - Mitigation: add allowlists immediately and run translation step as part of rollout.
- **Overbuilding interaction**: carousel complexity can creep.
  - Mitigation: keep v0.1 minimal; defer advanced controls to v0.2.
- **Contract drift**: content authors may add fields not allowed.
  - Mitigation: strict validator is a feature; update allowlists/contracts deliberately.
