# PRD 128 — Clickeen Agent Runtime Foundation

Status: **EXECUTING — RELEASE PAUSED FOR SYSTEMIC CORRECTIONS; 128F RECONCILIATION MUST BE RERUN**

Owner: Clickeen product owner/architect

Date: 2026-08-12

## 1. Purpose

Build the first complete runtime foundation for real Clickeen agents and move
the two current agents onto it.

Clickeen currently has exactly two runtime agents:

- Product Copilot;
- Translation Agent.

The current shared AI plane provides governed one-shot model calls. Product
Copilot then asks the model to encode its entire turn in a custom six-kind JSON
response. That is useful model plumbing, but it is not a complete agent
infrastructure because the model cannot request an action, observe the exact
result, and continue reasoning.

PRD 128 installs this operating cycle:

```text
agent-owned messages and context
-> San Francisco governed model turn
-> normal text or typed tool call
-> owning product authority executes the tool
-> exact tool result returns as an observation
-> next governed model turn or explicit completion
```

### AI-Native Product Law

Clickeen is an AI-native, agent-operated product built by AI and structured for
AI operation from first principles. PRD 128 is not an AI feature added to a
human-operated SaaS workflow. It establishes the runtime seam through which
named agents can reason over structured Clickeen truth, request typed product
capabilities from the authority that owns that truth, observe the exact result,
and continue or complete explicitly.

The human product owner/architect retains product direction, architecture,
policy, and final authority. Agent homes own their operational reasoning and
tools. San Francisco owns governed model execution. Bob, Roma, Tokyo-worker,
and the other named services retain their deterministic product authorities.
The AI SDK supplies execution mechanics only. PRD 128 must not move product
truth into chat, make a human-only UI workflow the agent contract, or insert a
model into deterministic product commands.

## 2. Product Outcome

After PRD 128:

- Product Copilot is an interactive Builder agent rather than a one-shot JSON
  response parser;
- normal language streams as normal language;
- Product Copilot requests exact typed Builder tools;
- Bob executes those tools against the open browser-memory draft;
- Product Copilot observes exact results before it claims completion;
- Translation Agent uses the same governed model-turn engine while preserving
  its focused server-side translation operation;
- San Francisco remains Clickeen's only model-execution authority;
- OpenAI and DeepSeek execution runs through the AI SDK inside San Francisco;
- a future self-hosted Ombra route can be added at San Francisco without
  rewriting either agent or the product authorities they use.

## 3. Pre-GA Hard-Cut Law

Clickeen is pre-GA. PRD 128 is a clean replacement, not a migration program.

Forbidden:

- old and new Product Copilot protocols operating together;
- feature flags selecting the old JSON envelope;
- dual `/model/chat` and new model-turn callers after release;
- duplicate handwritten and AI SDK provider execution;
- response aliases or compatibility parsing;
- silent provider/model fallback;
- deployment of one incompatible half as a completed release;
- retaining obsolete code because an old test depends on it.

The sub-PRDs are implementation slices in one branch. They are not separate
production releases. The branch deploys only after every current caller is
converted and every old agent-execution path owned by this PRD is removed.

The existing Cloudflare surfaces do not deploy atomically: Workers deploy
sequentially and Bob/Roma Pages deploy independently. Therefore “one hard cut”
means one source end state and one exact-SHA roll-forward release window, not an
instantaneous infrastructure switch. While surfaces are mixed, both agent
features are deploying/unavailable and no product verification runs. Mixed
runtime is never called partially live and no compatibility path is added to
hide it.

## 4. Authority Map

| Boundary | Authority |
| --- | --- |
| Product Copilot instructions, Builder context, tools, and reasoning loop | Product Copilot agent home |
| Translation instructions, protected-content handling, locale operation, and overlay result | Translation Agent home |
| Open Builder draft, draft-tool execution, preview, dirty state, and undo | Bob |
| Current account/instance authorization, grant minting, tier/usage policy, and Save | Roma |
| Grant verification, exact model policy, provider credentials, budgets, model execution, usage, and provider errors | San Francisco |
| Provider-call, stream, native tool-call/result, finish-reason, and structured-output mechanics | AI SDK bundled inside San Francisco |
| Saved locale overlay write | Translation Agent through Tokyo-worker |
| Saved Widget source/package | Roma through Tokyo-worker on explicit user Save |

The AI SDK is internal plumbing. It is not Vercel hosting, a new service,
product authority, agent home, tool owner, or policy source.

## 5. Named Coordinates

### Product surface

- Bob Product Copilot pane for the open Builder session;
- Roma current-account Product Copilot route;
- Roma saved-instance Translation workflow;
- Translation Agent Worker operation.

### Account/session coordinate

- Product Copilot operates the exact current user, account, instance, and open
  Bob browser session carried by Roma-authorized context;
