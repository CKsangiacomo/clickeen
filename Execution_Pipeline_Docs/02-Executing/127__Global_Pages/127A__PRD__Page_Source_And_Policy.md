# 127A — Page Source and Policy

Status: **EXECUTED — GREEN**

Parent: `127__PRD__Global_Pages_Program.md`

## 1. Goal

127A establishes the structured Page source used by the rest of PRD 127 and
adds Page access through Clickeen's existing tier and policy systems.

This slice:

- defines one shared Page source type;
- defines Page-owned locale overlays as locale-specific values only;
- lets the existing Generate translations operation translate Page-owned text;
- adds `pages.max`;
- adds internal Tier99;
- deletes the obsolete pre-GA Page implementation instead of preserving it.

127A does not build Page Builder, generate HTML/CSS/JavaScript, publish, or
serve Pages.

## 2. Product behavior this source supports

Later slices use the 127A source to provide:

- an unsaved Page draft that exists only in the browser;
- a saved Page containing ordered references to saved same-account Instances;
- Page title, sharing metadata, robots choice, and `baseLocale`;
- Page metadata translations generated for the locales selected in account
  Settings;
- Page templates with no locale or translation state;
- Page access from Tier 2 upward;
- the internal Clickeen account operating on Tier99.

The source does not attempt to model builds, generated-file history, package
versions, revisions, freshness evidence, or failure recovery.

## 3. Existing authorities

The authority chain remains:

```text
Berlin bootstrap
→ Roma current account/member/policy
→ Roma account Page operation
→ Tokyo account Page storage
→ accounts/{accountPublicId}/pages/{pageId}/
```

Policy remains:

```text
@clickeen/ck-policy registry and matrices
→ Berlin/Roma resolved policy
→ Roma route enforcement
```

Supabase owns account facts such as tier, `baseLocale`, selected Settings
locales, and membership. Tokyo owns saved Page source, overlays, and generated
files. No new authority is introduced.

## 4. Shared Page source

Create the saved Page source type in a named `@clickeen/ck-contracts` Page module and
import it wherever later slices need the type. Do not add Page implementation
code to the package barrel and do not maintain duplicate Roma/Tokyo Page
interfaces.

`AccountPageSource` is the saved Page contract. Page Builder owns a separate
unsaved browser draft shape without `pageId`. On first Save, Page Builder sends
that ID-less draft to Roma. Roma enforces `pages.max`, mints `pageId`, reads the
account `baseLocale`, constructs the complete saved contract, and writes it
through Tokyo-worker. This type distinction creates no draft service or remote
draft record.

The contract is:

```ts
type PageRobots = 'index-follow' | 'noindex-follow';

type PageValues = {
  title: string;
  description?: string;
  socialTitle?: string;
  socialDescription?: string;
  socialImageAssetRef?: string;
};

type PagePlacement = {
  placementId: string;
  instanceId: string;
};

type AccountPage = {
  pageId: string;
  displayName: string;
  isTemplate: false;
  baseLocale: string;
  values: PageValues;
  robots: PageRobots;
  placements: PagePlacement[];
};

type AccountPageTemplate = {
  pageId: string;
  displayName: string;
  isTemplate: true;
  values: PageValues;
  robots: PageRobots;
  placements: PagePlacement[];
  baseLocale?: never;
};

type AccountPageSource = AccountPage | AccountPageTemplate;

type PageLocaleOverlay = {
  values: Partial<
    Pick<PageValues, 'description' | 'socialTitle' | 'socialDescription'>
  > & {
    title: string;
  };
};
```

The exact field names may follow established repository casing, but the shape
and ownership above are fixed.

127F later extends only `CLICKEEN` Page-template config with the required
`catalogPresentation` values owned by DevStudio. That later Catalog-only field
has a named DevStudio control and does not change the 127A ordinary Page or
customer-template source shape.

`PageLocaleOverlay.values.title` is required because every ordinary Page has a
title. The other translated keys are present only when their corresponding
source fields exist. `Partial` never means that Generate translations may
silently omit a requested, translatable source field.

