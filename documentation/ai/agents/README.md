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

## Worker Binding Inventory

| Agent | Binding/env | Required | Target | Failure if missing |
| --- | --- | --- | --- | --- |
| Product Copilot | `ENVIRONMENT` | no | Worker var | health reports `unknown` when absent |
| Product Copilot | `SANFRANCISCO_AI_ENGINE` | yes | service binding to `sanfrancisco-dev` | `500 PROVIDER_ERROR` before model call |
| Translation Agent | `ENVIRONMENT` | no | Worker var | health reports `unknown` when absent |
| Translation Agent | `AI_GRANT_HMAC_SECRET` | yes | Worker secret | `500 PROVIDER_ERROR` before model/write work |
| Translation Agent | `SANFRANCISCO_AI_ENGINE` | yes | service binding to `sanfrancisco-dev` | `500 PROVIDER_ERROR` before model call |
| Translation Agent | `TOKYO_PRODUCT_CONTROL` | yes | service binding to `tokyo-assets-dev` | `500 PROVIDER_ERROR` before overlay write |

Product Copilot has one current San Francisco transport: the service binding.
There is no HTTP transport fallback inside the Worker.

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

## Dependency Ownership

| Dependency | Owner | Agent behavior |
| --- | --- | --- |
| Current account/session/tier | Roma | agents receive only the signed authority they need |
| Model/provider execution | San Francisco | agents call `/model/chat`; agents do not own provider keys |
| Saved widget instance source | Roma/Tokyo-worker | Translation Agent receives items built from saved source |
| Browser draft | Bob | Product Copilot returns draft ops; Bob applies them locally |
| Overlay storage | Tokyo-worker | Translation Agent writes through internal Tokyo-worker route |
| Outcome storage | San Francisco | Bob/Roma attach outcomes; agents do not write outcome rows directly |

## Operator Failure Map

| Symptom | Check first | Owning doc |
| --- | --- | --- |
| Copilot returns model/provider error | San Francisco health, grant/model policy, provider secret | `sanfrancisco.md`, `product-copilot.md` |
| Copilot edit not applied | Bob draft signature, ops validation, undo construction | `product-copilot.md` |
| Translation generation fails before model call | Roma active locales, grant trace, `AI_GRANT_HMAC_SECRET` | `translation-agent.md` |
| Translation model output rejected | Translation Agent parse/path validation | `translation-agent.md` |
| Translation write rejected | Tokyo-worker internal translation route and grant trace | `translation-agent.md` |
| Evals pass but runtime fails | Cloud-dev bindings/secrets/deploy workflow | agent doc plus `sanfrancisco.md` |

## Verification Matrix

```bash
pnpm --filter @clickeen/product-copilot typecheck
pnpm --filter @clickeen/product-copilot test:copilot-contract
pnpm --filter @clickeen/product-copilot eval:copilot
pnpm e2e:smoke:copilot-runtime
pnpm --filter @clickeen/translation-agent typecheck
pnpm --filter @clickeen/translation-agent eval:translation-agent
pnpm e2e:auth:roma-dev
pnpm e2e:smoke:translation-agent-runtime
```

Deploy/runtime evidence comes from GitHub Actions and the owning product smoke,
not from local docs.
