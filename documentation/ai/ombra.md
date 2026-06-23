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
| Grant enforcement | `sanfrancisco/src/grants.ts` |
| Provider/model selection | `sanfrancisco/src/ai/modelRouter.ts` |
| Provider credentials | San Francisco Worker secrets |

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

Ombra does not define agent scope, provider monitoring jobs, or model decision
history.
