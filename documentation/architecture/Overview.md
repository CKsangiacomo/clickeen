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
policy files, routes, and storage folders are product artifacts agents can
understand and operate. The intelligence lives in the agents and in
their ability to operate the structured substrate through named authorities.

The architecture exists to protect that model:

- product artifacts are structured, typed, and readable by agents;
- named authorities own product boundaries;
- runtime storage follows ownership;
- agents operate through those authorities instead of hardcoded legacy
  pipelines;
- invalid or unavailable truth fails explicitly.

Named Clickeen authorities form a closed, trusted system. The authority that
produces a structured artifact owns its correctness; downstream Clickeen
services consume that artifact directly instead of adding another semantic
guard, validator, allowlist, filter, or repair layer. Authentication,
authorization, and raw external-input acceptance remain at their ingress
boundaries.

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
- A Widget's unique software is its structured contract plus mandatory Core
  HTML/CSS/JavaScript. It uses shared Clickeen services through uniform contracts;
  those services do not absorb Widget meaning.
- Users create widget instances in Roma/Bob and save them in their account.
- Every tier may use every Widget and retain editable instances. Publication
  capacity is separate and enforced only on Publish through
  `instances.published.max`; Free may publish and serve one instance. One
  account-scoped Tokyo transition makes overlapping Publish requests
  first-wins while Republish consumes no additional slot.
- Tier 1 deliberately expands product features while retaining one published
  instance; Tier 2 is intentionally the first multi-publish tier.
- Bob is an editor. Open/edit work is browser memory. Save is the persistence
  boundary.
- Roma is the account app. Roma routes the user to the current account,
  enforces tier/product policy, and saves account work through owner services.
- Tokyo-worker stores and serves account runtime files in R2.
- Berlin owns authentication and account session bootstrap.
- San Francisco owns governed model execution.
- Built agents live under `agents/<name>` and operate their product boundary.
- Clickeen admin work uses the normal admin account.

### Widget Software And Shared Services

```text
Widget software
├── structured contract
├── Core HTML
├── Core CSS
├── mandatory Core JavaScript for Widget behavior
└── declared shared-capability use
         │
         ▼
Clickeen shared system
├── Stage / Pod / Header
├── Bob editing
├── Roma account commands and materialization
├── localization, assets, connectors, and integrations
└── Tokyo storage and Edge serving
```

Bob is one shared editing service for every Widget. Roma is one shared
current-account and materialization service for every Widget. The same service
contract is used regardless of the Widget's purpose. A missing capability is
added generically for every applicable Widget; a shared service never branches
on Widget identity or interprets Widget-specific paths.

Tier limits and upsells are one such shared capability. The system owns the
account's current plan, entitlement values, eligible target plan, and CTA. The
Widget contract contributes only the mapping from a generic entitlement to its
unique coordinate plus a complete localized contextual message:

```text
Widget limits.json binding -> Bob generic edit gate
                                  │
                                  └-> denied { capability, messageId } ─┐
Widget upsell/{locale}.json exact template ────────────────────────────┼─> Roma shared Popup composition
system current/target plan ────────────────────────────────────────────┘              │
                                                                         system-owned CTA scaffold
```

For Bob-local editing, the generic edit boundary blocks the denied mutation
before changing browser-memory state and carries the exact context to Roma.
For Roma-native commands, Roma applies account policy at the command boundary.
There is one Roma-hosted upsell surface using Dieter Popup mechanics. Core,
Save, materialization, and Tokyo-worker have no tier/upsell responsibility and
do not recheck the decision.

The surface is multi-source while each datum has one owner. Bob and Roma do not
invent Widget copy or generic fallback reasons, and Widgets do not provide
plan names, pricing, CTAs, Popup behavior, or billing destinations.

New creates no instance and writes no source. First Save creates editable
source and later Save updates it. Only explicit allowed Publish performs the
expensive package-generation work once:

