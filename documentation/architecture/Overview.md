# Clickeen Architecture Overview

STATUS: CURRENT SYSTEM OPERATOR SPEC

This document is the current architecture map for Clickeen. It is not a PRD,
roadmap, launch plan, or historical execution record.

For first-read context, use `documentation/architecture/CONTEXT.md`. For
surface-specific behavior, use the owning detail doc under `documentation/`.

## What Clickeen Is

Clickeen is an agent-operated product.

The codebase is deliberately lean and built around structured, AI-legible
artifacts so agents can operate the system directly. Agents are not features
bolted onto a SaaS. Agents are the operators, and the structured product
substrate is what they operate.

Legacy SaaS puts most product intelligence into a large application codebase.
Humans operate that codebase through UIs, APIs, dashboards, workflows, and admin
tools. AI is then added as a feature: a copilot, assistant, model call,
automation, or workflow helper. That model grows orchestration code,
compatibility paths, validation layers, state machines, and fallback behavior.

Clickeen is the opposite. The system stays lean, structured, typed, and
AI-legible. Widget specs, control maps, field maps, account files, overlays,
page files, policy files, routes, and storage folders are product artifacts
agents can understand and operate. The intelligence lives in the agents and in
their ability to operate the structured substrate through named authorities.

The architecture exists to protect that model:

- product artifacts are structured, typed, and readable by agents;
- named authorities own product boundaries;
- runtime storage follows ownership;
- agents operate through those authorities instead of hardcoded legacy
  pipelines;
- invalid or unavailable truth fails explicitly.

Content exists inside this model. Widgets, pages, emails, reports, feeds,
locale overlays, and public runtime surfaces carry content, but Clickeen is not
defined as a CMS or a generic content host. Clickeen structures content and the
system around it so agents can operate the product.

## Product Law

Clickeen is a simple account product.

- One user belongs to one account.
- `accounts.id` is the compact account product/storage coordinate.
- `accountPublicId` is the API/embed/authz field name for that same value.
- Widgets are software and live in the system.
- Users create widget instances in Roma/Bob and save them in their account.
- Pages are account-owned stacks of saved instances.
- Bob is an editor. Open/edit work is browser memory. Save is the persistence
  boundary.
- Roma is the account app. Roma routes the user to the current account,
  enforces tier/product policy, and saves account work through owner services.
- Tokyo-worker stores and serves account runtime files in R2.
- Berlin owns authentication and account session bootstrap.
- San Francisco owns governed model execution.
- Built agents live under `agents/<name>` and operate their product boundary.
- Clickeen admin work uses the normal admin account.

The active cloud-dev admin account coordinate is:

```text
CLICKEEN
```

## Named Authorities

| Concern | Authority | Current runtime/source |
| --- | --- | --- |
| Authentication and session bootstrap | Berlin | `berlin/` |
| Current account and account product routes | Roma | `roma/` |
| Builder editing state | Bob | `bob/` browser-memory session |
| Account runtime storage | Tokyo-worker | `tokyo-worker/` over Tokyo R2 |
| Product widget software | Git-authored Tokyo product root | `tokyo/product/widgets/` deployed to `product/widgets/` |
| Public widget serving | Tokyo-worker public serving | generated instance files under `accounts/{accountPublicId}/...`; page public serving is disabled until Roma writes page packages |
| Relational account/support data | Michael/Supabase | `supabase/migrations/` and service-owned routes |
| Model execution | San Francisco | `sanfrancisco/` |
| Product Copilot brain | Product Copilot Worker | `agents/product-copilot/` |
| Translation brain | Translation Agent Worker | `agents/translation-agent/` |
| Design system | Dieter | `dieter/`, `tokyo/product/dieter/`, `dieter/` R2 root |
| Marketing/demo pages | Prague | `prague/` and `prague/` R2 root |
| Internal cockpit | DevStudio | `admin/` |

No service should rediscover an authority already minted by the owner for a
normal product flow. When a boundary needs proof, it uses the named product
token/capsule/grant for that boundary.

## System Map

