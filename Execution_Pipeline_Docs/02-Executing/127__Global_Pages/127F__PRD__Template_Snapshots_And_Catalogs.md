# 127F — Templates and Catalogs

Status: **APPROVED FOR EXECUTION — EXECUTE AFTER 127E IS DEPLOYED AND VERIFIED**

Parent: `127__PRD__Global_Pages_Program.md`

## Goal

Give Widgets and Pages the same small template model without creating a
template or Catalog subsystem.

- a Widget template is still a Widget Instance;
- a Page template is still a Page;
- **My templates** shows templates owned by the current account;
- **Catalog** shows templates owned by the `CLICKEEN` account;
- Catalog is read-only in Roma for every account, including `CLICKEEN`;
- customers edit their own templates through **My templates** in Bob or Page
  Builder;
- DevStudio manages the `CLICKEEN` templates that supply every Catalog,
  through the normal Clickeen-owned Widget/Page authorities.

## Product law

1. **Widgets and Pages remain separate products.** Widget templates are Widget
   Instances. Page templates are Pages.
2. **A template uses the normal object authority plus `isTemplate: true`.** Save
   as template copies the complete reusable Widget/Page source and config, then
   clears only the ordinary object's locale, translation, and public-serving
   values from that copied config. It does not remove reusable HTML, CSS,
   JavaScript, Page values, placements, settings, or asset references. There is
   no template registry or Catalog object.
3. **Save as template is a conditional editing utility.** Show it only for an
   editable ordinary Widget Instance or Page when the account can create
   another same-type object. When used, it saves the source and creates a new
   named template without converting or renaming the source.
4. **Ownership determines the list.** A regular account's templates appear in
   that account's **My templates**. The `CLICKEEN` account's templates are the
   Widget and Page Catalogs for every account.
5. **`CLICKEEN` templates and Catalog are the same underlying records.** They
   are not copied or synchronized.
6. **Catalog has no write operation.** Nobody edits, adds to, removes from, or
   publishes a Catalog directly. DevStudio changes Catalog content only by
   managing the underlying `CLICKEEN` templates through normal Widget/Page
   source and Save authorities.
7. **Templates cannot be published.** They have no public URL, publish toggle,
   unpublish action, or public-code action. Therefore templates cannot be
   opened through `clk.live` or mounted through `clickeen.js`.
8. **Use template starts an unsaved ordinary-object working copy.** No Widget
   Instance or Page is created until explicit Save. A customer's explicit
   **Copy assets in my assets folder** choice is a separate normal asset
   operation and may create account assets before that Save. The saved Widget
   Instance or Page then belongs to the current account and has
   `isTemplate: false`.
9. **Templates have no locale state or translations.** In the copied template
   config, `baseLocale`, any object-local locale-selection value,
   overlay/translation references, and translation status are absent. Pages do
   not own a selected-locale list in the first place. Template operations never
   run Translation Agent.
10. **Using a cross-account template makes asset ownership explicit.** If the
    reusable source references images, SVGs, or videos owned by `CLICKEEN`, the
    customer chooses **Copy assets in my assets folder** or **Discard assets**
    before the unsaved draft opens. The existing account-assets authority does
    the copying; 127F adds no asset store, transaction, Queue, or new service.

## Product taxonomy

```text
Widgets
├── Your widgets     account Widget Instances that are not templates
├── My templates     account Widget Instances saved as templates
└── Widget catalog   Widget templates owned by CLICKEEN

Pages
├── Your pages       account Pages that are not templates
├── My templates     account Pages saved as templates
└── Page catalog     Page templates owned by CLICKEEN
```

Editors remain equally simple:

```text
Bob          edits one Widget Instance or Widget template
Page Builder edits one Page or Page template
```

Only an ordinary published Widget Instance or Page receives **Copy URL** and
**Copy code**. Both use 127C's one public identity and `clickeen.js` contract;
127F introduces no template installer, preview URL, iframe, or Catalog embed.

