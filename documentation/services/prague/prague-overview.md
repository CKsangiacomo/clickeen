# Prague - Marketing Surface

STATUS: CURRENT SYSTEM OPERATOR SPEC

Prague is Clickeen's public marketing surface. It is an Astro app deployed on Cloudflare Pages and served as static output. Prague explains and sells widgets. It is not the account Pages product, and it is not the widget editor.

Account Pages are stacks of saved widget instances owned by Roma and Tokyo-worker. Prague marketing pages are repo-authored JSON documents under `tokyo/prague/pages/**`.

## Runtime Authority

| Concern | Current authority |
| --- | --- |
| App source | `prague/` |
| Deploy surface | Cloudflare Pages project `prague-dev` |
| Cloud-dev host | `https://prague.dev.clickeen.com` |
| Build command | `pnpm build` from `prague/` |
| Build output | `prague/dist` |
| Adapter | `@astrojs/cloudflare` with `output: "static"` |
| Page source | `tokyo/prague/pages/{widget}/{page}.json` |
| Page translation sidecars | `tokyo/prague/pages/{widget}/{page}.translations/{locale}.json` |
| Public widget embeds | `https://clk.live/{accountPublicId}/{instanceId}` |

Prague bundles repo JSON through Astro glob loading at build/runtime. The same git-authored Prague content also deploys to Tokyo/R2 under `prague/**` for the static-content root, but live Prague page rendering in this repo does not fetch page JSON from R2.

Prague does not write account assets, account instances, account pages, or account overlay folders.

## Routes

| Route | Behavior |
| --- | --- |
| `/` | Redirects to a canonical `/{market}/{locale}/` route using explicit query/cookie preference, Cloudflare country, then default market. |
| `/{market}/{locale}/` | Widget directory. Reads every widget `overview.json` and renders cards. |
| `/{market}/{locale}/privacy/` | Prague privacy page. |
| `/{market}/{locale}/create/` | Redirects to Roma `${PUBLIC_ROMA_URL}/home` with Prague source context. Returns `503` if `PUBLIC_ROMA_URL` is not configured. |
| `/{market}/{locale}/widgets/{widget}/` | Widget overview page from `overview.json`. |
| `/{market}/{locale}/widgets/{widget}/{examples|features|pricing}/` | Widget subpages from their matching JSON file. |
| `/{segment}/` | Redirect helper for known market or locale segments. Unknown segments return redirect behavior from the catch-all route. |
| `/{segment}/**` | Catch-all redirect route for unsupported Prague paths. |

Canonical identity is `/{market}/{locale}/...`. Markets and allowed locales are defined in `prague/src/markets/markets.json` and `packages/l10n/locales.json`.

Route operator notes:

- `/?reset=1` and `/?reset=true` clear Prague market/locale preference cookies before choosing the canonical route.
- Widget overview canonical subpage requests redirect to `/{market}/{locale}/widgets/{widget}/`.
- Invalid widget subpage names return `404`.
- Prague routes are static Astro routes; they do not call Roma account APIs.

## Content Model

Each marketed widget must have:

```text
tokyo/prague/pages/{widget}/overview.json
tokyo/prague/pages/{widget}/examples.json
tokyo/prague/pages/{widget}/features.json
tokyo/prague/pages/{widget}/pricing.json
```

Each page JSON contains a `blocks[]` array. `blocks[]` is the current Prague implementation field for marketing sections. It is not the account Pages model.

Required non-visual blocks:

| Block | Required where | Purpose |
| --- | --- | --- |
| `page-meta` | Every Prague widget page | `<title>` and description |
| `navmeta` | Widget overview | Widget mega-menu title and description |

Localized Prague page copy is applied from sidecar files:

```text
tokyo/prague/pages/{widget}/{page}.translations/{locale}.json
```

The sidecar contains `ops[]` entries that set string values on the page JSON. If a non-English Prague route has no required sidecar, Prague fails visibly. It does not substitute base copy.

## Section Registry

Prague only renders section types registered in:

```text
prague/src/lib/blockRegistry.ts
```

The loader is:

```text
prague/src/lib/markdown.ts
```

The loader name is historical code naming; it loads JSON page specs, applies sidecars, validates section copy/meta, and returns page blocks to Astro pages.

Registered section types:

```text
big-bang
hero
split
split-carousel
steps
subpage-cards
control-moat
global-moat
platform-strip
cta-bottom-block
minibob
embed-carousel
mobile-showcase
feature-explorer
navmeta
page-meta
```

Use `documentation/services/prague/blocks.md` for the exact required copy keys and allowed meta keys.

## Public Widget Embeds

Prague can embed a published widget only when the page JSON explicitly provides:

```json
{
  "accountInstanceRef": {
    "accountPublicId": "[accountPublicId]",
    "instanceId": "[instanceId]"
  }
}
```

Some section types carry refs inside `items[]` instead of on the section root:

```json
{
  "items": [
    {
      "accountInstanceRef": {
        "accountPublicId": "[accountPublicId]",
        "instanceId": "[instanceId]"
      }
    }
  ]
}
```

Current runtime supports nested refs in `hero`, `split-carousel`,
`embed-carousel`, and `mobile-showcase` item shapes. `embed-carousel` and
`mobile-showcase` require non-empty `items`.

Rules:

- Admin examples use the normal admin account public id `CLICKEEN`.
- Prague must not infer account, instance, or locale from widget type.
- Prague must not read private account translation state.
- Prague embeds public artifacts served by `clk.live`.

## Environment

| Name | Used by |
| --- | --- |
| `PUBLIC_TOKYO_URL` | Required by Prague base layout for Dieter token CSS and product static resources. |
| `PUBLIC_ROMA_URL` | Create route redirect into Roma. |
| `PUBLIC_CLK_LIVE_URL` | Optional base URL for public widget artifact validation and embeds. Defaults to `https://clk.live` where code allows. |
| `PRAGUE_VALIDATE_ACCOUNT_INSTANCE` | Enables account instance availability check during Prague page loading. |
| `PRAGUE_VALIDATE_ACCOUNT_INSTANCE_STRICT` | Makes availability check failures fatal where code enables validation. |

Do not document secret values. Prague does not need account-write secrets.

Validation defaults:

- In development, account-instance validation is on unless `PRAGUE_VALIDATE_ACCOUNT_INSTANCE=0`.
- Strict validation is on in production only when validation is explicitly enabled.

## Operator Commands

From repo root:

```bash
pnpm --filter @clickeen/prague typecheck
pnpm --filter @clickeen/prague build
pnpm prague:l10n:verify
pnpm cf:api:preflight
pnpm cf:pages:project prague-dev
pnpm cf:pages:domains prague-dev
```

Runtime smoke:

```text
https://prague.dev.clickeen.com/us/en/
https://prague.dev.clickeen.com/us/en/widgets/countdown/
```

## Hard Stops

Stop before editing if the request asks Prague to:

- save account instances or account pages
- generate account translations
- write Tokyo account folders
- become the Bob editor
- create private locale authority
- author `templates`, `outcomes`, or `cta` as Prague page or section identities
- use `feature-explorer` until its contract is corrected; the registry requires `copy.categories[]`, while the current renderer reads top-level `categories`
- add a section type without updating `blockRegistry.ts`
- add a route that is not represented in `prague/src/pages/**`

Prague is the marketing surface. Account operations belong to Roma and Tokyo-worker.
