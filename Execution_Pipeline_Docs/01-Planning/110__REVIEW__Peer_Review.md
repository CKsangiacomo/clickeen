# Peer Review — PRD 110 (Toxic Flow Deletion)

Reviewer pass 2: 2026-06-17 (re-run after the 124 batch, 109, and Roma instance-package
materialization landed). Grounded against `AGENTS.md`, `documentation/architecture/CONTEXT.md`,
the current codebase (search gates run), and git history.

**Verdict: do not execute — retire or demote to a residual checklist.** PRD 110's mission
has been overtaken. The per-service boundary deletions it describes were executed by the
**PRD 124 batch** (`03-Executed/`, `Status: EXECUTED`) using the canonical V1–V8 taxonomy;
the page-storage and package deletions were done by 106/107; Prague is owned by PRD 121
(renamed from 112, still Draft). Meanwhile 110 sits unstarted in 01-Planning with an empty
deletion ledger. There is little to no independent work left for it to own.

## What changed since review pass 1

- **PRD 124 executed 110's mission.** `124__…_Audit` + `124A/B/C/D/E` are in `03-Executed/`,
  Berlin/Bob/Roma/Tokyo boundary deletions, same "Product Truth" model as 110, and they
  used the house **V1–V8** Core Violations — e.g. `124E` TW-05 (move page source
  validation/versioning/summaries off Tokyo), TW-11 (delete obsolete `website/serving-policy.json`).
- **Roma materialization parity now exists** (`roma/lib/account-instance-public-package.ts`,
  520 LOC; commit `8c4c9788`), and **Bob `publicPackage` is gone** (0 hits in `bob`). That
  was the precondition gating several 110 targets — already met *and* executed.
- **Prague migration renumbered 112 → 121** (commit `ebebde49`); still `Status: Draft`.

## Findings

| # | Sev | Finding | Evidence | Action |
|---|-----|---------|----------|--------|
| F1 | **Blocker** | 110 is superseded; its targets are already deleted by other PRDs | `website/pages\|publishes\|indexes` and page `embed.js` → **0 hits**; Bob `publicPackage` → 0 hits with Roma parity in place. Done by 124 (EXECUTED), 106 (`63279290`,`79895416`), 107 (`fbcc40e8`,`e589487d`), `8c4c9788`. `CONTEXT.md` storage-shapes (L101–128) already canonizes the target page shape | Retire 110, or reduce to a one-page residual checklist of whatever 124/106/107/121 did **not** cover |
| F2 | **Major** | The "Deletion Ledger" is still an empty schema — Step 1 never started | §Deletion Ledger (L222–242) is a template; post-pass-1 the only edit (`ebebde49`) changed one dependency line | If 110 survives at all, fill the ledger with current `file:line` per its own rule (L248); otherwise close it |
| F3 | **Major** | Prague block work is PRD 121's authority; 110 bleeds into it | Block deletion is gated on 106C/D/121 route migration (Step 6 L84; Fence Scope L209–210), yet 110 carries its own Prague service plan (L332–341). 121 is Draft → no route migrated → blocks (`WidgetBlocks.astro`, `blockRegistry.ts`, `minibob.astro`) correctly still present and not 110-deletable | Remove Prague targets from 110; reference 121 as owner. 121 deletes each block + removes the fence when it migrates the route |
| F4 | **Major** | Verification gates omit the house-mandated V1–V8 audit | `AGENTS.md` L156–159 requires an independent V1–V8 audit for cross-system/remote-data work; 110's gates (L415–466) are only lint/typecheck/`rg`. The 124 batch *did* run V1–V8 — proof the house standard exists and 110 skips it | Adopt V1–V8 if 110 is kept; or moot if retired |
| F5 | Minor | 110 forks the house taxonomy | `AGENTS.md` defines canonical V1–V8; 110 invents a parallel 9-point "Toxic Taxonomy" (L148–171) whose "silent healing/defaulting" item restates V1/V2. 124 used V1–V8 directly — 110 is the outlier | Cite V1–V8; keep only the deletion-structural categories V1–V8 doesn't cover |
| F6 | Minor | Document identity conflict | Titled "PRD 110"; body calls itself "PRD106E" ×7 (L93, 246, 383, 483…) | Rename throughout |
| F7 | Minor | Two parallel step models | 7-row "Execution Steps" (L77–85) + 10-step "Execution Sequence" (L363–376) restate each other | Merge |
| F8 | Minor | Search guards produce false positives | `systemWidgets` matches a legitimate Roma widget-picker concept (`widgets-domain.tsx`, `use-roma-widgets.ts`), not a fake noun; `\btemplate\b`→`grid-template-columns`; `mode`/`preset` similar | Tighten patterns before they become CI gates |
| F9 | Minor | `pageSummaryFromSource` is now 124E/TW-05's concern, not 110's | TW-05 ("move page summaries off Tokyo") is marked EXECUTED, yet `tokyo-worker/src/domains/pages/source.ts:159` still derives summaries at read time | Cross-reference to 124E; confirm TW-05 closed (derivation may be acceptable as non-durable, but the symbol persists) |
| F10 | Minor | Ledger schema heavier than the work | 13-field Deletion Ledger + 8-field Fence + 5-state enum for tasks that are often one `rg` + delete | Trim if kept |

## Against the four review lenses

**1. Elegant engineering & scalability** — The spine (authority-lock → test boundary → move
callers → delete/fence → CI search guard) is correct and is exactly the method 124 used to
execute successfully. As a *method*, 110 is sound; as a *backlog*, it's spent.

**2. Compliance to architecture & tenets** — 110's "Product Truth" (L100–126) matches the
`CONTEXT.md` "Current Authorities" table exactly. Compliance gaps: F3 (Prague scope bleed)
and F4/F5 (forks/skips the V1–V8 audit the rest of the program uses).

**3. Over-architecture** — Two step models (F7); a 13-field ledger for trivial deletes
(F10); a Prague plan that duplicates 121 and can't run (F3).

**3b. Academic / meta-work / gold-plating** — An empty "deletion ledger" (F2) — a plan to
make a plan — for work another batch already executed. A forked taxonomy beside V1–V8 (F5).
The 110/106E naming drift (F6) signals a doc nobody is maintaining (only a 1-line edit in
the last pass while the codebase moved under it).

**4. Simple, boring, moves toward the goal?** — The goal is right and the target state is
nearly reached — but it was reached by 124/106/107/121, not by 110. 110 is now documentation
of completed work, not a live execution plan.

## Owner decisions needed

1. **Retire vs residual (F1).** Confirm 124 + 106/107/109 cover 110's scope; either move 110
   to `03-Executed` as historically-superseded, or rewrite it as a ≤1-page residual list.
2. **F3** — strip Prague from 110; 121 owns it.
3. **F9** — confirm 124E/TW-05 actually closed (page-summary derivation still in Tokyo).
4. If 110 is kept live at all: fill the ledger (F2) and adopt V1–V8 (F4/F5).

## Reviewer note on method

Verified via: `CONTEXT.md`/`AGENTS.md` read in full; 110's own search gates re-run against
current code; git history and the `124` batch headers/scope tables; confirmation that Bob
`publicPackage` is gone and Roma parity exists. Not done: line-by-line scope diff of every
124 sub-PRD against every 110 line — supersession is asserted from the 124 audit scope +
executed code changes, not a clause-by-clause map (hence "confirm" in decisions 1 and 3).
