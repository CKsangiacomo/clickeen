# 121 PRD - Clickeen Agentic Framework Umbrella

Status: EXECUTING
Owner: Product + Architecture
Priority: P0
Date: 2026-06-20
Type: Umbrella PRD / build-from-zero charter
Pre-execution amendment state: settled for 121A/121B/121C execution after
peer-review convergence.

Related:

- `documentation/architecture/CONTEXT.md`
- `documentation/strategy/WhyClickeen.md`
- `documentation/ai/README.md`
- `documentation/ai/sanfrancisco.md`
- `documentation/services/bob.md`
- `documentation/services/roma.md`
- `Execution_Pipeline_Docs/02-Executing/121_Agentic_Framework/121A__PRD__Agent_Architecture.md`
- `Execution_Pipeline_Docs/02-Executing/121_Agentic_Framework/121B__PRD__San_Francisco_Orchestrator_And_Routing.md`
- `Execution_Pipeline_Docs/02-Executing/121_Agentic_Framework/121C__PRD__Product_Copilot_Real_Agent.md`
- `Execution_Pipeline_Docs/03-Executed/121_Agentic_Framework/121D__PRD__Translation_Agent.md`
- `Execution_Pipeline_Docs/02-Executing/121_Agentic_Framework/121E__PRD__Future_Internal_Agents_Scope.md`
- `Execution_Pipeline_Docs/02-Executing/121_Agentic_Framework/121F__PRD__SDR_Copilot_Future_Agent.md`
- `Execution_Pipeline_Docs/02-Executing/121_Agentic_Framework/121G__PRD__Learning_And_Outcomes_Foundation.md`
- `Execution_Pipeline_Docs/02-Executing/121_Agentic_Framework/121H__PRD__Ombra_Model_Strategy_And_Self_Hosted_Readiness.md`
- `Execution_Pipeline_Docs/03-Executed/085__PRD__San_Francisco_Agentic_Platform_Product_Strategy.md`
- `Execution_Pipeline_Docs/03-Executed/085C__PRD__San_Francisco_Customer_Facing_Agent_Ownership.md`
- `Execution_Pipeline_Docs/03-Executed/085D__PRD__San_Francisco_Internal_Agentic_Workforce_Boundary.md`

---

## 0. Current Product Law

Clickeen serves content.

That is the end product of websites, widgets, pages, emails, reports, feeds,
and future runtime surfaces.

Content in Clickeen has source authority:

1. Human-generated content: authored copy, pages, blogs, emails, widget text,
   support articles, and similar account content.
2. AI-generated content: content written by agents from human direction,
   account rules, brand rules, product rules, or approved system direction.
3. Integration-sourced content: reviews, feeds, listings, CRM rows, analytics,
   support data, aggregated records, and content pulled from another system.

Agents operate according to that source authority:

- For human-generated content, agents recommend improvements, propose edits,
  translate, optimize, restructure, and apply user-approved changes.
- For AI-generated content, agents may operate autonomously inside approved
  product rules because the content is already agent-produced under Clickeen
  direction.
- For integration-sourced content, agents do not rewrite the source truth. They
  may use, summarize, route, display, analyze, and build product experiences
  around it. They mutate it only through an explicit authorized integration
  write path.

Around the content, agents operate the Clickeen system itself: widgets, pages,
reports, analytics, support tickets, locale overlays, runtime packages, account
assets, routes, and storage folders. The codebase stays lean and structured so
agents can operate these artifacts directly through named authorities.

This is the difference from legacy SaaS. Clickeen does not build heavy product
code and bolt AI onto it. Clickeen structures content and the system around it
so agents can operate the product.

## 0.1 Current Runtime Truth

This PRD started as a build-from-zero charter. Current execution has moved the
series forward.

San Francisco is not the AI workforce operating system described in strategy
docs. It is a real and useful governed model-execution engine.

What exists today:

- Bob has a real AI-legible editor/action surface: widget specs, compiled
  controls, browser-memory instance state, validated edit operations, preview,
  and undo/apply machinery.
- Roma has real account/session/product authority: account context, tier/policy,
  routes, save/publish boundaries, and grant issuance.
- San Francisco has a real model-call spine: HMAC grant verification, runtime
  policy, provider/model execution, usage/errors, telemetry, and provider key
  custody.
- Product Copilot brain exists as a real Cloudflare Worker agent home.
- Translation Agent brain exists as a real Cloudflare Worker agent home.

Do not confuse the easy plumbing with the hard product.

Grant minting, provider routing, usage counters, policy envelopes, and typed
errors are necessary, but they are not the agent. They are table stakes.

They prove only that Clickeen can constrain an execution request. They do not
prove that Clickeen can understand a user, plan a useful turn, select the right
product capability, recover from ambiguity, or produce an outcome worth saving.