| System | Runtime | Role |
| --- | --- | --- |
| Roma | Cloudflare Pages / Next.js | Account app, Builder host, account routes |
| Bob | Cloudflare Pages / Next.js | Builder editor for one opened account instance |
| Berlin | Cloudflare Worker | Auth/session/account bootstrap |
| Tokyo-worker | Cloudflare Worker + R2 | Account storage boundary and public file serving |
| Tokyo R2 | Cloudflare R2 | Product roots and account runtime storage |
| San Francisco | Cloudflare Worker + D1/KV/R2/Queues | Governed model execution and trace/outcome sink |
| Product Copilot | Cloudflare Worker | Builder Product Copilot agent home |
| Translation Agent | Cloudflare Worker | Translation Agent home |
| Prague | Cloudflare Pages / Astro | Marketing, gallery, demo/funnel pages |
| DevStudio | Cloudflare Pages | Internal cockpit through the normal admin account |
| Michael | Supabase Postgres | Relational account/user/support data |
| Dieter | Git source + Tokyo artifacts | Design tokens/components |

Public widget serving is generated static artifact delivery through `clk.live`
/ `dev.clk.live` backed by Tokyo-worker and R2.

## Storage Ownership

Tokyo R2 has these current roots:

```text
accounts/
dieter/
product/
prague/
```

Only `accounts/` is runtime-managed account storage. It owns:

```text
accounts/{accountPublicId}/
  assets/
    {filename}
  instances/
    {instanceId}/
      instance.config.json
      instance.content.json
      overlays/
        locales/
          {locale}.json
      serve-state.json
      index.html
      styles.css
      runtime.js
  pages/
    {pageId}/
      source.json
      serve-state.json              # when submitted
      index.html                    # when submitted
      styles.css                    # when submitted
      runtime.js                    # when submitted
```

The non-account roots are git-authored deploy artifacts:

- `product/widgets/**` for widget software;
- `product/roma/**` for Roma public i18n/static support artifacts;
- `dieter/**` for design-system artifacts;
- `prague/**` for Prague content/media.

Root `widgets/`, `public/`, `published/`, and `l10n/` are not storage
authorities.

## Product Flows

### Builder Open/Edit/Save

```text
Roma resolves current account/session
-> Roma opens one account instance through Tokyo-worker
-> Roma sends Bob one ck:open-editor payload
-> Bob edits in browser memory
-> User saves
-> Roma submits the saved instance/package through Tokyo-worker
-> Tokyo-worker stores the exact submitted account files
```

Bob does not own persistence. Tokyo-worker does not infer widget meaning from
saved source. Roma does not mutate widget semantics.

### Public Widget Serving

```text
Visitor requests https://clk.live/{accountPublicId}/{instanceId}
-> Tokyo-worker public route host-gates the request
-> Tokyo-worker reads serve-state and generated browser files from R2
-> Tokyo-worker returns stored public artifacts or 404
```

Visitor requests do not call models, read Supabase, compose widgets from
authoring source, or repair missing artifacts.

Cloud-dev public serving uses:

```text
https://dev.clk.live/{accountPublicId}/{instanceId}
```

Production public serving uses:

```text
https://clk.live/{accountPublicId}/{instanceId}
```

### Account Assets

```text
Bob/Roma asset UI
-> Roma account asset route
-> Tokyo-worker asset operation
-> accounts/{accountPublicId}/assets/{filename}
```

See `documentation/architecture/AssetManagement.md` for the full asset
contract.

### Account Pages

Pages are account-owned stacks of saved instances. Roma owns page source rules
and product actions. Tokyo-worker stores the exact page source/package files
that Roma submits under:

```text
accounts/{accountPublicId}/pages/{pageId}/
```

Page publish and public page serving are currently disabled. Tokyo-worker parses
page public routes but returns `404`, and internal publish returns
`coreui.errors.page.publishUnavailable` until Roma writes page packages.

### Translation Overlays

Translation overlays are account instance content artifacts:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

The Translation Agent translates active non-base locales and writes exact locale
overlay files through Tokyo-worker. Roma owns account locale settings and tier
authority. Tokyo stores and serves exact files; it does not infer locale
meaning.

See:

- `documentation/architecture/OverlayArchitecture.md`
- `documentation/architecture/BabelProtocol.md`
- `documentation/ai/agents/translation-agent.md`

### AI Agent Execution

Product Copilot:

```text
Bob CopilotPane
-> Roma account Copilot route
-> Product Copilot Worker
-> San Francisco /model/chat
-> provider selected by signed grant
```

Translation Agent:

```text
Roma translation operation
-> Translation Agent Worker
-> San Francisco /model/chat
-> Tokyo-worker overlay write
```

San Francisco executes signed model requests. It does not execute agent brains,
own account policy, write account files, or switch providers/models silently.

## Content Source Authority

Content is a major class of product artifact, not the top-level architecture
definition.

Agents treat content according to source authority:

| Source | Agent authority |
| --- | --- |
| Human-generated content | Recommend, propose, translate, optimize, restructure, and apply user-approved changes. |
| AI-generated content | Operate autonomously inside approved product rules. |
| Integration-sourced content | Use, summarize, extract, route, display, analyze, and derive from it; do not rewrite source truth except through an explicit authorized integration write path. |

The rule is source-truth fidelity. Around content, agents also operate widgets,
pages, reports, analytics, support tickets, locale overlays, runtime packages,
account assets, routes, and storage folders.

## Runtime And Deploy Evidence

Cloud-dev runtime evidence comes from deployed cloud-dev surfaces:

```text
https://roma.dev.clickeen.com
https://bob.dev.clickeen.com
https://tokyo.dev.clickeen.com
https://berlin.dev.clickeen.com
https://dev.clk.live
https://prague.dev.clickeen.com
https://devstudio.clickeen.com
https://sanfrancisco.dev.clickeen.com/healthz
https://product-copilot-dev.clickeen.workers.dev/healthz
```

Translation Agent has no public human runtime URL. Verify it through GitHub
Actions `cloud-dev workers deploy` evidence plus the Roma translation smoke path.

Use the owning deployment path:

| Surface | Deploy/evidence path |
| --- | --- |
| Bob/Roma/Prague Pages | Cloudflare Pages Git-connected build from `main` |
| DevStudio Pages | Cloudflare Pages project plus repo Cloudflare API checks |
| Berlin/San Francisco/Tokyo-worker/Product Copilot/Translation Agent | GitHub Actions `cloud-dev workers deploy` |
| Tokyo product roots in R2 | `cloud-dev workers deploy` R2 sync step |
| Supabase schema | reviewed SQL migration plus migration deploy workflow |
| R2 object reads/writes | repo R2 commands after `pnpm cf:preflight` |
| Pages/DNS/config reads/writes | repo Cloudflare API commands after `pnpm cf:api:preflight` |

See:

- `documentation/engineering/CloudflareOperations.md`
- `documentation/engineering/CloudflarePagesCloudDevChecklist.md`
- `documentation/architecture/RuntimeProfiles.md`

## Current Detail Docs

| Area | Detail doc |
| --- | --- |
| Current system context | `documentation/architecture/CONTEXT.md` |
| Architecture tenets | `documentation/architecture/Tenets.md` |
| Account model | `documentation/architecture/AccountManagement.md` |
| Account assets | `documentation/architecture/AssetManagement.md` |
| Translation overlays | `documentation/architecture/OverlayArchitecture.md`, `documentation/architecture/BabelProtocol.md` |
| Runtime profiles | `documentation/architecture/RuntimeProfiles.md` |
| Cloudflare operations | `documentation/engineering/CloudflareOperations.md` |
| Cloudflare Pages setup | `documentation/engineering/CloudflarePagesCloudDevChecklist.md` |
| Roma | `documentation/services/roma.md` |
| Bob | `documentation/services/bob.md` |
| Tokyo-worker | `documentation/services/tokyo-worker.md` |
| Tokyo storage/deploy | `documentation/services/tokyo.md` |
| Berlin | `documentation/services/berlin.md` |
| Prague | `documentation/services/prague/prague-overview.md` |
| DevStudio | `documentation/services/devstudio.md` |
| AI plane | `documentation/ai/README.md` |
| San Francisco | `documentation/ai/sanfrancisco.md` |
| Built agents | `documentation/ai/agents/` |
| Product strategy | `documentation/strategy/WhyClickeen.md` |

When code and docs disagree, runtime code, migrations, deployed Cloudflare
configuration, and service docs win over this overview. Fix the stale doc with
the behavior change or immediately after verifying the behavior.
