# Clickeen Current System Context

STATUS: CURRENT SYSTEM OPERATOR SPEC

This is the first product/architecture file agents read.

It contains current product law and current implementation truth. Where
implementation has not yet reached the law, it names that gap explicitly
rather than treating debt as architecture or pretending execution occurred.
Detailed service behavior, PRD records, execution notes, migrations, and deep
implementation detail live in the linked service, architecture, widget, and
migration files.

## What Clickeen Is

Clickeen is an agent-operated product, not a SaaS with AI features.

The system is deliberately lean and built on a structured, AI-legible schema so
that agents operate it directly. Agents are smart operators: they know what to
do, where, and how, and they execute operations on the structured substrate.
The codebase is the operable surface; the agents operating it are the product.

Clickeen's architecture inverts legacy SaaS: keep the system structured and
agent-operable instead of growing a large human-operated app with AI bolted on.

How the system is organized for agent-operability:

- a structured, typed, AI-legible schema (widget specs, compiled control/field
  maps, and exact locale overlay value maps) that agents read and operate;
- product-law ownership boundaries (Roma = account/authority, Bob = draft,
  Tokyo = storage, San Francisco = governed model execution) so agents operate
  inside known authority instead of rediscovering it;
- agent homes under `agents/<name>` — the operators;
- San Francisco — the governed model-execution engine the agents call.

### Widget Software And Shared Services

A Widget is autonomous software built on Clickeen. Its structured contract and
mandatory Core HTML/CSS/JavaScript own its unique meaning and behavior. Stage,
Pod, Header, Bob, Roma,
materialization, Tokyo storage/serving, localization, assets, connectors,
integrations, and future capabilities are shared Clickeen services.

Every Widget uses a shared service through the same structured contract and
lifecycle. A Widget may use only the capabilities its purpose needs. If a real
Widget proves that a shared capability is missing, the owning service is
augmented once in a Widget-neutral way; the service does not gain a branch that
understands that Widget's identity, paths, or semantics.

```text
Widget software
├── structured contract
├── Core HTML/CSS/JavaScript
└── declared use of shared capabilities
         -> Clickeen shared services
```

One customized Widget instance is a separate account-owned artifact, not a
copy of the Widget source folder. Its one logical state contains the exact
instance values for the shared Header, Stage, Pod, Core-size, typography, and
chrome capabilities plus the exact state under the Widget's Core namespace.
Bob edits that whole logical document. Create writes its first editable source
and Save updates that source. Only explicit allowed Publish asks Roma's generic
materializer to combine it with the shared and Core software and produce the
served complete HTML/CSS/JavaScript.
Tokyo-worker only persists and serves the exact result.

Clickeen is closed and internally trusted. The named authority that produces a
Clickeen artifact owns its correctness. Downstream Clickeen services consume
that exact artifact without another guard, schema check, validator, allowlist,
filter, normalization, or repair pass. Authentication/authorization and
acceptance of raw human, browser, or third-party input stay at the ingress
boundary where that input first becomes Clickeen truth.

Local implementation state: all five current Widgets implement PRD 129
locally. Each source uses mandatory Core HTML/CSS/JavaScript; New/Duplicate and
Save write editable source only; Builder preview uses compiled Widget software
plus Bob's draft; Publish alone materializes the public package; and
selected-locale serving uses the trusted overlay in Edge HTML before
JavaScript. The retired flat sources have no compatibility path. Public index
responses author the exact base and stored-overlay locale options at the Edge.
These local changes have not been deployed or verified in cloud-dev.

## Operating Model

Clickeen is operated by one human product owner/architect plus an AI workforce.

The human owns product direction, architecture judgment, and final authority.
AI coding and devops agents operate the repo, implementation, documentation,
verification, and managed-service workflows through the gates in `AGENTS.md`.
Runtime product agents operate customer/product artifacts through named product
authorities.

Clickeen is still a self-serve SaaS for customers, but the company and product
are designed around agent operation rather than a large human operations team.

## Content Source Authority

Clickeen serves content. Websites, widgets, pages, emails, reports, feeds, and
runtime surfaces deliver content to users, crawlers, answer engines,
integrations, and downstream systems.

Content in Clickeen has three source authorities:

1. Human-generated content: copy, pages, blogs, emails, widget text, product
   descriptions, support articles, and other content authored by a person.
2. AI-generated content: content written by agents from human direction,
   account rules, brand rules, product rules, or approved system direction.
3. Integration-sourced content: reviews, feeds, listings, CRM rows, analytics,
   support data, aggregated records, and anything Clickeen pulls from another
   system.

