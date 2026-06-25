# Runtime Profiles

STATUS: CURRENT SYSTEM OPERATOR SPEC

Product runtime evidence comes from deployed cloud-dev surfaces. Local package
commands are for isolated build/debug work only and are not product runtime
evidence.

## Current Runtime Surfaces

| Surface | Runtime evidence |
| --- | --- |
| Bob | `https://bob.dev.clickeen.com` |
| Berlin | `https://berlin.dev.clickeen.com` |
| Roma | `https://roma.dev.clickeen.com` |
| Tokyo-worker operational host | `https://tokyo.dev.clickeen.com` |
| Public serving | `https://dev.clk.live/{accountPublicId}/{instanceId}` |
| Prague | `https://prague.dev.clickeen.com` |
| DevStudio | `https://devstudio.clickeen.com` |
| San Francisco | `https://sanfrancisco.dev.clickeen.com` |

Production public serving uses:

```text
https://clk.live/{accountPublicId}/{instanceId}
```

## Local Runtime Rule

There is no supported local Bob/Berlin/Tokyo runtime profile.

Forbidden local runtime authority:

- local Tokyo CDN stub;
- local Berlin worker fork;
- local Tokyo-worker fork;
- one-command local stack script;
- local Wrangler environment fork as runtime authority.

Those tools may help isolated debugging; they do not prove product runtime
behavior.

## Tokyo-worker Runtime Boundary

Tokyo-worker keeps the same private storage boundary in deployed runtime. It
may validate:

- service auth;
- account capsule to path match;
- method/path/ID shape;
- widget codebook;
- object schema;
- R2 existence;
- technical request bounds.

Tokyo-worker does not decide:

- product policy;
- billing/tier state;
- publication eligibility;
- locale caps;
- upload entitlements;
- account storage caps;
- translation generation.

Product state and policy come from the real Roma -> Bob -> Tokyo account path.

## Storage Runtime

Tokyo storage follows the current root model:

```text
accounts/
dieter/
fonts/
product/
prague/
```

Account-owned runtime bytes live under:

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

Widget software lives under:

```text
product/widgets/
```

Public instance serving uses the environment public-serving host plus:

```text
/{accountPublicId}/{instanceId}
```

That maps to generated browser files in the account instance folder. Routes
must not rely on root `published/`, root `widgets/`, or account widgets storage.

Public instance serving requires
`accounts/{accountPublicId}/instances/{instanceId}/serve-state.json` to mark the
instance as published. Page public serving is currently disabled because Roma
does not currently write page packages.

Public serving hosts `dev.clk.live` and `clk.live` expose generated artifacts
only. Operational paths such as `/healthz`, `/__internal/*`, and `/widgets/*`
must return `404` on public-serving hosts.

## Verification

| Concern | Verification |
| --- | --- |
| Bob/Roma/Prague app runtime | Cloudflare Pages build state plus cloud-dev host response |
| Worker runtime | GitHub Actions Worker deploy evidence plus Worker host response |
| Public serving | `dev.clk.live/{accountPublicId}/{instanceId}` response |
| R2 object truth | `pnpm cf:preflight` then repo R2 commands |
| Pages/DNS/project config | `pnpm cf:api:preflight` then repo Cloudflare API commands |
| Account product behavior | Roma account routes and owning service evidence |

If runtime behavior and local debug behavior disagree, deployed runtime wins.
