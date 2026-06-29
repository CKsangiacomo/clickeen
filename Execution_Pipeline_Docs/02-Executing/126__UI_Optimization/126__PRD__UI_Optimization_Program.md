# PRD 126 — MAMA: UI Optimization Program

Status: DRAFT — DIRECTIONAL SKELETON (structure to work on; the law/authority sections are marked TBD and must be grounded before this is binding)
Owner: Clickeen product architecture + UI
Date: 2026-06-26
Stage: 02-Executing

This is the parent program PRD (MAMA). Execution flows through the domain PRDs
**126A–126K** in dependency order (§7) plus the two
screen refactors **126L DevStudio UI** and **126M Roma UI** last. Each domain PRD
is filled from its real audit. If a PRD conflicts with this MAMA, execution
resolves to this MAMA.

Related:

- Domain PRDs **126A–126K** (one per `engineering/UI/` kb doc, in dependency order):
  126A accessibility, 126B color, 126C iconography, 126D typography,
  126E interactions, 126F motion, 126G ops, 126H dieter, 126I components,
  126J surfaces, 126K dialogs-and-modals.
- Screen refactors (last): `126L__PRD__DevStudio_UI.md`, `126M__PRD__Roma_UI.md`.
- `audits/` — real per-domain audits (`126X__Audit__*.md`); see `audits/README.md`
  for the bar.
- Structural templates / granularity bar: `../../03-Executed/124__Overlay_Aware_Runtime_Materializer/124__MAMA__*.md`,
  `../../03-Executed/125__Roma_Tokyo_Product_Authority_And_Inventory_Boundary/125__PRD__*.md`.
- **TBD law sources (must read before §4/§5 are binding):**
  `documentation/architecture/CONTEXT.md`, `documentation/AGENTS.md`,
  `documentation/services/devstudio.md`, `documentation/services/roma.md`,
  `documentation/services/bob.md`,
  `../03-Executed/PRD__DevStudio_Cloudflare_Migration.md` (§3.5 write path, §3.6 design freeze, Appendix A hash-frozen baseline).

## 1. Purpose

Re-establish the entire UI as one splendid Dieter system, from the inside out,
after it accreted through many incremental passes. This is convergence and
governance — **not a redesign**. We pause the accretion, go bottom-up, and make
each layer splendid so the layers above inherit that splendor for free.

The 126 program exists to make UI deterministic for an AI-operated codebase.
For every UI domain, 126 must do four things:

1. **Decide the Clickeen standard.** The standard is product-owned and
   Clickeen-specific. Material, Apple, and OpenAI are source references; they do
   not override human product authority.
2. **Identify gaps in the codebase.** The audit names current code reality
   against the decided standard: missing tokens, undefined references, local
   one-offs, fake capabilities, stale docs, and places where previous agents
   invented behavior.
3. **Fix gaps in the codebase.** Execution changes only the proven mismatch
   between Clickeen UI law and current runtime/source. It does not redesign,
   introduce new frameworks, or reinterpret a domain into an ideal system.
4. **Write deterministic docs for future agents.** The final living docs tell
   agents exactly how to code the UI domain: allowed patterns, forbidden
   patterns, source authority, human-owned decisions, and out-of-scope drift.

Anything less leaves interpretation space for future agents; anything more
turns 126 into invented machinery.

### Pre-GA No Legacy Compatibility Tenet

Clickeen is pre-GA. The 126 program does not preserve old UI drift through
compatibility shims, temporary aliases, parallel legacy paths, or "support both
old and new" transitions unless the human explicitly makes that behavior product
law in the relevant PRD.

For every 126 domain, once the standard is decided:

- Fix source and docs to the standard.
- Remove old drift and stale paths.
- Do not leave legacy names, classes, render paths, token aliases, wrappers, or
  local one-offs as supported alternatives.
- Do not add guard/check machinery to enforce this tenet. The PRD is the
  authority; execution must clean the code/doc surface instead of preserving bad
  paths behind validation.

## 2. Core concept — the matrioska

The UI is a Brad-Frost atomic / nesting-doll system. Three dolls:

- **Tokens** — the innermost. Raw values: a color, a spacing step, a radius, a
  font size.
- **Components** — the middle. A button, a text field, a toggle. Each is made of
  tokens by **reference** (`var(--token)`), not by copying the value.
- **Screens** — the outer. DevStudio UI (all its parts) and Roma UI (all its
  parts). Each is made of components by reference, not by rebuilding them.

Because every doll points inward, a change to an inner doll rolls outward on its
own: fix a token → every component using it updates → every screen using those
components updates. Fix the center once; the fix reaches the edge by itself.

Consequences that drive the whole program:

