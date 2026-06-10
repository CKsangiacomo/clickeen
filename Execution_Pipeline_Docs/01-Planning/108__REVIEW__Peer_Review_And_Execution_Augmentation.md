# PRD 108 Series — Peer Review and Execution Augmentation

Status: REVIEW — feedback for the 108 series before any doc moves to `02-Executing`
Reviewer: Claude (code-verified review)
Date: 2026-06-09
Scope: `108__PRD__San_Francisco_Agent_Platform_Architecture_Decision.md`,
`108A__PRD__San_Francisco_AI_Plane_Role_And_Contract.md`,
`108B__PRD__Builder_Copilot_Refactor.md`,
`108C__PRD__Workforce_Agents_Architecture_Scaffolding.md`,
plus `LLM_Provider_Landscape_June2026.md` as model-decision input.

Method: every factual claim the PRDs make about the codebase was verified against
source at file:line level. This matters more here than in a human-led company: these
PRDs are the ground truth executing agents will load as context. A wrong claim in a
PRD is a wrong fact in an agent's working memory.

Framing note (per product owner, 2026-06-09): Clickeen is pre-GA. The shipped model
lineup, policy matrix, and provider adapters are scaffolding with zero installed-base
inertia. "Verified against code" in this review means *the PRD's claims are accurate*,
never *the shipped state is a constraint*. Where the two pull apart, this review sides
with target state and recommends deletion over migration.

---

## 0. Verdict

**Approve Option C and the copilot-first inversion. Do not move 108A or 108B to
`02-Executing` as written.** The decision document (108) is strong — honestly argued,
factually grounded, correctly fenced against over-architecture. The sub-PRDs (108A,
108B) are requirements documents, not execution contracts: their acceptance criteria
are phrased as questions for execution specs that do not exist yet. The 106 series
proved what agent-executable looks like (step tables, one-step gates, named completion
evidence, NOT_ALLOWED lists, blocker protocol). The 108 sub-PRDs have none of that
scaffolding.

This review therefore does three things:

1. **Part I–II** — what is right and what is factually verified, so it is preserved.
2. **Part III** — numbered findings (PR-1 … PR-15) with severity and the exact
   amendment each requires. PR-13 (no LLM routing contract), PR-14 (no disposition
   of the three shipped AI uses), and PR-15 (hardcoded model/provider truth scattered
   across services) were added in review round 2 after product-owner feedback; they
   are *design omissions*, as distinct from the doc-truth and sequencing defects
   found in round 1.
3. **Part IV–VI** — the augmentation: proposed execution-spec skeletons for 108A-1 and
   108B-1/108B-2 in the 106 step-gate format, proposed schemas, proposed dispositions
   for all ten open questions, and the decision checklist Pietro must ratify before
   execution starts.

---

## Part I — What the series gets right (keep all of this)

1. **The copilot-first inversion is the most important call in the series.** A
   workforce-agent platform paper would have been the comfortable thing to write. The
   doc instead names the embarrassing truth: the shipped Copilot cannot change a button
   color, and until it can, the platform is theory. The reality gate in 108 §1.0 and the
   earth-test list in 108B §3.2.2 are the right shape: concrete, boring, falsifiable.

2. **Option C is the correct topology, and it is argued honestly.** Options A and D are
   disqualified on tenets, not on taste. Option B's rejection is exactly right: sibling
   services with per-agent grant/key/routing logic is the duplicate-truth sin applied at
   the platform layer. The recommended shape — singular AI plane, per-agent governed
   orchestration — is consistent with the architecture's one-atom-per-concept law.

3. **The literature handling is unusually disciplined.** The §1.1.2 verdict table
   ("transfers" / "already ahead" / "does not apply") and §3.5's restraint on MCP
   (adopt principles now, build at 108D when an agent actually needs an external
   system) are the right way to consume external guidance without importing frameworks.

4. **The anti-over-architecture fences are explicit and testable.** 108C's "one real
   reference agent before any generalization hardens," "scaffold-only platform work is
   explicitly rejected," and 108F's deferral with a substrate requirement (queryable
   `(agent_id, phase, model, capability_profile_version, prompt_version, policy_version)`)
   are exactly the guardrails that kept the 106 series from drifting.

5. **The two-class separation (User Copilots vs Workforce Agents) is load-bearing and
   correctly never blurred.** 108A §1.3's "the plane is shared, the execution shape is
   not" is the sentence that prevents the next year of architectural confusion.

6. **108B's §3.2.5 first slice is genuinely close to executable.** Eight named moves
   with named files. It is the only part of the sub-PRDs that approaches the 106
   standard. The deterministic-resolver-before-model-planning rule (§3.1.2) is the
   single most important product decision in 108B and it is stated unambiguously.

7. **Open Question 10 (separate interactive vs durable concurrency budgets) is
   well-spotted and correctly assigned to 108A design rather than 108C discovery.** A
   saturated GTM run must never 429 a user's copilot turn. Catching that at planning
   time is what planning is for.

---

## Part II — Factual audit (PRD claims vs code)

Every checked claim, with the verification result. Executing agents should treat this
table as the certified bridge between the PRDs and the source tree.