Notably absent:

- no Page-owned selected-locale list;
- no `revision` or `savedRevision`;
- no build, fingerprint, or generated-from field;
- no Page SEO entitlement flag;
- no copied Instance source;
- no public Widget URLs.

## 5. Field meanings

| Field | Product meaning |
| --- | --- |
| `pageId` | Compact saved Page identity. An unsaved browser draft has none until first Save. |
| `displayName` | Internal name shown in Roma and Page Builder. It is not automatically public copy. |
| `isTemplate` | Distinguishes an ordinary Page from a reusable Page template. |
| `baseLocale` | Source language of an ordinary saved Page. It comes from the account `baseLocale`. |
| `values.title` | Required public document title. It is not inferred from the internal Page name or Widget content. |
| `values.description` | Optional public description. |
| `values.socialTitle` | Optional social-preview override. When absent, public output uses the effective locale Page title without copying that fallback into source. |
| `values.socialDescription` | Optional social-preview override. When absent, public output uses the effective locale Page description when one exists, without copying that fallback into source. |
| `values.socialImageAssetRef` | Optional same-account social-preview asset. |
| `robots` | Page-wide search visibility: `index-follow` or `noindex-follow`. It defaults to `index-follow` and is not translated. |
| `placements` | Ordered saved same-account Instance references. |

Do not add persisted Page fields without a named Page Builder control or a
required public-serving behavior.

The social fallbacks above are output behavior, not additional saved values.
Changing a Page title or description therefore changes its effective social
metadata when no custom override exists; there is no duplicated value to become
stale. Page source does not contain generated metadata, inferred Widget copy,
or a third `noindex-nofollow` product choice.

## 6. Ordinary Pages and templates

An ordinary Page:

- receives `baseLocale` from the current account on first Save;
- refreshes that saved `baseLocale` from the current account on every later
  explicit Save or Update;
- contains ordered same-account saved Instance references;
- may be translated through Generate translations;
- may later be published.

A Page template:

- is a reusable snapshot;
- keeps the complete reusable Page source/config, including Page values,
  robots choice, placements, and direct asset references;
- has `baseLocale`, selected locale, overlay/translation, and public-serving
  values cleared from the copied template config;
- cannot publish.

Template creation and Catalog behavior belong to 127F. 127A only makes the
source distinction unambiguous.

The first Clickeen Page Catalog template is blank and has no placements.
Account-owned Page templates may keep same-account Instance references. Rich
Catalog Page templates that would require copying Clickeen-owned child
Instances into another account are outside PRD 127. The explicit handling of
direct Page-owned asset references belongs to 127F.

## 7. Placement rules

The source keeps placements deliberately small:

```text
placementId + saved same-account instanceId
```

- placement order is Page order;
- the referenced Instance must be a saved ordinary Instance owned by the same
  account;
- Page source never embeds copied Instance config, content, overlays, HTML,
  CSS, or JavaScript;
- Page source never stores a child public `clk.live` URL;
- the first release uses one placement per Instance ID;
- a blank Page may be saved, but Publish requires at least one placement.

These placement rules apply to ordinary Pages and account-owned Page
templates. The first Clickeen Catalog Page template has no placements.

These are ordinary Page input rules, not a new validator framework.

## 8. Page overlays and Generate translations

`baseLocale` remains the Page source-language authority. The locales to
generate come from the current account Settings—the same source used by the
existing Instance translation experience.

The workflow is:

```text
customer saves an ordinary Page
→ customer selects locales in account Settings
→ customer clicks Generate translations in Page Builder
→ existing Translation Agent translates Page-owned text
→ translated Page values are stored as locale overlays
→ later Save or Update uses the currently saved overlays
```

Generate translations is unavailable until the ordinary Page has been saved,
because an unsaved draft has no `pageId` or Tokyo overlay root. It never runs
for a Page template.

The Translation Agent may translate:

- `values.title`;
- `values.description`;
- `values.socialTitle`;
- `values.socialDescription`.

It does not translate `displayName`, `robots`, CSS, JavaScript, IDs, or
Instance source. Referenced Instances continue using their own existing
translation overlays.

Page-owned locale values use:

```text
accounts/{accountPublicId}/pages/{pageId}/overlays/locales/{locale}.json
```

Each overlay contains only Page values for that locale. It does not contain
the account locale list, `baseLocale`, status, tier, policy, revision,
fingerprint, or generation evidence.

Extend the existing Generate translations operation with a Page coordinate so
it can read the approved Page fields and write the corresponding Page overlay.
Reuse its existing request/grant path, Roma/Tokyo coordinate, Translation
Agent, provider, permission, activity, and per-locale result behavior. Do not
add a Page Translation Agent, metadata translation service, translation
transaction, or persisted translation-job lifecycle.

The direct coordinate cutover must extend these Instance-specific layers:

- Roma's current `/api/account/instances/{instanceId}/translations/generate`
  request and grant creation;
- the Translation Agent `/translate-instance` input/handling;
- Tokyo's current `/__internal/instances/{instanceId}/translations/{locale}`
  write boundary;
- Roma's result mapping and customer activity/result presentation.

They become Widget-or-Page coordinates within the same operation and owners.
Do not keep the old Instance-only shapes beside a duplicate Page path.

Each requested locale receives the existing terminal success or error result.
If one locale fails, that failure remains visible and the customer may retry;
the operation must not claim that every locale succeeded. No special Page
failure state or persisted partial-result lifecycle is created.

## 9. Settings changes do not mutate Pages

Changing `baseLocale`, selected locales, or country/market Settings does not:

- edit saved Page source;
- delete Page overlays;
- change generated files;
- change published output;
- purge a URL;
- invoke Translation Agent;
- invoke Web Code Generator.

The new Settings apply only when the customer next performs the relevant
explicit operation, such as Generate translations, Save, or Update.

On the next Page Save or Update, Roma reads the account's current `baseLocale`
and constructs or refreshes the saved Page source before writing it through
Tokyo-worker. The Settings change alone still performs no Page write.

127A therefore does not extend account-locale cleanup into Page roots and does
not add locale-removal orchestration for Pages.

## 10. Page SEO policy

Ordinary Pages always receive Page SEO/GEO/AEO output in 127B.

Pages begin at Tier 2, where this Page capability is included. Therefore Page
source has:

- no SEO/GEO/AEO toggle;
- no `seoGeoAeoEnabled` field;
- no separate Page SEO entitlement check.

127B adds the Widget Instance SEO/GEO/AEO toggle and persists its approved
choice. It reuses the existing entitlement and Upgrade interaction. That work
is separate from Page source.

## 11. `pages.max`

Add `pages.max` through the existing entitlement registry, metadata, policy
matrices, and tests:

| Tier | Value |
| --- | ---: |
| `free` | `0` |
| `tier1` | `0` |
| `tier2` | `3` |
| `tier3` | `10` |
| `tier4` | `null` |
| `tier99` | `null` |

`null` means unlimited through the existing limit system.

Page first-Save enforcement must call the shared limit evaluator that already
understands `null` as unlimited. Do not copy an Instance helper that accepts
only finite numeric limits.

The limit counts saved ordinary Pages and saved Page templates. Roma applies
the existing creation-limit behavior on first Save. Existing Pages remain
visible after downgrade, unavailable actions use the existing Upgrade flow,
and tier changes never delete Page storage.

Do not add a Page counter service, reservation system, or client-side policy
authority.

## 12. Tier99

Tier99 is one additional, non-sellable account tier used by the internal
`CLICKEEN` account for Admin/Ops.

Implement it through the same places that already define and consume the other
tiers:

- shared tier type;
- entitlement metadata, policy matrices, required-tier lists, and shared limit
  evaluation;