- **Order is inside-out and forced.** Tokens → components → screens. You cannot
  make the outer doll splendid while the inner one is rotten; that work is
  thrown away when the inner doll is fixed.
- **Healthy = points inward.** A token-driven component, a component-built
  screen — leave them alone.
- **Rot = broke the chain.** A hardcoded value, a parallel component set, a
  hand-written showcase page dressed to look right — these are outside the
  cascade, so a token fix never reaches them. They are the real problems.
- **The sin is dressing the outer doll instead of fixing the inner one.** If a
  screen looks wrong, fix the token/component beneath; don't patch the screen.

## 3. Why now — the gap

The UI was built through many passes, each fixing the symptom at whatever layer
someone was standing in. Drift now sits at **every** layer. Another pass on top
adds accretion; it does not clean the chain. So we stop, uplevel, and rebuild the
reference chain from the center.

## 4. The law (binding rules) — DIRECTIONAL, to be grounded

- **North stars: 2026 Material 3 (M3), Apple HIG, OpenAI UI.** "2026 best practice" is pinned to these three — token-first, accessible, *engineered* systems, not painted ones. Every audit's modern lens (loop step c, §9) measures clickeen against them, not against a vibe. clickeen's color is already world-class because it was seeded from Apple's source colors + OKLAB; the same sourcing discipline applies to every domain. They define the bar — 126 is converge-to-the-bar.
- **Original source only — never Reddit, Stack Overflow, or "how to build X UI" blogposts.** Reference Google / Apple / OpenAI *directly*. Those secondhand sources are the old, over-upvoted, contaminated distribution that caused the dated-UI problem — lossy interpretations that teach the *look*, not the *system*. Reading them re-injects the median we're eradicating and produces cargo-cult UI: the appearance without the engineering, exactly Roma's parallel `.roma-*` failure. An AI or audit left to "research modern UI" drifts there by default; this tenet forces the harder, correct path — the actual source.
- **Dieter is the only design system.** No parallel component system.
- **Design freeze.** Current layouts are the frozen baseline; no new visual
  language; ported screens match what exists. *(Source: Migration PRD §3.6 +
  Appendix A hash-frozen baseline — verify exact wording.)*
- **Reveal, never masquerade.** DevStudio shows Dieter's true state; it must be
  structurally incapable of dressing it up.
- **By reference, not copy.** Every doll points inward; nothing hardcodes a value
  its inner doll already owns.
- **No new framework.** We converge; we don't rebuild.
- **No invented product behavior** to fill a UI gap.

> **NOTE:** these are the agreed rules. Their exact legal authority MUST be
> grounded from `CONTEXT.md`, `AGENTS.md`, the service tenets, and Migration
> §3.5/§3.6/Appendix A before this section is binding. Do not execute against
> un-grounded wording.

## 5. Authority (who owns what) — DIRECTIONAL, to be grounded

| Concern | Owner | Verify |
| --- | --- | --- |
| Tokens | `dieter/tokens/*` | deploy chain: `build:dieter` → Tokyo R2 |
| Components | `dieter/components/*` | stencil + spec + CSS |
| DevStudio reveal + token guard | `admin/*` | write lane: Migration §3.5 |
| Roma screens / routes / save | `roma/*` | Roma product law unchanged |
| Visual design / layout | Product owner (frozen) | — |

Authority chains (Roma/Tokyo/Berlin per PRD 125; DevStudio write-lane per
Migration §3.5) to be confirmed against the law docs.

## 6. Scope

**In:** the 11 kb domains (126A–126K, mirroring `engineering/UI/`) + DevStudio UI
refactor (126L) + Roma UI refactor (126M).

**Out:** any redesign; new product features; backend / route changes; other
surfaces (Prague, etc.); token authoring-as-a-feature.

## 7. The domain PRD series — order

One PRD per `engineering/UI/` kb doc, in **dependency order** (not alphabetical);
DevStudio UI and Roma UI last. Production order (audits + PRDs) follows this
table; **execution stays inside-out and gated** (§9).

| PRD | Domain |
| --- | --- |
| 126A | accessibility |
| 126B | color |
| 126C | iconography |
| 126D | typography |
| 126E | interactions |
| 126F | motion |
| 126G | ops |
| 126H | dieter (system + foundation) |
| 126I | components (the pivot) |
| 126J | surfaces |
| 126K | dialogs-and-modals |
| 126L | DevStudio UI refactor |
| 126M | Roma UI refactor |

**126I components is the pivot.** Domains 126A–126H feed the library; 126J surfaces
and 126K dialogs-and-modals are built on / consume it. Then the screens.

