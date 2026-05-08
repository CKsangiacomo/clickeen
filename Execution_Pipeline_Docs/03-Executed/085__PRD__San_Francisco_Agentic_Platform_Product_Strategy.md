# PRD 085 - San Francisco Agentic Platform Product Strategy

STATUS: EXECUTED - 2026-05-06

This PRD starts the San Francisco product/platform discussion. It is intentionally not an implementation plan yet.

San Francisco is Clickeen's AI execution and agentic workforce system. Before we change code again, we need to decide what the platform is supposed to be across four product areas:

1. Learning
2. Multi-LLM support by entitlements
3. Customer-facing agents
4. Clickeen internal agentic workforce

The goal is to simplify San Francisco into a boring, durable AI platform. The wrong outcome is adding more agents, routes, fallbacks, and shared-secret tooling without deciding what each part owns.

---

## 1. Product Truth

San Francisco is not account truth, widget truth, asset truth, or localization storage truth.

San Francisco owns:

- Provider keys
- AI grant verification
- Model/provider execution
- Agent prompts, tools, and structured outputs
- AI usage metadata
- AI interaction logs
- AI outcome ingestion
- Internal agent jobs when explicitly owned by San Francisco

San Francisco must not own:

- Account identity
- Account permissions
- Billing policy
- Widget instance storage
- Widget publication state
- Account asset storage
- Locale overlay storage
- Runtime locale fallback

Every San Francisco path must answer:

- Who is the subject?
- Who authorized this execution?
- What exact agent is running?
- What is the allowed provider/model policy?
- What structured output is expected?
- Where does the output go?
- What usage/cost/outcome is recorded?

If a path cannot answer those questions, it is a deletion candidate.

---

## 2. Current Runtime Findings

This PRD is based on the current code inspection of:

- `sanfrancisco/src/index.ts`
- `sanfrancisco/src/grants.ts`
- `sanfrancisco/src/ai/chat.ts`
- `sanfrancisco/src/l10n-account-routes.ts`
- `sanfrancisco/src/personalization-jobs.ts`
- `sanfrancisco/src/agents/*`
- `packages/ck-contracts/src/ai.ts`
- Roma copilot caller code

Good current architecture:

- Account-widget translation generation uses a private WorkerEntrypoint, not a public shared-secret HTTP route.
- San Francisco receives approved text items for account-widget translation, not account storage/config authority.
- Grants are signed, scoped, expiring, and capability checked.
- D1 schema is migration-owned, not created at Worker boot.
- Raw AI interaction logs go to R2, and queryable indexes go to D1.

Current risks and cleanup candidates:

- `/v1/outcome` was fixed by 085A and now accepts one direct signed outcome payload. The remaining `sf.command` envelope survives only for personalization/onboarding.
- `sdr.copilot` has no active non-documentation caller outside San Francisco/contracts.
- `agent.personalization.onboarding.v1` has no active non-documentation caller outside San Francisco/contracts.
- `CK_INTERNAL_SERVICE_JWT` remains for residual San Francisco HTTP tooling.
- The legacy AI access mapping layer was removed by 085B; runtime policy is now direct per-agent policy.
- Widget copilot has fail-soft parsing that can turn invalid model output into a no-op assistant message.
- Widget copilot `TEMP` edit-policy multiplier was removed by 085B.
- San Francisco has no local contract test suite.

These are not all implementation commands yet. They are the starting evidence for the discussion.

---

## 3. Non-Negotiable Tenets

### 3.1 No Fake Agents

An agent must have a real product surface or a real internal workforce owner.

If an agent only exists because an old plan mentioned it, delete it.

### 3.2 No Shared-Secret Product Glue

`CK_INTERNAL_SERVICE_JWT` must not become product architecture.

Acceptable temporary use:

- local/cloud-dev tooling only
- explicitly documented
- no account product path depends on it

Target architecture:

- product paths use signed grants and real account authz
- internal worker-to-worker paths use private bindings or queues
- CLI/tooling paths are clearly tooling, not product runtime

### 3.3 No Silent AI Healing

AI output is allowed to fail.

For editor operations:

- valid structured output applies
- invalid structured output fails with a typed error or typed clarification
- no hidden "pretend this was a successful answer" behavior

### 3.4 Learning Is Not Automatic Self-Mutation

Learning means collecting outcomes, evaluating patterns, and promoting better prompts/models through controlled release.

