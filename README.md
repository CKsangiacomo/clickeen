# Clickeen

Clickeen is a lean, schema-structured, agent-operated product system for
content surfaces, widgets, pages, assets, translations, AI operations, and
public runtime packages.

This is not a legacy SaaS app with AI bolted on. The product substrate is
structured so agents can operate it directly through named authorities,
explicit routes, typed contracts, and storage coordinates. The intelligence
lives in the agents operating the system, not in hardcoded pipelines wrapped
around model calls.

## Architecture

Clickeen is organized around authorities:

- **Berlin** owns identity, session, account bootstrap, and signed account
  authorization capsules.
- **Roma** owns the authenticated account shell, account policy, Builder host,
  and product mutation routes.
- **Bob** owns browser-memory Builder/editor draft state. Bob does not own
  persistence.
- **Tokyo-worker** owns the R2 storage boundary and public serving boundary.
- **Tokyo R2** stores deploy-managed product roots and account-owned product
  files.
- **San Francisco** owns governed model execution.
- **Product Copilot** owns Builder draft reasoning.
- **Translation Agent** owns saved-instance translation overlay generation.
- **Dieter** owns design tokens, primitives, and build artifacts.
- **Prague** owns the marketing/static surface.
- **Michael/Supabase** owns relational account, user, invitation, locale,
  registry, and status rows.

## Core Flow

The common widget flow is:

1. Berlin authenticates the user and resolves account authorization.
2. Roma resolves the current account, role, policy, and product route.
3. Bob opens one Builder draft and edits browser-memory state.
4. Roma validates policy, compiles the widget package, and materializes source
   artifacts on save.
5. Tokyo-worker stores the exact submitted account files in R2.
6. Publish marks the stored package as public.
7. Public serving reads stored package files only.

Public runtime does not perform visitor-time model calls, Supabase reads,
widget recomposition, translation fallback, or storage repair.

AI operations require explicit grants and run through agent homes plus San
Francisco. There is no provider/model fallback in product requests.

## Repository Map

- `berlin/` - auth, sessions, bootstrap, account authorization capsules.
- `roma/` - account shell, Builder host, product routes, policy gates.
- `bob/` - Builder editor, compiled widget panels, browser-memory drafts.
- `tokyo-worker/` - R2 storage boundary, public serving, internal product
  routes.
- `tokyo/product/` - deploy-managed widget, Dieter, Roma, Prague, and font
  artifacts.
- `sanfrancisco/` - governed model execution and AI telemetry.
- `agents/product-copilot/` - Builder draft reasoning agent.
- `agents/translation-agent/` - saved-instance overlay translation agent.
- `packages/ck-contracts/` - shared product contracts and typed primitives.
- `packages/ck-policy/` - entitlement, policy, authz, and AI runtime policy.
- `packages/widget-shell/` - shell-owned widget defaults, paths, and runtime
  helpers.
- `packages/l10n/` - locale and localization helpers.
- `dieter/` - design-system source tokens and build scripts.
- `prague/` - marketing/static site.
- `admin/` - DevStudio internal cockpit and toolbench.
- `documentation/` - current architecture, service, engineering, capability,
  AI, and widget docs.
- `Execution_Pipeline_Docs/` - planning, PRDs, research, and execution
  pipeline materials.

## Product Law

- One user belongs to one account.
- One account has many users.
- `users.role` is the user's role in that account.
- `accountPublicId` is the product/storage coordinate exposed to product
  routes.
- The cloud-dev admin account coordinate is `CLICKEEN`.
- Product mutations use product routes and named service boundaries. Do not
  mutate account product data directly in R2 or Supabase.
- Human-generated, AI-generated, and integration-sourced content have different
  source authorities. Preserve source truth and mutate only through the owning
  authority.

## Storage Truth

Account-owned files live under the account coordinate:

```text
accounts/{accountPublicId}/assets/{filename}
accounts/{accountPublicId}/instances/{instanceId}/...
accounts/{accountPublicId}/pages/{pageId}/...
```

Deploy-managed roots are separate:

```text
product/widgets/**
product/roma/**
dieter/**
fonts/**
prague/**
```

Do not introduce root storage namespaces such as `widgets/`, `public/`,
`published/`, or `l10n/`.

## Operating Rules

Before changing product-path code or data:

1. Read `AGENTS.md`.
2. Read `documentation/architecture/CONTEXT.md`.
3. Read the service/detail doc for the surface being changed.
4. Name the active authority for product surface, account/session coordinate,
   storage coordinate, route/API boundary, runtime/deploy surface, and
   verification surface.
5. Use Roma and Tokyo-worker product routes for account product mutations.
6. Use the documented Cloudflare and Supabase operation paths for managed
   services.
7. Keep diffs lean, structured, typed, and agent-operable.

## What Not To Build

- Do not build hardcoded service pipelines with an AI call in the middle and
  call them agents.
- Do not add broad registries, compatibility wrappers, fallback readers,
  repair jobs, phasing labels, or ceremony that turns the system into legacy
  SaaS.
- Do not silently substitute missing, invalid, stale, or unavailable truth.
- Do not treat corrupt stored state as missing/new/empty state.
- Do not mutate product data outside its named authority.

## Development

```bash
pnpm install
pnpm build:dieter
pnpm build
pnpm lint
pnpm typecheck
pnpm validate:widgets
```

Cloudflare and Supabase operations have separate gates and preflights. Use the
engineering docs before operating managed services.

## Start Here

- `AGENTS.md`
- `documentation/architecture/CONTEXT.md`
- `documentation/architecture/Overview.md`
- `documentation/architecture/Tenets.md`
- `documentation/services/README.md`
- `documentation/widgets/README.md`
- `documentation/engineering/CloudflareOperations.md`
- `documentation/engineering/SupabaseOperations.md`

## License

Internal Clickeen codebase.
