# Peer Review — PRD 110 (Toxic Flow Deletion) — Pass A

Reviewer pass A: 2026-06-18. Supersedes `110__REVIEW__Peer_Review.md`. Grounded against
`AGENTS.md`, `documentation/architecture/CONTEXT.md`, executed-PRD status headers, and a
direct read of the live Roma/Tokyo page code (not search gates alone). This pass adds the
half the prior review never checked: whether the **surviving** Page Composer behavior 110's
deletions were supposed to leave standing actually exists.

**Verdict, split into the two claims a deletion PRD makes:**

1. **Subtraction — DONE (proven). Retire 110.** Every toxic path 110 names is already deleted
   by the executed 124/124A–E + 125 batch and 106/107. 110 sits unstarted in `01-Planning`
   with an empty ledger; there is no deletion work left for it to own.
2. **Addition — INCOMPLETE (proven). Not 110's to build; owned by 106B/Roma.** The Page
   Composer behaviors that are supposed to survive the deletions — page publish, recompose
   state, tier caps — are stubbed or absent. Retiring 110 is correct, but the team must not
   read "retire the cleanup PRD" as "Page Composer is done." It is not.

## Why both halves matter (blast radius)

A deletion PRD removes toxic flows *and* presumes a surviving boundary stands in their place.
The prior review proved the removals and then asserted "the target state is reached." Verifying
the removals does not verify the survivors. If 110 is retired on the strength of "deletions
done" **and** the "target reached" framing is believed, then unbuilt core page flow (publish,
stale/failed recompose, tier enforcement) loses its last mention. The risk is not a bad
deletion — it is a true "we're basically done" that hides a 422 publish stub.

## Verification basis (live tree, this pass)

### Subtraction — confirmed complete

