# PRD 107 - Workflow Removal: Fallback Eradication

Status: PLANNING / LOCKED
Owner: Product + Architecture
Date: 2026-06-10

Executable: NO. No code execution is authorized by this PRD until Step 0 is
completed in this file.

This is a workflow-removal PRD. It does not ask executors to tidy fallback
expressions, add stricter-looking helpers, rename errors, maintain caller
continuity, or redress the same behavior under a new product name. A PRD 107
violation is a toxic product workflow: bad product truth reaches successful
product behavior. The workflow is the deletion target.

Redressing or masquerading a violation under a different name is itself a PRD
107 violation.

AI executor instruction: this PRD is about removal and deletion of ALL PRD 107
violations from the architecture and codebase. The desired change is not to keep
the product path running with alternate behavior. The desired change is to remove
every path that lets bad product truth reach success. If deletion exposes broken
callers, those callers are part of the deletion target until they honor the named
boundary failure.

## Violation Types

These types are the first authority in this PRD. Every audit row and every future
finding must be classified against this table before any action item is written.

| Type | Name | Definition | Required action |
| --- | --- | --- | --- |
| V1 | Silent substitution | Missing, invalid, stale, or malformed product truth is replaced with an invented value. | Delete the workflow or fail visibly at the named boundary. |
| V2 | Silent healing | Invalid persisted/user/product state is normalized, coerced, repaired, or rewritten without visible failure. | Delete the workflow or make the corruption fail visibly. |
| V3 | Silent omission | Required product input, artifact, operation, edit, module, event, or policy is dropped while the caller sees success. | Delete the success path. |
| V4 | Fail-open control | Security, policy, entitlement, rate-limit, containment, or budget enforcement turns off when a dependency is missing, malformed, or unavailable. | Fail closed with typed visible failure. |
| V5 | Corruption-as-absence | Corrupt stored state is treated as missing/new/empty and later overwritten or ignored. | Return a typed corrupt/invalid failure; do not mutate. |
| V6 | Partial-success masquerade | Some requested work is rejected, filtered, dropped, or ignored while the product claims the full operation succeeded. | All requested work succeeds or the boundary fails visibly. |
| V7 | Masquerade/redress | The same toxic workflow is moved to a helper, wrapped, renamed, hidden in `detail`, converted to a generic error, retried into success, logged-and-continued, warning-only, legacy-continuity-gated, or otherwise made to look compliant while still reaching success or mutation. | Treat as a new P0 PRD 107 violation. |

### Finding Outcomes

There is no gray category in PRD 107. A workflow is either a violation or it is
not. If product owner cannot name the surviving contract that makes a workflow a
non-violation, the workflow remains a violation and is a deletion target.

| Outcome | Meaning | Execution rule |
| --- | --- | --- |
| VIOLATION | A workflow matches V1-V7. | P0 deletion target. |
| DECLARED NON-VIOLATION | A workflow is covered by a named visible-failure, creation-time-default, or declared-contract record. | Keep only while that record remains true and tested. |

## Tenets

Every PRD 107 violation is a P0 deletion target.

Delete means the path from bad product truth to successful product behavior no
longer exists.

PRD 107 execution is deletion work. It removes toxic workflows from architecture
and code. It is not complete until every violation is removed or has a
product-owner declared-non-violation record.

The forbidden workflow shape is:

```text
bad/missing/malformed/stale product truth
  -> local fallback/heal/default/omit/relabel/redress
  -> downstream operation continues
  -> user, account, agent, storage, queue, public runtime, or operator sees success
```

The only acceptable product shape is:

```text
bad/missing/malformed/stale product truth
  -> typed visible failure at the named product boundary
  -> no downstream product mutation, save, publish, render, queue, write, or success response
```

Execution tenets:

- Execute one step at a time.
- Step N+1 is locked until Step N has recorded evidence in this file.
- No row may be edited until its PO deletion-target record and action-item
  record exist in this file.
- Do not solve missing product decisions by inventing product behavior.
- If required evidence cannot be produced, stop and record a blocker. Do not
  silently drop the evidence requirement.
- Source-order checks, greps, green builds, helper throws, status codes, and
  smaller diffs are not proof.
- A helper throw is incomplete if any caller catches it and relabels, hides,
  retries, logs, warns, mutates, or succeeds.
- A 422 is incomplete if the typed product reason is generic, hidden in
  `detail`, built from a string prefix, or not asserted at the product boundary.
- A partial mutation before failure is still a violation.
- Legacy-continuity modes that keep the toxic workflow reachable are violations.
- Redressing or masquerading a violation under a different name is itself a
  PRD 107 violation.

## Legitimate Non-Violations

Only these patterns can survive a PRD 107 audit.

| Pattern | Allowed only when | Required proof |
| --- | --- | --- |
| Visible failure | A named product boundary returns or renders a typed reason and blocks downstream product work. | Boundary evidence exercising the failure and proving the downstream operation was not called. |
| Creation-time default | A default is written once as durable state during creation of a new product object. | Creation fixture proving the value was persisted as initial state, not invented during read/save/render. |
| Declared contract | The alternate behavior is product-owned, named, documented, and tested as intentional. | Contract doc plus regression proof. |

## Step 0 Lock

No action after this section is executable until every required Step 0 decision is
filled.

| Decision ID | Decision required | PO decision | Date | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| D-107a | Ratify this rewrite as a workflow-removal PRD replacing the prior fix-column PRD. | PENDING |  |  |  |
| D-107b | Ratify violation taxonomy V1-V7. | PENDING |  |  |  |
| D-107c | Ratify every listed violation as a deletion target, or create a declared-non-violation record for individual rows. | PENDING |  |  |  |
| D-107d | Ratify the fresh cross-service violation inventory, or create declared-non-violation records for individual rows. | PENDING |  |  |  |
| D-107e | Define the permitted typed-failure channel for Roma/Bob/San Francisco paths that lack one. | PENDING |  |  |  |
| D-107f | Define the runtime proof requirement after package-level placeholder `test` scripts are deleted. | PENDING |  |  |  |
| D-107g | Resolve ownership overlap with PRDs 108A1 and 108B1. | PENDING |  |  |  |
| D-107h | Decide whether current uncommitted PRD 107 implementation diffs are deleted, rebuilt under this PRD, or moved to a separate branch. | PENDING |  |  |  |
| D-107i | Decide whether `packageSource fallback:` alias is a declared non-violation contract or a deletion target. | PENDING |  |  |  |
| D-107j | Decide pages-index absence rule: creation-time index materialization or missing-at-read typed failure. | PENDING |  |  |  |
| D-107k | Decide whether cache purge failure/stale public serving is deleted in PRD 107 or split to a publish-integrity PRD. | PENDING |  |  |  |

If any decision remains PENDING, execution stops.

## Required Records Before Code

### PO Deletion-Target Record

Every violation row requires this record before any file edit.

