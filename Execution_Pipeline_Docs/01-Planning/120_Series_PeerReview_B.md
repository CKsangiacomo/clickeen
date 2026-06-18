# Peer Review B — PRD 120 Series (San Francisco Agent Platform)

Reviewer pass: 2026-06-18. Independent staff-engineer review of the full 120 series:
`120` (architecture decision), `120A` (plane contract), `120B` (Copilot refactor), `120C`
(workforce scaffolding), `120A1` / `120B1` (EXEC specs), and the existing `120R` review.
Companion to `120R`, not a replacement. Where this pass agrees with `120R` it says so briefly;
the value-add is (a) a live-code re-verification that catches one thing `120R` missed, and
(b) the four-lens breakdown the owner asked for.

**Ground rule honored:** every code claim was re-checked against the live tree, not inherited
from `120R`. At an AI-native company these PRDs are the context executing agents load — a wrong
file:line in a PRD is a wrong fact in an agent's working memory. That is the whole reason this
re-verification matters.

---

## 0. Verdict

**Approve the architecture (Option C) and the copilot-first inversion. The EXEC specs are
execution-grade and ready to run, with one live-code correction that changes a precedent
citation but not the decision.** The series is unusually disciplined: it names the embarrassing
shipped failure, picks the topology that the codebase's one-atom law forces, fences
over-architecture explicitly, and turns the requirements PRDs into step-gated EXEC contracts.
The single thing this pass adds over `120R` is a finding (`PR-16` below) that the shipped
translation dispatch has been **rewired to HTTP** since `120R` was written, so the
"`INSTANCE_TRANSLATION_JOBS` queue" precedent cited across 120/120C/120R no longer exists in
code. The Option C *principle* (orchestrate outside SF, execute through SF) survives intact —
the HTTP path proves it as well as the queue did. But the citation must be corrected before an
executing agent reads it as a binding mechanism that isn't there.

---

## Part I — What the series gets right (keep all of this)

1. **The copilot-first inversion is the most important call.** A workforce-platform paper would
   have been the comfortable thing to write. 120 instead names the shipped truth: the Copilot
   cannot change a button color, and until it can, the platform is theory. The earth-test list
   (120B §3.2.2, 120B1 "Earth tests") is concrete, boring, falsifiable — the right shape of
   proof.

2. **Option C is the correct topology, argued honestly from the tenets, not from taste.**
   Options A and D are disqualified on isolation/generic-framework tenets. Option B's rejection
   is exactly right: per-agent sibling services with their own grant/key/routing is the
   duplicate-truth sin committed at the platform layer. Singular AI plane + per-agent governed
   orchestration is the one shape consistent with the codebase's one-atom-per-concept law.

3. **The literature handling is disciplined.** §1.1.2's verdict table
   ("transfers" / "already ahead" / "does not apply") and §3.5's restraint on MCP (adopt
   principles now, build at 120D when an agent actually needs an external system) consume
   external guidance without importing frameworks. This is rare and correct.

4. **The three-atoms split (capability / policy / routing) is the series' best engineering
   insight and the one `120R` correctly elevated to a blocker (PR-13).** `120R` caught that the
   series had complete model *custody* and no model *choice*. `120A1` absorbs that: routing
   becomes a first-class plane contract (`AgentRoutingPolicy`) with turn-class routing,
   single-step escalation, declared failover, and pinned-pick exemption. This is the difference
   between a plane that *governs* calls and one that *decides* them.

5. **The anti-over-architecture fences are explicit and testable.** 120C's "one real reference
   agent before any generalization hardens," "scaffold-only platform work is explicitly
   rejected," the D5 correction (re-base the shipped translator instead of building a
   speculative UX Writer), and 120F's deferral-with-substrate requirement are the guardrails
   that kept the 106 series from drifting.

6. **The EXEC specs (120A1, 120B1) reach the 106 standard** — one step at a time, green =
   named evidence, NOT_ALLOWED per step, blocker protocol, `rg` completion guards. This is the
   format `120R` demanded in PR-7; the demand was met.

---

## Part II — Live-code re-verification (what I checked, this pass)

