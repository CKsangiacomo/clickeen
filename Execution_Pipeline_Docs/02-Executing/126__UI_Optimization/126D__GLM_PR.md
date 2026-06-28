# 126D Typography — GLM Pre-Execution Peer Review

Status: PRE-EXECUTION peer review (main-thread, 3 lenses: Staff Engineer, Senior PM,
Principal TPM). Subject: `126D__PRD__Typography.md` (Status: HUMAN-CONVERGED PRODUCT
STANDARD). Grounded in `audits/126D__AsBuilt_{Codex,GLM}.md`, `research/126D_Research_{Codex,GLM}.md`,
`documentation/engineering/UI/typography.md`, `dieter/tokens/dieter-typography.css`,
`tokyo/product/widgets/shared/typography.js`. This review checks execution-readiness;
it does not change the PRD.

---

## Lens 1 — Staff Engineer (architecture & product law)

### 1. Elegant engineering & scalability
- The **two-lane authority** (§Two-Lane Authority, 134-154) is the elegant core: it
  *resists* merging Dieter operational type and `CKTypography` widget type into one
  engine — because merging would make operational UI too brand-flexible or widgets too
  rigid (128-130). This is the no-invented-machinery tenet applied to a genuine
  architecture split. Sharp.
- **Account Font Library Law** (274-320): Inter baseline + Google Fonts + account-
  uploaded custom fonts served from the Clickeen account-asset CDN. This solves the
  embed-safe problem (customer sites can't reliably host/cache custom fonts) and is a
  real moat. "One smooth font choice surface, explicit source authority underneath" is
  good UX + good engineering.
- **GLM findings integrated with file:line** (420-477): `--font-display` undefined, two
  fluidity mechanisms (viewport `vw` vs container `cqi`), two divergent tracking scales,
  dead/duplicate tokens (`--lh-loose` dup `--lh-body`, `--lh-normal` unused), two mono
  stacks, authority duplication, and the inert `sizeCustom` default (runtime honors it
  only when preset=`custom`). Concrete and routed to execution targets.

### 2. Compliance to architecture & tenets
- **No-invented-machinery:** explicitly refuses to merge lanes into one universal
  engine (128-130). Strong.
- **Pre-GA no-legacy:** remove stale utility names, no old+new parallel (200-201);
  define-or-remove `--font-display` (300-302, 358). Compliant.
- **Reveal-not-masquerade / anti-V6:** "Bob must not imply a stored field is active when
  runtime ignores it" (247, the inert `sizeCustom`); "DevStudio must not present a
  partial token editor as the full typography system" (266-267). Strong.
- **126B boundary:** typography utilities must NOT own color (195-197, 204-206). Clean seam.

### 3. Overarchitecture / unnecessary complexity
- None. Two lanes is the minimum viable split, not over-engineering.

### 3b. Academic abstractions / pre-work / meta-work / gold-plating
- Concrete throughout (file:line citations). Not academic.

### 4. Prose / bedtime stories / leeway to invent
- **Leeway (§Widget Runtime, 219-221):** "may support account font libraries, role
  scales, custom sizes, style, weight, user-authored colors, tracking presets,
  line-height presets, script fallbacks, and locale/script-specific line-height
  behavior" — a broad permissive list. It describes widget *content* freedom (the point),
  but a dev may not tell required vs optional. Minor.
- Operational-UI tracking "defaults to 0 unless a human-decided Dieter role explicitly
  owns a different value" (169-171) — clear, removes leeway.

### 5. Needed documentation updates (DEV perspective)
- **`typography.md` is thin vs the PRD (verified by read).** It covers Dieter only and
  is **silent on the widget lane** (`CKTypography`), the account font library,
  `--font-display`, and the two-fluidity-mechanism issue — i.e., it documents only half
  the converged standard. The PRD's own execution target (380-382) says expand it to both
  lanes. Flag the kb doc as currently half-complete.
- **Inter vs Inter Tight conflation risk:** `--font-ui` (operational UI) is
  `Inter Tight, Inter, system-ui, sans-serif` (kb line 12); the Account Font Library
  baseline is **Inter** (PRD 280-281). Different fonts for different lanes — correct, but
  the docs should state the distinction explicitly so agents don't conflate them.

### Blast radius (Staff Engineer)
- **Structural gap:** 126D has "Execution Gap Targets" (347-385) but **no structured
  "Detailed Blast Radius" table** of the kind 126A/126B/126C have (may-change /
  must-not-change by area). Given the explicit program mandate *"ENSURING DETAILED
  COVERAGE OF BLAST RADIUS IN PRD ITSELF,"* this is the one substantive structural
  finding. The gap-target list covers the surface (Dieter tokens/classes, Bob editor,
  widget runtime, Roma, DevStudio, account assets, docs) but not in the may/must-not
  tabulated form. Add the table for consistency and to satisfy the mandate.
- Content coverage otherwise accurate: GLM findings cite real files
  (`dieter-typography.css`, `bob_app.css`, `tokyo/product/widgets/shared/typography.js`,
  `widget-shell/src/defaults.ts`, `big-bang/widget.css`).

**VERDICT: GREEN** — execution-ready. Note-level: add the blast-radius table + V1-V8
section (see TPM); expand the kb doc to both lanes.

---

## Lens 2 — Senior PM (product UX)

### 1. Elegant product UX & scalability
- Account Font Library = "one smooth font choice surface" (Inter + Google + custom
  uploads) — excellent UX. Customers get brand freedom without embed-hosting pain.
- Operational UI uses Inter Tight (dense, readable tool); widgets use brand fonts.
  Correct UX split per lane.
- Resize-safe, locale-aware widget type (per-script CJK line-heights, script-fallback
  matrix — GLM findings 439-441) — real UX sophistication.

### 2. Compliance to product-UX best practices
- Apple Dynamic Type / locale-aware / legibility → widget runtime per-script line-heights
  + font-fallback matrix. World-class.
- M3 type-scale roles → Dieter role classes. Aligned.

### 3. Bad UX writing for the user
- Internal doctrine; governs type mechanics consistently. No bad user-facing copy.

### 4. How Clickeen differs from legacy SaaS + alignment
- **Embed-safe custom typography moat:** Clickeen serves uploaded fonts from its account-
  asset CDN, so customer widgets render correctly regardless of the host site's font
  setup. This is a real differentiator vs legacy widget tools that require customer-site
  font hosting (and break on embeds). Aligned with the embed-distributed, widget-based
  product.
- Two-lane authority respects that operational UI (tool) and widget content (brand) have
  different type jobs. Correct product thinking.

### 5. Needed documentation updates (vision/architecture/system)
- `typography.md` should document the embed-safe font moat (the account-font-library UX)
  at vision level — currently absent.

### Blast radius (PM)
Widget content typography (user-facing brand) + operational UI (tool) covered via gap
targets.

**VERDICT: GREEN** — findings note-level (kb-doc expansion; moat framing).

---

## Lens 3 — Principal TPM (systems, V1-V8, competitive)

### 1. Cohesive, cost-effective architecture
- Two-lane authority is cohesive (each lane deterministic in its boundary). The account-
  font path (Bob author → account-asset authority storage → Tokyo/CDN serving → widget
  runtime loading via `CKTypography`) is a multi-system path that **reuses existing
  account-asset authority** rather than inventing a new font subsystem. Cohesive.

### 2. Clarity on systems — no invented subsystems
- Admin account treated as just another account (`accounts/CLICKEEN/assets/...`), not a
  "global product font" class (287-289). No invented global-font subsystem. Clean.
- The font path makes existing systems (Bob, asset authority, CDN, runtime) talk without
  a new gateway.

### 3. SaaS world-class vs competitors (technical)
- Embed-safe custom fonts via Clickeen CDN = a real competitive moat. Per-script CJK
  line-heights + script-fallback matrix = localization-grade typography. Both are
  world-class vs competitors shipping Latin-only, customer-hosted-font widget type.

### 4. Absence of V1-V8 violations — 126D has **no explicit V1-V8 section** (unlike 126B/126C).
Assessed from content:
- **V1 Silent substitution — PASS (mitigated).** `--font-display` undefined → define-or-
  remove (300-302); inert `sizeCustom` (stored field runtime ignores) flagged (247,
  465-469).
- **V2 Silent healing — PASS.** Stale utility names removed, not normalized into aliases.
- **V3 Silent omission — PASS (weaker form).** Gap targets cover Dieter/Bob/Roma/DevStudio/
  widgets/docs, but no tabulated blast radius (see Staff blast).
- **V4 Fail-open control — PASS.** No enforcement machinery to fail open.
- **V5 Corruption-as-absence — PASS.** `--font-display` dead fallback owned.
- **V6 Partial-success masquerade — PASS (strong).** Bob must not imply inert stored fields
  are active; DevStudio must not masquerade partial editor as full system.
- **V7 Masquerade/redress — PASS.** Admin-account fonts not renamed as "global product fonts."
- **V8 Runtime test dependency — PASS.** No validation rituals.
- **All 8 effectively PASS** — but **not pre-mapped in a section**. Add the V1-V8 pre-controls
  table for consistency with 126B/126C and to make execution review trivial.

### 5. Needed documentation updates (TPM perspective)
- Add V1-V8 pre-controls section + a structured blast-radius table (consistency with B/C;
  satisfies the explicit blast-radius mandate).
- Cross-PRD index: color seam → 126B; widget runtime → widget ownership; account fonts →
  `AssetManagement.md`; DevStudio → 126L; Roma → 126M.

### Blast radius (TPM)
Typography tokens/classes + Bob editor + widget runtime + account assets + DevStudio +
docs. The account-font path crosses systems but correctly reuses existing authorities;
no services/routes/data *changed*. Accurate in content, not tabulated in form.

**VERDICT: GREEN** — all V1-V8 effectively pass; note-level (add V1-V8 + blast-radius table).

---

## Consolidated Verdict

| Lens | Verdict | Blocking? |
| --- | --- | --- |
| Staff Engineer | GREEN | No |
| Senior PM | GREEN | No |
| Principal TPM | GREEN (V1-V8 effectively PASS, not pre-mapped) | No |

**126D is execution-ready.** All three lenses green. Note-level findings:

1. **No structured blast-radius table.** 126A/126B/126C have "Detailed Blast Radius"
   (may/must-not by area); 126D has only an execution-gap-targets list. Given the explicit
   program mandate *"ENSURING DETAILED COVERAGE OF BLAST RADIUS IN PRD ITSELF,"* add the
   table. (Most substantive structural note.)
2. **No V1-V8 pre-mapping section** (126B/126C have one). All eight effectively pass on
   content review, but add the section for consistency and easy execution review.
3. **`typography.md` kb doc is half the picture** — covers Dieter only, silent on the widget
   lane (`CKTypography`), account font library, `--font-display`, two-fluidity issue. PRD
   knows (execution target 380-382); flag for execution.
4. **Inter vs Inter Tight conflation risk** — operational UI `--font-ui` is `Inter Tight`;
   the widget-lane baseline is `Inter`. State the distinction in docs.
5. **Strengths noted:** two-lane authority (resists the merge-everything trap); embed-safe
   font moat via account-asset CDN; GLM findings sharply integrated with file:line.

None block execution. Proceed to 126E.
