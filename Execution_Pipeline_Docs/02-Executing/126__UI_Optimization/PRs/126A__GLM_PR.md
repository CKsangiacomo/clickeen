# 126A Accessibility — GLM Pre-Execution Peer Review

Status: PRE-EXECUTION peer review (main-thread, 3 lenses: Staff Engineer, Senior PM,
Principal TPM). Subject: `126A__PRD__Accessibility.md` (Status: PRE-EXECUTION READY).
Grounded in `audits/126A__AsBuilt_{Codex,GLM}.md`, `research/126A_Research_{Codex,GLM}.md`,
`documentation/engineering/UI/accessibility.md`, and code grep across `dieter/`,
`bob/`, `roma/`, `admin/` (2213 aria/role usages verified; aria-live/role=dialog
sites confirmed).

This review checks whether the PRD is execution-ready: compliant with Clickeen
architecture/product law, free of invented machinery, honest about blast radius,
and non-preserving of toxic code/flows. It does not change the PRD.

---

## Lens 1 — Staff Engineer (architecture & product law)

### 1. Elegant engineering & scalability
- The core elegance: 126A makes accessibility a **semantic-truth contract**, not a
  behavior program. The state-mapping table (PRD §1, lines 166-176) is a clean
  lookup — product state → required semantic rule — that an agent applies
  per-component. No central system, no runtime. This scales because it's a rule,
  not infrastructure.
- The blast-radius table (§"Detailed Blast Radius", 405-420) splits "may change" vs
  "must not change" per area. That is engineering discipline most PRDs lack.
- Routing discipline: motion→126F (§8), dialog mechanics→126K (§5), contrast→126B
  (§9), component behavior→126I. Keeps 126A from becoming a god-PRD.

### 2. Compliance to architecture & tenets
- **No-invented-machinery:** strongly compliant. Explicitly refuses keyboard,
  focus, touch, contrast, and validator programs (Human Decisions 82-98; Out of
  Scope 457-469). This is the hardest tenet to hold in an accessibility PRD and
  it holds.
- **Pre-GA no-legacy:** "remove old drift," "do not leave legacy names… as
  supported alternatives" (73-78). Compliant.
- **Reveal-not-masquerade / anti-V6/V7:** "do not call a surface a modal unless
  behavior is dialog-like" (271); "do not claim success when part failed" (312).
  Compliant.
- **Not-the-product-owner:** contrast decisions stay human-owned (95, 366-372).

### 3. Overarchitecture / unnecessary complexity
- None of substance. The PRD's defining virtue is being anti-overarchitecture.
- Prose redundancy (not overarchitecture): the same gap list recurs in Current
  Reality (117-127), Gap-To-Fix Categories (422-438), and Known Gaps To Carry
  Forward (440-453). A dev reads the same items three times. Consolidate.

### 3b. Academic abstractions / pre-work / meta-work / gold-plating
- Concrete throughout, not academic. Good.
- Mild meta-work: five closing sections (Execution Checklist, Done-For, Compliance,
  + two gap sections) for a pre-execution doc. Defensible for "execution-grade," but
  a dev may find the tail heavy. Not gold-plating.

### 4. Prose / bedtime stories / leeway to invent
- Actionable, not narrative. Strong.
- **Leeway risk (dev-facing ambiguity):**
  - Line 213-215: unresolved pseudo-controls "routed to the owning PRD" — *which*
    PRD (126I / 126L / 126M)? A dev needs the destination named.
  - Line 348-350: motion-only signals "route to 126F **or** the owning
    component/screen PRD" — when is it 126F vs the component PRD? Pick a rule.
- Quote (240): "`aria-label` that disagrees with the visible/product action" is
  forbidden — good, removes leeway.

### 5. Needed documentation updates (DEV perspective)
- `accessibility.md` is **already** narrowed to 126A doctrine (verified by read).
  The PRD's execution target "rewrite to narrowed 126A doctrine" (414) is partly
  done — dev should VERIFY, not blindly rewrite.
- `dialogs-and-modals.md` must drop focus-trap/scroll-lock/z-index mandates that
  contradict 126A (415) — real, open doc work (that doc currently carries broader
  language).
- Cross-refs in `components.md`, `interactions.md`, `motion.md`, `color.md`
  (416-419) — dev updates.

