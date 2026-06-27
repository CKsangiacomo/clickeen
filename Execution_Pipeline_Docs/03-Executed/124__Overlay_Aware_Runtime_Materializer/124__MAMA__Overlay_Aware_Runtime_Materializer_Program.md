# PRD 124 - Mama PRD - Overlay-Aware Runtime Materializer Program

Status: EXECUTED - HISTORICAL PARENT CONTRACT
Owner: Roma + Tokyo-worker + Babel
Date: 2026-06-25
Stage: 03-Executed

## Purpose

PRD 124 is the parent seed contract for overlay-aware runtime materialization.
It is not one implementation PRD. The blast radius touches schema, token
identity, overlays, Roma saves, Translation Agent, Tokyo storage, public
serving, CDN behavior, preview parity, and future composition.

Execution must happen through SubPRDs 124A-124H.

## Core Delta With Legacy SaaS

Legacy SaaS is surface-first:

```text
surface -> private app model -> workflow -> AI feature
```

Clickeen is schema-first:

```text
schema -> token identities -> overlays -> resolved artifacts -> surfaces
```

Surfaces are downstream expressions. They are not product truth.

## Foundational Law

Clickeen is a schema-first matrioska system. Every layer composes from the
layer beneath it by reference, not by copy.

```text
schema + source + selected overlay values -> evidenced artifact
```

The system must not become:

```text
base document + translated document + variant document + personalized document
```

## Composition Law

Widgets are schema-native building blocks. They compose upward:

```text
widget -> page
page -> site
widget -> email
widget -> report
widget -> feed block
widget -> crawler artifact
widget -> answer-engine artifact
widget -> future surface artifact
```

PRD 124 starts with one widget instance coordinate. Its contracts must not block
later page, site, email, report, feed, crawler, answer, or app composition.

The concrete invariants are:

- future surfaces reference widget artifacts by coordinate and evidence;
- future surfaces do not copy widget source truth into private documents;
- future surfaces do not add visitor-time source/overlay composition;
- PRD 124 does not create a global composition registry.

## Current Product Gap

Roma currently generates public files at save time:

```text
accounts/{accountPublicId}/instances/{instanceId}/index.html
accounts/{accountPublicId}/instances/{instanceId}/styles.css
accounts/{accountPublicId}/instances/{instanceId}/runtime.js
```

Translation Agent writes locale overlays later:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

Public serving currently serves stored base package bytes and does not use the
locale overlays. PRD 124 closes this gap by making public artifacts derived
from schema/source/overlay truth.

## Program Scope

PRD 124 executable coordinate:

```text
source account instance + locale
```

Allowed now:

- base locale artifact;
- one active non-base locale overlay artifact.

Not in PRD 124:

- A/B;
- personalization;
- campaign/device/generic dimensions;
- SEO/GEO/AEO overlays;
- geo overlays;
- second-level overlay stacks;
- page/site/email/report/feed/app implementation.
- RTL, script-specific layout, and text-expansion layout work unless a SubPRD
  names an existing current-system contract.

## Execution Doctrine

PRD 124 executes from schema certainty, not runtime guessing.

This is a schema-driven PRD for a schema-driven architecture. Agents must
operate only declared truth:

- schema-declared fields;
- schema-token identities;
- source authority;
- overlay authority;
- artifact coordinates;
- evidence fields;
- command authorities;
- explicit failure states.

If schema and authority do not name something, an agent must not invent it,
repair it, infer it, backfill it, or serve around it.

### Not Legacy SaaS

PRD 124 must not introduce legacy SaaS operating patterns:

- hidden workflows;
- fallback serving;
- repair routines;
- compatibility readers;
- product-status stores;
- probe-driven product state;
- best-effort partial success;
- request-time composition;
- validation rituals that become runtime truth.

Clickeen's product model is deterministic:

```text
schema truth + source truth + overlay truth -> evidenced artifact
```

### Granularity Is Product Safety

Granularity is mandatory because the system is compositional. One missing
contract detail can corrupt every layer above it.

Each SubPRD must name:

- active authority;
- exact source input;
- exact schema/token input;
- exact output artifact;
- exact evidence;
- exact failure result;
- exact verification surface.

No SubPRD may hide an unresolved contract decision in implementation code.

If a SubPRD contradicts the parent program law, execution resolves to this MAMA
contract plus the 124A contract lock. The SubPRD must be corrected before code
may claim the disputed behavior.

### Atomic Cascade Risk

Clickeen is Brad-Frost-style and matrioska-shaped. Base mistakes cascade:

```text
schema mistake -> token mistake -> overlay mistake -> artifact mistake -> surface/app mistake
```

Therefore base contracts must be boring, explicit, and locked before higher
layers use them. PRD 124 must prefer smaller exact slices over broad execution.

### CDN And Cost Law

Efficiency at scale is product law, not optimization.

Public serving must preserve:

- stored evidenced bytes;
- short-TTL/purgeable entry artifacts;
- immutable fingerprinted support files only when those files are
  content-addressed and not mutable entry files;
- no visitor-time materialization;
- no visitor-time overlay reads;
- no request-time source composition.

If PRD 124 turns public serving into dynamic composition, it breaks the product
economics and the architecture.

