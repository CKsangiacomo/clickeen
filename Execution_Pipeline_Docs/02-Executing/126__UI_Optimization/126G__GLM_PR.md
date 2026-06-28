# 126G Ops — GLM Pre-Execution Peer Review

Status: PRE-EXECUTION peer review (main-thread, 3 lenses: Staff Engineer, Senior PM,
Principal TPM). Subject: `126G__PRD__Ops.md` (Status: HUMAN-CONVERGED PRODUCT STANDARD),
read fresh this pass. Grounded in `audits/126G__AsBuilt_{Codex,GLM}.md`, `research/126G_Research_{Codex,GLM}.md`,
`documentation/engineering/UI/ops.md`, and verified file/path checks. **Verified this
pass:** the Migration doc `PRD__DevStudio_Cloudflare_Migration.md` **exists** (ops.md ref
is valid); `dieter/scripts/build-dieter.js` does **not** exist (active build is root
`scripts/build-dieter.js`, 11482 bytes) — so ops.md's build path is wrong.

Note: this PRD has been strengthened since GLM's earlier review — the l10n/localization
handling is now careful (preserves real Prague/San-Francisco localization while removing
only stale R2-root assumptions), and prior flags (non-committing-as-gap, `components.js`)
are resolved.

---

## Lens 1 — Staff Engineer (architecture & product law)

### 1. Elegant engineering & scalability
- The **simplification/clarity frame** is the elegant core: "Success means fewer active
  paths, less bridge-era code, and docs that match current Cloudflare reality. It is not a
  governance-platform PRD" (34-36). Anti-complexity as the explicit posture.
- **Four Authority Lanes** (146-168): source / generated / deployed / product-data. "Agents
  must classify any UI ops task into one of these lanes before editing or operating" (161).
  This is the deterministic framework that expands — a new artifact gets classified, no new
  system built.
- **Hardening-by-removal** (Manifest Honesty, 246-264): remove the `unknown` gitSha fallback,
  make unresolved deps fail. Removal, not machinery.
- The sharp line: **"A guard around a dead concept still teaches agents the concept exists"**
  (198-199) — the reason to *delete* refusal guards rather than keep them. Excellent.

### 2. Compliance to architecture & tenets
- **No-invented-machinery:** "not a governance-platform PRD" (36); Out of Scope lists no
  governance platform, no approval workflow, no universal scanner, no R2 reconciliation
  engine, no semantic validator (378-389). Strong.
- **Pre-GA no-legacy:** remove stale bridge-era/local-upload concepts and refusal guards
  (76-79). Compliant.
- **Reveal-not-masquerade:** R2 upload-only documented honestly, not pretending to reconcile
  (306-307); DevStudio legible mutation record (278-279). Anti-V6.

### 3. Overarchitecture / unnecessary complexity
- None — the simplification frame is anti-overarchitecture.

### 3b. Academic abstractions / pre-work / meta-work / gold-plating
- Concrete throughout. Not academic.

### 4. Prose / bedtime stories / leeway to invent
- **Four Authority Lanes classification directive** (161): "Agents must classify any UI ops
  task into one of these lanes before editing." This is the one quasi-framework line; a dev
  could over-index on process. It's legibility, not a gate — acceptable, but the line between
  "classification directive" and "process mandate" is worth noting.
- **l10n handling (180-186)** is now carefully scoped (preserves real localization), but a
  dev may find the "what NOT to delete" list (Prague l10n, SF l10n, locale overlays, future
  direction) broad. Acceptable — it correctly avoids the earlier entanglement with the
  localization/overlay program.

