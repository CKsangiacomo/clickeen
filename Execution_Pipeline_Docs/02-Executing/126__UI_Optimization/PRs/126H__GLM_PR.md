# 126H Dieter — GLM Pre-Execution Peer Review

Status: PRE-EXECUTION peer review (main-thread, 3 lenses: Staff Engineer, Senior PM,
Principal TPM). Subject: `126H__PRD__Dieter.md` (Status: HUMAN-CONVERGED PRODUCT STANDARD),
read fresh this pass. Grounded in `audits/126H__AsBuilt_{Codex,GLM}.md`, `research/126H_Research_{Codex,GLM}.md`,
`documentation/engineering/UI/dieter.md`, `dieter/tokens/dieter-foundation-tokens.css`.
**Verified earlier this session:** `dieter/scripts/build-dieter.js` does not exist; active
build is root `scripts/build-dieter.js`; `dieter/components/` has 26 dirs.

Note: this PRD has been strengthened since GLM's earlier review — the Focus/Touch reversal
(de-scope, not wire) is now explicit, the `--vertspace-*` "intentionally separate" hedge is
gone, and prior flags are resolved.

---

## Lens 1 — Staff Engineer (architecture & product law)

### 1. Elegant engineering & scalability
- The **Dieter Contract** (113-130) names the existing matrioska by-reference model without
  inventing a new system: tokens → components → surfaces, each pointing inward. "Names the
  existing matrioska contract without inventing a new design system. It gives agents a
  deterministic source/consumer model" (129-130).
- **Foundation Token Map** (132-155) pins the existing substrate without adding token
  families. The deterministic framework that expands = the named map.
- **Exceptional routing discipline** (274-302): every undefined/drift token is routed to its
  owning PRD — `--color-surface`→126B, `--radius-2`→126H radius law, stale vertspace→126H,
  `--easing-standard`/durations→126F, icon glyph→126C/126I. "This keeps each fix in the
  owning PRD and prevents 126H from becoming a catch-all alias layer" (301-302).
- **Focus/Touch reversal** (199-226): de-scope/delete `--focus-ring-*` and
  `--min-touch-target`; no mobile/keyboard doctrine; route to 126A. "Prevents 126H from
  backdooring mobile/touch or keyboard accessibility doctrine after 126A already bounded the
  accessibility program" (225-226). Correct — and the call GLM got wrong in its earlier pass.

### 2. Compliance to architecture & tenets
- **No-invented-machinery:** "does not create a new framework, token taxonomy, component
  library, layout system, focus system, or mobile/touch doctrine" (107-109). Out of Scope
  (373-388) is airtight. Strong.
- **Pre-GA no-legacy:** remove stale vertspace spellings, no alias compatibility by default
  (146, 280, 297); radius direction "remove the numeric alias concept" (190-191). Compliant.
- **Reveal-not-masquerade / anti-V6:** `--shadow-elevated` "cannot remain fake doctrine if
  it is not consumed" (236).

### 3. Overarchitecture / unnecessary complexity
- None — anti-overarchitecture by design.

### 3b. Academic abstractions / pre-work / meta-work / gold-plating
- Concrete throughout. Not academic.

### 4. Prose / bedtime stories / leeway to invent
- Routing is specific; minimal leeway.
- **Focus/touch three-option gate** (212-214): "de-scoped, deleted, or explicitly documented
  as non-current unless the human later decides." Three options — a dev needs to know which
  applies. It's a pending human decision, not leeway, but flag: execution should pick one
  posture per token rather than leave all three open.
- `--control-inline-gap-*` cleanup (140-142): a dev needs clear guidance on when to use
  `--space-*` vs `--vertspace-*` vs control gaps (the 8px-triple-definition). Execution
  target (170) addresses it.

### 5. Needed documentation updates (DEV perspective)
- **`dieter.md` kb doc errors (verified):**
  1. Line 70: "Build. `dieter/scripts/build-dieter.js` bundles…" — **that file does not
     exist**; active build is root `scripts/build-dieter.js`. Same stale-path drift as
     `ops.md`/`iconography.md`. Fix. (The PRD execution target line 350 says rewrite
     `dieter.md` — known.)
  2. Line 7 "Source of truth" includes `dieter/scripts/*` — misleading; the real build script
     is at root and `dieter/scripts/` holds only the orphaned `build-icons.mjs`.
  3. Line 32 "~27 components" — actual count is **26** (verified). Minor.
  4. Line 78 "Dark mode: engine is dark-ready, dark palette not shipped" — slight tension
     with 126B's "no dark mode (not even scaffolding)" stance. 126H itself doesn't claim
     dark-ready; the kb doc does. Reconcile.

### Blast radius (Staff Engineer)
- **No structured "Detailed Blast Radius" table** (Execution Gap Targets list, 346-371) —
  same structural gap as 126D/126E/126F/126G. Per the explicit program mandate *"ENSURING
  DETAILED COVERAGE OF BLAST RADIUS IN PRD ITSELF,"* add the may/must-not table.
- Content covers `dieter-foundation-tokens.css`, Dieter components, `dieter.md` + related
  docs. Accurate.

**VERDICT: GREEN** — execution-ready. Note-level: dieter.md kb-doc fixes; add blast-radius
table + V1-V8 section.

---

## Lens 2 — Senior PM (product UX)

