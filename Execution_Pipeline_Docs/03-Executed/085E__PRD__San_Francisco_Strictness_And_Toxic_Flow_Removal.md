# PRD 085E - San Francisco Strictness And Toxic Flow Removal

STATUS: EXECUTED - 2026-05-06

Parent: `085__PRD__San_Francisco_Agentic_Platform_Product_Strategy.md`

This PRD removes hidden AI success behavior and product-toxic San Francisco flows before building more platform on top.

It should execute before the other 085 child PRDs.

This is the highest-priority 085 execution PRD because it removes active bad behavior before adding any platform surface.

---

## 1. Product Goal

San Francisco must be strict at the AI/product boundary.

For customer-facing copilots:

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

Every customer-facing copilot returns one of:

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

Use the existing San Francisco -> Roma -> Bob error/message path unless a shared type becomes necessary later. Do not introduce a new cross-service result framework in this slice.

San Francisco must not pretend an invalid model response is a useful successful answer.

One bounded same-model repair retry is allowed and must be metered. If that repair also fails, San Francisco returns visible failure instead of fake success. Cross-provider fallback is not allowed for customer-facing editor agents.

Execution decision: do not build a broad AgentResult framework in this pass. The current Roma/Bob path is enough:

- Roma calls San Francisco through `roma/app/api/account/instances/[publicId]/copilot/route.ts`.
- If San Francisco fails, Roma returns a chat-message-shaped response.
- Bob already displays that message in the Copilot pane.
- A valid clarification remains the existing structured copilot response with a message and no ops.
- Invalid-output failure should reuse this user-facing copy: "I had trouble generating a structured edit. Please try again, or ask for one specific change (e.g. \"translate the FAQs to French\")."

Therefore 085E should change San Francisco strictness, not the cross-service response shape.

### 4.2 Delete Temporary Multipliers

Temporary edit-budget multipliers should be deleted.

Limits belong in `AgentRuntimePolicy`.

If a bigger edit budget is needed for a specific entitlement or agent, it must be explicit policy, not a hidden multiplier.

PRD 085B already removed the Builder copilot `devMultiplier`; 085E only verifies no hidden multiplier residue remains.

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

Deletion ownership:

- PRD 085E owns Builder copilot fail-soft parsing and fake-success behavior.
- PRD 085E owns the rule that shared-secret paths are not product runtime.
- PRD 085C owns `sdr.copilot` deletion.
- PRD 085D owns `l10n.instance.v1` -> `widget.instance.translator` rename.
- PRD 085D owns personalization/onboarding and `sf.command` deletion.

---

## 5. Deletion Targets

- No-op assistant responses created from invalid model output.
- Fail-soft parser branches.
- Residual temporary edit-policy multipliers.
- Product-like `CK_INTERNAL_SERVICE_JWT` paths.
- String-equality internal auth patterns copied into product paths.
- Generic command envelopes with no real command-bus need.
- Docs that describe hidden fallback as product behavior.

Do not execute the 085C/085D deletion list from this PRD. 085E may report those residues, but it only owns strictness/fake-success cleanup.

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

Builder copilot changes real widget config. If San Francisco hides invalid output, Bob/Roma cannot trust the copilot boundary.

This PRD makes San Francisco compatible with the Clickeen product truth: one real authoring path, strict schemas, no silent healing.

---

## 9. Execution Readiness Checklist

Before execution:

- Identify fail-soft parser branches.
- Identify temporary multipliers.
- Identify residual shared-secret product-like routes.
- Identify internal auth checks that should be deleted or made tooling-only.
- Typed result shape decision: no broad framework in this pass; strict San Francisco errors are acceptable for invalid model output.
- User-facing failure behavior decision: Roma/Bob already show a clear chat message through the existing error path; invalid model output must not be a fake assistant success.
- User-facing invalid-output copy is fixed: "I had trouble generating a structured edit. Please try again, or ask for one specific change (e.g. \"translate the FAQs to French\")."
- Clarification UX decision: no new UX treatment in this pass. A valid clarification is the existing message-with-no-ops response.
- Same-model repair decision: one bounded, metered same-model repair retry is allowed before visible failure.

Execution is green only when:

- invalid model output no longer becomes fake success
- same-model repair remains bounded and metered, with visible failure after repair failure
- temporary multipliers are deleted or moved into explicit runtime policy
- product-like shared-secret paths are removed or tooling-only
- internal auth residue is not copied or strengthened into a product boundary
- generic envelopes are deleted unless justified
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
- `rg` residue checks for deleted parser/fallback/multiplier names
- smoke test: Builder copilot handles success and typed failure
- git-based Cloudflare deploy after implementation