| # | Claim (from 120 series / 120R) | My check | Result |
|---|---|---|---|
| V1 | The gpt-5.2 `reasoning_effort` bug is live (motivating 120A §2) | `openai.ts:60-70` | **CONFIRMED LIVE** — `startsWith('gpt-5')` heuristic + hardcoded `'minimal'` still in tree. 120A1 has not executed. |
| V2 | `SANFRANCISCO_L10N` is a phantom binding (PR-1) | `rg` over code + wranglers | **CONFIRMED** — zero hits in code/wrangler; docs only. PR-1's correction holds. |
| V3 | Instance translation runs Tokyo-worker → SF via `INSTANCE_TRANSLATION_JOBS` queue (120R audit row 13, marked TRUE; cited as the Option C precedent in 120 §3/§4, 120C §5) | `rg` over all files; read both `wrangler.toml` files; read SF `queue()` handler | **NO LONGER TRUE — see PR-16.** The binding string exists only in planning docs. Shipped translation is HTTP dispatch. |
| V4 | `sanfrancisco/src/instance-translation-queue.ts` is shipped translator code (120R PR-14 inventory) | `ls` | **FILE DOES NOT EXIST.** Translator lives at `sanfrancisco/src/agents/l10nTranslationCore.ts` + `l10n-account-routes.ts` + `l10n-routes.ts`. |
| V5 | SF `queue()` handler consumes translation jobs | `sanfrancisco/src/index.ts:277-300` | **FALSE** — the handler is events-only (`indexCopilotEvent`, learning-sample writes to `SF_R2`). No translation consumer. |
| V6 | Provider adapters infer call shape from string prefixes (PR-15 flavor 1) | `openai.ts:60,65,70` | **CONFIRMED** — three `startsWith('gpt-5')` heuristics drive token param, temperature, reasoning effort. |
| V7 | Raw upstream body leaks via thrown error `message` (PR-8) | `openai.ts` error paths | **CONFIRMED in pattern** — errors throw `PROVIDER_ERROR` with upstream text in `message` (e.g. `describeEmptyResponse`, the `Missing upstream usage` throw). PR-8's leak mechanism is real. |

**Headline:** six of seven re-checked claims hold. One — the load-bearing Option C precedent
(V3/V4/V5) — has drifted out from under the docs since `120R` was written. That is `PR-16`.

---

## Part III — Findings

### PR-16 — BLOCKER (doc-truth, live drift): the Option C precedent no longer matches shipped code

**Where:** 120 §3 Option C + §4 Recommendation #2; 120C §5 (reference-agent rationale);
`120R` audit row 13 (marked **TRUE**); `120R` PR-1's "real precedent" correction; `120A1`
Step 9 docs-sync; `120B1`/`120C` citations of the queue.

**Problem:** The series repeatedly grounds Option C in a shipped precedent stated as:
_"exactly like Tokyo-worker already dispatches instance translation to San Francisco through
the `INSTANCE_TRANSLATION_JOBS` queue."_ That mechanism is not in the current tree:

- `INSTANCE_TRANSLATION_JOBS` appears **only in planning docs** — zero hits in any
  `wrangler.toml` or source file (V3).
- `sanfrancisco/wrangler.toml` has exactly one queue (`SF_EVENTS` / `sanfrancisco-events-dev`)
  and a `TOKYO_PRODUCT_CONTROL` service binding — **no translation queue** (V3).
- `tokyo-worker/wrangler.toml` has **no queue bindings at all**.
- SF's `queue()` handler (`index.ts:277`) is **events-only** — it indexes copilot events and
  writes learning samples to `SF_R2`. It does not consume translation work (V5).
- The cited file `sanfrancisco/src/instance-translation-queue.ts` **does not exist** (V4).
  Translator code lives at `agents/l10nTranslationCore.ts` + `l10n-routes.ts` +
  `l10n-account-routes.ts`.

