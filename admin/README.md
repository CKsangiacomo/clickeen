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

The Bob UI Native husk and the local widget-authoring workspace are removed.

## Runtime Layout

- `src/html/` contains static HTML fragments bundled by Vite.
- `src/data/routes.ts` owns DevStudio section and hash-route discovery.
- `functions/` owns Cloudflare Pages auth/session middleware and policy API routes.
- `vite.config.ts` owns the Vite shell only; it must not reintroduce local policy,
  theme, or icon rebuild write APIs.

Policy writes go through Pages Functions, validate with `@clickeen/ck-policy`, and
commit matrix JSON updates to GitHub.

## Development

```bash
pnpm --filter @clickeen/devstudio dev
pnpm --filter @clickeen/devstudio build
pnpm --filter @clickeen/devstudio check:functions
```

Local DevStudio is for static UI iteration only. The canonical internal surface is
the Cloudflare Pages deployment behind Berlin/Google auth.

## Build-Time Generation

DevStudio generates Dieter/component showcase pages before dev/build:

- `scripts/generate-component-pages.ts`
- `scripts/generate-icons-showcase.local.cjs`
- `scripts/generate-typography-json.cjs`
