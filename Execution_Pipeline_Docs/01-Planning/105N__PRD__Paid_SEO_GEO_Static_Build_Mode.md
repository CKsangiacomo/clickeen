# PRD 105N - Paid SEO/GEO Static Build Mode

Status: Planning / deferred future 105-series sub-PRD / not executable until 105M and public serving proof are green
Owner: Product + Architecture
Date: 2026-05-28
Parent: `105__PRD__Instance_Folder_Tenets.md`
Depends on: `105C__PRD__Tokyo_Runtime_Boundary_Verification.md`, `105E__PRD__Generic_Translation_Field_And_Agent_Contract_Verification.md`, `105F__PRD__Manual_Translation_Edit_And_Public_Materialization_Verification.md`, `105J__PRD__Prague_Public_Dogfood_Boundary_Verification.md`, `105L__PRD__R2_Bucket_And_Widget_Package_Source_Cleanup.md`, `105M__PRD__Tokyo_Worker_Instance_Runtime_Refactor.md`
Replaces: `101__PRD_STUB__Paid_SEO_GEO_Embed_Coding_Agent.md`

## Purpose

Define the paid SEO/GEO build mode for published Clickeen widgets as a downstream extension of the PRD 105 instance-folder model.

This PRD is intentionally in `01-Planning`, outside the active execution set. It must not execute before the core runtime is clean:

```text
source taxonomy first
locale overlays second
Tokyo-worker materialization/runtime cleanup third
paid SEO/GEO build mode last
```

No `105N-*` child PRD may execute until:

- `105M` is green;
- public serving proves the PRD 105 artifact shape;
- locale overlays are real;
- Prague dogfoods public coordinates only;
- entitlement authority is named in `ck-policy`.

Its presence is not permission to execute SEO/GEO work during the active 105 runtime cleanup.

SEO/GEO is not a runtime rendering service. It is not a `clk.live` request-time decision. It is not a second public namespace.

SEO/GEO means:

```text
same saved instance source
same locale overlays
same publish/materialization operation
same public serving path
richer generated static browser output and metadata for entitled accounts
```

## Product Contract Under PRD 105

The normal public widget shape is fixed by PRD 105 and 105M:

```text
accounts/{accountPublicId}/instances/{instanceId}/
  instance.config.json
  instance.content.json
  overlays/locales/{locale}.json
  index.html
  styles.css
  runtime.js
```

Paid SEO/GEO mode may change the generated browser output:

- semantic HTML quality;
- structured data;
- Open Graph metadata;
- canonical metadata;
- crawler/indexing metadata;
- attribution behavior according to entitlement.

It must not change:

- the source taxonomy;
- the account coordinate model;
- the runtime public boundary;
- the default public artifact shape;
- the locale overlay model.

SEO/GEO is a richer materialization mode, not a second instance architecture.

## What SEO/GEO May Use

SEO/GEO generation may use only approved product source:

- `instance.config.json`;
- `instance.content.json`;
- `overlays/locales/{locale}.json`;
- account assets referenced by the instance;
- widget package contracts;
- entitlement/policy data;
- explicit customer settings saved through product operations.

It must not invent customer facts, reviews, prices, business locations, offers, availability, guarantees, or claims.

## Entitlement Contract

SEO/GEO is a paid build mode.

Entitlement truth must come from the existing account policy path:

```text
ck-policy + account policy/account tier
```

Do not hardcode SEO/GEO entitlement in Bob, Roma, Tokyo, `clk.live` public serving, Prague, or San Francisco.

Free/base widgets remain functional and static. Free/base widgets may include honest Clickeen attribution if allowed by plan and policy, but that attribution is a growth loop for Clickeen, not full customer SEO/GEO.

## Public Serving Contract

`clk.live` public serving reads generated public artifacts only.

Public visitors must not:

- trigger SEO/GEO generation;
- choose SEO/GEO mode;
- call Bob;
- call Roma editor state;
- call Berlin;
- call San Francisco;
- read private source JSON directly;
- read translation operation state.

## Locale Contract Under PRD 105

