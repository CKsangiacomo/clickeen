# 126E Interactions — GLM Pre-Execution Peer Review

Status: PRE-EXECUTION peer review (main-thread, 3 lenses: Staff Engineer, Senior PM,
Principal TPM). Subject: `126E__PRD__Interactions.md` (Status: HUMAN-CONVERGED PRODUCT
STANDARD). Grounded in `audits/126E__AsBuilt_{Codex,GLM}.md`, `research/126E_Research_{Codex,GLM}.md`,
`documentation/engineering/UI/interactions.md`, and Roma/Bob source citations in the PRD.
This review checks execution-readiness; it does not change the PRD.

---

## Lens 1 — Staff Engineer (architecture & product law)

### 1. Elegant engineering & scalability
- The **state vocabulary** (§State Vocabulary, 150-171) is a clean classification contract:
  11 named states; every async surface must classify which apply and "must not silently
  omit a relevant state" (160). Agents get one vocabulary instead of inventing per surface.
- The **command lifecycle** (§Command Lifecycle, 180-201) is explicitly *behavioral
  vocabulary, not a framework*: "not a shared framework, global store, generic state
  machine, or abstraction mandate" (194-196). This is the hardest anti-machinery line to
  hold in an interactions PRD and it holds.
- **Confirmed persistence vs browser-memory optimism** (203-231) precisely captures Bob's
  architecture: edit in memory, persist at save. Correct, not invented.
- **126B state bridge** (338-355): behavior in 126E, color in 126B. Clean ownership seam.

### 2. Compliance to architecture & tenets
- **No-invented-machinery:** "defines interaction semantics, not a new framework" (131);
  no toast/snackbar system (241); command lifecycle not a framework/store/state-machine
  (194-196). Strong.
- **Pre-GA no-legacy:** remove drift, no legacy feedback paths/copy maps (44-45); converge
  monetization fragmentation (264-265). Compliant.
- **Reveal-not-masquerade / anti-V6:** "command must not claim full success when only part
  completed" (187-188); partial success first-class (305-306). Strong.
- **PRD 125 alignment:** monetization enforcement stays with policy/routes, not disabled
  precheck (258-259). Correct.

### 3. Overarchitecture / unnecessary complexity
- None. State vocabulary + lifecycle are vocabulary, not systems.

### 3b. Academic abstractions / pre-work / meta-work / gold-plating
- Concrete, cited (file:line in Current Reality). Not academic.

### 4. Prose / bedtime stories / leeway to invent
- **Leeway (§Agent Activity, 279-289):** "Short single-step agent commands can use
  pending/conversational feedback. Longer or multi-phase agent operations expose real
  progress." The boundary between "short single-step" and "longer/multi-phase" is judgment
  a dev must make per operation. Acceptable — it's a product call the PRD rightfully leaves
  to context — but note the temporary ambiguity for new agent ops.
- State classification "must not silently omit a relevant state" (160) — "relevant" is
  judgment, but the classification requirement is clear.

