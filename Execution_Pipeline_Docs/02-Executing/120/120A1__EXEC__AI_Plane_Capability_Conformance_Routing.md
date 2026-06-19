# 120A1 - EXEC - AI Plane: Capability Registry, Conformance, Typed Errors, Routing

Status: EXECUTING ACTIVE SCOPE - CODE COMPLETE, AUTHENTICATED BROWSER VERIFICATION BLOCKED — revised 2026-06-09 after the three-perspective
pre-execution review (PM / TPM / Dev Manager)
Owner: San Francisco plane
Parent: `120A__PRD__San_Francisco_AI_Plane_Role_And_Contract.md` (120A-1 slice)
Review authority: `120R__REVIEW__Peer_Review_And_Execution_Augmentation.md`
(PR-1..PR-15; decisions D1–D9 and Q1–Q6 — all ratified 2026-06-09; round-2 review
fixes applied same day)

Execution amendment applied on 2026-06-18:

- This EXEC is **not approved as written**. Execute the minimum 120A1 slice needed for
  Builder Copilot Operator: remove model-id string heuristics from provider requests,
  stop sending unsupported OpenAI parameters, and map provider failures to product-safe
  typed errors.
- Do not execute conversion mode, route-class routing, escalation, failover, translator
  re-base, durable budgets, or workforce-agent telemetry in this slice.
- Capability data is allowed only as the source for provider request construction and
  picker eligibility. It must not become a runtime validation ritual.
- The stale translation-queue premise is removed. Do not add a queue to satisfy this
  document.

Decisions consumed (ratified):

- **D1:** two providers — OpenAI current-generation + DeepSeek. Model IDs are
  registry data, never code. This spec names no model IDs by design.
- **D3:** provider-call proof is deploy/build evidence. No keys in CI; no runtime
  dependency on tests or probes.
- **D6:** picker ships; runtime eligibility = policy ∧ explicit callable
  capability data. Conformance reports are release evidence only; user pick
  never silently overridden.
- **D8:** cascade routing + declared recorded failover is deferred beyond this slice.
- **D9:** translator re-base is deferred. Do not touch translation generation in 120A1.
- **Q3:** `freeform` never reaches the plane in this slice. Bob handles deterministic
  non-edit responses; 120A1 does not add Advice.
- **Q4:** zero interim work on the live Copilot; this refactor is the fix.

## Execution Contract

One step at a time; green = named completion evidence; blocker report stops
execution; NOT_ALLOWED is binding. **All `rg` guards are scoped to code directories**
(`packages/ sanfrancisco/ roma/ bob/ admin/ tokyo-worker/ berlin/`) — planning docs
and executed PRDs legitimately contain the guarded strings and are never in scope.

## The three plane atoms (do not merge them)

```text
capability  CAN we call this model correctly?   packages/ck-contracts/src/model-capabilities.ts
policy      MAY this agent/tier use it?         packages/ck-policy/ai-runtime.matrix.json
routing     DEFERRED for this slice. 120A1 does not add route classes, escalation, or
            failover unless a concrete Operator requirement proves it is needed.
```

**Registry location and type-derivation mechanism (Dev N1 — resolves both the
circular dependency and the TS-literal trap):** the registry lives in
**ck-contracts** beside `ai.ts` (ck-policy depends on ck-contracts, so a ck-policy
home could never feed the provider type). It is a **TypeScript const file**, not
JSON — a `.json` import widens to `string` and cannot yield a literal union:

```ts
// packages/ck-contracts/src/model-capabilities.ts
export const MODEL_CAPABILITIES = [ /* profiles */ ] as const
  satisfies readonly ModelCapabilityProfile[];
export type AiProvider = typeof MODEL_CAPABILITIES[number]['provider'];
```

ck-contracts exports the derived provider type and catalog helpers; ck-policy
imports them for policy and callable-capability eligibility. Conformance reports
are evidence records only and must not become a runtime condition.

## Schemas

For the amended 120A1 slice, only `ModelCapabilityProfile` is executable scope. Routing,
conversion, escalation, and turn-class material are deferred beyond this slice and must
not be implemented here.

