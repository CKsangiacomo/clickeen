# PRD 126 — MAMA: UI Optimization Program

Status: DRAFT — DIRECTIONAL SKELETON (structure to work on; the law/authority sections are marked TBD and must be grounded before this is binding)
Owner: Clickeen product architecture + UI
Date: 2026-06-26
Stage: 02-Executing

This is the parent program PRD (MAMA). Execution flows through the four track
PRDs **126A → 126B → 126C → 126D**, inside-out. Each track gets its own audit,
then its filled PRD, then subPRDs as the work reveals slices. If a track PRD or
subPRD conflicts with this MAMA, execution resolves to this MAMA.

Related:

- `126A__PRD__Dieter_Tokens.md` (track 1 — innermost doll)
- `126B__PRD__Components.md` (track 2)
- `126C__PRD__DevStudio_UI.md` (track 3 — absorbs the prior DevStudio draft)
- `126D__PRD__Roma_UI.md` (track 4 — absorbs the prior Roma draft)
- `audits/UI_Audit_Report.md`, `audits/DevStudio_Dieter_Sanity_Pass_Findings_June2026.md`
  (interim; per-track audits follow)
- Structural templates / granularity bar: `../124__Overlay_Aware_Runtime_Materializer/124__MAMA__*.md`,
  `../125__Roma_Tokyo_Product_Authority_And_Inventory_Boundary/125__PRD__*.md`
- **TBD law sources (must read before §4/§5 are binding):**
  `documentation/architecture/CONTEXT.md`, `documentation/AGENTS.md`,
  `documentation/services/devstudio.md`, `documentation/services/roma.md`,
  `documentation/services/bob.md`,
  `../03-Executed/PRD__DevStudio_Cloudflare_Migration.md` (§3.5 write path, §3.6 design freeze, Appendix A hash-frozen baseline)

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
adds accretion; it does not clean the chain. So we stop, uplevel, and rebuild
the reference chain from the center. The interim audit already confirms drift
at all four layers (tokens, components, DevStudio, Roma).

## 4. The law (binding rules) — DIRECTIONAL, to be grounded

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

**In:** Dieter tokens (126A), Dieter components (126B), DevStudio UI — all parts
(126C), Roma UI — all parts (126D).

**Out:** any redesign; new product features; backend / route changes; other
surfaces (Prague, etc.); token authoring-as-a-feature.

## 7. The four tracks — order and why

Inside-out, **serial** (a track does not start until the one inside it is
splendid and verified):

1. **126A — Dieter tokens.** The innermost doll; everything composes from it.
2. **126B — Components.** Built on tokens.
3. **126C — DevStudio UI.** Reveals/governs tokens + components; owns the
   tokenization guard that Roma needs.
4. **126D — Roma UI.** Consumes components + that guard; the largest surface.

Why serial: a splendid outer doll requires a splendid inner doll. Building
outward on a rotten inner doll is thrown-away work.

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

- Within each track: **per-track audit → filled track PRD → subPRDs → code.**
- One step at a time; green (named evidence) before the next.
- **Splendid bar at each layer, verified, before the layer above may build on it.**
- Proof is visual: before/after browser screenshots. Green lint is not enough.
- Docs are part of done — design-system truth lands in `documentation/engineering/UI/` (§12); service-level truth in `services/*.md`.
- Every subPRD names exact files, shapes, invariants, a V1–V8 audit,
  verification, and a Done list — the 124/125 bar.
- Start from clean git; commit doc work with explicit pathspecs.

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
126A__PRD__Dieter_Tokens.md                 (track 1 — directional skeleton)
126B__PRD__Components.md                    (track 2 — directional skeleton)
126C__PRD__DevStudio_UI.md                  (track 3 — absorbs prior DevStudio draft)
126D__PRD__Roma_UI.md                       (track 4 — absorbs prior Roma draft)
audits/
  UI_Audit_Report.md                        (interim, 4-phase)
  DevStudio_Dieter_Sanity_Pass_Findings_June2026.md
  126A__Audit__Dieter_Tokens.md             (slot — create when track 1 starts)
  126B__Audit__Components.md                (slot)
  126C__Audit__DevStudio_UI.md              (slot)
  126D__Audit__Roma_UI.md                   (slot)
subPRDs (126A1, 126D1, …) created per track as audits reveal slices.
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

- **Docs-sync target for every track.** Each track's "docs are part of done"
  lands design-system truth here. The locked set (seeded 2026-06-27, each driven
  by its track): `README.md` (index), `dieter.md` (system), `color.md`,
  `typography.md`, `motion.md`, `iconography.md`, `accessibility.md`,
  `components.md`, `dialogs-and-modals.md`, `interactions.md`, `ops.md`,
  `surfaces.md`. Service-level truth still lands in
  `services/*.md`; `engineering/UI/` holds the cross-cutting design-system truth.
- **Reference PRDs graduate into it.** A reference subPRD like `126A2` (color) is
  the *working* version; its content becomes the canonical living doc
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
3. Then fill each track in audit → PRD order, starting with **126A (Dieter)**.