**DevStudio UI (126L) and Roma UI (126M) are last** because they're the outermost
doll — they consume every domain beneath, so their PRDs are written once, against
final upstream truth (no rework cascade). Within the last two, DevStudio before
Roma: Roma consumes DevStudio's tokenization guard.

## 8. What must not happen

- No redesign or new visual language.
- No parallel component system left behind (`.roma-*` must go).
- No masquerade in DevStudio.
- No invented product behavior.
- **No "fix" that silently changes the look.** The ghost-token lesson:
  `--radius-3`/`--radius-4` are intentional aliases; "killing" them would have
  been a visual regression. Every visual change needs explicit approval + a
  before/after screenshot.
- No one-pass or parallelized execution across layers.

## 9. How we work (execution doctrine)

Two phases. **Plan everything first; execute once at the end.**

- **Phase 1 — Plan (every domain, A1–G).** All research, doctrine, gap-audits,
  final PRDs, and peer reviews done for *every* domain in §7 before any code changes.
- **Phase 2 — Execute (H), once.** Only when all PRDs are maniacal-detail and
  peer-reviewed. Runs inside-out and gated (tokens → components → screens),
  splendid bar at each layer.
- Why plan-all-then-execute: planning is cheap and reversible; code is expensive
  and forces rework when later planning changes it. The domains are a dependency
  graph and the screen PRDs consume every domain — so resolving the whole graph on
  paper first means execution never reworks settled ground, and the codebase shifts
  old → new in one controlled pass, not a half-refactored intermediate.
- One step at a time; green (named evidence) before the next.
- **Splendid bar at each layer, verified, before the layer above may build on it.**
- Proof is visual: before/after browser screenshots. Green lint is not enough.
- Docs are part of done — design-system truth lands in `documentation/engineering/UI/` (§12); service-level truth in `services/*.md`.
- Every subPRD names exact files, shapes, invariants, a V1–V8 audit,
  verification, and a Done list — the 124/125 bar.
- Start from clean git; commit doc work with explicit pathspecs.

### Per-domain method (steps 1–9) — Phase 1 runs steps 1–8 for every domain; step 9 runs once at the end

Every domain (dependency order, §7) runs steps 1–8 in Phase 1. Only after **every** domain reaches step 8 does step 9 (execute) begin — once, inside-out. (Steps are numbered 1–9 so they never collide with the A–M subPRD letters.)

- **1. As-built audit — Codex + GLM each write their own (independent).** Two independent passes read the code and state current reality. They stay separate; **no AI converges them.** Factual gathering → independent dual-pass for coverage and hallucination-catch (the as-built is the foundation everything builds on, and "state what exists" is the top hallucination surface). (*Code owns current reality*.)
- **2. Baseline / directional PRD — Codex authors; GLM appends a feedback addendum.** Codex writes the baseline PRD (current reality + known gaps + proposed Clickeen standard where human direction is already known). GLM reads it and writes a critique addendum. One coherent PRD + its adversarial review, not two competing drafts. Sequences **Codex-author → GLM-review.** (*Directional draft, not final execution authority*.)
- **3. Source research — Codex + GLM each write their own (independent).** Two independent passes fetch what M3, Apple HIG, and OpenAI UI do for this area, from the primary sources only (`research/126X_Research_*.md`). They stay separate; **no AI converges them.** (*Google/Apple/OpenAI own the external reference*.)
- **4. Human converges 1/2/3 into the Clickeen standard.** The human reconciles the two as-builts, the baseline PRD + its addendum, and the two research passes into the decided Clickeen law for that UI domain. **AIs never converge — this is product judgment, human lane only.** The output is not a vague decision surface; it is the standard agents must later code against.
- **5. Consolidate into doctrine.** The decided standard becomes Clickeen UI doctrine, written into the kb doc (`engineering/UI/X.md`), current → target. *Dieter kb docs own Clickeen UI truth.*
- **6. Re-audit the code against the doctrine.** Gap audit — exact files/lines that violate or fail to implement the standard. Lives in `audits/126X__Audit__*.md`.
- **7. Final executable PRD.** From current state + doctrine + gaps — an executable gap-fix plan, not vibes, research notes, or an ideal-system rewrite.
- **8. Peer review.** Attack omissions.
- **9. Execute** — once, after every domain has reached step 8. Inside-out and gated; splendid bar at each layer; visual before/after proof.

**Authority lanes (held through every step):** code → current reality (step 1) · Google/Apple/OpenAI → external reference (step 3) · human → product judgment (step 4) · Dieter kb docs → clickeen UI truth (step 5) · final PRD → execution (steps 7/9). Keeping each authority in its lane is the 124/125 discipline and the no-invented-machinery tenet.

