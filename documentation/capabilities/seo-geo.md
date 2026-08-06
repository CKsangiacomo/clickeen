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
| Page authoring source | `packages/ck-contracts/src/pages.ts`, `roma/app/api/account/pages/**`, `tokyo-worker/src/domains/pages/**` |
| Policy registry/matrix | `packages/ck-policy/src/registry.ts`, `packages/ck-policy/entitlements.matrix.json` |

## Current Runtime Truth

Current public widget serving is generated-file serving.

```text
https://dev.clk.live/{accountPublicId}/{instanceId}
https://clk.live/{accountPublicId}/{instanceId}
```

Public visitor requests:

- receive generated files from Tokyo-worker/R2;
- do not fetch authoring JSON;
- do not fetch overlay JSON directly;
- do not call Bob/Roma account APIs;
- do not call San Francisco or an agent endpoint;
- do not compose translations at request time.

Generated account instance package files live under:

```text
accounts/{accountPublicId}/instances/{instanceId}/
  serve-state.json
  index.html
  styles.css
  runtime.js
```

Public Widget serving is gated by the stored publish/package state.
Unpublished, missing, malformed, or mismatched package state returns `404`.
Page public serving is not implemented in the current slice; Tokyo-worker has
no placeholder public Page route.

Public-serving hosts must expose generated artifacts only. Operational paths
such as `/healthz`, `/__internal/*`, and `/widgets/*` return `404` on
`dev.clk.live` and `clk.live`.

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

PRD 127 closes this gap for Widget Instances through the shared Clickeen
tier-gate interaction and the Web Code Generator. Bob's planned **Enable
SEO/GEO/AEO** control is visible and off by default for every tier. When a Free
or Tier 1 user attempts to turn it on, the value remains off and the existing
Upgrade dialog opens. Tier 2 and above may turn it on. The saved Instance choice
lives in `instance.config.json`; Roma rechecks `embed.seoGeo.enabled` on Save
before generated Instance files are accepted. The Web Code Generator receives
the effective Instance boolean and never resolves tiers itself.

Pages have no equivalent toggle or saved boolean. `pages.max` already makes
ordinary Pages a Tier 2-or-higher product, so every ordinary Page receives the
Page metadata, locale relationships, social metadata, one localized `WebPage`
JSON-LD block, and any supported visible-content schema described by PRD 127.
Complete semantic HTML remains the baseline for every Widget and Page.

Tokyo-worker stores and serves submitted artifact files. It does not decide
whether an account is entitled to SEO/GEO output.

### Accepted PRD 127 product contract

PRD 127 separates four responsibilities that must not be confused:

1. **Baseline output:** every ordinary Widget Instance and Page receives
   complete semantic initial HTML. This applies to every tier and does not
   depend on `embed.seoGeo.enabled`. Every generated document contains the
   neutral `<meta name="generator" content="Clickeen">` provenance tag.
2. **Clickeen identity and Free distribution:** a Free Widget Instance contains
   one visible contextual Clickeen attribution link plus matching truthful
   Clickeen/Widget product identity in its initial HTML. Pages are a Tier 2+
   product and do not use the Free Widget distribution contract.
3. **Widget customer enhancement:** an entitled customer may enable
   customer-owned Widget metadata, canonical and locale relationships,
   supplied social metadata, discovery, and supported source-backed structured
   data through the saved Instance choice plus `embed.seoGeo.enabled`.
4. **Page customer output:** every ordinary Page receives the equivalent Page
   output from its declared Page fields and exact Page overlays. There is no
   Page SEO switch or Page SEO entitlement branch.

Every ordinary Page's initial HTML contains one `WebPage` JSON-LD block. For an
exact-locale response it contains:

- `@context: https://schema.org`;
- `@type: WebPage`;
- `@id`: the exact-locale Page URL followed by `#webpage`;
- `url`: the exact-locale Page URL;
- `name`: the effective localized Page title;
- optional `description`: the effective localized Page description;
- `inLanguage`: the exact requested locale;
- optional `primaryImageOfPage`:
  `{ "@type": "ImageObject", "contentUrl": <supplied social image URL> }`.

Web Code Generator writes the JSON-LD into `index.html`; Tokyo completes its
exact URL and locale values through the existing HTML-marker response path
before the response is cached. This is ordinary Page generation and serving,
not a separate schema or AEO subsystem.

For the eight current Widgets, PRD 127 uses declared source paths rather than
heuristics: `header.title` supplies the customer SEO title and
`header.subtitleHtml` supplies the source-backed description. Only FAQ declares
content-specific `FAQPage` structured data, using its existing visible question
and answer paths. This is the only current content-specific Page schema
contribution. The other Widgets receive common semantic metadata without
invented content schema or Widget-specific SEO renderers.

`branding.remove` controls visible Clickeen attribution. It does not control
complete HTML and it does not grant customer SEO/GEO/AEO. Conversely,
`embed.seoGeo.enabled` does not control the Free attribution requirement.

The planned Web Code Generator owns final markup for all four responsibilities.
It consumes a small typed Clickeen public product identity map, not an agent or
request-time service. That map owns the approved Clickeen organization/platform
identity and, per Widget product, the real product URL, stable schema `@id`,
factual description, attribution wording, and Schema.org type. Locale truth
remains in the existing locale authority; the identity map is not a second
locale registry.

