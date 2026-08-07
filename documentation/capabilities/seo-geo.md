# SEO/GEO/AEO Capability

STATUS: DIRECTIONAL CAPABILITY NOTE WITH CURRENT RUNTIME GUARDRAILS

SEO/GEO/AEO is a Clickeen direction, not a fully specified operator contract
yet. Keep this page honest: it records what is true today and the direction we
intend to build without inventing routes, agents, crawlers, telemetry, or schema
machinery that does not exist.

## Code Authority

| Concern | File |
| --- | --- |
| Current public widget serving | `tokyo-worker/src/routes/clk-live-routes.ts` |
| Account instance package state | `tokyo-worker/src/domains/account-instances/serve-state.ts` |
| Account instance package files | `tokyo-worker/src/domains/account-instances/package-files.ts` |
| Public package metadata | `tokyo-worker/src/domains/public-package-serve-metadata.ts` |
| Roma instance save route | `roma/app/api/account/instances/[instanceId]/route.ts` |
| Roma instance publish route | `roma/app/api/account/instances/[instanceId]/publish/route.ts` |
| Roma public package builder | `roma/lib/account-instance-public-package.ts` |
| Roma public-serving origin env | `roma/lib/env/public-serving.ts` |
| Prague marketing page source | `tokyo/prague/pages/{widget}/{page}.json` and locale sidecars |
| Prague metadata/head output | `prague/src/layouts/Base.astro`, `prague/src/pages/**` |
| Prague page loader | `prague/src/lib/markdown.ts` |
| Policy registry/matrix | `packages/ck-policy/src/registry.ts`, `packages/ck-policy/entitlements.matrix.json` |

## Current Runtime Truth

Current public widget serving starts from a stored generated base package and
injects exact saved locale context into index HTML at request time.

```text
https://dev.clk.live/{accountPublicId}/{instanceId}
https://clk.live/{accountPublicId}/{instanceId}
```

Public visitor requests:

- validate the saved source pointer, publish state, and package readiness;
- receive generated package files from Tokyo-worker/R2;
- list the exact saved locale coordinates for index requests;
- load exact saved translated values for a requested non-base `?locale=` and
  inject `CK_LOCALE_CONTEXT` into the stored base index;
- do not make the browser fetch authoring or overlay JSON directly;
- do not call Bob/Roma account APIs;
- do not call San Francisco or an agent endpoint;
- do not regenerate the base package or ask a model to translate at request
  time.

Generated account instance base-package files live under:

```text
accounts/{accountPublicId}/instances/{instanceId}/
  serve-state.json
  index.html
  styles.css
  runtime.js
```

Public serving is gated by the stored publish/package state. Unpublished,
missing, malformed, or mismatched package state returns `404`.

Public-serving hosts expose only the public instance artifact surface: the
generated base package plus exact stored locale context injected into index
HTML. Operational paths such as `/healthz`, `/__internal/*`, and `/widgets/*`
return `404` on `dev.clk.live` and `clk.live`.

Prague is the separate public marketing-page surface. Its source is
repo-authored JSON under `tokyo/prague/pages/**`, with locale sidecars beside
the owning page. Prague's Astro routes render that source through Cloudflare
Pages. Current Prague widget pages require `page-meta` title and
description, and the route layer emits canonical and locale-alternate links
from the approved market/locale route coordinates.

## Current Policy Key

The policy registry currently contains this key:

```text
embed.seoGeo.enabled
```

Current policy source:

```text
packages/ck-policy/entitlements.matrix.json
packages/ck-policy/src/registry.ts
```

Current runtime gap: the key exists in policy metadata, but current runtime code
does not prove an active SEO/GEO entitlement gate in Roma save, Roma publish, or
Tokyo-worker public serving. Until code consumes the key on a product path, this
is policy metadata, not an enforced runtime entitlement.

Operator warning: `packages/ck-policy/src/registry.ts` currently marks
`embed.seoGeo.enabled` as `enforced` and names Roma product save/publish/public
code flow as owner. Runtime evidence does not currently prove that consumer.
For this capability, treat the registry row as conflicting metadata until a
real runtime consumer is implemented or the registry is corrected.