San Francisco must not silently rewrite production prompts or policy from raw outcomes.

### 3.5 AI Access Is Entitlements Plus Runtime Policy

Account policy determines what AI an account can use.

There is no product need for a second AI access concept between entitlements and runtime policy.

The surviving model is:

- **Account plan / entitlements**: what the customer bought and what limits apply.
- **Agent runtime policy**: what a specific agent may use for this account.
- **Grant**: one signed execution permission carrying that policy for one request/job.
- **San Francisco**: enforcement and execution only.

Per-surface runtime policy answers:

- is this copilot/job enabled?
- which providers/models are allowed?
- what is the default model?
- can the user choose a model?
- how many tokens are allowed per call?
- how many turns are allowed in a thread?
- what monthly/daily usage budget applies?
- what cost ceiling applies?
- what timeout applies?
- what tools, if any, may the agent use?

San Francisco must not invent a hidden access bucket or runtime class. It receives an explicit policy envelope and enforces it.

---

## 4. Discussion Track A - Learning

### Problem

Clickeen wants agents that improve over time. Today, San Francisco logs interactions and has an outcome endpoint, but the learning contract is not yet clean enough to trust.

### Current Shape

- `/v1/execute` emits an `InteractionEvent`.
- Queue consumer writes raw events to R2 and indexes a subset in D1.
- Roma can send outcome events after user decisions.
- The outcome body shape was fixed by 085A. Track A follow-up is now about reporting/test harness depth, not envelope repair.

### Decisions Needed

1. What counts as a learning outcome?
   - examples: edit applied, edit undone, user kept change, user upgraded, user ignored answer, support resolved, publish completed

2. Which outcomes are product-critical versus analytics-only?
   - product-critical outcomes should be reliable and tested
   - analytics-only outcomes can be best-effort

3. What is the first learning loop?
   - editor copilot quality
   - l10n translation quality
   - support answer quality
   - SDR conversion quality

4. Who approves prompt/model changes?
   - human approval
   - offline eval threshold
   - staged rollout

5. Where do learning artifacts live?
   - raw logs: R2
   - queryable index: D1
   - evaluated examples: D1 or versioned repo artifacts
   - promoted prompts: repo/runtime contract, not live mutation

### Recommendation

Start boring:

- Fix the outcome contract.
- Keep tiny execution/outcome facts in D1.
- Keep bounded raw samples in R2 only when useful.
- Keep small indexes in D1.
- Add a human-reviewed golden-example promotion flow later.
- Do not build autonomous prompt self-training yet.

### Scale Plan: Do Not Log Everything As Raw Payload Forever

At 1M accounts, naive "log every full request/response forever" is wrong.

San Francisco needs four different logging layers:

1. **Metering record for every execution**
   - Always written.
   - Tiny.
   - No full prompt, no full widget config, no large payload.
   - Fields: `requestId`, `agentId`, `accountIdHash`, `policyVersion`, `provider`, `model`, token counts, estimated cost, latency, status, error code, timestamp.
   - Purpose: billing, abuse detection, cost control, reliability.

2. **Outcome record for every meaningful user decision**
   - Written for the eligible learning cohort.
   - Default learning cohort is paid accounts only.
   - Small.
   - Fields: `requestId`, `event`, timestamp, session/account hash, optional decision latency.
   - Purpose: connect agent behavior to product results.
   - Free-account conversion analytics, if needed, belongs in the product analytics path, not detailed San Francisco learning capture.

3. **Raw learning payloads only when useful**
   - Not every successful call forever.
   - Keep sampled invalid outputs for a short retention window.
   - Keep paid negative or high-signal outcomes, such as undo, reject, repeated clarification, support unresolved.
   - Sample normal successful calls at a controlled rate per agent and entitlement cohort.
   - Default detailed-learning rule: paid accounts only, deterministic 20% sample for normal successful calls.
   - Free accounts get minimal cost/abuse/budget facts only by default, not detailed learning/raw payload capture.
   - Serious failures for paid accounts are captured even outside the 20% sample.
   - Never store secrets, auth capsules, private account data, or full configs unless the agent contract explicitly redacts/minimizes them.
   - Purpose: debugging and training/evaluation material.

4. **Curated golden examples**
   - Small, reviewed, versioned.
   - These are the examples we trust for prompt/model evaluation.
   - Promotion into this set is human-reviewed or governed by an explicit eval threshold.

