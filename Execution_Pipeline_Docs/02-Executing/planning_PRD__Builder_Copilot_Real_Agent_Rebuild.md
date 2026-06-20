# Planning PRD - Builder Copilot Real Agent Rebuild

Status: PLANNING
Owner: Product + Architecture (Bob, Roma, San Francisco)
Priority: P0
Date: 2026-06-19
Type: Product agent rebuild PRD

Related:

- `documentation/architecture/CONTEXT.md`
- `documentation/strategy/WhyClickeen.md`
- `documentation/services/bob.md`
- `documentation/services/roma.md`
- `documentation/services/sanfrancisco.md`
- `Execution_Pipeline_Docs/03-Executed/120/120__PRD__San_Francisco_Agent_Platform_Architecture_Decision.md`
- `Execution_Pipeline_Docs/03-Executed/120/120B__PRD__Builder_Copilot_Refactor.md`

---

## 0. Product Truth

Clickeen is an AI-native company. The product must operate through agents, not
through scattered regexes, shallow chat widgets, or random model calls.

The current Builder Copilot is not a real agent. It is a narrow edit operator:

- Bob performs local control matching.
- Roma mints a scoped AI grant.
- San Francisco calls a model.
- Bob applies returned edit ops to browser memory.

That plumbing is useful, but it is not the product agent. A real Builder Agent
must operate Builder for the user through the existing Clickeen architecture.

## 1. Current Failure

The PRD 120 execution overcorrected.

It made Builder Copilot safer by grounding edits in visible Builder controls, but
it also reduced the user-facing Copilot into a control-only operator. Normal
product questions such as:

- "How do I publish this?"
- "How do I upgrade?"
- "Why can't I copy the embed?"
- "Where do I change active locales?"
- "What can I do on my plan?"

can fall into an edit-only fallback. That is not an AI-native product
experience.

The specific wrong execution choice was treating Guide, Advice, and free-tier or
account conversion behavior as deferred alongside durable workforce-agent
architecture. Durable 120C work can be deferred. Builder product help and account
help cannot be deferred if the shipped surface is called Copilot.

## 2. Goal

Build Builder Copilot as a real Clickeen Builder Agent.

The Builder Agent must:

- understand the current Builder context;
- operate the open widget through Bob;
- understand account, tier, limits, publishing, billing/upgrade, and active
  locales through Roma;
- call San Francisco for AI execution only with scoped, explicit product context;
- use product routes and authorities;
- fail visibly when it cannot act;
- never invent product truth.

## 3. Architecture Law

The system remains simple:

- Widgets are software and live in the system.
- Users create instances in Roma/Bob and save them in their account in Tokyo.
- Pages are stacks of instances in Tokyo.
- Bob is an editor. Open/edit state is browser memory. User save is the
  persistence boundary.
- Tokyo is responsible for R2 storage and serving.
- Roma routes the user to their account, enforces tier/account policy, and saves
  what the user does.
- Clickeen admin is a normal account using Clickeen's own widgets.

Agent authority:

- Bob owns the open Builder working copy, visible controls, preview state, and
  in-memory edit application.
- Roma owns current account, tier, limits, account settings, publish/save routes,
  active locales, billing/upgrade surfaces, and AI grant issuance.
- San Francisco owns AI execution, provider custody, model/runtime policy,
  typed provider errors, telemetry, and scoped agent calls.
- Tokyo/Tokyo-worker remain storage/CDN surfaces. They do not become agent
  orchestrators.

## 4. Required Agent Planes

The Builder Agent must separate four planes. They can share one UI thread, but
they cannot share one vague fallback.

### 4.1 Operator Plane

Purpose: edit the currently open widget.

Authority:

- Bob compiled controls.
- Bob browser-memory instance state.
- San Francisco scoped edit call when language generation or transformation is
  needed.

Examples:

- "Change the title to Book a demo."
- "Make the button green."
- "Hide Made with Clickeen."
- "Add another FAQ item."

Existing PRD 120 Operator plumbing may be reused if it remains simple and
correct. It must not be treated as the whole agent.

### 4.2 Guide Plane

Purpose: explain how to use Builder for the current widget.

Authority:

- Bob panels, controls, visibility, current state, and save/undo status.
- Roma Builder host state for publish/copy availability.

Examples:

- "How do I publish this?"
- "Where do I change the button?"
- "Why is this option missing?"
- "How do I copy the embed?"

Guide answers must use product language and the actual current state. They must
not ask San Francisco to guess product workflow from prose.

### 4.3 Account Plane

Purpose: answer account/tier/settings questions and route the user to the right
Roma action.

Authority:

- Roma current account.
- Roma account settings.
- Roma policy/tier limits.
- Roma billing/upgrade surface.

Examples:

- "How do I upgrade?"
- "What does my plan allow?"
- "Why can't I publish more widgets?"
- "How do active locales work?"

Bob must not invent account policy. Roma must provide the exact account/tier
context or an explicit product route.

### 4.4 Out-Of-Scope Plane

Purpose: reject unrelated tasks cleanly.

Authority:

- The same Builder/Roma context that defines what the Builder Agent can do.

Examples:

- unrelated general chat;
- requests to bypass tier limits;
- requests to mutate persistence without the user's save/publish action;
- unsupported external operations.

The rejection must be direct and helpful. It must not masquerade as an edit
fallback.

## 5. San Francisco Role

San Francisco must remain the AI execution plane, not a second product brain.

San Francisco may:

- execute scoped model calls for the Builder Agent;
- use typed agent runtime policy;
- return structured outputs;
- store telemetry and learning events;
- normalize provider errors.

San Francisco must not:

- own account truth;
- own tier truth;
- own publish/save state;
- infer hidden product operations;
- call Tokyo directly for product mutation;
- become a fallback product router when Bob/Roma did not provide context.

## 6. What Must Be Kept From PRD 120

Keep:

- provider keys only in San Francisco;
- Roma-granted AI execution;
- typed model/provider errors;
- no raw widget source padding;
- no San Francisco target guessing;
- Bob in-memory apply and undo;
- visible Builder control snapshot for edit operations.

Delete or redesign:

- regex-only intent routing as the primary agent brain;
- edit-only fallback for product questions;
- wording that says Guide, Advice, account help, or upgrade behavior are outside
  the first real Builder Agent;
- any path where account/tier/product help is answered without Roma-owned truth.

## 7. Execution Slices

### Slice 1 - Agent Intent Contract

Define a typed Builder Agent turn contract:

- `operator_edit`
- `builder_guide`
- `account_help`
- `workflow_action_help`
- `out_of_scope`

Compliance:

- Keeps product meaning explicit.
- Prevents silent redress of product questions into edit failures.
- Keeps Bob/Roma/San Francisco authorities named.

### Slice 2 - Roma Account Context For Agent

Expose the minimal current-account context needed by the Builder Agent through
Roma's existing Builder-open/session path.

Must include only product-owned facts:

- account tier;
- role;
- relevant limits;
- publish status;
- copy/embed availability;
- active locales and available locales;
- billing/upgrade route availability.

Compliance:

- Roma already owns account/session/tier/settings.
- Bob receives context; it does not invent it.
- Tokyo remains storage only.

### Slice 3 - Builder Guide Responses

Implement deterministic Guide responses for current Builder workflows:

- save;
- publish;
- unpublish;
- copy URL/embed/script;
- active locales;
- translations panel;
- assets;
- undo;
- visible/hidden controls.

Compliance:

- These are product workflow explanations, not model guesses.
- Answers are grounded in current Bob/Roma state.
- No persistence mutation occurs.

### Slice 4 - Account Help Responses

Implement account/tier/help responses:

- upgrade path;
- plan/tier summary;
- publish limits;
- active locales vs available locales;
- why an account action is unavailable.

Compliance:

- Roma provides account truth.
- Bob presents it in the agent thread.
- San Francisco is not asked to invent billing or policy.

### Slice 5 - Operator Cleanup

Keep the Operator path, but remove brittle behavior that conflicts with the real
agent router.

Compliance:

- Operator remains a tool of the Builder Agent.
- Edit requests still use visible controls and validated ops.
- Product questions no longer fall into the edit-only fallback.

### Slice 6 - San Francisco Agent Execution Shape

Define when the Builder Agent calls San Francisco:

- only after the local agent router identifies an AI-needed task;
- only with explicit Bob/Roma context;
- only with a declared output contract;
- never as a product-truth substitute.

Compliance:

- San Francisco is the AI plane.
- Product authority stays in Bob/Roma.
- The model is used for language/judgment, not hidden product routing.

### Slice 7 - Verification

Verify with direct proofs and browser tests:

- "how do I publish this?"
- "how do I upgrade?"
- "why can't I copy embed?"
- "what can I edit?"
- "change the title"
- "make the button green"
- "what plan am I on?"
- "how do active locales work?"

Each scenario must assert:

- correct agent plane;
- correct authority source;
- no hidden product mutation;
- no console errors;
- no raw provider payloads;
- no edit-only fallback for product help.

## 8. Product Law Audit

This PRD exists to prevent:

- V1 Silent substitution: product/account truth must come from Roma or Bob, not
  invented by the model.
- V2 Silent healing: invalid state must not be normalized into a fake answer.
- V3 Silent omission: product help cannot be dropped while claiming Copilot works.
- V4 Fail-open control: tier/account policy must not disappear when context is
  missing.
- V5 Corruption-as-absence: missing account or Builder context must fail visibly.
- V6 Partial-success masquerade: a narrow edit operator must not be represented
  as a complete agent.
- V7 Masquerade/redress: product questions must not be wrapped as edit fallbacks.
- V8 Runtime test dependency: normal agent behavior must not depend on test
  probes or validation rituals.

## 9. Acceptance

This PRD is complete only when:

- Builder Copilot is truthfully a Builder Agent, not only an edit operator.
- Product help, workflow help, account help, and edit operations are first-class
  planes.
- Roma-owned account/tier facts are available to the agent.
- Bob-owned Builder facts are available to the agent.
- San Francisco executes scoped AI jobs without owning product truth.
- Tokyo/Tokyo-worker remain storage/CDN only.
- Human browser testing confirms the agent answers core product questions and
  edits widgets without console errors.