```ts
interface ModelCapabilityProfile {
  provider: string; // derived union exported from the registry
  modelId: string;
  uiLabel: string; // user-facing; requires Pietro sign-off (Step 0)
  endpointFamily: string;
  tokenParam: string;
  reasoning: { supported: boolean; values?: string[]; default?: string | null };
  temperature: { supported: boolean; max?: number };
  structuredOutput: { jsonMode: boolean; jsonSchema: boolean };
  streaming: boolean;
  retry: { retryableStatuses: number[]; maxRetries: number };
  eligibility: { userPicker: boolean; durableAgents: boolean };
  baseUrlEnvVar?: string; // every adapter gets a base-URL override (test injection)
  apiKeyEnvVar: string; // Dev N2: provider→key mapping lives here, not in
  // adapter string comparisons — required for the
  // 'deepseek'-literal guard to be reachable
  profileVersion: string;
  conformance: {
    status: 'unverified' | 'passed' | 'failed';
    lastRunAt?: string;
    reportRef?: string;
  };
}

// Routing/conversion/turn-class schemas are deferred beyond amended 120A1.
// Normal Builder execution must not depend on tests, probes, helper validation,
// or freshness rituals to proceed.
```

**DEFERRED - Escalation semantics (the handshake, both sides):** escalation is **SF-internal**.
SF schema-validates the model's structured output (ops JSON shape) before returning;
on invalid shape it escalates once per `escalation` and re-calls within the same
request (fresh per-call token budget; counts as one turn). Bob's post-hoc op
validation (paths/types/indexes) does **not** trigger re-requests — a Bob-side
rejection is a user-visible typed failure. No client-driven escalation loop exists.

**Typed errors extend the existing atom:** the `AI_*` codes join
`packages/ck-contracts/src/reason-keys.ts` (one error-code registry — no second
taxonomy). Existing codes (`PROVIDER_ERROR`, `GRANT_INVALID`, `BUDGET_EXCEEDED`) are
mapped/renamed there in one pass. The error envelope carries a **structured
`upstreamStatus` field** — required because `sanfrancisco/src/ai/chat.ts:44-65`
currently regex-parses the status out of the message string for retry decisions;
quarantining upstream text (Step 5) would silently break retryability otherwise.

**Adapter call contract (Step 4):** adapters take per-call structured-output
requirements from the caller (the agent), not hardcoded — `openai.ts:152` currently
bakes a translation-specific JSON schema (`TRANSLATION_RESPONSE_FORMAT`) into every
call including Copilot turns; the rebuild parameterizes it.

## Steps

Amended execution scope for this pass:

- Execute provider request construction from explicit model capability data.
- Execute product-safe typed provider errors.
- Execute picker eligibility from signed policy plus explicit callable capability
  data. Proof/conformance metadata is evidence only.
- Do not execute original rows 6-7 as written; routing, conversion, translator matrix
  rewrites, Prague markers, and durable-agent telemetry are deferred.

