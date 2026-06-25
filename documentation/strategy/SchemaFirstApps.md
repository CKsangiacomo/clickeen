# Schema-First Apps

STATUS: INFORMATIVE - STRATEGY & VISION

This document explains the long-range product thesis beyond widgets, pages,
emails, and public content artifacts. It is not a current runtime spec and does
not define app routes, data models, billing, storage paths, or implementation
status.

## Thesis

Clickeen is not surface-first. Clickeen is schema-first.

The current product starts with widgets because they are the smallest useful
schema-backed atoms. Widgets compose into pages. Pages can compose into sites.
The same atoms can later compose into emails, reports, feeds, crawler artifacts,
answer artifacts, and other surfaces.

That is still not the end state.

The end state is schema-first apps.

```text
schema -> tokens -> product atoms -> surfaces -> apps
```

Examples of future apps include CRM, ORM, social media management, marketing
automation, support, analytics, commerce, and operations. These should not be
separate SaaS kingdoms. They should be agent-operable applications built on top
of the same schema-driven Clickeen substrate.

## Core Delta

Legacy SaaS builds apps top-down:

```text
CRM surface -> CRM data model -> CRM automation -> AI feature
email surface -> email data model -> email automation -> AI feature
social scheduler -> scheduler data model -> scheduling automation -> AI feature
```

Each app becomes its own product kingdom with its own fields, workflows,
permissions, reports, automation logic, and AI bolt-ons. Humans operate the app
through screens. Agents, if added later, must work around opaque per-surface
state.

Clickeen is bottom-up:

```text
schema -> tokens -> records/content/relationships/events -> agent operations -> app expressions
```

The app is downstream of schema truth. It is a composed expression of the
structured substrate, not the source of product truth.

## What An App Means In Clickeen

A Clickeen app is not a standalone SaaS product inside the company.

A Clickeen app is:

- a domain expression over schema-defined records, content, relationships,
  events, assets, policies, and artifacts;
- an agent-operable surface over named authorities;
- a composition of existing schema-backed atoms plus app-specific schema where
  the domain truly needs it;
- a materialized or interactive expression of structured truth;
- a product boundary only after source authority, write authority, verification,
  and failure law are explicit.

This means a future CRM, social media tool, marketing automation app, or ORM
must not recreate its own disconnected source truth. It must attach to the
schema substrate and expose agent-operable domain operations.

## Render Layer And Operate Layer

Widgets, pages, sites, emails, reports, feeds, crawler artifacts, and answer
artifacts mostly render truth. They are resolved expressions of the substrate.

Apps operate truth.

A CRM, ORM, social media management app, marketing automation app, support app,
or analytics app must read, write, sync, govern, and route domain truth. It
therefore sits on the whole Clickeen substrate, not only on the materializer:

```text
schema
+ records/content/relationships/events
+ command authorities
+ source authorities
+ integration boundaries
+ agent homes
+ materialized surfaces
```

The materializer is one substrate capability. It resolves schema truth into
artifacts. It does not define app operation by itself.

A Clickeen-native app has this shape:

```text
schema domain
+ source authority
+ command authority
+ integration boundary
+ agent home
+ materialized surfaces
```

If a future app becomes:

```text
app UI + private app database + AI assistant
```

then it has become a legacy SaaS kingdom inside Clickeen. That is the failure
mode this strategy forbids.

## Why This Matters

The advantage compounds because every new app can inherit the same foundations:

- schema-defined product truth;
- token identity and overlays where values need conditional expression;
- source authority and source-truth fidelity;
- agent-operated mutations through named authorities;
- fail-visible behavior instead of silent fallback;
- evidence for derived artifacts;
- shared content, assets, pages, widgets, records, and events where the domain
  permits it.

For example:

- A CRM contact can connect to pages, widgets, emails, forms, support events,
  and campaign outcomes without becoming a copied record in every tool.
- Marketing automation can operate the same schema-backed content used by pages
  and emails instead of maintaining separate campaign copies.
- Social media management can derive posts from the same product/content truth
  rather than creating disconnected channel drafts.
- Reports can summarize schema-backed activity and artifacts without inventing
  a separate reporting truth.

Agents benefit because they operate one legible substrate instead of learning
many unrelated SaaS kingdoms.

## Integration-Sourced Truth

Future apps make integration-sourced truth first-class.

CRM contacts, inbox messages, review records, social posts, commerce orders,
support conversations, analytics events, listings, and external records often
originate outside Clickeen. Agents must preserve source-truth fidelity for those
records. They may display, summarize, route, analyze, materialize, or derive
from integration-sourced truth. They may mutate the external source only through
an explicit authorized integration write path.

For apps, connectors and sync are not edge features. They are part of the
schema-driven substrate. A future app is Clickeen-native only when it names:

- the external source authority;
- the imported schema/domain representation;
- the authorized write path, if one exists;
- the sync and conflict boundary;
- the agent operation path;
- the verification surface.

## Cross-App Schema Sharing

The payoff comes from shared schema.

If CRM and marketing automation share the same contact schema, a contact update
can be expressed across campaigns, emails, reports, support context, pages, and
widgets without copying the contact into every app.

If every app owns a private schema, Clickeen becomes separate kingdoms connected
by sync glue. That is legacy SaaS with extra steps.

The app-layer moat depends on this law:

```text
shared schema truth -> many app expressions
```

Cross-app sharing must still preserve source authority. Shared schema does not
mean every app can mutate every record. It means agents can reason over one
legible substrate and use named command authorities for allowed mutations.

## Product Law

Future apps must preserve these laws:

- Schema comes before surface.
- Surfaces are downstream expressions, not product truth.
- Apps operate truth; they are not only larger rendered surfaces.
- App-specific schema is allowed only when it adds real domain structure.
- App data must have named source authority.
- Agents operate through named authorities, not hidden workflows.
- Derived artifacts must evidence the truth they embody.
- Cross-app reuse must preserve source-truth fidelity.
- Do not copy content, records, variants, or localized expressions into a new
  app-owned truth unless that app is explicitly the source authority.
- Integration writes require explicit authorized write paths.
- Shared schema is preferred over private app schemas whenever the domain truth
  is actually shared.

## Strategic Boundary

This document is a strategy thesis. It does not make CRM, ORM, social media
management, marketing automation, support, analytics, commerce, or operations
current product surfaces.

Before any app becomes current product truth, it needs:

- a domain PRD;
- source authority;
- schema ownership;
- account/session authority;
- write and read routes;
- storage/runtime boundaries;
- agent ownership;
- verification surfaces;
- explicit failure semantics.
