# 127F — CODEX Execution-Readiness Peer Review

Status: **NOT READY — MODEL APPROVED; EXECUTION CONTRACTS NEED TO BE MADE EXACT**

Subject: `127F__PRD__Template_Snapshots_And_Catalogs.md`

Date: 2026-08-05

This review consolidates three independent lenses: Staff Engineer, Senior PM,
and Principal TPM. Each reviewer checked 127F against the 127 Mama PRD,
accepted 127A–127E contracts, current product laws and documentation, and the
actual Roma, Bob, DevStudio, Tokyo, Widget, Page, asset, and policy code.

This is an execution-readiness review. It does not redesign templates or
Catalogs and it does not authorize execution.

## What 127F really does

127F adds one saved-object distinction: `isTemplate`.

- A Widget template is still a Widget Instance.
- A Page template is still a Page.
- **My templates** shows templates in the current account.
- **Widget catalog** and **Page catalog** show the templates in the exact
  `CLICKEEN` account.
- Catalog is read-only. There is no Catalog object or Catalog write path.
- **Save as template** creates a separately named snapshot.
- **Use template** opens an unsaved ordinary Widget/Page draft. Nothing is
  created until Save.
- Templates never translate, publish, receive public URLs, or expose Copy code.

This is the right model. It avoids a template registry, marketplace database,
copy graph, sync process, child cloning, asset transaction, Queue, job,
revision system, and workflow engine.

## Verdict

The product taxonomy and ownership model are approved. 127F is not yet safe to
execute because its Widget contract is only described conceptually while the
current runtime requires locale and serving state for every Instance. It also
leaves Catalog authorization, global Widget assets, and the DevStudio handoff
open to invention.

All corrections use existing product objects and authorities. None justifies a
new template or Catalog subsystem.

## What is correct and must remain

1. **Templates are ordinary product objects with one discriminator.** They are
   not packages, registry entries, or Catalog records.
2. **Ownership creates the views.** Current-account ordinary objects, current-
   account templates, and `CLICKEEN` templates remain distinct by storage root
   plus `isTemplate`.
3. **Catalog is the `CLICKEEN` templates.** It is not copied, synchronized, or
   published into a second store.
4. **Catalog is read-only for everyone.** Underlying `CLICKEEN` templates are
   managed separately through their normal product authority.
5. **Save as template is a snapshot.** The source remains the source; the new
   template gets its own ID and customer-supplied name.
6. **Use template creates only browser work.** The destination account gets an
   ordinary object only after normal explicit Save.
7. **No locale/public state on templates.** No `baseLocale`, overlays,
   Translation Agent, publication, public URL, or installer action.
8. **Limits use existing policy.** Templates count as saved identities under
   the existing same-type limit; no template entitlement or counter is added.
9. **Old Widget Catalog is removed.** Widget definitions remain software/code
   authority, while saved `CLICKEEN` Widget templates become product Catalog
   entries.

## Required corrections before execution

### 1. Define the exact Widget ordinary/template source contract

Current Widget Instance config, pointer, list, create, and Save contracts have
no `isTemplate`. They require `baseLocale` for every Instance and create
serving state for every Instance. 127F cannot be executed by merely adding a
loose boolean.

Define one shared discriminated contract in the existing Widget source
authority:

```text
ordinary Widget Instance
  isTemplate: false
  baseLocale: required
  serving/publication state: required
  overlays/translations: allowed through normal authority

Widget template
  isTemplate: true
  baseLocale: forbidden
  serving/publication state: absent
  overlays/translations: forbidden
  saved structured source + index.html + styles.css + runtime.js: required
```

Persist `isTemplate` with Instance identity in `instance.config.json`, expose it
through the existing pointer/list/open facts, and branch the existing
Roma/Tokyo create/open/save/list/publish/translation operations accordingly.
Do not put the discriminator inside customer-editable Widget config, make
ordinary `baseLocale` optional, or invent a fake template locale.

This is the Widget equivalent of the already-accepted Page source union. It is
one branch in existing authorities, not a template service.

### 2. Do not create serve state for templates

Current Tokyo creation always creates `serve-state.json`, and current list
facts assume every Instance is published or unpublished. That would make a
template masquerade as an unpublished publishable object.

Correction: only `isTemplate: false` objects have publication/serving state.
Template list/open facts omit it. Publish, Unpublish, public reads, translation
commands, and public-code actions reject template targets through the normal
object-state gate.

### 3. Define exact Catalog list/open responses and authorization

The Catalog route must not be a generic cross-account read and it must not
weaken the current rule that a customer capsule matches its account root.

Use one narrow route family:

```text
authenticated Roma customer
→ existing Roma service identity calls Catalog-only Tokyo list/open
→ Tokyo accepts no owner coordinate
→ Tokyo fixes the storage root to CLICKEEN
→ Tokyo returns only isTemplate: true rows/source
```