Current code writes one raw R2 object per `/v1/execute` event. That is acceptable for pre-GA/dev, but it is not the final 1M-account shape. The scale target is:

- R2 stores partitioned/chunked raw event batches, not one object per execution forever.
- D1 stores small recent indexes and/or daily rollups, not giant raw payloads.
- Account budget counters live with the account/product owner, not in raw learning logs.
- Raw payload retention is bounded by agent and outcome class.

This means "log every execution" really means:

- log every execution as a small metering/audit fact
- log only selected raw payloads for learning
- curate a tiny set for actual prompt/model improvement

Useful learning facts must describe what happened, not vague aggregate praise.

For Builder copilot, a statement like "FAQ kept 88% of edits" is not enough by itself. The useful facts are:

- what the user asked for
- which controls or groups the agent touched
- which paths changed
- whether the edit applied, was rejected, was undone, or produced invalid output
- why invalid output failed validation, when known

San Francisco should store those compact facts. It should not infer widget meaning from path prefixes like `stage.*` or `pod.*`; the agent result/caller must emit the compact metadata, and telemetry stores it.

### Track A Execution State

Completed by `085A`:

- Fixed `/v1/outcome` to accept one simple signed outcome payload.
- Defined Builder copilot quality as the first learning loop.
- Replaced legacy `ux_keep`/`ux_undo` names with `edit_applied`/`edit_undone`.
- Added canonical invalid/clarification outcome events.
- Deleted telemetry path-scope guessing from the D1/R2 ingestion layer.
- Replaced one-object-per-event raw R2 writes with paid-only bounded sampling for normal successes.

Remaining Track A follow-up, not part of the executed 085A slice:

- Add a proper San Francisco unit/contract test harness if we want more than static contract verification.
- Add a small offline report script before any automatic learning system.
- Decide whether D1 needs a later metrics expansion for token/cost/subject-hash rollups, as its own migration/deploy slice.
- Define raw sample retention/chunking before high-volume launch.

---

## 5. Discussion Track B - Multi-LLM Support By Entitlements

### Problem

Clickeen wants accounts to access different LLMs, budgets, token windows, model pickers, and agent capabilities based on plan/entitlements without turning provider routing into chaos.

### Current Shape

PRD 085B deleted the legacy AI access mapping layer and moved runtime decisions into direct per-agent runtime policy.

San Francisco currently supports:

- DeepSeek
- OpenAI
- Anthropic
- Groq
- Amazon Nova / Bedrock

Provider/model policy is currently defined in `packages/ck-contracts/src/ai.ts`, and San Francisco enforces the grant policy. The future shape should keep a central policy source, but it should describe agent runtime policy directly instead of mapping through legacy AI access labels.

### Decisions Needed

1. What is the canonical agent runtime policy shape?
   - per agent
   - per account plan/entitlement
   - direct allowed providers/models
   - direct budgets/turns/tokens/cost ceilings

2. Should normal users choose models?
   - free/basic may have no picker
   - accounts with broader entitlements may have a model dropdown if policy allows it
   - user choice must still stay inside the signed runtime policy

3. What does fallback mean?
   - acceptable: retry transient provider failures inside the grant-allowed provider/model envelope when policy permits
   - not acceptable: silently downgrading quality or changing product truth

4. How are costs controlled?
   - account policy budgets before grant issuance
   - grant token/request/cost ceilings inside San Francisco
   - D1/R2 telemetry for audit

5. What must a grant carry?
   - agent ID
   - selected/default model
   - allowed models/providers
   - max tokens per call
   - max turns/requests per thread
   - timeout
   - tool permissions if relevant

Example target shape:

```ts
type AgentRuntimePolicy = {
  agentId: string;
  enabled: boolean;
  defaultModel: string;
  allowedModels: string[];
  allowedProviders: string[];
  allowModelPicker: boolean;
  maxTokensPerCall: number;
  maxTurnsPerThread: number;
  maxMonthlyTurns: number | null;
  timeoutMs: number;
  tools?: string[];
};
```

`maxMonthlyTurns` is a policy ceiling, not a live "turns remaining" counter. Live usage state belongs to the account/entitlement owner, not inside a signed per-request grant.

### Recommendation

Use one product-owned agent runtime policy matrix.

Roma/Berlin/account policy decides what the account is allowed to access. San Francisco receives the signed runtime policy and executes within that envelope.

Do not let every route invent provider fallback or model choice.

### Execution Plan: How We Switch LLMs

