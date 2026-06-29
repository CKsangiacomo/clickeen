# 126F Motion — GLM Pre-Execution Peer Review

Status: PRE-EXECUTION peer review (main-thread, 3 lenses: Staff Engineer, Senior PM,
Principal TPM). Subject: `126F__PRD__Motion.md` (Status: HUMAN-CONVERGED PRODUCT STANDARD),
read this session. Grounded in `audits/126F__AsBuilt_{Codex,GLM}.md`, `research/126F_Research_{Codex,GLM}.md`,
`documentation/engineering/UI/motion.md`, `dieter/tokens/dieter-foundation-tokens.css`.
This review checks execution-readiness; it does not change the PRD.

---

## Lens 1 — Staff Engineer (architecture & product law)

### 1. Elegant engineering & scalability
- **Intentionally small** — and that *is* the elegant engineering. Resists a motion engine,
  `MotionProvider`, choreography library, animation registry, enter/exit pattern library,
  shared animation runtime (Small Motion Law). The expansion mechanism is explicit and
  disciplined: "A new duration token is allowed only when a real component/product motion
  need exists and the human accepts it as Clickeen law." New motion = named product
  behavior, not generic machinery.
- **Two-lane boundary** (system motion vs widget runtime) — same disciplined split as 126D
  typography. Correct: widget motion is independent product software, not Dieter doctrine.
- **GLM findings sharp and routed:** 2 dead duration tokens (`--duration-snap`/`--duration-spin`,
  zero consumers), button untokenized (3× literal `150ms ease`), segmented's hidden
  `--seg-transition` bezier, `--easing-standard` dangling (2 refs, never defined), repeater
  JS inline transitions bypassing the reduced-motion guard, Roma/Bob duplicated
  `transform 150ms ease`.
- **Reduced-motion honesty:** the CSS global guard is not enough for JS-written transitions
  (repeater) — JS must check `prefers-reduced-motion` directly. Correct.

### 2. Compliance to architecture & tenets
- **No-invented-machinery:** the explicit forbidden list (framework/`MotionProvider`/
  choreography/registry/enter-exit/runtime) is the strongest possible hold. This is the
  anti-overarchitecture PRD.
