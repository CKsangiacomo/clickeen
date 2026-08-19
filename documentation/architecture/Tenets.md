# Clickeen Architecture Tenets

STATUS: CURRENT SYSTEM OPERATOR SPEC

These tenets are the rules agents and developers use when changing Clickeen.
They protect the agent-operated architecture described in
`documentation/architecture/CONTEXT.md`.

## Founding Tenet: AI-Native From First Principles

Clickeen is an AI-native, agent-operated product built by AI and structured for
AI operation from first principles. It is not a legacy SaaS product with AI
chat, suggestions, or automation added after the product and its workflows were
designed for human operators.

The human product owner/architect owns product direction, architecture judgment,
policy, and final authority. Agents are the normal implementation and
operational workforce inside those boundaries. The system is deliberately lean
and structured so agents can understand and operate it directly: the codebase,
schemas, policies, and stored artifacts are the structured substrate, and the UI
is a product surface rather than the only way to reach or understand product
truth.

AI-native does not mean inserting a model into authentication, storage, Save,
serving, or other deterministic paths. Those paths remain direct and owned by
their named authorities. Models reason where judgment is required; agents act
through typed product capabilities; exact results return as observations. A
change either improves that agent-operability or adds legacy weight.

Do not build a hardcoded service pipeline with an AI call in the middle and
call it an agent. Real Clickeen agents own an operational domain and operate
structured artifacts through named authorities.

## Product Law

Clickeen is a simple account product.

- One user belongs to one account.
- One account has many users.
- The user's role is the user's role in that account.
- There is no customer account switching model.
- `accounts.id` is the compact account product/storage coordinate.
- `accountPublicId` is the API/embed/authz field name for that same value.
- Widgets are software and live in the system.
- A Widget's unique product software is its structured contract plus mandatory
  Core HTML/CSS/JavaScript. It uses Clickeen's shared services; those services
  do not absorb the Widget's meaning.
- Users create widget instances in Roma/Bob and save them in their account.
- Bob edits in browser memory; user Save is the editable-source persistence
  boundary and Publish is the separate public-release boundary.
- Roma is the account app; it routes the user, enforces tier/product policy,
  and saves account work through owner services.
- Tokyo-worker stores and serves account runtime files in R2.
- Admin uses the normal `CLICKEEN` account.

Current account storage coordinate:

```text
Roma current account
-> accountPublicId
-> Roma account route
-> Tokyo-worker
-> accounts/{accountPublicId}/...
```

## Tenet 1: Agents Operate Structured Artifacts

Clickeen artifacts must stay structured, typed, and AI-legible.

Examples:

- widget specs;
- compiled control and field maps;
- editable/translatable field contracts;
- system-entitlement bindings and Widget-owned localized upsell messages;
- atomic account instance source and serve-state artifacts;
- locale overlay value maps;
- account asset references;
- policy matrices and grants;
- service-owned route contracts.

Agents should be able to read the artifact, understand the product boundary,
and operate it directly. If a change hides meaning inside ad hoc code,
compatibility wrappers, undocumented side effects, or stringly conventions, it
weakens the system.

## Tenet 2: Named Authorities Own Boundaries

Each product boundary has one owner.

| Boundary | Authority |
| --- | --- |
| Authentication and bootstrap | Berlin |
| Current account, account routes, tier/product policy | Roma |
| Builder draft editing | Bob |
| Widget-specific contextual upsell messages | Git-authored Widget software |
| Shared upsell composition and system CTA | Roma |
| Public Widget package generation | Roma through the one generic Widget materializer |
| Account runtime storage and public file serving | Tokyo-worker |
| Product widget software | Git-authored Tokyo product root |
| Model execution | San Francisco |
| Product Copilot reasoning | Product Copilot Worker |
| Translation generation | Translation Agent Worker |
| Relational account/support data | Michael/Supabase |
| Design system | Dieter |

Normal product flows operate from the authority already minted by the owner.
They must not repeatedly rediscover account, tier, model, locale, or storage
truth in every downstream step.

## Tenet 3: Clickeen Is A Closed, Trusted System

Clickeen services trust Clickeen-produced truth.

Once a named authority has produced a structured artifact or exact result,
downstream Clickeen services consume it directly. They do not add another
guard, checker, validator, allowlist, filter, normalizer, or schema
interpretation to prove that the upstream Clickeen authority did its job.

```text
owning Clickeen authority
-> exact structured artifact or result
-> trusted downstream consumption
```