A correct grant is a permission check. A correct provider router is dispatch. A
correct validator is a safety boundary. None of those is intelligence.

The hard part is the agent operating the structured artifact:

- understand what the user is trying to do;
- decide whether this is conversation, guidance, product help, edit, strategy,
  account workflow, analytics, or something else;
- decide whether to answer, ask, suggest, apply, call an explicitly allowed
  product capability, or refuse;
- choose the relevant Clickeen context and capability;
- produce a valid action or useful answer;
- explain the result so the user keeps moving.

What still does not exist yet:

- runtime consumption of saved locale overlays;
- richer Bob translation operation display backed by the Translation Agent run;
- governed Product Copilot product-path smoke proof;
- internal agent workforce platform;
- production Ombra layer that is provider-agnostic and agentic end to end.

Therefore this PRD remains the series charter, but current execution truth is
owned by 121C, 121D, and
`Execution_Pipeline_Docs/03-Executed/121_Agentic_Framework/121PRD_Umbrella_to_121D_completeness.md`.

## 1. The Core Thesis

Clickeen's advantage is not that it has already built agents.

Clickeen's advantage is that agents should be much easier and safer to build
here because Clickeen is a **closed, AI-legible system**.

Clickeen's other core advantage is that published widgets are not daily app
sessions. Clickeen is not primarily a product people use all day. It is a
create/publish/update-occasionally product whose published widgets run
everywhere.

The biggest operational moat is that Clickeen can serve published widgets at the
edge through Cloudflare with very low marginal runtime cost.

That means widget visitor scale is not Ombra inference scale.

Published widgets must remain edge-served runtime artifacts. Visitor traffic
must not depend on live LLM calls.

Ombra usage is primarily authoring, optimization, translation, analytics,
recommendation, support, and internal/background work. That is much smaller than
published widget runtime traffic and can often be human-paced, queued, batched,
sampled, or scheduled.

Clickeen controls:

- product surfaces;
- service boundaries;
- widget specs;
- account artifact shapes;
- route contracts;
- edit operations;
- runtime policies;
- product documentation;
- San Francisco's AI execution path.

Generic SaaS agents waste model reasoning on orientation:

- What screen is open?
- What object is active?
- Where does data live?
- Which backend owns the change?
- What action is possible?
- Is the user allowed to do it?
- What happens if the action runs?

Clickeen should not make agents discover those answers.

Clickeen should provide the product map, allowed tools, valid action space, and
authority boundaries explicitly.

Core approach:

> Clickeen gives the agent the product map, the allowed tools, and the valid
> action space. The model uses its reasoning on the user, the task, the product
> outcome, and communication.

That is why the current regex/control matcher is the wrong center of gravity. It
uses brittle local pattern matching where Clickeen should have a real agent
reasoning over a structured closed system.

Product map, tools, and validation should constrain actions after reasoning.
They must not replace reasoning.

## 2. Non-Negotiable Product Law

The existing product law remains intact:

- Widgets are software.
- Instances are account-owned saved widgets.
- Bob edits one open widget instance in browser memory.
- Roma owns current account, account policy, account routes, save, publish, and
  product workflows.
- Tokyo-worker owns account runtime storage.
- Berlin owns authentication and account/session bootstrap.
- San Francisco owns the AI engine: provider custody, runtime policy, model
  execution, routing metadata, telemetry, and traces.
- Agent brains live in their own isolated Cloudflare homes when built. They do
  not live inside Bob UI code, Roma account routes, Tokyo storage paths, or
  generic San Francisco infrastructure.

Agents do not become product truth owners.

Agents do not directly mutate widget software, account defaults, product code,
Tokyo storage, account storage, or runtime files.

Agents act through product-owned tools and validated product actions.

Core product rule:

> Copilots may converse and reason broadly. Product-state changes must go
> through explicit, validated Clickeen actions owned by the correct product
> surface.

For Product Copilot in Bob:

- conversation can be broad;
- reasoning can be broad;
- the action surface is the open widget instance;
- Bob validates/applies in-memory edits;
- Roma owns account context and persistence;
- the Product Copilot brain lives in its own isolated Cloudflare worker/module;
- San Francisco executes model calls and enforces policy under grant.

## 3. Ombra, San Francisco, And Models

### 3.1 Ombra Is The Product AI Layer

Existing product/GTM docs describe **Ombra AI** as Clickeen's product-native AI
capability:

- purpose-built for widget content;
- structured, UI-ready output;
- natural-language editing;
- user control: accept, edit, override, reject, then publish by user decision.

This PRD should make Ombra real.

Ombra is what users experience as Clickeen AI.

Ombra is not one model.

Ombra is not one provider.

Ombra is not San Francisco itself.

Ombra is the Clickeen-shaped product AI layer built on:

- Clickeen context capsules;
- Clickeen tools;
- Clickeen action contracts;
- Clickeen validation;
- Clickeen product law;
- Clickeen learning/evaluation.

### 3.2 San Francisco Is The AI Engine, Not The Product Copilot Brain

San Francisco is real today as a model execution gateway.

It already has important platform primitives:

- provider key custody;
- grant verification;
- runtime policy enforcement;
- model/provider routing;
- provider errors;
- usage metadata;
- telemetry.

It is not yet the AI workforce OS.

This PRD settles a narrower first direction:

- San Francisco remains the AI engine: grants, provider custody, policy,
  model routing, model execution, traces, and outcomes.
- Product-specific agent brains live in isolated Cloudflare homes, one per
  agent when the Product Owner decides the agent exists.
- Product surfaces invoke agent brains and validate/apply returned actions
  through product-owned paths.
- Bob owns the interactive Builder loop because Bob owns the live browser-memory
  draft.
- Server-side agents may run server-side loops only when their tools/artifacts
  are server-side and product-owned.

The correction is not to pretend San Francisco already does this. The correction
is to keep San Francisco clean as the AI engine while giving each real agent a
clear home.

### 3.3 Models Are Interchangeable Under Ombra

The model/provider underneath Ombra may be:

- external hosted provider;
- self-hosted/Clickeen-hosted model;
- Clickeen-tuned focused model;
- hybrid routing across providers by task.

The user should not need to understand provider routing. The user uses Ombra.
For current 121 execution, San Francisco verifies the grant/policy and executes
the exact authorized model route.

Provider selection must not change the Clickeen action contract.

The same Clickeen-shaped task should keep the same product law whether it runs
on OpenAI, DeepSeek, Anthropic, Gemini, Groq, Cloudflare Workers AI, a VPS model,
or a future Clickeen-tuned model.

### 3.4 Clickeen-Hosted Inference Is Not Frontier-Model Ambition

Self-hosting is not about building OpenAI or Gemini.

Clickeen does not need a self-hosted model that knows everything.

The only strategic reason to consider self-hosted/Clickeen-tuned models is that
Clickeen may eventually have a proprietary closed-system learning loop from a
global widget network:

- millions of free and paid widgets;
- many widget types;
- many industries;
- many languages;
- many geographies;
- many page contexts;
- user accepts, edits, rejects, undos, saves, and publishes;
- visitor clicks, conversions, engagement, completions, and other allowed
  product outcomes.

If captured correctly, this can make Ombra spectacular at Clickeen-shaped work.

The compounding loop:

1. More widgets deployed.
2. More structured interaction and outcome data.
3. Better Ombra suggestions, edits, translations, recommendations, and agents.
4. Better widget performance and user success.
5. More widgets deployed.

This is the reason self-hosted/tuned models belong in the strategic option set.
Cheap inference alone is not the thesis.

## 3.5 Edge Runtime, Logs, And Async Learning

The most interesting long-term system is not live LLM inference on every widget
request.

The system should be:

1. **Runtime plane**
   - Published widgets are served globally from Cloudflare edge/runtime
     infrastructure.
   - Visitor requests and interactions do not call Ombra in the request path.

2. **Outcome/log plane**
   - Published widgets emit or accumulate structured usage facts where product
     law, consent, privacy, and retention allow.
   - Examples: impression, click, CTA click, form start, form completion,
     expand/collapse, locale, device bucket, geography bucket where allowed,
     page placement, widget type, widget config/version, publish timestamp, and
     conversion proxy signals where allowed.

3. **Learning/Ombra plane**
   - Async systems process logs and rollups.
   - Ombra learns from processed outcomes through evals, recommendations,
     prompt/model routing, training/tuning candidates, and internal agent
     artifacts.

This can run through queues, cron jobs, scheduled workers, rollups, sampling,
batch analysis, and review workflows. It does not need to be concurrent with
visitor traffic.

This distinction matters:

- widget runtime scale is edge-serving scale;
- Ombra inference scale is authoring/background/learning scale;
- learning scale comes from structured outcome logs, not live LLM calls;
- self-hosted/Clickeen-hosted inference can be useful for async bounded tasks
  even if it is not suitable for broad Product Copilot conversation.

Possible async learning jobs:

- daily/hourly widget performance rollups;
- pattern mining by widget type, industry, locale, layout, or placement;
- anomaly detection;
- recommendation generation;
- translation/localization quality review;
- output evaluation and regression datasets;
- prompt/model routing comparisons;
- Clickeen-specific learning example generation;
- future Clickeen-hosted/tuned model evaluation.

The strategic architecture:

> Cloudflare edge is the runtime distribution moat. Ombra is the intelligence
> layer. Agent brains live in isolated Cloudflare homes. San Francisco is the
> AI engine for inference, policy, routing metadata, and trace. The learning loop
> is asynchronous and governed.

