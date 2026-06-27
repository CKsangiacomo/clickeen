# Clickeen Agent Guidelines

This repo is an AI-native build. Agents win here by following current product
truth, executing through named authorities, and leaving documentation sharper
than they found it.

## What This System Is

Clickeen is an agent-operated product. This is the premise; read it before
anything below.

The codebase is deliberately lean and built around a structured, AI-legible
schema so that agents can operate the system directly. Agents are the
operators — they know what to do, where, and how, and they execute operations
on the structured substrate. Agents are not features bolted onto a SaaS. The
intelligence lives in the agents, not in hardcoded pipelines.

This is the moat. Legacy SaaS and incumbents have large, complex codebases that
humans operate through UIs and APIs, with AI added as a feature. Clickeen is the
opposite: a lean, schema-structured, AI-legible system that agents operate.
That operability is what competitors cannot copy without rebuilding from zero.

## Operating Model

Clickeen is operated by one human product owner/architect plus an AI workforce.

The human owns product direction, architecture judgment, and final authority.
AI coding and devops agents operate the repo, implementation, documentation,
verification, and managed-service workflows through the gates in this file.
Runtime product agents operate customer/product artifacts through named product
authorities.

Clickeen is still a self-serve SaaS for customers, but the company and product
are designed around agent operation rather than a large human operations team.

For any agent (AI or human) working in this tree:

- The first instinct is: keep the system lean and agent-operable. A change
  either increases agent-operability or adds legacy weight.
- A hardcoded flow with an AI call in the middle (service A calls service B,
  validates, writes) is a legacy pipeline, not an agent. Do not build it and
  call it an agent.
- Do not add framework machinery, compatibility wrappers, broad registries,
  phasing labels ("V1", "floor", "ship the wire first"), or ceremony. These
  turn this into a legacy SaaS and destroy the moat.
- The structured schema (widget specs, control/field maps, the overlay model,
  markers, product-law ownership boundaries) is the substrate agents operate.
  Keep it structured, typed, and AI-legible.
- When unsure: does this change let a smart agent operate the system better, or
  does it hardcode a human-written flow around a model call? Prefer the former.

The gates and discipline below exist to protect agent-operability — not to
manage a legacy codebase.

## Content Source Authority

Clickeen serves content. That is the end product of websites, widgets, pages,
emails, reports, feeds, and future runtime surfaces.

Content in Clickeen has three source authorities:

1. Human-generated content: copy, pages, blogs, emails, widget text, product
   descriptions, support articles, and other content authored by a person.
2. AI-generated content: content written by agents from human direction,
   account rules, brand rules, product rules, or approved system direction.
3. Integration-sourced content: reviews, feeds, listings, CRM rows, analytics,
   support data, aggregated records, and anything Clickeen pulls from another
   system.

Agents treat those sources differently:

- For human-generated content, agents may recommend improvements, propose edits,
  translate, optimize, restructure, and apply user-approved changes. Human
  intent remains the source authority.
- For AI-generated content, agents may operate autonomously inside the approved
  product rules because the content is already agent-produced under Clickeen
  direction.
- For integration-sourced content, agents must not rewrite the source truth.
  They may use it, summarize it, extract from it, route it, display it, analyze
  it, and build product experiences around it. They may mutate it only through
  an explicit authorized integration write path. Source truth is preserved;
  derivatives and syncs are the work.

The rule across all three sources is source-truth fidelity, not touch/no-touch:
agents derive from and operate on content according to its source authority; a
change to source truth is authorized by whoever owns it — the human, the
product tenets, or the external
system.

Around the content, agents operate the Clickeen system itself: widgets, pages,
reports, analytics, support tickets, locale overlays, runtime packages, account
assets, routes, and storage folders. Different agents own different operational
domains, but the rule is the same: operate structured artifacts directly through
named authorities.

This is the fundamental difference from legacy SaaS. Legacy SaaS builds heavy
application code and adds AI as a feature. Clickeen structures content and the
system around it so agents can operate the product.

## Read Order

Before touching product-path code or data, read:

1. `documentation/architecture/CONTEXT.md`
2. `documentation/strategy/WhyClickeen.md`
3. The detail doc for the surface being changed
4. The runtime code that owns the behavior

Examples:

| Work Area                | Required Detail Doc                                        |
| ------------------------ | ---------------------------------------------------------- |
| Account assets           | `documentation/architecture/AssetManagement.md`            |
| Roma routes or shell     | `documentation/services/roma.md`                           |
| Bob Builder              | `documentation/services/bob.md`                            |
| Tokyo-worker operations  | `documentation/services/tokyo-worker.md`                   |
| Cloudflare/R2 operations | `documentation/engineering/CloudflareOperations.md`        |
| Supabase/schema changes  | `documentation/engineering/SupabaseOperations.md`          |
| Widget behavior          | relevant `documentation/widgets/**` doc plus widget source |

## Authority Gate

Before making a product-path change, name the active authority for:

- Product surface
- Account/session coordinate
- Storage coordinate
- Route/API boundary
- Runtime/deploy surface
- Verification surface

For account assets, the current authority chain is:

```text
Roma current account -> accountPublicId -> Roma account asset route -> Tokyo-worker -> accounts/{accountPublicId}/assets/{filename}
```

The cloud-dev admin account coordinate is:

```text
CLICKEEN
```

## Plan Gate

Use a written checklist for cross-system changes, Cloudflare operations, remote
product data repair, or anything that touches shared product contracts.

The checklist must separate:

- Code changes
- Product data changes
- Deploy/runtime verification
- Documentation changes

If investigation changes any named authority, stop execution, restate the plan
with the corrected authority, then continue from the updated checklist.

