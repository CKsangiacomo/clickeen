# AI Agents

STATUS: CURRENT SYSTEM OPERATOR SPEC

This folder documents current built agent homes only. If an agent does not have
code/runtime and a registered agent id in `packages/ck-contracts/src/ai.ts`, it
is not documented here.

## Built Agent Registry

| Agent | Agent id | Worker | Wrangler | Inbound caller | Outbound dependencies | Mutation boundary | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Product Copilot | `product.copilot` | `agents/product-copilot/src/worker.ts` | `agents/product-copilot/wrangler.toml` | Roma account Builder route | San Francisco `/model/chat` | Bob live draft only; save/publish remains Roma | `pnpm --filter @clickeen/product-copilot test:copilot-contract`, `pnpm --filter @clickeen/product-copilot eval:copilot` |
| Translation Agent | `widget.instance.translator` | `agents/translation-agent/src/worker.ts` | `agents/translation-agent/wrangler.toml` | Roma translation routes/service binding | San Francisco `/model/chat`, Tokyo-worker internal product route | account instance locale overlay files in Tokyo/R2 | `pnpm --filter @clickeen/translation-agent eval:translation-agent`, `pnpm e2e:smoke:translation-agent-runtime` |

## Agent Home Contract

A current Clickeen agent home:

- owns reasoning for one structured product artifact boundary;
- exposes a Worker endpoint for Roma or another current product authority;
- calls San Francisco for governed model execution;
- does not own provider keys;
- does not bypass the product authority that owns persistence;
- returns explicit errors instead of falling back to another agent/model/path.

## Invocation And Mutation Boundaries

| Agent | Invocation authority | Runtime mutation |
| --- | --- | --- |
| Product Copilot | Roma account Builder route, with Bob-provided draft context | returns typed draft results; Bob applies draft edits in browser memory only |
| Translation Agent | Roma saved-instance translation operation | writes completed locale overlay files through Tokyo-worker |

## Verification Matrix

```bash
pnpm --filter @clickeen/product-copilot typecheck
pnpm --filter @clickeen/product-copilot test:copilot-contract
pnpm --filter @clickeen/product-copilot eval:copilot
pnpm --filter @clickeen/translation-agent typecheck
pnpm --filter @clickeen/translation-agent eval:translation-agent
pnpm e2e:auth:roma-dev
pnpm e2e:smoke:translation-agent-runtime
```

Deploy/runtime evidence comes from GitHub Actions and the owning product smoke,
not from local docs.