LLM switching must be a policy rollout, not code scattered through callers.

The intended path is:

1. **Agent registry declares what the agent can do**
   - Agent ID, task class, output contract, supported tool classes, and baseline execution contract.
   - Current source of truth: `packages/ck-contracts/src/ai.ts`.

2. **Account policy resolves the per-agent runtime policy**
   - Account entitlements resolve to concrete allowed models, default model, model-picker permission, token ceilings, turn ceilings, monthly budgets, and tool permissions.
   - Customer entitlement truth stays outside San Francisco.

3. **Grant issuer mints one signed execution envelope**
   - Includes allowed providers, allowed models, default model, selected model only if allowed, budgets, timeout, tool permissions, and expiry.
   - Roma does this for account Builder copilot.
   - San Francisco internal code can do this for explicitly owned Clickeen jobs with internal-only runtime policy.

4. **San Francisco enforces, it does not reinterpret**
   - Verify grant.
   - Pick the default provider/model from the allowed matrix.
   - Reject anything outside the signed policy.
   - Apply token/request/cost ceilings.

5. **Model switch happens by changing the central policy matrix**
   - Example: change the Builder Copilot Pro default model from `gpt-5-mini` to another approved model.
   - No Roma route, Bob component, or widget code should need to change.

6. **Every switch requires an eval gate**
   - Run golden examples for that agent.
   - Validate structured output.
   - For Builder copilot: ops must validate against controls.
   - For l10n: placeholder/tag/anchor safety must pass.
   - Compare latency, invalid-output rate, estimated cost, and outcome quality.

7. **Rollout is staged**
   - Start local/dev.
   - Then small deterministic canary by account/request hash.
   - Then staged rollout by entitlement cohort.
   - Rollback is reverting the policy version/default model, not changing product code.

8. **Fallback policy must be explicit**
   - Customer-facing editor agents should not silently jump across quality classes unless the agent policy allows it.
   - Transient retry inside the same allowed provider/model envelope is acceptable.
   - Internal workforce jobs may allow broader fallback because latency/availability can matter more than UX consistency.
   - Any fallback must remain inside the grant's allowed providers/models and cost ceiling.

The simple target:

- one matrix decides allowed models
- one grant carries the decision
- one San Francisco router enforces it
- one eval/rollout process changes it

### Required Future Execution Slices

- Completed by 085B: delete the legacy AI access mapping abstraction from product language.
- Completed by 085B: add runtime-policy cost ceilings where high-volume generation can run.
- Completed by 085B: no hidden customer-facing provider/model fallback; same-model retry only.
- Future-only: add deeper runtime policy provider/model rejection tests if the model catalog expands.
- Future-only: keep the model-switch runbook operationally current as providers/models change.

---

## 6. Discussion Track C - Customer-Facing Copilots

### Problem

Customer-facing AI is part of the product experience and is called `copilot`. It needs stricter contracts than internal jobs because it touches user trust directly.

### Current Shape

Clearly real:

- `cs.widget.copilot.v1` - account Builder copilot

Product-internal, not customer-facing:

- `widget.instance.translator` - account-owned widget instance translator, private Tokyo-worker -> San Francisco path
- `website.prague.copy.translator` - Prague website-copy translator, internal/tooling path

Questionable or unowned:

- `sdr.copilot`
- `agent.personalization.onboarding.v1`

Possible future customer-facing copilots must be proposed one at a time. Do not keep placeholders because a surface might exist later. An SDR/funnel copilot, support copilot, billing helper copilot, or recommendation copilot needs its own owner, surface, input/output contract, budget policy, and outcome events before it can enter the registry.

### Decisions Needed

Naming rule:

- Customer-facing AI is called a `copilot`.
- Internal AI is called an explicit `job`.
- If a user sees and chats with it inside a product surface, it is a copilot.
- If it runs translation, generation, enrichment, indexing, evaluation, support prep, ops, or content work behind a boundary, it is an internal job.

For every customer-facing copilot, decide:

1. What surface owns it?
   - Roma
   - Prague
   - Venice
   - support/admin tooling

2. Is the user authenticated?

3. What is the subject?
   - account user
   - anonymous visitor
   - internal service

4. What can it do?
   - chat only
   - return editor ops
   - create a support draft
   - modify account data
   - trigger follow-up jobs

5. What is the output contract?

6. What is the budget and upsell behavior?

7. What outcome events matter?