For Free Widgets, the generator writes the visible link as ordinary crawlable
HTML with `rel="nofollow noreferrer"` and writes matching JSON-LD into the same
`index.html`. It may identify:

- Clickeen as `Organization` and software/service provider;
- the Widget product as a `WebApplication`;
- the generated public Instance as the customer's `WebPage`;
- the exact served locale through `inLanguage`;
- Clickeen product/service `availableLanguage` only from the existing
  supported-locale authority;
- Clickeen as structured-data publisher through `sdPublisher` only when true;
- the product relationship through `isPartOf`, `isBasedOn`, `creditText`, or
  other supported properties only when their literal meaning is true.

The customer or integration remains the owner of customer content. A
content-specific `mainEntity`, such as FAQ content, is not part of the mandatory
Free identity graph. It is generated only when `seoGeoAeoEnabled: true`, only
from declared source fields, and must agree with visible HTML. Clickeen is never
declared the author of customer facts.

Pages remain visible to every tier. Free, Tier 1, and accounts downgraded into
those tiers see the Pages domain and any retained Page inventory, but Roma blocks Page product
actions through the standard Upgrade interaction before any write or generator
call. SEO/GEO/AEO adds no downgrade generator branch, package rewrite,
Page-currency rule, sitemap policy, or cleanup job. Public serving does not
resolve account tier.

Paid output has the same semantic baseline. When `branding.remove` removes
branding, generated code contains no visible Clickeen promotional link. The
neutral `meta[name="generator"]` remains because it identifies the generating
software; it is not a link, visible promotion, or claim of content authorship.

The Clickeen product pages and identity map are one contract. A generated URL
or schema `@id` must resolve to a real public Clickeen page whose visible claims
and JSON-LD agree. Unsupported language claims, placeholder URLs, hidden links,
keyword-stuffed anchors, or improvised product descriptions are invalid.

This can make Clickeen and its Widget products easier to discover and
understand. It cannot guarantee ranking, indexing, rich results, AI citation,
or answer placement.

## Current Operator Rule

There is no SEO/GEO/AEO operation to run today.

Operators can currently verify only these facts:

1. The policy key exists in `@clickeen/ck-policy`.
2. Public widget serving returns generated package files for published account
   instances.
3. Page public serving is not active.
4. No current runtime path proves SEO/GEO/AEO generation, measurement, ranking
   feedback, or automatic optimization.

Do not create a work item from this page that assumes a current SEO/GEO/AEO
agent, crawler, cron job, page route, locale route, schema output, or ranking
feedback loop exists.

## Current Boundaries

SEO/GEO is not currently:

- a widget source sidecar;
- a runtime agent call;
- a public request-time rewrite;
- a locale fallback mechanism;
- a widget-source SEO/GEO sidecar contract.

Roma builds embed snippets from the public URL after publish. Public runtime
serves the generated artifact.

## Direction

Clickeen SEO/GEO/AEO will operate by public surface:

- by widget instance;
- by Page after its later generation and publication slices are implemented.

Directionally, the system should produce crawlable, high-quality public
surfaces from structured Clickeen artifacts. Translation/Babel overlays are a
key input to global availability, but current public runtime does not yet expose
locale-specific crawlable surfaces from overlays.

No implemented SEO/GEO/AEO agent exists. Directionally, such an agent would
measure, recommend, and improve public surface quality without mutating source
truth silently. Exact cron jobs, telemetry, ranking feedback, and future
automatic optimization are not specified here. The accepted deterministic
generation contract is the PRD 127 target stated above.

The Web Code Generator described by PRD 127 is deterministic code generation,
not that future agent. Until 127B is deployed, current JavaScript branding and
current generated-package behavior remain the runtime truth.

## Current Failure Semantics

| Case | Current result |
| --- | --- |
| Unpublished widget instance | public serving returns `404` |
| Missing or malformed package state | public serving returns `404` |
| Missing package file | public serving returns `404` |
| Package metadata/fingerprint mismatch | public serving returns `404` |
| Public Page request | no Page public route exists in the current slice |
| Operational path on public host | `404` |
| `embed.seoGeo.enabled` absent from runtime consumer path | no SEO/GEO runtime gate is proven |

## Verification

| Concern | Current verification |
| --- | --- |
| Public widget runtime | `https://dev.clk.live/{accountPublicId}/{instanceId}` returns stored package only when instance pointer is published and package is ready |
| Stored package files | `index.html`, `styles.css`, and `runtime.js` exist under `accounts/{accountPublicId}/instances/{instanceId}/` with valid package metadata/fingerprint |
| Policy key source | `packages/ck-policy/entitlements.matrix.json` |
| Runtime entitlement gap | no proven active consumer of `embed.seoGeo.enabled` outside policy metadata/docs; registry metadata currently conflicts with runtime evidence |
| Public no-agent rule | public runtime does not call Roma/Bob/San Francisco/agents |

## References

- `documentation/architecture/RuntimeProfiles.md`
- `documentation/engineering/CloudflareOperations.md`
- `documentation/services/tokyo-worker.md`
- `documentation/capabilities/localization.md`
- [Google Search structured-data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Google crawlable-link guidance](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)
- [Google outbound-link qualification](https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links)
- [Schema.org `sdPublisher`](https://schema.org/sdPublisher)
- [Schema.org `WebApplication`](https://schema.org/WebApplication)
- [Schema.org `availableLanguage`](https://schema.org/availableLanguage)
