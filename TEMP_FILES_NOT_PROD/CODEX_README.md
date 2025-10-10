You are Codex, rebuilding the Clickeen repo from scratch. Work in Principal Engineer mode: read documentation first, follow frozen specs, and ask for missing context rather than guessing.

High-Level Context
- Clickeen is a widget-first SaaS. Phase-1 scope is frozen; documentation under /documentation is normative.
- Monorepo uses pnpm workspaces + Turbo. Three Next.js surfaces (app = Studio shell/UI, site = marketing, embed = public runtime), plus services/api (Paris) and shared packages.
- Design system “Dieter” ships CSS/tokens only; no React components.
- Supabase (“Michael”) is the data plane. Edge Config (Atlas) is read-only at runtime.

Root Tooling & Config
- `package.json:1` — workspace scripts; run `pnpm install`, `pnpm dev`, `pnpm lint`, `pnpm test`, etc. Global dev deps (Playwright, eslint, stylelint).
- `pnpm-workspace.yaml:1` — declares workspaces (apps/*, services/*, packages/*, dieter, infra/*) and onlyBuiltDependencies.
- `turbo.json:1` — task pipeline; caches build outputs including `public/dieter`.
- `tsconfig.json:1` and `tsconfig.base.json:1` — compiler config, with `@/*` pointing to `apps/app/*`.
- `eslint.config.mjs:1`, `stylelint.config.cjs:1`, `postcss.config.mjs:1` — linting posture; CSS lint skips Dieter ship assets.
- `vercel.json:1` — project routing (per-surface rewrites).
- Root scripts under `scripts/` (see below) orchestrate Dieter asset pipelines and smoke tooling.
- `components.json:1` — legacy shadcn metadata (unused now, left for context).

Documentation (read before building)
- `documentation/CONTEXT.md:1` — precedence rules (DB Truth > Phase-1 Contracts > system PRDs).
- `documentation/dbschemacontext.md:1` — Supabase schema dump; authoritative table/column definitions.
- `documentation/CRITICAL-TECHPHASES/Techphases.md:1` and `Techphases-Phase1Specs.md:1` — architectural roadmap and locked Phase-1 contracts.
- `documentation/systems/*.md` — PRDs per system (Studio, Bob, Venice, Paris, Geneva, etc.).
- `documentation/FailuresRCAs-IMPORTANT.md:1` — mistakes to avoid; enforcement history.

Apps – Studio dashboard (`apps/app`)
- `apps/app/package.json:1` — Next app on port 3001; depends on `@supabase/ssr`, `@ck/dieter`.
- `apps/app/next.config.mjs:1` — security headers (CSP, permissions policy).
- `apps/app/middleware.ts:1` — Supabase-auth gate for non-public routes; bypasses `/auth/*`, `/invites/accept`, static assets.
- `apps/app/lib/supabase.ts:1` — SSR client + `getCurrentUser`.
- `apps/app/lib/supabaseServer.ts:1` — dev-only service-role helper (guarded).
- `apps/app/lib/audit.ts:1` — writes audit_logs via service-role (dev only).
- `apps/app/lib/rateLimiter.ts:1` — in-memory rate limiter for server actions.
- `apps/app/lib/roles.ts:1` — helper for owner/admin check.
- `apps/app/app/layout.tsx:1` — root layout, global font/color baseline.
- `apps/app/app/globals.css:1` — imports Dieter tokens/components; defines `.btn` helpers and icon sizing.
- `apps/app/app/page.tsx:1` — dashboard stub linking to sample workspace routes.
- `apps/app/app/builder-shell/StudioPage.tsx:1` — exports metadata + `StudioShell`.
- `apps/app/app/builder-shell/components/StudioShell.tsx:1` — full Studio shell UI; dual iframe buffering, template drawer, theme/device toggles.
- `apps/app/app/builder-shell/components/StudioShell.module.css:1` — shell styling (grid layout, drawers, preview).
- `apps/app/app/studio/page.tsx:1` — re-exports StudioPage to `/studio`.
- `apps/app/app/auth/login/page.tsx:1` — client magic-link form calling `/auth/magic`.
- `apps/app/app/auth/magic/route.ts:1` — sends OTP via Supabase; uses `NEXT_PUBLIC_DASHBOARD_URL` for redirect.
- `apps/app/app/auth/confirm/page.tsx:1` — completes sign-in flow and links back home.
- `apps/app/app/api/auth/signout/route.ts:1` — Supabase sign-out endpoint.
- `apps/app/app/invites/accept/page.tsx:1` — accept invite server page; writes membership + audit log.
- `apps/app/app/workspaces/page.tsx:1` — lists workspaces for current user.
- `apps/app/app/workspaces/[id]/members/page.tsx:1` — member management: lists members/invites, server action to create invites (rate limited).
- `apps/app/app/widgets/[publicId]/submissions/page.tsx:1` — fetches recent submissions via Supabase REST (service-role; Phase-1 shim).
- `apps/app/app/widgets/...` — placeholder for widget surfaces (submissions only today).
- `apps/app/dieter/components/SystemIcon.tsx:1` — client-side icon loader with caching safeguards.
- `apps/app/dieter/tokens/icon.types.ts:1` — generated icon name union (do not hand-edit).
- `apps/app/public/dieter/README.md:1` — generated asset marker (populated by copy step).

App-specific configs
- `apps/app/tsconfig.json:1` — extends root config; sets baseUrl for `@/`.
- `apps/app/vercel.json:1` — Vercel project config (c-keen-app).

Marketing site (`apps/site`)
- `apps/site/package.json:1` — Next app, port 3000 default; minimal dependencies.
- `apps/site/app/layout.tsx:1`, `apps/site/app/page.tsx:1` — marketing shell + hero.
- `apps/site/app/widgets/contact-form/page.tsx:1` — widget landing page, snippet copy UI, anonymous widget creation form.
- `apps/site/app/widgets/contact-form/Configurator.tsx:1` — preview configurator with srcDoc iframe + localStorage persistence.
- `apps/site/app/widgets/contact-form/ConfiguratorIT.tsx:1` — Italian localization stub (unused but present).
- `apps/site/app/widgets/contact-form/SnippetBox.tsx:1` — snippet copy helper component.
- `apps/site/app/api/widgets/anonymous/route.ts:1` — creates widget+instance via Supabase RPC `create_widget_with_instance`.
- `apps/site/app/robots.ts:1`, `apps/site/app/sitemap.ts:1`, `apps/site/app/version.txt:1` — SEO utilities.
- `apps/site/lib/supabase.ts:1`, `apps/site/lib/supabaseAdmin.ts:1` — SSR + admin helpers for site contexts.

Embed runtime (`services/embed`)
- `services/embed/package.json:1` — Next edge app on port 3002; smoke scripts.
- `services/embed/next.config.mjs:1` — standard Next config (not opened but minimal).
- `services/embed/app/e/[publicId]/route.ts:1` — SSR HTML embed endpoint; responds with minimal panel, obeys theme/device query params, caches aggressively unless `ts` present.
- `services/embed/app/api/e/[publicId]/route.ts:1` — loader JS snippet; mounts widget, loads `embed-bundle.js`, handles preview postMessage channel.
- `services/embed/app/api/cfg/[publicId]/route.ts:1` — demo config endpoint (JSON, cached).
- `services/embed/app/api/form/[publicId]/route.ts:1` — Phase-1 guard returning 503 (edge can’t use service role yet).
- `services/embed/app/api/ingest/route.ts:1` — beacon collector stub (echo success).
- `services/embed/public/embed-bundle.js:1` — bundled widget runtime (contact form).
- `services/embed/scripts/atlas-smoke.mjs:1`, `e2e-real-widget.mjs:1`, `smoke-form.mjs:1` — manual smoke scripts hitting Atlas/config endpoints.

API service (`services/api`)
- `services/api/package.json:1` — Next node runtime; depends on `@vercel/edge-config`.
- `services/api/app/api/healthz/route.ts:1` — health probe (simple JSON ok).
- `services/api/app/api/instance/route.ts:1` — POST `/api/instance` to create widget_instances; validates payload, handles duplicate key.
- `services/api/app/api/instance/[publicId]/route.ts:1` — GET/PUT for instance config/status updates; uses service-role client.
- `services/api/app/api/instance/[publicId]/route.ts` (GET, PUT) ensures config is object, status enumerated, responds 404 if missing.
- `services/api/next.config.mjs:1` — baseline config (not inspected but minimal).
- `services/api/vercel.json:1` — service-specific settings (if present; verify when rebuilding).

Shared packages
- `packages/embed-core/index.ts:1` — vanilla helpers to mount shadow root and send beacons.
- `packages/embed-core/package.json:1` — package metadata (expects built dist).
- `packages/widgets/contact-form.ts:1` — DOM-only contact form widget (uses `embed-core`, handles config updates, posts to `/api/form/DEMO_PUBLIC_ID`).
- `packages/widgets/package.json:1` — metadata.

Design system (`dieter`)
- `dieter/package.json:1` — build script triggers `scripts/build-dieter.js` and `copy-dieter-assets.js`.
- `dieter/tokens/tokens.css:1`, `dieter/tokens.css:1` — design tokens (CSS custom properties).
- `dieter/components/button.css:1`, `segmented.css:1` — shipped component styles; keep unpolluted.
- `dieter/components/index.ts:1` — TypeScript contracts for Dieter primitives.
- `dieter/icons/icons.json:1` — manifest of icons; `dieter/icons/svg/*.svg` normalized assets (currentColor).
- `dieter/scripts/build-icons.mjs:1` — build helper (icon JSON/type generation).
- `dieter/dist/**` — built artifacts copied into app via scripts (regenerated, not committed manually).
- `dieter/index.html:1` — demo harness for Dieter components.

Scripts (`scripts/`)
- `scripts/build-dieter.js:1` — canonical asset build: normalize SVGs, verify, copy tokens/components into dist.
- `scripts/copy-dieter-assets.js:1` — copies `dieter/dist` into `apps/app/public/dieter`; replaces symlinks.
- `scripts/gen-icon-types.mjs:1`, `process-svgs.js:1`, `verify-svgs.js:1`, `scope-tokens.js:1` — asset hygiene tooling.
- `scripts/e2e-prod-smoke.sh:1` — shell harness for smoke checks against prod endpoints (no accidental writes).
- `scripts/link-dieter.js:1` — legacy symlink helper (avoid using per ADR).
- `scripts/stability-integrity-scan.zsh:1` — repo hygiene scan.
- `scripts/build-dieter.js` calls `process-svgs` and `verify-svgs`—do not bypass.

Tests (`tests/`)
- `tests/playwright.config.ts:1` — Playwright base config; points to `tests/e2e`.
- `tests/e2e/app-smoke.spec.ts:1` — basic dashboard smoke (homepage, `/studio`, auth routes).
- `tests/e2e/embed-smoke.spec.ts:1` — embed health check.
- `tests/dietercomponents.html:1` — manual Dieter component preview.
- `tests/styles/button-preview.css:1`, `typography-preview.css:1` — harness-only styles (keep out of Dieter package).

Tools (`tools/ci`)
- `tools/ci/check-lockfile.cjs:1` — ensures `pnpm-lock.yaml` is consistent.
- `tools/ci/verify-pnpm-config.cjs:1` — guards pnpm version drift.
- `tools/ci/verify-vercel-config.cjs:1` — validates Vercel project configs.
- `tools/ci/verify-public-dieter-clean.cjs:1` — ensures generated assets stay clean.

Public assets (`public/`)
- `public/*.svg` — brand assets.
- `public/studio/TMP/*.png` — placeholder template thumbnails for Studio shell.

Key Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — required across surfaces.
- `SUPABASE_SERVICE_ROLE_KEY` — used only in server contexts (Paris, marketing snippet creation).
- `NEXT_PUBLIC_EMBED_BASE` — optional override for Studio preview if embed deployed elsewhere.
- `NEXT_PUBLIC_DASHBOARD_URL` — linkback for magic-link emails, invite accept flows.

Known Mistakes & Hard Guardrails (do not repeat)
1. No unapproved CI workflows, PR templates, or automation (see RCAs). Every change to pipelines requires CEO + Techphases update.
2. Do not commit debug artifacts or generated outputs (`_reports/`, Dieter dist). Keep repo clean.
3. Respect codename scrubs: never reintroduce legacy names (Oslo, etc.).
4. Do not re-enable service-role in edge runtimes; embed service must stay anon-only until phase change.
5. No heredoc bash prompts or zsh-incompatible scripts; stick to plain commands.
6. Never defer work back to CEO; AI executes, CEO reviews.
7. Keep Studio shell the single frame for Bob—avoid duplicating builder logic elsewhere.
8. Ensure Dieter package ships pure component CSS; preview chrome lives under `tests/` only.
9. One-pass, repo-wide updates when renaming or removing concepts.
10. Follow ADRs; if behavior needs to change, land ADR + doc updates before coding.

Workflow Expectations
- Start from documentation; confirm scope before coding.
- Use pnpm (`pnpm install`, `pnpm dev`, etc.). No npm/yarn.
- Run `pnpm --filter @ck/dieter build` then `pnpm build:assets` before dashboard build so Studio has Dieter assets.
- Dev servers: site (3000), app (3001), embed (3002). API defaults to 3000 unless configured.
- Recreate Supabase interactions per `dbschemacontext.md`. Maintain RLS expectations (no service role on client).
- Testing: playwright smoke via `pnpm e2e:local`. Lint with `pnpm lint`, CSS lint `pnpm lint:css`.
- Deployment: Vercel projects (`c-keen-app`, `c-keen-site`, `c-keen-embed`, `c-keen-api`). Keep configurations in sync with `vercel.json` + documentation.
- No placeholders; if data unspecified, escalate in docs before coding.

Deliverables for rebuild
- Recreate directory structure above, matching file responsibilities and contracts.
- Ensure Studio shell, marketing workflows, embed runtime, and API endpoints match documented behavior.
- Regenerate Dieter assets via scripts; do not version control dist besides expected README.
- Rehydrate Supabase RPCs/functions referenced (e.g., `create_widget_with_instance`) according to DB Truth.
- Restore tests/harnesses exactly to avoid regressions.

Execute with discipline, keep communication concise, and align everything with documentation authority order.
