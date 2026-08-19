# 126B Color — GLM Pre-Execution Peer Review

Status: FROZEN POINT-IN-TIME PRE-EXECUTION REVIEW - reviewed tree unrecorded; current readiness not established; no step-9 execution credit.
Subject: `126B__PRD__Color.md` (then labeled PRE-EXECUTION REVIEW REDRAFT).
Grounded in `audits/126B__AsBuilt_{Codex,GLM}.md`, `research/126B_Research_{Codex,GLM}.md`,
`documentation/engineering/UI/color.md`, `dieter/tokens/dieter-color-tokens.css`, and
code/file checks (incl. verified that the kb doc's cited "Driving PRD"
`126A2__SUBPRD__Color_System.md` does **not exist** — the real PRD is `126B__PRD__Color.md`).

This review checks execution-readiness: compliant with Clickeen architecture/product
law, free of invented machinery, honest blast radius, non-preserving of toxic flows.
It does not change the PRD.

---

## Lens 1 — Staff Engineer (architecture & product law)

### 1. Elegant engineering & scalability
- The **state engine** (§5, lines 220-259) is the standout: one set of mix controls
  (`--state-hover-mix`, `--state-pressed-mix`, etc.) drives hover/pressed/muted/
  inactive across every component. A component writes one `color-mix(in oklab, …)`
  formula and inherits consistent interaction depth everywhere — no per-component
  hand-tuning. This is the matrioska law at the state layer, done right.
- The **23-role semantic layer** (§3, 164-197) is a finite, look-up-able vocabulary;
  agents reference a role instead of inventing color. Appropriately sized (M3 ~26).
- The **undefined-token cleanup table** (§7, 288-301) names each token, its current
  owner path, and "do not preserve as alias" — strong hygiene.
- **V1-V8 pre-mapped** (§"V1-V8 Pre-Execution Risk Controls", 474-490) before
  execution. Rare and correct.

### 2. Compliance to architecture & tenets
- **No-invented-machinery:** explicit refusals — no resolver, registry, theme
  platform, contrast gate, dark-mode scaffold, M3 taxonomy import (Role 43-53; Out
  of Scope 461-472). Holds the hardest tenet.
- **Pre-GA no-legacy:** undefined tokens get "replace, do not preserve as alias"
  (§7) — delete/replace, not shim. Compliant.
- **Reveal-not-masquerade:** DevStudio must mark non-writable rows governed/
  read-only (§9) — anti-V6.
- **Original-source-only:** M3/Apple/OpenAI are references not law (§376-397).

### 3. Overarchitecture / unnecessary complexity
- None of substance. 23 roles is comparable to M3 and each is justified. Not
  overarchitecture.

### 3b. Academic abstractions / pre-work / meta-work / gold-plating
- Concrete throughout: exact token names, exact formulas, exact file paths for the
  chrome hardcodes (278-280). Not academic.
- Heavy closing scaffolding (V1-V8 controls + checklist + done-for + 12 gap
  categories + known-gaps), but justified for "execution-grade."

### 4. Prose / bedtime stories / leeway to invent
- **Leeway risk (§4, 204-207):** "Components may still use primitive tokens where
  the component intentionally expresses a base hue or the role layer intentionally
  permits it." — "intentionally expresses" is a judgment call. Tighten by naming
  the allowed primitive-use cases (color-picker swatches, system-color reveal,
  focus-ring color) so a dev isn't left to decide.
- **Leeway risk (§6):** the boundary between "user-authored color" and "structural
  chrome hardcode" requires judgment. The 3-site hardcode list (278-280) helps but
  is a sample, not exhaustive (see blast radius).
- Otherwise concrete and dev-actionable.

### 5. Needed documentation updates (DEV perspective)
- **`color.md` references a ghost PRD (verified).** Line 7 cites the "Driving PRD"
  as `126A2__SUBPRD__Color_System.md`; that file **does not exist** anywhere in the
  tree (confirmed via `find`). The real PRD is `126B__PRD__Color.md`. Must fix.