**What shipped instead (verified):** translation is now **HTTP dispatch**. Tokyo-worker calls
SF's `/v1/agents/ln/translate-saved-instance` and `/v1/agents/ln/runtime-status` routes
(`sanfrancisco/src/index.ts`), gated by an internal-service identifier
(`TOKYO_INTERNAL_SERVICE_SANFRANCISCO_TRANSLATION = 'sanfrancisco.translation'` in
`tokyo-worker/src/auth.ts`, consumed at `internal-product-route-utils.ts:147`).

**Why this matters (and why it doesn't change the decision):** the Option C *argument* is
"orchestrate outside SF, execute through SF." That argument **survives** — the HTTP path proves
it exactly as well as the queue did; arguably better, because request/response translation is a
synchronous-shape call and an HTTP route is the honest transport for it. What does **not**
survive is any text that tells an executing agent "use the `INSTANCE_TRANSLATION_JOBS` queue as
your shipped precedent / pattern to follow." An agent building the 120A-2 durable surface from
these docs would look for a queue binding that isn't there and may invent one.

This is the precise failure mode `120R` PR-1 caught for `SANFRANCISCO_L10N`: a stale mechanism
name migrating from docs into agent context. `120R` corrected the *name* but kept the *queue*
framing; the queue itself has since been removed. Same class of bug, one layer deeper,
discovered because this pass read the wranglers and the `queue()` handler instead of trusting
the prior review's TRUE.

**Required amendment:**

1. In 120 §3 Option C, §4 point 2, and 120C §5: replace every "through the
   `INSTANCE_TRANSLATION_JOBS` queue" citation with the **actual** shipped precedent:
   _"Tokyo-worker dispatches instance translation to San Francisco over the internal HTTP
   route `/v1/agents/ln/translate-saved-instance`, gated by the
   `sanfrancisco.translation` internal-service identifier."_ The argument is unchanged.
2. `120R` audit row 13: flip from TRUE to **SUPERSEDED** with a pointer to the HTTP route, and
   note the queue was removed after the review was written.
3. `120R` PR-14's translator inventory: remove `instance-translation-queue.ts`; the live files
   are `agents/l10nTranslationCore.ts`, `l10n-routes.ts`, `l10n-account-routes.ts`,
   `agents/translationSafety.ts`, `agents/l10nPragueStrings.ts`.
4. `120A1` Step 9 (docs sync) already plans to purge `SANFRANCISCO_L10N`; add the
   `INSTANCE_TRANSLATION_JOBS` string to the same purge list, across canonical docs.
5. **Re-validate the translator regression gate transport.** `120A1`'s gate says
   "trigger instance translation for all 29 locales through the normal Tokyo-worker operation."
   That still works (it exercises the HTTP path). But the gate's prose should name the HTTP
   route so an executor doesn't go looking for a queue to enqueue into.

**One open question this raises (for 120A-2, not a blocker on 120A1/120B1):** the series'
OQ1 disposition ("request/response durable calls → private service binding; fire-and-forget →
queue") assumed translation was the queue precedent. With translation now HTTP, the queue
precedent is gone entirely. That's fine — OQ1's *rule* (binding for RPC, queue for
fire-and-forget) is still the right target — but 120A-2 should state the precedent honestly:
the only shipped durable→SF transport today is HTTP, and the service-binding is the *target*,
not the existing pattern. Record this so 120A-2 doesn't inherit the same stale framing.

---

### PR-17 — MAJOR (execution readiness): 120A1 has not started, and the motivating bug is still live in production

Not a doc defect — a status observation. `openai.ts:60-70` still ships the `startsWith('gpt-5')`
heuristic and the hardcoded `'minimal'` reasoning effort. Every earth-test failure 120B is built
to fix ("what can you edit" → raw provider JSON) is reproducible today. The series is
well-planned but **zero of it has executed**. The risk this creates is priority/timing, not
architecture: a well-reviewed plan that sits unstarted while the shipped bug remains is the
same outcome as no plan. This pass flags it only to state plainly: the series' value is
realized when 120A1/120B1 run, not when they're ratified.

---

### PR-18 — MINOR (over-spec, gold-plating risk): the Q6 conversion-mode design is the densest, most invented-feeling part of the series

The free-tier "one model call per month → conversion template" design (120B1 "Free-vs-paid
conversion mode," 120A1 `copilotMode`) is internally consistent and well-grounded in policy.
But it is also the single most elaborate piece of machinery in a series whose own thesis is
"make the button turn green first." It carries: a new entitlement key, a call counter, Roma
mode derivation at grant mint, plane-side enforcement, a conversion-template schema, a
feature-matching map, a preamble copy rule, an outcome event, and seven conversion copy
strings. None of it is wrong; all of it is second-order to the P0 proof.

This is not a blocker — it's cleanly factored (120A1 owns enforcement, 120B1 Step 5b owns the
build) and it's policy-driven like everything else. But it is the one place a staff engineer
would ask: **does free-tier Copilot monetization belong in the same slice as "Copilot can edit a
button"?** The honest answer is it's defensible to ship together (the metering reuses existing
`USAGE_KV` machinery, so the marginal complexity is the template + copy, not the counter), but
if 120B1 slips, Q6 (Step 5b) is the first thing to descope — the earth tests (Step 6) and
deterministic resolver (Step 2) are the P0. Worth recording as an explicit descope order so a
slipping execution doesn't protect the upsell machinery at the expense of the editor proof.

---

### Findings 120R already raised, re-confirmed still-valid (no re-derivation)

`120R` PR-1 through PR-15 remain the right findings. This pass re-confirmed the load-bearing
ones against code: the gpt-5 bug (PR-2/PR-15 flavor 1), the raw-error leak (PR-8), the missing
routing contract now resolved in 120A1 Step 6 (PR-13), the resolver-ownership decision D2
(PR-3), the 106F/dieter-drift gate (PR-4). All still apply. The one delta is PR-16 above.

---

## Part IV — The four review lenses

### 1) Elegant engineering & scalability

**The three-atoms decomposition is the elegant core: capability (can we call it), policy (may
we call it), routing (should we call it, and what happens when it fails).** Each is a single
authority; each is named; they compose without overlapping. This is the design that scales to
"100s of widgets/agents" because adding an agent is O(1) shared code (registry row +
conformance run + matrix routing table) and O(agent-specific) orchestration — exactly the
shape that prevents N copies of the AI spine. The fact that `120R` had to *force* the third
atom into existence (PR-13) and the series absorbed it cleanly is evidence the underlying
decomposition is sound, not contrived.

The Copilot-side elegance is the **deterministic resolver before model planning** (120B §3.1.2,
D2): intent→control resolution becomes compiler output + a lookup, so capability/where-is
turns cost zero model calls and the model only does judgment (value generation, rewriting).
This is the OpenAI "do the deterministic part deterministically" principle applied at the
turn level, and it is the single decision that makes the Copilot both cheaper and more correct.

**Scalability caveat (PR-16-derived):** the "generalize a shipped pattern" claim is slightly
weaker than the docs assert, because the shipped pattern was rewired (queue → HTTP) after the
docs were written. The generalization is still valid; the *evidence* for it needs to point at
the live HTTP path, not the removed queue.

### 2) Compliance to architecture & tenets

**Compliant, and selected because of it, not despite it.** Mapped to `CONTEXT.md` /
`AGENTS.md`:

- San Francisco owns AI execution only (provider keys, grants, routing, budgets, telemetry);
  never product truth. → Matches `CONTEXT.md` "AI execution — San Francisco" and AGENTS §3
  isolation. The series restates this obsessively and correctly.
- Bob edits one in-memory working copy; Copilot applies ops to it; Save stays the normal
  Roma/Tokyo path. → Matches CONTEXT "Bob is the editor; save is the persistence boundary."
  120B §3.4 + Q1 (immediate apply + undo) honor this exactly.
- Agents return structured ops / typed payloads, never prose instructions. → Matches AGENTS
  "structured results only."
- No fake generic layers, no speculative frameworks. → The §3.5 MCP restraint, the 120C
  one-agent-before-generalization fence, and 120F deferral all operationalize AGENTS §3.

**Compliance gaps:** none new. PR-16 is a *citation* error, not a tenet violation — Option C
still isolates SF from product truth. The one tenet-adjacent risk is PR-18: the conversion-mode
machinery flirts with "more framework than the proof needs," but it clears the bar because it
reuses existing policy/counter atoms rather than inventing new ones.

### 3) Over-architecture → unnecessary complexity

The series is **more disciplined than not**, but three concrete spots carry more structure
than the immediate work needs. A staff engineer would watch these during execution:

- **The conversion-mode machinery (PR-18).** Seven copy strings + a template schema + a
  feature-matching map + an outcome event for free-tier upsell, in the same slice as "edit a
  button." Defensible (policy-driven, reuses `USAGE_KV`), but the densest non-P0 work in the
  series. Descope-first candidate if 120B1 slips.
- **`AgentRoutingPolicy` is correct but heavy for a two-model pre-GA world.** `allowedModels` +
  `routes` + `escalation` + `failover` + `copilotMode` is the right shape for a 10-model fleet.
  Pre-GA with two providers, most of it sits at one entry. This is *intentional*
  schema-reservation (120 explicitly reserves the dimension rather than retrofitting), so it's
  justified — but it's the textbook example of "build the contract once, instantiate thinly,"
  and execution should not populate fields that aren't exercised yet.
- **120C's review-artifact store (6 states, 10+ fields) for a reference agent that is a
  re-base of an already-working translator.** The translator doesn't currently produce review
  artifacts (it writes overlays). 120C §4.3 specifies a full review-store schema for the
  reference agent that may not need it. Thin-first: formalize the *transport* (durable→SF via
  the plane), not the review-store, until the reference agent actually produces something
  human-reviewed.

None of these are "don't do it" — they're "do the minimum that proves the atom, reserve the
rest." The series *says* this in its fences; the risk is execution over-building anyway.

### 3b) Academic abstraction / meta-work / gold-plating

This is where the series is strongest, and it's worth naming why, because the owner cares about
this lens specifically. The series repeatedly refuses the academic move:

- **Refuses the "agent platform paper."** 120 §1.0 explicitly demotes the workforce-agent
  architecture to "planning, not product proof" until the Copilot edits a button. That is the
  anti-academic move: the interesting theory (AI workforce OS) is subordinated to the boring
  proof (button green).
- **Refuses the speculative reference agent.** D5 corrected a greenfield UX Writer into a
  re-base of the shipped translator — "building a speculative agent to validate a pattern
  production already runs was rejected." That kills the meta-work instinct dead.
- **Refuses the generic framework.** §1.1.2's verdict table and §3.5's MCP restraint consume
  external literature as checkpoints, not as a playbook. The OpenAI/Anthropic guidance is read
  as "literature to test against, not a framework to adopt" (§3.6).
- **Refuses scaffold-only platform work.** 120C says it explicitly. 120F defers the learning
  loop while requiring its substrate. Both are the right shape: no building without a consumer.

**The one genuine meta-work smell** is the sheer *volume* of cross-referencing inside the EXEC
specs (Dev A3/B1/B2/B5/B6/B9, PM F2/F4/F5/F6/F7/F8/F11/F12, TPM F-5/F-7/F-8/F-9/F-12/F-13, N1
through N10, R2-1 through R2-8). Each individual reference is real and useful — they're the
trace of the three-perspective pre-execution review. But the density means the docs are now
load-bearing in a way that's expensive to keep in sync as code moves (PR-16 is what happens
when they fall out of sync). This is acceptable pre-GA — the docs *are* the program at this
company — but it's the textbook tradeoff: a richly-annotated plan that drifts is worse than a
thinner plan that doesn't. The mitigation is the one this pass performs: periodic live-code
re-verification of the load-bearing citations.