Roma must first authenticate the real current customer. Tokyo verifies the
existing Roma internal-service identity, hardcodes `CLICKEEN`, and exposes no
Catalog mutation. No new token, service, arbitrary owner parameter, or general
cross-account capability is needed.

Define the DTOs:

- list returns only template ID, name, Widget type or Page identity, and facts
  the Catalog card/list actually renders;
- open returns the complete saved template input needed to start one unsaved
  Bob or Page Builder working copy;
- Widget open joins the saved template with the existing Widget definition
  software/editing contract. Template records do not copy Widget definition
  descriptions or control contracts.

### 4. Constrain global Widget Catalog assets

A saved Widget can contain current-account asset and font references. A
`CLICKEEN` asset coordinate does not become a customer-owned asset when a
customer uses that template.

For PRD 127:

- global Widget Catalog templates may use product-owned Widget assets;
- they may not contain `CLICKEEN` account-owned asset/font references;
- customer My templates may retain valid same-account asset references;
- unsupported global Widget templates fail visibly and are not silently
  rewritten, omitted, or copied.

Do not add asset copying, a template asset store, or a cross-account asset
transaction. The initial global Page template remains blank for the same
reason.

### 5. Make Save as template truthful in both entry points

The list-row and editor actions do not have the same source state:

- from a list row, snapshot the exact already-saved source/files directly;
  there is no dirty browser state and no reason to Save again;
- from Bob/Page Builder, if the source is dirty, explicitly Save it first and
  snapshot only after that Save succeeds;
- from a clean editor, snapshot the already-saved source/files.

The dialog copy must reflect the real state. Do not always say "Your current
changes will be saved first." For a dirty published source, the copy must match
the resolved 127C publication behavior rather than assuming whether Save can
update the object while it remains published.

If the source Save succeeds and template creation fails, say:

> Your changes were saved, but the template wasn't created. Try again.

This is an immediate truthful outcome, not a transaction or recovery system.

### 6. Define My templates as a real management list

Widget and Page My-templates rows need an exact, template-safe shape:

- template name;
- Widget type or Page identity;
- Template badge/status;
- Edit;
- Use template;
- confirmed Delete.

Widget template rows may retain the already-existing Widget Rename action.
Page template names are edited through Page Builder and normal Save; do not add
a second row-level Page Rename path.

They omit Published, Current/Needs update, Languages, Copy URL, and Copy code.
Delete is required because templates consume the existing saved-object limit.

Viewers may see Catalog read-only, but **Use template** is shown only to roles
allowed to create the destination object. Role denial never opens Upgrade.

### 7. Count the complete saved-object inventory

Your objects and My templates are separate views of one shared saved-object
limit. Roma must load/count the complete current-account Widget or Page
inventory, partition it by `isTemplate` for display, and use the union for
`widgets.instances.max` or `pages.max` enforcement and Save-as-template
visibility.

Do not count the visible tab and do not add a template counter service.

### 8. Make DevStudio a launch cockpit, not another editor

Current DevStudio is source-control oriented and explicitly does not host
Widget authoring or bypass Roma/Bob/Tokyo. The PRD's phrase "DevStudio manages"
must not authorize a copied Bob/Page Builder, direct Tokyo writes, or a second
template API.

The smallest aligned direction is:

- DevStudio owns the `CLICKEEN` Catalog-management entry/launch surface;
- the underlying template opens in the existing Bob or Page Builder editor for
  the Berlin-resolved `CLICKEEN` account;
- all reads and mutations continue through normal Roma current-account routes
  and Tokyo storage;
- Roma Catalog remains read-only;
- no DevStudio product mutation proxy or Tokyo binding is added.

127F must name the exact authentication/navigation handoff before execution.
That is the only unresolved part of this direction.

### 9. Enforce the settled CLICKEEN surface rule

The product decision is already made: `CLICKEEN` templates and Catalog are the
same records, Catalog is always read-only, and DevStudio is the management
entry. Therefore Roma must not present an apparently normal edit-capable
`CLICKEEN` My-templates list alongside DevStudio. 127F must state whether that
Roma subview is absent or read-only and enforce the same result in routes and
UI. This is not permission to add a second management surface.

### 10. Remove nonexistent and repeated cleanup

- There is no current hardcoded Page Catalog card because 127E explicitly does
  not create one. Remove requirements to replace/delete that nonexistent UI.
  127F directly creates the first real blank `CLICKEEN` Page template and its
  Catalog view.
- Keep the Product law, structural cutover table, and one Non-goals section.
  Remove repeated exclusions throughout the document.

## Review proposals rejected because product already decided them

Two reviewers suggested allowing a template to have the same display name as
its source. That recommendation is rejected. The product owner already decided
that Save as template asks for a different name so the customer can distinguish
the source from the new snapshot. Retain the non-empty, different-name rule.

