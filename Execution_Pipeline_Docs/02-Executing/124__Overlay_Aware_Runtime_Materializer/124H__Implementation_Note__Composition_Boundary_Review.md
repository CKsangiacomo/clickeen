# 124H Implementation Note - Composition Boundary Review

Status: implemented locally

124H validates future composition boundaries. It does not implement pages,
sites, emails, reports, feeds, crawler artifacts, answer artifacts, apps,
composition registries, or parent artifact materializers.

## Current/Future Boundary

| Layer | Current in PRD 124 | Boundary |
| --- | --- | --- |
| Widget instance source | current | `accounts/{accountPublicId}/instances/{instanceId}/` source and stored package bytes |
| Widget locale package | current | `accounts/{accountPublicId}/instances/{instanceId}/locales/{locale}/` stored package bytes |
| Account page source | current source only | `accounts/{accountPublicId}/pages/{pageId}/source.json` |
| Account page package | not current | publish returns `coreui.errors.page.publishUnavailable` until a future page package writer exists |
| Public page serving | not current | Tokyo-worker parses page URLs but returns `404` |
| Sites/emails/reports/feeds/answer artifacts | not current | future rendered surface PRDs |
| Apps | not current | future schema domain + command authority + integration boundary + agent home + materialized surfaces |

## Current Page Source Truth

Current page source stores widget placements by instance reference:

```json
{
  "placements": [
    {
      "placementId": "P001",
      "instanceId": "ABCD123456"
    }
  ]
}
```

That is page source truth today. 124H does not shift page source to child
artifact references. A future Page Package PRD must decide whether parent
materialization consumes widget source, widget artifact coordinates/evidence, or
another explicit input shape at command time.

Current page publish is intentionally unavailable:

- Roma `POST /api/account/pages/{pageId}/publish` returns
  `coreui.errors.page.publishUnavailable`.
- Tokyo internal page publish returns the same unavailable condition.
- Tokyo `clk.live/{accountPublicId}/pages/{pageId}` public serving returns
  `404`.

## Widget Artifact Reference Contract

Future composers may reference widget artifacts by:

- account public id;
- instance id;
- requested locale when applicable;
- artifact file coordinate;
- generated package fingerprint and evidence.

Future composers must not copy widget source bodies into private parent
documents as source truth. Public URLs are delivery coordinates, not composition
source authority. Future parent materializers should consume child product
coordinates and evidence as explicit command inputs, not scrape public CDN URLs
or fetch child source on visitor requests.

## Future Page Package PRD Requirements

A future Page Package PRD must name:

- page source schema;
- widget placement/layout authority;
- child widget reference input shape;
- parent/child locale rules;
- missing child locale behavior;
- child evidence fields;
- page package materializer owner;
- Roma page command authority;
- Tokyo page package storage coordinate;
- public page URL and CDN behavior;
- cascade behavior when child widget artifacts change;
- failure response shape;
- operator-visible stale, missing, or failed child artifact handling.

No fallback locale is implied by 124H.

## Future Rendered Surface Requirements

Future site, email, report, feed, crawler, and answer artifact PRDs must name:

- source authority;
- schema/token identity;
- child artifact reference model;
- overlay/locale behavior;
- materializer owner;
- storage coordinate;
- serving or delivery coordinate;
- evidence fields;
- command authority;
- cascade law;
- failure response shape;
- operator-visible stale/missing child artifact behavior;
- verification surface.

Delivery-specific work stays with the future surface: site routing/sitemap,
email deliverability, report export/access, feed format/crawl behavior, and
answer-engine citation/update behavior.

## Apps Boundary

Widgets, pages, sites, emails, reports, feeds, and answer artifacts mostly
render truth. Apps operate truth.

The materializer is one substrate capability, not the app substrate. Future
schema-first apps require:

- schema domain;
- source authority;
- command authority;
- integration boundary;
- agent home;
- materialized surfaces.

124H adds no app route, app schema, app database, app agent, or app command.

## Evidence Propagation Rule

Child artifacts carry their own evidence. Future parent artifacts must record
the child coordinates and fingerprints/evidence required by the parent source
contract. Parent artifacts must not copy child source bodies as their own source
truth. Public parent serving must not recompute child evidence on visitor
requests.

Parent/child evidence mismatch handling belongs to the future owning surface
PRD.

## Future PRD Map

- Page Package Materializer PRD;
- Page Locale Artifact PRD;
- Page Public Serving/CDN PRD;
- Page Child-Widget Cascade PRD;
- Site Composition PRD;
- Email Artifact Materializer PRD;
- Report/Feed/Answer Artifact PRDs;
- Schema-First App Substrate PRDs by domain.

This map is not an execution authorization or dependency registry.

## Verification

124H verification is documentation and code inventory:

```bash
rg -n "page|pages|publishUnavailable|source.json|serve-state|page package|public page" roma/app roma/lib tokyo-worker/src documentation/services/roma.md documentation/services/tokyo-worker.md documentation/architecture/RuntimeProfiles.md
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/tokyo-worker typecheck
pnpm typecheck
git diff --check
```

No runtime code was added for page/site/email/app composition in 124H.

## V1-V8 Audit

| ID | Result |
| --- | --- |
| V1 Silent substitution | Pass: no future composition source is invented as current truth. |
| V2 Silent healing | Pass: no page/source state repair added. |
| V3 Silent omission | Pass: current/future boundaries and future PRD requirements are explicit. |
| V4 Fail-open control | Pass: current page publish remains unavailable. |
| V5 Corruption-as-absence | Pass: no corrupt parent/child state fallback added. |
| V6 Partial-success masquerade | Pass: 124H does not claim pages/apps are implemented. |
| V7 Masquerade/redress | Pass: no composition registry, runtime fetch, or wrapper subsystem added. |
| V8 Runtime test dependency | Pass: inventory checks do not become product runtime truth. |
