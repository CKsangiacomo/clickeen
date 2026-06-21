# Peer Review C - 121C Product Copilot Real Agent

Reviewer: Codex, staff-engineer lens
Date: 2026-06-20
Scope: `121C__PRD__Product_Copilot_Real_Agent.md`
Verdict: Pass on product direction; not execution-ready until the first turn contract is concrete.

---

## 0. Second-Pass Runtime Evidence

This review was rechecked against:

- `bob/lib/copilot/controlContract.ts`
- `bob/components/CopilotPane.tsx`
- `roma/app/api/account/instances/[instanceId]/copilot/route.ts`
- `roma/app/api/account/instances/[instanceId]/copilot/outcome/route.ts`
- `roma/lib/ai/account-copilot.ts`
- `sanfrancisco/src/agents/widgetCopilotCore.ts`
- `sanfrancisco/src/agents/csWidgetCopilot.ts`

Verified runtime truth:

- Bob currently runs local deterministic turn and edit-scope logic before the
  model call: `resolveBobCopilotDeterministicTurn` and
  `resolveBobCopilotEditScope` in `controlContract.ts`, called from
  `CopilotPane.tsx`.
- The local logic contains regex/domain branches and visible-control matching.
  That is the behavior 121C must remove from the agent-brain path.
- Roma validates the Builder Copilot envelope, checks route instance id and
  widget type against the current Tokyo instance, mints the
  `cs.widget.copilot.v1` grant, then forwards to San Francisco `/v1/execute`.
- San Francisco currently parses a `BuilderCopilotRequestEnvelope` with
  `turnClass: resolved_edit | multi_op_plan`, validates controls, calls the
  model, then validates returned ops against visible controls.
- Outcome attach is already present through Roma
  `/copilot/outcome` -> San Francisco `/v1/outcome`, but the Roma route returns
  HTTP 200 for invalid/skipped outcome reporting so user flow is not blocked.

Second-pass correction: 121C must not merely remove `controlContract.ts` by name.
It must replace the whole pre-model semantic routing shape: `turnClass`,
`resolvedTarget`, scoped controls chosen by Bob regex/alias matching, and
edit-only output expectations. Product facts and explicit UI selection are fine;
semantic intent must move into the real agent turn.

## 0b. Best-Practice Research Lens

Product Copilot is the place where Clickeen should actually use an agent loop.
The task is open-ended: the user may ask for help, complain, joke, request an
edit, ask what the widget does, ask how to improve it, or ask a product question.
Current best practice says this is exactly where model reasoning belongs; fixed
regex routing belongs only around deterministic guardrails, not semantic intent.

Best-practice alignment:

- The model should understand the user turn and choose a typed response/action
  from a product-owned schema. Bob should not pre-decide meaning with aliases or
  regexes.
- Tool/action calls should be declared with schemas and constrained to reversible
  Builder draft operations, product facts, and visible product capabilities.
- Input/output/tool guardrails should reject unsafe, unsupported, or invalid
  operations visibly. Save/publish remains product/user confirmation, not model
  authority.
- The first Product Copilot should be one agent, not a manager that calls
  specialist agents. Handoffs add prompt, trace, approval, and failure surfaces.

Required PRD tightening:

- Define the V1 output union: conversational answer, clarification question,
  draft edit proposal/applied draft op, unsupported/refusal, and error.
- Define the allowed V1 tools/actions in Clickeen terms, with Bob validation as
  the tool guardrail and Roma persistence outside the agent.
- Require traces for intent reasoning, tool calls, validation failures, and user
  acceptance/undo/save outcomes, while treating docs as reference context rather
  than runtime product truth.

## 0c. Pre-GA / No Back-Compat Lens

This is the file most affected by the Pre-GA lens. Product Copilot should not be
rebuilt while preserving behavior compatibility with `controlContract.ts`.

Pre-GA amendment:

- Delete the fake-brain path rather than supporting it as a legacy mode.
- Remove Bob-side semantic routing, regex intent classification, alias matching,
  and preselected `resolvedTarget` as Product Copilot brain inputs.
- Replace the old envelope with one that lets the real agent reason over the
  user turn, product context, selected widget instance, visible draft state, and
  allowed tools/actions.
- Keep only product facts and hard UI facts from Bob. Do not keep Bob's current
  interpretation of what the user meant.

The absence of back compat is a product advantage here. It lets Clickeen avoid
shipping two Copilots: one real and one fake. The slice should cut over cleanly,
with tests proving the new Product Copilot path and no hidden fallback to regex
masquerade.

## 1. Elegant Engineering And Scalability

The PRD gets the product shape right:

- Product Copilot is the first real hard agent.
- It is broad and conversational.
- It lives inside Bob/Roma product work.
- It replaces `controlContract.ts` as the brain.
- Product-state changes still go through Bob/Roma validation.
- San Francisco executes/orchestrates without owning Bob state or Roma account
  truth.

