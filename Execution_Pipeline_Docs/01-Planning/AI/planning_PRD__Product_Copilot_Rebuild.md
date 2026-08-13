# Planning PRD — Product Copilot Rebuild

Status: PARTIALLY PROMOTED TO EXECUTION — CORE REBUILD IS PRD 128

Owner: Product + Product Copilot + Bob + Roma

Last updated: August 2026

Related execution program:

`Execution_Pipeline_Docs/02-Executing/128__Clickeen_Agent_Runtime_Foundation/`

## 1. Purpose

Product Copilot must become a real interactive Clickeen agent instead of a
one-shot model call whose entire answer is forced through a custom JSON
envelope.

This is not an AI assistant bolted onto an otherwise human-operated Builder.
Product Copilot must operate Bob's existing structured draft authority through
typed tools, observe the exact result, and continue reasoning. Bob's UI remains
the human product surface; it is not a substitute for an agent-operable product
contract.

The core text/tool/observation rebuild is executing in PRD 128. Visual context,
training-data capture, and other later capabilities remain planning and require
their own authorization.

## 2. Current Product Truth

The current Product Copilot flow is approximately:

```text
user request in Bob
-> Roma authorizes the current account and instance
-> Product Copilot builds one prompt
-> San Francisco performs one governed model call
-> model returns text intended to be a six-kind custom JSON response
-> Product Copilot parses and validates that response
-> one bounded malformed-response retry may occur
-> Bob applies valid draft operations in browser memory
-> turn ends
```

The current six output kinds are `answer`, `clarification`, `suggestion`,
`draft_edit`, `refusal`, and `error`.

The current architecture has useful truths worth preserving:

- Product Copilot has its own agent home.
- Roma owns current-account authorization, model selection validation, grant
  minting, and usage authority.
- San Francisco owns governed model execution and provider credentials.
- Bob owns the open Widget draft, preview, dirty state, undo, and application of
  valid Widget operations.
- Product Copilot never writes Tokyo or publishes.
- Persistence occurs only when the user explicitly saves through Roma.

The following current statements are not target product law:

- Product Copilot's current quality is not good enough.
- Its one-shot prompt/response behavior is not a quality baseline.
- Its six-kind JSON envelope is not permanent agent infrastructure.
- Its malformed-JSON retry is not a capability to preserve.
- Berlin does not validate Product Copilot Widget operations. Product Copilot
  checks returned operations against caller-supplied control truth and Bob owns
  application to browser memory.
- Draft operations are not merely "proposed and never applied." Bob applies
  valid operations immediately to the open browser-memory draft; they are not
  persisted until Save.

## 3. Target Product Experience

Product Copilot should converse normally and operate the current Builder draft
through native typed tools.

```text
user message
-> Product Copilot reasons over the open Builder context
-> model streams normal text or requests a typed Builder tool
-> Bob executes that tool against exact browser-memory draft truth
-> Bob returns the exact result or error
-> Product Copilot observes it and reasons again
-> Product Copilot responds or requests another tool
-> turn completes explicitly
-> user saves separately through Roma when satisfied
```

Example:

```text
User: Move pricing first and shorten every answer.

Product Copilot -> apply_widget_ops({ ordered move + answer edits })
Bob -> exact atomic batch result and changed paths
Product Copilot -> streams a concise completion message
```

The agent observes what actually happened. It does not claim success based on
operations it merely emitted.

Bob already separates Manual and Copilot into mutually exclusive ToolDrawer
modes. An active Copilot request belongs to the Copilot mode; Manual controls
are not simultaneously active. While Copilot is working, Send becomes Stop.
Stop ends that exact Bob-owned interaction, asks Roma to abort its exact active
in-page request, prevents another continuation from being sent, and ignores
later events from the stopped request. This does not require a server-side
active-turn database or a draft merge policy.

## 4. Structure At The Correct Boundaries

Structure remains essential:

