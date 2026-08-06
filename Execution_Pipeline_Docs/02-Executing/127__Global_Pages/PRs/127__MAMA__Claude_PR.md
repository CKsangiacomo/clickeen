# 127 MAMA — Peer Review — Claude

Reviewer: Claude (session peer review; independent of the three commissioned
seat reviews, which file separately)

Target: `127__PRD__Global_Pages_Program.md` as of 2026-08-03 14:18 — the
locale/overlay redraft. Scope: program law only. The lettered children are
stale by the Mama's own header and were not reviewed as current instructions.

This consolidates two review rounds: the first Mama draft (projection
vocabulary) and the current redraft. Dispositions are tracked so accepted
fixes stay visible as evidence the correction loop works.

## Verdict: ACCEPT WITH CHANGES

The program law is in G0-acceptable shape once the three open items below are
resolved. The architecture requires no changes: it is the shipped
publish-as-compile law extended one level, with the locale/overlay model the
system already runs. The redraft deleted machinery, not just words, and I
verified the purge rather than trusting it: zero occurrences of the retired
vocabulary in the Mama against 409 remaining across the five children, which
the Mama honestly declares non-executable until rewritten.

## What is strong (kept brief; the point of a review is the rest)

- **The §1 plain-words gate is the best mechanism in the document.** Nine
  customer sentences, then: any execution section not tied to a customer
  action, a stored file, a route, or a served response fails review. This
  codifies the comprehension test that caught the projection abstraction, and
  it is stronger than the drift rule I originally proposed.
- **D1 is the model of a decision row.** Three exact read coordinates,
  origin-reads-source, and an explicit negative list (no registry, no alias,
  no value-source mapping, no reuse mapping, no locale-count entitlement). An
  executing agent cannot misread it.
- **The G1–G8 order is a dependency proof, not a phase plan.** Each gate
  proves the authority the next consumes; no slice builds on undeployed
  predecessor code. G2's "127B stores or publishes nothing" isolates the
  compiler as a pure function.
- **Subtraction held.** Advisory validation deleted rather than deferred;
  catalogue reduced to strict `blank`; Prague out; page-level layout cut to a
  fixed flow; `pages.max` as one limit where `0` is unavailability.
- **The failure law (§14) and evidence taxonomy (§16/§20)** — tests ≠ deploy ≠
  product data ≠ public response — are above the house's prior program
  practice (124 had no closure ledger at all).

## Round 1 findings → disposition

| Finding | Disposition |
| --- | --- |
| G1 cutover window undefined for the live widget path | **Landed** — §11 final paragraph: old serving holds until every affected published Instance has a validated replacement; deletion before G1 closes |
| `Tenets.md` absent from §19 while Tenet 11 is materially amended | **Landed** — §19 now lists it |
| Children must be rewritten by shrinking, not renaming | **Open** — carried into Round 2, formalized below |
| Quote-don't-paraphrase rule for children | **Superseded** — the §1 gate is stronger |
| Tier 5 AI rows hardcode model IDs (couples program law to catalog churn) | **Accepted knowingly** — consistent with explicit-values law; noted, not blocking |
| A/B two-identity model reverses the recorded June direction (targeting coordinate) | **Open (MINOR)** — right call on the merits; deserves one acknowledging sentence so the reversal is a decision, not an accident |

## Open items — resolve before G0

### 1. MAJOR — No amendment record in the Mama

The Mama's control loop guarantees mid-program corrections ("execution stops
and this Mama is corrected before work continues"), and this document has
already been corrected once at vocabulary scale with no trace inside itself —
the projection→locale rewrite is visible only in git history, which is not a
reading surface for an executing agent. D-rows are closed to reinterpretation;
the record of when a D-row changed and why is therefore load-bearing.

Fix: a dated **Amendments** section at the end of the Mama. First entry:
2026-08-03, projection vocabulary and machinery removed in favor of the
shipped locale/overlay model, per product-owner decision.

### 2. MAJOR — No encoding/escaping law for overlay values

Overlay values are substituted into four contexts with different encoding
rules: HTML text, attributes, `<head>` metadata, and `WebPage` JSON-LD.
Nothing in the Mama or D3 states where per-context encoding happens or what a
value containing markup does. V2 rejects invalid rich text, which is adjacent
but not the same law. This is the one open item with security implications,
and if it is left for the 127B rewrite to remember, it is exactly the kind of
requirement that gets lost.

Fix: one sentence in D3 — the Page-completion function encodes every value
for its destination context; a value can never change document structure.

### 3. MAJOR — Child-rewrite method must be G0 evidence, not intention

The five children are 4,066 lines sized for machinery that no longer exists
(127A is 1,029 lines largely because it carried the deleted mapping and
value-source apparatus). A rename pass that preserves projection-shaped
machinery under locale names is V7 masquerade at document level, and the G0
ledger row as written cannot detect it.

Fix, three parts:

- rewrite each child **from its D-rows down**, in gate order (A first), with
  its peer review immediately after — not batch-rewrite then batch-review;
- G0 evidence includes a zero-count grep of the retired vocabulary across
  127A–E;
- each child's review attests the contracts were re-derived from D1–D13, and
  every child's line count went down or the review explains why not.

## Verification performed for this review

- Retired-vocabulary counts: Mama 0; 127A 161, 127B 115, 127C 90, 127D 25,
  127E 18 (children declared stale by the Mama's header — consistent).
- §7 Tier 5 table checked against `packages/ck-policy/entitlements.matrix.json`:
  all thirteen existing keys plus `pages.max` are enumerated — the closed set
  is complete, no implicit Tier 4 inheritance.
- D1 read coordinates checked against shipped shapes: instance overlay path
  matches `overlays/locales/{locale}.json`; page overlays-in-`source.json` and
  compiled `overlays.json` are new but collision-free now that both layers are
  genuinely overlay values.
- §14's purge-failure semantics map onto failure states that already exist in
  shipped Tokyo purge code; last-good rows are consistent with the current
  instance serve-state model.
- §1's nine sentences each tie to a route, file, or response that the program
  builds; the gate passes its own text with the exception noted to the PM
  seat (file names in sentence 4 are plumbing inside a customer story — a
  wording matter, not a law defect).

## Note on the commissioned seat reviews

Three independent seat reviews (staff engineer, senior PM, principal TPM) were
commissioned on this same target and file separately in this folder. This
review was written without reading their conclusions beyond what was already
relayed at synthesis time; overlapping findings (the amendment record, the
child-rewrite evidence requirement) were arrived at independently across
seats, which the product owner should read as confirmation of weight.