That is scalable because product surfaces provide real product facts and allowed
actions, while the agent brain spends reasoning on the user's turn.

The important architectural vector is:

```text
Bob/Roma know the product state
-> San Francisco runs Product Copilot reasoning
-> Product Copilot returns typed answer/action
-> Bob validates and applies only reversible draft edits
-> user saves through existing Roma flow
```

## 2. Compliance To Architecture, Product Law, And Tenets

The PRD is compliant with the major product laws:

- the model does not mutate saved account/product state;
- Bob owns in-memory draft state;
- Bob validates draft edit operations;
- Roma owns persistence/account authority;
- San Francisco does not own product truth;
- regex/control matching is rejected as the agent brain.

Corrections needed for strict compliance:

- "product docs/context where available" must distinguish runtime truth from
  reference material. Runtime facts come from Bob/Roma capsules. Docs may be
  bounded informative context, not product truth.
- "call another agent when allowed" must be disabled in the first slice. Product
  Copilot can be architected to support child agents later, but V1 should not
  implement that path.

## 3. Overarchitecture Or Unnecessary Complexity

The PRD currently names the right behavior, but not the shippable contract.

Without a concrete first slice, teams may build:

- generalized context systems;
- doc retrieval;
- analytics tools;
- child-agent routing;
- universal tool registries;
- learning loops;
- generic agent framework code.

That would repeat the platform-before-proof failure.

The first slice should be narrow:

```text
one canonical Product Copilot agent id
one Bob/Roma context capsule
one San Francisco invocation path
one typed output union
one validated draft-edit action path
visible ask/answer/suggest/refuse behavior
no regex semantic pre-routing
```

## 3b. Academic / Meta-Work / Gold-Plating Risks

Words like "reasoning", "context capsule", "capabilities", and "governed
result" are correct, but they can become taxonomy work.

The proof must be product behavior:

- A user can write a normal open-ended message.
- Product Copilot can respond conversationally.
- Product Copilot can ask for clarification.
- Product Copilot can suggest a useful Builder change.
- Product Copilot can apply a valid unsaved draft edit.
- Product Copilot can refuse or explain inability.
- None of that depends on hidden regex/control matching before reasoning.

Do not prove agenthood with diagrams, registries, or trace shape alone.

## 4. Why This Is Simple And Boring

This is simple if it stays close to existing Clickeen authority:

1. Bob provides draft/session facts.
2. Roma provides account/session authority and grant.
3. San Francisco runs one known agent.
4. The agent returns a typed result.
5. Bob validates draft edits.
6. User controls Save.

That is boring and correct. It removes the fake brain while preserving the
working product law.

## 5. Required Corrections Before Execution

Required:

- Define canonical agent id and migration path from current
  `cs.widget.copilot.v1`.
- Define whether the existing `BuilderCopilotRequestEnvelope` is replaced or
  versioned, because its current `turnClass`/`resolvedTarget` shape encodes the
  old pre-routed edit workflow.
- Define exact invocation envelope:
  - account/session authority from Roma;
  - Bob draft/context version;
  - widget type;
  - instance id;
  - selected control only if explicit;
  - available actions;
  - unavailable capabilities;
  - trace/request id.
- Define typed output union:
  - `answer`;
  - `clarification`;
  - `suggestion`;
  - `draft_edit`;
  - `refusal`;
  - `error`.
- Explicitly disable child-agent calls in V1.
- Explicitly disable tool calls in V1 except validated draft-edit action.
- Ban local semantic regex/control matching before agent reasoning. Bob may
  provide deterministic product facts and explicit UI selection; it must not
  infer user meaning through hidden pre-routing.
- Ban Bob-selected scoped controls as a prerequisite for model reasoning unless
  the user explicitly selected a UI control.
- Define validation failure behavior:
  - rejected op;
  - stale capsule;
  - missing required context;
  - oversized context;
  - unavailable provider;
  - malformed model output.
- State that failures must be visible as ask/refuse/error, not claimed as
  success.
- Clarify draft edit consent: immediate unsaved apply is allowed only through
  Bob's reversible in-memory path with visible undo and no persistence.

## 6. V1-V8 Audit

- V1 Silent substitution: Watch. Missing context and malformed output behavior
  must be explicit.
- V2 Silent healing: Pass. The PRD does not repair saved state.
- V3 Silent omission: Watch. First output union and failure behavior are still
  missing.
- V4 Fail-open control: Watch. Tool/child-agent paths must be disabled or
  explicitly policy-gated.
- V5 Corruption-as-absence: Watch. Stale/malformed context must not become an
  empty/default capsule.
- V6 Partial-success masquerade: Watch. Rejected draft edits must be surfaced.
- V7 Masquerade/redress: Pass. Regex brain is explicitly rejected.
- V8 Runtime test dependency: Pass. No runtime path depends on test rituals.