Agent authority follows the source:

- Human-generated content: agents can recommend improvements, propose edits,
  translate, optimize, restructure, and apply user-approved changes. Human
  intent remains the source authority.
- AI-generated content: agents can operate autonomously inside approved product
  rules because the content is already agent-produced under Clickeen direction.
- Integration-sourced content: agents cannot rewrite the source truth. They can
  use it, summarize it, extract from it, route it, display it, analyze it, and
  build product experiences around it. They can mutate it only through an
  explicit authorized integration write path. Source truth is preserved;
  derivatives and syncs are the work.

The rule across all three sources is source-truth fidelity, not touch/no-touch:
agents derive from and operate on content according to its source authority; a
change to source truth is authorized by whoever owns it — the human, the
product tenets, or the external
system.

The surrounding system is also agent-operated. Widgets, pages, reports,
analytics, support tickets, locale overlays, runtime packages, account assets,
routes, and storage folders are structured artifacts that agents operate through
named authorities.

## Agent Activity

Agent Activity is the direct line of feedback between an agent and the user.
When an agent operates the system, the agent may narrate the operation as it
happens. The product surface renders that narration temporarily and then goes
quiet when the operation ends.

Agent Activity is not job status, progress reconciliation, polling, probing,
package/cache inspection, or UI-authored summary text. The agent owns the words.
Host services transport them. Surfaces render them.

## System Is Simple

- Widgets are software and live in the system.
- A Widget's unique software is mandatory Core HTML/CSS/JavaScript plus its
  structured contract. It uses shared Clickeen services rather than
  reimplementing them.
- Users create widget instances in Roma/Bob and save them in their account in
  Tokyo.
- Every tier may use every Widget and retain editable instances. Public
  capacity is applied separately at Publish through
  `instances.published.max`; Free may publish and serve one instance.
- Bob is one shared Widget editing service. User opens and edits are
  browser-memory work. User Save is the editable-source persistence boundary;
  Publish is the separate public-release boundary.
- Tokyo is responsible for account runtime storage in R2.
- Roma is the account app and one shared account/materialization service for
  every Widget. It routes the user to their account, enforces the user's tier,
  and saves what the user does without interpreting Widget meaning. Roma's
  generic materializer generates the actual complete `index.html`, complete
  `styles.css`, and mandatory `runtime.js` only when the user explicitly
  Publishes an allowed saved instance.
- Tier limits are system policy. A Widget only declares which generic
  entitlement applies to which unique Widget coordinate and supplies the
  complete localized contextual message for that denied action. Roma combines
  that message with system-owned plan truth and system-owned CTAs in one shared
  upsell Popup; Core never owns tier or upsell behavior.
- Roma owns widget inventory product meaning. Tokyo returns exact account
  instance storage coordinates and exact row facts, not tier decisions or
  product-shaped inventory summaries.
- Clickeen uses Clickeen. Admin is a normal account using Clickeen's own
  widgets, assets, and product routes.

## Product Law

Clickeen is a simple account product.

- One user belongs to one account.
- One account has many users.
- The user's role is the user's role in that account.
- There is no customer account switching model.
- `accounts.id` is the compact account product/storage coordinate.
- `accountPublicId` is the API/embed/authz field name for that same value.
- Widgets are software.
- Widgets consume shared Clickeen services through uniform contracts; shared
  services do not contain Widget-specific semantic branches.
- Instances are saved account-owned widgets.
- Assets are account-owned files.
- Roma is the account app: it routes the user to the current account, enforces
  account policy, and saves account work.
- Bob is the Builder editor: it edits one widget instance in browser memory and
  returns the saved result through Roma.
- Tokyo stores and serves account runtime data through Tokyo-worker and R2.
- Named Clickeen authorities trust one another's exact outputs. Downstream
  services do not revalidate system-produced artifacts.
- Berlin owns authentication and account session bootstrap.
- Clickeen admin work uses the normal admin account.
- UI capability follows one forward-looking rule: resolution determines
  sharpness, available workspace determines layout, and form factor determines
  the expected product experience. Operational dashboards preserve the desktop
  workspace on tablets in both orientations and use the same compact drawer
  workspace on narrow mobile landscape and portrait. A specialized editor may
  retain an explicit unsupported portrait boundary only when its real
  composition cannot remain operable there; Bob currently owns that exception.

### Tier Limits And Upsells

Account tier, entitlement keys and values, current-plan truth, eligible target
plan, and Upgrade CTA behavior are system-owned. A Widget consumes that shared
capability through two exact source artifacts:

