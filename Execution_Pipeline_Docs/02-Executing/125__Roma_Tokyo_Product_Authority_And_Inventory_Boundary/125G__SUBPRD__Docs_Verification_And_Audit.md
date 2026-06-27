# 125G SubPRD: Docs Verification And Audit

Status: Draft for review
Parent: `125__PRD__Roma_Tokyo_Product_Authority_And_Inventory_Boundary.md`
Scope: current documentation, final checks, V1-V8 audit, deploy evidence

## 0. Parent Law

Docs are part of done. Current operator docs must match runtime after PRD 125
execution. PRD history must not substitute for current documentation.

## 1. Owned Docs

Verify these current docs after runtime is green. Patch only confirmed
runtime/doc mismatches; do not churn docs that already state the required
current-system truth.

```text
documentation/architecture/CONTEXT.md
documentation/services/roma.md
documentation/services/tokyo-worker.md
documentation/services/michael.md
documentation/capabilities/multitenancy.md
documentation/capabilities/localization.md
documentation/widgets/README.md
```

Asset docs only if 125 implementation changes Assets behavior:

```text
documentation/architecture/AssetManagement.md
```

## 2. Required Doc Content

### CONTEXT

Keep short. Add only current-system truth if needed:

```text
Roma owns account policy and click-time upgrade gates.
Tokyo account instance list returns storage coordinates only.
```

No PRD history.

### Roma

Document:

- `/widgets` returns full catalog plus saved widget rows;
- full catalog visibility is not tier-gated;
- Create/Duplicate/Publish are clickable;
- over-tier command response is HTTP 402 `UPGRADE_REQUIRED`;
- Create/Duplicate count coordinates;
- Publish counts publish state from list-facts;
- no monetization booleans in Widgets list payload.
- missing policy does not create disabled monetization controls or list-time
  monetization allowance.
- Roma product rendering may apply the approved display fallback when
  list-facts `displayName` is null; Tokyo and Roma helpers must preserve null
  and must not invent fallback labels.
- service route/helper sections name `listAccountWidgetInstanceIds`,
  `loadAccountWidgetInstanceFacts`, and their owning route/use boundaries.

### Tokyo-worker

Document:

- `GET /__internal/accounts/{accountId}/instances` returns
  `accountId + instanceIds[]` only;
- `GET /__internal/instances/{instanceId}/list-facts` returns minimal exact
  row facts;
- `displayName` is stored string or null, no fallback;
- `/instances/facts` is retired after callers move;
- Tokyo does not decide tier policy.

### Michael

Document:

- Michael provides account/user/tier relational facts;
- `public.instances` is registry/status only;
- `public.instances` is not Widgets inventory authority and not Builder source.

### Multitenancy

Document:

- `widgets.instances.max`;
- finite tier values;
- `instances.published.max` finite tier values;
- invariant `widgets.instances.max >= instances.published.max`;
- click-time upgrade UX.
- exact upgrade copy:
  - "Upgrade to create more widgets."
  - "Upgrade to publish more widgets."
- old `widgets.types.max`, widget-type limits, catalog filtering, and disabled
  create options are not active product policy.

### Localization

Document:

- locale fan-out iterates account instance coordinate ids;
- locale fan-out cost is coordinate count times changed non-base locale count;
- base-locale lock derives existence from coordinate count;
- locale settings response shape and user-visible behavior are unchanged except
  for the inventory coordinate source;
- no Widgets product summary/list-facts read just to discover locale fan-out
  coordinates.

### Widgets

Document:

- widget docs own widget catalog/authoring behavior, not account inventory
  authority;
- account Widgets domain behavior links to Roma docs for full catalog plus
  saved rows, clickable Create/Duplicate/Publish, and click-time upgrade gates.

## 3. Final Verification Commands

Required commands after all runtime subPRDs:

