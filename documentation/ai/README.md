# Clickeen AI

STATUS: CURRENT SYSTEM OPERATOR SPEC

`documentation/ai/` documents only the AI runtime that exists now.

## Scope

Current AI runtime surfaces:

| Surface | Current role | Code authority | Spec |
| --- | --- | --- | --- |
| San Francisco | Governed model execution, grant checks, model routing, telemetry/outcome writes | `sanfrancisco/` | `documentation/ai/sanfrancisco.md` |
| Product Copilot | Builder agent home for Bob draft operations and Builder help | `agents/product-copilot/` | `documentation/ai/agents/product-copilot.md` |
| Translation Agent | Account-widget translation agent home for saved instance locale overlays | `agents/translation-agent/` | `documentation/ai/agents/translation-agent.md` |
| Learning loop | Current model-call event, outcome, D1/R2, and eval gates | `sanfrancisco/src/telemetry.ts`, `sanfrancisco/migrations/`, `agents/*/evals/` | `documentation/ai/learning.md` |
| Ombra | Current model-strategy boundary name; not a runtime service | `packages/ck-contracts/src/ai.ts`, `packages/ck-policy/ai-runtime.matrix.json` | `documentation/ai/ombra.md` |

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

Bob outcome reporter
-> Roma account copilot outcome route
-> San Francisco /outcome
-> SF_D1 copilot_outcomes

Prague system-copy translation tooling
-> scripts/prague-l10n/translate.mjs
-> San Francisco /l10n/translate
-> OpenAI Responses API
-> SF_R2 l10n/prague logs

