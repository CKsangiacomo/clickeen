# 127C — CODEX Execution-Readiness Peer Review

Status: **NOT READY — CONCRETE SERVING DETAILS AND TWO PRODUCT DECISIONS REQUIRED**

Subject: `127C__PRD__Page_Publication_And_Public_Serving.md`

Review lenses: Staff Engineer, Senior PM, Principal TPM

Date: 2026-08-05

## Verdict

**Not ready for execution yet.**

The architecture is directionally correct and lean. The remaining work is not
a redesign: 127C needs a few concrete serving and cutover details, and two
product-owner decisions, before an executor can implement it without guessing.

## What is correct and must remain

### One direct serving chain

The authority split is correct:

```text
Roma authorizes customer commands
→ Tokyo stores and serves current Page files
→ Cloudflare caches exact-locale responses
```

Public requests do not call Roma, Page Builder, Web Code Generator,
Translation Agent, or child Widget URLs. This preserves the Clickeen model of
explicit authoring followed by simple cached delivery.

### One current Page root

The direct Page folder is correct:

```text
source.json
serve-state.json
overlays/locales/{locale}.json
overlays.json
index.html
styles.css
runtime.js
```

No build folders, package versions, revisions, fingerprints, candidate
packages, or selected-package pointers should return.

### Explicit customer actions

Keep these distinctions:

- Save or Update stores files already generated in the browser.
- Publish exposes saved files and never generates or translates.
- Unpublish stops public serving without deleting the Page.
- Delete removes only the unpublished Page, not referenced Instances/assets.

### Complete locale HTML and shared installer

Stable URL → exact-locale URL → complete cached HTML is the right public model.
The single product-neutral `clickeen.js` installer is also the correct
replacement for iframe and direct-`runtime.js` snippets.

## Required corrections

### 1. Leave `needsUpdate` to 127D

127C currently defines:

```ts
type PageServeState = {
  published: boolean;
  needsUpdate: boolean;
};
```

That contradicts the execution order: 127D owns the addition of
`needsUpdate`. Current Tokyo Page state is publication-only.

Correct 127C to install publication state only. 127D then extends that small
contract with the required boolean and activates the related Publish gate.
Do not default or silently heal a missing field across the two slices.

### 2. Remove the undefined cache-validator language

127C refers to an “ordinary object/response cache validator.” No such shared
Page contract exists. The current public runtime has cache headers and the
Instance fingerprint path that 127B explicitly deletes.

Delete this sentence. Specify only the cache headers, exact-locale cache keys,
and Page-scoped purges that 127C actually owns. Do not replace fingerprints
with an ETag/revision under another name.

### 3. Define the saved locale set and completeness

The PRD uses “selected,” “available,” and “complete” without one mechanical
definition. A Page deliberately stores no selected-locale registry.

The serving rule should be:

- available locales are `source.baseLocale` plus the exact top-level locale
  keys in the saved `overlays.json`;
- `baseLocale` values already exist in `index.html`;
- a non-base locale is complete only when every locale-replaceable marker in
  generated HTML has its required value in the correct Page or placement
  scope;
- missing required coverage returns the explicit locale failure and never
  leaves the base value in place.

This is the accepted 127B marker contract applied by Tokyo, not a new
validator framework.

### 4. Define exact purge coordinates

Current Page cache purge code covers the base Page URL and support files, not
`/pages/{pageId}/{locale}` URLs.

127C must require:

- read the previous saved `overlays.json` locale keys before replacement;
- take the union of previous and submitted exact locale keys;
- purge those exact-locale URLs after a successful Save/Update, Unpublish, or
  Delete as applicable;
- purge changed direct support-file URLs;
- do not purge the stable redirect if it remains `no-store`.

This is necessary so a removed locale cannot remain cached publicly.

### 5. Make Tokyo own request-coordinate SEO completion

127C promises canonical and alternate-locale links, while its response steps
only describe replacing locale values. Web Code Generator does not own the
public request origin/account/Page URL.

State that Tokyo completes canonical and alternate links from:

- the public request origin;
- `accountPublicId`;
- `pageId`;
- the saved available locale set.

The generator provides the Page HTML/markers; Tokyo provides the real public
coordinates during exact-locale response completion.

### 6. Make the installer technically operable

The installer requirements must include:

- accept only a valid configured Clickeen `clk.live` Widget/Page coordinate;
- resolve the known stylesheet, runtime, asset, and relative support URLs
  against the fetched public-product URL before mounting into the host;
- require credential-free CORS on `clickeen.js`, completed HTML, CSS, runtime,
  and required public assets;
- mount each installer once and fail visibly without leaving a partial mount;
- keep the loader product-neutral and free of generation/overlay/tier logic.

This is ordinary public-boundary parsing and URL resolution, not a validation
framework.

### 7. Name the real iframe/direct-runtime cutover

The generic checklist is too small. The obsolete contract currently spans:

- `roma/lib/public-widget-actions.ts`;
- `roma/components/widget-copy-code-dialog.tsx`;
- Roma Builder-open/host action payloads;
- Bob session boot/types and TopDrawer consumers;
- Roma/Bob CSS and tests;
- current service/operator documentation.

The final shared public-action contract should contain only the public URL and
the `clickeen.js` installer snippet. Widget-specific “Widget URL” copy must
become product-neutral so Pages reuse the same dialog rather than creating a
second one.

