# PRD 085E - San Francisco Strictness And Toxic Flow Removal

STATUS: PRE-EXECUTION DISCUSSION

Parent: `085__PRD__San_Francisco_Agentic_Platform_Product_Strategy.md`

This PRD removes hidden AI success behavior and product-toxic San Francisco flows before building more platform on top.

It should execute before the other 085 child PRDs.

This is the highest-priority 085 execution PRD because it removes active bad behavior before adding any platform surface.

---

## 1. Product Goal

San Francisco must be strict at the AI/product boundary.

For customer-facing agents:

- valid structured output applies
- valid clarification is shown as clarification
- invalid output fails as a typed failure
- no hidden no-op success
- no silent fallback across quality/cost classes
- no temporary policy multiplier outside named runtime policy
- no product path depends on shared-secret glue

---

## 2. Surviving Product Owner

The product surface owns user-visible behavior.

San Francisco owns:

- structured AI execution
- output validation
- typed failure/clarification classification
- provider/model enforcement
- usage metering

San Francisco does not own:

- silently healing invalid AI into acceptable product state
- temporary product limits
- hidden account access decisions
- product-like shared-secret routes

---

## 3. Runtime Boundary

Every customer-facing agent returns one of:

- typed success
- typed clarification
- typed failure

Invalid model output is not converted into a fake assistant message.

Invalid output should be:

- recorded
- metered
- visible to the caller
- eligible for learning/eval

---

## 4. Approach

### 4.1 Remove Fail-Soft Parsing

Replace fail-soft parsing with strict results.

Target shape, if a shared type is needed:

```ts
type AgentResult<T> =
  | { kind: "success"; data: T }
  | { kind: "clarification"; message: string }
  | { kind: "failure"; reasonKey: string; detail?: string };
```

The caller decides how to show the result.

San Francisco must not pretend an invalid model response is a useful successful answer.

Execution decision: do not build a broad AgentResult framework if the existing route error channel is enough. For Builder copilot, invalid model JSON should fail visibly through the existing San Francisco/Roma error path. A valid clarification remains a normal structured copilot response with no ops.

### 4.2 Delete Temporary Multipliers

Temporary edit-budget multipliers should be deleted.

Limits belong in `AgentRuntimePolicy`.

If a bigger edit budget is needed for a specific entitlement or agent, it must be explicit policy, not a hidden multiplier.

### 4.3 Remove Shared-Secret Product Glue

Shared-secret paths are allowed only as explicitly documented local/cloud-dev tooling.

They must not carry account product runtime.

If an internal shared-secret check remains temporarily for tooling, do not polish it into product architecture. The current string-equality bearer-token pattern should be treated as deletion/to-tooling-only residue, not copied into new paths.

Surviving product paths must use:

- signed grants
- real account authz
- private worker bindings/queues for internal execution

### 4.4 Delete Generic Envelopes Without Real Need

Generic command wrappers should be deleted if they exist only for unrelated one-off commands.

Use a simple typed contract unless a real command bus exists with shared middleware and multiple commands.

The `/v1/outcome` envelope mismatch was fixed by PRD 085A. The remaining `SanfranciscoCommandMessage` / `sf.command` envelope survives only for personalization/onboarding. It must be deleted when personalization/onboarding is deleted in 085D.

No new generic command bus should be introduced.

---

## 5. Deletion Targets

- No-op assistant responses created from invalid model output.
- Fail-soft parser branches.
- Temporary edit-policy multipliers.
- Product-like `CK_INTERNAL_SERVICE_JWT` paths.
- String-equality internal auth patterns copied into product paths.
- Generic command envelopes with no real command-bus need.
- Docs that describe hidden fallback as product behavior.
- Active `l10n.instance.v1` naming after the translator rename decision.
- Active personalization/onboarding shared-secret route/job residue.

---

## 6. Blast Radius

Likely code areas:

- `sanfrancisco/src/ai/chat.ts`
- `sanfrancisco/src/agents/*`
- `sanfrancisco/src/grants.ts`
- `sanfrancisco/src/index.ts`
- `packages/ck-contracts/src/ai.ts`
- Roma Builder copilot caller code
- tests/fixtures for copilot output
- `packages/ck-policy/src/ai-runtime.ts`
- docs that still describe old San Francisco agent IDs or shared-secret product routes

Potential behavior changes:

- invalid AI output becomes visible failure/clarification
- callers may need to render typed failure
- tests expecting fake no-op success must change

No widget storage, asset storage, or account entitlement storage should change.

---

## 7. Why This Is World-Class SaaS

Customer-facing AI must be deterministic at the boundary.

Best practice is:

- validate model output
- reject invalid output
- meter failures
- improve through evals
- never hide invalid output as success

This protects user trust and makes quality measurable.

---

## 8. Why This Is Right For Clickeen

Clickeen's architecture is built on strict widget contracts and fail-fast state.

Builder copilot changes real widget config. If San Francisco hides invalid output, Bob/Roma cannot trust the agent boundary.

This PRD makes San Francisco compatible with the Clickeen product truth: one real authoring path, strict schemas, no silent healing.

---

## 9. Execution Readiness Checklist

Before execution:

- Identify fail-soft parser branches.
- Identify temporary multipliers.
- Identify residual shared-secret product-like routes.
- Identify internal auth checks that should be deleted or made tooling-only.
- Typed result shape decision: no broad framework unless required; strict San Francisco errors are acceptable for invalid model output.
- User-facing failure behavior decision: Roma/Bob show a clear chat message; invalid model output must not be a fake assistant success.
- Rename decisions are set: `l10n.instance.v1` -> `widget.instance.translator`, Prague translation -> `website.prague.copy.translator`.

Execution is green only when:

- invalid model output no longer becomes fake success
- temporary multipliers are deleted or moved into explicit runtime policy
- product-like shared-secret paths are removed or tooling-only
- internal auth residue is not copied or strengthened into a product boundary
- generic envelopes are deleted unless justified
- remaining `sf.command` is deleted with personalization/onboarding or explicitly scoped only until 085D execution
- tests cover success, clarification, and failure
- residue checks pass

---

## 10. Verification

Required:

- `./node_modules/.bin/tsc -p sanfrancisco/tsconfig.json --noEmit`
- relevant `packages/ck-contracts` checks
- Roma caller checks if result shape changes
- tests for valid output
- tests for clarification
- tests for invalid output failure
- `rg` residue checks for deleted parser/fallback/multiplier names and renamed/deleted agent IDs
- smoke test: Builder copilot handles success and typed failure
- git-based Cloudflare deploy after implementation