### 5. Needed documentation updates (DEV perspective)
- **`interactions.md` kb doc CONTRADICTS the PRD in three places (verified by read):**
  1. Line 15-16 lists **"toasts"** as a feedback pattern. The PRD explicitly states
     "Toast/snackbar is not a Clickeen doctrine" (241). Stale/wrong — remove.
  2. Line 22-25 references **"126D Step 5"** as making "every domain has the three states"
     an acceptance criterion. Wrong PRD — interactions states are owned by **126E**, not
     126D (Typography). Fix the cross-reference.
  3. Line 17-18 claims this doc owns **"Focus & keyboard flows that span components
     (arrow-key nav, escape, return focus)."** But 126A owns accessibility and *explicitly
     excludes* custom keyboard support; focus/keyboard is not 126E's lane. Remove or
     re-route to 126A/126I.
  4. The kb doc is stale-pessimistic ("states are missing today," "largely a to-be-declared
     layer") vs the PRD's defined 11-state vocabulary + real Roma domain state evidence.
     Update to the converged law.
- These are real doc bugs, not style: an agent reading the kb doc today would believe toasts
  are doctrine, that 126D owns interaction states, and that 126E owns keyboard flows — all
  false.

### Blast radius (Staff Engineer)
- **No structured "Detailed Blast Radius" table** (only an execution-gap-targets list,
  357-390) — same structural gap as 126D. Per the explicit program mandate *"ENSURING
  DETAILED COVERAGE OF BLAST RADIUS IN PRD ITSELF,"* add the may/must-not table. Content
  otherwise covers Roma account shell + domains, Bob save/session/Copilot/Translations, the
  3 monetization surfaces, assets upload, reason-key maps, docs.

**VERDICT: GREEN** — execution-ready. Note-level: kb-doc contradictions (real, fix in
execution); add blast-radius table + V1-V8 section.

---

## Lens 2 — Senior PM (product UX)

### 1. Elegant product UX & scalability
- **State honesty:** partial success is first-class (305-306) — users see what actually
  happened, not a collapsed "success." Excellent UX.
- **Save interaction** (209-212): appears when dirty, `Saving...` in flight, disappears when
  clean — matches user mental model. A permanently dimmed save button is explicitly *not*
  the target. Good.
- **Google Drive-style multi-item upload** (296-317): familiar, non-blocking, per-item
  truth. Strong UX choice for bulk asset work.

### 2. Compliance to product-UX best practices
- M3/Apple state distinctions, OpenAI tool-result/`_meta` semantics — aligned.
- **Monetization via enforcement (HTTP 402 `UPGRADE_REQUIRED`), not disabled precheck** — a
  strong UX pattern: the user can try the action and gets a clear upgrade path, never a
  mysterious disabled button. Aligns with PRD 125.

### 3. Bad UX writing for the user
- **Reason-key copy law** (319-336): raw implementation keys must not leak to user-facing
  copy (326); pending labels must reflect the actual command (191). Prevents
  `UPGRADE_REQUIRED`-style codes and generic "Loading..." lies reaching the user. Good
  UX-writing law.

### 4. How Clickeen differs from legacy SaaS + alignment
- **Agent-operated interaction model:** Agent Activity for real agent ops (translation
  generation) vs conversational feedback + apply/undo for Copilot. Legacy SaaS has no agent
  ops. The PRD gets the agent-feedback model right — this is a core differentiator.
- **Monetization-via-enforcement** (402) not precheck — differentiator vs legacy SaaS that
  disables buttons speculatively.

### 5. Needed documentation updates (vision/architecture/system)
- `interactions.md` should frame the agent-operated interaction model (the differentiator)
  and the monetization-via-enforcement pattern — currently stale/thin (see Staff #5).

### Blast radius (PM)
User-facing states/feedback across Roma/Bob/assets/Copilot covered.

**VERDICT: GREEN** — findings note-level (kb-doc rewrite).

---

## Lens 3 — Principal TPM (systems, V1-V8, competitive)

### 1. Cohesive, cost-effective architecture
- Behavioral vocabulary, no subsystem. Monetization convergence (3 fragmented surfaces →
  one product meaning) reuses existing route enforcement, no new system. Cohesive.

### 2. Clarity on systems — no invented subsystems
- Monetization enforcement stays with product routes (Roma/Paris emit 402) — existing
  systems talk, no new gateway. The 126B state bridge is a clean behavior-vs-color boundary.

### 3. SaaS world-class vs competitors (technical)
- Agent-operated interaction model (Agent Activity, Copilot apply/undo) is genuinely novel
  vs legacy SaaS. Monetization-via-402-enforcement is cleaner than competitors' disabled-
  button prechecks. Strong.

### 4. Absence of V1-V8 violations — 126D/126E have **no explicit V1-V8 section** (126B/126C do).
Assessed from content:
- **V1 Silent substitution — N/A.**
- **V2 Silent healing — N/A.**
- **V3 Silent omission — PASS (strong).** "Must not silently omit a relevant state" (160).
- **V4 Fail-open control — PASS (strong).** "Do not replace policy enforcement with disabled
  precheck" (258-259) — enforcement must not turn off when a dependency is missing.
- **V5 Corruption-as-absence — N/A.**
- **V6 Partial-success masquerade — PASS (core).** Explicitly forbidden (187-188, 305-306).
- **V7 Masquerade/redress — PASS.** Monetization fragmentation converged, not renamed as a
  feature.
- **V8 Runtime test dependency — PASS.** No validation rituals.
- **All effectively PASS** — not pre-mapped. Add the V1-V8 section for consistency.

### 5. Needed documentation updates (TPM perspective)
- Add V1-V8 pre-controls + a structured blast-radius table (consistency with B/C; satisfies
  the explicit blast-radius mandate).
- Cross-PRD index: color/state → 126B; motion → 126F; dialogs → 126K; components → 126I;
  monetization → PRD 125; keyboard/focus → 126A (not 126E).

### Blast radius (TPM)
Interaction behavior across Roma/Bob/assets/Copilot + monetization routes + docs. **No**
services/data changed (monetization reuses existing 402 routes). Accurate content, not
tabulated.

**VERDICT: GREEN** — all V1-V8 effectively pass; note-level (add V1-V8 + blast-radius table).

---

## Consolidated Verdict

| Lens | Verdict | Blocking? |
| --- | --- | --- |
| Staff Engineer | GREEN | No |
| Senior PM | GREEN | No |
| Principal TPM | GREEN (V1-V8 effectively PASS) | No |

**126E is execution-ready.** All three lenses green. Note-level findings:

1. **`interactions.md` kb doc contradicts the PRD (verified):** (a) lists "toasts" as
   feedback — PRD forbids toast doctrine (241); (b) references "126D Step 5" — wrong PRD,
   interaction states are 126E; (c) claims focus/keyboard flows ownership — 126A's lane
   (which excludes custom keyboard); (d) stale-pessimistic vs the PRD's defined vocabulary.
   These are real falsehoods an agent would inherit — fix in execution.
2. **No structured blast-radius table** (only gap-targets list) — same as 126D; add per the
   explicit blast-radius mandate.
3. **No V1-V8 pre-mapping section** (126B/126C have one). All effectively pass; add for
   consistency.
4. **Agent Activity vs conversational boundary is judgment** for new agent ops — acceptable
   product call, note the temporary ambiguity.
5. **Strengths noted:** command-lifecycle-as-vocabulary-not-framework (explicit anti-
   machinery); anti-V6 partial-success; monetization-via-enforcement (anti-V4); the agent-
   operated feedback model is a real differentiator.

None block execution. Proceed to 126F.