Authentication, authorization, and acceptance of non-Clickeen input remain at
the boundary where external input enters or authority is minted. A signed
authority proof establishes who may act; an ingress parser establishes whether
external bytes can become Clickeen truth. Neither justifies revalidating the
meaning of an artifact already produced by another Clickeen authority.

Examples:

- Bob owns one browser-memory Widget draft; Roma accepts that complete draft on
  Save instead of reconstructing a Widget schema from ToolDrawer controls.
  Bob sends `widgetType` only on First Save. Existing Save carries only the
  draft config; Roma loads Tokyo's account-scoped saved list fact and trusts
  its stored `widgetType` instead of comparing a caller identity.
- Roma owns current-account New-draft composition, Save, and Publish commands.
  New writes nothing; first Save creates editable source, later Save updates
  it, and only Publish invokes materialization. Tokyo-worker stores the
  submitted source as one atomic source record and the logical package inside
  one atomic published serve-state instead of interpreting Widget semantics.
- The Widget compiler owns the compiled Widget contract; Bob consumes it
  instead of maintaining a second Widget-specific schema.
- Roma's Widget-neutral materializer owns generated package bytes; public
  serving serves them instead of rebuilding or validating their Widget
  meaning.

This trust law does not turn off an external security boundary. It removes
duplicated internal correctness machinery from a closed system whose named
authorities already own the truth they produce.

## Tenet 4: No Fallbacks, No Silent Substitution

Clickeen must not silently replace missing, invalid, stale, unavailable, or
malformed truth with invented truth.

This applies to:

- instance identity;
- account identity;
- widget config/content;
- locale overlays;
- model/provider routes;
- storage paths;
- public artifacts;
- account assets;

If requested truth is unavailable, the system returns an explicit error or
serves nothing at that boundary. It does not substitute another account,
another locale, another model, another provider, another storage path, or stale
compatibility shape.

Deterministic defaults are allowed only when they are the explicit contract of
that request parameter and do not change identity or claim unavailable work
completed.

## Tenet 5: No Silent Healing

Invalid persisted or user state must not be normalized, repaired, rewritten, or
coerced without an explicit product operation.

The owning ingress boundary may reject non-Clickeen input before it becomes
system truth. Once accepted, downstream services trust and preserve it. An
explicit user/agent action through the owning authority may change truth; an
internal handoff or read may not “helpfully” mutate, filter, revalidate, or
repair it.

## Tenet 6: Product Commands Stay Boring

The normal product path should be direct:

```text
user intent
-> Roma current account route
-> owning service/agent
-> exact product artifact write/read
-> explicit result
```

The browser expresses user intent. It is not the source of account truth and is
not an orchestration bus for server-owned identity/account state.

Internal systems talk through named service bindings/routes and carry only the
authority needed for the operation. Do not invent broad registries, runtime
discovery, compatibility layers, or meta-frameworks for deterministic product
commands.

## Tenet 7: A Widget Is Software That Uses Clickeen

Widget software is authored in git and deployed to Tokyo R2:

```text
tokyo/product/widgets/{widgetType}/
```

Its deployed R2 home is:

```text
product/widgets/{widgetType}/
```

A Widget is autonomous product software built on Clickeen. It consists of:

- its own `widget.html`, which shows the complete Stage/Pod/Shell/Header/Core
  composition and the shared/Core sources it uses;
- a structured contract that declares state, editing, localization, and policy
  coordinates;
- an internal `discovery.json` declaration of what the Widget is, which exact
  customer-content parts matter to search and answer systems, and how they
  relate;
- exact system-entitlement bindings plus complete localized contextual upsell
  messages for the capabilities it consumes;
- Core HTML that makes its complete product structure visible;
- Core CSS that owns its unique presentation;
- mandatory Core JavaScript containing the Widget's focused behavior. It is
  never an initial-content renderer, materializer, localizer, preview host,
  validator, or serving engine.

The reusable Widget source is not one customer's saved instance. One saved
instance is one complete logical document containing the exact values for the
shared Header, Stage, Pod, Core-size, typography, appearance/chrome
capabilities and the exact values under that Widget's Core namespace. Bob edits
that whole document in browser memory. New composes it without persistence;
first Save creates editable source and later Save updates it. Only explicit
allowed Publish asks Roma's generic
materializer to combine the exact saved document with the shared and Core
software. Tokyo-worker stores the result; neither the Widget folder nor Bob owns
account persistence.

Stage, Pod, Header, Bob editing, Roma account operations, materialization,
Tokyo storage/serving, localization, assets, connectors, integrations, and
future capabilities are shared Clickeen services. A Widget uses only the
services it needs, but every Widget uses a given service through the same
structured contract and lifecycle.

