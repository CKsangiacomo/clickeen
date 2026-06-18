# Peer Review — PRD 110 (Toxic Flow Deletion)

Reviewer pass 3: 2026-06-18. Re-run after the **124 batch (124/124A–E)** and **125 (Tokyo
Worker Authority Migration)** executed. Grounded against `AGENTS.md`,
`documentation/architecture/CONTEXT.md`, and the live codebase (110's own search gates
re-run), plus git history and executed-PRD status headers.

**Verdict: do not execute. Retire 110 to `03-Executed/` as superseded, or demote it to a
≤1-page residual checklist.** PRD 110's mission has been carried out by other, already-executed
PRDs. Tokyo page/storage authority and the Bob save-payload deletions it describes were
executed by the **124 batch + 125** (all `Status: EXECUTED`); page-storage/package shapes were
already canonized by 106/107; Prague block removal is owned by **PRD 121** (Draft). 110 itself
sits unstarted in `01-Planning` with an empty deletion ledger. There is little to no
independent work left for it to own, and executing it now would manufacture no-op diffs against
already-deleted code.

## Verification basis (live tree, this pass)

| Claim | Check | Result |
|---|---|---|
| `website/pages`, `website/publishes`, `website/indexes` storage shapes | `rg 'website/pages\|website/publishes\|website/indexes' tokyo-worker roma` | **0 hits** |
| Route-generated page `embed.js` | `rg 'embed\.js' tokyo-worker roma bob` | **0 hits** (no generator) |
| Bob `publicPackage` save authority (110's actual target) | `rg 'publicPackage' bob` | **0 hits — gone** |
| Roma materialization parity (the precondition) | `roma/lib/account-instance-public-package.ts` | **present, 556 LOC** |
| Tokyo page domain is storage-only | `tokyo-worker/src/domains/pages/source.ts` | create/save/delete are thin R2 verbs over `unknown`; no normalize/index/readiness |
| Page summary derived in Tokyo (prior F9) | `rg 'summary' tokyo-worker/src/domains/pages/source.ts` | **0 hits — now closed** |
| 124 / 124A–E status | executed-PRD headers | **all `Status: EXECUTED`** |
| 125 Tokyo Worker Authority Migration status | executed-PRD header | **`Status: EXECUTED`** |
| Prague blocks (`WidgetBlocks.astro`, `blockRegistry.ts`, `minibob.astro`) | live tree | **still present** (correct — 121 has not migrated any route yet) |
| 121 Prague migration status | header | **`Status: Draft`** |

The page storage shape 110 targets as the *destination* (`accounts/{account}/pages/...`) is
already canonical in `CONTEXT.md` Storage Shapes (L101–128). Tokyo already stores exact
submitted bytes and does not normalize, summarize, index, or decide readiness — which is the
surviving authority 110 wanted to reach.

## Findings

| # | Sev | Finding | Evidence | Action |
|---|-----|---------|----------|--------|
| F1 | **Blocker** | 110 is superseded; its targets are already deleted by executed PRDs | Tokyo `website/*` shapes, page `embed.js`, page summaries, and Bob `publicPackage` all → **0 hits**; Roma parity in place (556 LOC). Executed by **124/124A–E** and **125** (all EXECUTED) plus 106/107 page-shape canonization | Retire 110, or reduce to a one-page residual checklist of whatever 124/125/106/107/121 did **not** cover |
| F2 | **Major** | The "Deletion Ledger" is still an empty schema — Step 1 never ran | §Deletion Ledger (L222–242) is a blank template; the only post-pass-1 edit (`ebebde49`) changed one dependency line while the codebase moved underneath it | If 110 survives at all, fill the ledger with current `file:line` per its own rule (L248); otherwise close it |
| F3 | **Major** | Prague block work is PRD 121's authority; 110 bleeds into it | Block deletion is gated on 121 route migration (Step 6 L84; Fence Scope L209–210). 121 is **Draft** → no route migrated → blocks correctly still present and **not** 110-deletable. Yet 110 carries its own Prague service plan (L332–341) | Strip Prague targets from 110; name 121 as owner. 121 deletes each block + lifts the fence as it migrates each route |
| F4 | **Major** | Verification gates omit the house-mandated V1–V8 audit | `AGENTS.md` L141–164 requires an independent V1–V8 audit for cross-system/remote-data work; 110's gates (L415–466) are only lint/typecheck/`rg`. The 124 batch *did* run V1–V8 — the house standard exists and 110 skips it | Moot if retired; adopt V1–V8 if kept |
| F5 | Minor | 110 forks the house taxonomy | `AGENTS.md` defines canonical V1–V8; 110 invents a parallel 9-point "Toxic Taxonomy" (L148–171) whose "silent healing/defaulting" item restates V1/V2 | Cite V1–V8; keep only deletion-structural categories V1–V8 doesn't already cover |
| F6 | Minor | Document identity conflict | Titled "PRD 110 — Toxic Flow Deletion"; body calls itself "PRD106E" 5× (L93, 246, 383, 483, 487) | Rename throughout, or retire |
| F7 | Minor | Two parallel step models | 7-row "Execution Steps" (L77–85) + 10-step "Execution Sequence" (L363–376) restate each other | Merge if kept |
| F8 | Minor | Search guards produce false positives | `systemWidgets` matches a legitimate Roma widget-picker concept (`roma/components/widgets-domain.tsx`, `roma/components/use-roma-widgets.ts`, `roma/app/api/account/widgets/route.ts`), not a fake noun. Bare `template`/`preset`/`mode` similarly over-match | Tighten patterns before any become CI gates |
| F9 | Closed | Prior pass flagged page-summary derivation still in Tokyo | `rg 'summary' tokyo-worker/src/domains/pages/source.ts` now **0 hits**; closed by 125 | None — record as closed |
| F10 | Minor | Ledger schema heavier than the work | 13-field Deletion Ledger + 8-field Fence + 5-state enum for tasks that are often one `rg` + delete | Trim if kept |

## Against the four review lenses

**1. Elegant engineering & scalability** — The spine (authority-lock → test boundary → move
callers → delete/fence → CI search guard) is correct, and is exactly the method the 124/125
batch used to execute successfully. As a *method*, 110 is sound; as a *backlog*, it is spent.

**2. Compliance to architecture & tenets** — 110's "Product Truth" (L100–126) matches the
`CONTEXT.md` "Current Authorities" table exactly. Compliance gaps are F3 (Prague scope bleed
into 121) and F4/F5 (forks/skips the V1–V8 audit the rest of the program uses).

**3. Over-architecture** — Two step models (F7); a 13-field ledger for trivial deletes (F10);
a Prague plan that duplicates 121 and cannot run (F3).

**3b. Academic / meta-work / gold-plating** — An empty "deletion ledger" (F2) — a plan to make
a plan — for work other batches already executed. A forked taxonomy beside V1–V8 (F5). The
110/106E naming drift (F6) signals a doc nobody is maintaining: one 1-line edit in the last
pass while the codebase moved under it.

**4. Simple, boring, moves toward the goal?** — The goal is right and the target state is
reached — but it was reached by **124/125/106/107**, with Prague pending under **121**, not by
110. 110 is now documentation of completed work, not a live execution plan.

## Owner decisions needed

1. **Retire vs residual (F1).** Confirm 124 + 125 + 106/107 cover 110's Tokyo/Bob scope (this
   pass confirms it at the search-gate level). Then either move 110 to `03-Executed/` as
   historically-superseded, or rewrite it as the ≤1-page residual checklist below.