## 4. Agent Taxonomy To Build

### 4.0 Agent Home Rule

All Clickeen agent brains must have one clear home.

Agent-specific reasoning must not be scattered through Bob components, Roma
routes, Tokyo storage code, or generic San Francisco infrastructure.

When an agent is approved for build, its brain owns:

- instructions and prompts;
- input contract;
- context/capsule handling;
- output schema;
- agent-specific reasoning flow;
- agent-specific trace metadata;
- eval fixtures and rubrics;
- agent-specific tool/action definitions from the agent's point of view.

Product surfaces still own product state and apply boundaries. Agent homes do
not become product truth owners.

First expected agent home:

```text
product-copilot Cloudflare worker/module
  -> calls San Francisco for model execution under grant/policy
  -> receives Bob/Roma context
  -> returns typed answer/action
```

Future agents follow the same organization only when the Product Owner decides
they become real agents.

### 4.1 Two User-Facing Copilots

#### Product Copilot

Product Copilot is the first and most important proof.

It lives inside the authenticated product. Bob Builder is the first surface.

Its brain should live in its own isolated Cloudflare home, not inside Bob UI
code and not as miscellaneous files inside generic San Francisco infrastructure.

Bob drives the interactive loop because Bob owns the live browser-memory widget
draft. Product Copilot's brain reasons per turn and returns typed answers or
actions. Bob validates and applies only reversible in-memory draft actions.
Roma persists only through existing account routes.

Product Copilot must:

- converse normally;
- understand messy human intent;
- guide the user toward useful Clickeen work;
- explain product/account/workflow state from product-owned truth;
- reason over Clickeen context;
- decide whether to answer, ask, suggest, call an explicitly allowed product
  capability, or return a validated action for Bob/product-owned apply;
- apply product changes only through the owning product surface.

It must not be reduced to visible-control matching.

#### SDR Copilot

SDR Copilot is the future public/funnel Copilot for Prague/Minibob.

It is a separate Copilot with different context, permissions, budget, success
metrics, and user relationship.

It should not inherit Product Copilot's account permissions.

### 4.2 Internal Agents

Internal agents are focused workers, not chatbots.

Translation Agent is the first concrete internal-agent candidate in this series.

Other internal agents are future scope. They should be named only when a real
product/workflow need is ready for its own PRD.

Each internal agent needs:

- owner;
- trigger;
- subject;
- input contract;
- output contract;
- allowed tools;
- runtime policy;
- review policy;
- cost policy;
- audit path.

Internal agents are simpler than Product Copilot because they do not need broad
human conversation. They should be built after the first real Product Copilot
proves the shared runtime shape, unless a narrow existing product job has to be
cleaned first.

### 4.3 Copilot And Internal Agent Relationship

Product Copilot should be able to use internal agents when relevant.

Example:

- User asks: "How many clicks did this widget get?"
- Product Copilot identifies this as analytics.
- It calls an analytics tool or Analytics Agent if allowed.
- The tool/agent returns governed output.
- Product Copilot explains the answer and suggests useful next Clickeen work.

Product Copilot should not hardcode every future analytics storage detail.

Product Copilot should receive an explicit map of current context and available
capabilities, then reason about which capability helps the user.

## 5. Scope

In scope for this umbrella:

- admit current runtime truth;
- define Ombra as product AI layer;
- define San Francisco as the AI engine for inference, policy, routing metadata,
  trace, and outcomes;
- define the agent home rule: one isolated Cloudflare home per real agent brain;
- define Product Copilot as the first real agent proof;
- define Copilots versus internal agents;
- define multi-provider and possible self-hosted inference options;
- define the closed-system context/tool/action strategy;
- expose build decisions and tradeoffs;
- define the downstream execution PRDs.

Out of scope for this umbrella:

- implementing Product Copilot;
- implementing SDR Copilot;
- implementing internal agents;
- implementing self-hosted inference;
- building a generic agent framework detached from Product Copilot;
- moving product truth into San Francisco;
- treating current regex/control matching as an agent brain;
- treating current San Francisco gateway as already being the workforce OS.

## 6. The Real Build Decisions

These are not decisions about evolving a mature agent platform.

These are decisions about how to build the first real Clickeen agent system from
the primitives that exist.

### OQ1 - Settled Topology For The First Product Copilot

This umbrella settles the first topology so 121A, 121B, and 121C do not guess
independently.

Product Copilot has three separate layers:

```text
Bob
  owns the interactive Builder loop, browser-memory draft state,
  draft apply/undo, and draft validation.

Product Copilot brain
  lives in its own isolated Cloudflare worker/module.
  Owns prompt/instructions, context handling, conversation state if used,
  output contract, agent-specific reasoning, trace metadata, and evals.

San Francisco
  owns provider keys, grant/policy enforcement, model routing, model execution,
  low-level trace/outcome plumbing, and provider/runtime errors.
```