### Recommendation

Do not keep placeholder customer-facing copilots.

Keep only:

- Builder copilot, because it is live product

Delete `sdr.copilot`. Delete `agent.personalization.onboarding.v1` through 085D, because it is an internal route/job cleanup.

Rename `l10n.instance.v1` to `widget.instance.translator` through 085D. The old name is vague and hides the product subject. The surviving internal job translates one saved widget instance owned by one account.

Create/rename the Prague copy translation job as `website.prague.copy.translator`. Prague translation is real, but it is an internal website-copy job with its own owner/input/output boundary.

### Required Future Execution Slices

- Add only minimal registry ownership fields to the existing contracts/executor registry and docs: `owner`, `surface`, and `boundary` for customer-facing copilots; `owner`, `jobType`, and `boundary` for internal jobs. Do not create a new database/admin surface/checklist engine for this.
- Delete unowned agents and registry entries.
- Add compile-enforced required registry fields plus PR review checks before any new customer-facing copilot can be added. Do not create a checklist engine.

---

## 7. Discussion Track D - Clickeen Agentic Workforce

### Problem

San Francisco is supposed to run Clickeen's internal workforce: sales, support, marketing, localization, content, and ops. That can become powerful, but it can also become a junk drawer of scripts and agent experiments.

### Current Shape

San Francisco has the start of internal jobs:

- personalization/onboarding job machinery
- Prague string translation tooling
- account-owned widget instance translation generation
- event logging

But the platform does not yet have a clean internal workforce model.

### Decisions Needed

1. Which internal jobs are real now?
   - `widget.instance.translator`
   - `website.prague.copy.translator`
   - Any other proposed job must get a separate PRD before it enters the registry.

2. Which jobs are allowed to write?
   - For this slice: only generated account-widget translation ops through the existing owning flow, and Prague translation output through the explicit Prague tooling workflow.
   - Anything else is future work, not a permission taxonomy for this PRD.

3. How are internal jobs triggered?
   - queue
   - scheduled job
   - admin action
   - CLI/tooling

4. Where does job state live?
   - KV for short-lived job status
   - D1 for durable indexes
   - R2 for raw artifacts
   - Supabase only when product/account truth is being changed by the owning service

5. What is the approval model?
   - Prague generated copy is reviewed/committed through the Prague workflow.
   - Account-widget translation writes generated ops only through the owning account/widget flow.
   - No broad support/ops/GitHub/Cloudflare approval model is designed in this slice.

### Recommendation

Start with internal AI jobs, not open-ended chatbots.

The first real internal jobs are:

- `widget.instance.translator` - translates one account-owned widget instance through the private Tokyo-worker -> San Francisco path.
- `website.prague.copy.translator` - translates Prague website copy through explicit tooling/internal workflow.

Do not build a generic internal workforce framework in this slice. Every surviving internal job only needs the fields required to prevent ambiguity:

- owner
- job type / trigger
- input contract
- output contract
- boundary
- cost policy
- audit trail

Boundary values for this execution are concrete:

- `editor_ops_only` - Builder copilot returns editor operations; Roma/Bob own applying them to the active widget.
- `account_widget_translation_overlay` - account-widget translator writes generated translation ops through the owning account-widget translation flow.
- `prague_copy_tooling_output` - Prague copy translator produces tooling output that is reviewed/committed through the Prague workflow.

No internal agent should gain product write power through a shared-secret HTTP route. The current Prague translation system must be cleaned into an explicit Prague translation job boundary; account-widget translation must stay separate.

### Required Future Execution Slices

- Rename/formalize account-widget translation as `widget.instance.translator`.
- Rename/formalize Prague website-copy translation as `website.prague.copy.translator`.
- Clean the current Prague translation tooling so it is not a product-looking shared-secret route.
- Delete personalization/onboarding.
- Add worker-to-worker private bindings or queue patterns for any surviving internal jobs.

---

## 8. Canonical Deletion / Rename Ownership

These decisions are now assigned to one execution PRD each. Child PRDs may reference the table, but must not re-own the same deletion.