- Translation Agent operates the exact account, instance, base locale, and
  requested active target locales carried by its existing operation.

### Storage coordinate

- Product Copilot creates no server-side draft or conversation storage;
- Bob draft remains browser memory;
- user Save continues through Roma to the current account instance coordinate;
- Translation Agent continues writing exact locale overlay files through
  Tokyo-worker;
- PRD 128 creates no R2, D1, KV, queue, database, or server-side active-turn
  authority.

### Route/API boundary

- replace San Francisco's agent-facing `/model/chat` with version 1 of
  `POST /model/turn`;
- replace Product Copilot's one-shot response with streamed text/tool events and
  explicit tool-result continuation;
- preserve Roma as the account-facing boundary;
- preserve Translation Agent's product operation boundary while replacing its
  internal model call;
- leave San Francisco's Prague `/l10n/translate` route outside PRD 128.

### Runtime/deploy surface

- San Francisco Worker;
- Product Copilot Worker;
- Translation Agent Worker;
- Roma Pages Functions/app;
- Bob Pages app;
- shared contracts and policy packages required by those surfaces;
- DevStudio only if the final implementation genuinely changes its existing
  LLM Management files. Its current per-agent, per-tier policy already owns the
  required values and does not need a replacement UI.

### Verification surface

- San Francisco focused tests and Worker dry run;
- Product Copilot contract/eval and live Bob flow;
- Translation Agent eval and live overlay flow;
- Roma/Bob focused tests and builds;
- exact-SHA GitHub/Cloudflare deploy evidence;
- independent V1–V8 audit.

## 6. Common Agent Law

Every current agent keeps its own:

- purpose;
- instructions;
- context;
- available tools or structured result;
- loop ownership;
- stop conditions;
- product success definition.

Only the following shared behavior is extracted:

- governed model messages;
- streamed text where requested;
- native tool-call and tool-result representation;
- structured-output representation where requested;
- finish reason;
- provider/model usage;
- cancellation and explicit errors.

There is no universal agent personality, shared product logic, generic tool
marketplace, runtime agent discovery, agent mesh, or agent-to-agent protocol.

## 7. Execution Sequence

| Slice | Purpose | Depends on | Release rule |
| --- | --- | --- | --- |
| 128A | Define exact agent-turn and authority contract | Parent | Established product decisions recorded before runtime code |
| 128B | Preflight provider metadata, then install AI SDK model-turn execution in San Francisco | 128A | Must not replace adapters until raw provider truth is proven; must not release until both callers migrate |
| 128C | Rebuild Product Copilot around native tools | 128A, 128B | Inseparable implementation unit with 128D |
| 128D | Complete Bob/Roma tool-result interaction | 128C | Inseparable implementation unit with 128C |
| 128E | Move Translation Agent to the shared model-turn engine | 128A, 128B | Must preserve current translation product truth |
| 128F | Remove old paths, update current docs, deploy, and verify | 128B–128E | One exact-SHA hard cut |

Why this order:

1. Clickeen defines its contract before a library's defaults can define it.
2. San Francisco first proves the pinned SDK exposes exact OpenAI and DeepSeek
   model/usage/finish/tool truth, then gains model-turn capability before agent
   homes depend on it.
3. Product Copilot owns the tools and reasoning shape before Bob/Roma transport
   is finalized.
4. Bob/Roma completes the observation loop through existing product authority.
5. Translation Agent proves the foundation supports a different real agent.
6. Old contracts are deleted and the complete program is released together.

Runtime code starts from the established decisions recorded in 128A: the
current DevStudio tier policy remains authoritative; Bob's Manual and Copilot
modes remain exclusive; Bob owns the active request and browser-memory draft;
Stop aborts that request; Translation Agent behavior is preserved; engineering
tests prove exact behavior while the human product owner judges Copilot's
usefulness in the live Builder.

## 8. Code Work

The executing branch may change only the sources required by the six slices:

- AI SDK dependencies and lockfile;
- shared agent/model-turn contracts;
- San Francisco model execution;
- Product Copilot agent home and evals;
- Bob Product Copilot session/UI/tool execution;
- Roma Product Copilot authorization/transport;
- the existing shared policy only as required by the model-turn contract;
- no DevStudio LLM Management rewrite is expected merely to reuse its current
  per-agent, per-tier turn/token/timeout values;
- Translation Agent model execution and evals;
- relevant focused tests and current documentation.

The implementation must start from current behavior and delete obsolete code in
the same branch. It must not create a second framework beside the current
authorities.

## 9. Product-Data Work

No broad product-data work and no active-turn migration.

PRD 128 does not authorize:

- account data mutation;
- migration of saved Widget instances;
- translation overlay rewrites unrelated to live verification;
- conversation history persistence;
- training-data capture;
- provider/model policy expansion beyond what the two current agents require.

Live Product Copilot verification stays in browser memory and uses Undo unless
the product owner separately authorizes Save. Live Translation verification may
write one exact overlay through Roma, Translation Agent, and Tokyo-worker. The
release checklist must name the account, instance, locale, prior overlay state,
authorized expected write, and exact restore/reconciliation action before that
mutation begins.

## 10. Deploy And Runtime Work

Use the existing Cloudflare/GitHub deployment authorities. Do not add deployment
machinery.

The hard cut requires:

- one intended commit lineage on `main`;
- one frozen release SHA with no additional `main` push until the workflow and
  independent Pages deployments are terminal, because the Worker workflow can
  cancel an in-progress run;
- exact SHA on San Francisco, Product Copilot, Translation Agent, Roma, and
  Bob, plus DevStudio, Berlin, or Tokyo-worker only when the final changed-path
  set triggers those existing deployment surfaces;
- all required service bindings and existing provider secrets present;
- no new provider or Cloudflare topology;
- live proof for both agents after every affected surface is at the exact SHA.

This is roll-forward deployment. If one surface fails while the release is
mixed, stop verification and roll forward the missing surface(s); do not
independently restore an old endpoint/caller. If the fully deployed release
fails, either fix forward at one new SHA or revert the complete PRD 128 change
in one commit and redeploy every affected surface.

## 11. Documentation Work

Planning documents describe approved future direction. During implementation,
current `documentation/ai/`, `documentation/services/bob.md`,
`documentation/services/roma.md`, and `documentation/services/devstudio.md`
change only with the runtime behavior they describe.

Execution evidence belongs at the bottom of the applicable PRD 128 document.
Do not place chronological execution logs between normative requirements.

## 12. Explicitly Outside PRD 128

- self-hosted Ombra inference;
- new model providers beyond OpenAI and DeepSeek;
- model training or fine-tuning;
- customer/visitor training-data capture;
- visual browser tooling or `agent-browser`;
- durable/cross-session Copilot memory;
- a new queue, Durable Object, WebSocket, D1, KV, R2, or relational active-turn
  store;
- agent-to-agent routing;
- new runtime agents;
- Prague localization or `/l10n/translate` redesign;
- public Widget runtime changes.

## 13. Program Acceptance Criteria

- Product Copilot streams normal text.
- Product Copilot can request an exact typed Builder tool.
- Bob executes its ordered WidgetOp batch atomically against the open
  browser-memory draft.
- Exact tool success or failure returns to Product Copilot as an observation.
- Product Copilot can perform a subsequent governed model turn and finish.
- A failed tool is not described as completed.
- Preview, dirty state, undo, and explicit Save still work through their current
  authorities.
- Product Copilot's custom six-kind JSON envelope and malformed-response retry
  are removed.
- The released foundation is agent-native: named agent homes operate typed
  Clickeen capabilities through existing authorities and receive exact results
  as observations; it is not a chat layer over hidden human workflows.
- Translation Agent preserves exact locale/value/write behavior on the new
  San Francisco execution seam.
- OpenAI and DeepSeek agent execution use AI SDK provider plumbing only.
- Provider/model unavailability fails visibly without substitution.
- Agent homes contain no provider credentials or provider-specific calls.
- No active-turn storage or orchestration authority is introduced.
- Current documentation matches the deployed system.
- Exact-SHA live evidence exists for both current agents.
- Deterministic Product Copilot tool/state/failure checks and Translation Agent
  regression checks pass; live Product Copilot usefulness remains the product
  owner's judgment in the real Builder.
- Independent V1–V8 audit passes.

## 14. Status

| Slice | Status |
| --- | --- |
| 128A | Contract defined; established decisions recorded |
| 128B | Step 0 preflight PASS; implementation complete; 47 gate tests pass |
| 128C | Implementation complete; old protocol deleted; 12 stream tests pass |
| 128D | Implementation complete; transport + cancellation built; typecheck clean |
| 128E | Implementation complete; 14 eval + worker test pass; typecheck clean |
| 128F | Prior source reconciliation is historical; release paused and reconciliation must be rerun after owner-directed correction passes |

## Execution Record

128B, 128C, 128D, and 128E implementation remains complete. The product owner
paused release for systemic correction passes, so 128F's prior source
reconciliation is historical evidence rather than proof for the current working
tree. See the per-slice Execution Records in those sub-PRDs. 128F remains
pending a fresh complete gate, separately authorized commit/deploy, exact-SHA
evidence, live verification, and independent V1–V8 audit. Append further
verified implementation and release evidence to the relevant sub-PRD Execution
Record; do not place chronological execution logs between normative
requirements.
