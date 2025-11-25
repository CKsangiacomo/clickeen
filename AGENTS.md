# Repository Guidelines

## Project Structure & Module Organization
- `bob/` – Next.js widget editor UI; reads Dieter assets from `denver/dieter`.
- `admin/` – Vite-based DevStudio showcase; docs generated via `scripts/`.
- `dieter/` – Design system source (tokens, CSS, web components, `*.spec.json` fixtures).
- `paris/` – Next.js API/service workspace (Supabase/Redis dependencies).
- `venice/` & `prague/` – Edge runtime and marketing placeholders.
- `documentation/` stores product/architecture context; `scripts/` has build helpers; `denver/` serves built Dieter assets for local use.

## Build, Test, and Development Commands
- Install: `pnpm install` (workspace root).
- Dev: `pnpm dev:bob`, `pnpm dev:admin`, `pnpm dev:paris`, `pnpm dev:venice`; `pnpm dev` runs them together via Turbo.
- Build: `pnpm build:dieter` first, then `pnpm build` (Turbo fan-out).
- Lint/Typecheck: `pnpm lint`, `pnpm typecheck`; per-app linting with `pnpm --filter @clickeen/bob lint` or `.../devstudio lint`.
- Tests: `pnpm test` (Turbo) or targeted `pnpm --filter @clickeen/devstudio test`.

## Coding Style & Naming Conventions
- TypeScript-first; React function components in PascalCase; hooks/utilities in camelCase.
- Use 2-space indentation, Prettier defaults, and ESLint (`@typescript-eslint` in `admin`, `next lint` in Next apps); fix warnings before commit.
- Dieter components use kebab-case folders and `diet-` CSS class prefixes; reuse tokens from `dieter/tokens` instead of ad-hoc styles.
- Keep env-dependent URLs configurable (e.g., `NEXT_PUBLIC_DENVER_URL` for Dieter assets).

## Testing Guidelines
- Admin uses Vitest/Testing Library; co-locate `*.test.ts(x)` near sources and cover accessibility.
- Dieter specs live in `dieter/components/*/*.spec.json`; update fixtures when components change.
- For Next apps, add smoke or integration coverage around new logic; at minimum, exercise data fetchers and critical hooks.
- Run `pnpm test` plus `pnpm lint && pnpm typecheck` before PRs; note any missing coverage.

## Commit & Pull Request Guidelines
- Use conventional-style messages seen in history (`feat: ...`, `chore: ...`, `fix: ...`); include scope when helpful (e.g., `feat(bob): add widget toolbar`).
- PRs need a concise summary, linked issue/PRD, screenshots or recordings for UI changes, and notes on env or migration steps.
- Call out Dieter token changes and downstream impact (Bob/Admin/Paris) in the description.
- Update relevant docs (`documentation/CONTEXT.md`, feature PRDs) when behavior shifts.

## Security & Configuration Tips
- Store secrets in per-app `.env.local` files; do not commit keys (Supabase/Redis, Edge Config, etc.).
- Keep Dieter asset paths in sync with `denver/dieter`; avoid hard-coded absolute URLs.
- When touching networked services, note rate limits and production endpoints; prefer feature flags or config toggles for risky changes.