- Berlin/Roma bootstrap readers;
- Roma tier labels and account-management surfaces;
- Supabase `account_tier` enum;
- San Francisco grant validation and AI policy matrices;
- tests and current documentation for every affected consumer.

Then set the exact internal `CLICKEEN` account to Tier99 through the normal
account-data operation.

Tier99 is not a member role, cross-account permission, bypass, alternate API,
or new Admin architecture.

## 13. Delete the obsolete Page implementation

127 is a pre-GA replacement. 127A removes the current Page implementation that
depends on the discarded model instead of teaching it the new source shape.

Delete or disconnect, together with their dependent imports/tests/docs:

- `roma/components/pages-domain.tsx`;
- `roma/lib/account-page-direct.ts`;
- `roma/lib/account-page-source.ts`;
- current `roma/app/api/account/pages/**` routes;
- current `roma/app/(authed)/pages/page.tsx` until 127E installs the new
  surface;
- current public-serving/package implementation under
  `tokyo-worker/src/domains/pages/**`; retain or replace only the small 127A
  source/overlay storage operations needed by the new contract, while 127C
  installs the new public-serving owner;
- obsolete duplicate Page types elsewhere in Roma or Tokyo.

Do not add compatibility readers, placeholder adapters, migration code, or a
screen that understands both Page models. The repository must still build
cleanly after the obsolete imports and routes are removed.

## 14. Execution checklist

### Code

- [x] Add the shared `AccountPageSource`, placement, values, and locale-overlay
      types in one named `@clickeen/ck-contracts` Page module.
- [x] Remove duplicate local Page source shapes.
- [x] Add Page-owned fields to the existing Generate translations operation.
- [x] Introduce the Page overlay root using the existing Instance locale-
      overlay convention and write Page-owned translated values there.
- [x] Keep account Settings as the only selected-locale authority.
- [x] Add `pages.max` through the existing entitlement system.
- [x] Add Tier99 through the existing tier system.
- [x] Delete the obsolete pre-GA Page implementation listed above.
- [x] Add no Page UI, Web Code Generator, public serving, locale cleanup,
      revisions, shared validator framework, or background machinery.

### Product data

- [x] Inventory disposable cloud-dev Page data before removal.
- [x] Remove obsolete Page data only through the approved Roma/Tokyo or
      Cloudflare product-data path.
- [x] Keep code changes and product-data removal separately evidenced.
- [x] Set only the exact internal `CLICKEEN` account to Tier99.

### Deployment and verification

- [x] Run focused contract, policy, Roma, Tokyo, Berlin, and Supabase checks.
- [x] Run repository lint/typecheck/build proportional to the changed graph.
- [x] Deploy the reviewed Supabase tier migration through its workflow.
- [x] Deploy the owning Roma/Tokyo changes through documented paths.
- [x] Verify `pages.max` returns `0/0/3/10/null/null`.
- [x] Verify Tier99 resolves through the ordinary tier system.
- [x] Verify the obsolete Page UI/routes/storage implementation is gone.
- [x] Run an independent V1–V8 audit.

### 2026-08-05 execution evidence

- Source implementation and the complete 127 planning/documentation set were
  pushed to `main` in `bdd5d791`.
- The unapplied Google-only login-provider migration was removed in `5db27d4c`
  after the product owner confirmed that ordinary `email` login remains part of
  the pre-GA identity contract. No user row was deleted or rewritten.
- GitHub Actions `cloud-dev workers deploy` run `31060499451` deployed Berlin,
  San Francisco, Tokyo-worker, Product Copilot, and Translation Agent
  successfully. Roma verification run `31060499430` and both resulting
  cloud-dev reachability runs succeeded.
- Cloudflare Pages project `roma-dev` reported commit `bdd5d791` at deployment
  stage `success`; the Pages REST preflight and project read used the documented
  repo command path.
- Supabase workflow run `31061092185` linked the cloud-dev project and applied
  the two Tier99 migrations successfully with no migration-history repair.