| Step | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Completion evidence                                                                                                                                                                                                                                                                                                                                                                                                                                           | NOT_ALLOWED                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------ |
| 0    | Provider lineup sign-off: query each configured provider model list with existing keys; propose picker-eligible candidate registry entries including `uiLabel` strings; Pietro signs off the provider/model labels before implementation. | Signed-off candidate registry entries committed in this spec. | Hardcoding model IDs outside the registry; shipping unapproved `uiLabel`s; expanding into routing scope in this slice. |
| 1    | Runtime proof + schema: add direct conformance proof fixtures for `sanfrancisco/` and `packages/ck-policy/` without package `test` scripts or Turbo `test` wiring. Define `ModelCapabilityProfile` types + registry `packages/ck-contracts/src/model-capabilities.json` with Step 0 candidates (`unverified`); ck-contracts exports the derived provider type.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Direct proof fixtures run explicitly; types + registry diff; typecheck green.                                                                                                                                                                                                                                                                                                                                                                                 | Capability fields in the policy matrix; a hand-maintained provider union anywhere; package `test` scripts; Turbo `test` wiring.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2    | `scripts/ai/conformance.mjs`: calls each declared model with declared params; writes `conformance` block + dated report per model; prune failures.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Committed reports for every surviving model; failed candidates removed.                                                                                                                                                                                                                                                                                                                                                                                       | Mock conformance; `passed` without a real call; keeping failed models.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 3    | DEFERRED/REMOVED FROM ACTIVE SCOPE: no CI freshness gate for picker eligibility in this slice. Provider-call proof is release evidence, not a runtime dependency and not a normal product-work gate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | No runtime code depends on proof freshness or `proofRef`; no CI validator added in this slice.                                                                                                                                                                                                                                                                                                                                                                | Runtime picker eligibility depending on tests, probes, proof freshness, `proofRef`, or validation rituals.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 4    | Registry-driven adapter rebuild for the active Builder Copilot provider path (both providers): construct requests from capability profiles; per-call structured-output parameter (kills Copilot's old translation-schema hardwiring); base-URL override for OpenAI (DeepSeek has one). PR-15 deletions in active scope: `AI_MODEL_CATALOG` (ck-contracts), provider/model string heuristics, duplicate provider unions on the Copilot/Roma grant path, `assertProviderConfigured` provider comparisons in account-widget l10n diagnostics, and provider-literal envelopes in adapters. **Scope note:** legacy Prague string translation still references `OPENAI_MODEL`; Prague/translator cleanup is explicitly deferred by rows 7 and the Deferred Translator Regression Gate and must not be pulled into this Builder Copilot slice. **Admin disposition:** `admin/src/main.ts` imports `listAiModelCatalog`/`labelAiModel` — re-point both at the registry's `uiLabel` (minimal change; coordinates with the in-flight DevStudio migration, do not refactor further).                                                                                                                                                                                           | Scoped guards: `rg "startsWith\('gpt" sanfrancisco/src/providers sanfrancisco/src/ai sanfrancisco/src/agents/widgetCopilot*` → 0; `rg "AI_MODEL_CATALOG" packages/ sanfrancisco/ roma/ bob/ admin/` → 0; active adapters pass conformance; repo typecheck green (admin included).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | New provider/model literals in the active Builder Copilot provider path; per-model if-ladders; breaking admin typecheck; pulling Prague translation or translator generation work into this slice.                                                                                                                                    |
| 5    | Typed errors: `AI_*` codes added to `reason-keys.ts`; envelope with structured `upstreamStatus`; upstream bodies telemetry-only; `chat.ts` retry logic moved onto `upstreamStatus` (regex deleted).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Negative fixture (via base-URL override): distinctive upstream payload string reaches telemetry, never the response body; retry test green on simulated 429.                                                                                                                                                                                                                                                                                                  | Raw upstream text in any product-facing message; a second error-code registry.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 6    | DEFERRED: routing, failover, escalation, conversion mode, and turn-class routing are not part of amended 120A1. | No code changes in this slice. | Do not implement route classes, conversion grants, escalation, or failover here. |
| 7    | DEFERRED: translator matrix rewrite, Prague row changes, and durable-agent telemetry are not part of amended 120A1. | No code changes in this slice. | Do not touch translation generation or add queue/orchestration machinery here. |
| 8    | Bob Copilot UI: typed errors render product-safe (copy table from 120B1); picker lists exactly the eligible set. **Ordering note (TPM F-12):** this step edits `CopilotPane.tsx`, which 120B1 Step 3 also edits — execute after 120B1 Step 3 lands, or coordinate the same PR.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | UI fixtures; no-raw-JSON e2e assertion; picker e2e.                                                                                                                                                                                                                                                                                                                                                                                                           | Error string-matching on provider text.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 9    | Docs sync + canary: update `documentation/services/sanfrancisco.md`, `documentation/ai/infrastructure.md` (incl. its two `OPENAI_MODEL` lines), purge `SANFRANCISCO_L10N` from `documentation/architecture/Overview.md`, `documentation/ai/overview.md`, `CloudflarePagesCloudDevChecklist.md` (coordinate — the first and third are also touched by the DevStudio working tree). **Post-deploy verification (TPM F-9):** after the cloud-dev deploy, run one real Copilot smoke per picker-eligible provider before calling the step green; revert = `git revert` of the matrix/registry commits (config-only rollback).                                                                                                                                                                                                                                                                                                                                                                                                                                  | Docs diff; live smoke evidence.                                                                                                                                                                                                                                                                                                                                                                                                  | Deferring docs; declaring green without the post-deploy smoke; adding translator generation work to this slice.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

## Deferred Translator Regression Gate

- Not part of amended 120A1 execution.
- Do not touch translation generation, re-enable generation, or create a translation queue
  for this slice.
- Historical fixture direction, retained only for later translator work: one FAQ instance
  under the seeded internal account with non-trivial
  base content (≥2 sections, ≥4 questions, rich text).

## Out of scope

Durable/service plane contract (120A-2). Workforce agents (120C). Translator re-base or
translation generation changes. Copilot behavior (120B1). Gemini/Mistral onboarding.
Closed learning loop (120F). Any SF write to product truth. Any interim patching of the
live Copilot (Q4). Any removed translation queue work.

## Acceptance

- No Builder Copilot model callable without an explicit provider call shape; no request
  parameter from model-id string matching; scoped PR-15 guards green.
- Raw upstream payloads never reach product surfaces; retryability preserved via
  structured `upstreamStatus`.
- Deferred: class routing, `default` fallback, escalation, declared failover, translator
  regression gate, Prague row changes, and durable-agent telemetry.
- Picker offers exactly the callable set; post-deploy smoke green per provider.
- Deferred: conversion enforcement (Q6).
- One error-code registry; one provider-type definition; repo typecheck green
  including admin.