The current SEO/GEO/AEO rule also remains unchanged: a Widget template carries
no public SEO choice, and the ordinary Widget draft created from it starts with
the ordinary off-by-default control. Entitled customers may turn it on through
the existing visible control; blocked attempts use the existing Upgrade
interaction.

## Product-owner decisions required

### 1. Visible DevStudio operator journey

Choose what the `CLICKEEN` operator sees in DevStudio, which action opens the
underlying Widget/Page template in Bob/Page Builder, and where the operator
returns after Save. The authority is already settled: Roma owns product
commands and Tokyo owns storage. Exact session, route, and authentication
wiring is an engineering correction under section 8, not a product-owner
choice.

### 2. Initial Widget Catalog content

Name the exact initial `CLICKEEN` Widget templates and their approved names, or
explicitly approve an empty Widget Catalog at cutover. Execution must not infer
which current Widget definitions become saved Catalog templates.

No decision is needed about template locales, publication, Catalog ownership,
same-name validation, limits, or asset copying; those are already settled.

## Exact documentation updates required after deployment

- `documentation/services/roma.md` — Your/My/Catalog route payloads, complete-
  inventory partition/count behavior, Save as template entry semantics, Use
  template, and read-only `CLICKEEN` behavior.
- `documentation/services/tokyo-worker.md` — discriminated Widget/Page
  template storage, absence of serve/locale state, fixed-owner Catalog list/open
  authorization, and no Catalog write routes.
- `documentation/services/bob.md` — Widget template open/save/use behavior,
  Template badge, forbidden locale/public controls, and ordinary destination
  first Save.
- the Page Builder/operator documentation created by 127E — equivalent Page
  template behavior.
- `documentation/services/devstudio.md` — the exact management launch/handoff
  and explicit retention of Roma/Bob/Page Builder mutation authority.
- `documentation/architecture/AssetManagement.md` — global Catalog templates
  cannot carry account-owned asset dependencies in this slice.
- `documentation/architecture/AccountManagement.md` and
  `documentation/capabilities/multitenancy.md` — account-root ownership, fixed
  `CLICKEEN` read exception, and no arbitrary cross-account read.
- `documentation/capabilities/localization.md` — templates have no locale state;
  destination ordinary objects receive destination-account locale authority.
- `documentation/capabilities/seo-geo.md` — templates have no SEO choice and
  ordinary Widget drafts remain off by default.
- `documentation/engineering/UI/interactions.md` and
  `dialogs-and-modals.md` — Save-as-template visibility/copy/outcomes and Use-
  template role/tier behavior.
- `documentation/widgets/README.md`,
  `documentation/widgets/authoring/WidgetFiles.md`, and Web Code Generator docs
  — Widget software definitions versus saved templates and reusable three-file
  source.
- `documentation/architecture/CONTEXT.md`, `Overview.md`, and `Tenets.md` —
  concise current template/Catalog law after deployment.
- `documentation/engineering/PlaywrightE2E.md` — deployed My templates,
  Catalog, fixed owner, conditional actions, DevStudio handoff, and no-write-
  before-Save evidence.

If the approved DevStudio handoff requires a new environment value or Pages
route, update `documentation/engineering/CloudflarePagesCloudDevChecklist.md`
and verify the Pages project through the documented Cloudflare path. Do not add
Cloudflare configuration speculatively.

## V1–V8 result

| Gate | Result before correction | Reason |
| --- | --- | --- |
| V1 | Open | Current Widget storage would require an invented template locale; global asset refs could be substituted. |
| V2 | Green in intent | Locale-bearing or corrupt template payloads are rejected rather than cleaned. |
| V3 | Open | Template serve state, global Widget assets, shared-limit counting, initial Catalog data, and list-row snapshot scope are incomplete. |
| V4 | Open | Fixed-owner Catalog read and DevStudio handoff authorization are not executable yet. |
| V5 | Green | Missing/corrupt templates remain explicit errors, not blank ordinary objects. |
| V6 | Green after correction | Source Save and template creation retain distinct, truthful outcomes and never claim full success after template creation fails. |
| V7 | Green after correction | Old Widget Catalog is removed and no registry/sync/parallel DevStudio path survives. |
| V8 | Green | Template/Catalog behavior does not depend on tests, probes, fixtures, or migration helpers. |

Every open gate has a direct correction above. None requires new template,
Catalog, asset-copy, or recovery machinery.

## Execution-readiness conclusion

127F becomes ready after it:

1. defines the exact discriminated Widget template source and absence of serve
   state;
2. pins fixed-owner Catalog list/open DTOs and authorization;
3. prohibits account-owned assets in global Widget templates;
4. separates list-row snapshot from dirty-editor Save as template;
5. defines My templates actions and complete-inventory counting;
6. removes nonexistent Page-card cleanup and repeated exclusions;
7. resolves the DevStudio handoff and initial Widget Catalog product data;
8. names the exact documentation and deployment evidence owners.
