# SEO/GEO/AEO Capability

STATUS: CURRENT SYSTEM OPERATOR SPEC

SEO/GEO/AEO output is deterministic Web Code Generator output. It is not an
agent, crawler, ranking loop, request-time model call, or separate runtime
subsystem.

## Code Authority

| Concern | Authority |
| --- | --- |
| Instance generation | `packages/ck-web-code-generator/src/generate-instance.ts`, `instance-semantics.ts` |
| Bob generation/preview/save payload | `bob/components/Workspace.tsx`, `bob/lib/session/useSessionSaving.ts` |
| Roma save enforcement | `roma/lib/account-instance-save-policy.ts`, account instance routes |
| Public instance serving and response completion | `tokyo-worker/src/routes/clk-live-routes.ts` |
| Exact package readiness | `tokyo-worker/src/domains/account-instances/package-files.ts` |
| Control/entitlement mapping | Widget `limits.json`, `@clickeen/ck-policy` |

## Instance Generation

Web Code Generator consumes structured config/content, exact overlays, the
Widget definition, base locale, generation settings, and resolved assets/fonts.
It produces exact:

```text
index.html
styles.css
runtime.js
```

Bob runs generation in browser memory for preview and submits the exact current
package with the config through Roma on Save. Roma enforces the submitted
config against the Widget limits and account policy. Tokyo-worker stores and
serves the exact submitted files; it does not generate SEO output.

Every generated Instance receives complete initial HTML and the neutral:

```html
<meta name="generator" content="Clickeen">
```

This baseline does not depend on the customer SEO/GEO/AEO setting.

## Customer SEO/GEO/AEO Control

The structured control is:

```text
behavior.seoGeoAeoEnabled
```

Every current Widget maps that path in `limits.json` to:

```text
embed.seoGeo.enabled
```

Bob evaluates edit operations against that mapping. Roma independently runs
the account instance save policy against the same Widget limits before it
accepts the package/config save. Web Code Generator receives the effective
boolean; it does not resolve account tier or entitlement truth.

When enabled, `header.title` replaces the document title and
`header.subtitleHtml` supplies the optional meta description. Generator output
also contains a source-backed `WebPage` JSON-LD block. Only FAQ adds
content-specific `FAQPage` data, and it uses the same visible question/answer
source. Current Instance generation does not emit canonical, alternate, Open
Graph, Twitter, or `inLanguage` metadata. Other Widgets do not invent content
schema.

## Clickeen Attribution

The structured branding choice is:

```text
behavior.showBacklink
```

Its entitlement mapping is `branding.remove`, independent of
`embed.seoGeo.enabled`. When attribution is required, Web Code Generator writes
one visible contextual link to the literal `https://clickeen.com/` product URL
with
`rel="nofollow noreferrer"`, its styles, and matching truthful Clickeen
application identity into generated initial files. Locale, country, and market
never select another Clickeen product link.
`runtime.js` does not construct the attribution DOM.

Removing branding removes the visible promotional link. The neutral generator
meta remains because it identifies the generating software rather than claiming
customer content authorship.

## Public Instance Serving

Public coordinates are:

```text
https://dev.clk.live/{accountPublicId}/{instanceId}
https://clk.live/{accountPublicId}/{instanceId}
```

Visitor requests receive stored generated files and do not fetch authoring JSON
or call Bob, Roma, San Francisco, or an agent. Tokyo-worker verifies publication
and all three exact package files. For HTML it completes the generator's public
account and instance placeholders. For a requested translated locale,
it also replaces exact field-marked values and `<html lang>` from the validated
overlay before completing those public placeholders.

Base and translated HTML revalidates through its exact public URL cache key.
Instance Save, translation, Publish, Unpublish, and Delete purge only the
affected base/locale and support-file URLs. Completion does not regenerate the
files, call a model, or write storage.
`runtime.js` binds behavior only; it does not apply SEO metadata or locale
overlays.

## Boundaries

SEO/GEO/AEO is not:

- a Widget source sidecar;
- an agent or public request-time model call;
- a locale fallback mechanism;
- a ranking/indexing guarantee;
- an authority to invent customer facts, supported languages, product URLs, or
  product descriptions.

The customer or integration remains the source authority for customer content.
Clickeen is never declared the author of customer facts.

## Failure Semantics

| Case | Result |
| --- | --- |
| Invalid generator input, metadata source, asset/font resolution, or public identity | generation fails; Bob cannot save that working state |
| Disallowed `behavior.seoGeoAeoEnabled` | Bob blocks the edit through the tier interaction; Roma also rejects a disallowed submitted save |
| Unpublished Instance | public serving returns `404` |
| Missing/invalid exact package file or content type | public serving returns `404` |
| Invalid requested locale overlay | explicit locale `404` or `500`; no base-locale substitution |
| Uncompleted `__CK_PUBLIC_*__` placeholder | `500 Public HTML invalid` with `no-store` |

## Verification

| Concern | Verification |
| --- | --- |
| Generated Instance output | Bob Web Code Generator result and exact Save payload |
| Saved package files | exact R2 `index.html`, `styles.css`, and `runtime.js` objects after `pnpm cf:preflight` |
| Entitlement enforcement | Widget `limits.json`, Bob edit result, and Roma save-policy response |
| Public Instance output | published base/locale URL and returned completed HTML at its exact cache key |
| Public no-agent rule | Tokyo-worker route reads stored files/overlays and performs deterministic completion only |