### Blast radius (Staff Engineer)
PRD's table is accurate against code. Verified aria-live/role=dialog sites: dieter
`bulk-edit`, `textedit`, `dropdown-edit`, `dropdown-upload`, `agent-activity`; bob
`UpsellPopup`, `Workspace`, `TranslationsPanel`; roma `assets-domain`,
`pages-domain`, `widgets-domain`, `roma-account-notice-modal`; admin `main.ts`
(token editor) + `tools/llm-management.html`, `tools/entitlements.html`.
- **Omission:** the GLM audit found undefined-token code defects — `--color-surface`
  (`button.css:8,190,321`) and `--hspace-*` (`tabs.css:50,59,64`, `textfield.css:4`,
  `dropdown-{fill,border,shadow}.css`). A dev executing 126A on `button`/`tabs`/
  dropdowns will hit these. They belong to 126B/126H, but 126A's blast radius does
  not flag the cross-dependency. Add one line so the dev knows the encounter is
  expected and routed, not a surprise.
- **Omission:** the dead `-contrast` ramp and dead `--min-touch-target` (GLM audit
  Facet 3) will surface when recording contrast evidence (§9). Note they're
  126B/126H-owned, not 126A fixes.

**VERDICT: GREEN** — execution-ready, anti-machinery, blast radius accurate with two
note-level cross-dependency omissions. No blocking defect.

---

## Lens 2 — Senior PM (product UX)

### 1. Elegant product UX & scalability
- The PRD's best product instinct: in an **agent-operated** product where AI does
  async work (translation generation, Copilot edits), the user must see truthful
  save/generate/fail states. "Do not communicate operation state only through
  color, spinner motion, or icon" (311) and "do not claim success when part failed"
  (312) are exactly right for this product.
- Naming icon-only actions (228) is a direct clarity win, not just a11y compliance.

### 2. Compliance to product-UX best practices
- Aligns with M3/Apple/OpenAI on native controls, semantic state, visible status,
  motion-not-only-signal, text resilience. These are the right practices.
- **PM flag — mobile/touch deferral:** excluding touch-target sizing means
  clickeen's dense 16-32px controls stay below the 44px standard (GLM audit Facet
  3B: `--control-size-xl`=32px, `--min-touch-target`=44px dead in dieter).
  Defensible for desktop Bob/Roma/DevStudio; the PRD says so (90-91). BUT public
  widgets render on visitor mobile — and widgets are explicitly out of 126A scope
  (315-316, 350). Ensure widget PRDs actually pick up visitor touch-target a11y so
  this deferral doesn't fall through the cracks.

### 3. Bad UX writing for the user
- The doctrine prevents the worst UX-writing sin: partial-success masquerade (312).
- Text resilience (§7): "must not expose backend language/locale names when
  user-facing language names are required" (331-332) — prevents leaking `en-US`
  codes to users. Good.
- No bad user-facing copy sanctioned. Strong.

### 4. How Clickeen differs from legacy SaaS + alignment
- Legacy SaaS a11y assumes human-initiated synchronous actions. Clickeen is
  agent-operated: AI does async work. The PRD's emphasis on **Agent Activity
  semantics** (306) and **honest async status** (saving/generating/failure) is
  aligned with that differentiator — this is where the PRD is most right.
- Widget runtime split (independent product software) correctly excluded (315-316).
  Aligned with the two-lane authority established in 126D/126F.

### 5. Needed documentation updates (vision/architecture/system)
- `accessibility.md` lists the rules but doesn't frame **why**: the distinguishing
  a11y win for an agent-operated product is truthful async-state revelation. Add
  the product thesis (one paragraph) so future agents understand the intent, not
  just the rules.

