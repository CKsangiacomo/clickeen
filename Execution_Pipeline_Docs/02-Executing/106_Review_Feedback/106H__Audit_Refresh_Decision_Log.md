# 106 Audit Refresh Decision Log

Status: Decision log / captured
Date: 2026-06-03
Source considered: `/Users/piero_macpro/Downloads/clickeen_106_composition_audit_refresh.md`
Scope: PRD 106A-G pre-execution series

## Decision

Use the audit where it identifies current executable gaps and false-positive implementation paths.

Do not import recommendations that contradict the agreed 106 architecture.

The surviving 106 model remains:

```text
instance = account-owned widget instance
page = head metadata + ordered placements
```

## Useful Findings Captured

### Embedded Widget Field Decision

Captured in:

```text
106B__PRD__Widget_Package_Composition_Contract.md
106D__PRD__Page_Section_Widgets_V1.md
106E__PRD__Page_Source_And_Roma_Composer.md
106F__PRD__Page_Materializer_And_Recomposition.md
```

Decision:

- an embedded widget is allowed when it is a widget-owned field;
- Bob renders the field as a dropdown of existing account widget instances;
- Roma validates same-account ownership, self-reference, and cycles before save;
- parent widget package materializes the child widget package inside the parent root;
- Page Composer still only manages ordered page placements;
- this is not a block, page-source slot, container builder, or nested page composer.

The accepted field shape is:

```json
{
  "embeddedWidgetInstanceId": "FAQ123456"
}
```

### Prague Visual Value Preservation

Captured in:

```text
106D__PRD__Page_Section_Widgets_V1.md
```

Decision:

- preserve Prague's real visual values during block-to-widget conversion;
- extract spacing, padding, margins, radii, borders, colors, shadows, breakpoints, hover/focus states, and motion timing before porting;
- map shared shell values into Stage/Pod/widget config and expose them through Bob panels where the value should be user-editable;
- keep widget-specific values in widget CSS where they are part of the product shape;
- do not replace working Prague craft with generic defaults;
- document intentional visual changes before deleting or replacing a Prague block.

### Runtime And Widget Package

Captured in:

```text
106A__PRD__Widget_File_Structure_V2.md
106B__PRD__Widget_Package_Composition_Contract.md
```

Useful audit points:

- production runtime still uses singleton `window.CK_WIDGET`;
- runtime still has schema assertion/self-validation behavior;
- runtime still has fallback/healing paths such as empty selected state;
- shared widget files still repeat payload/root/locale resolution;
- generated widget packages are not automatically page-composable until the 106B contract is proven.

Decision:

- kill `window.CK_WIDGET` before page composition;
- move canonical state validation to Bob/Roma save and publish-intent boundaries;
- keep 106B as a strict three-file contract: `index.html`, `styles.css`, `runtime.js`;
- reject any hidden manifest/dependency framework in V1.

### Series-Level Execution Risks To Keep

Captured in:

```text
106A__PRD__Widget_File_Structure_V2.md
106B__PRD__Widget_Package_Composition_Contract.md
106D__PRD__Page_Section_Widgets_V1.md
106F__PRD__Page_Materializer_And_Recomposition.md
106G__PRD__Page_Publish_Edge_Serve_And_SEO_GEO_Baseline.md
```

Useful audit points:

- 106A/B are the critical path for the whole series;
- 106A should split runtime/package cutover from shared cleanup;
- locale coherence must be owned before 106F ships;
- Page Composer source-helper reuse checks should be executable tests/CI guards;
- Prague conversion should prove a thin end-to-end widget set before converting the full block inventory;
- `embed.js` is risky if it grows into CMS/plugin support or SEO claims.

Decision:

- package contract proof gates the rest of the series;
- V1 composed page uses one coherent locale context and suppresses per-widget locale switchers;
- keep whole-page embed narrow and explicitly exclude plugin/customer-domain SEO scope;
- widen Prague conversion only after the pipeline works.

### Page Source

Captured in:

```text
106E__PRD__Page_Source_And_Roma_Composer.md
```

Useful audit points:

- no active page source domain exists yet;
- no Tokyo internal page route group exists yet;
- no Roma page-source product path exists yet;
- pages must live under `accounts/{accountPublicId}/website/pages/{pageId}/source.json`, not under widget instances;
- page APIs must fail visibly at parse/validation/index boundaries.

Decision:

- add a real page domain beside the instance domain;
- do not extend instance source into page source;
- do not create route-local trust choreography copies in every new page route.

### Social Share

Captured in:

```text
106C__PRD__Paid_Social_Share_Widget_Feature.md
```

Useful audit points:

- no active `widget.socialShare.enabled` policy/save path exists yet;
- Prague share chrome is reference behavior, not product authority;
- Page Composer must not contain social-share logic.
- localized share labels/toasts are a real product requirement, not an optional polish pass.

Decision:

- build social share as a paid widget package feature;
- enforce policy at Roma save, not only in Bob;
- require localized share chrome before paid launch;
- reject page-level share state, Prague wrapper dependency, and customer-domain SEO claims for client-side embeds.

### Page Composer

Captured in:

```text
106F__PRD__Page_Materializer_And_Recomposition.md
```

Useful audit points:

- current `public-artifacts.ts` reads private widget source;
- current source extraction helpers are dangerous if reused as page composition;
- Page Composer must consume generated widget packages only;
- page recomposition must use reverse placement lookup, not R2 scans.

Decision:

- Page Composer must not import or call source-reading helpers;
- Page Composer must not read `product/widgets/*` source files;
- existing visitor-safety scans are final defense only, not the primary architecture guarantee;
- invalid widget packages fail page composition instead of being repaired.

### Public Delivery

Captured in:

```text
106G__PRD__Page_Publish_Edge_Serve_And_SEO_GEO_Baseline.md
```

Useful audit points:

- current `clk.live` route only understands widget coordinates;
- page delivery needs explicit `/pages/{pageId}` routing;
- active publish marker must control public availability;
- raw R2 object existence must never make a page public;
- customer-site script embeds do not guarantee first-paint SEO on customer domains.

Decision:

- extend the existing public delivery discipline with a page branch;
- preserve existing widget route behavior;
- serve active published page artifacts only;
- keep hosted `clk.live` SEO/GEO baseline honest and do not overclaim generic script embeds.

## Rejected Audit Recommendations

Rejected for the 106 series:

- resurrecting `catalog.json`;
- adding a `GeneratedWidgetPackage` manifest/dependency framework in V1;
- adding a package registry or fourth generated package file;
- switching publish output to `website/pages/{pageId}/published/` without a separate path decision;
- creating a separate public page delivery service;
- making a broad internal command envelope a prerequisite for 106E;
- treating `CK_RUNTIME` as a new runtime platform instead of a small shared helper if needed.

## Bottom Line

The audit was useful as a code-reality check.

It should not become a new PRD direction.

The main execution lesson is:

```text
do not build pages by stretching the current instance materializer
do not compose pages while singleton runtime still works by fallback
do not publish pages by raw R2 object existence
```

## 2026-06-04 System Tenets Audit

Source considered: direct product-system tenets from the product owner.

This audit supersedes any previous wording that made Tokyo sound like a product
authority.

### Governing Tenets

```text
Widgets are software types in the system.
Users create account-owned widget instances in Roma/Bob and save them to Tokyo.
Pages are account-owned stacks of instances saved to Tokyo.
Bob is an editor only: open, edit in browser memory, save.
Roma is the app: account routing, tier authority, product UX, and save intent.
Tokyo is responsible for R2/storage/edge-file delivery, nothing more.
Clickeen/admin is just an account using Clickeen's own widgets.
```

Any 106 code or plan that creates a product brain outside Roma/Bob, or turns
Tokyo into a renderer/composer/policy engine, is drift.

### A-G Audit Result

| PRD | Tenets result | Required action |
| --- | --- | --- |
| 106A Widget File Structure V2 | Mostly aligned. It simplifies widget files and removes browser-runtime self-policing. | Keep pushing Countdown/Logo Showcase toward the FAQ standard. Do not add runtime/product validation back into widget clients. |
| 106B Widget Package Contract | Mostly aligned if interpreted as submitted package storage. | Keep the contract to three files. Tokyo may validate storage safety and store bytes; it must not render widget internals or own product policy. |
| 106C Social Share | Aligned where Roma is the tier/save gate and Tokyo only stores submitted package bytes. | Keep entitlement decisions in Roma/account policy. Tokyo must not sanitize or derive social-share product output. |
| 106D Page-Shaped Widgets | Aligned on product model: page-shaped surfaces are widgets, not blocks. | Continue conversion as normal widgets. Embedded widget references are Bob content fields, not page slots or containers. |
| 106E Page Source + Roma Composer | Product direction aligned; ownership wording/code needs repair. | Roma must be the page product authority. Tokyo should only store page source/projections/files and enforce storage boundaries. Remove language/code that makes Tokyo a page brain. |
| 106F Page Composer/Recomposition | Needs repair. Current executed direction places page composition in Tokyo. | Move composition ownership to Roma/Page Composer or a Roma-owned save/publish path. Tokyo stores the resulting `index.html`, `styles.css`, `runtime.js`; it does not compose product output. |
| 106G Page Publish/Edge Serve | Mostly aligned for edge delivery; publish authority wording needs tightening. | Roma owns publish/unpublish intent and tier permission. Tokyo/clk.live reads stored delivery state and serves allowlisted files only. |

### Code Smell To Fix Before Continuing Execution

The dangerous pattern is any Tokyo module that does more than store, retrieve,
or serve account files.

Review these current 106 code areas under that lens before adding more:

```text
tokyo-worker/src/domains/pages/source.ts
tokyo-worker/src/domains/pages/materializer.ts
tokyo-worker/src/domains/pages/serve-state.ts
tokyo-worker/src/routes/internal-page-routes.ts
tokyo-worker/src/routes/clk-live-routes.ts
roma/components/pages-domain.tsx
roma/lib/account-page-direct.ts
bob/lib/session/publicPackage.ts
```

Expected boundary after repair:

```text
Bob edits/builds widget package in browser memory.
Roma accepts account/tier/product save intent.
Roma sends source/package files to Tokyo.
Tokyo writes/reads R2 files and serves allowlisted public files.
Page Composer produces page package files before Tokyo storage.
```

### Do Not Continue Until These Are True

- The 106 umbrella states the simple Bob/Roma/Tokyo boundaries.
- 106E/F/G docs no longer describe Tokyo as product authority.
- The next executable slice is a deletion/ownership repair, not a new feature.
- No new nouns are introduced while repairing ownership.
- Tests prove the same user-visible behavior after ownership cleanup:
  - create/edit/save widget instance;
  - create/edit/save page stack;
  - compose page package;
  - publish/unpublish page;
  - serve public widget and public page files.