The default PRD 105 architecture is not per-locale HTML or per-locale JavaScript.

Do not make this the default:

```text
fr.html
script.fr.js
styles.fr.css
```

The default model is:

```text
index.html
styles.css
runtime.js
overlays/locales/{locale}.json
```

SEO/GEO may propose static locale-specific pages only if a future child PRD proves a real SEO/GEO need, names the public artifact shape, and keeps it separate from the default embed model.

Until that child PRD exists, locale SEO/GEO behavior is limited to metadata and runtime-visible translated content derived from locale overlays in the normal public widget shape.

## Widget-Specific SEO/GEO Requirements

PRD 105N child slices must define widget-specific rules before implementation.

For FAQ, likely requirements include:

- semantic question/answer structure;
- `FAQPage` JSON-LD only when content qualifies;
- no hidden keyword stuffing;
- no hallucinated claims;
- translated FAQ text only when the locale overlay exists and is in sync;
- clear metadata derived from saved instance source.

For future widgets, each widget type must map to the correct semantic and structured-data contract. Do not force FAQ schema onto unrelated widgets.

## Free Attribution Contract

Free widgets may include visible, honest Clickeen attribution when policy requires it.

Rules:

- attribution is visible and accessible;
- attribution is not hidden text;
- attribution points to the relevant Clickeen/Prague product page when possible;
- paid plans may remove attribution according to entitlement;
- attribution does not claim the customer's widget has paid SEO/GEO unless enabled;
- attribution does not keyword-stuff customer pages.

## Prague Dogfood Contract

Prague is a first-class dogfood surface for SEO/GEO only through the public widget boundary.

Prague may embed Clickeen-owned widgets by:

```text
accountPublicId + instanceId
```

Prague must not consume:

- generated source internals;
- translation operation state;
- San Francisco job state;
- private Tokyo R2 paths;
- SEO/GEO build internals.

## Expected Future Child Slices

| Slice | Scope |
| --- | --- |
| `105N-A` | SEO/GEO entitlement and account policy contract |
| `105N-B` | Widget-specific semantic HTML and structured-data rules |
| `105N-C` | Metadata, canonical, crawler, and indexing policy for the default PRD 105 public shape |
| `105N-D` | Build-time agent/rules for SEO/GEO output and validation |
| `105N-E` | Roma/Bob controls, status, and validation report UX |
| `105N-F` | Prague dogfood pages for paid SEO/GEO examples |
| `105N-G` | CI/static validation against hidden text, spam, hallucinated claims, and invalid structured data |
| `105N-H` | Optional future locale-specific static public artifacts, only if SEO/GEO need is proven |

## Required Non-Scope

Do not:

- introduce runtime SEO rendering;
- change the PRD 105 instance-folder default;
- add alias/shortener/public namespace systems;
- create default `{locale}.html`;
- make `clk.live` public serving compute SEO/GEO per request;
- make San Francisco run on public visitor traffic;
- duplicate source JSON for SEO/GEO;
- copy account assets into instance folders;
- bypass account policy entitlement;
- make Prague a privileged consumer of internals.

## Verification Scope

This PRD is ready for child execution only when:

- PRD 105 instance folder taxonomy is green enough for publish/materialization work;
- public widget generation uses `index.html`, `styles.css`, and `runtime.js`;
- locale overlays are represented as `overlays/locales/{locale}.json`;
- Tokyo-worker no longer writes `translation-generation-job.json`;
- Tokyo-worker no longer materializes default `{locale}.html`, `script.{locale}.js`, `script.v*.js`, or `styles.v*.css`;
- entitlement authority is named in `ck-policy`;
- Prague dogfoods public coordinates only;
- active docs no longer present the old PRD 101 stub as current authority.

## Archive Decision For Source Stub

The old PRD 101 stub must remain archived in `03-Executed` as historical planning evidence.

Required archive status:

```text
Historical future-feature stub.
Surviving SEO/GEO doctrine extracted to PRD 105N.
Superseded by PRD 105 and PRD 105N where conflicting.
```