### 1. Elegant product UX & scalability
- 126H is substrate (foundational), not directly user-facing — but pinning the token map
  means consistent spacing/radius/elevation across all surfaces → consistent feel. Removing
  drift (`--hspace`→`--vertspace`, `--radius-2`) removes inconsistent rendering.
- Focus/touch de-scope keeps desktop operational UI dense (no mobile target inflation) —
  correct for a tool product.

### 2. Compliance to product-UX best practices
- M3/Apple/OpenAI support named substrate decisions. Aligned.
- Not importing 44px touch doctrine is a defensible product-scope call (desktop tool).

### 3. Bad UX writing for the user
- N/A (substrate doctrine).

### 4. How Clickeen differs from legacy SaaS + alignment
- Matrioska by-reference substrate is more disciplined than legacy SaaS design systems. The
  foundation is "in some places more granular than the external north stars" (92). Aligned
  with "don't fix what's world-class."

### 5. Needed documentation updates (vision/architecture/system)
- `dieter.md` frames the matrioska well ("by reference, not copy" as the load-bearing rule,
  line 19-22). Good vision. Fix the build path + dark-ready + component count.

### Blast radius (PM)
Substrate across all surfaces. Covered.

**VERDICT: GREEN** — findings note-level (kb-doc fixes).

---

## Lens 3 — Principal TPM (systems, V1-V8, competitive)

### 1. Cohesive, cost-effective architecture
- Substrate contract, no new subsystem. The routing prevents a catch-all alias layer. Cost =
  token/source cleanup + doc rewrite. Cohesive.

### 2. Clarity on systems — no invented subsystems
- The Dieter Contract makes Dieter the single substrate authority; consumers consume, don't
  redefine (122-123). Routing to owning PRDs (126B/C/F/I/K/L/M) keeps boundaries clean. No
  invented subsystem.

### 3. SaaS world-class vs competitors (technical)
- Matrioska by-reference + granular foundation = world-class design-system substrate. The
  discipline (no framework; route drift to owners; make the foundation honest not bigger) is
  strong. Correctly prepares 126I/126L/126M to consume deterministically (104-105, 415-416).

### 4. Absence of V1-V8 violations — no explicit section (like D/E/F/G). Assessed:
- **V1 Silent substitution — PASS.** Undefined tokens (`--color-surface`, `--radius-2`)
  routed to owners, not silently aliased (280, 292-294); `--shadow-elevated` can't be fake
  doctrine (236).
- **V2 Silent healing — PASS.** Stale vertspace spellings removed, not normalized into
  aliases (167-169, 297).
- **V3 Silent omission — PASS.** Blast radius via execution targets.
- **V4 Fail-open control — N/A** (no enforcement machinery).
- **V5 Corruption-as-absence — N/A.**
- **V6 Partial-success masquerade — PASS.** `--shadow-elevated` fake doctrine forbidden.
- **V7 Masquerade/redress — PASS.** Dead tokens de-scoped/deleted, not renamed as features
  (212-214); radius aliases not kept as compatibility.
- **V8 Runtime test dependency — PASS.** No validation machinery.
- **All 8 PASS — not pre-mapped.** Add the section for consistency.

### 5. Needed documentation updates (TPM perspective)
- Add V1-V8 pre-controls + a structured blast-radius table (consistency with B/C; satisfies
  the blast-radius mandate).
- Cross-PRD index: color→126B; icons→126C; type→126D; motion→126F; ops→126G; components→126I;
  dialogs→126K; DevStudio→126L; Roma→126M.

### Blast radius (TPM)
Dieter foundation tokens + components + docs. **No** services/data touched. Accurate content,
not tabulated.

**VERDICT: GREEN** — all V1-V8 PASS; note-level.

---

## Consolidated Verdict

| Lens | Verdict | Blocking? |
| --- | --- | --- |
| Staff Engineer | GREEN | No |
| Senior PM | GREEN | No |
| Principal TPM | GREEN (V1-V8 all PASS) | No |

**126H is execution-ready.** All three lenses green. Note-level findings:

1. **`dieter.md` kb doc errors (verified):** (a) build path `dieter/scripts/build-dieter.js`
   (line 70) — file does not exist; active is root `scripts/build-dieter.js`; (b) `dieter/scripts/*`
   in "Source of truth" (line 7) misleading; (c) "~27 components" (line 32) — actual 26;
   (d) "dark-ready" (line 78) slight tension with 126B's no-dark-mode. Fix in execution.
2. **No structured blast-radius table + no V1-V8 section** (same as D/E/F/G). Add for
   consistency and to satisfy the explicit blast-radius mandate.
3. **Focus/touch three-option gate** (de-scope/delete/document-non-current) is a pending human
   decision — execution should pick one posture per token.
4. **Strengths noted:** Dieter Contract (matrioska, no reinvention); exceptional routing
   (every drift to its owner — no catch-all); Focus/Touch reversal (correct — the call GLM
   got wrong earlier, now right); anti-machinery airtight; "honest and consumed, not bigger."
5. **Prior GLM flags resolved:** the button/focus finding is handled via the Focus/Touch
   section; the `--vertspace-*` "intentionally" hedge is gone; the 8px/stale-spelling cleanup
   is explicit.

None block execution. **126H complete — end of A–H pre-execution pass.**