```text
limits.json             -> generic entitlement binding for a Widget coordinate
upsell/{locale}.json    -> complete Widget-owned contextual message templates
```

The Widget message may interpolate exact system values such as
`{currentPlan}` and `{targetPlan}`. Widget copy never supplies those values,
pricing, CTA labels, CTA destinations, billing behavior, or Popup mechanics.
The message is outside Core because it describes the account editing
experience, not the public Widget software.

Bob owns the one generic browser-memory edit boundary and carries the denied
capability/message identity. Roma supplies the account-policy values, composes
and hosts the one shared upsell surface, and owns the future system CTA
transition. Dieter owns Popup presentation/lifecycle only. Save,
materialization, and Tokyo-worker consume the already-authorized result without
repeating the entitlement decision.

Local implementation: all five current Widgets have exact `limits.json`
message bindings and `upsell/en.json`. Bob applies one Widget-neutral decision
before the attempted manual, Copilot, or undo mutation; denial carries
`{ capability, messageId, required }` and leaves the draft unchanged. Roma
selects the first higher system tier that satisfies `required` and opens one
shared Popup. Save does not repeat the decision.

The active cloud-dev admin account coordinate is:

```text
CLICKEEN
```

Admin-owned instances, assets, and examples use the same account-owned
paths and product routes as any other account.

## Current Authorities

| Concern                                    | Authority                                                       |
| ------------------------------------------ | --------------------------------------------------------------- |
| User authentication                        | Berlin                                                          |
| Current account session and account policy | Roma from Berlin bootstrap/authz                                |
| Builder host and product routing           | Roma                                                            |
| In-browser editing state                   | Bob                                                             |
| Widget software                            | `tokyo/product/widgets/{widgetType}/` in git, including Core, structured contracts, adjacent ToolDrawer labels, and Widget-owned upsell messages, deployed to Tokyo |
| Public package generation                  | Roma through the Widget-neutral `@clickeen/ck-runtime-materializer` |
| Account instances                          | Tokyo-worker over `accounts/{accountPublicId}/instances/`       |
| Account assets                             | Tokyo-worker over `accounts/{accountPublicId}/assets/`          |
| Public serving state                       | Tokyo-worker                                                    |
| Runtime bytes                              | Cloudflare R2/CDN through Tokyo-worker                          |
| Relational account/user/invitation/locale data | Michael/Supabase                                           |
| AI model execution                         | San Francisco                                                   |
| Product Copilot brain/runtime              | `agents/product-copilot` Cloudflare Worker                      |
| Translation Agent brain/runtime            | `agents/translation-agent` Cloudflare Worker                     |
| Design system                              | Dieter                                                          |

When establishing what is implemented now, use this evidence order:

1. Runtime code and Supabase migrations.
2. Deployed Cloudflare configuration and bindings.
3. Service and widget docs.
4. Architecture docs, including this file.

This order proves implementation state; it does not override the architecture
tenets. A current manual must describe the proved runtime and name any exact
departure from canonical product law. The owning execution plan changes the
runtime; documentation never hides the mismatch by canonizing the debt or by
pretending the change is already live.

## System Map

| System        | Runtime                      | Role                                                |
| ------------- | ---------------------------- | --------------------------------------------------- |
| Roma          | Cloudflare Pages / Next.js   | Current-account app, Builder host, account routes   |
| Bob           | Cloudflare Pages / Next.js   | Builder editor for one account instance             |
| Tokyo-worker  | Cloudflare Workers + R2      | Account R2 storage boundary and public file serving |
| Tokyo R2      | Cloudflare R2                | Product software and account runtime storage        |
| Berlin        | Cloudflare Workers           | Auth, session bootstrap, account authz capsule      |
| Prague        | Cloudflare Pages / Astro     | Marketing, gallery, demo/funnel pages               |
| DevStudio     | Cloudflare Pages             | The one human's cockpit for governing the AI-operated company (through the normal admin account) |
| San Francisco | Cloudflare Worker + R2       | Governed AI model execution and Prague l10n logs   |
| Product Copilot | Cloudflare Worker          | Builder Product Copilot brain; agent id `product.copilot` |
| Translation Agent | Cloudflare Worker        | Translation Agent brain; agent id `widget.instance.translator` |
| Michael       | Supabase Postgres            | Account/user/invitation/locale relational data      |
| Dieter        | Git source + Tokyo artifacts | Design system tokens/components                     |

Cloud-dev product runtime evidence comes from deployed cloud-dev surfaces:

```text
https://roma.dev.clickeen.com
https://bob.dev.clickeen.com
https://tokyo.dev.clickeen.com
https://berlin.dev.clickeen.com
https://dev.clk.live/{accountPublicId}/{instanceId}
https://devstudio.clickeen.com
```

## Storage Shapes

Account runtime storage is account-first and uses `accountPublicId`.

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
```

Each instance has one base package. Translation generation writes only
`overlays/locales/{locale}.json`; public locale selection applies the exact
requested overlay into the semantic HTML response at the Edge and never stores
locale-derived HTML, CSS, or JavaScript.

The source files and package files have different jobs:

- `instance.config.json` stores the exact non-translatable instance state,
  including shared Header/Stage/Pod presentation and Core behavior/state that
  is not a localized text field;
- `instance.content.json` stores the exact base-locale customer-visible values
  selected by the Widget's editable-fields contract, including Header and Core
  text;
- Roma recomposes those sources into one complete logical instance for Bob and
  uses that same complete state when generating the public package;
- complete `index.html`, complete `styles.css`, and mandatory `runtime.js` are
  Roma-materialized public bytes generated only on Publish; Tokyo-worker creates no Widget software
  when it writes them;
- `serve-state.json` owns publication state, while locale overlays remain exact
  translated-value derivatives of `instance.content.json`.

Product software and product-owned static resources live outside account runtime
storage:

```text
product/widgets/{widgetType}/
dieter/
fonts/special/
prague/
```

`fonts/special/` contains global Clickeen fonts available to every account.
Fonts uploaded by an account remain account assets under that account; the two
authorities are distinct.

The active account asset file shape is:

```text
accounts/{accountPublicId}/assets/{filename}
```

Accepted SVG files are account assets when stored through the account asset
route. They are classified as vector assets by Tokyo-worker.

## Product Flows

### Builder

1. Roma resolves the current account from the signed session/bootstrap context.
2. Roma opens one account instance's exact editable source from Tokyo-worker.
3. Roma hosts Bob and sends one editor-open payload containing the saved source,
   deploy-built Widget software, compiled entitlement/message bindings, and
   exact system account policy. A published package is not editable truth and
   is not required to open a never-published instance.
4. Bob edits the active instance in browser memory and expresses that exact
   draft in Workspace from the deploy-built Widget software. Workspace
   does not parse or execute the account instance's stored serving package, and
   the public Widget runtime contains no Bob preview receiver.
5. Before a Widget-bound edit is applied, Bob's one generic editing boundary
   applies the exact system limit. If denied, the draft remains unchanged and
   Bob carries the capability/message identity to Roma. Roma combines the exact
   Widget template, system current/target plan values, and system CTA in one
   shared Popup.
6. On explicit Save, Roma trusts Bob's complete browser-memory Widget state,
   resolves the source/content split, and stores editable source only. Bob
   preview remains an editing concern and does not define a public package.
7. On explicit allowed Publish, Roma's one generic materializer combines the
   shared composition, Widget Core, and exact saved instance and is the sole
   generator of complete `index.html`, complete `styles.css`, and mandatory
   `runtime.js`.
8. Tokyo-worker trusts and physically writes the account instance source or
   exact package files that Roma submits; it does not compile, render, or
   generate those files.
9. Public delivery serves those stored base bytes. A non-base request applies
   the exact overlay to semantic HTML at the Edge before returning it. Initial
   selected-locale content is present before JavaScript executes.

### Assets

1. Roma Assets is the account asset library surface.
2. Bob asks Roma to list, resolve, or upload assets while editing.
3. Roma account asset routes forward the account coordinate and authz capsule to
   Tokyo-worker through the private service binding.
4. The account asset ingress accepts raw user bytes once, then Tokyo-worker
   writes the resulting Clickeen asset under
   `accounts/{accountPublicId}/assets/{filename}` with required metadata.
5. Roma and Bob read the same Tokyo account asset truth.

### Clickeen-Owned Examples

1. Clickeen authors examples through Builder under the admin account
   `CLICKEEN`.
2. Product-owned files reference examples by account instance reference:
   `accountPublicId + instanceId`.
3. A user copy creates a normal destination-account instance.

## Runtime And Deploy Evidence

Use the owning surface for evidence:

| Evidence Needed               | Evidence Source                                               |
| ----------------------------- | ------------------------------------------------------------- |
| Account asset visibility      | Roma `/api/account/assets` and Roma Assets UI                 |
| Account asset storage         | `pnpm cf:preflight` then repo R2 commands                     |
| Account instance behavior     | Roma account instance routes and Tokyo-worker                 |
| Widget software source        | `tokyo/product/widgets/{widgetType}/`                         |
| Cloud-dev worker/R2 deploy    | GitHub Actions worker deploy runs and R2 evidence             |
| Roma/Bob/Prague app runtime   | Cloudflare Pages Git build state and cloud-dev surface checks |
| Account coordinate            | Berlin/Roma bootstrap plus migrations                         |

## DevOps Operating Model

Git is the normal deploy trigger for cloud-dev.

| Surface                   | Cloud-dev deploy path                                                          |
| ------------------------- | ------------------------------------------------------------------------------ |
| Bob                       | Cloudflare Pages Git-connected build from `main`                               |
| Roma                      | Cloudflare Pages Git-connected build from `main`                               |
| Prague                    | Cloudflare Pages Git-connected build from `main`                               |
| DevStudio                 | Cloudflare Pages project for `https://devstudio.clickeen.com`                  |
| Berlin                    | GitHub Actions `cloud-dev workers deploy` on matching `main` changes           |
| San Francisco             | GitHub Actions `cloud-dev workers deploy` on matching `main` changes           |
| Tokyo-worker              | GitHub Actions `cloud-dev workers deploy` on matching `main` changes           |
| Tokyo product roots in R2 | GitHub Actions `cloud-dev workers deploy` sync step on matching `main` changes |
| Supabase migrations       | GitHub Actions `supabase migrations deploy` manual dispatch                    |

