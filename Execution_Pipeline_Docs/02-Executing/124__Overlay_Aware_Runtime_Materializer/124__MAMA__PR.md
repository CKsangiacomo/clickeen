# 124 MAMA — Peer Review (Executable-Plan Review)

Status: REVIEW
Reviewer: External advisor (orchestrator)
Date: 2026-06-25
Subject: `124__MAMA__Overlay_Aware_Runtime_Materializer_Program.md` (parent program PRD)
Role: Program-level contract; 124A–124H inherit it

## Verdict

**Green-light.** MAMA is a sound parent program contract. It states the laws
every sub-PRD inherits — schema-first matrioska, cascade (static + dynamic),
identity, evidence, authority, CDN/cost, and the no-reinterpretation execution
doctrine — and it correctly defers the *exact locked values* (canonical key rep,
fingerprint byte order, URL shape, parity mechanism, failure keys) to the 124A
contract lock. The layering is right: **MAMA = law, 124A = locked values,
124B–124H = execution.** Because every sub-PRD inherits MAMA, it is the most
load-bearing document in the program — a mistake here propagates to all eight
slices. It holds up.

Three non-blocking observations, no blockers.

## What MAMA locks (and why each is right)

| Law | MAMA statement | Verified-correct because |
| --- | --- | --- |
| Foundational | schema-first matrioska; `schema + source + overlay -> evidenced artifact`; no copied documents | matches the cascade law; rejects the legacy copy-tree model |
| Composition | widgets compose to page/site/email/report/feed/crawler/answer/future; contracts must not block later composition | correct directional law; self-narrows to "PRD 124 starts with one widget instance coordinate" |
| Authority | Roma=command, Tokyo=stored-byte serving, materializer=pure resolver; materializer must not fetch/mutate/infer/purge/record | matches verified code (`package-files.ts`, `clk-live-routes.ts`, Roma save routes) |
| Evidence | "do not invent separate fingerprints for concepts that do not move separately" | collapses redundant fingerprints — anti-gold-plating |
| Identity | use existing artifacts (no Schema service/registry/identity DB); scalar=path, repeated=path+`arrayItemIdentity`+saved ids; reorder-safe cascade deferred until overlay keys map to identity | matches `editable-fields.json` `arrayItemIdentity` + `ck-contracts` `identityKeyForField`; scopes identity to repeaters |
| CDN/cost | stored evidenced bytes; short-TTL/purgeable entry; immutable fingerprinted support; no visitor-time materialization; materializer does not purge; Roma owns entry update/purge | matches `package-files.ts` fingerprint + the purge code/config gap (ops-owned) |
| Cascade (scope split) | executable now = source save, overlay write, active-locale add/remove, policy; detected-but-deferred-to-124G = schema/widget/Dieter/materializer fan-out | the key blast-radius control — narrows 124's cascade to what it can execute |
| No-reinterpretation | operate only declared truth; forbid hidden workflows/fallback/repair/compat-readers/status-stores/probes/best-effort/ request-time-composition; "make invalid states unrepresentable by schema and authority" | the binding tenet, stated as execution doctrine |

## Compliance to architecture, product, and product law

- **Tenets / AGENTS.md:** named authorities (Tenet 2), no fallback/silent
  substitution (Tenet 3, V1), no silent healing (V2), no partial-success (V6),
  no fail-open (V4) — all encoded in the execution-doctrine "not legacy SaaS"
  list and the cascade/evidence laws.
- **Matrioska/cascade law (our foundational law):** MAMA states both halves —
  static (overlays are token maps, not documents) and dynamic (base moves →
  derivatives cascade). It even names atomic cascade risk
  (`schema → token → overlay → artifact → surface`) as the reason base contracts
  must be locked first.
- **Agent-operated / schema-first:** the whole point — agents operate one
  structured substrate. MAMA makes it the program's founding premise.

## Observations (non-blocking)

1. **MAMA is the cross-sub-PRD consistency arbiter, and should be used as such.**
   The 124B gate just surfaced a real contradiction — 124B carries a
   "repeated-deferred" branch that 124A §5.4 (which allows concrete-path repeated
   fields) does not grant. MAMA's Identity Law resolves it: concrete-path repeated
   fields are allowed; only *reorder-safe token cascade* is deferred. So MAMA's
   law is consistent and 124B is the outlier. Recommendation: treat MAMA as the
   authority when sub-PRDs disagree, and add a one-line note in MAMA that
   sub-PRD-level contradictions resolve to MAMA + the 124A addendum.
2. **Composition Law carries vision weight in an EXECUTING-stage parent.** Listing
   page/site/email/report/feed/crawler/answer/future-app is strategy content. At
   the *parent* level this is more defensible than in a sub-PRD (it sets the
   composition direction the contracts must not block), and it self-narrows. But
   the line "contracts must not block later … app composition" is a forward
   compatibility mandate with no concrete invariant — prefer stating the *specific*
   extensibility rules (e.g., `sourceRef` stays an extensible discriminated union;
   evidence keys are append-only) that actually deliver that compatibility.
3. **Authority table omits Berlin/San Francisco** — correctly, since neither is in
  the materialization path (Berlin is upstream account context via Roma; SF is
  model exec, unused here). Not a gap for this program; noting only so it isn't
  read as an accidental omission.

## Code, vectors, blast radius (program level)

| Vector | Failure mode | Blast radius |
| --- | --- | --- |
| A MAMA law is wrong | every sub-PRD inherits the defect | entire program + future surfaces |
| Cascade scope not honored | a sub-PRD claims 124G-tier fan-out → mass-stale or mass-404 | entire public surface |
| Identity law mis-scoped | reorder-unsafe cascade shipped as safe → silent wrong-item translation | every localized repeated-field widget |
| Composition mandate read as "build it now" | scope creep into page/email/app in 124 | program bloat |
| Sub-PRD contradicts MAMA (e.g., 124B repeated branch) | inconsistent execution | the contradicting slice |

## Documentation updates (MAMA scope)

MAMA is the program contract; it updates only if a program-level law changes. No
canonical operator-doc changes arise from MAMA itself — those land when sub-PRDs
(124C/124E) change runtime behavior. MAMA should be the place a one-line
"sub-PRD contradictions resolve here" note is added (observation 1).

## Recommendation

**Green-light.** MAMA is the correct parent contract: it states the laws, defers
exact values to 124A, scopes the cascade to what 124 can execute, and encodes the
no-reinterpretation tenet as execution doctrine. Three non-blocking observations:
treat MAMA as the cross-sub-PRD consistency arbiter (add the one-line note);
convert the open-ended composition mandate to concrete extensibility invariants;
Berlin/SF omission is fine. Forward to the three-role gate.
