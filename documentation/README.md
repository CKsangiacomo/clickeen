# Documentation — How To Use (and Keep Current)

This folder is the primary knowledge base for working in the Clickeen repo (especially for AI coding agents). It is a **living reference**: it must be updated alongside code changes.

PRD 105 NOTE: the core docs use the current product-operation vocabulary and instance-folder/runtime authority from `Execution_Pipeline_Docs/03-Executed/105_Instance_Runtime_And_Verification_Batch/105__PRD__Instance_Folder_Tenets.md`.

Docs are not evidence that an unexecuted change is live. Runtime code, schema,
stored data, and deployed Cloudflare configuration prove current implementation;
architecture tenets define canonical product law. Current manuals record both
without letting implementation debt silently redefine the law.

Architecture tenets are current product law. When implementation has not yet
reached that law, current manuals must name the exact implementation mismatch
instead of either canonizing the debt or pretending the code already changed.
`Execution_Pipeline_Docs/` then owns the authorized correction plan and
execution evidence.

---

## Structure

```
documentation/
├── strategy/                 # WHY — Vision, moats, business model
│   ├── README.md            # Strategy routing and authority boundary
│   ├── WhyClickeen.md       # Canonical thesis and strategic moats
│   ├── Clickeen-Babel.md    # Babel/global-content moat
│   ├── GlobalReach.md       # Global-by-default strategy
│   ├── SchemaFirstApps.md   # Widget/Core substrate and future schema-first apps
│   └── MarketPosition.md    # Market narrative
│
├── architecture/             # HOW — Platform design, principles
│   ├── CONTEXT.md           # Current state, glossary, what exists
│   ├── AccountManagement.md # Canonical user/account/membership boundary
│   ├── Tenets.md            # Architectural principles
│   └── Overview.md          # Platform diagram, data flow
│
├── services/                 # RUNTIME SYSTEMS
│   ├── bob.md               # Editor
│   ├── roma.md              # Product shell + Builder host
│   ├── dieter.md            # Design system
│   ├── devstudio.md         # Human's cockpit for the AI-operated company
│   ├── tokyo.md             # Asset CDN
│   ├── tokyo-worker.md      # Account storage, assets, instances, translations, public artifacts
│   ├── michael.md           # Database schema
│   └── prague/              # Marketing surface
│       ├── prague-overview.md
│       ├── blocks.md
│       ├── layout.md
│       └── PraguePageAgentGuide.md
│
├── capabilities/             # CROSS-CUTTING FEATURES
│   ├── supernova.md         # NextGen web design effects
│   ├── seo-geo.md           # SEO/GEO platform
│   ├── localization.md      # i18n + l10n (runtime contract)
│   └── multitenancy.md      # Team/account model
│
├── ai/                       # AI PLANE + AGENT HOMES
│   ├── README.md            # AI taxonomy and product law
│   ├── sanfrancisco.md      # Governed model execution
│   ├── ombra.md             # Product AI layer / model strategy guardrail
│   ├── agents/
│   │   ├── product-copilot.md
│   │   └── translation-agent.md
│
├── engineering/              # OPERATOR RUNBOOKS
│   ├── UI/                    # Design-system and application-UI doctrine
│   │   ├── README.md           # UI documentation router
│   │   ├── components.md       # Dieter component contracts
│   │   ├── dieter.md           # Dieter system mechanics
│   │   └── *.md                # Accessibility, color, dialogs, interactions, motion, ops, surfaces, typography
│   ├── PlaywrightE2E.md      # Deployed-runtime browser evidence
│   ├── CloudflareOperations.md # R2, Pages, DNS, and deploy command paths
│   ├── CloudflarePagesCloudDevChecklist.md # Cloud-dev Pages/env/bindings
│   └── SupabaseOperations.md # Supabase schema migrations and DB runbook
│
└── widgets/                  # WIDGET OPERATOR MANUALS
    ├── README.md            # Widget docs map and authorities
    ├── authoring/           # Source contract, Bob controls, execution checklist
    ├── shared/              # Shell/Core and shared runtime utilities
    └── widgets/             # One operator spec per built widget
```