## Execution Gate

Use product routes for product mutations.

- Account assets move through Roma account asset routes and Tokyo-worker.
- Account instances move through Roma account instance routes and Tokyo-worker.
- Account pages move through Roma account page routes and Tokyo-worker.
- Auth/account context comes from Berlin/Roma session bootstrap.

Remote Cloudflare operations use the repo command path from
`documentation/engineering/CloudflareOperations.md`.

Required preflight:

```bash
pnpm cf:preflight       # R2/Tokyo artifact operations
pnpm cf:api:preflight   # Pages, domains, DNS, Worker/Page config
```

If preflight fails, stop at that boundary and report the failed gate.

## DevOps Gate

Before claiming deploy or operating on managed services, identify the deploy or
operation path:

| Surface                           | Operation path                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------- |
| Bob/Roma/Prague Pages             | Cloudflare Pages Git-connected build from `main`                                  |
| DevStudio Pages                   | Cloudflare Pages project plus repo Cloudflare API commands for project/env checks |
| Berlin/San Francisco/Tokyo-worker | GitHub Actions `cloud-dev workers deploy`                                         |
| Tokyo product roots in R2         | `cloud-dev workers deploy` R2 sync step                                           |
| R2 object reads/writes            | repo Cloudflare R2 commands after `pnpm cf:preflight`                             |
| Pages/DNS/config reads/writes     | repo Cloudflare API commands after `pnpm cf:api:preflight`                        |
| Supabase schema                   | reviewed SQL migration plus `supabase migrations deploy` workflow; see `documentation/engineering/SupabaseOperations.md` |

Use GitHub Actions run status for Worker/R2 deploy evidence. Use Cloudflare
Pages project state and cloud-dev surface checks for Pages runtime evidence.
Use the Supabase migration workflow run for schema deployment evidence.

## Code/Data Separation

Treat source code and remote product data as different authorities.

Code change means:

- local diff
- tests/checks
- commit
- push
- deploy or build/runtime verification

Product data repair means:

- named product route or approved Cloudflare operation
- preflight when Cloudflare is involved
- API/R2 verification from the owning surface
- explicit final statement that the git repo changed or did not change

## Verification Gate

Verify through the owner of the truth:

| Concern                         | Verification                                                  |
| ------------------------------- | ------------------------------------------------------------- |
| Account assets visible to users | Roma `/api/account/assets` or Roma Assets UI                  |
| Account asset bytes/metadata    | repo R2 commands after `pnpm cf:preflight`                    |
| Account instances               | Roma account routes and Tokyo-worker evidence                 |
| Pages                           | Roma page routes and Tokyo-worker evidence                    |
| Pages app runtime               | Cloudflare Pages Git build state and cloud-dev surface checks |
| Worker/R2 deploy                | GitHub Actions worker deploy runs and R2 evidence             |
| Git state                       | local branch, tracking branch, remote branch                  |

Final verification must reconcile each authority touched by the task.

## Core Violation Audit

After every execution task, verify the result against these eight core
violations:

| ID  | Violation                  | Audit question                                                                                     |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------- |
| V1  | Silent substitution        | Did the change replace missing, invalid, stale, or malformed truth with an invented value?         |
| V2  | Silent healing             | Did the change normalize, coerce, repair, or rewrite invalid persisted/user state without failure? |
| V3  | Silent omission            | Did the change drop a required input, artifact, operation, edit, module, event, or policy?         |
| V4  | Fail-open control          | Did enforcement turn off when a dependency was missing, malformed, or unavailable?                 |
| V5  | Corruption-as-absence      | Did corrupt stored state become treated as missing, new, empty, ignored, or overwritten?           |
| V6  | Partial-success masquerade | Did the product claim full success after some requested work was dropped, rejected, or filtered?   |
| V7  | Masquerade/redress         | Did the same failing workflow continue under a different wrapper, name, path, retry, or log?       |
| V8  | Runtime test dependency    | Did normal product work start depending on tests, probes, helper checks, or validation rituals?    |

For product-path, cross-system, managed-service, deploy, or remote-data tasks,
use at least one subagent for an independent V1-V8 audit after implementation
and before final response. If subagent tools are unavailable, run the audit
locally and state that no independent subagent audit was available.

The final response must include the V1-V8 result when the task changed product
behavior, product data, deploy state, managed-service state, or shared
architecture docs.

## Documentation Discipline

Docs are part of done.

- `CONTEXT.md` stays short and current-system only.
- Detail docs own surface-specific behavior.
- PRDs, migrations, and service docs own history and execution detail.
- Confirmed doc/runtime mismatch is fixed with the behavior change that exposed it.

## Engineering Discipline

- Start from product behavior, then inspect file topology.
- Preserve working product behavior.
- Keep diffs scoped to the named authority and surface.
- Use existing local patterns and helpers before introducing new abstractions.
- Reuse Dieter tokens and primitives for UI work.
- Run focused checks for the changed surface; broaden checks when the blast
  radius crosses systems.

## Build And Check Commands

Install:

```bash
pnpm install
```

Build:

```bash
pnpm build:dieter
pnpm build
```

Checks:

```bash
pnpm lint
pnpm typecheck
pnpm --filter @clickeen/bob lint
pnpm --filter @clickeen/roma lint
```

Product runtime evidence comes from cloud-dev Cloudflare surfaces. Local app
commands are for isolated debugging.

## Final Response

End every execution task with a compact reconciliation:

- Files changed
- Checks run
- Commit/push/deploy state when code changed
- Product data state when remote data changed
- Verification result from the owning surface
- Remaining work, only when proven