| # | PRD claim | Source | Verdict |
|---|---|---|---|
| 1 | `AgentRuntimePolicy` carries `allowModelPicker` + pinned `selectedModel` | `packages/ck-contracts/src/ai.ts:35-36` | **TRUE** |
| 2 | `modelRouter.ts` enforces selected model strictly from signed policy | `sanfrancisco/src/ai/modelRouter.ts:38-46` | **TRUE** |
| 3 | Provider adapter infers call shape from string-prefix heuristics | `sanfrancisco/src/providers/openai.ts:60,65,70` (`startsWith('gpt-5')`) | **TRUE** |
| 4 | SF hardcodes unsupported `reasoning_effort` for selected model | `openai.ts:70` returns `'minimal'` for all `gpt-5*`; spread into request at `:148`; tier2+ policy defaults to `gpt-5.2` in `packages/ck-policy/ai-runtime.matrix.json` | **TRUE — bug chain fully reproducible from source** |
| 5 | Raw provider payloads can leak to Builder | `openai.ts:165` embeds raw upstream body text into the thrown error message | **TRUE** |
| 6 | `MAX_INFLIGHT_PER_ISOLATE = 8`, in-isolate counter, 429 on overflow | `sanfrancisco/src/concurrency.ts:3-7` | **TRUE** |
| 7 | `CopilotPane.tsx` sends a flattened `compiled.controls` summary | `bob/components/CopilotPane.tsx:237` (map), `:378` (send) | **TRUE** |
| 8 | SF keyword-ranks controls / pads prompt with widget source | scorer at `sanfrancisco/src/agents/widgetCopilotCore.ts:273-296`; `csPromptPayload.ts` summarizes `widget.html` / `spec.json` / `editable-fields.json` | **TRUE** |
| 9 | `EditorContract` tree exists but is not projected into `CompiledWidget` | tree in `bob/lib/compiler/editor-contract.ts`; no `editorContract` member in `bob/lib/types.ts` / `compiler.server.ts` | **TRUE** |
| 10 | Grant issuers are `roma`, `sanfrancisco`; `assertCap` enforces capability | `sanfrancisco/src/grants.ts:6,208` | **TRUE** |
| 11 | Three registered agents with declared boundaries | `ck-contracts/src/ai.ts:101-124` (`editor_ops_only`, `account_widget_translated_values`, `prague_copy_tooling_output`) | **TRUE** |
| 12 | EB-007 exists and describes the `role`-flag flattening | `EVERGREEN_BACKLOG.md:44`; `role` flag live in `widgetCopilotCore.ts:95-111` | **TRUE** |
| 13 | Instance translation runs Tokyo-worker → SF via queue | `INSTANCE_TRANSLATION_JOBS` in `tokyo-worker/wrangler.toml:38` and `sanfrancisco/wrangler.toml:31` | **TRUE** |
| 14 | "…exactly like Tokyo-worker → `SANFRANCISCO_L10N` already does" (108 §3 Option C, Recommendation #2) | `SANFRANCISCO_L10N` appears in **zero** code or wrangler files; only in docs (`documentation/architecture/Overview.md`, `documentation/ai/overview.md`, `CloudflarePagesCloudDevChecklist.md`, executed PRDs 080/098/098C) | **FALSE — phantom binding; see PR-1** |
| 15 | GTM / UX Writer specs exist | `documentation/ai/agents/gtm.md`, `ux-writer.md` | **TRUE** |

Shipped model policy, extracted from `packages/ck-policy/ai-runtime.matrix.json`
(recorded here as the *current scaffolding*, not as a constraint — see PR-2):

| Agent | free | tier1 | tier2+ | Picker |
|---|---|---|---|---|
| `cs.widget.copilot.v1` | deepseek-chat | gpt-5-mini | gpt-5.2 default; gpt-5-mini/gpt-5/gpt-5.2 allowed | tier2+ |
| `widget.instance.translator` | deepseek-chat | deepseek-chat | gpt-5-mini default | never |
| `website.prague.copy.translator` | gpt-5.2 | gpt-5.2 | gpt-5.2 | never |

Provider adapters that exist: `sanfrancisco/src/providers/openai.ts`, `deepseek.ts`.
No Google/Gemini, Mistral, or Llama adapter exists.

---

## Part III — Findings (PR-1 … PR-12)

Severity scale: **BLOCKER** (must resolve before the affected PRD enters
`02-Executing`), **MAJOR** (must resolve during execution-spec writing), **MINOR**
(fix in place; no gate).

---

### PR-1 — BLOCKER (doc-truth): Option C cites a service binding that does not exist

**Where:** 108 §3 Option C ("exactly like Tokyo-worker → `SANFRANCISCO_L10N` already
does"), §4 Recommendation point 2, Open Question 1's "lean: binding-first."
Also: `documentation/architecture/Overview.md` and `documentation/ai/overview.md`
carry the same stale name as if it were shipped.

**Problem:** The shipped mechanism for instance translation is the
`INSTANCE_TRANSLATION_JOBS` **queue** (verified, audit row 13). `SANFRANCISCO_L10N`
exists only in docs. The decision doc is internally inconsistent — §1.2 correctly says
"queue-driven async work… via `INSTANCE_TRANSLATION_JOBS`," then Option C cites the
phantom binding as the shipped precedent, and OQ1's lean rests on that precedent. The
repo's own debugging-order rule says runtime code is truth. An executing agent reading
the canonical docs today will believe a binding exists and may try to call it.

**Required amendment:**
1. In 108 §3 Option C and §4: replace the `SANFRANCISCO_L10N` citation with the real
   precedent: *"exactly like Tokyo-worker already dispatches instance translation to
   San Francisco through the `INSTANCE_TRANSLATION_JOBS` queue."* The argument
   survives intact — the precedent is "orchestrate outside SF, execute through SF,"
   and a queue proves it as well as a binding does.
2. OQ1 must be restated without the false precedent (proposed disposition in Part V).
3. File a doc-cleanup item to purge `SANFRANCISCO_L10N` from
   `documentation/architecture/Overview.md` and `documentation/ai/overview.md` (and to
   mark the executed-PRD mentions as historical). At an AI-native company, stale
   canonical docs are not cosmetic — they are corrupted agent context.

---

### PR-2 — BLOCKER (direction): 108A-1 is framed as hardening the legacy lineup; pre-GA it should build the plane for the target lineup and delete the legacy one

**Where:** 108A §0 ("the first execution slice… is a release gate for Builder Copilot
model/provider safety"), §3.1, §4 (In Scope), §6 acceptance ("`gpt-5.2` is never
called with unsupported reasoning values").

**Problem:** 108A-1 as written pays for capability profiles, conformance checks, and
typed-error work on a model lineup nobody has deliberately chosen (the matrix's
gpt-5.x/deepseek mix), then the provider-landscape brief proposes swapping defaults to
Gemini anyway. Pre-GA there is no installed base: `ai-runtime.matrix.json` is one JSON
file and the adapters are two files. Hardening gpt-5.2's `reasoning_effort` quirks
only to retire gpt-5.2 is double work. Worse, the acceptance criterion "gpt-5.2 is
never called with unsupported reasoning values" enshrines the legacy lineup in the
definition of done.

Related: the brief rates DeepSeek "EU GDPR: No / Enterprise: Risk" while the shipped
matrix defaults free-tier Copilot **and** free/tier1 instance translation to
`deepseek-chat`. Pre-GA this is not a compliance incident — it is a default nobody
chose. The cheapest moment to resolve it is now, by lineup decision rather than by
caveat-carrying.

**Required amendment:**
1. Reframe 108A-1: *"Build the plane contract (capability registry, conformance,
   typed errors, picker eligibility) and instantiate it with the ratified target model
   lineup. Models not in the target lineup are removed from the matrix, not hardened."*
2. Add a Step 0 decision gate: **ratify the target lineup** (the brief's routing map is
   the draft: Gemini 2.5 Flash for Copilot turns, Flash-Lite for translation, Pro
   reserved for durable agents, Mistral parked until an EU deal exists, DeepSeek
   dropped or explicitly retained with a named rationale). One short addendum, not more
   research.
3. Rewrite the acceptance criteria to be lineup-agnostic: *"No model is callable
   without a passing conformance profile; no request parameter is derived from model-id
   string matching; raw upstream payloads never reach product surfaces."* The gpt-5.2
   bug is then fixed by deletion, which is the correct fix.
4. The first conformance run **is** the Gemini onboarding. Provider adapter work for
   the target lineup is in-scope for 108A-1; adapter work for legacy models is not.
5. What is *not* disposable, and must be stated as such in 108A §1.1: the mechanism —
   registry as the single capability atom, conformance gating eligibility, typed
   errors, evals deciding assignments, residency as a future policy dimension. Models
   are cattle; the contract is the asset.

**Caveat to record in the PRD:** the brief's prices/benchmarks postdate verifiable
knowledge and pricing moves quarterly (the brief says so itself). Pre-GA volume makes
economics a non-driver anyway: pick the lineup on quality-per-task and data-routing
posture; re-check pricing at GA.

---

### PR-3 — BLOCKER (one-atom): the deterministic resolver's home is ambiguous across 108B

**Where:** 108B §3.1.2 (Bob builds vocabulary and resolves: "from Bob's compiled
Builder contract"), §3.2.5 item 4 (San Francisco's `widgetCopilotCore` "uses it for
deterministic Guide answers and target resolution"), §3.2.5 item 6 (deterministic
answers "without a model call" — surface unstated).

**Problem:** As written, both Bob and SF can plausibly own intent→control resolution.
Two resolvers is the duplicate-atom failure this very series rejects Option B over.
Additionally, SF's existing keyword scorer (`widgetCopilotCore.ts:273-296`) is the
current (bad) resolver; if the new resolver lands elsewhere, the scorer must be
**deleted, not bypassed** — the 106 rule ("delete it, fence it, or stop; do not
preserve it and work around it") applies.

**Required amendment (recommendation, to be ratified):**
- **Bob owns vocabulary + resolution.** Bob owns the compiled contract, current
  values, and visibility state; deterministic capability/Guide answers and target
  resolution then cost zero network hops, and "no model call" is literally true (no SF
  round-trip for those turns).
- **SF receives resolved targets only** for model-backed planning (value generation,
  text rewriting), plus the bounded ambiguity context 108B §4 already describes.
- **Explicit deletion step:** remove the keyword scorer and the `csPromptPayload`
  source-snippet padding in the same slice that lands the projection — with an `rg`
  guard as completion evidence, 106-style.
- State in 108B §3.1.2 explicitly: *"The resolver is a Bob authority. San Francisco
  must not contain a second intent-to-control matcher."*

---

### PR-4 — BLOCKER (sequencing): 108B builds on surfaces the 106 series just reshaped, one of which is currently broken

**Where:** 108B §3.2.4/§3.2.5 (projection from `bob/lib/compiler/editor-contract.ts`,
repeatable structure map), §3.2.2 fixtures.

**Problem:**
1. `editor-contract.ts` was modified by the still-uncommitted 106F working tree. 108B's
   foundational projection would be built on an unlanded foundation.
2. The Guide's repeatable-structure map depends on object-manager semantics including
   the new `allow-structure` attribute (consumed at
   `tokyo/product/widgets/cards/spec.json:796`, plumbed at
   `bob/lib/compiler/stencils.ts:302-304`). Per the 106 verification (2026-06-09), that
   feature exists **only in the Tokyo build artifact** —
   `dieter/components/object-manager/*` has zero occurrences — so the next
   `pnpm build:dieter` erases it. If Copilot learns "cards items are add/remove-able"
   from a contract 106F deliberately locked, the Operator will propose ops Bob must
   reject.
3. Conversely, 106F is also the gift: the normalized `uiLabels` (e.g.
   `uiLabels.core.singular`, "Header CTA" vs "Action button") are exactly the raw
   material for 108B's vocabulary map. The PRDs already share that vocabulary — keep it
   that way.

**Required amendment:** add an explicit pre-step gate to 108B-1: *"106F working tree
is committed; the dieter object-manager source/artifact drift is fixed
(`allow-structure` ported to `dieter/components/object-manager/*`); fixtures pin to
the certified 106F widget contracts."*

---

### PR-5 — MAJOR: the conformance gating mechanism is undecided, and the acceptance criterion is unenforceable until it is

**Where:** 108A §3.1 ("a provider-conformance check must call each declared model…"),
§6 ("a model capability declaration cannot merge without a passing conformance check").

**Problem:** "Cannot merge without a passing conformance check" implies live provider
calls gating merges. That means either provider keys in CI (a custody question the
series otherwise treats as sacred), a scheduled conformance run (merge gate becomes a
freshness gate), or recorded attestation (a human/agent runs conformance and commits
the signed report). Left undecided, this gate will be quietly skipped.

**Proposed disposition:** recorded attestation, pre-GA. A script
(`scripts/ai/conformance.mjs`, run by an operator/agent with keys) calls each declared
model with its declared parameters and writes a dated conformance report into the
registry entry (`conformance: { status, lastRunAt, reportRef }`). CI then enforces the
cheap, deterministic part: *a registry entry whose `status` is not `passed`, or whose
`lastRunAt` is older than N days, is not picker-eligible and fails the build if
referenced as a default.* No provider keys in CI; the gate is real; freshness is
explicit. Revisit (possibly scheduled runs) at GA.

---

### PR-6 — MAJOR: no input/context budget exists anywhere in the series, and the whole-widget snapshot makes that a real risk

**Where:** 108B §4 ("not an unbounded dump"), policy matrix budgets.

**Problem:** Matrix budgets cap **output** tokens (650–1600) and wall-clock time. The
whole-widget snapshot 108B mandates is an **input** cost with no budget: FAQ's spec
alone is ~2,268 lines, and the snapshot adds current values, visibility, repeatables,
and conditional maps. Without a number, the Guide payload will quietly regrow into the
prompt-shredding it replaces — the same failure with better intentions.

**Required amendment:** 108B's execution spec must define a snapshot size budget per
turn class (proposal: resolved-edit turns ≤ ~2KB serialized target context;
Guide turns ≤ ~16KB serialized snapshot; capability turns 0 — deterministic in Bob),
plus a named-failure behavior when a widget's snapshot exceeds budget (truncate by
panel relevance with an explicit `truncated: true` marker — never silent). Add
`inputBudget` alongside `maxTokens` in the policy schema so the plane can enforce it.

---

### PR-7 — MAJOR: the sub-PRDs are not execution-grade; acceptance criteria are questions

**Where:** 108A §6, 108B §8, both phrased "execution-ready only when the execution
spec can answer: …".

**Problem:** By their own framing these documents gate on execution specs that do not
exist. The 106 series demonstrated the format that keeps executing agents from
drifting: numbered steps, one-step-at-a-time permission, green = named evidence,
NOT_ALLOWED lists per step, blocker protocol, and a ledger updated as work executes.
None of the 108 sub-PRDs has any of it.

**Required amendment:** write `108A1__EXEC__*` and `108B1__EXEC__*` specs in the 106
format before anything enters `02-Executing`. Skeletons are provided in Part IV of
this review. 108C is appropriately thin (it is deferred by design) — do not detail it
yet; 108B-2's spec can be written after 108B-1 is green.

---

### PR-8 — MAJOR: typed-error mapping must include upstream-text quarantine, and it must cover every adapter in the target lineup

**Where:** 108A §3.2; code reality at `openai.ts:165`.

**Problem:** The leak mechanism is concrete: the adapter throws
`PROVIDER_ERROR` with `message: \`Upstream error (${res.status}) ${text}\`` — the raw
provider body rides inside the message field of an otherwise "typed" error. A typed
error *code* is not enough; the *message* channel must be quarantined too.

**Required amendment:** the 108A-1 execution spec must state: upstream
response bodies are log/telemetry-only; product-facing error envelopes carry only the
`AI_*` code, a product-safe message key, and a correlation id. Add a negative fixture:
a simulated provider 4xx with a distinctive payload string; assert the string appears
in telemetry and never in the `/v1/execute` response body or Builder UI. Apply to
every adapter shipped in the target lineup (not just OpenAI — the current
`deepseek.ts` and the new Gemini adapter need the same treatment and the same
fixtures).

---

### PR-9 — MAJOR: residency/data-routing has no dimension in the policy schema

**Where:** brief's Mistral/EU and DeepSeek/China analysis; matrix is keyed by
agent × tier only.

**Problem:** "Route EU workloads to Mistral" is unimplementable in the current policy
shape — there is nowhere for residency to live. If the lineup decision (PR-2) drops
DeepSeek, the urgency falls, but the schema gap remains for the first EU enterprise
conversation.

**Required amendment:** 108A-2's contract design must include a reserved
`residency`/`region` dimension in the signed policy (sourced from the account capsule
on the Roma issuer path), even if only one value ships pre-GA. Schema reservation now;
routing logic when the first EU requirement is real. (Same design-before-build pattern
the 108 doc already applies to 108D's outbound layer.)

---

### PR-10 — MINOR: learning capture is configured to produce no eval corpus exactly where it is needed

**Where:** matrix `learningCapture.rawSamplePercent`: free tier = 0, paid tiers = 20.

**Problem (pre-GA opportunity):** 108B's eval scenarios need real failure transcripts.
Pre-GA, "users" are Clickeen-owned accounts; sampling 0–20% of those interactions
discards the eval corpus the series says it needs (108 §6.5, 108F substrate).

**Recommendation:** pre-GA, set `rawSamplePercent: 100` for internal/demo accounts
across all tiers, and revisit sampling at GA when real customer data enters the
stream (with the residency dimension from PR-9 in mind).

---

### PR-11 — MINOR: op semantics for "hide" and repeatable identity need one-line definitions

**Where:** 108B §3.2.2 ("Hide the button — never delete a scalar path"), §8
("repeatable actions use stable item identity where available").

**Recommendation:** the execution spec should define, once: *hide = set the governing
visibility toggle (e.g. `headerCta.enabled`/`show*` path) to `false`; never `remove`
on a scalar; `remove` is only valid on repeatable items addressed by item id (the
`ensureIdsDeep` ids that object-manager already maintains), with index fallback only
when no id exists.* This is one paragraph that prevents three classes of invalid ops.

---

### PR-12 — RESOLVED (product decision, 2026-06-09): the Copilot model picker is a hard requirement; the fix is making it work, not questioning it

**Where:** 108B §5, matrix tier2+ `allowModelPicker: true`.

**Decision (Pietro):** the picker ships in Copilot. Period. An earlier draft of this
finding offered "hide it until ≥2 verified options exist" as an alternative — that
option is withdrawn. The 108 doc's §3.6(b) posture stands as the contract: user-facing
Copilot picker is table stakes; internal/durable agents stay eval-pinned with no
picker.

**What this binds:**

1. The picker is broken today in the precise sense that it offers models the plane
   cannot call (gpt-5.2 → unsupported `reasoning_effort` → raw provider JSON in chat).
   The fix is 108A-1's eligibility rule: **picker-eligible = in policy ∧ conformance
   passed.** Every option shown must be callable; no option a user can select may
   fail on call shape.
2. The D1 lineup decision must therefore include **≥2 conformance-passed
   Copilot-eligible models** (the picker needs real choices behind it). The provider
   brief's candidates feed this.
3. Picker choice and automatic routing (PR-13) are two lanes over the same allowed
   set: a user's explicit pick is honored within the set; routing handles turn-class
   defaults and failover when the user hasn't pinned a choice. A user pick must never
   be silently overridden — if the picked model fails, the typed error surfaces with
   the option to retry or switch.

---

### PR-13 — BLOCKER (design omission): the series has no LLM routing contract — it confuses model assignment with model routing

(Numbered after the minors because it was added in review round 2, flagged by the
product owner; severity-wise it sits with PR-1 through PR-4.)

**Where:** structural omission across the series. 108 §3.6(b) and OQ9; 108A §1.1
("model/provider routing") and §3; 108B §3.2.1 turn taxonomy; the provider brief's
"multi-model routing strategy built into the SF signed policy."

**Problem:** The series has a complete theory of model **custody** (keys, grants,
budgets, conformance, typed errors) and no theory of model **choice**. Everything it
says about selection is static assignment: a pinned `selectedModel` per agent/tier,
`allowModelPicker` on/off, "cheapest model that passes evals" as a single winner, and
OQ9's per-phase map parked as a lean. `modelRouter.ts` is named wrong — it validates a
pinned policy choice; it never chooses. Five concrete consequences:

1. **The signed policy, as shaped, structurally cannot route.** Grants are minted
   before turn content exists, so content/task-aware routing cannot live in a policy
   that pins one model. Routing requires the grant to carry an allowed model *set*
   plus routing rules, with the plane choosing within that set at execution time. The
   brief's claim that "the architecture already supports routing" is false — it
   supports assignment.
2. **108B builds the perfect routing signal and discards it.** The deterministic
   resolver classifies every turn (deterministic/no-model, resolved single-target
   edit, multi-op plan, Guide) — a routing key computed before any model call. The
   series never connects turn class to model choice.
3. **There is no failure routing.** `AI_PROVIDER_RATE_LIMITED`,
   `AI_MODEL_UNAVAILABLE`, `AI_PROVIDER_TIMEOUT` have exactly one consumer: the
   user's error message. No declared failover to a conformance-passed alternate, no
   retry posture per error class, no escalation when a cheap model returns invalid
   ops (108B's op validation is a machine-checkable escalation trigger going unused).
   "No silent cross-switching" is a custody virtue, but nobody distinguished forbidden
   *silent* switching from declared, policy-bounded, telemetry-recorded failover.
4. **Durable agents make per-phase routing mandatory, not optional.** GTM is
   crawl → analyze → plan → draft with different model needs per phase. That is the
   cost model of the durable half, handled in one parenthetical lean.
5. **Routing is the actuator the learning loop needs.** 108F's substrate records
   `(agent, phase, model, …)` so the system can learn which combination works — but
   the only steering wheel the series provides is hand-editing
   `ai-runtime.matrix.json`. Telemetry with no actuator.

**Required amendment:** add a third plane atom beside capability ("can we call it")
and policy ("may we call it"): **routing — "should we call it for this unit of work,
and what happens when it fails."** Concretely, in 108A's plane contract:

- a turn-class taxonomy (interactive; supplied by Bob's resolver) and phase-class
  taxonomy (durable; declared per agent in the registry);
- a class→model routing table inside the signed policy's allowed set;
- declared escalation rules (e.g. `invalid_structured_output` → stronger model, max N)
  and failover rules (typed provider errors → alternate model), both
  conformance-gated, both recorded;
- every route/escalation/failover decision lands in the learning event, so 108F has
  something to update.

Draft schema (for the 108A-1 execution spec):

```ts
interface AgentRoutingPolicy {
  allowedModels: ModelRef[];                   // the set the signed grant authorizes
  routes: Record<TurnClass, ModelRef>;         // class -> primary model
  escalation?: { trigger: 'invalid_structured_output' | 'low_confidence';
                 to: ModelRef; maxEscalations: number };
  failover?: Array<{ on: 'AI_PROVIDER_RATE_LIMITED' | 'AI_MODEL_UNAVAILABLE'
                        | 'AI_PROVIDER_TIMEOUT'; to: ModelRef }>;
}
// TurnClass (interactive): 'resolved_edit' | 'multi_op_plan' | 'guide' | 'freeform'
// ('deterministic' turns never reach the plane)
// PhaseClass (durable): declared per agent; populated in 108A-2/108C
```

Ownership split: 108A-1 owns the routing schema, the interactive class→model table,
failover/escalation enforcement, and route-decision recording. 108B-1 owns emitting
the turn class from the resolver. 108A-2 owns the phase-class dimension for durable
agents. The lineup decision (PR-2/D1) ratifies the initial table contents — D1 is no
longer "one model per use case" but "a routing table per agent within the ratified
lineup."

---

### PR-14 — BLOCKER (disposition gap): the series never disposes of the three shipped AI uses — keep, rebuild, or delete

(Added in review round 2 after product-owner feedback. Clickeen has exactly three AI
uses in production: widget instance translation, Prague copy translation, and Builder
Copilot. A platform series that re-architects the plane must say, per shipped use,
exactly what is deleted, what is replaced, what is rebuilt, and when. The 108 series
does this for none of them completely.)

**The shipped inventory (verified):**

| Use | Shipped code | Status per product owner |
|---|---|---|
| a) Widget instance translation (29-locale overlays) | `sanfrancisco/src/instance-translation-queue.ts`, `agents/l10nTranslationCore.ts`, `agents/translationSafety.ts`, `tokyo-worker/src/domains/account-translations/operations.ts`, `INSTANCE_TRANSLATION_JOBS` queue, matrix rows (deepseek-chat free/tier1, gpt-5-mini tier2+) | **Works-ish** after long breakage — the only working AI feature |
| b) Prague copy translation | `sanfrancisco/src/agents/l10nPragueStrings.ts`, registry entry `website.prague.copy.translator` (`ck-contracts/src/ai.ts`), matrix rows (gpt-5.2 all tiers), HMAC endpoint path, boundary `prague_copy_tooling_output` | Works, but **obsolete by design**: PRD 106C/106D turn Prague into widgets/pages; migrated Prague content translates through the instance-translation substrate, so a separate Prague copy translator has no future |
| c) Builder Copilot | `bob/components/CopilotPane.tsx`, `roma/.../copilot/route.ts`, `roma/lib/ai/account-copilot.ts`, `sanfrancisco/src/agents/{csWidgetCopilot, widgetCopilotCore, csPromptPayload, widgetCopilotCsProduct, widgetCopilotLanguage, widgetCopilotParsing, widgetCopilotPromptProfiles}.ts` | **Completely broken** across tiers |

**What the series actually says, per use:**

- **(c) Copilot — covered ~70%.** 108B defines target behavior thoroughly and names
  some deletions (prompt shredding, source padding, EB-007 role split). But there is
  no file-by-file verdict over the seven SF copilot files + Bob/Roma surfaces: which
  files survive as plane primitives, which are rewritten, which are deleted. Part IV.2
  of this review partially fills this; the 108B-1 execution spec must complete the
  inventory with a per-file disposition column.
- **(a) Instance translation — covered ~5%, and that is dangerous.** The series uses
  it only as the Option C precedent and a roster row. Meanwhile 108A-1 (as amended by
  PR-2) rewrites the matrix and adapters — which **silently changes the models under
  the one AI feature that currently works**. If legacy models/adapters are deleted per
  PR-2, the translator's deepseek/gpt-5-mini assignments break on the same day, and
  nothing in any PRD notices. The translator also never gets: a capability/conformance
  profile, a routing row (the brief proposes Gemini Flash-Lite for translation), or a
  re-base onto the 108A-2/108C formalized scaffold (108C §3.1 admits the pattern "is
  not yet formalized" — but no step formalizes *this agent*).
- **(b) Prague copy translation — covered in the wrong direction.** Every 108 doc
  carries `website.prague.copy.translator` forward as a live roster member. Per PRD
  106, it is a walking-dead surface. 106E targets the Prague-side translation sidecars
  for deletion "after their routes migrate," but **nobody owns the SF-side deletion**:
  the agent file, registry entry, matrix rows, HMAC endpoint, and boundary value. A
  cross-series ownership gap — 106E deletes the consumer, no PRD deletes the producer.

**Required amendment — add a disposition table to 108 (and gates to the execution
specs):**

| Use | Disposition | Owner | Gate |
|---|---|---|---|
| Widget instance translation | **Keep + protect, then re-base.** 108A-1 must carry an explicit translator regression gate: after matrix/adapter rewrite, the 29-locale overlay generation runs green on a fixture instance before merge. Lineup decision (D1) must include a translator routing row. Re-base onto the durable scaffold happens in 108A-2/108C, not before. | 108A-1 (protection), 108A-2/108C (re-base) | Overlay regression fixture green |
| Prague copy translation | **Freeze now, delete on 106D.** No 108 investment (no capability profile beyond what the shared plane gives for free, no routing work, no picker). Deletion inventory: `l10nPragueStrings.ts`, registry entry, matrix rows, endpoint route, `prague_copy_tooling_output` boundary. Deletion executes when 106D cuts Prague routes over; add this inventory to 106E's ledger so one PRD owns both sides. | 106E (executes), 108 roster (marks deprecated) | 106D green |
| Builder Copilot | **Rebuild per 108B.** The 108B-1 execution spec adds a per-file disposition over the seven SF copilot files + Bob/Roma surfaces (survives / rewritten / deleted), with `rg` guards for the deleted ones. | 108B-1 | Earth tests green, deletion guards green |

108's §2.1 roster table should gain a `Disposition` column reflecting the above —
classification without disposition is what allowed a dead agent to be carried forward
and a live one to be endangered.

---

### PR-15 — MAJOR (hardcoding inventory): model/provider truth is scattered across services in five flavors; 108 kills only two

(Added in review round 2 after product-owner feedback. The world-class bar: provider
and model literals may exist in exactly two files — the capability registry and the
policy matrix — and everything else derives. Adding a model = registry entry +
conformance run + matrix row, zero TypeScript changes.)

**Verified inventory:**

| # | Flavor | Locations | Covered by 108? |
|---|---|---|---|
| 1 | Call mechanics from model-id strings | `sanfrancisco/src/providers/openai.ts:60,65,70` (`startsWith('gpt-5')` → token param, temperature, reasoning effort) | **Yes** — dies with the capability registry (108A-1 Step 4) |
| 2 | Model/provider defaults hardcoded in agent code, bypassing policy | `agents/l10nPragueStrings.ts:117` (`env.OPENAI_MODEL ?? 'gpt-5.2'` — the matrix rows for the Prague agent are decorative; code wins); `agents/l10nTranslationCore.ts:209,253,324` + `l10n-account-routes.ts:279` (`?? 'deepseek'` silent fallbacks **inside the one working AI feature**) | **No.** Prague instance dies via PR-14, but the translator fallbacks violate the no-fallbacks tenet and no 108 doc names them |
| 3 | The provider universe duplicated across services | `ck-contracts/src/ai.ts:1` and `sanfrancisco/src/ai/modelRouter.ts:5` (duplicate type unions); `grants.ts:7` (Set); `roma/.../copilot/route.ts:16` (second Set); `ai/chat.ts` provider `if`-dispatch. Onboarding one provider = 5+ files across 3 services | **No** — never named anywhere in the series |
| 4 | Model catalog + UI labels in compiled code | `ck-contracts/src/ai.ts:136-141` (`AI_MODEL_CATALOG` — relabeling a model requires a redeploy) | **Implicitly** — the registry supersedes it, but no doc orders its deletion |
| 5 | Model names baked into PRD acceptance criteria | 108A §6 ("`gpt-5.2` is never called with…") | **PR-2** — criteria must be lineup-agnostic |

(DevStudio is clean: `admin/src/main.ts` renders model options from the policy matrix
via lookup; it only inherits flavor-4 labels.)

**Required amendment — fold into the 108A-1 execution spec:**

1. Step 4 (adapters) gains: delete `AI_MODEL_CATALOG`; derive the provider type and
   all provider sets from the capability registry (one generated/derived type, no
   hand-maintained unions); replace the `ai/chat.ts` dispatch chain with a registry
   lookup; collapse Roma's `AI_PROVIDERS` set to a registry-derived import.
2. Step 7 (matrix rewrite) gains the translator-fallback cleanup: model/provider for
   `widget.instance.translator` comes only from the signed policy; the `?? 'deepseek'`
   parameter defaults are removed and a missing model fails typed at the boundary
   (`AI_GRANT_INVALID`), per the no-fallbacks tenet. Covered by the PR-14 overlay
   regression gate so the cleanup cannot silently break the working feature.
3. Completion evidence (`rg` guards, run at the repo root):
   - `rg "startsWith\('gpt" sanfrancisco/` → 0
   - `rg "AI_MODEL_CATALOG"` → 0
   - `rg "\?\? 'deepseek'|= 'deepseek'" sanfrancisco/src` → 0
   - `rg "'deepseek' \| 'openai'"` → ≤1 (the single derived definition)
   - `rg "OPENAI_MODEL"` → 0 (env-var model overrides are not a lane)
4. NOT_ALLOWED: any new provider/model literal outside
   `packages/ck-policy/model-capabilities.json` and `ai-runtime.matrix.json`; env-var
   model selection; provider `if`/`switch` chains in agent or route code.

---

## Part IV — Execution-spec skeletons (the augmentation)

> **SUPERSEDED (2026-06-09, round 2):** these skeletons were the v1 drafts. The
> authoritative execution contracts are now `108A1__EXEC__…` and `108B1__EXEC__…`
> (v2). Known drift in the skeletons below: the TurnClass enum still lists
> `freeform` (abolished — split into `advice` + out-of-domain per Q3 round 5), and
> no Q6 conversion mode exists here. Do not execute from this section.

These are proposed contents for the two execution specs PR-7 requires. They follow the
106 contract: one step at a time; green = named evidence; a blocker report stops
execution; NOT_ALLOWED is binding per step.

### IV.1 — `108A1__EXEC__AI_Plane_Capability_And_Conformance.md` (skeleton)

Preamble requirements: PRD tenets block (copy the 106 umbrella contract verbatim),
authority table (this spec owns the plane contract; it does not own Copilot behavior
= 108B, durable contract = 108A-2), and the PR-2 reframe statement.

| Step | Action | Completion evidence | NOT_ALLOWED |
|---|---|---|---|
| 0 | Pietro ratifies the target model lineup (from the provider brief + PR-2). Record the table (use case → provider:model → picker eligibility) in this spec. | Signed-off lineup table committed in this file. | Starting Step 1 with an unratified lineup; "we'll decide the model later." |
| 1 | Define `ModelCapabilityProfile` schema + types in `ck-contracts`; registry file as a sibling of the policy matrix (proposed: `packages/ck-policy/model-capabilities.json`). Capability and policy stay separate atoms (108A §3.1). | Schema + types diff; lint/typecheck green. | Merging capability fields into `ai-runtime.matrix.json`; policy defining provider-call mechanics. |
| 2 | Build `scripts/ai/conformance.mjs`: calls each declared model with declared params (token param, reasoning values, temperature, structured output/JSON schema); writes `conformance: { status, lastRunAt, reportRef }` into the registry entry. | Conformance run output for every lineup model; report files committed. | Conformance via mocks; marking `passed` without a real provider call. |
| 3 | CI/validation gate: registry entries referenced as defaults or picker-eligible must have `status: passed` within freshness window N days (propose N=30 pre-GA). | Validator script + failing-case test (`rg`/test output). | Provider keys in CI; silent skip when registry missing. |
| 4 | Rebuild provider adapters registry-driven for the target lineup (add `google.ts`; keep/remove `deepseek.ts` per Step 0; rewrite `openai.ts` if it survives Step 0). Delete all string-prefix heuristics. | `rg "startsWith\('gpt"` returns zero; adapter diffs; conformance green per adapter. | Per-model `if` ladders re-growing inside adapters; keeping dead adapters "just in case." |
| 5 | Typed error envelope: `AI_MODEL_UNSUPPORTED_PARAMETER`, `AI_MODEL_UNAVAILABLE`, `AI_PROVIDER_RATE_LIMITED`, `AI_PROVIDER_TIMEOUT`, `AI_PROVIDER_EMPTY_RESPONSE`, `AI_GRANT_INVALID`, `AI_BUDGET_EXCEEDED`. Upstream bodies quarantined to telemetry (PR-8). | Negative fixture proving a distinctive upstream payload string reaches telemetry and never the response body. | Raw upstream text in any `message` field returned to product surfaces. |
| 6 | Routing contract (PR-13): add `AgentRoutingPolicy` to the signed policy schema (allowed set, interactive class→model table, escalation + failover rules); rewrite `modelRouter.ts` into an actual router that chooses within the allowed set by turn class and applies declared failover/escalation; every route decision recorded in the learning event. | Schema + router diff; unit tests: turn-class routing, failover on simulated `AI_PROVIDER_RATE_LIMITED`, escalation on invalid structured output, max-escalation cap; route decision visible in telemetry fixture. | Silent cross-switching outside declared rules; failover to a model without `conformance: passed`; routing logic in adapters or orchestrators. |
| 7 | Rewrite `ai-runtime.matrix.json` to the ratified lineup as routing tables per agent (D1) — including the translator row (PR-14). Picker eligibility = policy ∧ conformance. Add reserved `residency` dimension (PR-9) and `inputBudget` (PR-6) to the policy schema. Prague translator rows frozen, marked deprecated (PR-14). | Matrix diff; validator green; picker e2e shows only callable models; **translator regression gate: 29-locale overlay generation green on a fixture instance with the new lineup**. | Carrying legacy models "for fallback" outside declared failover entries; tier rows with unverified defaults; touching the translator's execution path without the regression fixture. |
| 8 | Bob Copilot UI renders typed errors as product-safe messages; correlation id surfaced for support. | UI fixture screenshots; no-raw-JSON assertion in e2e. | Error-message string-matching on provider text. |
| 9 | Docs sync: `documentation/services/sanfrancisco.md`, `documentation/ai/infrastructure.md`, purge `SANFRANCISCO_L10N` from canonical docs (PR-1). | Docs diff in same PR as final code step. | Doc updates deferred to "later." |

Proposed `ModelCapabilityProfile` (draft for Step 1):

```ts
interface ModelCapabilityProfile {
  provider: 'google' | 'openai' | 'mistral' | 'deepseek';
  modelId: string;            // exact provider model id
  uiLabel: string;
  endpointFamily: 'chat_completions' | 'responses' | 'generate_content';
  tokenParam: 'max_tokens' | 'max_completion_tokens' | 'maxOutputTokens';
  reasoning: { supported: boolean; values?: string[]; default?: string | null };
  temperature: { supported: boolean; max?: number };
  structuredOutput: { jsonMode: boolean; jsonSchema: boolean };
  streaming: boolean;
  retry: { retryableStatuses: number[]; maxRetries: number };
  eligibility: { userPicker: boolean; durableAgents: boolean };
  profileVersion: string;     // bumped on any field change
  conformance: { status: 'unverified' | 'passed' | 'failed'; lastRunAt?: string; reportRef?: string };
}
```

### IV.2 — `108B1__EXEC__Builder_Copilot_Operator.md` (skeleton)

| Step | Action | Completion evidence | NOT_ALLOWED |
|---|---|---|---|
| 0 | Pre-req gate (PR-4): 106F committed; dieter object-manager drift fixed; fixtures pinned to certified contracts. Ratify resolver ownership = Bob (PR-3). | Commit refs; drift `diff -q` clean; decision recorded here. | Starting on an uncommitted contract foundation. |
| 1 | Compiler projection: add `builderContract` to `CompiledWidget` from the `EditorContract` tree, merging current values + visibility from `currentConfig`. | Type diff; projection unit tests per shipped widget; typecheck green. | A new schema parallel to `EditorContract`; widget-specific projection branches. |
| 2 | Bob deterministic surface: capability answers ("what can you edit?"), vocabulary map (labels/aliases/groups/panels + `uiLabels`), resolver with precedence (exact label > alias > group > panel context > clarify). Resolver also emits the **turn class** (PR-13 routing key: `resolved_edit` / `multi_op_plan` / `guide` / `freeform`). Zero SF calls for deterministic turns. | Unit fixtures: each earth-test phrase → resolved target / clarification + expected turn class, per widget. | Model calls for capability/where-is answers; resolver logic in SF. |
| 3 | Payload swap: `CopilotPane` sends the structured snapshot (+ resolved target and turn class for edit turns); Roma route validates snapshot shape; SF routes the model call by turn class per `AgentRoutingPolicy` (108A-1 Step 6); flat `controls[]` retained only as apply-allowlist/outcome metadata. Enforce snapshot budget (PR-6). | Payload schema test; Roma 4xx on malformed snapshot; size-budget test; telemetry fixture showing turn class → routed model. | Unbounded snapshot; raw `widget.html/css/js` snippets in payload; SF re-deriving turn class from content. |
| 4 | SF cleanup: `widgetCopilotCore` accepts resolved targets + bounded context; **delete** the keyword scorer (`:273-296`) and `csPromptPayload` source padding; split `role`-flag behavior where EB-007 requires. | `rg` guards (scorer gone, no `widget.html` in prompt path); EB-007 marked promoted. | Bypassing instead of deleting; keeping the scorer as "fallback." |
| 5 | Apply/undo/conflict: Bob validates ops (path ∈ contract ∨ allowed repeatable; type/index checks; forbidden paths; PR-11 semantics), applies to working copy, Builder-label summary, one-turn undo, snapshot-hash conflict rejection. | Unit tests incl. stale-snapshot rejection and undo round-trip. | Silent re-resolution of stale ops; partial application of an op set. |
| 6 | Fixtures/evals: earth tests (108B §3.2.2 table) as the eval suite — calltoaction first, then all 8 widgets; wire into root Playwright harness where browser-level. | All scenarios green on calltoaction; matrix tracked per widget in the ledger. | Declaring green from unit tests alone where the scenario specifies preview behavior. |
| 7 | Docs sync: Copilot + SF docs match shipped behavior. | Docs diff. | — |

Ship gate (unchanged from 108B): 108A-1 green before release; not before Step 1–6 work.

Proposed `builderContract` projection (draft for Step 1):

```ts
interface BuilderContractSnapshot {
  widgetType: string; widgetDisplayName: string;
  instanceId: string; activeLocale: string; snapshotHash: string;
  panels: Array<{ id: string; label: string; groups: Array<{
    id: string; label: string; fields: FieldNode[];
  }> }>;
  repeatables: Array<{ path: string; itemLabel: string; identityKey: 'id';
    min?: number; max?: number; allowStructure: boolean; itemCount: number }>;
  forbiddenPaths: string[];
  truncated?: boolean; // PR-6: set when budget forced panel-relevance truncation
}
interface FieldNode {
  path: string; kind: string; label: string; valueType: string;
  options?: Array<{ value: string; label: string }>;
  currentValue: unknown; visible: boolean; disabled: boolean;
  showIf?: string; ownership: 'shell' | 'core';
}
```

### IV.3 — 108B-2 (Guide) — write after 108B-1 is green

Content is well-specified in 108B §3.2.3–3.2.4 already; the execution spec needs only:
the panel/workflow map derivation rules (derived from the projection, not hand-authored
per widget), the Guide-to-op bridge contract (a Guide answer carries
`applicable: 'now' | 'needs_value' | 'unsupported'` + the op template when `now`), the
Guide snapshot budget (PR-6), and the §3.2.3 prompt list as the eval suite.

### IV.4 — 108C amendments (keep thin)

Only two changes: (1) add to Blocked-by: *"design-level decisions on OQ6/OQ7 (outbound
layer shape, external credential custody) recorded before 108C enters `02-Executing`"*
— the 108 doc's own 108D design-before-build note, made binding; (2) reference the
queue-vs-binding disposition from PR-1/OQ1 so the service-binding requirement in §4.2
inherits the corrected precedent language.

---

## Part V — Proposed dispositions for the ten open questions (108 §7)

To be ratified or amended by Pietro; recorded here so execution specs can cite one
place.

1. **Transport:** binding-first for the new durable execute path is still the right
   *target*, but state the true precedent (queue) and keep the queue pattern for
   fire-and-forget work like translation. Rule: request/response durable calls →
   private service binding; fire-and-forget jobs → queue. No authenticated internal
   HTTP path.
2. **Ops-agent outputs:** confirm the proposed boundary — orchestrator-owned "review
   store" (R2 bodies + D1 index/state/audit), named per agent, outside product
   persistence and outside SF.
3. **Registry model:** yes — extend `ck-contracts` with `runtime: 'interactive' |
   'durable'` and `subject: 'account' | 'service'`; keep `boundary` as is.
4. **Billing/usage:** pre-GA, emit usage in the learning record (108A §3.5 fields) and
   defer aggregation to a billing PRD. Do not build metering now.
5. **First durable agent:** ~~UX Writer~~ **superseded (Pietro, 2026-06-09): the
   Widget Instance Translator is the shipped internal agent and becomes the 108C
   reference via re-base** — the scaffold formalizes a production workload under
   the D9 regression gate instead of building a speculative agent. UX Writer
   deferred until a real need exists. (108C's text must be amended accordingly
   before it enters execution.)
6. **Outbound layer shape:** decide at 108D *design* time (before 108C ships, per the
   108 doc's own note): start as a thin shared client module with intent-shaped
   functions; promote to an internal MCP server only when ≥2 agents or ≥3 external
   systems exist. Record the decision, build nothing now.
7. **External credential custody:** vault-style store owned by the AI plane (parallel
   to provider-key custody); OAuth/payment via browser handoff, never inline tool
   calls. Decide at 108D design time alongside OQ6.
8. **Risk classes:** propose `read_only`, `reversible_write`, `customer_facing_write`,
   `publish`, `user_content_action`. SF requires the policy approval signal for the
   last three; review state/commits stay with the owning orchestrator.
9. **Per-phase model map:** superseded by PR-13 — upgraded from "schema room" to a
   first-class routing contract. Interactive turn-class routing ships in 108A-1; the
   durable phase-class dimension of the same `AgentRoutingPolicy` ships in 108A-2 and
   is mandatory (not optional) for any multi-phase durable agent in 108C/108D.
10. **Concurrency:** accept the lean as written — separate budgets keyed on calling
    surface; interactive keeps the tight in-isolate cap; durable side queue/workflow-
    gated at the orchestration layer. Design in 108A-2.

---

## Part VI — Decision checklist (ratify before anything enters `02-Executing`)

All nine ratified by Pietro on 2026-06-09 (round 3). Record:

| # | Decision (RATIFIED 2026-06-09) | Blocks |
|---|---|---|
| D1 | **Two providers: OpenAI current-generation models + DeepSeek** (keys exist for both). Gemini/Mistral not onboarded. The binding rule is the mechanism, not the models: lineup lives only in the capability registry + policy matrix, swap-without-code, PR-15 guards so nothing is hardcoded-and-forgotten. DeepSeek China-routing concern is a GA-gate item handled by the reserved residency dimension when EU customers appear. | 108A-1 Step 0 |
| D2 | **Resolved one level above the Bob-vs-SF question: disambiguation is compiler output.** The compiled contract carries per-control user-facing vocabulary, aliases, and ambiguity groups (compile-time validated: visible controls sharing an alias without a disambiguation group fail compilation). Bob's resolver is a lookup over that data; SF receives resolved targets; the SF keyword scorer is deleted. | 108B-1 Steps 0–2 |
| D3 | **Multi-model infra is baked in as the plane's shape** (registry + conformance + typed errors + routing). Conformance mechanism defaults to recorded attestation + 30-day CI freshness (implementation detail, not product decision; no provider keys in CI). | 108A-1 Steps 2–3 |
| D4 | **Adopt the industry pattern** (budgeted, priority-ranked context assembly with explicit truncation — the GitHub Copilot "prompt crafting" shape; select-and-rank, never dump). Opening caps 2KB resolved-edit / 16KB Guide / 0 capability turns; evals tune the numbers. | 108B-1 Step 3 |
| D5 | **Deferred off the product owner's plate**, with one correction (Pietro, 2026-06-09): the translator IS the shipped internal agent — so the 108C reference agent is the **Widget Instance Translator re-base** (formalize the pattern it already runs in production, guarded by the D9 regression fixture), not a greenfield UX Writer. UX Writer waits until actually needed. Remaining OQ dispositions bind later PRDs, re-presented when due. | 108A-2 / 108C design |
| D6 | **Picker ships in Copilot** (decided earlier same day). D1's two-provider lineup satisfies the ≥2 callable options requirement; user pick never silently overridden. | 108A-1 Steps 6–7 |
| D7 | **100% learning capture on internal accounts pre-GA** — treated as an execution default in 108B-1, not a ceremony decision. Plainly: stop throwing away the records that become Copilot's test cases while all users are internal. | 108B-1 |
| D8 | **Adopt the industry pattern:** cascade routing (cheap first, escalate once on machine-validated failure — Bob's op validation is the trigger), declared failover chains on provider errors (LiteLLM/OpenRouter shape, inside the plane, across the two D1 providers), pinned user picks are sacred (visible error, never a silent switch), every route/escalation/failover decision recorded. | 108A-1 Step 6, 108B-1 Steps 2–3 |
| D9 | **Dispositions with a "better, not worse" bar:** translator — regression fixture is the floor, policy-driven models + deleted silent fallbacks + typed failures + eventual re-base is the ceiling; Prague translator — improves by dying into the one translation substrate on 106D; Copilot — rebuilt per 108B, earth tests as proof. | 108A-1 Step 7, 108B-1 spec, 106E ledger |

Round 4–6 product decisions (Pietro, 2026-06-09, after the three-perspective
pre-execution review; Q3/Q5 amended in round 5, Q6 added in round 6; round-2 review
fixes applied to all consuming docs same day):

| # | Decision (RATIFIED) | Binds |
|---|---|---|
| Q1 | **Copilot UX = immediate apply + one-turn undo.** Copilot edits apply to the in-memory working copy and preview instantly; the shipped blocking Keep/Undo gate in `CopilotPane.tsx` is removed. Safety boundary = dirty state + the normal Save path. | 108B1 Steps 3/5; CopilotPane disposition |
| Q2 | **User-facing copy is a fixed table** (error code/state → exact string), drafted in 108B1, product-owner-editable any time, shipped as deterministic canned strings — never model-generated. English-only pre-GA. Non-blocker: edits to the table don't gate steps. | 108B1 copy table |
| Q3 | **AMENDED (round 5 + round 7 simplification, Pietro, 2026-06-09):** in-domain product questions ("what do you think of my widget?", "best color for this button?", "why might conversion be low?") are NOT freeform — they are a routed **`advice`** class: model-backed, grounded in the widget snapshot, answering about THIS widget in plain text. If the answer suggests a change and the user says "do it," that next message is a normal edit turn. **No suggestion buttons, no carried ops, no special accept path** (round 7: these were AI-invented UI and were removed). Available on all tiers. Only out-of-domain requests (meta-chat, off-product asks) get the canned redirect. | 108B1 Step 2; 108A1 routing schema |
| Q4 | **No interim work on the live Copilot.** Not disabled, not patched, not re-pointed — the 108B1/108A1 refactor is the fix. Zero effort spent on the broken version. | nothing — explicitly no work |
| Q6 | **Free-vs-paid Copilot routing (Pietro, 2026-06-09, round 6; simplified round 7):** PAID = the full structured Copilot (Operator + advice now, Guide at 108B-2). FREE = **one model call per month — spent however the user chooses** (edit or advice; limits count calls, they never grade "usefulness" — round 7 removed the useful-turn/refund logic as AI-invented). After it: every response is the fixed **conversion template**: grounded encouragement (one short model sentence referencing the actual widget) + one paid-feature recommendation matched to the user's question from the entitlements matrix + upgrade CTA. It works off policy like everything else: Roma stamps the mode in the grant, the server refuses full model runs in conversion mode, every response path renders per the mode. Clarifications and canned answers don't call the model, so they cost nothing automatically — no special rules. Honesty rule: "that's a paid feature," never "I can't." Every conversion turn is a measurable event (feature cited × question × upgrade click). The "1" lives in the entitlements matrix. | 108A1 policy schema; 108B1 conversion mode |
| Q5 | **Turn-class boundary rule (amended with Q3 round 5):** if a request can land on a control it is an edit (possibly after one clarification — "write me a slogan" → "want that as your Header title?"); if it is about how Builder works it is Guide (108B-2; pre-Guide, redirect naming the panel); if it is about the user's widget/design/content without an edit target it is **`advice`** (grounded model answer + actionable offer); only off-domain requests get the canned redirect. | 108B1 Step 2 resolver + fixtures |

Sequencing after ratification:

```text
1. Land 106F + fix dieter drift (PR-4 gate)
2. 108B-1 Steps 1–2 (projection + Bob resolver)   ┐ parallel
   108A-1 Steps 1–5 (registry + adapters + errors) ┘
3. 108B-1 Steps 3–6 (payload swap needs both tracks)
4. Release gate: 108A-1 green + earth tests green on all 8 widgets
5. 108B-2 (Guide), then 108A-2 (durable contract), then 108C (translator re-base
   reference, per D5)
6. 108D design decisions (OQ6/OQ7) recorded before 108C ships
```

Out-of-series note (decided 2026-06-09): the DevStudio cloud migration is **not**
108 scope. It is its own PRD, blocked-by 108A-1 only (its policy tooling must be
rebuilt against the post-108A-1 capability/routing schema, once), and runs parallel
to the remainder of the series. Preferably lands before 108C so the workforce
review-artifact UI has a cloud-reachable internal home, but that is a synergy, not a
gate. Until it lands: zero investment in the local DevStudio policy tooling.

---

## Closing assessment

The 108 series is the right architecture argued the right way, wrapped around the
right priority inversion. Its defects are: one false precedent (PR-1), one framing
that pre-GA reality makes obsolete (PR-2), one unowned atom (PR-3), one sequencing
hazard into the live 106 work (PR-4), a missing layer of execution scaffolding (PR-5
through PR-12, Part IV) — and one genuine conceptual gap (PR-13): the series built
complete model *custody* with no model *choice*. It governs every model call and
never decides which model handles which unit of work, with what fallback. The routing
contract is the third plane atom (capability / policy / routing) and a blocker on
108A. All of it is fixable in days, in documents, before any code moves. Fix the docs
first — at this company, the docs are the program.