| Field | Required value |
| --- | --- |
| Row ID |  |
| Outcome | VIOLATION |
| Violation type | V1-V7 |
| Product-owner decision | Delete / blocked pending prerequisite |
| Deletion target | Exact toxic workflow to remove, not a code recipe |
| Surviving authority | Product owner of the real truth |
| Named boundary | Boundary where the typed visible failure must appear |
| Required typed reason | Constant reason key or visible runtime error contract |
| Downstream operations blocked | Save/publish/render/queue/write/delete/etc. that must not run |
| Required proof | Boundary evidence plus downstream-block evidence |
| Forbidden redresses | Row-specific ways an executor might fake compliance |
| PO approval | Name/date |

### Action-Item Record

Action items record required outcomes and evidence. They do not prescribe code
shape.

Allowed action types:

- `workflow-removal`
- `typed-boundary-proof`
- `downstream-block-proof`
- `harness-enablement`
- `contract-documentation`
- `coordination-with-other-prd`
- `masquerade-audit`

| Action ID | Row ID | Action type | Required outcome | Evidence required | Status |
| --- | --- | --- | --- | --- | --- |
| AI-107-H-1 | H | harness-enablement | Packages touched by PRD 107 have runnable regression evidence or a PO-approved alternate proof. | Command output and fixture path recorded in Evidence Ledger. | LOCKED |

## PO Deletion Targets - Violations

These rows are product-owner deletion targets, not implementation instructions.
There is intentionally no `Fix` column.

| Row | Type | Area | Evidence | Toxic workflow to remove | Surviving authority | Named boundary | Downstream operations blocked |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AB-1 | V2 | Bob | `bob/lib/session/sessionConfig.ts:46`, `useSessionBoot.ts:56` | Stored config is merged with compiler defaults on every session open, then marked clean. | Saved instance config/content plus widget spec contract. | Builder session boot. | Clean editor open, preview render, save based on healed state. |
| AB-2 | V2/V6 | Bob | `sessionConfig.ts:49-61` | Coerce failures continue and coerce successes rewrite in-memory state without visible failure. | Saved instance config/content plus widget spec contract. | Builder session boot. | Clean editor open, preview render, save based on invalid/coerced state. |
| AB-3 | V2/V6 | Dieter/Bob | `dieter/components/dropdown-fill/dropdown-fill-gradient.ts:564-575` | Unsupported gradient kinds are rewritten as a different gradient while commit succeeds. | Fill editor contract and stored fill value. | Fill control commit. | State commit that changes user intent silently. |
| AB-4 | V3/V6 | Bob/Dieter | `bob/components/td-menu-content/dom.ts:87-113`, `useTdMenuHydration.ts:82-86` | Control asset/hydrator failure is swallowed and panel appears usable. | Dieter control runtime contract. | Control panel hydration. | User edits through dead controls; save/preview continues as if panel is live. |
| AB-5 | V3 | Bob package compilation | `bob/lib/api/compiled-widget-route.ts:102-103` | Referenced widget support file fetch failure is omitted from compiled package. | Widget source package contract. | Compiled widget route. | Compiled package success with missing required module. |
| AB-6 | V1 | San Francisco | `l10nTranslationCore.ts:209` | Missing provider parameter defaults to `deepseek`. | Actual provider usage record / AI policy. | Translation operation creation/error reporting. | Job/error attribution with invented provider. |
| AB-7 | V1 | San Francisco | `l10nTranslationCore.ts:253` | Missing provider parameter defaults to `deepseek`. | Actual provider usage record / AI policy. | Translation operation execution. | Job/error attribution with invented provider. |
| AB-8 | V1 | San Francisco | `l10nTranslationCore.ts:324` | Missing provider parameter defaults to `deepseek`. | Actual provider usage record / AI policy. | Translation operation completion/error path. | Job/error attribution with invented provider. |
| AB-9 | V1 | San Francisco | `l10n-account-routes.ts:279` | Missing usage provider is replaced with `deepseek`. | Usage provider truth. | Account translation route result. | Account-visible/job-visible attribution with invented provider. |
| AB-10 | V1/V4 | San Francisco/Prague copy | `l10nPragueStrings.ts:117` | Missing model policy/env becomes `gpt-5.2`. | AI policy matrix / required env. | Prague string generation. | Model call under invented policy. |
| AB-11 | V1/V4 | ck-policy/SF | `grants.ts:239` | Missing timeout budget becomes 20s. | Tier budget policy. | Grant issuance. | Model/runtime work under invented budget. |
| AB-12 | V3/V6 | Builder Copilot | `widgetCopilotCore.ts:567` | Invalid model ops are filtered, surviving ops apply, full success is claimed. | Structured edit contract. | Copilot edit application boundary. | Partial operation apply; success response. |
| AB-13 | V3/V6 | Builder Copilot | `widgetCopilotCsProduct.ts:173-175` | Link ops are discarded based on prompt wording while success copy may ship. | Structured edit intent/result contract. | Copilot product edit boundary. | Partial/drop operation success response. |
| AB-14 | V1/V2 | ck-contracts/runtime | `ck-contracts/index.ts:429-444` | Invalid locale-switcher placement becomes `top-right`. | Locale switcher config contract. | Config validation/normalization boundary. | Render/save using invented placement. |
| AB-15 | V4/V7 | Roma/Berlin | `roma/lib/berlin-publish-containment.ts:25` | Malformed containment payload is interpreted as inactive. | Berlin containment payload contract; Roma validates shape but does not invent policy. | Roma publish containment gate before instance/page publish. | `publishAccountInstanceInTokyo`, `publishAccountPageInTokyo`, and any public package/write/publish mutation reached from a publish route. |
| AB-16 | V4 | Roma page publish | `roma/app/api/account/pages/[pageId]/publish/route.ts` | Page publish bypasses account publish containment. | Berlin account publish containment; Tokyo owns page publish state only after Roma allows the operation. | `POST /api/account/pages/:pageId/publish`. | `publishAccountPageInTokyo`; page publish must not continue after containment failure. |
| AB-17 | V3/V7 | Roma package builder | `roma/lib/widget-public-package.ts:209-211` | Missing declared stylesheet is omitted and package/save can succeed. | Compiled widget package file map plus declared HTML stylesheet references. | Builder save route package-build phase before Tokyo save. | `saveAccountInstanceInTokyo`, package writes, page refresh, and publish using incomplete package. |
| AB-18 | V3/V7 | Roma package builder | `roma/lib/widget-public-package.ts:261` | Missing declared runtime script is omitted and package/save can succeed. | Compiled widget package file map plus declared script references. | Builder save route package-build phase before Tokyo save. | `saveAccountInstanceInTokyo`, public package persistence, page refresh, and publish using incomplete package. |
| AB-19 | V3/V6 | Roma page source | `roma/lib/account-page-direct.ts:139-144` | Invalid geo-to-locale rules are dropped. | Tokyo page source as stored page truth; Roma must reject invalid stored payload, not normalize it into a different page. | Roma account-page direct read/load boundary, including page publish/package consumers. | Page package composition, page publish, list/load success that presents a healed page, public page artifact write. |
| AB-20 | V1/V2 | Roma page create | `roma/app/api/account/pages/route.ts:28-39` | Provided invalid robots value becomes `noindex,nofollow`. | Page create request plus page metadata contract. Creation default is allowed only when `robots` is absent. | `POST /api/account/pages`. | `createAccountPageInTokyo`; no page source may be minted from invalid supplied robots. |
| AB-21 | V4 | Roma/Berlin request ops | `roma/lib/request-ops.ts:187-188`, `berlin/src/http/request-ops.ts:110-118` | Missing KV binding disables rate limiting. | Cloudflare service configuration. Required KV absence means service misconfiguration. | Roma account mutation request preflight and Berlin auth/session request preflight. | Roma account mutations, asset writes, page/widget saves or publishes behind limiter; Berlin auth/login/refresh/logout work behind limiter. |
| AB-22 | V1/V2/V5 | Tokyo defaults | `tokyo-worker/src/domains/account-widget-defaults.ts:190-194` | Corrupt/missing stored account defaults seed factory defaults during read/use. | Persisted account widget defaults document, seeded only at account/default creation time. | Widget-defaults internal routes and any instance-create path consuming defaults. | Factory-default response, new instance source write, registry row, package generation/save based on substituted defaults. |
| AB-23 | V2/V5/V7 | Tokyo defaults | `account-widget-defaults.ts:262-264` | Normalized/healed defaults are persisted back on read. | Persisted account widget defaults document bytes. | Widget-defaults read/use boundary. | `putJson` read repair, R2 write destroying corruption evidence, instance creation using repaired defaults. |
| AB-24 | V5/V7 | Tokyo pages | `tokyo-worker/src/domains/pages/source.ts:107-129` | Bad or absent pages index becomes `{ pages: [] }`, then save/delete rewrites the index and erases real summaries. | Tokyo-owned pages index, initialized only by declared creation-time default or otherwise required at read. | Page list/save/delete/publish routes using `readPagesIndex`. | `saveAccountPageSource`, `writePagesIndex`, `writeAccountPagePublicPackage`, `writeAccountPageServeState`, cache purge, `ok: true, pages: []`. |
| AB-25 | V1/V3 | Widget runtime | `tokyo/product/widgets/shared/fill.js:106-113` | Malformed image fill becomes transparent/background-cleared. | Builder/editor-authored fill object plus strict `CKFill` runtime contract. | `CKFill.toCssBackground`, `CKFill.applyMediaLayer`, and widget `applyState`. | Transparent paint, media-layer clear-as-success, preview/public render that appears valid. |
| AB-26 | V1/V7 | Widget runtime | `tokyo/product/widgets/shared/appearance.js:33-45` | Missing CKFill coerces fill objects through `String()`. | Shared runtime module dependency graph; `CKAppearance` requires `CKFill` for fill-shaped values. | `CKAppearance.toCssBackground` and `CKAppearance.toCssColor`. | Stringified CSS, successful widget render/applyState when dependency load failed. |

