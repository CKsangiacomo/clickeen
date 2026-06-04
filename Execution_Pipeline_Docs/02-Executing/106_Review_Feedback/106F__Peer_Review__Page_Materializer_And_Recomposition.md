# 106F Peer Review - Page Materializer And Recomposition

Status: Historical review feedback / superseded by `106H__Audit_Refresh_Decision_Log.md` 2026-06-04 system tenets audit
Date: 2026-06-03
Reviewed PRD: `../106F__PRD__Page_Materializer_And_Recomposition.md`

## Review Lens

Page Materializer has one job:

```text
read placed widget packages
write one page package
```

Input:

```text
widget index.html
widget styles.css
widget runtime.js
```

Output:

```text
page index.html
page styles.css
page runtime.js
```

No block renderer. No iframe stack. No request-time assembly. No page-specific widget snapshots. No route activation in this PRD.

## Consolidated Verdict

106F is directionally correct but not execution-ready.

The core product promise is right:

- users edit a widget once;
- every page placing that widget can update;
- Page Materializer composes generated packages, not widget source;
- pages become static page packages that are cheap to serve.

The gaps are hard prerequisites and failure boundaries:

- 106B is not yet a safe package input;
- current widget packages still emit `window.CK_WIDGET`;
- current widget `index.html` does not contain saved first-paint content;
- 106E must provide reverse placement lookup;
- widget save currently does not materialize/recompose;
- page materialization needs package coherence and immutable candidate output;
- recomposition failure ownership is too vague.

## Agent1 - Staff Engineer Review

### Elegant Engineering And Scalability

Good:

- The “widget packages in / page package out” model is exactly the right engineering shape.
- It avoids a second renderer.
- It avoids Page Composer reading private widget source.
- It keeps public serving static.

Blocking gaps:

- Final execution removed Tokyo widget package rendering; saved packages use `CK_WIDGETS[instanceId]`.
- Package bytes are submitted through the Builder/Roma save path; Tokyo validates/stamps/stores them.
- Current save transition must trigger page recomposition from the stored package when the instance is placed.
- Current delete path has no page-placement guard.

### Architecture / Tenet Compliance

Compliant:

- No iframes.
- No full documents pasted together.
- No widget source snapshots.
- No personalization/A-B/test logic.

Not compliant yet:

- 106F must be blocked until 106B proves strict package composition.
- 106F must be blocked until 106E gives page source operations plus reverse placement index.
- Materializer must explicitly forbid reading `instance.config.json`, `instance.content.json`, overlays, widget source files, Bob contracts, route maps, or public serve state.

### Overarchitecture / Gold-Plating Risks

Do not build:

- bundler;
- dependency graph;
- CSS/JS semantic parser;
- renderer framework;
- route resolver;
- health probe subsystem;
- override engine;
- locale strategy;
- personalization system.

V1 dedupe should be exact duplicate shared chunk/import dedupe only where 106B makes that safe.

### Simple / Boring Path

The implementation should be:

```text
load validated page source
load placed widget package files by exact key
parse generated widget index.html
extract exactly one widget fragment
append fragments in placement order
append/dedupe safe CSS chunks
append/dedupe safe runtime chunks
write candidate page index/styles/runtime
record success or failure
```

106G owns making that candidate public.

## Agent2 - Senior PM Review

### Product UX And Scalability

Good:

- This is the product value: edit once, pages update.
- It makes pages fast without users thinking about compilation.
- It preserves widget reuse across single embeds and pages.

UX risks:

- If placed widgets must be standalone-published, users may expose page parts as public widget URLs.
- Standalone publish caps can block page creation if page sections consume published-instance quota.
- Broken recomposition must not break the live page users already published.

### Architecture / Tenet Compliance

Compliant:

- Page Materializer composes generated widget packages.
- It does not reinterpret widget source.
- It does not serve routes.

Needs tightening:

- Decide private composition package vs published-only widget packages.
- Page package should remain non-public until 106G activates route serving.
- Failure must preserve previous active page output.

### Overarchitecture / Complexity

Keep out:

- route activation;
- cache purging;
- domain serving;
- page-level personalization;
- page preview;
- A/B tests;
- source snapshots.

### Simple / Boring Product Path

106F should run after:

1. 106B proves package input.
2. 106E proves page source and placement index.
3. 106F composes packages.
4. 106G serves packages.

## Agent3 - Principal TPM Review