Roma remains the account/session/grant/persistence authority. Tokyo-worker
remains durable account storage authority.

This means:

- Bob does not contain semantic intent logic or regex replacements pretending
  to be a brain.
- The Product Copilot brain does not own product truth or saved state.
- San Francisco does not become a hidden back-channel into Bob or Roma.
- San Francisco may be called by the Product Copilot brain for model execution
  under grant/policy.
- Bob applies only validated reversible draft actions.
- Roma persists only through existing account/product routes.

The first proof is not grant issuance, provider routing, or scoped value
generation. The first proof is a real Product Copilot brain with a clear home,
able to decide what kind of help/action the user needs, while product surfaces
validate and apply the resulting actions.

Follow-on decision:

- Conversation/thread ownership for Product Copilot must be decided in 121C.
  Preferred direction: keep San Francisco stateless per model call. The isolated
  Product Copilot home or Bob/Roma-owned product surface should pass the
  conversation needed for each turn.

### OQ2 - What is the first shared execution envelope?

Need:

- `agentId`;
- caller surface;
- subject: account user, anonymous visitor, internal service;
- target artifact: widget instance, page, asset, analytics scope, support case,
  internal job;
- account/session policy from product owner;
- allowed tools/actions;
- model/runtime policy from grant;
- context capsules;
- output mode;
- trace/session ids;
- parent execution id for agent-to-agent calls;
- cost/budget ceiling;
- risk/review requirement.

Options:

1. **Per-agent payloads only**
   - Simple, but agent-to-agent and tooling will drift.

2. **Shared envelope plus agent-specific payload**
   - Likely right. Common orchestration metadata plus typed agent-specific
     input/output.

3. **Universal task schema**
   - Too abstract for day zero; risks fake framework.

Current leaning:

- 121A/121B define the first execution envelope.
- The envelope may share orchestration metadata.
- Agent payloads remain agent-specific.
- Extract only proven infrastructure pieces into contracts.

### OQ3 - What context does Product Copilot receive?

#### Option A - Current message plus visible controls

This is close to current behavior.

Reject as the main model. It cannot produce a real Product Copilot.

#### Option B - Full raw product state

Gives maximum context, but creates cost/privacy/noise risk and encourages the
agent to reason over details it should not own.

#### Option C - Product-owned context capsules

Bob/Roma provide compact, typed capsules:

- open widget instance summary;
- widget type and goal where known;
- editable action surface;
- visible/hidden controls summary;
- current preview/page purpose where available;
- save/dirty/publish/embed state;
- account tier/limits/locales from Roma;
- allowed tools/actions;
- recent Copilot thread state.

Current leaning:

- Option C.
- Context capsules should answer orientation questions before the model runs.
- The model should reason about user intent and outcome, not discover product
  state.

### OQ4 - What tools/actions exist first?

Product Copilot first-action candidates:

- answer conversationally;
- explain Builder/account workflow;
- summarize current widget;
- propose widget-instance changes;
- apply validated in-memory widget-instance ops;
- explain why an action is unavailable;
- ask clarification;
- call a future analytics/recommendation tool when it exists.

Internal-agent action candidates:

- produce review artifact;
- translate explicit items;
- analyze analytics inputs;
- propose changes;
- draft support/GTM/copy output;
- request human review;
- emit no-op with explicit reason.

Options:

1. **Hardcoded tools inside each agent**
   - Fast, but repeats current if/then failure at larger scale.

2. **Product-surface tool manifests**
   - Product surfaces expose the tools allowed for this context. The agent
     brain can request only those tools/actions, and the owning product surface
     validates/applies them.

Current leaning:

- Product-surface tool manifests for product actions.
- Shared typed-tool conventions only where repeated.
- San Francisco does not execute product mutations. It may execute model calls
  and record trace/outcome metadata under policy.

### OQ5 - How can agents call other agents?

Options:

1. **No agent-to-agent calls initially**
   - Simple, but Product Copilot cannot become the front door to internal
     specialist work.

2. **Explicit named child-agent calls**
   - Product Copilot can call an allowed internal agent by name.

3. **Opaque planner chooses tool/agent**
   - Powerful later, too magical now.

Current leaning:

- Explicit named child-agent calls, after Product Copilot and the first internal
  agent/tool justify it.

Guardrails to decide:

- max call depth;
- max fanout per user turn;
- child-agent grant derivation;
- child usage/cost attribution;
- partial failure behavior;
- trace visibility to Copilot and user.

### OQ6 - How does Product Copilot see internal agent work?

Options:

1. **Direct result only**
   - Copilot sees only what it called.