```text
Widget Core -> shared Clickeen capability
```

Widget access and public capacity are separate. Every tier may use every
Widget, open New drafts, first-Save them as editable instances, and later Save
them. The system capability
`instances.published.max` applies only when the user explicitly Publishes; Free
may publish and serve one instance. A saved-instance quota must not be used as
a substitute for publication policy.

Never:

```text
shared Clickeen service -> Widget-specific semantic branch
```

If Bob, Roma's materialization path, or another shared service lacks a
capability a real Widget needs, augment that service generically so every
applicable Widget can declare and use it. Do not add a FAQ path, Cards branch,
Logo Showcase adapter, or other Widget-specific interpretation to a shared
service.

### Tier Limits And Upsell Composition

Commercial limits are shared account-tier policy. They are not Widget
semantics. The system owns entitlement keys and tier values, current-plan
truth, the exact eligible target plan, and the Upgrade CTA label/action. A
Widget declares only how one generic system capability applies to its unique
state and which complete localized contextual message describes that denied
action.

Canonical Widget source keeps those concerns separate:

```text
limits.json             -> capability key + Widget coordinate/metric + message identity
upsell/{locale}.json    -> complete Widget-owned message templates
core/                   -> no tier, plan, entitlement, Popup, or billing knowledge
```

`limits.json` does not choose enforcement contexts such as edit, load, Save,
publish, or serve. The shared system capability owns the user-intent boundary
where its decision is applied. The Widget binding describes consumption, not
commercial enforcement policy.

The Widget message may contain system-owned placeholders such as
`{currentPlan}` and `{targetPlan}`. It must be a complete translatable message,
not a sentence fragment. The Widget does not provide plan names, pricing, CTA
copy, CTA destinations, Popup mechanics, or billing behavior.

Until the commercial destination is defined, Upgrade remains a system-owned
scaffold action. It must not invent a URL, mutate a plan, call a provider, or
claim commercial success. Adding the real destination later changes the system
CTA authority once; it does not change every Widget message contract.

The Popup is one composed product surface, not one datum with several owners:

```text
system account-policy truth
+ exact Widget contextual message
+ system CTA
-> Roma composition and hosting
-> Dieter Popup mechanics
```

For an edit attempted inside Bob, Bob's one Widget-neutral editing boundary
uses the exact system policy already supplied for the account, leaves the
browser-memory draft unchanged when denied, and carries the exact denied
capability/message identity to Roma. Roma-owned account commands apply the
same policy at their own user-intent boundary. Roma opens one shared upsell
Popup. Save, materialization, and Tokyo-worker trust the already-authorized
state and do not repeat that entitlement decision.

No Widget Core, Widget-specific Bob/Roma branch, Widget-specific Popup,
hardcoded fallback reason, duplicate Save gate, or downstream Tokyo policy
check is allowed. Missing authored Widget message copy is corrected at the
source/build authority; product runtime does not replace it with generic text.

Local implementation: all five current Widgets have exact `limits.json`
message bindings and `upsell/en.json`; Bob applies one generic decision before
the attempted draft mutation; and Roma composes one Popup from the exact
`{ capability, messageId, required }` denial, current plan, first qualifying
higher plan, and system CTA. Save does not repeat the Widget edit decision.
There is no second Popup, fallback copy, or Widget-specific policy branch.

The public package is static-first. Only explicit allowed Publish resolves the
exact saved Widget instance into:

```text
index.html  -> complete base-locale semantic content and structure
styles.css  -> complete shared and Core presentation
runtime.js  -> mandatory Widget and shared visitor behavior
```

Initial public content and presentation are complete before `runtime.js` runs.
JavaScript does not create the first meaningful page, materialize, localize,
validate, or host the instance. Mandatory Core JavaScript owns genuine Widget
behavior. Bob preview is an editing concern and never dictates or expands the
public package. It uses deploy-built Widget software plus Bob's one current
browser-memory draft; it does not load an account instance's stored serving
files, and public `runtime.js` contains no Bob editor protocol.

Bob compiles widget definitions into editor controls. Roma saves account
instances. Tokyo-worker stores submitted source and serve-state artifacts. None of those systems
invents, guards, validates, filters, repairs, or reinterprets Widget-specific
semantics outside the Widget contract.

## Tenet 8: Bob Edits In Browser Memory

Bob is the Builder editor.

