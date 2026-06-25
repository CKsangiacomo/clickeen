# Ombra

STATUS: CURRENT SYSTEM OPERATOR SPEC

Ombra is Clickeen's current model-strategy boundary name. It is not a Worker,
not an endpoint, not an agent home, and not a product service.

## Definition

Ombra names the rule that Clickeen AI behavior is product-shaped while model
providers remain replaceable execution dependencies. In the current system,
Ombra is implemented through explicit agent registry, model capability, model
management, and runtime policy files.

## Current Authorities

| Concern | Source of truth |
| --- | --- |
| Built agent ids and boundaries | `packages/ck-contracts/src/ai.ts` |
| Model capabilities | `packages/ck-contracts/src/ai.ts` |
| Model management data shown in DevStudio | `packages/ck-contracts/src/ai-model-management.ts` |
| Runtime policy matrix minted into grants | `packages/ck-policy/ai-runtime.matrix.json` |
| Runtime policy derivation and budget helpers | `packages/ck-policy/src/ai-runtime.ts` |
| Grant enforcement | `sanfrancisco/src/grants.ts` |
| Provider/model selection | `sanfrancisco/src/ai/modelRouter.ts`, `sanfrancisco/src/ai/chat.ts` |
| Provider credentials | San Francisco Worker secrets |

## Runtime Resource Impact

Ombra itself has no Worker, endpoint, D1 database, R2 bucket, KV namespace,
queue, secret, or deploy target. Operational changes happen through the files
and services below.

| Change | File/service touched | Runtime effect |
| --- | --- | --- |
| Add or remove a built agent id | `packages/ck-contracts/src/ai.ts` plus agent home/deploy docs | changes which `agentId` San Francisco can resolve |
| Change model capability metadata | `packages/ck-contracts/src/ai.ts` | changes model capability truth consumed by policy/UI code |
| Change DevStudio model-management display data | `packages/ck-contracts/src/ai-model-management.ts` | changes operator-facing model information |
| Change tier/runtime AI model policy | `packages/ck-policy/ai-runtime.matrix.json` | changes the policy Roma mints into grants |
| Change grant enforcement | `sanfrancisco/src/grants.ts` | changes San Francisco runtime enforcement |
| Change provider/model routing | `sanfrancisco/src/ai/modelRouter.ts`, `sanfrancisco/src/ai/chat.ts` | changes the selected provider/model execution path |
| Change provider credentials | San Francisco Worker secrets | enables or disables model routes at runtime |

## Current Runtime Consumers

| Agent | Registry id | Current model route authority |
| --- | --- | --- |
| Product Copilot | `product.copilot` | Roma-minted grant using `packages/ck-policy/ai-runtime.matrix.json` |
| Translation Agent | `widget.instance.translator` | Roma-minted grant using `packages/ck-policy/ai-runtime.matrix.json` |

San Francisco executes the signed route it receives. It does not read model
truth from `documentation/`.

## Model Policy Change Procedure

To change a current model/provider route:

1. Update model capability or management data in `packages/ck-contracts/src/ai.ts`
   or `packages/ck-contracts/src/ai-model-management.ts` when the candidate
   model itself changes.
2. Update `packages/ck-policy/ai-runtime.matrix.json` when the runtime policy
   minted into grants changes.
3. Run the checks for the affected agent.
4. Run the San Francisco typecheck when grant/model routing is affected.
5. Commit and deploy through the repo/GitHub Actions path.

Required checks:

```bash
pnpm --filter @clickeen/sanfrancisco typecheck
pnpm --filter @clickeen/product-copilot typecheck
pnpm --filter @clickeen/product-copilot eval:copilot
pnpm --filter @clickeen/translation-agent typecheck
pnpm --filter @clickeen/translation-agent eval:translation-agent
```

Run only the checks relevant to the affected route plus San Francisco when the
grant/model boundary changes.

## Operator Checklist

Before changing model policy:

1. Identify the agent id and tier affected.
2. Confirm the model exists in the capability/management files.
3. Confirm the provider key exists in San Francisco cloud-dev if the route will
   be exercised at runtime.
4. Update the policy matrix.
5. Run the affected agent eval plus San Francisco typecheck.
6. Push and verify the `cloud-dev workers deploy` workflow.
7. Run the relevant product smoke when the route is user-facing.

Do not change runtime policy by editing documentation. Documentation records the
operator contract; it is not read by Roma, San Francisco, or the agents.

## Common Failure Map

| Symptom | Likely owner | Operator action |
| --- | --- | --- |
| `Unknown agentId` | `packages/ck-contracts/src/ai.ts` | verify the agent is registered and deployed as a current agent home |
| `Grant AI policy does not match request agentId` | Roma grant minting or caller request | inspect caller route and grant payload trace |
| `Model provider mismatch` | signed policy vs selected model | inspect `selectedModel`, `defaultModel`, and `modelsByProvider` in minted policy |
| `Model not allowed` | policy matrix | verify `packages/ck-policy/ai-runtime.matrix.json` for the agent/tier |
| missing provider key | San Francisco secret | add/fix the Worker secret; do not switch model/provider silently |
| DevStudio model display disagrees with runtime | management metadata vs policy matrix | update the stale source; do not treat UI display as runtime truth |

## Disallowed Runtime Behavior

Current runtime must not:

- silently fallback to another provider/model;
- guess model strings;
- probe provider catalogs during product requests;
- read model truth from `documentation/`;
- call models from visitor runtime;
- let agent homes own provider credentials;
- let a caller request a model outside the signed grant policy.

## Verification

Use static checks plus product-path checks:

```bash
pnpm --filter @clickeen/sanfrancisco typecheck
pnpm --filter @clickeen/product-copilot eval:copilot
pnpm --filter @clickeen/translation-agent eval:translation-agent
gh run list --branch main --limit 10
```

## Out Of Scope

Ombra does not define agent scope, provider monitoring jobs, model decision
history, or planned-agent model policy.
