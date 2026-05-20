# PRD 103H - Shared Agent Model Profiles

Status: Complete / Shared policy proof green
Owner: Product + Architecture
Date: 2026-05-17
Parent: PRD 103 - Instance Translation Agent Teardown And Rebuild
Depends on: PRD 103A, PRD 103C.1, PRD 103C, PRD 103D.0, PRD 103B, PRD 103D, PRD 103E, PRD 103G

## Purpose

Make Copilot and the Instance Translation Agent use the existing `ck-policy` model/profile/cap/budget system.

This is not a new policy system. It is a cutover to the system already managed through DevStudio.

This sub-PRD hardens policy after the thin vertical slice. It must not block PRD 103V from using the existing policy path.

This PRD is not allowed to invent a policy layer. DevStudio-managed policy/caps/budgets remain the authority.

## Existing Authorities

- `packages/ck-policy/entitlements.matrix.json` owns plan caps.
- `packages/ck-policy/ai-runtime.matrix.json` owns agent model/budget profiles by tier.
- `packages/ck-contracts/src/ai.ts` owns the AI agent registry and model catalog.
- DevStudio's entitlements tool edits these matrices locally.

## Execution Contract

- Executable without drift: no widget, route, or provider file may hardcode model choice.
- New systems are allowed only if they extend the existing AI runtime matrix deliberately.
- End-to-end accuracy must prove Free and Tier 3 can resolve different models for both agents through policy.
- All systems must say `agent runtime policy`, `policy profile`, `provider`, `model`, `budget`, `policyVersion`.
- Blast radius includes `ck-policy`, `ck-contracts`, DevStudio, Roma grants, San Francisco runtime, Translation jobs, Copilot, audit logs, and tests.
- Pre-work limit: do not add new runtime-policy fields such as queue priority, retry policy, or quality profiles unless a concrete PRD 103 flow requires them.

## Acceptance

- `ai-runtime.matrix.json` remains the source for agent model/budget profiles.
- `entitlements.matrix.json` remains the source for plan caps such as Copilot turns and language limits.
- Account policy can assign different model profiles to Copilot and Translation.
- Free tier can route Translation to DeepSeek or equivalent low-cost profile.
- Tier 3 can route Translation to a GPT-5.5-class profile after the shared model catalog and matrix are updated.
- If GPT-5.5 is not yet in the shared model catalog, the execution requirement is to prove the matrix/catalog path, not to hardcode the model name elsewhere.
- Widget code does not choose providers or models.
- No translation path calls OpenAI, DeepSeek, or provider adapters directly.
- Translation audit records include account ID, agent ID, policy profile, provider, model, policy version, token usage, and result status.
- DevStudio policy changes affect Translation without widget, Roma, Bob, or San Francisco route code changes.
- Bob receives only validated draft patches from Copilot and validated language values from Translation.
- Translation and Copilot both produce validated product results, not raw model output.
- Provider bypass tests fail if a widget, Bob, Roma route, or San Francisco agent chooses provider/model directly.

## Verification

- `pnpm --filter @clickeen/ck-policy test` proves Free and Tier 3 resolve different Translation model profiles through `ai-runtime.matrix.json` and the shared registry/catalog path.
- `pnpm --filter @clickeen/ck-policy test` proves Free and Tier 3 resolve different Copilot model profiles through the same path.
- `pnpm --filter @clickeen/ck-policy test` proves Copilot model picker policy allows an approved Tier 3 selection and rejects a Free-tier selected model.
- `pnpm --filter @clickeen/sanfrancisco test` proves the Instance Translation Agent audit event carries account subject, agent ID, policy profile, policy version, provider, model, token usage, and result status.
- TPM signoff: tier behavior matches product promise.
- Dev Manager signoff: no direct provider bypass exists.

## Execution Notes

- No new policy system was introduced.
- `AgentRuntimePolicy` now carries `policyProfile` alongside `policyVersion`, provider, model, and budget.
- Roma continues to mint both Copilot and Instance Translation grants from `ck-policy`.
- San Francisco continues to resolve provider/model from the grant policy through `ai/modelRouter.ts`; product agents do not call provider adapters directly.
- San Francisco Instance Translation model calls use the signed grant budget from `ck-policy`. The translation core no longer applies a local hard-coded token or timeout cap over the tier/profile budget.
- The current shared model catalog does not contain `gpt-5.5`; Tier 3 Translation is therefore proven through the matrix/catalog path with the current OpenAI profile rather than hardcoding a model name outside the catalog.