During editing, the working copy lives in browser memory. Bob can apply local
draft operations, preview updates, undo, and user edits. Persistence happens
when the user saves through Roma.

Workspace preview is an ephemeral expression of the same draft. The existing
isolated iframe may remain, but its input is Widget editing software plus draft
and preview context—not stored logical `indexHtml`, `stylesCss`, or `runtimeJs`
package members.
Published and never-published instances use the same preview path. A public
package is neither a prerequisite nor editable truth.

Product Copilot draft edits also land in Bob browser memory. Product Copilot
does not save, publish, or mutate Tokyo.

## Tenet 9: Storage Follows Ownership

Tokyo R2 roots encode ownership and deploy boundaries:

```text
accounts/
dieter/
fonts/
product/
prague/
```

Only `accounts/` is runtime-managed account storage. It owns account instances,
uploaded account assets, overlays, and generated account-scoped
browser files.

The non-account roots are git-authored deploy artifacts. `fonts/` owns the
global Clickeen fonts available to every account; account-uploaded custom fonts
remain account assets. Account operations must not mutate the deploy roots as
runtime state.

Root `widgets/`, `public/`, `published/`, and `l10n/` are not product storage
boundaries.

## Tenet 10: Translation Overlays Are Exact Files

Translation overlays are account instance content artifacts:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

The file body is an exact translated value map:

```json
{
  "values": {
    "[field path]": "[translated value]"
  }
}
```

The account, instance, and locale coordinates come from the operation/path.
They are not lifecycle metadata inside the file.

Available locales come from the account tier. Active locales are the locales
the user selected for the account. Translation Agent writes overlays for active
non-base locales. Tokyo stores and serves exact files. Tokyo does not infer
meaning.

## Tenet 11: Content Source Authority Is Preserved

Content has three source authorities:

| Source | Agent behavior |
| --- | --- |
| Human-generated | Agents may recommend, propose, translate, optimize, restructure, and apply user-approved changes. |
| AI-generated | Agents may operate autonomously inside approved product rules. |
| Integration-sourced | Agents may use, summarize, extract, route, display, analyze, and derive from it; source truth changes require an explicit authorized integration write path. |

The rule is source-truth fidelity. Agents can operate the system around content,
but they must not rewrite source truth they do not own.

## Tenet 12: Public Widget Runtime Serves Complete Materialized Artifacts

Public widget runtime serves generated files from Tokyo/R2 through the public
serving host:

```text
https://dev.clk.live/{accountPublicId}/{instanceId}
https://clk.live/{accountPublicId}/{instanceId}
```

Visitor requests must not:

- call models;
- read Supabase;
- compose widgets from authoring source;
- regenerate overlays;
- repair missing artifacts;
- switch to another locale/account/instance.

The logical `indexHtml` member stored in the published serve-state is the
complete semantic expression of the base-locale content, not an empty
application shell. Its `stylesCss` member is the complete presentation. Its
`runtimeJs` member contains the Widget and shared visitor behavior; initial
content, localization, hosting, and serving do not depend on it. Tokyo-worker
exposes these at the public `index.html`, `styles.css`, and `runtime.js` paths.

The generation authority is exact:

```text
deploy-built shared Widget software + deploy-built Core software
+ exact saved account-instance state + explicit allowed Publish
-> Roma invokes @clickeen/ck-runtime-materializer
-> complete index.html + styles.css + runtime.js
-> Tokyo-worker stores one atomic published serve-state.json containing the
   exact logical package members
-> Tokyo-worker serves the stored package
```

Roma's materializer is the sole service that generates the served package
contents. Tokyo-worker never authors, compiles, renders, repairs, or regenerates
Widget code. Those three public paths are logical members of one stored R2
artifact, not three objects, and publication has no package/status split
commit. Materialization happens only on explicit allowed Publish and not
on New, Save, Duplicate, or a visitor request. This is the
publish-once/serve-many law that keeps the public
path static, cacheable, and independent of Bob, Roma, source discovery,
databases, models, and agents.

For a non-base `?locale=` request, Tokyo applies the trusted exact stored
overlay to the declared semantic content slots before returning the response.
The response therefore contains complete selected-locale semantic HTML before
client JavaScript runs. Clickeen does not store a second locale-derived Widget
package, and JavaScript does not perform localization. This is the Edge law:
materialize the base package once per explicit allowed Publish, then serve that
exact base package or its exact requested-locale expression many times.
Explicit Save remains Bob's editable-source persistence boundary; Publish is
the separate release boundary.