### Cohesive / Cost-Effective Architecture

Good:

- Static page package output is cost-effective.
- No request-time page assembly.
- No iframe performance debt.

P0 operational gaps:

- Recomposition lookup cannot scan R2.
- Widget package reads can race with widget package rewrites.
- Page writes must not overwrite active output until validated.
- Public serving currently reads instance artifacts by object existence, which conflicts with private composition package needs.

### Systems That Talk To Each Other

Needed systems:

- 106E page source and placement index.
- 106B widget package contract with revision/coherence.
- 106F page materializer job/state.
- 106G route activation and cache/public serving.

No additional subsystem is needed.

### SaaS-Grade Technical Bar

At scale:

- use `(accountId, instanceId) -> pageIds` index;
- no account-wide page listing on widget save;
- coalesce repeated recomposition work;
- keep last active page live when recomposition fails;
- store durable failure state;
- use package revision or staging/promotion for coherent reads/writes.

### Recommended Sequence

1. 106B: composable, revisioned widget packages.
2. 106E: Tokyo page operations plus slug and placement indexes.
3. 106F: exact-key materializer and recomposition from indexed dependencies.
4. 106G: public route pointer, cache headers, purge, SEO/GEO serving.

## Consolidated Required PRD Decisions

Before executing 106F, decide:

1. **Hard Package Prerequisite**
   - 106F is blocked until 106B is verified for FAQ, Countdown, and Logo Showcase.
   - Requirements: first-paint saved content, exact fragment root, no `CK_WIDGET`, root-scoped initializer, page-safe CSS/runtime.

2. **Hard Page Source / Index Prerequisite**
   - 106F is blocked until 106E provides Tokyo-owned page operations and reverse placement index.
   - No R2 scans for recomposition.

3. **Composable Package vs Standalone Publish**
   - Decide whether widget packages used by pages are private/non-servable composition packages or published public widget artifacts.
   - Recommended: composition packages can be generated without standalone public serving.
   - If published-only, explicitly accept UX/cap/public-section consequences.

4. **Package Coherence**
   - Add widget package revision/hash or staging-plus-promotion.
   - Page Materializer must not read mixed old/new widget files.

5. **Page Candidate Output**
   - 106F writes immutable candidate output:

```text
accounts/{accountPublicId}/website/publishes/{pageId}/{publishId}/
  index.html
  styles.css
  runtime.js
```

   - 106F does not activate a route.
   - 106G promotes/serves the active route pointer.

6. **Failure State**
   - Tokyo owns page materialization/recomposition status.
   - Failed recomposition records `reasonKey`, `detail`, source revision, widget package revisions, and job id.
   - Published pages keep the last active output live.

7. **Widget Save Hook**
   - On widget save:

```text
save widget source
materialize/refresh widget package
lookup affected pages by placement index
enqueue/coalesce or perform recomposition
record success/failure
```

   - The hook must be Tokyo-owned, not Roma compensation.

8. **Widget Delete Hook**
   - Deleting a placed widget must be blocked or handled by a named page-aware operation.
   - Do not leave stale page references.

9. **Fragment Rules**
   - Extract exactly one `[data-ck-widget][data-ck-instance-id]` root.
   - Zero or multiple roots fail.
   - Extracted fragment must not contain document `<html>`, `<head>`, `<body>`, `<script>`, or stylesheet `<link>`.

10. **Dedupe Scope**
   - Exact duplicate shared chunk/import dedupe only.
   - No semantic JS/CSS dependency analysis.

## Suggested Acceptance Gates

106F should fail if:

- page output does not contain exactly one `index.html`, one `styles.css`, and one `runtime.js`;
- page HTML lacks saved visible widget content before JavaScript;
- output contains `window.CK_WIDGET`;
- output contains iframe-per-widget composition;
- output contains pasted full widget documents;
- two instances of the same widget type do not initialize independently;
- missing widget package files do not fail the materializer;
- invalid fragment shape does not fail fast;
- recomposition uses account-wide R2/page source scans;
- widget save does not refresh package before recomposition;
- recomposition failure overwrites or promotes broken active output;
- public serving/route activation appears in 106F.

## Decision Status

Do not execute 106F as-is.

Keep the core rule: three widget files in, three page files out. But make 106B package readiness, 106E placement indexing, package coherence, and immutable candidate output hard gates. That is what keeps Clickeen Pages simple at scale instead of turning Page Composer into a renderer or recovery system.