Pages applications use Cloudflare Pages project configuration for build and
runtime deployment. GitHub Actions verify Pages build contracts and surface
reachability. The Pages deploy plane is the Cloudflare Git-connected Pages
project.

Worker and Tokyo R2 product deploys use the GitHub Actions workflow
`.github/workflows/cloud-dev-workers.yml`. That workflow deploys changed Worker
surfaces and syncs Tokyo product roots to the configured cloud-dev R2 bucket.

Supabase schema deployment uses `.github/workflows/supabase-migrations.yml`.
The workflow target is `cloud-dev`, and execution requires the
`APPLY_MIGRATIONS` confirmation input.

Cloudflare work is preflight-gated:

```bash
pnpm cf:preflight       # R2/Tokyo artifact operations
pnpm cf:api:preflight   # Pages, domains, DNS, Worker/Page config
```

Supabase work uses reviewed SQL migrations in `supabase/migrations/` and the
Supabase migration workflow for cloud-dev deployment.

Pages deploy rule:

- Bob, Roma, and Prague deploy through Cloudflare Pages Git builds.
- GitHub Actions verify build contracts and surface reachability.
- Pages project/env/host setup is documented in
  `documentation/engineering/CloudflarePagesCloudDevChecklist.md`.

## Detail Docs

Read the detail doc owned by the surface being changed:

| Area                  | Detail Doc                                           |
| --------------------- | ---------------------------------------------------- |
| Account model         | `documentation/architecture/AccountManagement.md`    |
| Account assets        | `documentation/architecture/AssetManagement.md`      |
| Babel protocol        | `documentation/architecture/BabelProtocol.md`        |
| Locale overlays       | `documentation/architecture/OverlayArchitecture.md`  |
| Runtime profiles      | `documentation/architecture/RuntimeProfiles.md`      |
| Cloud-dev Pages setup | `documentation/engineering/CloudflarePagesCloudDevChecklist.md` |
| Roma                  | `documentation/services/roma.md`                     |
| Berlin                | `documentation/services/berlin.md`                   |
| Tokyo-worker          | `documentation/services/tokyo-worker.md`             |
| Tokyo storage/deploy  | `documentation/services/tokyo.md`                    |
| Michael data plane    | `documentation/services/michael.md`                  |
| Cloudflare operations | `documentation/engineering/CloudflareOperations.md` |
| Bob                   | `documentation/services/bob.md`                      |
| Prague                | `documentation/services/prague/prague-overview.md`   |
| DevStudio             | `documentation/services/devstudio.md`                |
| AI plane              | `documentation/ai/README.md`                         |
| San Francisco         | `documentation/ai/sanfrancisco.md`                   |
| Built agents          | `documentation/ai/agents/`                           |
| Product strategy      | `documentation/strategy/WhyClickeen.md`              |

Widget-specific work also requires the relevant widget operator spec under
`documentation/widgets/widgets/`, any affected authoring/shared manuals under
`documentation/widgets/`, and the widget source under `tokyo/product/widgets/`.