### 4) Simple, boring, moves toward the goal?

**Yes — and the boringness is the point.** The end state the series drives to is boring in the
best sense:

- One AI plane. Provider keys in one place. One model router. One budget authority. One
  learning loop. (Option C's whole thesis.)
- A Copilot that resolves "button" to a control deterministically and applies a validated op
  to the in-memory copy. (120B's earth tests.)
- Models as cattle (swap via registry + matrix), the contract as the asset. (PR-2/D1.)
- Adding an agent = registry row + routing table + orchestration, not a new AI spine. (The
  scalability claim.)

That *is* the intended architecture per `CONTEXT.md` and the "1 human + AI workforce" thesis.
The series moves toward it by (a) fixing the shipped embarrassment first, (b) building only the
plane atoms the proof needs, and (c) deferring everything workforce/durable/outbound until a
real consumer exists. The only thing keeping it from being boring *today* is that none of it
has executed (PR-17) and one precedent citation has drifted (PR-16). Fix the citation, run
120A1/120B1, and the system becomes as boring as the series promises.

---

## Part V — Blast radius

| Vector | Current state | If 120A1/120B1 execute as specified | If they execute with PR-16 uncorrected |
|---|---|---|---|
| Builder Copilot (all tiers) | Broken — raw provider JSON on `gpt-5.2` calls (V1) | Fixed: typed errors, eligible-only picker, deterministic resolver | Same fix; PR-16 doesn't touch the Copilot path |
| Instance translation (29 locales, the only working AI feature) | Working over HTTP (V3-V5) | Protected by the regression gate (120A1); `?? 'deepseek'` fallbacks deleted (PR-15) | **Risk:** an executor reading 120C §5 / 120R row 13 looks for a queue that isn't there; could mis-wire the re-base |
| Provider keys / model truth | Scattered (PR-15: 5 flavors) | Two files only (registry + matrix) | Unaffected by PR-16 |
| Durable-agent surface (120A-2/120C, future) | Not built | Built on the corrected HTTP/service-binding precedent | Built on a phantom queue precedent → rework |
| Docs as agent context | Carry `SANFRANCISCO_L10N` (known) + `INSTANCE_TRANSLATION_JOBS` (PR-16, newly found) | Both purged (120A1 Step 9 + PR-16 amendment) | Stale mechanism names persist in agent context |

**Bottom line on blast radius:** PR-16 is low-cost to fix (a citation), high-cost to ignore
(an executor building 120A-2 on a removed queue). PR-17 is the real exposure — the series'
value is entirely unrealized until 120A1/120B1 run.

---

## Part VI — Owner decisions

1. **Apply PR-16 before any 120A1/120B1 execution begins.** It's a doc-only correction
   (citation + file-list + purge-list additions). Cheap, and it prevents the next agent from
   inheriting a phantom queue. This is the one action this review asks for.
2. **Sequence 120A1 and 120B1 to actually run.** The series has been ratified since 2026-06-09;
   today is 2026-06-18 and the motivating bug is still live (PR-17). The plan is not the
   deliverable; the green earth tests are.
3. **Record an explicit descope order for 120B1** (PR-18): if the slice slips, drop Step 5b
   (conversion mode) before touching Steps 2/5/6 (resolver, apply/undo, earth tests). The
   editor proof is P0; the upsell machinery is not.
4. **For 120A-2 (future):** restate OQ1 honestly now that the queue precedent is gone — the
   only shipped durable→SF transport is HTTP; the service-binding is the target, not the
   existing pattern.

No architectural change is requested. Option C, the three-atoms plane, the copilot-first
inversion, and the EXEC step-gates all stand. This review corrects one stale precedent and
calls the shot on execution.

## Reviewer note on method

Verified via: `CONTEXT.md` / `AGENTS.md` re-read; all six 120-series docs + `120R` read in
full; live-tree re-check of seven load-bearing claims (V1-V7) by reading the actual files
(`openai.ts`, both `wrangler.toml` files, `sanfrancisco/src/index.ts` queue handler,
`tokyo-worker/src/auth.ts` + `internal-product-route-utils.ts`, `ls` of cited translator
files). The PR-16 finding came from reading the wranglers and the `queue()` handler directly
rather than inheriting `120R`'s audit row — which is the methodological point: at this company
the docs drift, so the review must re-touch code every pass. Not done: a full file-by-file
disposition audit of the seven SF Copilot files (that's 120B1 Step 4's job, not a review's);
and I did not execute the translator regression gate (cloud-dev, real provider spend —
execution work, not review work).