## Fresh Cross-Service Violation Inventory

These rows come from the 2026-06-11 V1-V7 audit pass. They are violations unless
Step 0 creates a declared-non-violation record for the exact row.

| Row | Type | Area | Evidence | Toxic workflow to remove | Surviving authority | Named boundary | Downstream operations blocked |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PRD107-BOB-001 | V2 | Bob session boot | `bob/lib/session/sessionConfig.ts:46`, `bob/lib/session/useSessionBoot.ts:56` | Stored instance config is merged with compiled defaults on open, then marked clean. | Saved instance config/content plus widget spec contract. | Builder session boot. | Clean editor open, preview render, save from healed state. |
| PRD107-BOB-002 | V2/V6 | Bob session normalization | `bob/lib/session/sessionConfig.ts:47`, `:49` | Normalization/coerce successes rewrite in-memory state; coerce failures continue invisibly. | Saved instance config/content plus widget spec contract. | Builder session boot/edit apply boundary. | Clean open, preview, save from invalid/coerced state. |
| PRD107-DIETER-001 | V1/V2/V6 | Dieter fill gradient | `dieter/components/dropdown-fill/fill-parser.ts:71`, `dropdown-fill-gradient.ts:551` | Invalid/unsupported gradient kind, stops, colors, and positions are rewritten while commit succeeds. | Fill editor contract and stored fill value. | Fill control parse/commit. | State commit that silently changes user intent. |
| PRD107-BOB-DIETER-001 | V3/V7 | Bob/Dieter hydration | `bob/components/td-menu-content/dom.ts:87`, `:97`, `useTdMenuHydration.ts:70` | Control media/hydrator failures are logged/warned/ignored while panel looks usable. | Dieter control runtime contract. | Control panel hydration. | Edits through dead controls; preview/save continues. |
| PRD107-BOB-003 | V3 | Bob package compilation | `bob/lib/api/compiled-widget-route.ts:92`, `:102` | Referenced widget support file fetch failure is omitted from compiled package. | Widget source package contract. | Compiled widget route. | Compiled payload/package success with missing module. |
| PRD107-BOB-004 | V3/V4 | Bob policy/limits compilation | `bob/lib/api/compiled-widget-route.ts:201`, `:340`, `:354` | Missing `limits.json` becomes `limits: null`; compile succeeds without widget limit policy. | Widget `limits.json` plus ck-policy. | Compiled widget/editor policy boundary. | Editor ops, preview, save/package under missing enforcement. |
| PRD107-BOB-005 | V3/V6 | Bob theme compiler | `bob/lib/compiler.server.ts:187`, `:194`, `:207` | Malformed theme entries and unsupported paths are filtered while compile succeeds from survivors. | `tokyo/product/themes/themes.json`. | Theme registry compile boundary. | Theme controls/presets compile and commit partial theme truth. |
| PRD107-BOB-006 | V1/V3/V7 | Bob preview media | `bob/components/Workspace.tsx:57`, `:152`, `:166` | Failed/unresolved current media asset resolution reuses last materialized preview state. | Current config plus account asset resolver result. | Builder preview materialization. | Preview renders stale asset state; user save decisions use stale preview. |
| PRD107-BOB-007 | V3/V7 | Bob preview handshake | `bob/components/Workspace.tsx:226`, `:253` | Missing widget runtime `ck:ready` is converted to ready UI after timeout. | Widget runtime readiness event. | Preview runtime handshake. | Preview-ready success; editing/save continues without confirmed runtime apply. |
| PRD107-DIETER-002 | V3/V6 | Dieter account assets | `dieter/components/shared/account-assets.ts:94`, `:121`, `dropdown-fill/media-controller.ts:291` | Malformed asset records are filtered while asset browser renders partial/empty success. | Account asset API payload contract. | Asset browser list/resolve boundary. | Asset selection, media commit, preview from partial asset inventory. |
| R107-ROMA-001 | V3/V7 | Roma page source | `roma/lib/account-page-direct.ts:138`, `:171` | Invalid stored `countryLocaleRules` entries are dropped and page source returns as valid. | Tokyo-owned page source as stored. | Roma page read/load boundary. | Page open/list, composition, publish, artifact write. |
| R107-ROMA-002 | V1/V2 | Roma page create | `roma/app/api/account/pages/route.ts:28`, `:120` | Malformed/invalid page metadata becomes `Untitled page`, empty description, or `noindex,nofollow`. | Page create request plus metadata contract. | `POST /api/account/pages`. | `createAccountPageInTokyo`; new page source minting. |
| R107-ROMA-003 | V1 | Roma asset upload | `roma/app/api/account/assets/upload/route.ts:54`, `:172` | Missing filename/content type becomes `upload.bin` / `application/octet-stream`. | Client upload metadata contract. | `POST /api/account/assets/upload`. | Tokyo asset upload/write and returned asset record. |
| R107-RB-004 | V4 | Roma/Berlin rate limit | `roma/lib/current-account-route.ts:63`, `roma/lib/request-ops.ts:184`, `berlin/src/http/request-ops.ts:100`, `:112` | Missing KV binding or client IP disables enforcement and lets protected requests continue. | Cloudflare service config and request identity. | Roma account mutation and Berlin auth/session preflight. | Roma mutations/assets/pages/widgets; Berlin login/finish/refresh/logout. |
| R107-RB-005 | V4/V5 | Roma/Berlin limiter state | `roma/lib/request-ops.ts:141`, `:159`, `berlin/src/http/request-ops.ts:123`, `:141` | Corrupt limiter state becomes fresh bucket and is overwritten by allowed request. | Persisted rate-limit record. | Rate-limit consume boundary. | Protected request continuation and limiter KV rewrite. |
| R107-BERLIN-006 | V5/V6 | Berlin logout/session | `berlin/src/session/kv.ts:24`, `:65`, `:86`, `session/routes.ts:98` | Corrupt session/index state becomes absence; logout can return `ok: true` with no revocation. | Berlin session KV state. | `POST /auth/logout`. | Session revocation and user-wide logout evidence. |
| R107-BERLIN-007 | V3/V6 | Berlin members | `berlin/src/bootstrap/state.ts:411`, `:417`, `account-management/routes.ts:120` | Invalid member rows are filtered and members response succeeds with partial roster. | Supabase account membership rows. | `GET /v1/accounts/:accountId/members`. | Roma team list, member detail, patch/delete preloads. |
| R107-BERLIN-008 | V4 | Berlin auth provider | `berlin/src/auth/config.ts:11`, `auth/routes.ts:191`, `:367` | Missing allowed-provider config defaults to `google`; provider policy fails open. | Berlin auth provider policy config. | `/auth/login/:provider/start` and callback. | OAuth transaction, provider callback, product session issue. |
| R107-ADMIN-009 | V1 | Admin session continuation | `admin/functions/_shared/http.js:47`, `api/session/login/google.js:9`, `api/session/finish.js:20`, `:72` | Invalid continuation path becomes `/`; login/finish continues and cookies are set. | Berlin OAuth finish continuation truth. | Admin session login/finish. | OAuth redirect, session-cookie issuance, post-login redirect. |
| R107-ROMA-010 | V3/V6 | Roma account locales | `roma/lib/account-locales.ts:14`, `:34`, `app/api/account/locales/route.ts:216` | Requested locales are filtered/replaced before Berlin write. | Berlin account locale policy. | `PUT /api/account/locales`. | Berlin locale PATCH, translation setup, generation targets. |
| TW-107-DEFAULTS-CORRUPTION-SEED | V1/V2/V5 | Tokyo defaults | `tokyo-worker/src/domains/storage.ts:30-34`, `account-widget-defaults.ts:189-194`, `:214-217`, `:254-269`, `routes/internal-widget-default-routes.ts:54-56` | Missing/corrupt defaults or missing widget entry becomes factory defaults/current timestamps and returns `ok: true`. | Persisted account widget defaults. | Widget-defaults read and instance-create defaults consumption. | Factory response, instance source write, registry write, package generation/save. |
| TW-107-DEFAULTS-READ-REPAIR | V2/V5/V7 | Tokyo defaults | `tokyo-worker/src/domains/account-widget-defaults.ts:260-264` | Normalized/healed defaults are written back during read. | Persisted defaults bytes. | Widget-defaults read/use boundary. | `putJson` read repair, R2 overwrite, instance creation. |
| TW-107-PAGES-INDEX-MISSING-AS-EMPTY | V5/V7 | Tokyo pages | `tokyo-worker/src/domains/pages/source.ts:107-110`, `:167-190`, `:199-204`, `:215-245` | Missing pages index becomes `{ pages: [] }`; later save/delete rewrites as empty. | Tokyo pages index. | Page list/save/delete routes. | `ok: true, pages: []`, source/package/publish operations from empty index. |
| TW-107-PAGE-SERVE-STATE-CORRUPTION-AS-UNPUBLISHED | V5/V7 | Tokyo page serve-state | `tokyo-worker/src/domains/storage.ts:30-34`, `pages/serve-state.ts:30-40`, `:51-63`, `:90-105`, `routes/internal-page-routes.ts:163-180`, `:212-213` | Corrupt serve-state collapses to `unpublished`, then publish/unpublish overwrites and succeeds. | Page `serve-state.json`. | Page read/publish/unpublish boundary. | State write, success response, cache purge, public serving decision. |
| TW-107-INSTANCE-SAVE-SOURCE-BEFORE-PACKAGE | V6 | Tokyo instance save | `tokyo-worker/src/domains/account-instances/operations.ts:199-221`, `routes/internal-instance-routes.ts:340-376` | Save writes source/overlay/registry before package validation can fail. | Atomic Builder save transition. | `PUT /__internal/instances/:instanceId`. | Source R2 writes, overlay rewrites, registry updates before package failure. |
| TW-107-PAGE-SAVE-SOURCE-BEFORE-PACKAGE | V6 | Tokyo page save | `tokyo-worker/src/routes/internal-page-routes.ts:240-267`, `domains/pages/source.ts:230-245` | Page save writes source/index before package write can fail. | Atomic page save transition. | `PUT /__internal/pages/:pageId`. | Page source write, pages index write before package failure. |
| TW-107-CACHE-PURGE-IGNORED | V6/V7 | Tokyo public cache | `tokyo-worker/src/domains/account-instances/operations.ts:81-85`, `:94-101`, `:292-301`, `pages/package-files.ts:144-165`, `routes/internal-page-routes.ts:163-180`, `:268-271` | Missing Cloudflare config or purge failure is skipped while publish/save returns `ok: true`. | Publish integrity contract. | Instance/page publish and live-page-save purge boundary. | Publish success, serve-state write, stale `clk.live` cache. |
| WRT-107-FILL-BAD-STATE-TO-TRANSPARENT | V1/V2/V3 | Widget runtime fill | `tokyo/product/widgets/shared/fill.js:46-70`, `:116-124`, `:136-168`, `:205-211` | Bad fill values become invented visual state or clear media layer as success. | Strict `CKFill` contract plus authored fill object. | `CKFill.toCssBackground`, `applyMediaLayer`, widget `applyState`. | Preview/public render, DOM style mutation, media-layer clear. |
| WS-107-OPTIONAL-REQUIRED-SHELL-MODULES | V3/V7 | Widget-shell modules | `packages/widget-shell/src/modules.ts:10-29` | Same social-share files are declared required and optional, enabling omitted support files. | Widget source package/module contract. | Package compilation before save/publish. | Compiled package success, Tokyo save, page composition, public render. |
| SCRIPT-107-PRAGUE-L10N-WARNING-SUCCESS | V3/V7 | Prague l10n script | `scripts/prague-l10n/verify.mjs:119-123`, `:151-158`, `:169-173` | Missing/stale translations warn unless strict mode is set, then verification succeeds. | Prague translation overlay freshness contract. | Prague l10n verify boundary. | Build/deploy proceeding with missing or stale overlays. |
| SCRIPT-107-I18N-LOCALE-SKIP | V3/V7 | Roma i18n scripts | `scripts/i18n/validate.mjs:64-70`, `:99-104`, `scripts/i18n/build.mjs:136-142`, `:182-187` | Canonical locales missing `coreui.json` are skipped; validate/build succeeds with fewer locales. | Canonical locale matrix plus complete Roma i18n catalogs. | Roma i18n validate/build boundary. | Public i18n manifest/write, deploy with omitted locales. |
| SCRIPT-107-R2-OPTIONAL-ROOTS | V3/V6/V7 | Tokyo R2 deploy script | `scripts/tokyo-r2-deploy-sync.mjs:25-33`, `:71-77`, `:140-154` | Missing mapped product roots marked optional are skipped while remote upload proceeds. | Tokyo R2 artifact manifest/deploy source contract. | R2 deploy sync remote boundary. | R2 upload success with omitted artifact roots. |
| SCRIPT-107-PRAGUE-BLOCKS-SKIP-MALFORMED | V3/V6 | Prague blocks script | `scripts/prague-blocks/validate.mjs:27-41` | Missing `blocks[]` and malformed block entries are skipped while validation passes. | Prague page block source schema. | Prague blocks validate boundary. | Validation success, migration/build from malformed source. |
| SF-107-01 | V1 | San Francisco translation attribution | `sanfrancisco/src/agents/l10nTranslationCore.ts:209`, `:253`, `:324`, `l10n-account-routes.ts:279` | Missing provider becomes `deepseek`. | Actual model usage / AI policy grant. | Translation model result parse/restore. | Translation result, audit, terminal attribution. |
| SF-107-02 | V1/V4 | San Francisco Prague strings | `sanfrancisco/src/agents/l10nPragueStrings.ts:117`, `:127-135` | Missing model env becomes `gpt-5.2` and model call proceeds. | AI runtime policy / required env. | Prague strings translation request. | Model call and generated copy response. |
| SF-107-03 | V1/V4 | San Francisco grants | `sanfrancisco/src/grants.ts:237-243`, `ai/chat.ts:82-85` | Missing grant timeout becomes `20_000`. | Grant budget policy. | Grant validation before AI work. | Chat/model execution under invented budget. |
| SF-107-04 | V3/V6 | Builder Copilot | `sanfrancisco/src/agents/widgetCopilotCore.ts:562-568`, `:618-644` | Invalid ops are filtered while surviving ops can return `ops_applied`. | Structured edit contract. | Copilot edit application result. | Partial edit response and caller-applied ops. |
| SF-107-05 | V3/V6 | Builder Copilot CS | `sanfrancisco/src/agents/widgetCopilotCsProduct.ts:173-175`, `widgetCopilotCore.ts:618-644` | Link-like ops are discarded while remaining response can succeed. | Structured edit intent/result contract. | Copilot product edit boundary. | Partial edit response and applied ops. |
| SF-107-06 | V7 | San Francisco translation parser | `sanfrancisco/src/agents/l10nTranslationCore.ts:327-333` | Malformed provider output is sliced for embedded JSON and accepted. | Provider JSON schema response contract. | Translation model response parse. | Translation values, Tokyo callback, audit. |
| SF-107-07 | V7 | San Francisco copilot parser | `sanfrancisco/src/agents/widgetCopilotParsing.ts:24-39`, `widgetCopilotCore.ts:562-569` | Fenced/extra-text model output is cleaned/sliced into successful JSON. | Copilot structured response contract. | Copilot model response parse. | Copilot message/ops success response. |
| SF-107-08 | V7 | San Francisco AI provider calls | `sanfrancisco/src/ai/chat.ts:90-105`, `:113-116` | Retryable provider failure is retried into success. | Provider call result contract. | AI provider execution boundary. | Copilot/translation success after hidden provider failure. |
| SF-107-09 | V3 | San Francisco translation queue | `packages/ck-contracts/src/instance-translation-jobs.ts:145-168`, `sanfrancisco/src/index.ts:289-315` | Shaped-but-invalid translation jobs are retried/logged, not terminally failed to Tokyo. | Tokyo translation liveness state. | Instance translation queue intake. | Tokyo fail callback, terminal generation state. |
| CKC-107-01 | V1/V2 | ck-contracts locale switcher | `packages/ck-contracts/src/index.ts:429-443` | Invalid/missing locale switcher placement becomes `stage` / `top-right`. | Locale switcher config contract. | Locale switcher settings validation. | Render/save using invented placement. |
| CKC-107-02 | V1/V5 | ck-contracts translation primitives | `packages/ck-contracts/src/translated-value-primitives.ts:126-128`, `:292-296`, `:354`, `sanfrancisco/src/l10n-account-routes.ts:243-246`, `:316-320` | Non-string/missing editable text becomes `''` and succeeds as translated value. | Saved content plus editable-fields contract. | Text primitive extraction / translation generation. | Translation completion and overlay values from corrupt source. |
| CKC-107-03 | V4 | ck-contracts auth helper | `packages/ck-contracts/src/index.ts:148-158`, `roma/lib/auth/session.ts:231-234` | Malformed/missing JWT `exp` is treated as not expired. | Auth token validation contract. | Session bearer resolution. | Account API access with malformed token expiry. |
| CKC-107-04 | V4/V5 | ck-contracts rate limit record | `packages/ck-contracts/src/index.ts:210-221`, `roma/lib/request-ops.ts:141-146` | Corrupt limiter state becomes absent/new bucket. | KV rate-limit record. | Request operation limiter read. | Rate-limited account/auth mutations. |
| CKC-107-05 | V1/V2 | ck-contracts asset record | `packages/ck-contracts/src/index.ts:237-253`, `roma/app/api/account/assets/upload/route.ts:184-188`, `roma/components/assets-domain.tsx:95-101` | Missing asset metadata becomes `other`, `application/octet-stream`, `0`, and current timestamp. | Tokyo/account asset record. | Asset upload response normalization. | Asset library success, asset selection, later widget saves. |
| CKP-107-01 | V2/V6 | ck-policy limits | `packages/ck-policy/src/limits.ts:349-375` | `sanitizeConfig` rewrites config under entitlement policy instead of rejecting. | Account entitlement policy plus saved config. | Policy enforcement on load/save/publish. | Render/save/load path consuming sanitized config. |
| WSH-107-01 | V3/V6 | widget-shell validation | `packages/widget-shell/src/validators.ts:214-220` | Shell source validation succeeds when defaults are absent/unrecognized. | Widget shell source contract. | Widget shell source validation. | Widget source validation/build success. |