- **`color.md` contradicts the PRD on ownership.** Lines 124-127 state
  `--color-surface` / `--color-bg` / `--radius-2` / `--hspace-*` are "owned by a
  sibling token-fix slice, not this reference." But PRD §7 (294-295) **explicitly
  owns** `--color-surface` and `--color-bg` cleanup in 126B. The PRD is authority;
  the kb doc is wrong and must reconcile. (`--radius-2` → 126H/126J; `--hspace-*` →
  126H — those the kb doc gets right, but `--color-surface`/`--color-bg` are 126B.)
- Cross-refs in `dieter.md`, `components.md`, `interactions.md`, `accessibility.md`
  (blast radius 418-421).

### Blast radius (Staff Engineer)
PRD table is detailed and accurate against the codebase. Verified: `dieter-color-tokens.css`
is source; `scripts/build-dieter.js` copies to `tokyo/product/dieter/tokens/*`; Roma/Bob/
Admin/widgets consume it.
- **Omission:** §6's structural-chrome hardcode list (278-280) is 3 admin sites only.
  Execution "structural chrome hardcode cleanup" (gap category 8) needs an exhaustive
  grep for raw hex/rgba in structural chrome — the GLM audit's contrast table shows
  many more raw-color sites (prague `primitives.css`, button, typography) though most
  of those are contrast-evidence (human-owned), not chrome hardcodes. Execution must
  distinguish the two and produce the full chrome-hardcode list, not work from the
  3-site sample.

**VERDICT: GREEN** — execution-ready; the kb-doc ghost-PRD reference and ownership
contradiction are doc-work (the PRD already lists "rewrite color.md to current 126B
law" at 417), not PRD defects. Findings note-level.

---

## Lens 2 — Senior PM (product UX)

### 1. Elegant product UX & scalability
- The state engine yields consistent hover/pressed/disabled feel across the whole
  product — predictable interaction for users. Good UX scalability.
- Status color roles (error/success/warning/info, §3) give users consistent
  meaning everywhere. Good.

### 2. Compliance to product-UX best practices
- Role-based color, primitive→semantic→component layering, status semantics — all
  best practice (M3/Apple).
- **PM flag — dark mode:** no dark mode is a defensible product-scope call (light-
  mode contract, §347-371). BUT Bob has a typed `theme: 'light' | 'dark'` field
  (§353). If any UI exposes a dark toggle before full support exists, that is a
  masquerade (V7) and a bad-user-experience trap. Ensure no dark-mode affordance
  ships without a complete dark palette.

### 3. Bad UX writing for the user
- The doctrine governs user-facing color meaning (status colors, state feedback)
  consistently. No bad user-facing copy sanctioned.

### 4. How Clickeen differs from legacy SaaS + alignment
- The OKLAB parametric engine (base hex → derived family automatically, by
  reference) is a genuine differentiator vs legacy hand-picked HSL palettes. The
  PRD preserves it (no redesign) — aligned with "don't fix what's world-class."
- User-authored color kept legal (§6) — aligned with the widget-based product
  (users customize widget appearance). Correct two-lane thinking.

### 5. Needed documentation updates (vision/architecture/system)
- `color.md` frames the system well ("parametric, perceptually derived") — good
  vision language. Fix the ghost-PRD reference (126A2 → 126B) and the ownership
  contradiction so the vision doc matches the authority.

### Blast radius (PM)
User-facing color meaning (status colors, state feedback) across Bob/Roma/DevStudio
covered. Widget runtime defaults correctly classified separately (§6).

**VERDICT: GREEN** — findings note-level (dark-mode affordance guard; kb-doc fixes).

---

## Lens 3 — Principal TPM (systems, V1-V8, competitive)

### 1. Cohesive, cost-effective architecture
- 126B is a token-layer doctrine over existing `dieter-color-tokens.css` — no new
  service/gateway/subsystem. Cost = token CSS edits + consumer refactors. Cohesive.

### 2. Clarity on systems — no invented subsystems
- The state engine and role layer are additions to existing token CSS, not new
  subsystems. Widget classification deferred to widget ownership; DevStudio write-
  lane to 126L. Boundaries clean.

### 3. SaaS world-class vs competitors (technical)
- OKLAB perceptual engine + Apple system colors = a color system materially better
  than most competitors' HSL hand-picked palettes. The PRD sharpens it (role layer,
  state formula, undefined cleanup) without redesigning. Strong technical posture.