- **Pre-GA no-legacy:** remove duplicated Roma/Bob literals; reconcile dead tokens (wire or
  remove, don't keep dead doctrine). Compliant.
- **Reveal-not-masquerade / anti-V6:** widget motion "must not claim progress, success, or
  activity that is not real widget/product state."

### 3. Overarchitecture / unnecessary complexity
- None — by design.

### 3b. Academic abstractions / pre-work / meta-work / gold-plating
- Concrete throughout. Not academic.

### 4. Prose / bedtime stories / leeway to invent
- **Dependency gate (Easing):** `--easing-standard`'s exact value is "human-owned Clickeen
  product feel," to be defined "after the human confirms the value." So easing *execution*
  is blocked on a human value decision. Not leeway — an explicit pending decision — but flag
  it: the PRD is ready, easing execution is not, until the human picks the curve.
- **Reduced-motion judgment:** "Simple opacity fades may remain when they clarify state and
  do not create spatial movement" — the keep-fade vs remove-transform line is per-element
  judgment. Acceptable.

### 5. Needed documentation updates (DEV perspective)
- **`motion.md` kb doc line 25 (verified):** "completing [the easing gap] is a 126A
  deliverable." **Wrong** — easing is 126F's domain (126A is accessibility, which excludes
  motion). The PRD itself flags this mislabel in its Current Reality ("docs… mislabel the
  easing gap as a 126A deliverable"). Fix the kb doc to 126F.
- **`motion.md` line 38-40 tension:** says "the 126 series is where it gets deliberately
  completed (durations scale + easing tokens…)" — "durations scale" implies expansion the
  PRD explicitly forbids (keep 3, don't expand preemptively). Soften the kb doc to match.

### Blast radius (Staff Engineer)
- **No structured "Detailed Blast Radius" table** — execution gap targets are embedded
  per-subsection (Duration / Easing / Reduced Motion / Operational UI / Widget). Same
  structural gap as 126D/126E. Per the explicit program mandate *"ENSURING DETAILED COVERAGE
  OF BLAST RADIUS IN PRD ITSELF,"* add a consolidated may/must-not table. Content covers
  `dieter-foundation-tokens.css`, button/menuactions/textrename/repeater/segmented CSS,
  Roma/Bob/Admin literals, widget docs, `motion.md`.

**VERDICT: GREEN** — execution-ready (the PRD itself). Note: easing *execution* is gated on
a human value decision. Doc-level: kb-doc mislabel + blast-radius table + V1-V8 section.

---

## Lens 2 — Senior PM (product UX)

### 1. Elegant product UX & scalability
- **"Motion must not be decorative in operational UI"** — correct posture for a tool
  product. Operational UI (Bob/Roma/DevStudio) should feel stable/readable, not animated.
- Reduced-motion respected (real comfort/accessibility need); widget motion freedom
  preserved (brand/content animation in customer widgets).

### 2. Compliance to product-UX best practices
- M3 purposeful motion, Apple Reduce Motion / Prefer Cross-Fade Transitions, OpenAI
  host-state-constrained motion — all aligned.
- "Reduced motion removes transforms but keeps opacity fades" matches Apple's cross-fade
  preference. Good.

### 3. Bad UX writing for the user
- Internal doctrine. No bad user-facing copy.

### 4. How Clickeen differs from legacy SaaS + alignment
- **Intentionally-minimal motion for operational UI** is a differentiator vs legacy SaaS
  that over-animates. Correct for an agent-operated tool where readability beats delight.
- Two-lane (system minimal, widget free) respects the widget-based product.

### 5. Needed documentation updates (vision/architecture/system)
- `motion.md` should frame *why* motion is minimal on purpose (operational-tool readability)
  — currently lists gaps without the product rationale.

### Blast radius (PM)
Operational UI motion feel (Bob/Roma/DevStudio) + widget motion freedom. Covered.

**VERDICT: GREEN** — findings note-level (kb-doc rationale + mislabel fix).

---

## Lens 3 — Principal TPM (systems, V1-V8, competitive)

### 1. Cohesive, cost-effective architecture
- Minimal token set, no subsystem. Cohesive and cost-effective (execution = token defs +
  literal replacement, no infra).

### 2. Clarity on systems — no invented subsystems
- Two-lane boundary clean. No new subsystem; the widget lane is explicitly outside Dieter.

### 3. SaaS world-class vs competitors (technical)
- Intentionally-minimal motion is defensible — Apple/M3 both favor purposeful minimal
  motion. The restraint (no animation framework) is world-class discipline vs competitors
  who ship heavy animation libraries. Not trailing.

### 4. Absence of V1-V8 violations — no explicit section (like 126D/126E). Assessed:
- **V1 Silent substitution — PASS (mitigated, gated).** `--easing-standard` is dangling
  (defined nowhere → resolves to `ease`). PRD owns it (define after human confirms). The
  dangling token is a latent V1 risk; resolved by the PRD's define-or-remove.
- **V2 Silent healing — N/A.**
- **V3 Silent omission — PASS.** Dead tokens reconciled (wire or remove), not kept as dead
  doctrine.
- **V4 Fail-open control — N/A.**
- **V5 Corruption-as-absence — N/A.**
- **V6 Partial-success masquerade — PASS.** Widget motion must not claim false
  progress/success/activity.
- **V7 Masquerade/redress — PASS.** Roma/Bob duplicated literals converged, not preserved
  as parallel paths.
- **V8 Runtime test dependency — PASS.** No motion-validation rituals.
- **All effectively PASS** — not pre-mapped. Add the V1-V8 section for consistency.

### 5. Needed documentation updates (TPM perspective)
- Add V1-V8 pre-controls + a structured blast-radius table (consistency with B/C; satisfies
  the blast-radius mandate).
- Cross-PRD index: `--easing-standard` value → human decision (execution gate); widget
  motion → widget PRDs; reduced-motion JS coverage → 126I/component; `--duration-snap/spin`
  reconciliation → 126F execution.

### Blast radius (TPM)
`dieter-foundation-tokens.css` + component CSS + Roma/Bob/Admin literals + widget docs +
`motion.md`. **No** services/data touched. Accurate content, not tabulated.

**VERDICT: GREEN** — all V1-V8 effectively pass; note-level.

---

## Consolidated Verdict

| Lens | Verdict | Blocking? |
| --- | --- | --- |
| Staff Engineer | GREEN | No |
| Senior PM | GREEN | No |
| Principal TPM | GREEN (V1-V8 effectively PASS) | No |

**126F is execution-ready** (as a PRD). All three lenses green. Note-level findings:

1. **`motion.md` kb doc mislabels the easing gap as a "126A deliverable" (verified, line 25)**
   — should be 126F. The PRD itself flags this; fix the kb doc.
2. **`motion.md` "durations scale" tension** (line 38-40) — implies scale expansion the PRD
   forbids. Soften.
3. **Easing execution is gated on a human value decision** — `--easing-standard`'s value is
   human-owned, pending confirmation. The PRD is ready; easing execution is not, until the
   human picks the curve. Flag as the one execution dependency to schedule.
4. **No structured blast-radius table + no V1-V8 section** (same as 126D/126E). Add for
   consistency and to satisfy the explicit blast-radius mandate.
5. **Strengths noted:** intentionally small (the anti-overarchitecture PRD); two-lane
   boundary; sharp GLM findings (dead tokens, untokenized button, hidden segmented bezier,
   dangling easing, repeater JS reduced-motion hole, Roma/Bob duplication) all routed.

None block execution. Proceed to 126G.