```bash
pnpm --filter @clickeen/roma lint
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/berlin typecheck
pnpm --filter @clickeen/ck-policy typecheck
pnpm --filter @clickeen/ck-policy test:entitlements
pnpm --filter @clickeen/tokyo-worker typecheck
pnpm --filter @clickeen/tokyo-worker test:clk-live
pnpm --filter @clickeen/tokyo-worker test:locale-package
```

Run additional focused tests added by 125A-F. Do not replace named checks with
"additional focused tests" shorthand.

## 4. Final Search Proofs

No active old policy key:

```bash
rg "widgets\\.types\\.max" packages/ck-policy/src roma berlin
```

Retirement references only:

```bash
rg "widgets\\.types\\.max" packages/ck-policy/tests documentation/capabilities/multitenancy.md
```

Expected: active runtime has no hits. Test/doc hits are allowed only when they
prove or state that `widgets.types.max` is inactive/retired.

No active old Tokyo product list path:

```bash
rg "listAccountInstancesInTokyo|loadAccountInstanceFactsFromTokyo|TokyoAccountInstanceList|TokyoAccountInstanceListEntry|normalizeTokyoInstanceListEntry|normalizeTokyoInstanceListEntries|accountInstances\\[\\]|value\\.accountInstances|payload\\.accountInstances|/instances/facts" roma tokyo-worker
rg "publishedCount" tokyo-worker/src
rg "publishedCount" roma/app/api/account roma/components roma/lib/account-instance-direct.ts
```

Expected: Tokyo does not return `publishedCount`. Roma-local `publishedCount`
is allowed only as a local variable computed from list-facts rows and must not
be parsed from a Tokyo account list response.

No old Widgets monetization list payload:

```bash
rg "systemWidgets|canCreate|canPublish|canDuplicate|createDisabledReason|disabledReasonKey|actions\\.|actions\\s*:" roma/app/api/account/widgets roma/components
```

No old command-time upgrade redress:

```bash
rg "coreui\\.upsell\\.reason\\.limitReached|widgets\\.types\\.max|/instances/facts" roma/app/api/account/instances roma/components/widgets-domain.tsx roma/components/use-roma-widgets.ts
```

No raw backend copy in Widgets user-facing UI:

```bash
rg -i "Tokyo|R2|storage coordinate|policy key|backend|package|account instance|system widget|invalid data|Supabase|JSON|route" roma/components/widgets-domain.tsx roma/components/use-roma-widgets.ts roma/lib/account-shell-copy.ts
```

Machine fields such as `gate`, `action`, `widgets.instances.max`,
`instances.published.max`, `create_instance`, `duplicate_instance`,
`publish_instance`, and `reasonKey` may exist only as non-rendered command
data/mapping inputs. Code-only terms such as router imports or `JSON.stringify`
are allowed only when they are not rendered. Visible Widgets UI copy must render
only approved human copy. Any hit from this search must be reviewed at the
render boundary; rendered backend/internal wording fails the gate.

Expected result:

- active runtime/docs contain only PRD-approved shapes;
- historical PRD files may still mention old shapes only as history;
- coordinate-only `GET /__internal/accounts/{accountId}/instances` and storage
  root helpers such as `accountInstancesRoot` are allowed to remain.

## 5. Final Product Verification

Cloud-dev/manual verification after deploy:

Verification authority coordinates:

- default account/session coordinate: authenticated Roma cloud-dev account
  `CLICKEEN`;
- if `CLICKEEN` cannot provide both over-tier and within-tier preconditions,
  record the exact alternate cloud-dev account coordinate before testing;
- before each command test, record tier limit, coordinate count, published
  count, and target instance id from the owning surfaces;
- tier/session truth comes from authenticated Roma account policy/session
  routes;
- coordinate and publish-state truth comes from Tokyo coordinate/list-facts
  routes through Roma-owned verification evidence;
- do not infer tier state or counts from the visual UI alone;
- if no named account can satisfy a required precondition, the verification is
  blocked; do not simulate success with mocked data.