| Candidate | Decision | Owner PRD | Required Pre-Execution Proof |
| --- | --- | --- | --- |
| `sdr.copilot` | delete now | 085C | full-monorepo grant/caller scan proves no surviving live issuer |
| `l10n.instance.v1` | rename to `widget.instance.translator` | 085D | D1/R2 old-agent-id safety check; migrate or document historical rows/samples |
| `agent.personalization.onboarding.v1` | delete now | 085D | full-monorepo grant/caller scan proves no surviving live issuer |
| `/v1/personalization/onboarding` | delete with onboarding job | 085D | route/job/status endpoints removed; docs no longer describe live route |
| `SanfranciscoCommandMessage` / `sf.command` | delete with onboarding job | 085D | queue type becomes interaction-event only or otherwise has one justified command owner |
| Prague string translation route/job | keep the need, clean the boundary | 085D | current transport is documented: `scripts/prague-l10n/translate.mjs` -> `POST /v1/l10n/translate` -> `CK_INTERNAL_SERVICE_JWT`, local/dev only |
| `CK_INTERNAL_SERVICE_JWT` in San Francisco | no product runtime; temporary Prague tooling only until cleaned | 085E rule, 085D cleanup | residue scan proves no account/product runtime depends on it |
| Widget copilot parse fallback | delete fake-success behavior | 085E | Roma/Bob existing chat error path verified; no broad `AgentResult` framework needed |
| Legacy AI access mapping layer | completed by 085B | executed | already replaced by per-agent runtime policy |
| Widget copilot `devMultiplier` | completed by 085B | executed | already replaced with named runtime policy limits |

Pre-execution checks required by this table:

- Full-monorepo grant issuance scans, not San Francisco-only scans.
- D1 `copilot_events_v1` distinct `agentId` check before the `l10n.instance.v1` rename.
- R2 learning prefix check for old agent IDs before/after rename.
- Prague translation transport inspection before changing its route/tooling.
- Roma/Bob copilot error-path inspection before changing strictness behavior.

Execution order:

- Execute 085E first. It removes live strictness/toxic-flow behavior before any rename/deletion churn.
- Then execute 085C and 085D together. 085C deletes the unowned customer-facing SDR copilot; 085D owns the internal job cleanup, widget translator rename, Prague translator formalization, personalization/onboarding deletion, and `sf.command` cleanup.

---

## 9. Child PRDs

Do not execute this parent PRD directly. Execution must happen through the child PRDs below.

Each child PRD owns its own scope, deletion targets, blast radius, and verification path.

- `085A__PRD__San_Francisco_Learning_And_Outcome_Loop.md`
- `085B__PRD__San_Francisco_Multi_LLM_Entitlements_And_Runtime_Policy.md`
- `085C__PRD__San_Francisco_Customer_Facing_Agent_Ownership.md`
- `085D__PRD__San_Francisco_Internal_Agentic_Workforce_Boundary.md`
- `085E__PRD__San_Francisco_Strictness_And_Toxic_Flow_Removal.md`

### Track A Execution State

`085A__PRD__San_Francisco_Learning_And_Outcome_Loop.md` was executed on 2026-05-05 for the first Builder copilot learning loop.

Surviving state:

- `/v1/outcome` accepts one direct signed payload.
- Outcome attach no longer uses the `sf.command` envelope.
- Detailed San Francisco learning is paid-only with deterministic 20% sampling for normal successful Builder copilot executions.
- Serious paid failures/invalid outputs are always captured.
- Free users keep only minimal operational metering/budget/abuse facts by default.
- Raw R2 learning capture is bounded and sanitized under `learning/...`; normal executions are not dumped as one full raw object forever.
- No new D1 schema change was required for this slice. The existing D1 tables keep tiny metering/outcome facts; detailed edit-level learning stays in sampled R2 records.
- Telemetry no longer infers widget semantics from path prefixes. Rich touched path/control/group metadata is emitted by the agent/caller and retained in sampled R2 learning records; existing D1 facts keep compact counts/scopes.

### Recommended Execution Order

085A and 085B are already executed. Remaining execution order is:

1. **085E - Strictness and toxic flow removal**
   - Stabilizes current behavior and deletes fake success paths before building more platform.

2. **085C - Customer-facing agent ownership**
   - Deletes or formalizes customer agents once runtime policy and logging are clear.

3. **085D - Internal agentic workforce boundary**
   - Builds the broader internal workforce model after the customer-facing AI platform is disciplined.

---

## 10. Verification Requirements For Any Future Execution

Every execution slice must pass:

- `./node_modules/.bin/tsc -p sanfrancisco/tsconfig.json --noEmit`
- relevant `packages/ck-contracts` typecheck/build checks
- caller checks for Roma/Tokyo-worker if contracts move
- `rg` residue checks for deleted agent IDs/routes/secrets
- Cloudflare deploy through git, not manual branch drift
- smoke test for the touched runtime path