The routes are:

```text
/widgets                  Your widgets
/widgets/templates        Widget My templates
/widgets/catalog          Widget catalog
/pages                    Your pages
/pages/templates          Page My templates
/pages/catalog            Page catalog
```

## Structural cutover boundary

127F replaces the current Catalog implementations and keeps the Roma domains
small. It does not add a template/Catalog subsystem:

| Current code | Final responsibility |
| ------------ | -------------------- |
| `roma/components/widgets-domain.tsx` | Thin Widgets domain/page wrapper. Its inline Your-widgets, Catalog, actions, and form orchestration move into named Widget list/template/catalog components; obsolete definition-backed Catalog code is deleted. |
| 127E Pages domain | Reuse the same thin-wrapper plus named Your-pages structure for My templates and Page catalog; do not rebuild another all-in-one Pages component. |
| Widget Catalog backed by Widget definitions | Replace with the read-only list of `CLICKEEN` Widget templates and delete the old payload, UI branch, helpers, tests, CSS, and copy in this slice. |
| Template behavior | Normal Widget/Page source and config plus `isTemplate: true`; only locale, translation, and public-serving config values are cleared. Add no registry, package, template service, Catalog database, synchronization process, or compatibility layer. |
| Catalog presentation | DevStudio edits the small presentation values stored with each `CLICKEEN` template: thumbnail, description, category, and display order. Roma only reads and displays them. |

Two narrow operations cross from a customer session to fixed `CLICKEEN`
ownership:

1. the read-only Catalog list/open operation; and
2. the explicit Catalog source-asset copy, whose source is fixed to `CLICKEEN`
   and whose destination is the authenticated current account.

All other reads and writes continue through the normal current-account
Widget/Page authorities. Neither operation accepts an arbitrary source or
destination account. 127F does not refactor unrelated Roma domains or create
shared machinery in anticipation of future catalogs.

## List rules

The four list rules are mechanical:

```text
Your widgets
= ownerAccountPublicId is current account AND isTemplate is false

Your pages
= ownerAccountPublicId is current account AND isTemplate is false

My templates
= ownerAccountPublicId is current account AND isTemplate is true

Catalog
= ownerAccountPublicId is CLICKEEN AND isTemplate is true
```

The Catalog query does not accept an arbitrary owner coordinate. Its owner is
always `CLICKEEN`.

For a regular account, **My templates** and **Catalog** show different owners.
For the `CLICKEEN` coordinate, the underlying templates and Catalog resolve to
the same records. Catalog remains a read-only Roma view; DevStudio is the
management surface for those underlying `CLICKEEN` templates.

Ordinary `CLICKEEN` Widget Instances and Pages are not Catalog entries.
Templates owned by another customer are never visible outside that account.

### My templates rows

**Widget My templates** and **Page My templates** reuse their ordinary
Widget/Page Dieter table structure. Each template row shows:

- the template name with a small **Template** badge;
- the ordinary Widget type or Page identity columns used by that domain;
- **Edit** as the primary row action; and
- **Use template**, **Rename**, and **Delete** in the Dieter three-dot menu.

Template rows never show a publish toggle, Current/Needs update status, Copy
URL, Copy code, Unpublish, or any other public-serving action. **Delete** uses
the existing confirmed Widget/Page delete interaction and deletes only that
template. It does not delete the source object or account assets.

## Catalog read authority

Normal current-account routes cannot read another account's storage. Catalog
therefore uses one narrow read-only boundary:

```text
authenticated Roma customer
→ Roma Catalog list/open route
→ service-authenticated Tokyo Catalog read
→ owner fixed server-side to CLICKEEN
→ CLICKEEN templates only
```

The request accepts no owner account coordinate. Tokyo fixes the owner to
`CLICKEEN`, filters to `isTemplate: true`, and returns only the template source
needed by **Use template** plus its Catalog presentation values. This boundary
has no create, edit, delete, translation, generate, publish, or arbitrary
cross-account read operation. All template mutations remain on the owner's
normal authenticated Roma→Tokyo path through DevStudio.

