# DevStudio — Internal Toolbench

**Package**: `@clickeen/devstudio`
**Canonical URL**: `https://devstudio.clickeen.com`
**Cloudflare Pages project**: `devstudio`

DevStudio is Clickeen's internal platform toolbench. It hosts Dieter/foundation
showcases and the Policy Editor; it is not Roma, not a customer shell, and not a
superadmin account browser.

## Current Surface

- Foundations: Colors, Typography, Icons.
- Dieter Components: generated/static component showcase pages.
- Policy: entitlements + AI runtime Policy Editor at `/#/policy/entitlements`.
- LLM Management: read-only managed model configuration and conformance evidence
  at `/#/policy/llm-management`.

The Bob UI Native husk and the local widget-authoring workspace are removed.

## Runtime Layout

- `src/html/` contains static HTML fragments bundled into the static Pages app.
- `src/data/routes.ts` owns DevStudio section and hash-route discovery.
- `functions/` owns Cloudflare Pages auth/session middleware and policy API routes.
- `scripts/build-static.mjs` owns the static bundle; it must not reintroduce local
  policy, theme, or icon rebuild write APIs.

Policy writes go through Pages Functions, validate with `@clickeen/ck-policy`, and
commit matrix JSON updates to GitHub.

LLM Management reads source-controlled model config from
`@clickeen/ck-contracts/ai-model-management` and committed evidence from
`documentation/ai/model-conformance/latest.json`. It does not probe providers,
read provider secrets, or mutate live San Francisco runtime state.

## Verification

```bash
pnpm --filter @clickeen/devstudio build
pnpm --filter @clickeen/devstudio check:functions
```

DevStudio evidence comes from the Cloudflare Pages deployment behind
Berlin/Google auth, not from a local dev server.

## Build-Time Generation

DevStudio generates Dieter/component showcase pages before build:

- `scripts/generate-component-pages.ts`
- `scripts/generate-typography-json.cjs`
- `scripts/generate-static-registries.mjs`