| Folder            | What It Answers                      |
| ----------------- | ------------------------------------ |
| **strategy/**     | High-level WHY and direction only    |
| **architecture/** | Current platform design and boundaries |
| **services/**     | Current product/runtime systems      |
| **capabilities/** | Current cross-system capabilities    |
| **ai/**           | Current AI plane and built agents    |
| **engineering/**  | Current runbooks, deploy ops, e2e evidence |
| **widgets/**      | Current widget contracts             |

Surface split to keep straight when reading the repo:
- `Roma` = account-scoped customer/member shell
- `DevStudio` = the one human's cockpit for governing an AI-operated company (see rendered truth, steer through named authorities)

---

## Documentation vs Execution_Pipeline_Docs (non‑equivalent)

There are **two doc roots** in the repo and they are intentionally different:

- `documentation/` = **current system truth**. It must match runtime code + schema + deployed config. If it drifts, fix it immediately.
- `documentation/strategy/` = **high-level vision and direction**. It may describe where Clickeen is going, but it must not define routes, schemas, worker names, storage paths, cron shapes, eval commands, execution slices, or acceptance criteria.
- `Execution_Pipeline_Docs/` = **process artifacts** (planning → executing → executed). It records intent, detailed future plans, reviews, migrations, history, and evidence.

Use `documentation/` for authoritative behavior; use `Execution_Pipeline_Docs/` for context on how/why decisions were made.

---

## AI-Native Operating Model (agent contract)

This repo is operated by **1 human architect + multiple AI dev teams**. The system is modular and contract-driven so AIs can work in parallel safely.

- **Modular surfaces:** widgets in `tokyo/product/widgets/`; services isolated under `bob/`, `roma/`, `admin/`, `prague/`, `tokyo-worker/`, `sanfrancisco/`.
- **Explicit contracts:** `spec.json`, adjacent Widget ToolDrawer label files,
  `editable-fields.json`, `limits.json`, Widget-owned `upsell/{locale}.json`,
  `*.allowlist.json`, PRDs, and service docs define what is safe to change. If
  it is not in a contract, assume it is unsafe.
- **Automation intent:** local support-stack changes are local only. Cloud-dev propagation is explicit (promote/deploy).
- **Agent expectation:** AIs must understand the end-to-end journey below. If you do not, stop and re-trace from code before editing.

### Widget Software And Shared Clickeen Services

A Widget is software built on Clickeen. Its structured contract and mandatory
Core HTML/CSS/JavaScript own what that Widget is and does. Stage, Pod, Header, Bob
editing, Roma account operations and materialization, Tokyo storage and
serving, localization, assets, connectors, integrations, and future
capabilities are shared Clickeen services.

Every Widget uses a shared service through the same structured contract and
lifecycle. A Widget may use only the capabilities its purpose needs. If a real
Widget proves that a shared capability is missing, augment the owning service
once for every applicable Widget. Never teach Bob, Roma, Tokyo-worker, Dieter,
or another shared service the meaning of one Widget.

```text
Widget software
├── structured contract
├── Core HTML/CSS/JavaScript
└── declared use of generic Clickeen capabilities
         -> shared Clickeen services
```

Bob is one shared browser-memory editing service; it is not the Widget. Roma is
one shared current-account and materialization service; it is not the Widget.
They operate every Widget through the same contracts without Widget-name
branches, path-specific semantic rules, or private Widget workflows.

Tier limits and upsells use the same composition law. The system owns account
plan truth, entitlement keys and values, the eligible target plan, and the CTA
label/action. A Widget's `limits.json` only binds one of those generic system
capabilities to the Widget's own coordinate and one exact Widget message
identity. The Widget owns the complete localized contextual message in
`upsell/{locale}.json`; it does not own plan names, eligibility, pricing, CTA
behavior, Popup mechanics, or billing. Bob carries the denied editing intent,
Roma composes and hosts one shared Popup, and Dieter owns only Popup mechanics.
Core and the public Widget runtime know nothing about tiers or upsells.

The assembled Popup is multi-source, but no datum has ambiguous ownership:

```text
system current/target plan truth
+ Widget localized message template
+ system CTA
-> Roma composition
-> Dieter Popup
```

Bob and Roma consume the exact compiled Widget message contract. They do not
invent a fallback message, hardcode Widget-specific copy, or re-check the same
allowed edit at Save. All five current Widgets carry exact limit/message
bindings, use one Bob edit decision, and open one Roma Popup for a denial.
There is no fallback message or second denial flow.

Clickeen is a closed, internally trusted system. A named authority owns the
correctness of the exact artifact or result it produces. Downstream Clickeen
services consume that truth completely; they do not guard, revalidate,
sanitize, normalize, repair, filter, project it through an editor allowlist,
or reinterpret it against a second schema. Authentication, authorization, and
acceptance of raw human, browser, or third-party input remain at the one ingress
boundary that turns non-Clickeen input into Clickeen truth.

Create writes the first editable instance source and Save updates that source.
Only explicit allowed Publish asks Roma to materialize complete semantic
`index.html`, complete `styles.css`, and mandatory `runtime.js`. Save is Bob's
editable-source persistence boundary; Publish is the separate release boundary.
Bob preview is an editing concern and does not determine the public package.
It uses deploy-built Widget software plus Bob's current browser-memory draft;
it does not load or execute Tokyo-worker's stored serving package. Public
`runtime.js` contains no Builder-preview protocol.
Base content exists in stored HTML before JavaScript. For a selected non-base
locale, the Edge expresses the exact stored overlay into that semantic HTML
before returning it; JavaScript is not an instance renderer or serving
requirement. Public
delivery then serves the stored package and exact locale expression rather than
rebuilding Widget software per visitor.

One account instance is one complete logical Widget document. It contains the
exact instance-owned values for shared Header, Stage, Pod, Core size,
typography, chrome, and the Widget's unique Core namespace. Those values do not
live in the reusable Widget source folder and are not saved by Bob. Bob edits
the complete document in browser memory; Roma's generic materializer is the
sole authority that generates the contents of the served `index.html`,
complete `styles.css`, and mandatory `runtime.js`;
Tokyo-worker physically writes the canonical source documents and exact package
bytes to the instance folder and serves them. Roma materializes only on
explicit allowed Publish—not on Create, Save, Duplicate, or a visitor request.

```text
Widget and shared software source
+ exact saved account-instance state + explicit allowed Publish
-> Roma generic materializer
-> complete index.html + styles.css + runtime.js
-> Tokyo-worker R2 write
-> Tokyo Edge delivery
```

All five current Widgets now use canonical Core HTML/CSS/JavaScript,
source-based Bob preview, Publish-only materialization, and Edge locale
expression. Their retired flat sources have no compatibility path. The PRD 129
implementation is deployed and verified in cloud-dev; owner QA remains pending.

## Baseline Repository Commands

```bash
pnpm install
pnpm build
pnpm lint
pnpm typecheck
```

Use the owning service, capability, or widget manual for additional focused
checks. Cloud-dev runtime evidence is defined in
`documentation/architecture/RuntimeProfiles.md`.

## Tokyo R2 Storage Contract

Tokyo R2 is an ownership model, not a URL map. The only canonical roots are:

```text
accounts/
dieter/
fonts/
product/
prague/
```

Only `accounts/` is runtime-managed by account/product operations. It stores account-owned instance source, uploads, translated locale values, and generated public artifacts under `accounts/{accountPublicId}/...`. Private storage object names must not become product API vocabulary.

The other roots are git-authored deploy artifacts synced to R2:

- `dieter/` for shared design-system media
- `fonts/` for global Clickeen font files available to every account
- `product/` for logged-in product media and widget software
- `prague/` for marketing/site/GTM content; Prague page translations stay beside each page JSON as `{page}.translations/{locale}.json`

Do not introduce root `widgets/`, `public/`, `published/`, or `l10n/` storage. Friendly URLs such as `/widgets/{widgetType}/...` may exist, but they must resolve to the canonical storage home, for example `product/widgets/{widgetType}/...`.

---

## End-to-End Journey (widget folder -> Roma, Bob, Prague)

Runtime profile:

- Cloud-dev surfaces are the supported product/runtime evidence.
- See `documentation/architecture/RuntimeProfiles.md`.

### A) Widget definition path

Source of truth: `tokyo/product/widgets/{widget}/` (structured contract,
adjacent ToolDrawer labels, and unique Core software) plus the shared Widget
document and capabilities under `tokyo/product/widgets/shared/`. Deployed R2 storage home:
`product/widgets/{widget}/`.

1. **Tokyo R2/Tokyo-worker** serves the widget deploy roots:
   - canonical widget software path is `product/widgets/{widget}/`
   - canonical Dieter path is `dieter/`
   - Cloud-dev host is `https://tokyo.dev.clickeen.com`
2. **Bob runtime** reads widget definitions/assets from Tokyo:
   - `bob/lib/env/tokyo.ts` resolves `NEXT_PUBLIC_TOKYO_URL` -> `https://tokyo.dev.clickeen.com` by default.
3. **DevStudio** is the one human's cockpit for governing the AI-operated company:
   - canonical host is `https://devstudio.clickeen.com`
   - it no longer hosts the local widget-authoring workspace
   - it does not provide widget-authoring routes
4. **Cloud-dev Roma** is the supported product/account host surface:
   - `roma/app/api/bootstrap/route.ts` proxies to Berlin `GET /session/bootstrap`
   - `roma/components/builder-domain.tsx` sends `ck:open-editor` to Bob after `bob:session-ready`
   - code changes only appear there after deploy
Result: Roma remains the customer account shell; DevStudio remains the Berlin-authenticated cockpit for governing the AI-operated company on Cloudflare Pages.

### A.1) Auth issuer alignment (critical)

Invariant:

- The Supabase JWT used against product helper surfaces must be issued by the **same** Supabase project the active Berlin/Roma surface is configured to use.
- If you use a token from a different Supabase project, auth surfaces return `403 coreui.errors.auth.forbidden` with `issuer_mismatch` by design.

### B) Instance + asset path

Instances are account-owned data, not code. Tokyo/R2 stores them under `accounts/{accountPublicId}/instances/{instanceId}/`; Michael/Berlin hold account relational truth, not a parallel widget-instance storage lane. Account assets live under `accounts/{accountPublicId}/assets/`.

1. **Roma + Bob handle account widget instance flows**:
   - Roma Widgets lists, duplicates, renames, publishes, unpublishes, and deletes real account-owned instances through current-account same-origin routes.
   - Default/gallery creation is not an active product surface.
   - Bob owns the complete browser-memory draft. On Save, Roma trusts that
     complete document and stores its editable source only. Publish separately
     materializes semantic HTML/CSS/JavaScript.
   - The complete logical draft includes both shared instance state
     (`header.*`, `headerCta.*`, `stage.*`, `pod.*`, `coreSize.*`, shared
     appearance/typography/chrome) and the selected Widget's Core namespace.
     Roma prepares the semantic config/content split on Save. Roma's
     materializer is the sole generator of required HTML/CSS/JavaScript on
     explicit allowed Publish.
   - Tokyo-worker writes the canonical physical source documents from Roma's
     semantic payloads and stores the exact package bytes Roma submits;
     it does not reinterpret Widget semantics or reconstruct a schema from Bob
     controls.
2. **DevStudio does not host widget authoring**.
   - Internal verification remains a toolbench concern only.
   - Widget editing belongs to Roma-hosted Builder, not hidden DevStudio routes.
3. **Assets** referenced in configs point at canonical Tokyo for the active environment.

### C) Cloud-dev propagation (explicit)

Local changes do not auto-appear in cloud-dev. You must deploy.

1. **Bob/Roma and Cloudflare services**:
   - Code changes require Cloudflare deploys (Pages/Workers).
   - Cloud Bob/Roma read `https://tokyo.dev.clickeen.com`, not your local filesystem.

Invariant: **Local propagation is automatic; cloud-dev propagation is explicit.** Treat any assumption otherwise as a bug.

---

## Update Rules (what must be kept in sync)

If you change runtime behavior, update docs in the same PR/commit:

- **New/changed endpoints**
  - Update the owning system doc (`documentation/services/{system}.md`)
  - Update any cross-system flow diagrams (`documentation/architecture/Overview.md`)
- **New env vars / Cloudflare bindings**
  - Update the owning system doc + relevant engineering runbooks
  - Never document actual secret values (names only)
- **Supabase schema changes**
  - Add a reviewed SQL migration under `supabase/migrations/`
  - Update `documentation/services/michael.md` and `documentation/engineering/SupabaseOperations.md`
  - Deploy only through the `supabase migrations deploy` GitHub Actions workflow
- **Build/deploy changes**
  - Update the system doc and any engineering runbooks
- **Copilot/AI behavior changes**
  - Update the owning AI doc under `documentation/ai/`
  - Built agent docs live under `documentation/ai/agents/`
  - Non-current agent planning belongs in `Execution_Pipeline_Docs/`
- **Widget spec/runtime changes**
  - Update the widget operator spec under `documentation/widgets/widgets/`
  - Update authoring manuals under `documentation/widgets/authoring/` when source, Bob controls, or package boundaries change
  - Update shared widget manuals under `documentation/widgets/shared/` when Stage/Pod/Shell/typography/branding/share/locale behavior changes
- **Capability changes (Supernova, SEO/GEO, multitenancy)**
  - Update `documentation/capabilities/{capability}.md`
- **Prague strings localization pipeline**
  - Update `documentation/capabilities/localization.md` + `documentation/services/prague/*.md`
- **Instance l10n / locale resolution**
  - Update `documentation/capabilities/localization.md` + `documentation/services/tokyo-worker.md` (and `documentation/capabilities/seo-geo.md` when schema/excerpt behavior changes)
- **Tokyo R2 root/storage changes**
  - Update `documentation/architecture/Overview.md`, `documentation/architecture/Tenets.md`, and the owning system docs
  - Re-check that only `accounts/` is runtime-managed and that `dieter/`, `fonts/`, `product/`, and `prague/` remain deploy-managed roots

---

## Security rules for docs

- Never commit or paste real secrets into docs (private keys, HMAC secrets, API keys, Supabase keys, JWTs, etc.).
- Use placeholders: `<secret>`, `<token>`, `<baseUrl>`, `{instanceId}`.
- If an endpoint requires auth, describe the header shape, not the value.

---

## Drift Detection (cheap checks)

- Compiler determinism: repo typecheck/build plus Cloudflare verification, not a localhost Bob HTTP gate
- Quick grep for removed/renamed surfaces:
  - `rg -n "/api/ai/widget-copilot|/api/account/instances/.*/copilot|/model/chat|/execute|PRODUCT_COPILOT_BASE_URL|SANFRANCISCO_BASE_URL|ROMA_AI_GRANT_|PRAGUE_L10N_HMAC_SECRET" documentation`
  - `rg -n "claims/minibob/complete|/api/account/assets|POST /api/instance\\b" documentation --glob '*.md'`
  - `rg -n "/api/bootstrap|/api/account/widgets|/api/session/finish|/api/account/assets" documentation --glob '*.md'`
  - `rg -n "published/widgets|/renders/widgets|accounts/.*/widgets|root (widgets|public|published|l10n)" documentation --glob '*.md'`

When drift is found: update docs to match the shipped code/config immediately; treat mismatches as P0 doc bugs.