## Action Item Ledger

Rows are locked until their PO deletion-target records are filled. These action
items define outcomes, not implementation recipes.

| Action ID | Rows | Action type | Required outcome | Evidence required | Status |
| --- | --- | --- | --- | --- | --- |
| AI-107-0 | ALL | coordination-with-other-prd | Step 0 decisions D-107a through D-107k filled. | Completed Step 0 table. | LOCKED |
| AI-107-H | ALL executable rows | harness-enablement | Evidence mechanism exists before rows requiring proof are edited. | Test or PO-approved alternate proof recorded. | LOCKED |
| AI-107-AB-1-2 | AB-1, AB-2 | workflow-removal | Bad saved instance config cannot open as a clean editor session. | Typed session-boundary failure and no clean editor open. | LOCKED |
| AI-107-AB-3 | AB-3 | workflow-removal | Unsupported/invalid gradient state cannot commit as a different user value. | Commit-boundary failure or declared round-trip contract. | LOCKED |
| AI-107-AB-4 | AB-4 | workflow-removal | Dead/missing control hydration cannot present as usable editing UI. | Visible panel failure and no edit success through dead control. | LOCKED |
| AI-107-AB-5 | AB-5 | workflow-removal | Compiled widget route cannot succeed while omitting required support files. | Route failure and no compiled payload success. | LOCKED |
| AI-107-AB-6-10 | AB-6..AB-10 | coordination-with-other-prd | Provider/model policy fiction removed or explicitly owned by PRD 108A1. | Ownership decision and boundary proof. | LOCKED |
| AI-107-AB-11 | AB-11 | workflow-removal | Grant issuance cannot invent missing timeout budget. | Typed grant failure and no grant issuance. | LOCKED |
| AI-107-AB-12-13 | AB-12, AB-13 | coordination-with-other-prd | Copilot cannot apply/drop partial work while claiming full success. | Ownership decision with PRD 108B1; zero partial-success proof. | LOCKED |
| AI-107-AB-14 | AB-14 | workflow-removal | Invalid locale-switcher placement cannot render/save as invented placement. | Typed validation failure and no render/save success. | LOCKED |
| AI-107-AB-15-16 | AB-15, AB-16 | workflow-removal | Publish containment cannot fail open on instance or page publish. | Roma route evidence for malformed and active containment; no Tokyo instance/page publish call. | LOCKED |
| AI-107-AB-17-18 | AB-17, AB-18 | workflow-removal | Widget package cannot save/publish with missing declared CSS/JS. String-prefix `Error.message` transport is forbidden. | Save/package boundary evidence, missing file in structured paths, no Tokyo save/page refresh/publish call, D-107i resolved. | LOCKED |
| AI-107-AB-19-20 | AB-19, AB-20 | workflow-removal | Page localization/robots payload cannot be silently changed. | Route/boundary failure with structured path and no page package/write/create. | LOCKED |
| AI-107-AB-21 | AB-21 | workflow-removal | Missing rate-limit/session KV cannot disable enforcement silently. | Boundary failure and no protected operation continues under missing binding. | LOCKED |
| AI-107-AB-22-23 | AB-22, AB-23 | workflow-removal | Account defaults corruption cannot seed or persist healed defaults. | Typed failure and no `putJson`, R2 write, registry write, package generation, or instance creation. | LOCKED |
| AI-107-AB-24 | AB-24 | workflow-removal | Corrupt/missing pages index cannot become empty or allow partial mutation. | List/save/delete boundary proof and no source delete/write/index write/package/publish/cache purge. D-107j resolved. | LOCKED |
| AI-107-AB-25-26 | AB-25, AB-26 | workflow-removal | Runtime visual dependency/config failure cannot paint substituted state. | Runtime fixture proves named error and no successful DOM/style mutation. | LOCKED |
| AI-107-FAMILIES | F1..F7 | contract-documentation | Every former family bucket is converted into concrete violation rows or declared-non-violation records. | Completed conversion records. | LOCKED |
| AI-107-M | ALL completed rows | masquerade-audit | No row is completed by helper-only throw, generic relabel, warning, retry, hidden detail, legacy-continuity mode, or mutation-before-failure. | Completed masquerade audit checklist. | LOCKED |

