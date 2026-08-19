# SEO/GEO/AEO Capability

STATUS: ALL CURRENT WIDGETS DEPLOYED TO CLOUD-DEV — OWNER QA PENDING

## Product Contract

Clickeen's first SEO/GEO/AEO capability is the public artifact itself:

```text
exact saved Widget instance
+ Widget discovery.json
+ exact account policy at explicit Publish
-> Roma complete semantic HTML/CSS/JavaScript materialization
-> Tokyo exact package storage
-> cached base or selected-locale semantic HTML at the Edge
```

Search crawlers, generative systems, and answer engines receive meaningful
headings, text, links, content identity, and authored relationships before
JavaScript. Mandatory Core JavaScript owns Widget behavior; it does not create
the first meaningful page, localize, host, or serve the instance.

This foundation makes discovery and extraction possible. It does not guarantee
ranking, citation, or answer-engine selection.

## Authorities

| Concern | Authority |
| --- | --- |
| Widget meaning and important content parts | Widget `discovery.json` and Core HTML |
| **Enable SEO/GEO** saved value | shared `behavior.seoGeo.enabled` control |
| Tier permission | system `embed.seoGeo.enabled` policy |
| Technical public output | Roma's generic materializer during explicit allowed Publish |
| Exact package storage and public delivery | Tokyo-worker |
| Selected-locale semantic HTML | Tokyo-worker Edge overlay expression |
| Prague marketing metadata/routes | Prague's repo-authored page source and Astro output |

Bob does not own Discovery output. Tokyo-worker does not infer it. No visitor
request calls a model, agent, Bob, Roma, or Widget authoring source.

## Widget Discovery Source

Every canonical Widget source contains internal `discovery.json`:

```text
widgetType
kind
baseline
parts
relationships
```

It declares:

- what the Widget is;
- its Clickeen-owned baseline title/description;
- which exact declared customer-content paths matter; and
- how those content parts relate through their existing stable identities.

It contains no account tier, toggle coordinate, Bob control, output template,
HTML tag, JSON-LD template, public route, customer override, or materializer
code. The user does not edit it and Bob does not generate an SEO editor from it.

The Widget compiler may prove this git-authored source while producing the
artifact. Once produced, Bob, Roma, materialization, and Tokyo-worker trust the
exact Clickeen artifact without another semantic validator or fallback.

## Tier Behavior

The shared ToolDrawer control is named **Enable SEO/GEO** and saves:

```text
behavior.seoGeo.enabled
```

Its entitlement is:

```text
embed.seoGeo.enabled
```

- Every tier receives the Widget's Clickeen baseline title and description.
- Tier 2 and above may additionally enable the Widget's authored
  content-derived output.
- Bob applies the edit entitlement before draft mutation.
- A denial leaves the draft unchanged and sends Roma the exact
  `{ capability, messageId, required }`.
- Save persists the exact value but generates no public output.
- Publish consumes the exact saved value and system flag.
- Serve reads no tier and makes no SEO/GEO decision.

## FAQ Authored Discovery Example

FAQ is the current authored rich-result example of this contract.

Its `discovery.json` declares:

```text
kind: faq
baseline title: FAQ by Clickeen
baseline description: Questions and answers published with Clickeen.
parts: section title, question, answer
relationship: question answers answer
```

Every FAQ Publish writes the exact baseline `<title>` and meta description on
every tier. Enabled Tier 2+ content-derived output augments that baseline; it
does not replace or suppress it.

When both the saved `behavior.seoGeo.enabled` value and system
`embed.seoGeo.enabled` flag are true, FAQ Core's authored schema.org
`FAQPage`/`Question`/`Answer` microdata surrounds the exact visible
question/answer content slots. The generic render seam matches each declared
Discovery part path to the corresponding editable content slot and carries its
declared role/relationship into the Widget-owned Core template. FAQ Core uses
those exact annotations to author its FAQ markup. The shared materializer
contains no FAQ branch, path list, JSON-LD builder, or customer-metadata
derivation.