- Michael read-back returned `CLICKEEN.tier = tier99` while preserving two
  existing `email` identities and one `google` identity. Roma `/api/bootstrap`
  returned account `CLICKEEN`, role `admin`, tier `tier99`, and
  `pages.max = null` through the ordinary bootstrap/policy path.
- Deployed Page first Save, exact read, Save, list, and Delete all succeeded
  through Roma/Tokyo-worker. The temporary verification Page was absent after
  Delete, and `accounts/CLICKEEN/pages/` was empty in the documented R2
  read-back.
- Deployed Page Generate translations returned one terminal result for all 28
  selected locales: 27 successful overlays and one explicit `fil`
  `tokyo.errors.page.overlayInvalid` failure. The operation did not report full
  success, and the temporary Page was deleted afterward.
- The initial independent review kept 127A open because the Page boundary
  accepted only two-letter primary locale codes, Page translation used the
  current account `baseLocale` instead of the saved Page `baseLocale`, and four
  current documentation statements were inaccurate. Commit `f44d3b88`
  corrected those findings without adding a service, route, job, validator, or
  Page-specific translation path.
- GitHub Actions `cloud-dev workers deploy` run `31062369845` deployed the
  corrected Tokyo-worker successfully. Roma verification run `31062369839`
  succeeded, and Cloudflare Pages project `roma-dev` reported commit
  `f44d3b88` at deployment stage `success`.
- The deployed Page Generate translations proof then returned 28 successful
  terminal results for all 28 selected locales, including `fil`, with zero
  failures. Its temporary Page returned `404` after Delete, and the documented
  R2 read-back showed `accounts/CLICKEEN/pages/` empty.
- The final Staff Engineer, Senior PM, and Principal TPM reviews all returned
  `GREEN` at commit `89dadb55`. Each independently confirmed that 127A stayed
  within its source/policy scope, introduced no duplicate subsystem or future
  Page machinery, matched current documentation, and passed V1 through V8.

## 15. Failure behavior

- The authenticated Roma Page route parses submitted Page JSON before passing
  it to Tokyo, and the Tokyo account Page operation parses stored Page JSON
  when it reads it. Both import the one 127A contract and keep their ordinary
  boundary parsing local; neither casts unknown JSON directly to the type or
  introduces a shared validator framework.
- Invalid Page input is rejected through the existing route behavior.
- Missing or cross-account Instance references prevent the Page operation.
- Generate translations failure uses the existing error and retry interaction.
- Invalid tier/policy input follows the existing fail-closed policy behavior.
- Corrupt stored source is reported as corrupt; it is not replaced with an
  empty Page.
- No operation reports success when it failed.

No new Page-specific failure lifecycle is introduced.

## 16. Documentation after deployment

After 127A is deployed, update current truth in the affected documentation:

- `documentation/architecture/CONTEXT.md`;
- `documentation/architecture/Overview.md`;
- `documentation/architecture/AccountManagement.md`;
- `documentation/architecture/OverlayArchitecture.md`;
- `documentation/capabilities/localization.md`;
- `documentation/capabilities/multitenancy.md`;
- `documentation/services/roma.md`;
- `documentation/services/tokyo-worker.md`;
- `documentation/services/berlin.md`;
- `documentation/services/michael.md`, `documentation/ai/sanfrancisco.md`,
  `documentation/ai/agents/translation-agent.md`,
  `documentation/ai/agents/README.md`, and `documentation/ai/README.md`;
- `documentation/engineering/SupabaseOperations.md` and the owning policy
  documentation;
- `documentation/architecture/BabelProtocol.md`,
  `documentation/strategy/Clickeen-Babel.md`, and
  `documentation/engineering/PlaywrightE2E.md` when their deployed paths
  change.

Do not document Page Builder, generation, or public serving as current in this
slice.

## 17. Definition of done

127A is done when the shared Page source, Page overlay meaning, Generate
translations extension, `pages.max`, and Tier99 are implemented through their
existing authorities; the obsolete pre-GA Page implementation is removed;
current documentation matches the deployed system; and V1–V8 are independently
GREEN.