## Save as template

**Save as template** is shown only when:

- the source is an ordinary Widget Instance or Page with `isTemplate: false`;
- the current user can edit that source;
- the account has capacity for another same-type saved object under
  `widgets.instances.max` or `pages.max`.

In **Your widgets** and **Your pages**, put it in the object's Dieter three-dot
menu. In Bob and Page Builder, keep it visible as a persistent secondary action.
When any condition is false, omit it. Do not render a disabled version, lock
treatment, or Upgrade action.

Roma enforces the same role and capacity facts when the command is invoked so a
stale client or direct request cannot bypass them. This is the normal
Widget/Page creation validation, not a template entitlement, preflight service,
reservation, or new policy path. Hiding the control is not authorization.

For a Widget Instance, the saved snapshot includes its complete customized
`index.html`, `styles.css`, and `runtime.js`. A Widget template is therefore a
normal saved three-file Instance with `isTemplate: true`, not a configuration
that must be rendered later.

The action opens a Dieter dialog:

```text
Save as template

Template name
[________________________]

Your current changes will be saved first.

[Cancel] [Save as template]
```

The template name is required and must differ from the source name so the user
can distinguish the two objects.

The command performs two explicit outcomes:

1. save the source through its existing Widget or Page Save authority;
2. after that Save succeeds, create one new object of the same type with a new
   ID, the entered name, the same owning account, the complete reusable source
   and copied config, and `isTemplate: true`.

The copied template config retains the source's reusable values, including a
Widget Instance's `seoGeoAeoEnabled` value. It clears only:

- `baseLocale`;
- any object-local locale-selection value present in the source Widget config
  (Pages do not own a selected-locale list);
- overlay and translation references/status; and
- publication and public-serving state.

Save as template copies the exact files created by the source Save and does not
run a second generation. A later explicit Save while editing the template may
update its reusable files through the same Web Code Generator; a template never
translates or publishes. An ordinary Widget Instance created from a template
retains the template's SEO/GEO/AEO setting and then follows the normal
destination-account tier interaction; the setting is never silently reset.

Pages have no SEO toggle. Every ordinary Page receives Page SEO/GEO/AEO output;
Page templates have no public output.

If source Save fails, no template is created. If source Save succeeds but
template creation later fails, Roma says:

```text
Changes saved. Template was not created.
```

On success, Roma remains on the source and offers **Open template**. Opening
the template changes route to the template's own ID; the editor never silently
changes which object is being edited.

## Editing templates

Bob and Page Builder read `isTemplate` from saved source. They do not infer it
from the route, a query parameter, a Catalog origin, or client state.

Every template editor shows a small **Template** badge next to the saved name.
It keeps ordinary Save and **Use template**, but removes locale selection,
translation generation, publication, unpublication, public URL, and public
code controls. Widget templates retain the ordinary SEO/GEO/AEO setting because
it is reusable Widget config, even though the template itself has no public
output.

A Page template has no Current/Needs update status. It is a snapshot; explicit
Save while editing the template replaces that snapshot through the normal Page
template Save authority.

Regular accounts cannot edit a Catalog template. The `CLICKEEN` account does
not edit through Catalog or Roma **My templates**. An authorized operator uses
DevStudio to manage the same underlying `CLICKEEN` Widget Instance or Page
template through its normal source and Save authority.

## Use Widget template

**Use template** on a Widget template opens one unsaved Bob working copy from
the template's complete `index.html`, `styles.css`, `runtime.js`, and required
editor/config metadata, including its saved SEO/GEO/AEO setting. The working
copy has ordinary-object intent (`isTemplate: false`) and no publication or
locale state.

Before **Save**, there is no new Instance ID, Instance root, Instance-limit
consumption, or Translation Agent call. Explicitly copied assets are ordinary
account assets, not an Instance. Explicit **Save** mints the new Instance ID in
the browser and uses the normal Instance Save/Web Code Generator authority to
create one ordinary current-account Instance.