```text
exact saved logical instance state + explicit allowed Publish
  shared Header/Stage/Pod/capability values
  + exact Widget Core values
+ shared Widget frame
+ Core HTML/CSS/JavaScript
-> Roma generic materializer
-> complete semantic index.html
-> complete styles.css
-> mandatory runtime.js with Widget and shared visitor behavior
-> Tokyo-worker exact R2 write
```

Tokyo-worker then serves the exact stored logical package members at the Edge. For a
non-base request it expresses the trusted exact overlay into that semantic
HTML before returning it. Initial selected-locale content is therefore complete
before JavaScript. Mandatory Widget-owned JavaScript adds behavior; it does not
construct the first meaningful page, host, or serve the
Widget or orchestrate the shared system.

The authority boundary is deliberate: Widget and shared source define the
product software; Bob owns the complete unsaved instance document;
Roma's Widget-neutral materializer is the sole generator of the served package
contents; Tokyo-worker only stores and serves those bytes. The physical source
is one atomic `instance.source.json` containing metadata, config, and content;
Bob and materialization operate on that same complete logical instance.

Local implementation state: all five current Widgets implement the four PRD
129 phases. New composes a non-persisted browser draft; first Save creates
source; later Save updates source; Duplicate creates an immediate saved
unpublished copy; explicit Publish alone generates the package; and
Tokyo-worker applies requested locale overlays to semantic HTML at the Edge.
Roma owns publication controls in Widgets and its shared Builder header; Bob
owns editing and Save only. The Builder header uses the same Dieter/Roma
grammar and vertical rhythm as every other Roma domain, selecting only the
full-width geometry required by Bob's canvas. The corrected lifecycle and
background cache-eviction flow is deployed from commit `a6678966`. Cloud-dev
Worker health, Roma and Bob
reachability, authenticated saved-instance Builder open, non-persisting
New-open inventory truth, live Copilot streaming, and public `dev.clk.live`
package serving passed technical verification on 2026-08-19; owner QA remains
pending.

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
| Public package generation | Roma generic Widget materializer | `@clickeen/ck-runtime-materializer` invoked only on explicit allowed Publish |
| Account runtime storage | Tokyo-worker | `tokyo-worker/` over Tokyo R2 |
| Product widget software | Git-authored Tokyo product root | `tokyo/product/widgets/`, including Core, structured contracts, ToolDrawer labels, and Widget-owned upsell messages, deployed to `product/widgets/` |
| Public widget serving | Tokyo-worker public serving | logical package members from the instance's atomic published `serve-state.json` |
| Relational account/support data | Michael/Supabase | `supabase/migrations/` and service-owned routes |
| Model execution | San Francisco | `sanfrancisco/` |
| Product Copilot brain | Product Copilot Worker | `agents/product-copilot/` |
| Translation brain | Translation Agent Worker | `agents/translation-agent/` |
| Design system | Dieter | `dieter/` source; only `dieter/icons/svg/**` is deployed to the R2 `dieter/` root |
| Global Clickeen fonts | Git-authored Tokyo font source | deployed to the R2 `fonts/` root and available to every account |
| Marketing/demo pages | Prague | `prague/` and `prague/` R2 root |
| Internal cockpit | DevStudio | `admin/` |

No service should rediscover an authority already minted by the owner for a
normal product flow. When a boundary needs proof, it uses the named product
token/capsule/grant for that boundary.

An authority token proves that an external caller may enter a boundary. It is
not permission for downstream Clickeen services to re-check the semantic shape
of system-produced artifacts.

## System Map

| System | Runtime | Role |
| --- | --- | --- |
| Roma | Cloudflare Pages / Next.js | Account app, Builder host, account routes |
| Bob | Cloudflare Pages / Next.js | Builder editor for one opened account instance |
| Berlin | Cloudflare Worker | Auth/session/account bootstrap |
| Tokyo-worker | Cloudflare Worker + R2 | Account storage boundary and public file serving |
| Tokyo R2 | Cloudflare R2 | Product roots and account runtime storage |
| San Francisco | Cloudflare Worker + KV/R2 | Governed model execution and Prague l10n logs |
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
fonts/
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
      instance.source.json
      overlays/
        locales/
          {locale}.json
      serve-state.json