### Blast radius (PM)
User-facing surfaces covered: Roma domain modals (assets/pages/widgets/builder +
account-notice), Bob workspace/translations/upsell, DevStudio token editor.
Correctly excludes public widget runtime — but PM must confirm widget PRDs own the
visitor-facing gap (see #2).

**VERDICT: GREEN** — findings note-level (touch-target mobile deferral tracking;
async-thesis framing in the kb doc). No blocking defect.

---

## Lens 3 — Principal TPM (systems, V1-V8, competitive)

### 1. Cohesive, cost-effective architecture
- 126A is a doctrine layer over existing Dieter components + surfaces — no new
  service, gateway, or subsystem. Execution cost = markup/ARIA edits per surface,
  no infra. Cost-effective and cohesive.
- Correctly defers to owning PRDs (126B/126F/126K/126I/126L/126M). System
  boundaries respected.

### 2. Clarity on systems — no invented subsystems
- 126A invents nothing. It is a contract applied at the component/surface layer.
  The routing to 126F/126K/126I is explicit system-boundary discipline. Clean.

### 3. SaaS world-class vs competitors (technical)
- M3/Apple/OpenAI/WCAG all emphasize semantic state, native controls, visible
  status, motion-not-only-signal. 126A adopts exactly these and **explicitly
  rejects** the heavy machinery (keyboard-complete, focus-trap, touch-target
  program, contrast automation) that over-engineered enterprise a11y programs
  build. This is a defensible lean posture.
- **Competitive flag:** rivals ship WCAG 2.1 AA conformance claims, especially for
  public-facing surfaces. 126A explicitly does NOT claim WCAG (457). Fine for
  system/operational UI (Bob/Roma/DevStudio); a competitive gap for **public
  widgets** — out of scope here, but ensure widget PRDs address visitor WCAG or
  clickeen's public surfaces trail on a11y claims.

### 4. Absence of V1-V8 violations (AGENTS.md:234-257) — per-violation
- **V1 Silent substitution — PASS.** Pseudo-controls that can't be replaced must
  be LISTED as gaps, not silently substituted (213-215); "aria-label that
  disagrees with the action" is forbidden (240). Risk note: a dev "naming" an
  icon button with an invented label would be V1 — the PRD guards it.
- **V2 Silent healing — PASS.** 126A exposes state honestly; no normalization of
  invalid state.
- **V3 Silent omission — PASS (with note).** Replacing pseudo-controls (div
  role=button → native button) could silently drop behavior; PRD scopes this to
  "component-owned" cleanup (407) and requires listing unresolved ones. Mitigated.
- **V4 Fail-open control — PASS.** No enforcement machinery exists (contrast gates
  forbidden, 370), so nothing can fail open.
- **V5 Corruption-as-absence — N/A.** 126A touches no stored state.
- **V6 Partial-success masquerade — PASS (strong).** Explicitly forbidden (312).
  This is 126A's core anti-masquerade contribution.
- **V7 Masquerade/redress — PASS.** "Do not call a surface a modal unless
  dialog-like" (271); "status/banner surfaces should not be fake dialogs" (287).
- **V8 Runtime test dependency — PASS.** Validator/test suites forbidden (458,
  386); no runtime checks added.
- **All 8 PASS.**

### 5. Needed documentation updates (TPM perspective)
- The cross-PRD deferrals (126A→126B/126F/126K/126I/126L/126M + widget PRDs) need a
  tracker so routed items don't vanish. The PRD lists them inline but there is no
  visible cross-PRD dependency index. Ensure MAMA (or a tracker) captures:
  undefined tokens (`--color-surface`, `--hspace-*`) → 126B/126H; dead
  `-contrast`/`--min-touch-target` → 126B/126H; mobile visitor touch/WCAG → widget
  PRDs; dialog mechanics → 126K.

### Blast radius (TPM)
Systems touched = Dieter components, Bob, Roma, DevStudio surfaces, UI docs.
**No** services/routes/data/deploy touched (PRD 467-469). Verified accurate — blast
radius is correctly bounded to the UI truth surface.

**VERDICT: GREEN** — all V1-V8 PASS; findings note-level (widget WCAG competitive
tracking; cross-PRD dependency index). No blocking defect.

---

## Consolidated Verdict

| Lens | Verdict | Blocking? |
| --- | --- | --- |
| Staff Engineer | GREEN | No |
| Senior PM | GREEN | No |
| Principal TPM | GREEN (V1-V8 all PASS) | No |

**126A is execution-ready.** All three lenses green. Findings are note-level, grouped:

1. **Routing ambiguity** (Staff #4): name the destination PRD for unresolved
   pseudo-controls (213-215) and pick a rule for 126F-vs-component-PRD on
   motion-only signals (348-350).
2. **Cross-dependency not in blast radius** (Staff blast / TPM #5): 126A execution
   will encounter undefined `--color-surface` / `--hspace-*` (→126B/126H) and dead
   `-contrast` / `--min-touch-target`. Add one line so it's an expected, routed
   encounter, not a surprise.
3. **Mobile/touch + public-widget WCAG deferral** (PM #2, TPM #3): correctly out of
   126A scope, but ensure widget PRDs own visitor touch-target/WCAG so the
   deferral doesn't drop.
4. **Doc status** (Staff #5): `accessibility.md` is already narrowed — verify, don't
   rewrite blind. `dialogs-and-modals.md` still needs the focus-trap/scroll-lock
   cleanup (real open work).
5. **Prose redundancy** (Staff #3): the gap list appears 3× — consolidate.

None of these block execution; they sharpen it. Proceed to 126B.