If a same-account template references assets, Bob uses those existing
same-account references and shows no asset-choice dialog.

If a `CLICKEEN` Catalog template references Clickeen-owned images, SVGs, or
videos, **Use template** first opens this Dieter dialog:

```text
This widget includes assets

This widget includes images, SVGs, or videos.

[Copy assets in my assets folder] [Discard assets]
```

- **Copy assets in my assets folder** uses the existing Roma account-assets
  route and Tokyo asset authority to copy those source assets into the current
  account's **My assets**, then rewrites the unsaved working copy to those new
  same-account asset references. The request and returned mappings use the same
  account-local refs stored in Widget/Page config. The source owner is fixed to
  `CLICKEEN` by the server, the destination comes from the authenticated Roma
  account, and the existing `promotion` asset source identifies the copy. The
  client cannot supply either account coordinate.
- **Discard assets** copies nothing and removes those external asset references
  from the unsaved working copy. The corresponding asset-backed fields are
  empty; Clickeen does not invent replacement assets.

The resulting Widget remains an unsaved Bob draft. Copying assets does not Save
the Widget Instance. Assets explicitly copied into **My assets** remain account
assets even if the customer later leaves without saving the draft; 127F adds no
cleanup job or transaction.

## Use Page template

**Use template** on a Page template opens one unsaved Page Builder draft from
that Page's Page-owned source. Before **Save**, no Page ID, Page root, generator
call, or row in **Your pages** exists. Explicitly copied direct Page assets are
ordinary account assets, not a Page.

Explicit **Save** creates one ordinary current-account Page with
`isTemplate: false`, then uses the normal 127A–127D Save and generator path.

A Page template remains a Page containing Instance references and complete
reusable Page-owned source/config, but its copied config has no `baseLocale`,
selected locales, Page overlay/translation values, or publication/public-serving
state. 127F does not clone referenced Instances, create child objects, or add a
multi-object commit protocol.

The same asset choice applies to direct Page-owned images, SVGs, or videos. A
same-account Page template keeps valid same-account asset references without a
dialog. A `CLICKEEN` Catalog Page template with direct Page-owned assets asks
the customer to copy or discard them before opening the unsaved Page draft.
Catalog-card thumbnails are presentation assets and are never copied into the
customer account.

For same-account Page templates, the new Page may retain valid same-account
Instance references. For the global Page Catalog, 127F seeds only a blank
`CLICKEEN` Page template, which has no cross-account Instance or asset
dependencies. Rich global Page templates that require transferring referenced
child Instances are outside PRD 127. Direct Page-owned source assets already
follow the copy/discard rule above.

## Locale and translation behavior

Templates have no locale or translation state:

- Save as template copies the complete reusable source and config, then clears
  `baseLocale`, any object-local Widget locale-selection value, and
  overlay/translation references and status from the copied template config;
- the source Widget Instance or Page is not changed by that clearing;
- Use Widget template and Use Page template copy no locale state and run no
  Translation Agent operation;
- normal creation of the destination Widget Instance or Page assigns that new
  ordinary object's `baseLocale` from the destination account through the
  existing creation authority;
- after creation, the owner may select locales and request translations through
  the ordinary Instance/Page localization workflow.

This rule applies equally to customer **My templates** and Clickeen-owned
Catalog templates. There is no template-to-account locale comparison, Catalog
locale variant, automatic translation, relabeling, or conversion step.

## Catalog presentation and Roma UX

Catalog is a visual discovery surface. It is not the **My templates** management
table.

DevStudio manages these presentation values on each underlying `CLICKEEN`
Widget/Page template:

- thumbnail asset reference;
- short description;
- category; and
- display order.

Use these config fields; do not invent a second Catalog record:

```ts
type CatalogPresentation = {
  thumbnailAssetRef: string;
  description: string;
  category: string;
  displayOrder: number;
};
```