Any slice deleting an agent must also prove:

- no live code caller remains
- no registry entry remains
- no grant issuance remains
- no route remains
- docs do not describe it as live

---

## 11. Decision Log

Fill this before execution.

### Learning

- First learning loop: default recommendation is Builder copilot quality.
- Outcome events that matter: default recommendation is `edit_applied`, `edit_rejected`, `edit_undone`, `clarification_needed`, `invalid_output`.
- Detailed learning capture: paid accounts only, deterministic 20% normal-success sample; free accounts minimal metering only by default.
- Raw payload policy: not one R2 object for every execution forever; bounded samples/failures only.
- Widget metadata policy: agent/caller emits compact touched-path/control/group metadata; San Francisco does not parse widget semantics from path strings.
- Human review required before prompt/model promotion:
- Storage/index owner:

### Multi-LLM By Entitlement

- Canonical runtime policy shape: `maxMonthlyTurns` is a policy ceiling; live usage counters stay outside the grant.
- Normal user model choice:
- Provider fallback policy:
- Cost budget policy:

### Customer-Facing Copilots

- Copilots to keep now: `cs.widget.copilot.v1`.
- Copilots to delete now in 085C: `sdr.copilot`.
- Internal/onboarding deletion owner: 085D.
- Agents to design later: any future acquisition/SDR/support agent requires a new PRD with a real surface owner.
- Required ownership fields: no framework. Required existing-registry metadata only: `owner`, `surface`, `boundary`.
- Customer-facing boundary value now: `editor_ops_only`.
- Enforcement mechanism: required TypeScript fields on the existing agent registry contract, plus boot-time registry/executor validation. No optional metadata.
- Widget translator is product-internal, not customer-facing. Its rename/data checks are owned by 085D.
- Grant issuance audit: full-monorepo scan must prove no `sdr.copilot` grant issuer survives.

### Clickeen Agentic Workforce

- Internal jobs to keep now: `widget.instance.translator`, `website.prague.copy.translator`.
- Internal boundary values now: `account_widget_translation_overlay` and `prague_copy_tooling_output`.
- Shared-secret tooling allowed: only temporary Prague translation tooling during cleanup; not account-widget translation and not product runtime.
- Private binding/queue requirements: account-widget translation stays on Tokyo-worker -> San Francisco private binding; Prague translation must become an explicit internal/tooling job boundary.
- Human approval rules: Prague generated copy is reviewed/committed through the Prague tooling workflow; account-widget translation writes only generated overlay ops for the owning account/widget instance.
- Prague current transport: `scripts/prague-l10n/translate.mjs` calls `POST /v1/l10n/translate` with `CK_INTERNAL_SERVICE_JWT`; endpoint is local/dev only.
- Personalization/onboarding deletion owner: 085D owns `agent.personalization.onboarding.v1`, `/v1/personalization/onboarding`, and `SanfranciscoCommandMessage` / `sf.command`.
- Widget translator rename owner: 085D owns `l10n.instance.v1` -> `widget.instance.translator`, including D1/R2 old-ID checks and any migration/cutover documentation.
- Workforce framework decision: no generic `InternalAgentJob` framework/type in execution; only concrete translation-job fields.
- Naming decision: only customer-facing AI is called `copilot`; all other AI surfaces are explicit internal jobs.

### Strictness / Builder Copilot

- Agent result framework decision: no broad `AgentResult` framework in 085E.
- Bounded repair decision: one same-model repair retry is allowed and metered; if repair still fails, San Francisco returns visible failure instead of fake success.
- Roma/Bob blast radius: existing Roma copilot route converts San Francisco failures into chat-message-shaped responses, and Bob already renders those messages.
- Clarification UX: valid clarification remains a normal message-with-no-ops response.
- Invalid-output UX copy: "I had trouble generating a structured edit. Please try again, or ask for one specific change (e.g. \"translate the FAQs to French\")."

---

## 12. Open Questions

1. Future acquisition/SDR agent shape: deferred until Prague/Minibob has a real live acquisition surface.
2. Long-term Prague translation transport: decide during the `website.prague.copy.translator` cleanup; current shared-secret tooling is not the target architecture.
3. Next internal workforce job after translation: deferred until translation and Builder copilot are disciplined.