The question and answer nodes also carry exact generic
`data-ck-content-path`/`data-ck-content-mode` attributes. For a selected locale,
Tokyo-worker replaces those visible values through Cloudflare `HTMLRewriter`.
The authored FAQ relationship therefore remains attached to the translated
visible content without a second Discovery renderer.

## Static-First Public Delivery

An explicit allowed Publish generates:

```text
index.html  complete base-locale meaning and applicable Discovery output
styles.css  complete shared and Core presentation
runtime.js  mandatory Widget/shared visitor behavior
```

Tokyo-worker stores those exact logical members unchanged inside the one atomic
published `serve-state.json`; they are not separate R2 objects. A base request
selects the requested member from that stored package. A selected non-base
request applies the exact stored overlay into the semantic HTML and sets
`<html lang>` before returning it. The response uses the existing public cache
policy; the locale query is part of the request cache coordinate. Every index
response also contains exact Edge-authored switcher options for the base locale
and stored overlay coordinates. Publish,
unpublish, Delete, and overlay changes cause Tokyo's default Worker entrypoint
to schedule its own Workers Cache eviction after the owning truth mutation
through `waitUntil` and the exact account-instance tag. Eviction is outside the
product response and UI. Every cacheable response
for the exact account/instance carries that tag, covering every package path
and locale/query variant.

Tokyo-worker does not compare source/package fingerprints, validate Roma's
semantic output, rebuild the Widget, derive metadata, or localize in client
JavaScript.

## Current Repository And Deploy State

- Big Bang, Cards, Countdown, FAQ, and Logo Showcase have canonical source,
  `discovery.json`, and generated artifacts deployed to cloud-dev.
- All five use the same Bob preview, Save, Publish, Discovery-output, and Edge
  locale contracts. FAQ additionally authors its FAQPage/Question/Answer
  microdata in Core.
- The retired flat Widget clients have no compatibility path.
- Product commit `e2ac3589` is deployed to cloud-dev; Worker/R2, Roma and Bob
  reachability, and authenticated Builder-open evidence pass. Owner QA remains
  pending.

## Prague Boundary

Prague is a separate public marketing-page surface. Its source remains
repo-authored JSON under `tokyo/prague/pages/**`, with locale sidecars beside
the owning page. Prague's Astro routes own required page metadata, canonical
routes, and locale alternates. Widget `discovery.json` does not replace or
compile Prague pages.

There is no standalone SEO/GEO/AEO agent, crawler, cron job, telemetry loop, or
automatic ranking optimizer in the current product.

## Failure Semantics

| Case | Result |
| --- | --- |
| Unpublished Widget instance | public `404` |
| Missing source anchor or stored publication truth | public `404`; no legacy package fallback |
| Invalid stored publication truth | visible server failure; no repair or substitution |
| Missing requested overlay | `404 Locale not available`; no base fallback |
| Unreadable requested overlay | `500 Locale data invalid`; no repair or substitution |
| Denied **Enable SEO/GEO** edit | draft unchanged; one exact Roma upsell Popup |
| Missing required Widget Discovery/message source | artifact-production failure; no runtime fallback |
| Prague page missing required metadata/locale source | Prague load/build failure |

## Verification

Local FAQ evidence:

```bash
node scripts/widgets/generate-artifacts.mjs --widget faq
node scripts/widgets/generate-artifacts.mjs --widget faq --check
```

Inspect the focused materialized FAQ `index.html` with the toggle off and on:

- baseline title/description exist in both;
- complete questions and answers exist before JavaScript;
- FAQPage/Question/Answer microdata exists only for the exact entitled enabled
  state;
- `runtime.js` contains behavior, not initial rendering or localization; and
- selected-locale response HTML changes the exact content slots and `<html
  lang>` while using the same CSS/JavaScript URLs.

Cloud-dev evidence requires an authorized deploy and the exact `dev.clk.live`
surface. Local output is not deployed-product proof.

## References

- `documentation/architecture/RuntimeProfiles.md`
- `documentation/services/roma.md`
- `documentation/services/tokyo-worker.md`
- `documentation/capabilities/localization.md`