2. **Product/workflow-owned artifacts**
   - Internal agents produce artifacts owned by the relevant product/workflow.
     Copilot can read allowed summaries.

3. **San Francisco ledger as product activity**
   - Reject as default. San Francisco telemetry must not become product truth.

Current leaning:

- Product/workflow-owned artifacts.
- San Francisco may keep execution telemetry.
- User-facing activity truth belongs to product/workflow owners.

### OQ7 - How should multi-LLM and Ombra inference work?

Ombra is the product AI layer. This question is about the inference backends San
Francisco may use under Ombra.

Options:

1. **Provider hardcoded per agent**
   - Reject. Violates provider-agnostic requirement.

2. **Runtime policy chooses provider/model**
   - Agent declares task needs; signed policy constrains providers/models.

3. **Clickeen-hosted inference as one provider class**
   - Possible for narrow Clickeen-shaped tasks after evals prove quality.

4. **Hybrid routing**
   - Different task classes may use different providers: broad conversation,
     routing, copywriting, translation, analytics explanation, eval/judge,
     internal QA.

5. **Hybrid Ombra routing by local-model fitness**
   - Treat self-hosted/Clickeen-hosted inference as a strong candidate for
     tasks that are private, bounded, structured, repetitive, and low/medium
     reasoning.
   - Treat hosted frontier models as the likely default for broad conversation,
     long context, deep correctness, multi-step reasoning, taste-heavy work,
     and quality-critical Product Copilot turns.
   - Pros: matches the real local-model tradeoff; exploits Clickeen's ability
     to make many tasks bounded; keeps sensitive/high-volume tasks eligible for
     local/Clickeen-hosted inference; avoids provider ideology.
   - Cons: needs routing policy, task classification, evals, operational
     maintenance, and latency/capacity planning.

Current leaning:

- Runtime policy plus hybrid Ombra routing by task class.
- Preserve Clickeen-hosted inference as a provider class.
- Do not make self-hosting a day-zero dependency.
- Do not make hosted frontier providers the permanent architecture assumption.
- Route by measured task fitness, not preference:
  - local/Clickeen-hosted candidates: turn classification, tool selection,
    structured output checks, repetitive text transforms, first-pass summaries,
    artifact summaries, bounded copy variants, eval/judge passes, private
    account/product inputs where quality is proven;
  - hosted frontier candidates: broad Product Copilot conversation, ambiguous
    intent, long context, high-taste copy, complex planning, deep product
    correctness, and high-risk user-facing answers.
- Self-hosted inference is an operational surface: model/backend updates,
  model release testing, storage, capacity, latency, GPU/driver/runtime issues,
  API compatibility, performance drift, monitoring, and exact-route failure
  handling must be part of any execution PRD that introduces it.

### OQ8 - What does learning/improvement mean?

This is the hardest long-term problem.

Execution is not learning.

An edit applying successfully does not prove it was good. An answer being sent
does not prove it helped. A published widget does not prove which agent choice
caused the outcome.

Learning options:

1. **No foundational learning framework yet**
   - Capture only usage/errors.
   - Simple, but misses the AI-native compounding advantage.

2. **Hosted-model prompt/eval learning**
   - Curate examples and improve prompts/playbooks/model routing.

3. **Clickeen-specific learning corpus**
   - Capture structured examples: context capsule, tool choice, output,
     validation result, user decision, downstream outcome.

4. **Clickeen-hosted/tuned model path**
   - Use corpus to train, tune, distill, or evaluate smaller models for
     Clickeen-shaped tasks.

5. **Global widget-network learning moat**
   - Treat deployed widgets as the long-term learning engine where product law,
     consent, privacy, and retention allow.
   - This is an async/batch/rollup learning system, not live model inference in
     the widget visitor path.

Current leaning:

- Start with Clickeen-specific structured examples and outcomes.
- Use them first for evals and prompt/model selection.
- Product Copilot's acceptance eval suite is owned by 121C and built with the
  first Product Copilot implementation.
- 121G owns shared trace/outcome/eval plumbing and vocabulary. 121C does not
  wait for 121G to be complete; it can start from canned traces and live turn
  records, then integrate richer 121G plumbing as it lands.
- Preserve Clickeen-hosted/tuned models as a real future provider path.
- Treat the global widget-network learning loop as the strategic north star.
- Keep published widget runtime edge-served and AI-independent; use logs,
  rollups, queues, cron, sampling, and governed async jobs for learning.

Learning requirements:

- distinguish execution events from learning outcomes;
- capture accepted/edited/undone/saved/published/ignored/rejected where the
  owning product surface can know it;
- connect outcomes to agent version, model, prompt/playbook, context capsule,
  tool call, validation result, and product surface;