```

`instance.source.json` is the atomic source/visibility record. First Save writes
the initial unpublished `serve-state.json` first and source last; listings
recognize only exact source-record keys. Save and Rename each replace source in
one PUT. A published `serve-state.json` atomically contains `status`,
`publishedAt`, and the exact `publicPackage`
`{ indexHtml, stylesCss, runtimeJs }`. Tokyo-worker exposes those members at
the public `index.html`, `styles.css`, and `runtime.js` paths. They are not
separate R2 objects, so publication cannot split package bytes from status.

The non-account roots are git-authored deploy artifacts:

- `product/widgets/**` for widget software;
- `dieter/**` for design-system artifacts;
- `fonts/special/**` for global Clickeen font files available to every account;
- `prague/**` for Prague content/media.

Root `widgets/`, `public/`, `published/`, and `l10n/` are not storage
authorities.

## Product Flows

### Builder Open/Edit/Save

```text
Roma resolves current account/session
-> Roma opens one account instance through Tokyo-worker
-> Roma sends Bob one ck:open-editor payload containing source plus
   deploy-built Widget software, not a stored public package
-> Bob edits and previews one complete logical instance in browser memory
-> User saves
-> Roma prepares and submits the complete editable source through
   Tokyo-worker
-> Tokyo-worker replaces the atomic instance.source.json
```

For First Save, Roma reads the exact current account `baseLocale`, persists it
with the new source, and includes it with the minted instance ID in the HTTP
201. Bob adopts both from that existing Save result into its session
`meta`/`translationSetup`; Roma does not reopen Bob or introduce another
message. This aligns Bob with the locale committed by that Save. It does not
serialize First Save with a simultaneous account-locale PATCH, which remains a
separate cross-authority race.

The Save ingress has two exact shapes. First Save carries `{ widgetType,
config }` because no saved instance identity exists yet. Existing Save is
addressed by the account/instance route and carries `{ config }` only. Roma
requires the browser payload and `config` to be records, loads the exact
account-scoped saved list fact from Tokyo, and uses its stored `widgetType` to
select the compiled artifact. It does not accept, compare, or revalidate a
caller Widget type on existing Save.

Bob does not own persistence. Tokyo-worker does not infer widget meaning from
saved source or generate Widget code. Roma does not mutate Widget semantics.
Workspace preview is temporary Bob editing output from Widget software plus the
current draft. It neither reads nor defines the published package, and public
`runtime.js` has no Bob editing role.
Roma trusts Bob's exact browser-memory state. Save does not materialize a
public package. On a later explicit allowed Publish, Roma is the sole authority
that materializes the complete static package; Tokyo-worker trusts and
physically stores the result.

### Existing-Instance Commands And Widget Publish

Tokyo-worker routes every existing-instance Save, Rename, Publish/Republish,
Unpublish, and Delete through the account's one lifecycle-fenced
`AccountPublicationCoordinator`. First Save and Duplicate create new
coordinates and do not enter this existing-instance critical section. The
coordinator admits one command at a time; an overlap receives HTTP 409
`coreui.errors.instance.commandInProgress` and makes no mutation.

Every existing Save/Rename makes source `updatedAt` strictly later than both
the prior `updatedAt` and any `publishedAt`. Publish carries Roma's exact
`sourceUpdatedAt`, re-reads source inside the coordinator, and returns HTTP 409
`coreui.errors.instance.sourceChanged` before publication if it no longer
matches. Successful Publish/Republish writes `publishedAt` strictly later than
both the exact source coordinate it commits and the prior `publishedAt`. Tokyo
is the single timestamp writer; consumers compare these authoritative
coordinates without validating or repairing them.

Delete has one product commit: Tokyo deletes the exact
`instance.source.json` visibility anchor. A failed anchor delete fails the
command and leaves the instance visible. Once the successful Delete response
exists, Tokyo schedules residual instance-prefix cleanup through `waitUntil`.
Cleanup absence, throw, rejection, partial completion, or pending work cannot
change that response. Any remaining bytes are unreachable and do not count
toward the account asset quota.

```text
User explicitly Publishes an exact saved instance
-> Roma fast-prechecks instances.published.max from current list facts
-> a request that passes invokes Roma's Widget-neutral materializer once
-> materializer generates index.html + styles.css + runtime.js
-> Tokyo-worker routes the final command to the account's one lifecycle-fenced Durable Object coordinator
-> that coordinator reads exact publication truth and applies Roma's exact limit
-> Republish proceeds without a new slot; the first allowed Publish stores the package and published state
-> Tokyo ends coordination and returns the product result
-> Tokyo's default Worker entrypoint schedules best-effort eviction through the
   exact account-instance Cache-Tag without awaiting or inspecting it
```

The normal Roma capacity denial is HTTP 402 before materialization. In the rare
overlap after that fast precheck, the contender may finish transient in-memory
materialization, but the active per-account Tokyo coordinator returns the same
generic HTTP 409 `coreui.errors.instance.commandInProgress` used for every
overlapping existing-instance command. It writes no contender package,
publication state, or cache mutation. After the winner commits, a later attempt
reads the new published count and receives the existing HTTP 402 capacity
denial. Editable source is unchanged in every Publish outcome. Before R2 work,
the coordinator touches its own storage only to activate Cloudflare's
shutdown/replacement fencing; it keeps no durable policy, count, package, or
publication data. Per-instance `serve-state.json` is the sole atomic package
and publication truth.

Cache eviction is not part of publication truth or the product result. Missing
cache context, synchronous scheduling failure, rejection, `success:false`, or
an indefinitely pending purge cannot change a successful Publish, Republish,
Unpublish, Delete, or overlay mutation response. Generated package responses
use bounded freshness with `must-revalidate`, so correctness never depends on
successful eviction. No product surface reports, retries, or reasons about
cache state.

### Public Widget Serving

```text
Visitor requests https://clk.live/{accountPublicId}/{instanceId}
-> Tokyo-worker public route host-gates the request
-> Tokyo-worker reads the atomic serve-state from R2
-> Tokyo-worker returns its requested logical package member or 404
```

Visitor requests do not call models, read Supabase, compose widgets from
authoring source, or repair missing artifacts. The stored logical `indexHtml`
already contains complete semantic base-locale content. A non-base response applies
the exact stored overlay at the Edge and therefore contains complete semantic
selected-locale content. Mandatory `runtime.js` owns Widget and shared visitor
behavior and is not required to create initial content, localize, host, or serve the
instance.

Cloud-dev public serving uses:

```text
https://dev.clk.live/{accountPublicId}/{instanceId}
```

Production public serving uses:

```text
https://clk.live/{accountPublicId}/{instanceId}
```

The pre-GA storage cutover is complete for all four legacy saved cloud-dev
instances under `CLICKEEN`. Their source records were cut over and the two
intended-public instances were Republished through Roma. There is no legacy
read fallback or migration-on-read; retained split legacy objects are
unreachable.

### Account Assets

```text
Bob/Roma asset UI
-> Roma account asset route
-> Tokyo-worker asset operation
-> accounts/{accountPublicId}/assets/{filename}
```

See `documentation/architecture/AssetManagement.md` for the full asset
contract.

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
-> San Francisco /model/turn (stream mode)
-> provider selected by signed grant
```

Translation Agent:

```text
Roma translation operation
-> Translation Agent Worker
-> San Francisco /model/turn (structured mode)
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

Runtime code, migrations, stored data, and deployed Cloudflare configuration
prove what is implemented now. The architecture tenets define canonical product
law. When those differ, this overview and the owning service manual name the
implementation mismatch explicitly; current code does not silently redefine
the architecture, and documentation does not pretend the correction is live.