Every `CLICKEEN` template has `catalogPresentation` because every `CLICKEEN`
template is a Catalog item. Customer **My templates** do not require it. An
authorized operator adds or removes an item from the global Catalog by creating
or deleting the underlying `CLICKEEN` template in DevStudio; Roma has no Catalog
membership flag or command.

DevStudio creates a `CLICKEEN` Catalog template and its complete
`catalogPresentation` in the same normal template Save. It never stores the
template first and patches the presentation values afterward. The four values
are required by that DevStudio Save; missing values produce the ordinary form
error and create no template. This is one object Save, not a transaction or
second Catalog write.

The card title is the template name. These values live with the underlying
template config; they do not create a Catalog object. The thumbnail is a
`CLICKEEN`-owned Catalog presentation asset. It is not reusable Widget/Page
source and never enters the copy/discard asset dialog.

Roma's Widget Catalog and Page Catalog each render:

- a left Catalog menu with **Catalog Home** and the categories present in the
  returned templates;
- search across template names and descriptions;
- a responsive card grid ordered by the saved display order; and
- one card per template showing thumbnail, name, description, and **Use
  template**.

Search and category selection filter the already-loaded Catalog response in
Roma. They add no search service, category registry, ranking engine, popularity
state, or marketplace machinery. Roma cannot edit Catalog presentation values
or the underlying `CLICKEEN` templates.

## DevStudio Catalog management

DevStudio adds one navigation group:

```text
CATALOGS
├── Widget catalog
└── Page catalog
```

These views list the same underlying `CLICKEEN` templates returned by the
customer Catalog read. Selecting a template lets the authorized operator:

- edit its thumbnail, description, category, and display order in DevStudio;
- open the existing Bob editor for a Widget template; or
- open the existing Page Builder for a Page template.

Bob and Page Builder remain the source editors. DevStudio does not implement a
second Widget/Page editor, write R2 directly, or create a separate Catalog
record. Creating, renaming, or deleting a Catalog item operates on the
underlying `CLICKEEN` template through the same normal Widget/Page authorities.
Creating a Catalog item collects its template name and all four presentation
values before the single template Save. Later presentation edits update that
same template config.

## Limits

Templates remain normal saved identities:

- a Widget template counts under the same saved-Instance limit as another
  Widget Instance;
- a Page template counts under `pages.max` like another Page;
- an ordinary object created from a template counts under its normal limit;
- templates do not count toward published-object limits because templates
  cannot publish.

**Save as template** is the explicit exception to the normal visible-action
Upsell law. It is present only while the current role and same-type capacity
allow it, and it has no Upgrade path. **Use template** is a customer-facing
Catalog action and follows the normal law: it remains visible at the destination
limit, creates nothing when blocked, and opens the existing Upgrade dialog.
The Page catalog remains part of the visible Pages domain for every tier; on a
tier that cannot use Pages, its Page actions follow the same Upgrade behavior
before any draft, object, or generator call.

Role denial remains authorization—not an upsell—and templates remain
unavailable for publication because that action is invalid for the object, not
because of tier.

The exact `CLICKEEN` account uses the non-sellable internal Tier99 account
profile and can hold the templates that supply the Catalogs. Catalog ownership
still comes from the exact `CLICKEEN` account coordinate—not from Tier99.
Tier99 does not make another account's templates global and grants no
cross-account write authority.

## Replacing the current catalog implementations

Roma currently presents Widget software definitions as Widget Catalog cards.
127F replaces that product meaning:

- Widget definitions remain the software authority for Widget type, code, and
  editing contracts;
- Widget Catalog reads only `CLICKEEN` Widget templates;
- the definition-backed Catalog payload, UI branch, tests, helpers, and copy
  are deleted after the replacement is verified;
- both models do not remain in production.

127E leaves Page Catalog unimplemented. 127F supplies it directly from
`CLICKEEN` Page templates. The initial entry is one real blank Page template
created with its complete Catalog presentation values in the `CLICKEEN`
account; 127F does not install or remove an interim hardcoded Page card.