San Francisco /model/chat
-> SF_EVENTS queue
-> SF_D1 copilot_events
-> optional SF_R2 learning sample
```

## Canonical Agent Registry

Current built agents are registered in `packages/ck-contracts/src/ai.ts`.

| Agent id | Agent home | Runtime identity | Boundary |
| --- | --- | --- | --- |
| `product.copilot` | `product-copilot` | authenticated product request | `product_copilot_draft_actions` |
| `widget.instance.translator` | `translation-agent` | internal service request | `account_widget_translated_values` |

If an agent id is not in this table and not registered in
`packages/ck-contracts/src/ai.ts`, it is not a current Clickeen AI runtime.

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
| Product Copilot worker endpoint | `agents/product-copilot/src/worker.ts` |
| Product Copilot brain contract | `agents/product-copilot/src/index.ts` |
| Translation Agent worker endpoint | `agents/translation-agent/src/worker.ts` |
| Translation Agent translation contract | `agents/translation-agent/src/index.ts` |
| San Francisco deploy | `.github/workflows/cloud-dev-workers.yml`, `sanfrancisco/wrangler.toml` |
| Agent worker deploy | `.github/workflows/cloud-dev-workers.yml`, `agents/*/wrangler.toml` |

## Cloud-Dev Runtime Resources

| Runtime | Worker/resource | Binding/env | Required | Used for |
| --- | --- | --- | --- | --- |
| San Francisco | `sanfrancisco-dev` | `AI_GRANT_HMAC_SECRET` | yes | AI grant and outcome signature verification |
| San Francisco | `sanfrancisco-dev` | `OPENAI_API_KEY` | route-dependent | OpenAI model calls when a signed grant selects OpenAI |
| San Francisco | `sanfrancisco-dev` | `OPENAI_MODEL` | required for `/l10n/translate` | Prague system-copy translation model |
| San Francisco | `sanfrancisco-dev` | `DEEPSEEK_API_KEY` | route-dependent | DeepSeek model calls when a signed grant selects DeepSeek |
| San Francisco | `sanfrancisco-dev` | `OPENAI_BASE_URL` | optional | OpenAI-compatible base URL override |
| San Francisco | `sanfrancisco-dev` | `DEEPSEEK_BASE_URL` | optional | DeepSeek-compatible base URL override |
| San Francisco | KV namespace `f1abe003b9a8434699175b0c1ccd2603` | `SF_KV` | bound | San Francisco-owned KV namespace; no current primary product truth |
| San Francisco | D1 `sanfrancisco_d1_dev` / `9ee059a3-538f-4b71-b2ea-f04b33e4897a` | `SF_D1` | yes | `copilot_events`, `copilot_outcomes` indexes |
| San Francisco | R2 bucket `sanfrancisco-logs-dev` | `SF_R2` | yes | sampled raw learning payloads |
| San Francisco | Queue `sanfrancisco-events-dev` | `SF_EVENTS` | optional for model response | asynchronous interaction event indexing |
| Product Copilot | `product-copilot-dev` | `SANFRANCISCO_AI_ENGINE -> sanfrancisco-dev` | yes | service-binding call to San Francisco `/model/chat` |
| Translation Agent | `translation-agent-dev` | `AI_GRANT_HMAC_SECRET` | yes | local verification of Roma translation grants |
| Translation Agent | `translation-agent-dev` | `SANFRANCISCO_AI_ENGINE -> sanfrancisco-dev` | yes | model execution through San Francisco |
| Translation Agent | `translation-agent-dev` | `TOKYO_PRODUCT_CONTROL -> tokyo-assets-dev` | yes | overlay writes through Tokyo-worker |

Do not infer a resource from this table if the corresponding `wrangler.toml`
does not bind it. Update this table in the same change that changes a Worker
binding, D1 database, R2 bucket, queue, or secret requirement.

## Folder Taxonomy

```text
documentation/ai/
  README.md
  sanfrancisco.md
  ombra.md
  learning.md
  agents/
    README.md
    product-copilot.md
    translation-agent.md
```

## Operator Routing

| Task | Read first |
| --- | --- |
| Change San Francisco endpoint, grant, model routing, telemetry, bindings, or deploy | `documentation/ai/sanfrancisco.md` |
| Change Product Copilot behavior, worker request shape, context capsule, or evals | `documentation/ai/agents/product-copilot.md` |
| Change Translation Agent behavior, worker request shape, locale overlay writes, or evals | `documentation/ai/agents/translation-agent.md` |
| Change model policy, model capabilities, or model picker behavior | `documentation/ai/ombra.md` |
| Change learning samples, D1 outcome rows, event indexes, or eval gates | `documentation/ai/learning.md` |

## Operator Commands

Focused local checks:

```bash
pnpm --filter @clickeen/sanfrancisco typecheck
pnpm --filter @clickeen/product-copilot typecheck
pnpm --filter @clickeen/product-copilot test:copilot-contract
pnpm --filter @clickeen/product-copilot eval:copilot
pnpm --filter @clickeen/translation-agent typecheck
pnpm --filter @clickeen/translation-agent eval:translation-agent
pnpm e2e:auth:roma-dev
pnpm e2e:smoke:copilot-runtime
pnpm e2e:smoke:translation-agent-runtime
```

Cloud-dev deploy and runtime evidence:

```bash
git push github main
gh run list --branch main --limit 10
curl -s https://sanfrancisco.dev.clickeen.com/healthz
```

Product Copilot and Translation Agent deploy through the same
`cloud-dev workers deploy` workflow as San Francisco. Product-path proof comes
from the Roma/Bob smoke tests, not from local docs.

## Runtime Input Boundary

Documentation is never runtime input. San Francisco and agent workers do not
read model truth, grant truth, locale truth, or product truth from
`documentation/`.

Current runtime truth comes from code, signed grants, product authorities, and
Cloudflare bindings. If a doc/runtime mismatch is found, fix the doc with the
behavior change or immediately after verifying the behavior.

## Example Value Discipline

Examples in this folder must not invent product truth.

Use literal values only for fixed contract constants, such as:

- registered agent ids;
- fixed route paths;
- enum values;
- Worker names, binding names, bucket names, queue names, and other documented
  current runtime coordinates.

Use bracket placeholders for runtime, account, request, locale, model, content,
timestamp, signature, generated id, and storage-key variables:

```text
[request id]
[account public id]
[instance id]
[active locale]
[signed grant]
[provider selected by signed grant]
[model returned by provider]
[translated value]
accounts/[account public id]/instances/[instance id]/overlays/locales/[active locale].json
```

This keeps examples AI-operable: contract constants remain visible, while
variable values cannot be mistaken for runtime truth.

Bracketed examples describe operator shape, not copy/paste test fixtures. Exact
primitive types remain owned by the code/type source named in the relevant doc.

## Scope Boundary

This folder contains current AI runtime/operator specs only. Generated runtime
JSON, product service docs, and AI coding guides for widget/page authoring are
not AI runtime specs.
