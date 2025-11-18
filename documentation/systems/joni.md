# System: Joni — Static Website Sandbox
## Identity
- Tier: Supporting
- Purpose: Host the marketing / website pages we are refactoring inside the sandboxed monorepo.

## Interfaces
- Exposes a Vite-powered static site on `http://localhost:4173`
- Imports Harmony token assets from Steve (via `STEVE_URL`/`VITE_STEVE_URL`) and consumes the design system CSS
- Serves static HTML/CSS built from `joni/src`

## Dependencies
- Depends on: Harmony (tokens/styles) + Steve CDN for asset delivery
- Used by: Team members working on the website to preview new pages in context

## Deployment
- Run `pnpm --filter @clickeen/joni dev` (or `scripts/dev-up.sh`) for local development
- Run `pnpm --filter @clickeen/joni build` followed by a static host push when publishing

## Rules
- Always load Harmony tokens via Steve (the dev-up script injects `VITE_STEVE_URL`)
- Keep the layout simple; the focus surface is improving copy/markup inside `joni/src`
- Shared assets should live inside Harmony/Steve; do not duplicate token definitions here

## Links
- Back: ../CONTEXT.md