## Code work

1. Consume the deployed 127A Page `isTemplate` discriminator; add the same
   minimal designation to Widget Instance source/list contracts. Save as
   template copies complete reusable source/config and clears only locale,
   translation, and public-serving values from the copied config. Add no second
   storage authority.
2. Make ordinary Widget/Page inventories exclude templates.
3. Add current-account **My templates** reads for Widgets and Pages.
4. Add the narrow service-authenticated Tokyo Catalog list/open read fixed
   server-side to `CLICKEEN` templates; accept no owner coordinate and no write.
5. Add **Save as template** through the existing Widget/Page Save authorities.
   Derive its list-menu and persistent editor visibility from ordinary-source
   state, the current role, and the existing same-type saved-object capacity.
   Keep the normal server-side role and `widgets.instances.max`/`pages.max`
   validation for invocation. Do not add a reservation, counter, or
   template-specific policy path.
6. Add **Use template** through the existing unsaved Bob/Page Builder draft and
   normal first-Save authorities; opening a template creates no Widget/Page
   object. An explicit asset copy remains a separate normal asset operation.
7. Add **My templates** routes and navigation for Widgets and Pages using the
   named list/domain structure above and its exact Edit/Use/Rename/Delete row
   actions; do not add more orchestration to either `*-domain.tsx` file.
8. Add the Dieter naming dialog, Template badge, editor state, **Save as
   template** row-menu/editor placements, **Use template**, and the Dieter
   copy/discard-assets dialog.
9. Remove template locale-selection, translation-generation,
   publication/public-code controls and reject those commands server-side.
10. Replace the definition-backed Widget Catalog and implement Page Catalog in
    the same slice: delete the obsolete definition-backed Widget payload, UI
    branch, tests, CSS, and helpers, and implement Page Catalog directly from
    `CLICKEEN` templates without an interim hardcoded card.
11. Hide **Save as template** when its role/source/capacity conditions are
    false. Keep **Use template** visible at tier limits and route its blocked
    attempt into the existing Upgrade dialog without creating anything.
12. Reuse the existing account-assets route for the explicit cross-account
    **Copy assets in my assets folder** choice. Add no template asset store,
    asset transaction, pending state, commit record, registry, or new service.
13. Add DevStudio management for the underlying `CLICKEEN` Widget/Page
    templates and their thumbnail, description, category, and display-order
    config values through the exact CATALOGS > Widget catalog/Page catalog
    navigation and normal product authorities; open Bob/Page Builder for source
    editing and add no second editor or Catalog write route to Roma.
14. Build the read-only Roma Catalog layout with left category navigation,
    client-side search/filtering, Dieter cards, and **Use template**. Do not add
    ranking, popularity, marketplace, or search infrastructure.

## Pre-deploy product-data migration

Pre-127F ordinary Widget configs do not contain the now-required
`isTemplate` discriminator. Before deploying the strict reader:

1. run the documented R2 preflight;
2. inventory every existing
   `accounts/*/instances/*/instance.config.json` object;
3. explicitly add `isTemplate: false` to each ordinary pre-127F config through
   the approved Cloudflare R2 operation path; and
4. read every rewritten object back and verify the exact discriminator before
   deploying code.

This is a one-time explicit product-data migration. Do not add a runtime
fallback, compatibility parser, or silent default.

## Product-data work

After code is deployed, an authorized operator works in DevStudio against the
exact account coordinate `CLICKEEN` through normal Widget/Page product routes:

1. in DevStudio, save each intended Widget Catalog template together with its
   thumbnail, description, category, and display order in one template Save;
2. in DevStudio, save one blank Page Catalog template together with its four
   presentation values in one template Save;
3. verify those underlying templates and presentation values in DevStudio;
4. verify those exact records appear read-only in customer Catalogs.

No R2 object is rewritten directly to create Catalog content.

