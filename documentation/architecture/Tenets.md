# Clickeen Architecture Tenets

STATUS: CURRENT SYSTEM OPERATOR SPEC

These tenets are the rules agents and developers use when changing Clickeen.
They protect the agent-operated architecture described in
`documentation/architecture/CONTEXT.md`.

## Core Premise

Clickeen is an agent-operated product.

The system is deliberately lean and structured so agents can operate it
directly. Agents are the operators; the codebase and stored artifacts are the
structured substrate. A change either improves agent-operability or adds legacy
weight.

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
- Users create widget instances in Roma/Bob and save them in their account.
- Pages are account-owned stacks of saved instances.
- Bob edits in browser memory; user save is the persistence boundary.
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
- account instance config/content files;
- locale overlay value maps;
- page source files;
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

## Tenet 3: No Fallbacks, No Silent Substitution

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
- page source and package files.

If requested truth is unavailable, the system returns an explicit error or
serves nothing at that boundary. It does not substitute another account,
another locale, another model, another provider, another storage path, or stale
compatibility shape.

Deterministic defaults are allowed only when they are the explicit contract of
that request parameter and do not change identity or claim unavailable work
completed.

## Tenet 4: No Silent Healing

Invalid persisted or user state must not be normalized, repaired, rewritten, or
coerced without an explicit product operation.

The system may validate and reject. It may apply an explicit user/agent action
through the owning authority. It must not “helpfully” mutate stored truth while
pretending the original operation succeeded.

## Tenet 5: Product Commands Stay Boring

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

## Tenet 6: Widget Software Is Product Truth

Widget software is authored in git and deployed to Tokyo R2:

```text
tokyo/product/widgets/{widgetType}/
```

Its deployed R2 home is:

```text
product/widgets/{widgetType}/
```

A widget's files define its behavior:

- `spec.json`;
- `widget.html`;
- `widget.css`;
- `widget.client.js`;
- `editable-fields.json` when the widget has editable/translatable text;
- `limits.json` when the widget maps controls/paths to policy keys.

Bob compiles widget definitions into editor controls. Roma saves account
instances. Tokyo-worker stores submitted runtime files. None of those systems
should invent widget-specific semantics outside the widget contract.

## Tenet 7: Bob Edits In Browser Memory

Bob is the Builder editor.

During editing, the working copy lives in browser memory. Bob can apply local
draft operations, preview updates, undo, and user edits. Persistence happens
when the user saves through Roma.

Product Copilot draft edits also land in Bob browser memory. Product Copilot
does not save, publish, or mutate Tokyo.

## Tenet 8: Storage Follows Ownership

Tokyo R2 roots encode ownership and deploy boundaries:

```text
accounts/
dieter/
fonts/
product/
prague/
```

Only `accounts/` is runtime-managed account storage. It owns account instances,
uploaded account assets, overlays, account pages, and generated account-scoped
browser files.

The non-account roots are git-authored deploy artifacts. Account operations must
not mutate them as runtime state.

Root `widgets/`, `public/`, `published/`, and `l10n/` are not product storage
boundaries.

## Tenet 9: Translation Overlays Are Exact Files

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

## Tenet 10: Content Source Authority Is Preserved

Content has three source authorities:

| Source | Agent behavior |
| --- | --- |
| Human-generated | Agents may recommend, propose, translate, optimize, restructure, and apply user-approved changes. |
| AI-generated | Agents may operate autonomously inside approved product rules. |
| Integration-sourced | Agents may use, summarize, extract, route, display, analyze, and derive from it; source truth changes require an explicit authorized integration write path. |

The rule is source-truth fidelity. Agents can operate the system around content,
but they must not rewrite source truth they do not own.

## Tenet 11: Public Widget Runtime Serves Stored Artifacts

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

If the requested public artifact is not available, the boundary returns an
explicit failure such as 404.

Page source is current account-owned product data. Page publish and page public
serving are currently unavailable until Roma writes page packages. Tokyo-worker
must not compose pages from source on visitor requests.

## Tenet 12: Dieter Tokens First

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

## Tenet 13: Documentation Is Operator Truth

`documentation/` is a current service manual and developer knowledgebase. It is
not a place for planning, legacy support, or execution history.

- Current architecture docs describe current system truth.
- Service docs describe operator behavior, contracts, bindings, dependencies,
  routes, storage, and verification.
- Planning and future scope live in `Execution_Pipeline_Docs/01-Planning/`.
- Historical execution records live in `Execution_Pipeline_Docs/03-Executed/`.

If runtime and docs disagree, runtime code/migrations/deployed configuration win
and the stale doc must be fixed.

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