- separate analytics, billing, privacy, and learning uses;
- keep raw learning payloads bounded and governed;
- never silently mutate production prompt/model/tool behavior from raw outcomes;
- promote changes through review, eval, release, and rollback.
- do not confuse observable runtime traffic with permission to use it for
  learning; product law, consent, privacy, retention, and customer trust decide
  which signals can enter the learning system.

### OQ9 - What requires human review?

In-memory reversible Bob edits:

- Product Copilot may apply validated edits to the unsaved working copy.
- User still controls Save.

Durable/internal work:

- internal agents should produce reviewable artifacts before customer-visible,
  irreversible, billing/account, public publishing, legal/compliance, or
  external-communication impacts.

Current leaning:

- no heavy approval gate for reversible in-memory Builder edits;
- explicit review artifacts for high-impact durable/internal work.

### OQ10 - How does the framework avoid fake abstraction?

Bad path:

- build a universal agent framework before the first real agent exists;
- create registries, planners, dashboards, and memory systems with no real
  Product Copilot proof;
- keep the regex helper and call it an agent;
- celebrate grant/model plumbing as if it were agent intelligence;
- treat validation, policy, metering, or provider dispatch as proof that the
  product can reason.

Good path:

- use this umbrella as the guardrail;
- build Product Copilot first;
- extract shared framework only from real repeated needs;
- delete or rename masquerade paths that pretend to be agents;
- keep validation as product safety, not as the Copilot's mind.

## 7. Product Copilot First Proof

The first execution PRD under this umbrella should build Product Copilot as the
first real Clickeen agent.

It must prove:

- normal conversation;
- open-ended intent understanding;
- Clickeen guidance;
- Bob/Roma context capsules;
- isolated Product Copilot brain home;
- provider-agnostic San Francisco model execution;
- action/tool manifest;
- validated in-memory widget edits;
- explicit ask/suggest/apply/refuse behavior;
- no regex/control matcher as agent brain;
- day-one Product Copilot acceptance evals owned by 121C;
- trace/outcome hooks for future learning.
- proof that Product Copilot can choose among answer, ask, suggest, validated
  draft action, tool call when allowed, and refusal from user intent and
  Clickeen context.

The current Builder Copilot flow is not accepted as product architecture.

Its code may contain candidate mechanical pieces to audit and reuse, but none
of them are automatically preserved. They are candidate constraints and product
integration mechanics, not proof that the current product has an agent:

- Bob's generic widget op validation/apply machinery;
- Bob's browser-memory session apply path;
- Bob's undo mechanics for applied ops;
- Roma's account-scoped AI grant issuance and San Francisco forwarding helper;
- San Francisco's `/execute` gateway, grant verification, model selection,
  provider call path, usage metadata, and telemetry spine;
- shared policy/model catalog primitives where they fit the new envelope.

The current regex/control matcher, current edit-only Copilot UI flow, current
`resolved_edit | multi_op_plan` envelope, and current San Francisco widget
copilot executor must not define the product-agent architecture.

The useful safety idea is that product actions validate through Bob/Roma. The
bad idea is making that validator the whole Copilot worldview.

## 8. AI Engine And Agent Home Build Path

San Francisco should stay clean as the AI engine while real agent brains get
their own homes.

Build path:

1. **Gateway spine** - current deployed execution utility.
   - grants, providers, policy, usage, telemetry.
   - This is transport and constraint infrastructure, not an agent brain.

2. **Agent home rule** - one isolated Cloudflare worker/module per real agent
   brain.
   - Product Copilot first.
   - Agent-specific prompts, contracts, output schemas, evals, and reasoning
     code live in the agent home.

3. **Product Copilot brain** - real reasoning over Clickeen context and tools.
   - ask/answer/suggest/apply/call/refuse.
   - Bob drives the interactive edit loop and validates/applies draft actions.
   - San Francisco executes the model call under policy.

4. **Tool/action contracts** - product-surface manifests and validated product
   actions.
   - Product surfaces apply product actions.
   - San Francisco does not mutate product state.

5. **Server-side agent homes** - explicit future agents where tools/artifacts
   are server-side and product-owned.

6. **Future internal agent guardrails** - architecture must allow focused
   workers without pretending they are Product Copilot.

7. **SDR Copilot guardrails** - architecture must allow a separate future
   user-facing sales/acquisition agent without sharing Product Copilot logic.

8. **Learning/eval substrate** - structured outcomes, shared eval plumbing,
   routing improvements, possible Clickeen-hosted model path.

9. **Ombra model strategy** - provider independence and self-hosted readiness
   without making self-hosting a day-zero dependency.

Stages 6 through 9 exist now as architecture guardrails. They are not build-now
implementation commitments.

## 9. Downstream PRDs

This umbrella should produce or replace these PRDs:

1. **121A - Agent Architecture**
   - Define the architecture rails for agents and agent homes.
   - Keep shared scope infrastructure-only.
   - Do not define one generic Copilot behavior.