## Verification

1. Prove Widget and Page ordinary inventories exclude templates.
2. Prove **Save as template** is absent for a viewer, a template source, and an
   account at the same-type saved-object limit, and that stale/direct requests
   still fail through the normal server validation.
3. Save a Widget Instance and a Page as named templates; prove the sources stay
   ordinary and unchanged while distinct template IDs are created with complete
   reusable source/config; prove only locale, translation, and public-serving
   values were cleared from each copied template config.
4. Prove the Template badge and non-localizable/non-publishable editor state
   come from saved `isTemplate`.
5. Prove a regular account sees only its templates in **My templates**.
6. Prove Catalog in multiple accounts shows exactly the same `CLICKEEN`
   templates and no ordinary or customer-owned objects.
7. Prove DevStudio's underlying `CLICKEEN` templates and customer Catalogs
   resolve to the same records and presentation values.
8. Prove Catalog has no create, edit, delete, publish, or add/remove operation.
9. Edit a `CLICKEEN` template through DevStudio and prove the read-only Catalog
   reflects that saved object without copying or synchronization.
10. Use a Widget template and prove opening it creates no Instance; after
    explicit Save, prove one ordinary current-account Instance is created
    through the normal path without copied locale state or an automatic
    translation call; prove the saved SEO/GEO/AEO setting was retained rather
    than reset.
11. Use the blank Page Catalog template; prove nothing exists before Save and
    one ordinary Page exists after normal Save/generate succeeds.
12. Prove a same-account template with asset references opens without copying
    them. Prove a `CLICKEEN` Catalog template with direct source assets offers
    **Copy assets in my assets folder** and **Discard assets**; Copy uses the
    existing account asset authority and rewrites the unsaved draft, while
    Discard removes those references without a substitute.
13. Prove the old definition-backed Widget Catalog is absent and Page Catalog
    was implemented directly from `CLICKEEN` templates without an interim
    hardcoded card.
14. Prove template use follows the existing destination-account creation and
    localization path, assigns the new ordinary object's `baseLocale` from the
    destination account, and copies or generates no translation state.
15. Exhaust the destination saved-object limit and prove **Save as template**
    disappears from the list-row menu and editor action area while **Use
    template** stays visible, creates nothing, and opens the existing Upgrade
    dialog.
16. Prove Widget and Page Catalogs render the DevStudio-managed thumbnail,
    name, description, category order, left category menu, client-side search,
    and Use template action without exposing a Catalog write.
17. Prove templates contain no locale, translation, or public-serving config
    values and that no child Instance, pending output, template-operation
    record, Queue, autonomous translation/generate path, asset store, or asset
    transaction was added.
18. Prove My templates rows contain Template badge, Edit, Use template, Rename,
    and confirmed Delete while omitting every publication, URL/code, and Page
    currency action.
19. Prove DevStudio exposes CATALOGS > Widget catalog/Page catalog, edits only
    Catalog presentation values itself, and opens the existing Bob/Page Builder
    for template source editing without a second editor or direct R2 write.
20. Prove creating a `CLICKEEN` Catalog template and its four required
    presentation values is one Save; missing presentation blocks creation and
    no incomplete Catalog template is stored.

## Failure behavior

