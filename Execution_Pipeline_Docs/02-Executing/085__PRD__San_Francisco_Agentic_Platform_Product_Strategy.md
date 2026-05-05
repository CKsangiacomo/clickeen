# PRD 085 - San Francisco Agentic Platform Product Strategy

STATUS: DISCUSSION PRD - NOT EXECUTION READY

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

- Account-widget l10n generation uses a private WorkerEntrypoint, not a public shared-secret HTTP route.
- San Francisco receives approved text items for account-widget l10n, not account storage/config authority.
- Grants are signed, scoped, expiring, and capability checked.
- D1 schema is migration-owned, not created at Worker boot.
- Raw AI interaction logs go to R2, and queryable indexes go to D1.

Current risks and cleanup candidates:

- `/v1/outcome` expects an `sf.command` envelope, while Roma sends a simpler `{ command, payload }` body. The learning/outcome loop is likely broken.
- `sdr.copilot` has no active non-documentation caller outside San Francisco/contracts.
- `agent.personalization.onboarding.v1` has no active non-documentation caller outside San Francisco/contracts.
- `CK_INTERNAL_SERVICE_JWT` remains for residual San Francisco HTTP tooling.
- Current code still has a legacy AI access mapping layer. Target architecture deletes that product concept and replaces it with direct per-agent runtime policy.
- Widget copilot has fail-soft parsing that can turn invalid model output into a no-op assistant message.
- Widget copilot has a `TEMP` edit-policy multiplier.
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

Per-agent runtime policy answers:

- is this agent enabled?
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
- The outcome body shape appears mismatched between Roma and San Francisco.

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
- Keep raw events in R2.
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
   - Always written when available.
   - Small.
   - Fields: `requestId`, `event`, timestamp, session/account hash, optional decision latency.
   - Purpose: connect agent behavior to product results.

3. **Raw learning payloads only when useful**
   - Not every successful call forever.
   - Keep all failures/invalid outputs for a short retention window.
   - Keep all negative or high-signal outcomes, such as undo, reject, repeated clarification, upgrade clicked, support unresolved.
   - Sample normal successful calls at a controlled rate per agent and entitlement cohort.
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

### Required Future Execution Slices

- Fix `/v1/outcome` to accept one simple signed outcome payload.
- Add contract tests for interaction event + outcome attach.
- Define one first learning metric for `cs.widget.copilot.v1`.
- Add a small offline report script before any automatic learning system.
- Replace one-object-per-event raw R2 writes with a bounded retention/chunking plan before high-volume launch.

---

## 5. Discussion Track B - Multi-LLM Support By Entitlements

### Problem

Clickeen wants accounts to access different LLMs, budgets, token windows, model pickers, and agent capabilities based on plan/entitlements without turning provider routing into chaos.

### Current Shape

The current code still uses a legacy AI access mapping layer.

Target architecture: delete this conceptual layer. Legacy access labels should not survive as product language. The system should store and pass direct runtime policy instead.

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
   - max cost if relevant
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
  maxCostUsd?: number;
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

- Delete the legacy AI access mapping abstraction from product language.
- Add tests for runtime policy provider/model rejection.
- Add `maxCostUsd` where high-volume generation can run, especially l10n.
- Decide whether provider fallback is allowed per agent or globally.
- Add a model-switch runbook: eval, canary, promote, rollback.

---

## 6. Discussion Track C - Customer-Facing Agents

### Problem

Customer-facing agents are part of the product experience. They need stricter contracts than internal tools because they touch user trust directly.

### Current Shape

Clearly real:

- `cs.widget.copilot.v1` - account Builder copilot
- `l10n.instance.v1` - account-widget translation generator, private path

Questionable or unowned:

- `sdr.copilot`
- `agent.personalization.onboarding.v1`

Possible future customer-facing agents:

- Builder copilot
- Support agent
- Billing/account help agent
- Translation/localization assistant
- Starter/widget recommendation assistant
- SDR/funnel agent, if Prague/Minibob becomes a real acquisition surface again

### Decisions Needed

For every customer-facing agent, decide:

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

Do not keep placeholder customer agents.

Keep only:

- Builder copilot, because it is live product
- Account-widget l10n, because it is core product

Delete or quarantine `sdr.copilot` and `agent.personalization.onboarding.v1` unless we define their live product owner now.

### Required Future Execution Slices

- Add customer-agent ownership metadata to the existing contracts/executor registry and docs. Do not create a new database/admin surface for this.
- Delete unowned agents and registry entries.
- Add a contract checklist required before any new customer-facing agent can be added.

---

## 7. Discussion Track D - Clickeen Agentic Workforce

### Problem

San Francisco is supposed to run Clickeen's internal workforce: sales, support, marketing, localization, content, and ops. That can become powerful, but it can also become a junk drawer of scripts and agent experiments.

### Current Shape

San Francisco has the start of internal jobs:

- personalization/onboarding job machinery
- Prague string translation tooling
- l10n generation
- event logging

But the platform does not yet have a clean internal workforce model.

### Decisions Needed