This compile-once/serve-many boundary is the technical foundation for static
Edge scale and for semantic SEO, GEO, AEO, and localized responses. It makes
complete content available to browsers, crawlers, and answer systems before
JavaScript; it does not itself guarantee ranking or citation.

If the requested public artifact is not available, the boundary returns an
explicit failure such as 404.

## Tenet 13: Dieter Tokens And Consumer-Agnostic Primitives First

Widget configs use Dieter tokens by default for styling. User overrides are
allowed through explicit controls when the widget contract permits them.

Example token-shaped value:

```json
{
  "appearance": {
    "headingColor": "var(--color-text)",
    "buttonBackground": "var(--color-primary)"
  }
}
```

Example explicit user override:

```json
{
  "appearance": {
    "headingColor": "#FF5500"
  }
}
```

Dieter components are primitives. They own reusable structure, presentation,
and component-generic interaction only. They must not contain branches,
defaults, capability filtering, policy, state paths, copy, or behavior for a
particular Widget, account, Bob domain, Roma domain, or other consumer.
Consumer-specific composition and product behavior remain with the authority
that owns that consumer.

Components support localization through one boundary: callers supply exact
resolved human-language strings. A component does not load a locale, choose a
translation, keep a copy catalog, or define a consumer-specific localization
shape. In the ToolDrawer, Widget specs declare `$label:{key}` and the adjacent
Widget label file owns the words; Bob compiles the resolved strings into the
Widget editor artifact. Application Chrome resolves its own copy before
composing the same Dieter primitive.

For a composed upsell, Dieter Popup receives the exact already-resolved title,
body, labels, actions, and dismissal behavior. Dieter never looks up an account
plan, selects a Widget message, chooses a target tier, decides entitlement, or
owns the Upgrade destination. Those values remain with system policy, the
Widget message contract, and Roma composition respectively.

Shared component presentation belongs in an existing Dieter primitive or
shared Dieter source. A consumer-specific exception remains consumer
composition; it does not become a new Dieter variant, branch, or special case.

## Tenet 14: Documentation Is Operator Truth

`documentation/` is the current service manual and developer knowledgebase. It
records canonical product law and current implementation truth; it is not a
place for execution history or disguised compatibility doctrine.

- Current architecture docs describe canonical system law and name every
  unexecuted implementation mismatch explicitly.
- Service docs describe operator behavior, contracts, bindings, dependencies,
  routes, storage, and verification.
- Planning and active execution scope live in the appropriate
  `Execution_Pipeline_Docs/` stage.
- Historical execution records live in `Execution_Pipeline_Docs/03-Executed/`.

Runtime code, migrations, stored data, and deployed configuration prove what is
implemented now. They do not silently redefine canonical product law. When
implementation and law differ, the manual states the exact mismatch and the
owning execution plan closes it.

## Core Violations

These are the named violations agents audit after product-path,
cross-system, managed-service, deploy, remote-data, or architecture changes.
Run V1-V8 before final response for those changes and report the result.

| ID | Violation | Audit question |
| --- | --- | --- |
| V1 | Silent substitution | Did the change replace missing, invalid, stale, or malformed truth with an invented value? |
| V2 | Silent healing | Did the change normalize, coerce, repair, or rewrite invalid persisted/user state without failure? |
| V3 | Silent omission | Did the change drop a required input, artifact, operation, edit, module, event, or policy? |
| V4 | Fail-open control | Did enforcement turn off when a dependency was missing, malformed, or unavailable? |
| V5 | Corruption-as-absence | Did corrupt stored state become treated as missing, new, empty, ignored, or overwritten? |
| V6 | Partial-success masquerade | Did the product claim full success after some requested work was dropped, rejected, or filtered? |
| V7 | Masquerade/redress | Did the same failing workflow continue under a different wrapper, name, path, retry, or log? |
| V8 | Runtime test dependency | Did normal product work start depending on tests, probes, helper checks, or validation rituals? |

These are implementation and reconciliation audit questions. They do not
authorize runtime guards, validators, probes, equality checks, or repair paths.
Correct the producing authority; downstream Clickeen consumers continue to
trust its exact output.

## Review Questions

Before approving a change, ask:

1. Does this improve agent-operability, or does it add legacy machinery?
2. Which named authority owns the operation?
3. Is any unavailable truth silently substituted?
4. Is invalid state silently healed?
5. Is product work being claimed complete when part of it failed or was
   skipped?
6. Does storage follow the owning account/product root?
7. Can a smart agent understand and operate the artifact without hidden
   conventions?

If the answer exposes drift, fix the design before adding code.