Tokyo-worker stores and serves submitted artifact files. It does not decide
whether an account is entitled to SEO/GEO output.

`embed.seoGeo.enabled` is widget embed policy metadata. It is not a gate for
repo-authored Prague marketing pages.

## Current Operator Rule

There is no standalone SEO/GEO/AEO agent or optimization operation to run
today. Current work changes and verifies the two owning public surfaces through
their normal source and build paths.

Operators can currently verify only these facts:

1. The policy key exists in `@clickeen/ck-policy`.
2. Public widget serving starts from generated package files for published
   account instances and injects exact stored locale context into index HTML.
3. Prague renders repo-authored marketing pages with required page metadata,
   canonical routes, and locale alternates.
4. No current runtime path proves automated SEO/GEO/AEO generation, measurement, ranking
   feedback, or automatic optimization.

Do not create a work item from this page that assumes a current SEO/GEO/AEO
agent, crawler, cron job, widget locale URL contract, schema output, or ranking
feedback loop exists. Prague's current market/locale routes are real and remain
owned by Prague.

## Current Boundaries

SEO/GEO is not currently:

- a widget source sidecar;
- a runtime agent call;
- a visitor-time model or optimization rewrite;
- a locale fallback mechanism;
- a widget-source SEO/GEO sidecar contract;
- a replacement source tree or compiler for Prague marketing pages.

Roma builds embed snippets from the public URL after publish. Public runtime
serves the generated widget base package and, for index requests, injects exact
stored base/overlay locale context. Prague builds its marketing pages from the
owning repo source.

## Direction

Clickeen SEO/GEO/AEO will operate by public surface:

- by published widget instance;
- by repo-authored Prague marketing page.

Directionally, the system should produce crawlable, high-quality public
surfaces from each authority's structured source. Translation/Babel overlays
are a key input to global widget availability, but current public widget
runtime does not yet expose a stable locale-specific crawlable URL contract.
Prague already owns explicit market/locale routes and localized page sidecars;
SEO work there must improve that source and route output rather than move it to
another product.

No implemented SEO/GEO/AEO agent exists. Directionally, such an agent would
measure, recommend, and improve public widget and Prague surface quality
without mutating source truth silently. Exact cron jobs, telemetry, schema,
ranking feedback, answer-engine optimization, and output contracts are not
specified here.

## Current Failure Semantics

| Case | Current result |
| --- | --- |
| Unpublished widget instance | public serving returns `404` |
| Missing or malformed package state | public serving returns `404` |
| Missing package file | public serving returns `404` |
| Package metadata/fingerprint mismatch | public serving returns `404` |
| Prague widget page missing required `page-meta` title/description | Prague load/build fails visibly |
| Required non-English Prague page sidecar missing or invalid | Prague load/build fails visibly; base copy is not substituted |
| Operational path on public host | `404` |
| `embed.seoGeo.enabled` absent from runtime consumer path | no SEO/GEO runtime gate is proven |

## Verification

| Concern | Current verification |
| --- | --- |
| Public widget runtime | `https://dev.clk.live/{accountPublicId}/{instanceId}` starts from the stored base package only when the instance pointer is published and the package is ready; index requests inject exact saved locale context from R2 |
| Stored package files | `index.html`, `styles.css`, and `runtime.js` exist under `accounts/{accountPublicId}/instances/{instanceId}/` with valid package metadata/fingerprint |
| Policy key source | `packages/ck-policy/entitlements.matrix.json` |
| Runtime entitlement gap | no proven active consumer of `embed.seoGeo.enabled` outside policy metadata/docs; registry metadata currently conflicts with runtime evidence |
| Public no-agent rule | public runtime does not call Roma/Bob/San Francisco/agents |
| Prague source | `tokyo/prague/pages/{widget}/{page}.json` plus required locale sidecars |
| Prague metadata/routes | Prague build and the canonical `/{market}/{locale}/...` runtime route |

## References

- `documentation/architecture/RuntimeProfiles.md`
- `documentation/engineering/CloudflareOperations.md`
- `documentation/services/tokyo-worker.md`
- `documentation/services/prague/prague-overview.md`
- `documentation/capabilities/localization.md`