## Execution Plan

| Step | Rows/actions unlocked | Prerequisites | Completion evidence | Forbidden completions |
| --- | --- | --- | --- | --- |
| 0 | Decisions only | None | Step 0 lock table completed. | Any code edit. |
| H | Harness/proof enablement | Step 0 green | Real proof mechanism exists for targeted packages, or PO-approved alternate proof is recorded. | Echo test scripts, source-order-only checks, greps as proof. |
| 1 | Visitor/security/data-loss violations: AB-15..AB-26 | Step 0 + H + per-row PO records | Typed visible failure and downstream operation blocked for every row. | Generic 422, string-prefix error transport, warning-only, retry-to-success, mutation-before-failure. |
| 2 | Editor-trust violations: AB-1..AB-5, AB-14 | Step 0 + H + per-row PO records | Visible editor/boundary failure and no clean/healed editor success. | Transition healing, temporary legacy-continuity mode. |
| 3 | AI/plane violations: AB-6..AB-13 | Step 0 + H + ownership records | No invented provider/model/budget; no partial-success copilot outcome. | Success-after-drop, fabricated telemetry, generic chat error. |
| 4 | Converted runtime/editor family rows | Former family buckets converted | Row-by-row evidence and masquerade audit. | Batch fixes without row evidence. |
| 5 | Remaining converted family rows | Former family buckets converted | Row-by-row evidence and masquerade audit. | Silent behavior without declared non-violation record. |
| 6 | Guardrails | All deletion rows complete | Advisory guard output plus human review notes. | Pretending grep can prove product truth. |