- No dark mode is a competitive gap vs rivals that ship it — but it's a deliberate
  product-scope deferral to a future PRD (§370). TPM notes it as a tracked
  deferral, not a defect.

### 4. Absence of V1-V8 violations — the PRD pre-maps these (474-490); verified:
- **V1 Silent substitution — PASS.** Undefined tokens replaced with real roles/
  formulas, not invented values (§7, 476).
- **V2 Silent healing — PASS.** Bad refs removed/replaced, not normalized into
  aliases (478).
- **V3 Silent omission — PASS.** Blast radius spans source/generated/consumers/
  DevStudio/widgets/docs (480).
- **V4 Fail-open control — PASS.** CSS fallbacks must not hide missing source truth
  (482). Note: current code has fallback-masked refs (`--hspace-*` etc.); 126B
  correctly scopes to color (`--color-surface`/`--color-bg`), routing `--hspace-*`
  to 126H.
- **V5 Corruption-as-absence — PASS.** Missing tokens are bugs, not decoration (484).
- **V6 Partial-success masquerade — PASS (strong).** DevStudio must not reveal
  writable rows it can't edit (486, §9).
- **V7 Masquerade/redress — PASS.** Dark artifacts not renamed as support/readiness
  (488).
- **V8 Runtime test dependency — PASS.** No contrast gates/validation rituals (490).
- **All 8 PASS, pre-mapped by the PRD itself.** Excellent TPM discipline.

### 5. Needed documentation updates (TPM perspective)
- Track the kb-doc ghost-PRD reference + ownership contradiction as execution items.
- Cross-PRD dependency index should capture: `--color-surface`/`--color-bg` → 126B
  (this PRD); `--hspace-*` → 126H; `--radius-2` → 126H/126J; dark mode → future PRD;
  DevStudio write-lane → 126L.

### Blast radius (TPM)
Token CSS + generated output + consumers + DevStudio + widgets + docs. **No**
services/routes/data/deploy touched. Accurate and correctly bounded.

**VERDICT: GREEN** — all V1-V8 PASS and pre-mapped; findings note-level.

---

## Consolidated Verdict

| Lens | Verdict | Blocking? |
| --- | --- | --- |
| Staff Engineer | GREEN | No |
| Senior PM | GREEN | No |
| Principal TPM | GREEN (V1-V8 all PASS, pre-mapped) | No |

**126B is execution-ready.** All three lenses green. Note-level findings:

1. **`color.md` ghost-PRD reference (verified).** Line 7 cites `126A2__SUBPRD__Color_System.md`
   which does not exist; real PRD is `126B__PRD__Color.md`. Fix.
2. **`color.md` contradicts PRD §7 on ownership.** kb lines 124-127 say `--color-surface`/
   `--color-bg` are "a sibling token-fix slice, not this reference"; PRD §7 owns them in
   126B. Reconcile kb doc to the PRD (authority).
3. **§4 leeway** (204-207): "intentionally expresses a base hue" — name the allowed
   primitive-use cases so devs don't guess.
4. **§6 hardcode list is a 3-site sample**, not exhaustive (278-280). Execution must grep
   for the full structural-chrome hardcode set and distinguish chrome hardcodes from
   contrast-evidence sites.
5. **Dark-mode affordance guard** (PM): Bob's `theme: 'light'|'dark'` field must not
   surface a dark toggle before a complete dark palette exists (anti-V7 masquerade).
6. **Strength noted:** V1-V8 controls are pre-mapped in the PRD (§474-490) — best-in-class
   among the 126 PRDs reviewed so far.

None block execution. Proceed to 126C.
