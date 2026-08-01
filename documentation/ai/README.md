# Clickeen AI

STATUS: CURRENT SYSTEM OPERATOR SPEC

`documentation/ai/` documents the AI runtime that exists now.

## Runtime Surfaces

| Surface | Current role | Code authority | Spec |
| --- | --- | --- | --- |
| San Francisco | Governed model execution, grant checks, model routing, and Prague system-copy translation | `sanfrancisco/` | `documentation/ai/sanfrancisco.md` |
| Product Copilot | Builder agent home for Bob draft operations and Builder help | `agents/product-copilot/` | `documentation/ai/agents/product-copilot.md` |
| Translation Agent | Account-widget translation agent home for saved-instance locale overlays | `agents/translation-agent/` | `documentation/ai/agents/translation-agent.md` |
| Ombra | Model-strategy boundary name; not a runtime service | `packages/ck-contracts/src/ai.ts`, `packages/ck-policy/ai-runtime.matrix.json` | `documentation/ai/ombra.md` |

Agent eval suites remain owned by each agent home. There is no shared learning,
outcome, or model-call telemetry plane in San Francisco.

## Runtime Dependency Map

```text
Bob CopilotPane
-> Roma account copilot route
-> Product Copilot Worker /execute
-> San Francisco /model/chat
-> provider API

Bob Translations panel
-> Roma account translation route
-> Translation Agent Worker /translate-instance
-> San Francisco /model/chat
-> provider API
-> Tokyo-worker internal translation write
-> accounts/[account public id]/instances/[instance id]/overlays/locales/[active locale].json

Prague system-copy translation tooling
-> scripts/prague-l10n/translate.mjs
-> San Francisco /l10n/translate
-> OpenAI Responses API
-> SF_R2 l10n/prague logs
```

## Canonical Agent Registry

Current built agents are registered in `packages/ck-contracts/src/ai.ts`.

| Agent id | Agent home | Runtime identity | Boundary |
| --- | --- | --- | --- |
| `product.copilot` | `product-copilot` | authenticated product request | `product_copilot_draft_actions` |
| `widget.instance.translator` | `translation-agent` | internal service request | `account_widget_translated_values` |

An unregistered agent id is not a current Clickeen AI runtime.

## Contract Sources

| Concern | Source of truth |
| --- | --- |
| Agent registry and model capabilities | `packages/ck-contracts/src/ai.ts` |
| Model management data displayed in DevStudio | `packages/ck-contracts/src/ai-model-management.ts` |
| Runtime policy matrix minted into grants | `packages/ck-policy/ai-runtime.matrix.json` |
| Runtime policy derivation and budget helpers | `packages/ck-policy/src/ai-runtime.ts` |
| San Francisco endpoint request/response types | `sanfrancisco/src/types.ts` |
| San Francisco grant verification | `sanfrancisco/src/grants.ts` |
| San Francisco model routing | `sanfrancisco/src/ai/modelRouter.ts`, `sanfrancisco/src/ai/chat.ts` |
| Product Copilot runtime and evals | `agents/product-copilot/` |
| Translation Agent runtime and evals | `agents/translation-agent/` |
| Worker deploy | `.github/workflows/cloud-dev-workers.yml` |

## Cloud-Dev Runtime Resources

| Runtime | Worker/resource | Binding/env | Used for |
| --- | --- | --- | --- |
| San Francisco | `sanfrancisco-dev` | `ROMA_AI_GRANT_PUBLIC_KEY_PEM` | Roma AI grant verification |
| San Francisco | `sanfrancisco-dev` | `PRAGUE_L10N_HMAC_SECRET` | Prague request-signature verification |
| San Francisco | `sanfrancisco-dev` | `OPENAI_API_KEY`, `OPENAI_BASE_URL` | OpenAI calls and optional base URL override |
| San Francisco | `sanfrancisco-dev` | `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL` | DeepSeek calls and optional base URL override |
| San Francisco | `sanfrancisco-dev` | `OPENAI_MODEL` | Prague system-copy translation model |
| San Francisco | R2 bucket `sanfrancisco-logs-dev` | `SF_R2` | Prague translation request/response logs |
| Product Copilot | `product-copilot-dev` | `SANFRANCISCO_AI_ENGINE -> sanfrancisco-dev` | Governed `/model/chat` calls |
| Translation Agent | `translation-agent-dev` | `SANFRANCISCO_AI_ENGINE -> sanfrancisco-dev` | Governed `/model/chat` calls |
| Translation Agent | `translation-agent-dev` | `TOKYO_PRODUCT_CONTROL -> tokyo-assets-dev` | Locale-overlay writes through Tokyo-worker |

Do not infer a resource unless the owning `wrangler.toml` binds it. Update this
inventory in the same change that changes a binding or secret requirement.

## Operator Routing

| Task | Read first |
| --- | --- |
| Change San Francisco endpoints, grants, model routing, bindings, or deploy | `documentation/ai/sanfrancisco.md` |
| Change Product Copilot behavior, context, or evals | `documentation/ai/agents/product-copilot.md` |
| Change Translation Agent behavior, locale-overlay writes, or evals | `documentation/ai/agents/translation-agent.md` |
| Change model policy, capabilities, or picker behavior | `documentation/ai/ombra.md` |

## Verification

```bash
pnpm --filter @clickeen/sanfrancisco typecheck
pnpm --filter @clickeen/product-copilot typecheck
pnpm --filter @clickeen/product-copilot test:copilot-contract
pnpm --filter @clickeen/product-copilot eval:copilot
pnpm --filter @clickeen/translation-agent typecheck
pnpm --filter @clickeen/translation-agent eval:translation-agent
pnpm e2e:smoke:copilot-runtime
pnpm e2e:smoke:translation-agent-runtime
```

After deploy, use GitHub Actions run status and the owning product-path smoke
test as runtime evidence. San Francisco health is available at
`https://sanfrancisco.dev.clickeen.com/healthz`.

## Runtime Input Boundary

Documentation is never runtime input. Runtime truth comes from code, signed
grants, product authorities, and Cloudflare bindings. Examples use literal
values only for fixed contract constants and bracketed placeholders for runtime
coordinates or generated values.
