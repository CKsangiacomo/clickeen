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
- **Everything is visible to every tier; access is controlled by tier.** Product
  domains, capabilities, and tier-gated actions remain visible and actionable.
  When the current tier does not allow the attempted action, product state stays
  unchanged and Clickeen opens its standard Upgrade dialog. This does not expose
  another account's data or override user-role authorization. The contextual
  **Save as template** utility is the named conditional-visibility exception in
  Tenet 14.
- Tier controls creation and product use. Account ownership and account
  lifecycle control storage retention. A downgrade does not hide or
  automatically delete account Instances, Pages, templates, or generated files.
- System-initiated deletion of the complete account root happens only as part of
  the one account-deletion operation. The one downgrade exception is account
  assets over the new `storage.bytes.max`: they receive a 30-day grace period,
  after which account management deletes the most recently uploaded assets until
  usage fits the current allowance.

The automatic asset-overage cleanup above is accepted product law, not a claim
that the current runtime already performs it.
The following three bullets are current Web Code Generator law for generated
public files:

- Complete semantic public HTML is the baseline for every tier. For Widget
  Instances, a paid SEO/GEO/AEO entitlement plus the saved Instance choice may
  add customer optimization output. The Page generation API has no Page SEO
  toggle and always emits its declared semantic output. Neither rule decides
  whether customer content exists in initial HTML.
- `branding.remove` and `embed.seoGeo.enabled` are different product policies.
  Branding controls visible Clickeen attribution. The SEO entitlement controls
  the saved Widget Instance enhancement choice; it is not a Page switch.
- Free Widget distribution is truthful product attribution, not hidden growth
  code: one visible contextual link to the global Clickeen product and matching
  Clickeen application identity are generated into initial HTML. Clickeen is
  never represented as the author or owner of customer content.

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
- `editable-fields.json` when the widget has editable/translatable text;
- `limits.json` when the widget maps controls/paths to policy keys.
- `index.html` for the generated initial document template;
- `styles.css` for widget and shared presentation;
- `runtime.js` for behavior attached to generated markup.

Bob compiles widget definitions into editor controls and Web Code Generator
uses the structured config, content, overlays, and those exact source files to
generate browser files in memory. Roma hosts the save command. Tokyo-worker
stores submitted runtime files. None of those systems should invent
widget-specific semantics outside the widget contract.

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
product/
prague/
```

Only `accounts/` is runtime-managed account storage. It owns account instances,
uploaded account assets, overlays, account pages, and generated account-scoped
browser files.

The non-account roots are git-authored deploy artifacts. Account operations must
not mutate them as runtime state.

Tier and storage answer different questions:

```text
tier policy -> what the account may create or use now
account lifecycle -> how long account-owned truth is retained
Tokyo-worker -> exact byte operation under the account root
```

Changing tier does not move, rename, rewrite, or automatically delete account
Instances, Pages, templates, overlays, or generated files. User-authorized
deletion remains an explicit product operation. Whole-account deletion is the
only operation that purges the entire account root.

Asset quota cleanup is the sole automatic downgrade-deletion exception. When a downgrade makes
account asset usage exceed `storage.bytes.max`, account management gives the
customer 30 days to delete assets or upgrade. After the deadline, it directs
Tokyo-worker to delete the newest assets by `updatedAt` until stored asset bytes
fit the current allowance. Equal timestamps use the stable asset reference as
the deterministic tie-breaker. Missing or corrupt ordering/size truth stops the
cleanup; the system never guesses which asset to delete.

The current runtime does not yet have the authoritative tier-change timing and
account-lifecycle operation required to execute this law.

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

Page source is current account-owned product data. On explicit Save or Update,
Page Builder uses Web Code Generator in the browser and sends the exact current
Page source, `index.html`, `styles.css`, `runtime.js`, and `overlays.json`
through Roma to Tokyo. Publish changes only `serve-state.json`. Tokyo serves
the stored files at the Page's stable and exact-locale `clk.live` routes.
Visitor requests never invoke generation, translation, models, Roma, Page
Builder, or child Widget URLs, and never compose a Page from authoring source.
Referenced Instance Save or translation writes set the Page's one
`needsUpdate` flag; they do not regenerate it. Ordinary Page Save and Publish
then block until the customer explicitly runs Update through the same Page
write boundary. A published Page keeps serving its last saved files meanwhile.

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

## Tenet 14: Tier-Gated Actions Stay Visible

Clickeen exposes the product rather than hiding paid capabilities from lower
tiers.

This tenet is the normative product rule for new or changed surfaces. It does
not claim that every pre-existing runtime surface already conforms; owning
service and capability documents remain current-runtime truth until the
behavior is deployed and verified.

- A tier-gated action remains visible and clickable.
- A tier-gated boolean control renders its real current value. If that value is
  off and the user is not entitled, attempting to turn it on leaves it off and
  opens the standard Upgrade dialog.
- A tier-gated command such as Create, Duplicate, or Publish
  remains available as an expression of user intent. If its limit or flag gate
  fails, no product mutation occurs and the standard Upgrade dialog opens.
- The UI may use the current entitlement snapshot to respond immediately, but
  Roma rechecks the entitlement at the owning command or Save route before any
  write. UI state is never the enforcement authority.
- Every surface uses the existing entitlement failure and Upsell interaction;
  features must not add private lock states, disabled-control variants, hidden
  catalog entries, or feature-specific upgrade dialogs.

This law applies to authenticated product actions that an account user cannot
complete because of account tier or plan. The owning route returns the standard
entitlement failure and the product surface opens the Upgrade dialog.

**Save as template** is the named exception. It is a contextual editing utility,
not a monetized capability: show it only for an editable ordinary Widget
Instance or Page when the account can create another object of that type. It
appears in the object's list-row three-dot menu and as a persistent secondary
action in Bob or Page Builder. Otherwise it is absent. The owning command still
performs the normal role and saved-object-limit validation; it adds no separate
entitlement or Upsell path.

Public visitor requests and background work are not account-user actions. Role
authorization, invalid state, missing source truth, and unsafe or impossible
operations are not upsells; their owning authorization, validation, and
failure rules still apply.

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
