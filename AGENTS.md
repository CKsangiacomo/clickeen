# Clickeen Agent Guidelines

This repo is an AI-native build: agents (AI or human) write the code. We win on clear architecture, disciplined execution, and documentation that stays true.

## Agent Operating Principles

### 1) Understand the System First
Before touching code, read the relevant context:
- `documentation/CONTEXT.md` (what we’re building)
- `documentation/WhyClickeen.md` (why it matters)
- The relevant PRD/architecture doc for the area you’re changing

### 2) No Smoke and Mirrors
- Don’t ship “works for now” patches that create silent downstream breakage.
- If impact is unclear, stop and ask a targeted yes/no question.

### 3) Elegant Engineering Only
If you’re tempted to add special cases, workarounds, or one-off parameters, redesign for an elegant, general solution that scales across 100s of widgets.

### 4) Design & UX Is the Moat
- Dieter and tokens are not optional: reuse tokens, don’t invent ad-hoc styling.
- New UI primitives belong in Dieter and must work consistently across contexts.

### 5) Propose Before Executing (When It Matters)
- For architectural/cross-cutting changes: propose a plan, declare scope, and confirm direction before implementing.
- For small, clearly scoped fixes: proceed, but keep diffs minimal and explain trade-offs.

### 6) Preserve What Works
- No speculative refactors, “modernization”, or churn.
- Change only what’s necessary to solve the problem correctly.

### 7) Documentation Is Truth
- Update docs when behavior changes.
- Documentation drift is a P0 bug.

## Repository Guidelines

### Project Structure & Module Organization
- `bob/` – Next.js widget editor UI; reads Dieter assets from `tokyo/dieter`.
- `admin/` – Vite-based DevStudio showcase; docs generated via `scripts/`.
- `dieter/` – Design system source (tokens, CSS, web components, `*.spec.json` fixtures).
- `paris/` – Next.js API/service workspace (Supabase/Redis dependencies).
- `venice/` & `prague/` – Edge runtime and marketing placeholders.
- `documentation/` stores product/architecture context; `scripts/` has build helpers; `tokyo/` serves built Dieter assets for local use.

### Build, Test, and Development Commands
- Install: `pnpm install` (workspace root).
- Dev: `pnpm dev:bob`, `pnpm dev:admin`, `pnpm dev:paris`, `pnpm dev:venice`; `pnpm dev` runs them together via Turbo.
- Build: `pnpm build:dieter` first, then `pnpm build` (Turbo fan-out).
- Lint/Typecheck: `pnpm lint`, `pnpm typecheck`; per-app linting with `pnpm --filter @clickeen/bob lint` or `.../devstudio lint`.
- Tests: `pnpm test` (Turbo) or targeted `pnpm --filter @clickeen/devstudio test`.

### Coding Style & Naming Conventions
- TypeScript-first; React function components in PascalCase; hooks/utilities in camelCase.
- Use 2-space indentation, Prettier defaults, and ESLint (`@typescript-eslint` in `admin`, `next lint` in Next apps); fix warnings before commit.
- Dieter components use kebab-case folders and `diet-` CSS class prefixes; reuse tokens from `dieter/tokens` instead of ad-hoc styles.
- Keep env-dependent URLs configurable (e.g., `NEXT_PUBLIC_TOKYO_URL` for Dieter assets).

### Testing Guidelines
- Admin uses Vitest/Testing Library; co-locate `*.test.ts(x)` near sources and cover accessibility.
- Dieter specs live in `dieter/components/*/*.spec.json`; update fixtures when components change.
- For Next apps, add smoke or integration coverage around new logic; at minimum, exercise data fetchers and critical hooks.
- Run `pnpm test` plus `pnpm lint && pnpm typecheck` before PRs; note any missing coverage.

### Commit & Pull Request Guidelines
- Use conventional-style messages seen in history (`feat: ...`, `chore: ...`, `fix: ...`); include scope when helpful (e.g., `feat(bob): add widget toolbar`).
- PRs need a concise summary, linked issue/PRD, screenshots or recordings for UI changes, and notes on env or migration steps.
- Call out Dieter token changes and downstream impact (Bob/Admin/Paris) in the description.
- Update relevant docs (`documentation/CONTEXT.md`, feature PRDs) when behavior shifts.

### Security & Configuration Tips
- Store secrets in per-app `.env.local` files; keep keys out of version control (Supabase/Redis, Edge Config, etc.).
- Keep Dieter asset paths in sync with `tokyo/dieter`; prefer configurable base URLs over hard-coded absolute URLs.
- When touching networked services, note rate limits and production endpoints; prefer feature flags or config toggles for risky changes.