- the control catalog defines operable paths and value shapes;
- WidgetOps remain Bob's native draft-operation representation where they fit;
- model tools have typed input schemas;
- tool results are typed observations;
- grants and usage are structured;
- saved Widget artifacts remain structured.

What changes is that an entire turn is no longer forced into one custom JSON
object. Normal language remains model text. Product action crosses a native
tool-call boundary at the moment action is required.

## 5. Authority Map

| Concern | Authority |
| --- | --- |
| Product Copilot instructions, context construction, tools, and reasoning loop | Product Copilot agent home |
| Open Builder draft, tool execution, preview, dirty state, undo | Bob |
| Current account, instance authorization, grant minting, tier/usage policy, Save | Roma |
| Governed model turn, provider credentials, exact provider/model policy, budgets | San Francisco |
| Provider-call, stream, native tool-call/result mechanics | AI SDK inside San Francisco |
| Saved instance source/package | Roma through Tokyo-worker |

Product Copilot does not save, publish, write Tokyo, mint grants, hold provider
credentials, or move browser-memory draft ownership to a server.

San Francisco does not own Product Copilot instructions, conversation state,
Builder tools, tool execution, or product mutations.

## 6. Core Rebuild Promoted To PRD 128

PRD 128 owns:

- a provider-independent San Francisco model-turn interface;
- streaming text and explicit completion/error events;
- native typed tool calls and tool-result messages;
- one `apply_widget_ops` tool projected directly from Bob's existing ordered
  WidgetOp contract, including coherent atomic multi-field batches;
- removal of the six-kind Product Copilot JSON envelope;
- removal of the malformed-response retry;
- Product Copilot's bounded reasoning loop;
- Bob execution of exact Builder draft tools;
- tool results returned as observations;
- Roma authorization/grant/usage transport;
- preservation of the current tier-specific AI policy exposed in DevStudio;
- natural Copilot conversation, with internal tool execution and completion
  stated only after Bob returns the exact result;
- adoption of the same San Francisco foundation by Translation Agent;
- a pre-GA clean hard cut with no compatibility path.

## 7. Later Capabilities Not In PRD 128

### Visual context

Product Copilot may later need rendered visual context. That requires a concrete
browser/runtime design for the Cloudflare and Bob environment. A native CLI
cannot be assumed to run inside a Worker. This capability requires a separate
PRD and is not necessary for the text/tool/observation loop.

### Training-data capture

No current product path records complete accept/reject/correct outcomes as a
training dataset. Training capture requires explicit decisions for source
authority, privacy, consent/opt-out, retention, storage, deletion, and access.
It is not a side effect of installing the AI SDK.

### Long-lived conversation memory

PRD 128 keeps Product Copilot state with the open Bob session. Durable or
cross-session conversation memory requires proven product need and a separately
named storage authority.

### Additional agents and agent-to-agent work

The current runtime has exactly two agents. A future agent gets its own home,
product purpose, context, tools, and execution PRD. PRD 128 does not construct
a generic agent mesh.

## 8. Product Acceptance Direction

The core rebuild succeeds when:

- normal responses stream as text rather than custom response JSON;
- Product Copilot can request an exact Builder tool;
- Bob executes it against the browser-memory draft;
- Product Copilot receives the exact tool result and can continue reasoning;
- failed tool execution remains visible and cannot become a success claim;
- preview, dirty state, undo, and explicit Save retain their authorities;
- Product Copilot contains no provider-specific code;
- the current six-kind envelope and malformed-response retry are removed;
- deterministic checks prove exact allowed operations, exact resulting draft
  truth, no extra paths, rejection behavior, Undo, and Save separation;
- the existing direct-provider `real-eval.ts` path is replaced by evaluation
  through Product Copilot and San Francisco's governed model-turn authority;
- the human product owner evaluates whether Product Copilot is useful by using
  it in the real Builder; automated scores do not become product authority;
- no visual, training, memory, or multi-agent machinery is added by implication.

The detailed implementation sequence and release gates are in PRD 128.