**The gate is absolute: no code before ALL domain PRDs (steps 1–8 for every domain) are maniacal-detail and peer-reviewed.**

Every domain PRD must be judged against the four-part 126 loop: standard
decided, codebase gaps identified, fix categories mapped, deterministic agent
docs specified. A PRD that only says "later decide" is not done once human
direction is known.

## 10. Parent acceptance — the deterministic-bottom-up bar

This is not a taste bar. In 126, "splendid" means deterministic, source-owned,
gap-fixed, and documented so future agents know exactly how to code UI without
inventing.

The program is done when:

- Every domain has a decided Clickeen standard, owned by human product judgment
  and grounded in the correct source authorities.
- Every gap between the decided standard and the codebase is identified by file,
  line, behavior, and owning layer.
- Every approved gap is fixed in the correct inner-doll layer: tokens before
  components, components before screens.
- Every **token** is complete, intentional, referenced by name, and free of
  undefined/dead/duplicate contract drift.
- Every **component** consumes tokens and documented component contracts; no
  local hardcoded values, state recipes, or parallel behavior when Dieter owns
  the rule.
- **DevStudio UI** reveals true Dieter state and write authority; it cannot
  masquerade as editing or supporting UI truth it does not own.
- **Roma UI** has no parallel component system; screens consume Dieter
  components/shared primitives and expose loading/empty/error/status states
  through the decided standards.
- The living docs in `documentation/engineering/UI/` tell future agents the
  deterministic rules: allowed patterns, forbidden patterns, source authority,
  human-owned decisions, and out-of-scope drift.
- Visual parity is held throughout unless the human explicitly approves a
  visual change. This is not a redesign.
- V1–V8 is green on every subPRD and final execution pass.

## 11. Doc tree (structure to work on)

```text
126__PRD__UI_Optimization_Program.md        (this MAMA)
126A__PRD__Accessibility.md
126B__PRD__Color.md
126C__PRD__Iconography.md
126D__PRD__Typography.md
126E__PRD__Interactions.md
126F__PRD__Motion.md
126G__PRD__Ops.md
126H__PRD__Dieter.md
126I__PRD__Components.md
126J__PRD__Surfaces.md
126K__PRD__Dialogs_and_Modals.md
126L__PRD__DevStudio_UI.md                  (screen refactor — second-to-last)
126M__PRD__Roma_UI.md                       (screen refactor — last)
audits/
  README.md                                 (the audit bar)
  126X__Audit__<domain>.md                  (one real audit per domain, in dependency order)
```

## 12. Permanent home for UI design-system truth (`documentation/engineering/UI/`)

The execution-pipeline PRDs (this folder) are **temporary** — they get archived
to `03-Executed/` when the program ends, and PRD history is not current docs
(per PRD 125's docs-sync rule). The UI design-system truth they uncover needs a
**permanent, living home**, and none exists today: `documentation/` has
`architecture/`, `services/`, `capabilities/`, `engineering/`, but no home for
the cross-cutting design system that DevStudio, Roma, and Bob all consume — it
is not itself a service, not product law, not a product feature.

This program establishes **`documentation/engineering/UI/`** as that home.

- **Docs-sync target for every domain.** Each domain's "docs are part of done"
  lands design-system truth here. The locked set (seeded 2026-06-27, each driven
  by its domain PRD): `README.md` (index), `dieter.md` (system), `color.md`,
  `typography.md`, `motion.md`, `iconography.md`, `accessibility.md`,
  `components.md`, `dialogs-and-modals.md`, `interactions.md`, `ops.md`,
  `surfaces.md`. Service-level truth still lands in
  `services/*.md`; `engineering/UI/` holds the cross-cutting design-system truth.
- **Reference PRDs graduate into it.** A reference PRD like `126B` (color) is the
  *working* version; its content becomes the canonical living doc
  (`documentation/engineering/UI/color.md`), and the PRD then links to it.
- **One source of truth (by-reference law).** The living doc is canonical; PRDs
  link to it, they do not duplicate it — so the two cannot drift.
- **Declared truth for an agent-operated system.** clickeen is agent-operated;
  agents operate only declared truth. Undeclared UI truth is what lets every
  future agent revert to the corpus median (hand-picked hex, parallel systems).
  `engineering/UI/` is the declared-truth surface that prevents that recurrence.

## 13. Open preconditions (before this MAMA is binding)

1. Ground the law (§4) and authority (§5) from the TBD law sources listed above.
2. Confirm design-freeze scope and the Appendix A hash-frozen baseline.
3. Then run steps 1–8 (§9) for each domain in **dependency order** (§7), starting
   with **126A (accessibility)**. Step 9 (execute) begins only after every domain
   reaches step 8.