| Claim | Check | Result |
|---|---|---|
| `website/pages\|publishes\|indexes` storage shapes | `rg` over tokyo-worker/roma/bob | **0 hits** |
| Route-generated page `embed.js` | `rg` over tokyo-worker/roma/bob | **0 hits** |
| Bob `publicPackage` save authority (110's actual target) | `rg 'publicPackage' bob` | **0 hits — gone** |
| Roma materialization parity (the precondition) | `roma/lib/account-instance-public-package.ts` | **present, 556 LOC** |
| Tokyo pages domain is storage-only | direct read; only "normalize" is `normalizePageId` = `isCompactPageId(v)?v:null` | **ID hygiene only, no product logic** |
| Page summary derived in Tokyo (prior F9) | `rg 'summary' tokyo-worker/src/domains/pages/source.ts` | **0 hits**; moved to Roma `accountPageSummaryFromSource` (correct authority) |
| Roma rejects toxic page payloads (blocks/snapshot/override) | `normalizeAccountPageSource` ([account-page-source.ts:50](roma/lib/account-page-source.ts)) | **present — strict positive allowlist**; placements must be `{placementId, instanceId}` only; anything else → `null` |
| 124 / 124A–E / 125 status | executed-PRD headers | **all `EXECUTED`** |
| 121 (Prague migration) status | header | **`Draft`** |
| Prague blocks present (correct — 121 has migrated no route) | `WidgetBlocks.astro`, `blockRegistry.ts`, `minibob.astro` | **present** |

### Addition — confirmed incomplete (owned by 106B/Roma, NOT 110)

| Surviving behavior the target requires | Check | Result |
|---|---|---|
| Page **publish** works | [publish/route.ts:44](roma/app/api/account/pages/[pageId]/publish/route.ts) | **unconditional 422 stub** — every POST returns `publishUnavailable: "Page publishing requires Roma page package generation before publish can be enabled."` No publish path exists |
| Publish blocked if a selected instance is unpublished (PRD L510) | same route | **unreachable** — publishing itself is not implemented |
| `stale/failed` page recompose state after instance save (PRD L433/L512) | serve-state vocabulary: [account-page-direct.ts:27](roma/lib/account-page-direct.ts), tokyo `serve-state.ts:52,88` | **only `published\|unpublished`** — no stale/failed state to land in; the recompose "handling" in `pages-domain.tsx` is UI error-toast copy, not a state machine |
| Page **tier caps** (PRD L513–519: Free 0 / T1 1 / T2 3 / T3 6 / T4 ∞) | `rg` over roma + `packages/ck-policy` | **not wired** — `ck-policy` entitlements matrix exists (`free\|ln1–ln4`) and instance-save consumes it, but nothing enforces a page count. Roma job (c) "ensure user can do what their tier allows" is unmet for pages |
| Roma page tests (rejection allowlist, caps) | `find roma -name '*.test.*' -path '*page*'` | **0 files — no coverage** |

## Findings

| # | Sev | Finding | Evidence | Action |
|---|-----|---------|----------|--------|
| A1 | **Blocker** | 110's deletion scope is fully superseded | Subtraction table above; 124/125/106/107 EXECUTED | **Retire 110** to `03-Executed/` as historically-superseded; do not execute |
| A2 | **Major** | Page Composer additions are stubbed/absent — must be named before 110 retires so the work is not lost | Addition table: publish 422 stub, no stale/failed state, caps unwired, 0 tests | Record these as **open 106B/Roma work** in the retirement note; do not let them vanish with 110 |
| A3 | **Major** | Prague block work is PRD 121's authority; 110 must not carry it | 121 `Draft`, no route migrated → blocks correctly still present; 110 carries its own Prague plan (PRD L332–341) | Strip Prague from 110; 121 owns each block deletion + fence lift |
| A4 | Minor | Roma's toxic-payload rejection has runtime enforcement but no test | `normalizeAccountPageSource` is a strict allowlist (good); `find` shows 0 page tests | Add one negative test asserting blocks/snapshot/override/widgetConfig → rejected. Owned by Roma, not 110 |
| A5 | Minor | 110 forks the house V1–V8 taxonomy and skips the mandated independent audit | `AGENTS.md` L141–164; 110 invents a 9-point "Toxic Taxonomy" (PRD L148–171) and gates only on lint/typecheck/`rg` | Moot under retirement; note for any future deletion PRD |
| A6 | Minor | Document identity + structure drift in 110 | Titled "PRD 110" but body says "PRD106E" 5×; two parallel step models (PRD L77–85 vs L363–376) | Moot under retirement |

## Against the four review lenses

**1. Elegant engineering & scalability** — The deletion *method* (authority-lock → test
boundary → move callers → delete/fence → CI search guard) is correct and is exactly how 124/125
executed. The strongest artifact to keep is the **verification table**: claim → exact command →
result, falsifiable and re-runnable. Its one weakness, fixed here, is that a deletion-only table
proves what is gone but not what survives — so this pass adds an Addition table.

**2. Compliance to architecture & tenets** — 110's "Product Truth" matches the `CONTEXT.md`
authority table exactly (Roma = app/policy/composer, Tokyo = bytes, Bob = editor, Prague → 121).
The compliance gaps are scope bleed into 121 (A3) and the unmet Roma tier-cap duty for pages
(A2) — the latter is a real `CONTEXT.md` "Roma enforces the user's tier" obligation that is
currently not met for pages.

**3. Over-architecture** — 110 itself is over-built for spent work: a 13-field deletion ledger
(never filled), an 8-field fence ledger, two step models, and a forked taxonomy — for deletions
another batch already executed.

**3b. Academic / meta-work / gold-plating** — An empty "deletion ledger" (a plan to make a
plan) for completed work; a residual checklist that would track work owned by 121. The boring
truth is one sentence: *110's deletions are done; retire it; Page Composer additions remain
under 106B.*

**4. Simple, boring, moves toward the goal?** — Retiring 110 is the simple, correct move and it
advances the architecture by stopping dead work. The only thing standing between "correct" and
"unsafe" is the completeness framing: pair the retirement with the A2 open-work list so the 422
publish stub and missing recompose/cap behavior stay visible.

## Owner decisions needed

1. **Retire 110** (A1). Move PRD + reviews to `03-Executed/` as superseded.
2. **Carry the A2 open-work list forward** to 106B/Roma before 110 is archived: page publish,
   publish-gating, `stale/failed` recompose state, page tier caps, page tests. Confirm whether
   these are already tracked under 106B; if not, open a Roma execution item.
3. **Strip Prague from 110** (A3); 121 owns it.

## Reviewer note on method

Verified via: `CONTEXT.md`/`AGENTS.md`; direct read of `roma/lib/account-page-source.ts`,
`roma/lib/account-page-direct.ts`, `roma/app/api/account/pages/[pageId]/publish/route.ts`,
`tokyo-worker/src/domains/pages/{source,serve-state,ids}.ts`; executed-PRD status headers for
124/124A–E and 125; 121 confirmed `Draft`; Bob `publicPackage` confirmed gone with Roma parity
present; page tests confirmed absent by `find`. Correction logged vs. prior passes: the earlier
"Roma lacks a page-rejection guardrail" claim was wrong — `normalizeAccountPageSource` is a
strict allowlist that rejects toxic payloads by construction. The real, evidence-backed gap is
the **addition** side: publish/recompose/caps, not rejection.
