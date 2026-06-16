# Clickeen Current System Context

This is the first product/architecture file agents read.

It contains current system truth only. Detailed service behavior, PRD records,
execution notes, migrations, and deep implementation detail live in the linked
service, architecture, widget, and migration files.

## System Is Simple

- Widgets are software and live in the system.
- Users create widget instances in Roma/Bob and save them in their account in
  Tokyo.
- Pages are stacks of instances that live in Tokyo.
- Bob is an editor. User opens and edits are browser-memory work. User save is
  the persistence boundary.
- Tokyo is responsible for account runtime storage in R2.
- Roma is the app. Roma routes the user to their account, enforces the user's
  tier, and saves what the user does.
- Clickeen uses Clickeen. Admin is a normal account using Clickeen's own
  widgets, assets, pages, and product routes.

## Product Law

Clickeen is a simple account product.

- Widgets are software.
- Instances are saved account-owned widgets.
- Assets are account-owned files.
- Pages are account-owned stacks of saved instances.
- Roma is the account app: it routes the user to the current account, enforces
  account policy, and saves account work.
- Bob is the Builder editor: it edits one widget instance in browser memory and
  returns the saved result through Roma.
- Tokyo stores and serves account runtime data through Tokyo-worker and R2.
- Berlin owns authentication and account session bootstrap.
- Clickeen admin work uses the normal admin account.

The active cloud-dev admin account coordinate is:

```text
CLICKEEN
```

Admin-owned instances, assets, pages, and examples use the same account-owned
paths and product routes as any other account.

## Current Authorities

| Concern                                    | Authority                                                       |
| ------------------------------------------ | --------------------------------------------------------------- |
| User authentication                        | Berlin                                                          |
| Current account session and account policy | Roma from Berlin bootstrap/authz                                |
| Builder host and product routing           | Roma                                                            |
| In-browser editing state                   | Bob                                                             |
| Widget software                            | `tokyo/product/widgets/{widgetType}/` in git, deployed to Tokyo |
| Account instances                          | Tokyo-worker over `accounts/{accountPublicId}/instances/`       |
| Account assets                             | Tokyo-worker over `accounts/{accountPublicId}/assets/`          |
| Account pages                              | Tokyo-worker over `accounts/{accountPublicId}/pages/`           |
| Public serving state                       | Tokyo-worker                                                    |
| Runtime bytes                              | Cloudflare R2/CDN through Tokyo-worker                          |
| Relational account/support data            | Michael/Supabase                                                |
| AI execution                               | San Francisco                                                   |
| Design system                              | Dieter                                                          |

When runtime behavior and docs disagree, use this order:

1. Runtime code and Supabase migrations.
2. Deployed Cloudflare configuration and bindings.
3. Service and widget docs.
4. Architecture docs, including this file.

Any confirmed mismatch is a documentation bug and is corrected with the change
that exposes it.

## System Map

| System        | Runtime                      | Role                                                |
| ------------- | ---------------------------- | --------------------------------------------------- |
| Roma          | Cloudflare Pages / Next.js   | Current-account app, Builder host, account routes   |
| Bob           | Cloudflare Pages / Next.js   | Builder editor for one account instance             |
| Tokyo-worker  | Cloudflare Workers + R2      | Account product operations and public serving       |
| Tokyo R2      | Cloudflare R2                | Product software and account runtime storage        |
| Berlin        | Cloudflare Workers           | Auth, session bootstrap, account authz capsule      |
| Prague        | Cloudflare Pages / Astro     | Marketing, gallery, demo/funnel pages               |
| DevStudio     | Cloudflare Pages             | Internal toolbench through the normal admin account |
| San Francisco | Workers/D1/KV/R2/Queues      | AI workforce services                               |
| Michael       | Supabase Postgres            | Account/user/support relational data                |
| Dieter        | Git source + Tokyo artifacts | Design system tokens/components                     |

Cloud-dev product runtime evidence comes from deployed cloud-dev surfaces:

```text
https://roma.dev.clickeen.com
https://bob.dev.clickeen.com
https://tokyo.dev.clickeen.com
https://berlin.dev.clickeen.com
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
      index.html
      styles.css
      runtime.js
  pages/
    {pageId}/
      source.json
      serve-state.json
      index.html
      styles.css
      runtime.js
  website/
    serving-policy.json
```

Product software and product-owned static resources live outside account runtime
storage:

```text
product/widgets/{widgetType}/
dieter/
fonts/
prague/
```

The active account asset file shape is:

```text
accounts/{accountPublicId}/assets/{filename}
```

Accepted SVG files are account media when stored through the account asset
route. They are classified as vector assets by Tokyo-worker.

## Product Flows

### Builder

1. Roma resolves the current account from the signed session/bootstrap context.
2. Roma opens one account instance from Tokyo-worker.
3. Roma hosts Bob and sends one editor-open payload.
4. Bob edits the active instance in browser memory.
5. Roma saves the submitted instance package to Tokyo-worker.
6. Tokyo-worker validates and stores the account instance source and package
   files.

### Assets

1. Roma Assets is the account asset library surface.
2. Bob asks Roma to list, resolve, or upload assets while editing.
3. Roma account asset routes forward the account coordinate and authz capsule to
   Tokyo-worker through the private service binding.
4. Tokyo-worker validates accepted uploads and writes account asset files under
   `accounts/{accountPublicId}/assets/{filename}` with required metadata.
5. Roma and Bob read the same Tokyo account asset truth.

### Pages

1. Roma manages account page source.
2. A page is an ordered stack of account instance placements.
3. Tokyo-worker stores page source, serve-state, and generated page package
   files under the account page folder.
4. Public page serving depends on Tokyo-owned serve-state and stored package
   files.

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
| Roma/Bob/Prague Pages runtime | Cloudflare Pages Git build state and cloud-dev surface checks |
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
  `documentation/architecture/CloudflarePagesCloudDevChecklist.md`.

## Detail Docs

Read the detail doc owned by the surface being changed:

| Area                  | Detail Doc                                           |
| --------------------- | ---------------------------------------------------- |
| Account assets        | `documentation/architecture/AssetManagement.md`      |
| Roma                  | `documentation/services/roma.md`                     |
| Tokyo-worker          | `documentation/services/tokyo-worker.md`             |
| Tokyo storage/deploy  | `documentation/services/tokyo.md`                    |
| Cloudflare operations | `documentation/architecture/CloudflareOperations.md` |
| Bob                   | `documentation/services/bob.md`                      |
| Prague                | `documentation/services/prague/prague-overview.md`   |
| DevStudio             | `documentation/services/devstudio.md`                |
| AI/San Francisco      | `documentation/ai/overview.md`                       |
| Product strategy      | `documentation/strategy/WhyClickeen.md`              |

Widget-specific work also requires the relevant widget PRD under
`documentation/widgets/` and the widget source under `tokyo/product/widgets/`.