2. **121B - San Francisco AI Engine And Routing Boundary**
   - Define San Francisco as AI engine: model execution, policy, routing
     metadata, trace, and outcomes.
   - Define model-execution boundaries without making San Francisco a
     product-state owner or tool router.
   - Make clear routing is not raw-text regex matching.

3. **121C - Product Copilot Real Agent**
   - Build the first hard user-facing product agent.
   - Define the isolated Product Copilot Cloudflare home.
   - Replace regex/control matcher as the brain.
   - Define Bob/Roma context, capabilities, validated draft actions, trace, and
     the Product Copilot acceptance eval suite.

4. **121D - Translation Agent**
   - Define the first focused internal artifact workflow/agent.
   - Prove the architecture supports non-Copilot workers without importing
     Product Copilot behavior.

5. **121E - Future Internal Agents Scope**
   - Future-scope guardrail.
   - Ensure architecture does not hardcode every agent as Product Copilot.

6. **121F - SDR Copilot Future Agent**
   - Future-scope guardrail.
   - Ensure SDR Copilot remains separate from Product Copilot.

7. **121G - Learning And Outcomes Foundation**
   - Future-scope guardrail with day-one trace/outcome requirements.
   - Ensure future learning is possible without silent self-mutation.

8. **121H - Ombra Model Strategy And Self-Hosted Readiness**
   - Future-scope guardrail.
   - Ensure provider independence and self-hosted readiness without building
     self-hosted inference on day one.

The current Builder Copilot Real Agent Rebuild PRD should be rewritten or
superseded under this umbrella.

The Workforce Agents Architecture Scaffolding PRD should be rewritten or
superseded as a downstream internal-agent PRD, not treated as the umbrella.

## 10. Anti-Goals

Do not:

- claim Clickeen has real agents today;
- claim San Francisco is already the AI workforce OS;
- preserve regex/control matching as the Product Copilot brain;
- treat grants, provider routing, usage metering, or typed errors as the hard
  part of the agent system;
- build a generic agent framework detached from Product Copilot;
- scatter agent brains across Bob, Roma, Tokyo, or generic San Francisco files;
- move product truth into San Francisco;
- let agents mutate product state without product-owned tools;
- let San Francisco telemetry become product activity truth;
- let internal jobs masquerade as customer-facing Copilots;
- hardcode agents to one LLM provider;
- make self-hosting a day-zero dependency;
- treat self-hosting as building a general frontier model;
- put live LLM calls in the published widget visitor request path;
- confuse published widget scale with concurrent Ombra inference scale;
- silently learn/mutate production behavior from raw outcomes;
- use observable widget/user signals for learning without product law, privacy,
  consent, retention, and governance decisions.

## 11. Acceptance Criteria For This Umbrella

This umbrella PRD is acceptable only if it makes the following clear:

- current shipped "agents" are not real agents;
- current San Francisco is a gateway/spine, not the completed platform;
- the first real build is Product Copilot;
- real agent brains have isolated Cloudflare homes;
- the Product Copilot brain is isolated from Bob UI code and generic San
  Francisco infrastructure;
- Bob owns the interactive Builder loop and draft apply/undo/validation;
- San Francisco is the AI engine for inference, policy, model routing metadata,
  trace, and outcomes;
- Ombra is the product AI layer, not a model;
- Clickeen's closed, AI-legible system is the core advantage;
- product surfaces remain truth/tool/action owners;
- multi-provider and Clickeen-hosted inference remain architectural options;
- learning is the hardest long-term problem and must be governed;
- Cloudflare edge runtime scale and Ombra inference scale are separate planes;
- global widget-network learning is async/log/rollup driven, not live request
  inference;
- downstream PRDs must build missing reality, not polish existing masquerade.

## 12. Current Recommended Direction

Recommended first wave:

1. Approve this umbrella as the build-from-zero charter.
2. Execute 121A Agent Architecture.
3. Execute 121B San Francisco AI engine/routing boundary.
4. Execute 121C Product Copilot as the first hard user-facing agent proof,
   including its isolated Cloudflare brain home and day-one eval suite.
5. Execute 121D Translation Agent as the first focused internal-agent proof.
6. Keep 121E/121F as future-scope guardrails, not build-now commitments.
7. Keep 121G shared trace/outcome/eval foundation without making 121C wait on
   the full learning foundation.
8. Keep 121H model/provider/self-hosted readiness without making self-hosting a
   day-one dependency.
9. Preserve Bob in-memory validation and Roma persistence boundaries.
10. Keep provider/model routing under San Francisco/Ombra policy.
11. Add outcome hooks for future learning without claiming autonomous learning is
   built.
12. Keep published widget runtime AI-independent; plan learning through
   structured logs and async processing.