### 8. Name the actual `/clickeen.js` delivery coordinate

Today `/clickeen.js` has no source mapping, R2 sync mapping, or Tokyo public
route. Adding a checkbox that says “ship it” is insufficient.

127C must name:

- its exact repository source file;
- its canonical Tokyo product-root R2 key;
- the existing `tokyo-r2-deploy-sync` mapping that uploads it;
- the Tokyo public-host dispatch route that serves `/clickeen.js` before
  account routes;
- its content type and revalidation/cache behavior;
- verification through the existing cloud-dev Worker/product-root deploy.

Use the existing Tokyo product-root surface. Do not create a loader service,
registry, or separate deployment.

Do not promise a long-lived “globally cached” unversioned script unless the
cache behavior is explicitly safe. The lean default is globally served with
normal product-root revalidation.

### 9. Keep 127C verification inside 127C ownership

Page Builder and its customer Save/Update wiring belong to 127E. 127C cannot
prove an end-to-end Page Builder journey before that surface exists.

127C should prove:

- authenticated Roma/Tokyo Page storage contracts using controlled submitted
  inputs;
- exact stored strings;
- Publish/Unpublish/Delete;
- public Page/support/locale routes;
- cache and purge behavior;
- the loader;
- the current Widget Copy-code cutover.

127E later proves that Page Builder calls the accepted 127C contract and shows
the shared Page Copy-code UI.

### 10. Make storage-failure wording honest

R2 does not atomically write several object keys. The PRD may say a failed
operation returns failure and creates no candidate/rollback/recovery state. It
must not imply that a physical partial write is impossible under the direct
multi-file model.

Do not add transaction or recovery machinery. The product-owner decision below
must determine whether a published Page can be updated directly under this
constraint.

### 11. Use public-facing locale failure copy

Keep the explicit 404/500 distinction, but do not expose current storage copy
such as “Locale data invalid” on a customer Page. 127C should require normal
visitor-facing Page failure text while logs retain the technical reason.

### 12. Remove repeated exclusion prose

Mama already owns the program exclusions. 127C needs only its slice-specific
boundary: it stores and serves direct files and adds no generator, revision,
package, loader service, or iframe path.

## Product-owner decisions

### Decision 1: updating a published direct-file Page

Direct Page files are separate R2 objects and cannot be replaced atomically.
The current Page product requires Unpublish before Save. 127C currently allows
Save/Update while published.

Choose one:

1. **Require Unpublish before Save/Update.** Simplest and strongest consistency,
   but the Page temporarily goes offline during a customer update.
2. **Allow Save/Update while published.** Better editing UX, but accept that the
   direct multi-file model cannot promise atomic replacement if a write fails.
   The operation reports failure and the customer retries; no rollback or
   package-pointer machinery is added.

The PRD must state the chosen behavior. It cannot promise both continuous live
serving and atomic multi-file replacement while also forbidding a version
pointer.

### Decision 2: deterministic country tie-break

Browser-language matching runs first. If it finds no match, several available
regional locales can share the same Cloudflare country code—for example,
`en-US` and `es-US`.

Choose the deterministic fallback among multiple regional matches. The lean
options are a documented lexical choice or `baseLocale` when it is among the
matches, then lexical choice. Do not add another locale-order registry or Page
field.

## Documentation required after deployment

Name these owners explicitly:

- `documentation/services/tokyo-worker.md` — Page route matrix, exact-locale
  completion, CORS, cache headers, purge coordinates, and `clickeen.js`;
- `documentation/services/roma.md` — Page command contract and shared public
  actions/Copy-code behavior;
- `documentation/engineering/CloudflareOperations.md` — loader source → R2 key
  → route → deploy/verification chain;
- `documentation/architecture/Tenets.md` and `RuntimeProfiles.md` — direct
  Page serving and removal of old package/fingerprint behavior;
- `documentation/architecture/BabelProtocol.md`, localization, SEO/GEO/AEO,
  and `documentation/strategy/Clickeen-Babel.md` — Page locale serving as
  deployed current truth;
- `documentation/engineering/PlaywrightE2E.md` — deployed Page and shared
  installer browser verification.

Do not create a vague new “installation documentation” owner when the existing
Roma, Tokyo, Cloudflare, and browser-verification docs own the behavior.

## V1–V8 assessment

| ID | Result | Reason |
| --- | --- | --- |
| V1 | Open | Locale completeness must prevent silent base-value substitution. |
| V2 | Open | 127C must not require/default 127D's `needsUpdate` field early. |
| V3 | Open | Locale purges, installer route/sync/CORS/relative URLs, and full public-action cutover are underspecified. |
| V4 | Green in direction | Publication and locale serving are fail-closed. |
| V5 | Green in direction | Missing/corrupt locale truth is an explicit failure. |
| V6 | Open | Published multi-file update behavior and physical partial-write semantics require an honest decision. |
| V7 | Green after cutover | Iframe/direct-runtime and obsolete Page delivery paths must be deleted, not wrapped. |
| V8 | Green | Tests verify serving; runtime does not depend on probes or tests. |

## Execution-readiness gate

127C is ready after:

1. the two product-owner decisions are made;
2. the twelve concrete corrections above are incorporated without new
   machinery;
3. the revised PRD names the real code and documentation owners; and
4. a bounded re-review confirms the result against Mama/A/B and V1–V8.