- `/widgets` loads full catalog;
- over-tier Create opens upgrade dialog with "Upgrade to create more widgets."
  current/limit context, upgrade CTA, and no raw
  gate/action/reasonKey/policy/backend copy; Roma/Tokyo evidence shows no
  instance was created;
- over-tier Duplicate opens upgrade dialog with "Upgrade to create more widgets."
  current/limit context, upgrade CTA, and no raw
  gate/action/reasonKey/policy/backend copy; Roma/Tokyo evidence shows no
  duplicate was created;
- over-tier Publish opens upgrade dialog with "Upgrade to publish more widgets."
  current/limit context, upgrade CTA, and no raw
  gate/action/reasonKey/policy/backend copy; Roma/Tokyo evidence shows no
  publish transition occurred;
- within-tier Create succeeds and creates one account instance;
- within-tier Duplicate succeeds and creates one duplicate account instance;
- within-tier Publish succeeds and changes publish state;
- already-published Publish remains idempotent and does not show upgrade;
- locale settings save still fans out to coordinates;
- base-locale lock still locks once any saved widget exists;
- locale settings response shape/user-visible behavior is unchanged except for
  the coordinate source;
- public published widget serving is unchanged at
  `https://dev.clk.live/{accountPublicId}/{instanceId}`;
- public support files remain available:
  `styles.css` and `runtime.js`;
- locale public serving remains unchanged for available stored locale packages.

Use owner surfaces:

```text
Roma for Widgets/product behavior
Tokyo/R2 evidence for storage route behavior
Git/GitHub/Cloudflare deploy evidence for runtime state
```

Deployment evidence requirements:

- Roma Pages: Cloudflare Pages Git build state, deployed commit SHA, and Roma
  runtime response evidence.
- Tokyo-worker: GitHub Actions `cloud-dev workers deploy` evidence, deployed
  commit SHA, Tokyo runtime response evidence, and public-serving response
  evidence.
- Berlin/Roma policy blast radius: coordinated deploy evidence when
  `@clickeen/ck-policy` changes; authenticated `GET /api/bootstrap`; one
  authenticated Roma account route that consumes account policy.
- R2 object evidence: only after `pnpm cf:preflight`.
- Pages/project/config evidence: only after `pnpm cf:api:preflight`.

## 6. Non-Goals

This subPRD must not:

- change runtime code;
- repair runtime mismatches inside 125G. Runtime mismatches fail back to the
  owning 125A-F subPRD;
- add new product policy;
- add probes/status dashboards;
- change Cloudflare configuration. Config mismatches fail to the owning
  DevOps/config task;
- rewrite history docs.

## 7. V1-V8 Final Audit

For final acceptance, record:

- V1 Silent substitution: no invented Tokyo/helper display names and no policy
  fallback. Roma UI display fallback is allowed only at the product rendering
  boundary.
- V2 Silent healing: no malformed coordinate repair.
- V3 Silent omission: no skipped ids/catalog items.
- V4 Fail-open control: missing policy/list facts blocks command visibly.
- V5 Corruption-as-absence: corrupt config is not treated as missing/empty.
- V6 Partial-success masquerade: over-tier and partial fan-out do not report
  success.
- V7 Masquerade/redress: old list/facts/disabled-button paths do not survive
  under new names.
- V8 Runtime test dependency: product runtime does not depend on probes/tests.

Final V1-V8 audit must include independent/subagent review evidence for the
cross-system release, plus per-slice reconciliation for 125A through 125F. If
subagent tooling is unavailable at execution time, record that and perform the
audit locally against every violation.

## 8. Done

This subPRD is done when:

1. Current docs match runtime.
2. Required checks are green.
3. Search proofs are clean.
4. V1-V8 audit is green.
5. Product verification is green on Roma and Tokyo owner surfaces.
6. Berlin/Roma policy-session verification is green when policy code changed.
7. Commit and push are complete.
8. Cloudflare deploy evidence is recorded by surface when code changed.