Current divergence: Tokyo currently serves `index.html`, `styles.css`, and
`runtime.js` as mutable package files with the same short-TTL cache header. 124E
owns either closing this by introducing content-addressed support files or
documenting that mutable CSS/JS remain short-TTL entry files.

### Direct Agent Operations

Operations are direct and governed by named authorities. The system is closed:

```text
schema says what is valid
authority says who can mutate
artifact evidence says what produced it
storage path says where it belongs
serving rule says whether it can be served
```

Checks may prove SubPRD conformance during execution. They must not become
runtime truth, repair logic, fallback logic, readiness state, or product-state
discovery.

The execution goal is to make invalid states unrepresentable by schema and
authority, not detectable later by process.

## SubPRD Map

| SubPRD | Scope | Primary authority | Blocks |
| --- | --- | --- | --- |
| 124A | Schema-token contract lock | Roma + Babel contract | All implementation beyond contract lock |
| 124B | Pure materializer package | Package contract | 124C, 124D |
| 124C | Base artifact reroute | Roma save path | Locale work |
| 124D | Locale artifact materialization | Roma + Translation Agent + materializer | Tokyo locale serving |
| 124E | Tokyo stored-byte serving and CDN | Tokyo-worker + Roma purge authority | Public locale URL |
| 124F | Current cascade operations | Roma account commands | Reliable source/overlay/locale updates |
| 124G | Broad dependency cascade audit | Architecture + DevOps/product ops | Widget/Dieter/materializer fan-out |
| 124H | Composition readiness | Architecture/product strategy | Pages/sites/emails/reports/future apps |

## Authority Law

System interaction chain:

```text
Roma account/session command authority
-> Roma source/package command
-> Tokyo-worker exact R2 storage
-> Translation Agent overlay writes through Roma grant
-> pure materializer package
-> Tokyo-worker stored-byte public serving
```

Babel is protocol/schema law for overlay values. It is not a new service hop.

| Concern | Authority |
| --- | --- |
| Current account, role, tier, policy | Roma from Berlin bootstrap/authz |
| Source save command | Roma |
| Locale setting command | Roma |
| Translation generation | Translation Agent through Roma grant |
| Overlay storage | Tokyo-worker exact R2 operation |
| Runtime resolution | `packages/ck-runtime-materializer` |
| Runtime artifact write command | Roma first |
| Public stored-byte serving | Tokyo-worker |
| Entry artifact update/purge | Roma through current Tokyo/Cloudflare path |

The materializer must remain a pure resolver. It must not fetch, mutate storage,
infer policy, purge cache, call services, or record product status.

## Product Ownership Gates

These ownership gates prevent unowned visitor/admin behavior from becoming
implementation drift:

| Concern | Owner | Contract |
| --- | --- | --- |
| Visitor request for a missing locale artifact | 124E | Explicit fail-closed public response. No base-locale fallback and no request-time composition. |
| Current public locale URL shape | 124A + 124E | 124A locks coordinate law; 124E implements stored-byte URL serving. |
| Current widget locale discovery/crawl exposure | 124H or later SEO/GEO/AEO PRD | Explicitly assigned before claiming crawl/answer reach. Not required for 124D/124E stored-byte serving. |
| Account-admin locale command visibility | 124F | Show command/artifact truth without lifecycle ledgers, readiness files, or persistent status objects. |

## Evidence Law

Artifacts must evidence real independently moving inputs:

```text
schema/widget contract fingerprint
source fingerprint
source reference
locale coordinate
overlay fingerprint for non-base locale
materializer contract version
generated package fingerprint
support-file fingerprints
```

Do not invent separate fingerprints for concepts that do not move separately in
the current system.

## Identity Law

Use existing schema artifacts. Do not create a Schema service, token registry,
or identity database in PRD 124.

For PRD 124:

```text
scalar token identity = schema path
repeated token identity = schema path + arrayItemIdentity + saved item ids
```

Locale cascade must not claim repeated-structure reorder safety until overlay
keys can map exactly to this identity.

## CDN Law

Use:

```text
pretty coordinate URL -> short TTL entry HTML
fingerprinted support files -> immutable long TTL CSS/JS
```

The materializer does not purge. Roma owns entry artifact update and purge for
pretty coordinate URLs. Tokyo-worker serves stored evidenced bytes only.

## Cascade Law

Executable in PRD 124 after the PRD 126M Roma UI save/localization boundary correction:

- source/base instance persistence;
- explicit translation generation;
- active locale add/remove;
- account policy value that affects current artifact output.

Detected but not broadly executed until 124G:

- schema/widget contract change;
- Dieter change;
- materializer contract change;
- widget package fan-out.

## Parent Acceptance

- SubPRDs exist and are narrow enough to execute safely.
- 124A locks schema identity, evidence, URL, cache, failure, Translation Agent
  compatibility, and preview parity before implementation.
- 124B proves the resolver as a pure package.
- 124C preserves current base serving before locale behavior changes.
- 124D materializes one non-base locale without serving fallback.
- 124E serves explicit locale stored bytes with evidence validation.
- 124F's original save-time localization scope is superseded; current
  locale follow-up belongs to explicit translation generation and active-locale
  settings commands without full-success lies.
- 124G owns broad dependency fan-out before any mass cascade.
- 124H keeps the contract compatible with future composition without expanding
  PRD 124 execution scope.