2. **F3 — strip Prague from 110.** 121 owns every block deletion and fence lift.
3. If 110 is kept live at all: fill the ledger (F2), adopt V1–V8 (F4/F5), reconcile the
   110/106E identity (F6), and tighten the search guards (F8) before they become CI gates.

## Residual checklist (the only candidate live work, if 110 is demoted not retired)

Everything below is **owned elsewhere**; 110 would at most *track* it, not execute it:

- **Prague block removal — owner PRD 121 (Draft).** `WidgetBlocks.astro`, `blockRegistry.ts`,
  `minibob.astro`, block JSON, and block translation sidecars stay fenced until 121 migrates
  each route, then 121 deletes them and lifts the fence. Not 110's to delete.
- **`minibob` as marketing/funnel surface only** — confirm it never becomes an account
  authoring mode. Tracked under Prague/121.
- **Search guards as CI** — if the team wants the four `rg` guards wired into CI, that is a
  standalone CI task with tightened patterns (F8), independent of 110's ledger.

If none of the above needs a 110-shaped home, retire 110 outright.

## Reviewer note on method

Verified via: `CONTEXT.md`/`AGENTS.md` read in full; 110's own search gates re-run against the
current (post-124/125) tree; executed-PRD status headers for 124/124A–E and 125 confirmed
`EXECUTED`; 121 confirmed `Draft`; Bob `publicPackage` confirmed gone (0 hits) with Roma parity
present (556 LOC); Tokyo page domain read directly and confirmed storage-only; prior-pass F9
re-checked and confirmed closed. Not done: clause-by-clause map of every 124/125 sub-PRD line
against every 110 line — supersession is established from executed status + live search-gate
results, hence "confirm" framing in owner decision 1.