| Failure                                                                             | Required result                                                                                                |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Caller cannot edit source                                                           | Hide Save as template; reject a stale/direct request and create nothing.                                       |
| Source is already a template                                                        | Hide Save as template; reject a stale/direct request and create nothing.                                       |
| Account has no same-type saved-object capacity                                      | Hide Save as template; reject a stale/direct request and create nothing; do not open Upgrade for this utility. |
| Template name is missing or equals source name                                      | Reject; create nothing.                                                                                        |
| Source Save fails                                                                   | Preserve the editor failure; create no template.                                                               |
| Source Save succeeds, but template creation later fails                             | Keep the saved source; report template failure separately. Do not claim full success.                          |
| Use template hits a tier limit                                                      | Create no ordinary object and open the existing Upgrade dialog.                                                |
| Catalog query attempts another owner                                                | Reject; Catalog owner is fixed to `CLICKEEN`.                                                                  |
| Catalog edit/delete/publish is attempted                                            | Reject; Catalog has no write authority.                                                                        |
| DevStudio Catalog template creation lacks a presentation value                      | Keep the form open and create no template.                                                                      |
| Template source is missing or corrupt                                               | Report the error; do not produce an ordinary object.                                                           |
| Global Page template contains cross-account dependencies                            | Do not use it in 127; report the unsupported source.                                                           |
| Page draft created from a template fails during normal Page Save/generation/storage | Do not report a Page as saved; keep the browser draft and show the normal retry error.                         |
| Locale selection, translation, publish, or unpublish targets a template             | Reject server-side.                                                                                            |
| Copying one or more Catalog source assets fails                                     | Do not claim the copy completed or rewrite the draft refs; show the normal asset error and create no Widget/Page object. Any assets already copied remain visible in My assets. |

## Non-goals

127F does not add:

- Catalog editing, publishing, approval, eligibility, flags, copies, or sync;
- a template database, folder, package, registry, marketplace, ranking engine,
  rating, popularity state, or version history;
- child-Instance cloning or automatic creation of several objects from one
  Page template;
- a template asset store, asset-copy transaction, copied-asset cleanup job, or
  new asset service;
- pending objects, an operation commit record, Queue, job, or workflow engine;
- autonomous translation, generation, publishing, or synchronization;
- rich global Page templates with account-owned Instance dependencies;
- Prague migration, Websites, navigation, domains, A/B testing, or analytics.

## Definition of done

127F is done when Widgets and Pages each provide **Your**, **My templates**, and
read-only **Catalog** views; templates remain their normal underlying object
type; `CLICKEEN` templates are exactly the Catalog; DevStudio and Catalog
resolve to the same `CLICKEEN` records; customers edit their own templates
through **My templates** in Bob or Page Builder while DevStudio manages the
underlying Catalog templates and their presentation values; Save as template
has only its approved
conditional list-menu and persistent editor placements; Save as template and
Use template use normal authorities; templates retain complete reusable
source/config while carrying no locale, translation, or public-serving values
and cannot publish; cross-account source assets use the explicit copy/discard
choice through the existing asset authority; the old Catalog implementations
are deleted; My templates uses the approved Template/Edit/Use/Rename/Delete row
contract; DevStudio uses the approved CATALOGS navigation and existing
Bob/Page Builder editors; and no template/Catalog subsystem or multi-object
machinery was added.

## Required documentation after deployment

- `documentation/architecture/CONTEXT.md`
- `documentation/architecture/Overview.md`
- `documentation/architecture/Tenets.md`
- `documentation/architecture/AccountManagement.md`
- `documentation/engineering/UI/interactions.md`
- `documentation/capabilities/multitenancy.md`
- `documentation/services/roma.md`
- `documentation/services/bob.md`
- `documentation/services/tokyo-worker.md`
- `documentation/services/devstudio.md`
- `documentation/capabilities/localization.md`
- `documentation/architecture/AssetManagement.md`
- relevant Widget and Page operator documentation

## V1–V8 review questions

- V1: no missing source, locale, dependency, or permission receives an
  invented substitute.
- V2: invalid template source is not silently repaired or normalized.
- V3: ordinary objects, templates, Catalog rows, reusable config, and explicit
  asset choices are not silently omitted from their correct ownership view.
- V4: edit, template creation, Catalog ownership, publication, and role checks
  fail closed.
- V5: corrupt templates are not treated as absent, blank, or ordinary objects.
- V6: source Save, template creation, object creation, and navigation report
  their own exact outcomes.
- V7: the old Catalog models and invented template machinery do not survive
  under different names.
- V8: normal template and Catalog behavior does not depend on tests, probes,
  fixtures, or migration helpers.