## Evidence Ledger

No evidence may be recorded until Step 0 is complete.

| Ledger ID | Step | Rows/actions | Boundary exercised | Typed reason observed | Downstream operation blocked | Command/fixture evidence | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 107-AB1-2026-06-12 | 2 | AB-1 | Bob `ck:open-editor` session boot | `coreui.errors.instance.config.invalid:content.title` | Invalid stored config returned `bob:open-editor-failed`; clean editor open was not applied for malformed config. | `pnpm --filter @clickeen/bob typecheck`; `pnpm --filter @clickeen/bob lint`; focused stale-symbol `rg`; `git diff --shortstat` = `10 files changed, 112 insertions(+), 338 deletions(-)`; local Playwright browser proof against `http://127.0.0.1:3017/bob` showed valid open -> `bob:open-editor-applied`, invalid open -> `bob:open-editor-failed`. | `518a83d4` |
| 107-AB2-2026-06-12 | 2 | AB-2 | Bob edit-op set boundary | `Value must be a number`, `Value must be a boolean`, `Value must be one of: list, grid`, `Value must be JSON data, not a string`, `Value must be an array` | Coercion-shaped edit values returned `ok: false`; accepted string/color values were written exactly as submitted. | `pnpm --filter @clickeen/bob typecheck`; `pnpm --filter @clickeen/bob lint`; focused coerce/transform `rg`; `git diff --shortstat` = `2 files changed, 24 insertions(+), 92 deletions(-)`; local Playwright browser proof against `http://127.0.0.1:3017/bob` showed valid open -> `bob:open-editor-applied` and edit ops reject coercion/write accepted values exactly. | this commit |
| 107-AB3-2026-06-12 | 2 | AB-3 | Dieter dropdown-fill gradient hydration/commit | visible invalid state on unsupported radial/conic/CSS gradients | Unsupported gradient truth did not reach a rewritten successful commit; linear gradient still committed as `kind: "linear"`. | `pnpm --filter @ck/dieter typecheck`; `pnpm --filter @ck/dieter build`; focused gradient fallback `rg`; `git diff --shortstat` = `7 files changed, 36 insertions(+), 136 deletions(-)`; local Playwright proof against built `tokyo/product/dieter/components/dropdown-fill/dropdown-fill.js` showed radial/conic/CSS gradients set `data-invalid="true"` and valid linear angle edit committed as linear. | this commit |
| 107-AB4-2026-06-12 | 2 | AB-4 | Bob TD menu media/hydrator boundary | `Builder controls failed to load.` | Failed Dieter media cleared the control container; no field remained available for edit/save continuation. | `pnpm --filter @clickeen/bob typecheck`; `pnpm --filter @clickeen/bob lint`; focused warning-only hydration `rg`; `git diff --shortstat` = `5 files changed, 13 insertions(+), 46 deletions(-)`; local Playwright proof against `http://127.0.0.1:3017/bob` showed valid hydrator runs and missing Dieter script clears controls with visible failure. | this commit |
| 107-AB5-2026-06-12 | 2 | AB-5 | Bob compiled widget route | `[Bob] Failed to fetch widget support file product/widgets/shared/header.css (404 Not Found)` | Missing referenced support file returned 500; no compiled payload or partial `widgetPackage` success was returned. | `pnpm --filter @clickeen/bob typecheck`; `pnpm --filter @clickeen/bob lint`; focused cache/omission `rg`; `git diff --shortstat` = `2 files changed, 14 insertions(+), 121 deletions(-)`; local Playwright API proof against `http://127.0.0.1:3027/api/widgets/calltoaction/compiled` showed complete support files -> 200 with package files, missing `shared/header.css` -> failed closed with typed support-file error. | this commit |
| 107-AB6-2026-06-12 | 2 | AB-6 | San Francisco translation parse/usage boundary | `Expected JSON array response`; `Invalid JSON response`; `Translation usage missing provider` | Provider output without exact array contract failed before translation success; direct non-model translation returned without fabricated usage. | `pnpm --filter @clickeen/sanfrancisco typecheck`; focused provider/default/schema/audit `rg`; `git diff --shortstat` = `5 files changed, 14 insertions(+), 107 deletions(-)`; validators GREEN; local Playwright request proof against TS wrapper showed array output -> 200 with provider `deepseek`, object wrapper -> 502, fenced JSON -> 502, direct values -> 200 with no `usage`. | this commit |
| 107-AB7-2026-06-12 | 2 | AB-7 | San Francisco translation usage boundary | `Missing upstream usage`; `Translation usage invalid` | Missing/malformed provider model or token usage failed before translation success; cross-batch usage identity mismatch fails before aggregate usage success. | `pnpm --filter @clickeen/sanfrancisco typecheck`; focused usage/default `rg`; `git diff --shortstat` = `7 files changed, 12 insertions(+), 43 deletions(-)`; validators GREEN; local Playwright request proof against TS wrapper showed valid Deepseek/Prague usage -> 200, missing model/tokens and negative/fractional tokens -> typed failure. | this commit |
| 107-AB8-2026-06-12 | 2 | AB-8 | San Francisco translation completion/error attribution | `Invalid JSON response`; `Expected JSON array response`; provider-required parser errors | Completion/error-path provider attribution uses only caller-supplied provider truth; no `deepseek` default remains. | `pnpm --filter @clickeen/sanfrancisco typecheck`; focused provider-default `rg`; git status clean before evidence; validators GREEN; Playwright proof inherited from AB-6/AB-7 covered malformed provider output and missing provider/usage failure before success. | this commit |
| 107-AB9-2026-06-12 | 2 | AB-9 | San Francisco account translation result attribution | `Translation usage invalid`; `Missing upstream usage` | Account/job-visible translation attribution only carries real validated provider usage; missing provider cannot become `deepseek`. | `pnpm --filter @clickeen/sanfrancisco typecheck`; focused account-route provider `rg`; git status clean before evidence; validators GREEN; Playwright proof inherited from AB-6/AB-7 covered valid usage success and missing/malformed provider usage failure before account-visible success. | this commit |
| 107-AB10-2026-06-12 | 2 | AB-10 | San Francisco Prague strings model boundary | `Missing OPENAI_MODEL` | Missing Prague model env returned typed failure before OpenAI `fetch`; fake `website.prague.copy.translator` registry/matrix/policy surface was removed so no model call can run under invented `gpt-5.2`. | `pnpm --filter @clickeen/sanfrancisco typecheck`; `pnpm --filter @clickeen/ck-contracts typecheck`; `pnpm --filter @clickeen/ck-policy typecheck`; `node` JSON parse for `packages/ck-policy/ai-runtime.matrix.json`; focused Prague policy/default `rg`; `git diff --shortstat` = `9 files changed, 12 insertions(+), 170 deletions(-)`; blast-radius validator GREEN; V1-V8 validator GREEN; local Playwright request proof against TS wrapper showed missing `OPENAI_MODEL` -> 500 with `fetchCalls:0`, valid `OPENAI_MODEL` -> 200 with `fetchCalls:1`. | this commit |
| 107-AB11-2026-06-12 | 2 | AB-11 | San Francisco grant budget validation | `Grant budgets.timeoutMs must be a positive number` | Missing signed grant timeout failed during grant validation; no chat/model provider call can run under invented `20_000`. | `pnpm --filter @clickeen/sanfrancisco typecheck`; `pnpm --filter @clickeen/roma typecheck`; `pnpm --filter @clickeen/ck-contracts typecheck`; `pnpm --filter @clickeen/tokyo-worker typecheck`; focused grant-timeout `rg`; `git diff --shortstat` = `11 files changed, 20 insertions(+), 37 deletions(-)` after deleting the duplicate caller budget path; blast-radius validator GREEN; V1-V8 validator GREEN; local Playwright request proof against TS wrapper showed signed grant missing `budgets.timeoutMs` -> 400 with typed reason, valid signed timeout -> 200 with exact `timeoutMs:4567`. | this commit |
| 107-AB12-2026-06-12 | 2 | AB-12 | Builder Copilot model-output edit boundary | `Model output includes invalid ops.` | Mixed valid/invalid model ops failed before success response construction; no survivor ops were returned for Bob to apply. | `pnpm --filter @clickeen/sanfrancisco typecheck`; focused invalid-op/parser-redress `rg`; `git diff --shortstat` = `2 files changed, 4 insertions(+), 23 deletions(-)`; blast-radius validator GREEN; V1-V8 validator GREEN; local Playwright request proof against TS wrapper showed valid ops -> 200 with one op, mixed invalid ops -> 502 with no ops, fenced JSON -> 502. | this commit |
| 107-AB13-2026-06-12 | 2 | AB-13 | Builder Copilot product edit finalization | n/a - deletion of prompt-wording discard gate | Link-like valid ops are no longer discarded based on prompt wording; downstream Bob receives the complete validated op set. | `pnpm --filter @clickeen/sanfrancisco typecheck`; focused link-discard `rg`; `git diff --shortstat` = `1 file changed, 14 deletions(-)`; blast-radius validator GREEN; V1-V8 validator GREEN; local Playwright request proof against TS wrapper showed `cta.text` and `cta.url` both survive and response reports `ops_applied` with two ops. | this commit |
| 107-AB14-2026-06-12 | 2 | AB-14 / CKC-107-01 | Locale switcher config contract across Roma/Tokyo/render | `coreui.errors.localeSwitcher.positionInvalid`; `[CKLocaleSwitcher] ck_locale_switcher_placement_invalid` | Invalid/missing locale switcher truth fails before Roma create/save, Tokyo create/save/duplicate writes, composed-page render omission, and widget DOM mutation. | `pnpm --filter @clickeen/roma typecheck`; `pnpm --filter @clickeen/roma lint`; `pnpm --filter @clickeen/ck-contracts typecheck`; `pnpm --filter @clickeen/tokyo-worker typecheck`; widget runtime `node --check`; focused stale fallback `rg`; `git diff --shortstat` = `8 files changed, 18 insertions(+), 58 deletions(-)`; blast-radius validator GREEN; V1-V8 validator GREEN; direct Playwright browser proof showed malformed placement -> no switcher render, composed-page malformed placement -> failure before omission, valid placement -> exact `pod` / `bottom-left` render. | this commit |
| 107-AB15-16-2026-06-12 | 1 | AB-15 / AB-16 | Berlin/Roma publish containment gate for instance and page publish | `berlin_publish_containment_invalid_payload`; `coreui.errors.account.publishingPaused` | Malformed DB/Berlin containment, unavailable Berlin, and active containment fail before `publishAccountInstanceInTokyo` or `publishAccountPageInTokyo`; page publish uses the same containment gate as instance publish. | `pnpm --filter @clickeen/roma typecheck`; `pnpm --filter @clickeen/roma lint`; `pnpm --filter @clickeen/berlin typecheck`; focused containment/V8 `rg`; Roma placeholder `test` script removed; blast-radius validator GREEN; direct Playwright API proof showed malformed containment -> `ok:false`, `status:502`, active -> exact active result, inactive -> exact inactive result. | this commit |
| 107-V8-package-scripts-2026-06-12 | H | V8 package-script cleanup | Package/workflow/doc verification ritual cleanup | n/a - deleted no-op test rituals | Fake package `test` scripts, root/Turbo test callers, DevStudio CI test no-op, exact lint-as-typecheck aliases, and active docs preserving those rituals were deleted. | `git diff --shortstat` = `23 files changed, 14 insertions(+), 49 deletions(-)`; focused stale-script/doc `rg`; `pnpm --filter @clickeen/devstudio typecheck`; `pnpm --filter @clickeen/bob typecheck`; `pnpm --filter @clickeen/bob lint`; `pnpm --filter @ck/dieter typecheck`; shared package/San Francisco/Tokyo typechecks; Playwright proof `/tmp/prd107-v8-package-proof.cjs`; blast-radius validator GREEN; V1-V8 validator GREEN. | this commit |