### 5. Needed documentation updates (DEV perspective)
- **`ops.md` kb doc errors (verified):**
  1. Lines 7 + 11 cite the build as `dieter/scripts/build-dieter.js`. **That file does not
     exist** (verified). Active build is root `scripts/build-dieter.js` (11482 bytes). The
     PRD §Build And Generation (224-225) and execution target (352-353) correctly say root.
     Fix the kb doc.
  2. Line 17-18 repeats the stale `build-icons.mjs` → `dist/icons/` registry pipeline (same
     orphaned-pipeline claim as `iconography.md`, verified earlier: `build-icons.mjs` is
     unwired and `dist/icons.js` doesn't exist). Fix.
  3. Lines 42 + 52 say the ops gaps are "to verify/fix during **126C**" and "**126C's** job
     is to close these." **Wrong** — ops gaps are owned by **126G**, not 126C (iconography).
     Significant mislabel. Fix to 126G.
- The Migration doc reference (line 7) **is valid** (file exists). Good.

### Blast radius (Staff Engineer)
- **No structured "Detailed Blast Radius" table** (Execution Gap Targets list only,
  347-376) — same structural gap as 126D/126E/126F. Per the explicit program mandate
  *"ENSURING DETAILED COVERAGE OF BLAST RADIUS IN PRD ITSELF,"* add the may/must-not table.
- Content covers `scripts/build-dieter.js`, `scripts/tokyo-r2-deploy-sync.mjs`,
  `admin/scripts/**`, `.github/workflows/*`, `dieter/icons/svg/**`, ops.md + related docs.
  Accurate. The l10n execution target (362-365) correctly checks localization authority first.

**VERDICT: GREEN** — execution-ready. Note-level: ops.md kb-doc errors (real, fix in
execution); add blast-radius table + V1-V8 section.

---

## Lens 2 — Senior PM (product UX)

### 1. Elegant product UX & scalability
- Ops is internal (build/deploy), not end-user UX. But: DevStudio token-edit legibility
  (actor + value + SHA, 278-279) helps the human operator trust the steer loop; R2
  upload-only honesty prevents false confidence in deploy state. The simplification frame
  (fewer paths, clear authority) reduces operator error.

### 2. Compliance to product-UX best practices
- N/A mostly (internal). The DevStudio reveal/steer loop is a reasonable operator UX.

### 3. Bad UX writing for the user
- N/A (internal ops doctrine).

### 4. How Clickeen differs from legacy SaaS + alignment
- The four-authority separation (source vs generated vs deployed vs product-data) is more
  disciplined than legacy SaaS ops where these layers blur. Aligned with the matrioska/
  cascade model.

### 5. Needed documentation updates (vision/architecture/system)
- `ops.md` should reflect the Cloudflare-centered four-authority model plainly. Currently
  stale (wrong build path, wrong PRD ownership).

### Blast radius (PM)
Operator-facing (DevStudio token loop, deploy). Covered.

**VERDICT: GREEN** — findings note-level (ops.md kb-doc rewrite).

---

## Lens 3 — Principal TPM (systems, V1-V8, competitive)

### 1. Cohesive, cost-effective architecture
- Simplification (fewer paths) + four-authority classification. No new subsystem. Cost =
  doc/script cleanup + hardening (manifest fail, remove inactive override), no infra.
  Cohesive.

### 2. Clarity on systems — no invented subsystems
- Four Authority Lanes make existing systems (git source / generators / R2 deploy / product
  routes) talk without a new gateway. The l10n handling correctly preserves the real
  localization system (Prague, San Francisco) while removing only stale R2-root assumptions.
  Clean.

### 3. SaaS world-class vs competitors (technical)
- N/A directly (internal ops). The four-authority discipline + DevStudio reveal/steer loop is
  more engineered than typical SaaS design-token ops. The internally-sourced decision (not
  importing Style Dictionary/Supernova/Zeroheight, 338-340) is defensible — clickeen's
  pipeline is more engineered than those, and its gaps are unique.

### 4. Absence of V1-V8 violations — no explicit section (like D/E/F). Assessed:
- **V1 Silent substitution — PASS (mitigated).** Manifest `gitSha` `unknown` fallback →
  remove/fail-visible (367). Unknown provenance substituting for real is a V1 risk; PRD
  removes it.
- **V2 Silent healing — PASS (mitigated).** SVG normalization mutating committed source
  during build → stop (358-359, 235-237). Build-time source healing is a V2 risk; PRD stops it.
- **V3 Silent omission — PASS.** Blast radius covered via execution targets.
- **V4 Fail-open control — PASS (mitigated).** Manifest validation warning-only → make deps
  fail (368). Warning-and-ship is a V4 risk (enforcement off); PRD hardens it.
- **V5 Corruption-as-absence — N/A.**
- **V6 Partial-success masquerade — PASS.** R2 upload-only not pretending to reconcile
  (306-307); DevStudio legible record.
- **V7 Masquerade/redress — PASS.** Stale roots/guards deleted, not renamed as features
  (198-199).
- **V8 Runtime test dependency — PASS.** No governance/scanner machinery.
- **All 8 PASS — V1/V2/V4 actively mitigated by hardening-by-removal. Strong. Not pre-mapped.**

### 5. Needed documentation updates (TPM perspective)
- Add V1-V8 pre-controls + a structured blast-radius table (consistency with B/C; satisfies
  the blast-radius mandate).
- Cross-PRD index: localization → Babel/Prague/SF authority (PRD 124/overlay program);
  DevStudio → 126L; icons → 126C; components → 126I; what-Dieter-is → 126H.

### Blast radius (TPM)
Build scripts + deploy sync + workflows + DevStudio generation + docs. **No** product data
changed. The l10n dependency on the localization program is acknowledged (362-365). Accurate
content, not tabulated.

**VERDICT: GREEN** — all V1-V8 PASS (V1/V2/V4 strong); note-level.

---

## Consolidated Verdict

| Lens | Verdict | Blocking? |
| --- | --- | --- |
| Staff Engineer | GREEN | No |
| Senior PM | GREEN | No |
| Principal TPM | GREEN (V1-V8 all PASS; V1/V2/V4 actively mitigated) | No |

**126G is execution-ready.** All three lenses green. Note-level findings:

1. **`ops.md` kb doc errors (verified):** (a) build path `dieter/scripts/build-dieter.js`
   (line 7, 11) — file does not exist; active is root `scripts/build-dieter.js`; (b) stale
   `build-icons.mjs` → `dist/icons/` pipeline (line 17-18); (c) **wrong PRD ownership** —
   says ops gaps are "126C's job" (line 42, 52), should be **126G**. Fix in execution.
2. **No structured blast-radius table + no V1-V8 section** (same as D/E/F). Add for
   consistency and to satisfy the explicit blast-radius mandate.
3. **Migration doc reference is valid** (file exists) — no ghost-referrer issue here.
4. **Strengths noted:** simplification frame (anti-complexity); four-authority lanes;
   hardening-by-removal (manifest fail, stop source mutation, remove inactive override) —
   V1/V2/V4 actively mitigated; the sharp "a guard around a dead concept still teaches agents
   the concept exists"; l10n handling now careful (preserves real localization).
5. **Prior GLM flags resolved:** the non-committing-as-gap contradiction, the `components.js`
   claim, and the l10n entanglement are all addressed in the current PRD.

None block execution. Proceed to 126H (final).
