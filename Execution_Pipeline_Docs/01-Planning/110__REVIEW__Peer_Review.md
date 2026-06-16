# Peer Review — PRD 110 (Toxic Flow Deletion)

Reviewer pass: 2026-06-16. Grounded against `AGENTS.md`, `documentation/architecture/CONTEXT.md`,
the current codebase (search gates run), and git history.

**Verdict:** Architecture and execution discipline are sound and compliant with the
authority model. But the ledger is stale: the headline deletion targets were already
removed by the 106/107 work that landed after this PRD was dated (2026-06-05), and the
one large remaining surface (Prague blocks) belongs to PRD 112, not here. Do not execute
as written — run Step 1 (refresh evidence) first. With Prague correctly deferred, 110's
independent remaining surface is small.

## Findings

| # | Sev | Finding | Evidence | Action |
|---|-----|---------|----------|--------|
| F1 | **Blocker** | Headline targets are already deleted *and* already canonized as current truth | `CONTEXT.md` "Storage Shapes" (L101–128) shows pages at `accounts/{acct}/pages/{pageId}/source.json` + `serve-state.json` + `index.html/styles.css/runtime.js`; only surviving `website/` path is `website/serving-policy.json`; no `website/pages\|publishes\|indexes`, no page `embed.js`. Gates confirm 0 hits. Killed by 106 (`63279290`, `79895416`) and 107 (`fbcc40e8`, `e589487d`) | Run Step 1; close already-deleted items rather than re-planning them |
| F2 | **Major** | The "Deletion Ledger" is an empty schema — zero findings exist | §Deletion Ledger (L222–242) is a template; Step 1 ("Build deletion ledger") is unstarted | Fill the ledger with current `file:line` before any edit, per the PRD's own rule (L248) |
| F3 | **Major** | Prague block work is PRD 112's authority; PRD 110 bleeds into it | Prague block deletion is gated entirely on 106C/D/112 route migration (Step 6 L84; Fence Scope L209–210). Yet 110 carries its own Prague service plan (L332–341) and execution step enumerating block-deletion targets it does not own. 112 is `Status: Draft`, so no route has migrated and nothing is Prague-deletable now regardless | Remove Prague deletion targets from 110; reference 112 as owner. 112 deletes each block husk + removes the fence when it migrates the route. 110 retains no independent Prague work |
| F4 | **Major** | Verification gates omit the house-mandated V1–V8 audit | `AGENTS.md` (L156–159) requires an independent V1–V8 audit for cross-system / managed-service / remote-data tasks. This campaign touches R2/Supabase storage shapes — in scope. 110's Verification Gates (L415–466) are only lint/typecheck/`rg`/targeted tests | Add the V1–V8 audit gate to the campaign's completion criteria |
| F5 | Minor | 110 forks the house taxonomy | `AGENTS.md` "Core Violation Audit" defines canonical V1–V8. 110 invents a parallel 9-point "Toxic Taxonomy" (L148–171); its "silent healing/defaulting" item restates V1/V2 | Cite V1–V8 for the runtime-truth categories; keep only the deletion-structural categories (wrong-service, duplicate-truth, fake-noun) that V1–V8 doesn't cover |
| F6 | Minor | Document identity conflict | Titled "PRD 110"; body calls itself "PRD106E" ×7 (L93, 246, 383, 483…) | Rename throughout |
| F7 | Minor | Two parallel step models for one campaign | 7-row "Execution Steps" table (L77–85) + 10-step "Execution Sequence" (L363–376) restate each other | Merge into one |
| F8 | Minor | Search guards produce false positives | `\btemplate\b` matches `grid-template-columns` (roma.css) and editor `template` rendering (stencils.ts); `preset`/`mode` similar | Tighten patterns before they become CI gates, or they are noise |
| F9 | Minor | Unresolved 107↔110 tension | `pageSummaryFromSource` (read-time summary derivation) is a 110 deletion target but 107 keeps it as the strict page-source boundary | One-line owner ruling: keep as read derivation, or move to Roma |
| F10 | Minor | Ledger schema heavier than the work | 13-field Deletion Ledger + 8-field Fence + 5-state enum for tasks that are often one `rg` + delete | Trim optional fields |

## Against the four review lenses

**1. Elegant engineering & scalability** — Spine is correct and durable: authority-lock →
test surviving boundary → move callers → delete/fence → search guard. The scalable win is
making search guards CI gates (L400) as a regression ratchet against future agents. The
fence contract (owner + sunset + delete-gate + tests + non-reachability proof) is the right
anti-zombie discipline.

**2. Compliance to architecture & tenets** — Strong, and verifiable. 110's "Product Truth"
(L100–126) matches the `CONTEXT.md` "Current Authorities" table exactly: Roma = account
app/policy/save, Bob = in-browser editor, Tokyo = stores/serves bytes, Berlin = auth. It
refuses to invent replacement behavior (L17) and defers to owning PRDs. The one compliance
gap is F4 (missing V1–V8 audit gate) and F3 (Prague scope bleed).

**3. Over-architecture** — Two step models (F7); a heavy ledger schema for mostly trivial
deletes (F10); a Prague service plan that both duplicates 112 and cannot execute (F3).

**3b. Academic / meta-work / gold-plating** — A "deletion ledger" with no entries (F2) — a
plan to make the plan. A forked 9-point taxonomy beside the canonical V1–V8 (F5). The
110/106E naming drift (F6) signals an un-maintained doc.

**4. Simple, boring, moves toward the goal?** — The underlying job is the right boring (find
dead/misplaced code, name the real owner, delete, guard) and points exactly at the
`CONTEXT.md` target state. The proof the approach works: the architecture is already most of
the way there — `website/*` shapes gone, `publicPackage` gone, Tokyo storage-only — which is
also why this PRD, as written, largely documents work already done.

## Owner decisions needed

1. **F1** — accept that Step 1 closes most of the ledger as already-deleted; re-run it.
2. **F3** — confirm Prague blocks are 112-owned; strip them from 110.
3. **F4** — add the V1–V8 audit gate.
4. **F9** — one-line ruling on `pageSummaryFromSource`.
5. After 1–3, decide whether the residual surface (doc/test cleanup + guard adjudication +
   confirming already-done deletions) warrants the current 525-line PRD or a short "what's
   left" addendum.

## Reviewer note on method

Verified via: `CONTEXT.md`/`AGENTS.md` read in full; 110's own search gates run against
current code; git history for deletion provenance; spot-check of the Tokyo page domain. Not
done: line-audit of every Tokyo route for residual product logic (hence F9 flagged as a
tension, not a confirmed violation).