1. Which internal agents are real now?
   - localization worker
   - content writer
   - support triage
   - ops monitor
   - marketing page writer

2. Which agents are allowed to write?
   - read-only analysis
   - draft only
   - write after human approval
   - autonomous write

3. What tools can each agent use?
   - web fetch
   - Tokyo read/write
   - Supabase/Michael read
   - GitHub
   - Cloudflare
   - email/support inbox

4. How are internal jobs triggered?
   - queue
   - scheduled job
   - admin action
   - CLI/tooling

5. Where does job state live?
   - KV for short-lived job status
   - D1 for durable indexes
   - R2 for raw artifacts
   - Supabase only when product/account truth is being changed by the owning service

6. What is the approval model?
   - human required for public content
   - human required for account-impacting writes
   - autonomous for safe maintenance/reporting only

### Recommendation

Start with internal agents as explicit jobs, not open-ended chatbots.

Every internal agent needs:

- owner
- trigger
- input contract
- output contract
- allowed tools
- write policy
- cost policy
- audit trail

No internal agent should gain product write power through a shared-secret HTTP route.

### Required Future Execution Slices

- Define an internal job contract.
- Decide whether Prague translation remains HTTP tooling or moves to private/local tooling.
- Delete personalization/onboarding if no live owner exists.
- Add worker-to-worker private bindings or queue patterns for any surviving internal jobs.

---

## 8. Deletion Candidates To Decide

These are not automatic deletes yet. They require product decision.

| Candidate | Why It Is Suspect | Keep Only If |
| --- | --- | --- |
| `sdr.copilot` | no active non-doc caller found | Prague/Minibob has a real live acquisition surface |
| `agent.personalization.onboarding.v1` | no active non-doc caller found | account-context carry-forward is a real product job |
| `/v1/personalization/onboarding` | shared-secret HTTP tooling and legacy naming | converted to real private/internal job boundary |
| `SanfranciscoCommandMessage` / `sf.command` | generic envelope for two commands, currently breaks outcome shape | we actually need a command bus with multiple commands |
| `CK_INTERNAL_SERVICE_JWT` in San Francisco | shared-secret residue; internal auth pattern should not be copied or polished into product architecture | local/cloud-dev tooling only, with explicit expiry/deletion plan |
| Legacy AI access mapping layer | second fake AI access system; conflicts with direct agent runtime policy | replaced by per-agent runtime policy |
| Widget copilot parse fallback | hides invalid model output as no-op assistant response | converted to explicit typed failure/clarification |
| Widget copilot `devMultiplier` | temporary product policy | replaced with named policy by entitlement and agent |

---

## 9. Child PRDs

Do not execute this parent PRD directly. Execution must happen through the child PRDs below.

Each child PRD owns its own scope, deletion targets, blast radius, and verification path.

- `085A__PRD__San_Francisco_Learning_And_Outcome_Loop.md`
- `085B__PRD__San_Francisco_Multi_LLM_Entitlements_And_Runtime_Policy.md`
- `085C__PRD__San_Francisco_Customer_Facing_Agent_Ownership.md`
- `085D__PRD__San_Francisco_Internal_Agentic_Workforce_Boundary.md`
- `085E__PRD__San_Francisco_Strictness_And_Toxic_Flow_Removal.md`

### Recommended Execution Order

1. **085E - Strictness and toxic flow removal**
   - Stabilizes current behavior and deletes fake success paths before building more platform.

2. **085A - Learning and outcome loop**
   - Makes measurement reliable after the runtime is strict enough to trust.

3. **085B - Multi-LLM entitlements and runtime policy**
   - Establishes the clean commercial/runtime policy boundary before wider model rollout.

4. **085C - Customer-facing agent ownership**
   - Deletes or formalizes customer agents once runtime policy and logging are clear.

5. **085D - Internal agentic workforce boundary**
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
- Human review required before prompt/model promotion:
- Storage/index owner:

### Multi-LLM By Entitlement

- Canonical runtime policy shape: `maxMonthlyTurns` is a policy ceiling; live usage counters stay outside the grant.
- Normal user model choice:
- Provider fallback policy:
- Cost budget policy:

### Customer-Facing Agents

- Agents to keep now:
- Agents to delete now:
- Agents to design later:
- Required ownership fields:

### Clickeen Agentic Workforce

- Internal agents to keep now: blocked until first real internal job is named; default recommendation is the localization worker.
- Shared-secret tooling allowed:
- Private binding/queue requirements:
- Human approval rules:

---

## 12. Open Questions

1. Is SDR still a real product path, or should it be deleted until Prague/Minibob needs it?
2. Is personalization/onboarding still a real job, or was it a Paris-era leftover?
3. Should Prague string translation remain a San Francisco HTTP tooling endpoint, or move to a private/local tool?
4. Should internal Clickeen jobs use the same runtime policy shape with an internal account/service subject?
5. Should provider fallback be allowed at all for customer-facing agents, or only for internal jobs?
6. What is the first measurable learning target for Builder copilot?
7. Which internal workforce agent should be first after localization?
