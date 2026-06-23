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

## Canonical Agent Registry

Current built agents are registered in `packages/ck-contracts/src/ai.ts`.

| Agent id | Agent home | Runtime identity | Boundary |
| --- | --- | --- | --- |
| `cs.widget.copilot.v1` | `product-copilot` | authenticated product request | `product_copilot_draft_actions` |
| `widget.instance.translator` | `translation-agent` | internal service request | `account_widget_translated_values` |

If an agent id is not in this table and not registered in
`packages/ck-contracts/src/ai.ts`, it is not a current Clickeen AI runtime.

## Contract Sources

| Concern | Source of truth |
| --- | --- |
| Agent registry and model capabilities | `packages/ck-contracts/src/ai.ts` |
| Model management data displayed in DevStudio | `packages/ck-contracts/src/ai-model-management.ts` |
| Runtime policy matrix minted into grants | `packages/ck-policy/ai-runtime.matrix.json` |
| San Francisco endpoint request/response types | `sanfrancisco/src/types.ts` |
| San Francisco grant verification | `sanfrancisco/src/grants.ts` |
| San Francisco model routing | `sanfrancisco/src/ai/modelRouter.ts`, `sanfrancisco/src/ai/chat.ts` |
| Product Copilot worker endpoint | `agents/product-copilot/src/worker.ts` |
| Product Copilot brain contract | `agents/product-copilot/src/index.ts` |
| Translation Agent worker endpoint | `agents/translation-agent/src/worker.ts` |
| Translation Agent translation contract | `agents/translation-agent/src/index.ts` |
| San Francisco deploy | `.github/workflows/cloud-dev-workers.yml`, `sanfrancisco/wrangler.toml` |
| Agent worker deploy | `.github/workflows/cloud-dev-workers.yml`, `agents/*/wrangler.toml` |

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

## Runtime Input Boundary

Documentation is never runtime input. San Francisco and agent workers do not
read model truth, grant truth, locale truth, or product truth from
`documentation/`.

Current runtime truth comes from code, signed grants, product authorities, and
Cloudflare bindings. If a doc/runtime mismatch is found, fix the doc with the
behavior change or immediately after verifying the behavior.

## Verification And Drift Checks

Run focused checks for the changed surface:

```bash
pnpm --filter @clickeen/sanfrancisco typecheck
pnpm --filter @clickeen/product-copilot typecheck
pnpm --filter @clickeen/product-copilot test:copilot-contract
pnpm --filter @clickeen/product-copilot eval:copilot
pnpm --filter @clickeen/translation-agent typecheck
pnpm --filter @clickeen/translation-agent eval:translation-agent
```

Use cloud-dev workflow evidence for deploy state:

```bash
gh run list --branch main --limit 10
```

## Scope Boundary

This folder contains current AI runtime/operator specs only. Generated runtime
JSON, model-conformance evidence files, product service docs, and AI coding
guides for widget/page authoring are not AI runtime specs.
