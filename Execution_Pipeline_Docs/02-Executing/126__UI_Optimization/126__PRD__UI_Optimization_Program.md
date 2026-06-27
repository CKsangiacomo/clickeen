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

- Within each domain: **per-domain audit → filled PRD → code.**
- One step at a time; green (named evidence) before the next.
- **Splendid bar at each layer, verified, before the layer above may build on it.**
- Proof is visual: before/after browser screenshots. Green lint is not enough.
- Docs are part of done — design-system truth lands in `documentation/engineering/UI/` (§12); service-level truth in `services/*.md`.
- Every subPRD names exact files, shapes, invariants, a V1–V8 audit,
  verification, and a Done list — the 124/125 bar.
- Start from clean git; commit doc work with explicit pathspecs.

### Per-domain method — the six-step loop (runs once per domain)

Every domain (see the series in §7) is processed through the same loop, produced
in dependency order, **in this order**. The order is evidence →
judgment → target → code-gap → plan → review → execute; each step is impossible
to do honestly without the one before it.

- **a. Capture what exists.** Read the as-built system. Do not reinvent what works
  or delete what is live. (Anti-speculation floor.)
- **b. Write it as the knowledgebase doc** in `documentation/engineering/UI/` — a
  precise dev entry. Writing it *is* the first audit: gaps surface when you try
  to state the system exactly. The kb is also the stable baseline judged against next.
- **c. Audit against 2026 best practice.** Judge what can be improved or is
  missing, by today's bar — explicitly modern, not the 20-year-old patterns that
  built the system. The system accreted through AI defaults that regress to old
  patterns; an audit that isn't a deliberate modern lens inherits that median.
- **d. Update the doc to drive the system.** The kb doc becomes the target of
  truth; code conforms to the doc, not the reverse. Doc-led prevents drift and
  stops agents regressing to stale truth.
- **e. Audit the codebase against the target.** Expose exactly what must change
  in code (files, lines). This is time-bound execution analysis — it lives in the
  PRD series `audits/` folder, not the permanent kb.
- **f. Write the PRD** in the 126 series from (a + c + e). The plan is downstream
  of evidence, not the source of it.
- **Then peer-review the PRDs** (attack omissions) before any execution.

The ordering is non-negotiable. Reverse any pair and the failure it closes
reopens: (a/b) close speculation, (c) closes the dated median, (d) closes doc-code
drift, (e/f) close invented plans, review closes overclaim. This is why the
program runs serially per domain, not as one pass.

## 10. Parent acceptance — the splendid-bottom-up bar

Not a bug list — a quality bar. The program is done when:

- Every **token** is splendid: complete, consistent, intentional; nothing
  undefined referenced; nothing dead; no duplicates.
- Every **component** is splendid and built purely from tokens; no hardcoded
  values; no dead components.
- **DevStudio UI** cannot masquerade; every part built from the component doll;
  the reveal/steer loop is trustworthy.
- **Roma UI**: zero parallel component system; every screen built from Dieter
  components + one shared primitive set; the monoliths broken up; no raw dev
  copy; every screen has loading/empty/error states.
- Visual parity held throughout (no redesign); V1–V8 green on every subPRD.

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
  126X__Audit__<domain>.md                  (one real audit per domain, in series order)
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
3. Then fill each domain PRD in audit → PRD order, in `engineering/UI/` folder
   order (§7), starting with **126A (accessibility)**.