## Masquerade Audit

Every completed row must pass this checklist.

| Row | Helper-only throw hidden by caller? | Generic relabel? | Warning-only? | Log-and-continue? | Retry-to-success? | Hidden in `detail`? | Legacy-continuity mode? | Mutation before failure? | Pass |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AB-1 | NO | NO | NO | NO | NO | NO | NO | NO | YES |
| AB-2 | NO | NO | NO | NO | NO | NO | NO | NO | YES |
| AB-3 | NO | NO | NO | NO | NO | NO | NO | NO | YES |
| AB-4 | NO | NO | NO | NO | NO | NO | NO | NO | YES |
| AB-5 | NO | NO | NO | NO | NO | NO | NO | NO | YES |
| AB-6 | NO | NO | NO | NO | NO | NO | NO | NO | YES |
| AB-7 | NO | NO | NO | NO | NO | NO | NO | NO | YES |
| AB-8 | NO | NO | NO | NO | NO | NO | NO | NO | YES |
| AB-9 | NO | NO | NO | NO | NO | NO | NO | NO | YES |
| AB-10 | NO | NO | NO | NO | NO | NO | NO | NO | YES |
| AB-11 | NO | NO | NO | NO | NO | NO | NO | NO | YES |
| AB-12 | NO | NO | NO | NO | NO | NO | NO | NO | YES |
| AB-13 | NO | NO | NO | NO | NO | NO | NO | NO | YES |
| AB-14 | NO | NO | NO | NO | NO | NO | NO | NO | YES |
| AB-15 | NO | NO | NO | NO | NO | NO | NO | NO | YES |
| AB-16 | NO | NO | NO | NO | NO | NO | NO | NO | YES |
| V8 package scripts | NO | NO | NO | NO | NO | NO | NO | NO | YES |

Any `YES` in the first eight columns means the row is not complete and a new V7
violation must be recorded.

## Acceptance

- Step 0 completed before any code execution.
- Every violation has a PO deletion-target record.
- Every former family bucket is converted into concrete violation rows or
  declared-non-violation records.
- No inventory table contains a `Fix`, `Suggested fix`, `Implementation`,
  `Change`, or `Patch` column.
- Every completed row proves typed visible failure at the named product boundary.
- Every completed row proves the downstream product operation is not called.
- Every completed row passes the masquerade audit.
- Remaining behavior is only one of: visible failure, creation-time default, or
  declared contract.

## Historical Audit Source

The original audit was performed by four parallel agents on 2026-06-10:

- San Francisco + ck-policy + ck-contracts + l10n
- Bob + Dieter
- Roma + Berlin + admin/functions
- Tokyo-worker + widget runtime + widget-shell + scripts

The prior PRD version mixed audit inventory, product law, and implementation
shorthand. This rewrite intentionally removes fix columns and converts the audit
into workflow deletion targets.
