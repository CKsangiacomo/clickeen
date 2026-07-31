# 126 — DevQA: Where We Actually Stand

Status: REOPENED — LOCALIZATION CORRECTION REMAINS GREEN; UI CONVERGENCE
IMPLEMENTED AND DEPLOYED; AUTOMATED ROUTE/LAYOUT COVERAGE GREEN; POPUP
WORKFLOW COVERAGE AND PRODUCT-OWNER ACCEPTANCE PENDING; NO CLOSURE CREDIT YET.
This document reconciles PRD claims with Git and current source evidence. It does
not define product law, approve unresolved architecture choices, prove that every
intermediate commit deployed, or close any PRD whose required verification is
still missing.

Date: 2026-07-14
Last reconciled: 2026-07-31
Scope: premature A-H code-change reality, final A-M current-source audits,
executable PRDs, exact-tree peer reviews, and current Step-9 execution state.
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA).

## 2026-07-31 Rendered Vertical Rhythm Correction

The product owner rejected D6's rendered result as visually unchanged. D7
preserves D6 as historical deployment evidence but supersedes its values at the
same owning Dieter and consumer selectors. Base token values are unchanged.

| Level | D7 current value |
| --- | --- |
| Full Page | `24px` outer padding, `16px` header separation, `16px` content gap |
| Compact Page | `16px` outer padding, `12px` header separation, `12px` content gap |
| Table | `4px` block and `16px` inline cell padding |
| DevStudio navigation | `28px` rows, `16px` brand gap, `12px` group gap |
| DevStudio previews | `24px` generic minimum, `12px` section gap, one CSS component-row spacing owner |
| Roma navigation | `28px` rows with `4px` stack gap; `45px` brand block |
| Roma primary modules | `12px` block padding, `24px` wide/`16px` compact inline padding, `8px` internal gap |
| Roma secondary cards | `8px` block padding, `16px` inline padding, `8px` internal gap |

Local built-browser measurement confirms that DevStudio Core styles now renders
`23.44px` Table headers and `33px` repeated preview rows instead of the D6
`31.44px` and `49px`; navigation rows render at `28px`. A representative Roma
composition renders `23.44px` headers, `32.5px` action rows, `28px` navigation
rows, and the exact module/card values above without page overflow. Compact
DevStudio retains Table-owned horizontal overflow.

### Verification and deployment evidence

- Implementation commit `101156c037be4e7c6bfef93d1135d118c46e9608`
  is on `github/main`.
- Dieter governance/typecheck, DevStudio deterministic generation/lint/
  typecheck/build/Functions checks, Roma widget command gates/lint/typecheck/
  Cloudflare build, Bob lint/typecheck/build, root lint/typecheck/build, the R2
  dry run, and six focused DevStudio browser contracts are GREEN.
- Exact-SHA Pages deployments are GREEN: DevStudio
  `1199e493-f390-434f-ac8b-0c831ae09011`, Roma
  `1f15e090-1690-4955-a5f9-a6bf416d23c3`, and Bob
  `ffa57de8-9d6b-4340-86c7-2b26dc2bbe27`.
- GitHub Roma/Bob verification run `30648980105` is GREEN.
- GitHub Worker/R2 run `30648980048` is GREEN. Every Worker and secret-sync
  step was correctly skipped; the canonical R2 operation uploaded all 581
  objects (`dieter=157`, `prague=348`, `product=76`).
- Authenticated deployed DevStudio computes to `24/16/16px` Full Page rhythm
  and `16/12/12px` Compact Page rhythm (padding/header/content), `16/12px`
  navigation gaps, `28px` navigation rows, `16px` preview gaps, `12px` section
  gaps, and `4/16px` Table cell padding. Core styles renders `23.44px` Table
  headers and `33px` body rows. Compact overflow remains owned by Table while
  document overflow is zero.
- Authenticated deployed Roma computes to the same Full and Compact Page
  rhythm, `4px` navigation stack gaps, `28px` navigation rows, a `45px` brand
  block, `12/24px` wide and `12/16px` compact primary-module padding with `8px`
  gaps, and `8/16px` secondary-card padding with `8px` gaps. Document overflow
  is zero at both widths.
- The six focused contracts pass against deployed DevStudio, and both deployed
  browser measurements emitted zero console or page errors. No product data,
  route, API, account/session authority, or Worker runtime changed.
- Independent consumer reviews and the final audit are GREEN for shared
  ownership, deterministic generation, current/historical documentation
  integrity, and V1 through V8.

## 2026-07-31 Shared Vertical Rhythm Correction

The product owner accepted the shared shell direction and requested a tighter
vertical rhythm in both DevStudio and Roma. This correction changes values,
not architecture: Dieter remains the Page/Table authority and both apps remain
composition consumers.

| Level | Corrected value |
| --- | --- |
| Full Page | `24px` outer padding, `24px` header separation, `20px` content gap |
| Compact Page | `16px` outer padding, header separation, and content gap |
| Table | `8px` block and `16px` inline cell padding |
| DevStudio | `24px` brand-to-nav gap, `16px` nav-group gap, tighter preview blocks |
| Roma navigation | `32px` rows with `4px` stack gap |
| Roma primary modules | `16px` block padding, `24px` inline padding, `12px` internal gap |
| Roma secondary cards | `12px` block padding, `16px` inline padding, `8px` internal gap |

All values come from the existing `--space-*` scale. No density token, new
spacing scale, typography change, route/API/data change, or new component is
part of this correction.

### Verification and deployment evidence

- Implementation commit `b63ff9cf82d82df4de95f456c896724fbbeafafb`
  is on `github/main`.
- Dieter governance/typecheck, DevStudio generation/lint/typecheck/build/
  Functions checks, Roma lint/typecheck/Cloudflare build, root lint/typecheck/
  build, the R2 dry run, and five focused DevStudio browser contracts are
  GREEN.
- DevStudio exact-SHA Pages deployment
  `6fe946e3-0ce6-48b7-b0ad-77c31fe36b0f` and Roma exact-SHA Pages deployment
  `5be169f7-593f-4669-8f26-d94dab7ed587` are GREEN.
- GitHub Roma/Bob verification run `30646043248` is GREEN.
- GitHub Worker/R2 run `30646043182` is GREEN. Every Worker and secret-sync
  step was correctly skipped; the canonical R2 operation uploaded all 581
  objects (`dieter=157`, `prague=348`, `product=76`).
- Authenticated deployed DevStudio computes to `24/24/20px` Full Page rhythm,
  `16/16/16px` Compact Page rhythm, `24/16px` navigation gaps, and `8/16px`
  Table cell padding.
- Authenticated deployed Roma computes to the same Page rhythm, `4px`
  navigation stack gap, `32px` navigation rows, `16/24px` primary-module
  padding with `12px` gaps, and `12/16px` card padding with `8px` gaps.
  Compact primary modules remain `16px` on both axes.
- Both deployed browser checks emitted zero console or page errors. No product
  data, route, API, account/session authority, or Worker runtime changed.
- The independent final audit is GREEN for shared-authority ownership,
  deterministic generation, current/historical documentation integrity, and
  V1 through V8.

## 2026-07-30 Shared Visual Composition Correction

The product owner rejected the first D4 visual result. It was structurally
shared but visually preserved the old dense shell and table behind a border and
radius. This correction keeps the approved
`main-container > left-nav + page` authority and makes the visual system itself
shared and inspectable in Dieter.

### Authority and work separation

| Concern | Authority/result |
| --- | --- |
| Shell and Page presentation | `dieter/layouts/main-container/main-container.{css,html,spec.json}` |
| Table presentation | `dieter/components/table/table.{css,html,spec.json}` |
| DevStudio | Consumes the shared shell/Table and composes source-derived examples |
| Roma | Consumes the shared shell/Table and composes domain modules with existing Dieter values |
| Product data/routes/APIs | Unchanged |
| New machinery | None: no new token, role, component, generator, framework, alias, or runtime service |

### Local evidence

- Full at `1440x1000`: navigation `8,8,320,984`; Page begins at `x=336`.
- Compact at `390x844`: the same navigation opens at `8,8,320,828` over the
  full-width Page.
- Page header/content share one centered `80rem` maximum width.
- The application canvas is muted; navigation is a borderless shared surface
  with `20px` radius and Dieter elevation.
- Table is a borderless `16px` shared surface with floating elevation, muted
  header, direct role-border separators, and `12px`/`16px` cell padding.
- DevStudio Core styles keeps all four columns/actions visible. DevStudio
  component examples, Roma Home, Roma Widgets, and Compact open/closed states
  were inspected from current source at real viewport sizes.
- Dieter typecheck/governance, DevStudio generation/typecheck/lint/build/
  Functions checks, Roma contract/typecheck/lint/Cloudflare build, and source
  diff checks are GREEN.

The independent pre-commit audit blocked one unauthorized scrim-opacity change;
the shared Compact scrim was restored to its existing `64%` black-mix value and
the generated Layout reveal was regenerated. The final independent V1-V8 audit
is GREEN: no substitution, healing, omission, fail-open control,
corruption-as-absence, partial-success claim, renamed failing workflow, or
runtime test dependency remains.

### Commit, deployment, and owning-surface evidence

- Implementation commit
  `c57f2d907af780e09c2dc4aab026b34216268e8b` is on `github/main`.
- DevStudio exact-SHA Pages deployment
  `3ef38351-7956-45b7-8475-a0fd62b95bdc` is GREEN.
- Roma exact-SHA Pages deployment
  `6b7bfb73-2034-4da0-a170-8e952ec4e26d` is GREEN.
- GitHub Roma/Bob verification run `30600663271` is GREEN.
- GitHub Worker/R2 run `30600663263` is GREEN. Worker deployment steps were
  correctly skipped; the canonical static-root operation uploaded all 581
  objects to `tokyo-assets-dev` (`dieter=157`, `prague=348`, `product=76`).
- Authenticated deployed Roma at `1440x1000` resolves the navigation to
  `8,8,320,984`, Page to `x=336`, and content to `1040px`; at `390x844` the
  same navigation opens at `8,8,320,828`, while Table alone scrolls
  `326px -> 672px`.
- Authenticated deployed DevStudio at `1600x1000` resolves the navigation to
  `8,8,320,984`, Page to `x=336`, and centered content/Table to `1200px`.
  Table computes to a borderless 16px-radius elevated surface with
  `12px`/`16px` cell padding. At `390x844`, the same navigation opens at
  `8,8,320,828` over the full-width Page.
- Both deployed browser checks emitted zero console or page errors.

Product-owner visual acceptance remains open; automated and browser evidence
do not grant that acceptance.

## 2026-07-30 Inset Shared Shell And Portrait Correction

The human product owner selected one cohesive shell for DevStudio and Roma:
`main-container > left-nav + page`, with the navigation presented as an inset
foreground panel over the application backdrop. The same panel becomes the
Compact overlay in narrow landscape and portrait. This supersedes only the old
DevStudio/Roma portrait replacement; Bob's specialized editor boundary remains
unchanged.

### Exact authority and implementation

| Concern | Authority/result |
| --- | --- |
| Layout source | `dieter/layouts/main-container/main-container.{css,html,spec.json}` |
| Taxonomy | `main-container > left-nav + page`; no alias or additional shell vocabulary |
| Full navigation | Exact `--layout-left-nav-width` panel, `--space-2` inset, existing muted surface, role border, `2xl` radius, and floating shadow |
| Compact navigation | Same panel fixed `--space-2` from every viewport edge, full-width page beneath, existing elevated shadow and scrim |
| DevStudio consumer | Existing navigation/content/open state retained; portrait replacement deleted |
| Roma consumer | Existing navigation/content/open state retained; portrait replacement deleted |
| Product data/routes/storage | Unchanged |
| Deploy/runtime | Git-connected DevStudio and Roma Pages; normal Dieter-triggered static-root workflow |

No new token, color role, component, framework, runtime classifier, generator,
or compatibility alias was added. The four existing editable layout tokens
remain the only Layout-specific token contract. The inset, surface, border,
radius, and elevation reference existing Dieter foundations directly.

### Local evidence

- Wide `1440x900`: navigation rect `8,8,220,884`; one-pixel border, 16px
  radius, floating shadow; page begins at `x=236`.
- Narrow portrait `390x844`: page remains mounted at full width; navigation
  opens at `8,8`, width `320`, height `828`, with 16px radius and visible
  scrim; the retired portrait boundary is absent.
- DevStudio generation, typecheck, lint, build, Functions syntax, and focused
  shell Playwright checks are GREEN.
- Roma widget-command contract, typecheck, lint, and Cloudflare production
  build are GREEN.
- Dieter typecheck, governance, generated Layouts examples, and source diff
  checks are GREEN.

### Exact deployed evidence

- Implementation commit `ed837250` is on `github/main`.
- Exact-SHA Git-connected Pages deployments are GREEN:
  - DevStudio `d0a796fb-4302-436d-94b8-f45bc05b7a3f`;
  - Roma `266563eb-10a3-4ad3-9886-f0230818621a`.
- GitHub Roma/Bob app verification run `30596614966` is GREEN.
- GitHub Worker/R2 run `30596614985` is GREEN on attempt 2. Attempt 1 stopped
  after Cloudflare R2 returned an internal HTTP 500 for one existing Dieter
  icon after the command's three retries. The unchanged failed-job rerun
  completed the canonical 581-object sync (`dieter=157`, `prague=348`,
  `product=76`). No Worker surface changed or deployed.
- Authenticated deployed DevStudio `/#/dieter/layouts` and Roma `/widgets`
  both prove the same geometry:
  - `1440x900`: navigation rect `8,8,220,884`; page `x=236`, width `1204`;
  - touch portrait `390x844`: open navigation rect `8,8,320,828`; page `x=0`,
    width `390`;
  - both use a one-pixel direct role border, 16px radius, Dieter elevation,
    contain no retired portrait boundary, and emitted no console/page errors.

The independent final audit found and blocked two pre-commit mismatches: an
invented 55% border mix instead of the direct Dieter border role, and one stale
current `126M` portrait-matrix row. Both were corrected before `ed837250`. The
final V1-V8 audit is GREEN for every violation: no substitution, healing,
omission, fail-open control, corruption-as-absence, partial-success claim,
renamed failing workflow, or runtime test dependency was introduced.

This correction does not close the broader C14 visual-acceptance boundary.

## 2026-07-30 Operational Typography And Table Correction

The human product owner rejected the two operational font-family variables and
the resulting local typography assembly. This correction applies the accepted
DevStudio Typography classes across Dieter, DevStudio, Roma, Bob, and Prague;
preserves public-widget account-authored typography; and makes Dieter Table the
visible shared pattern rather than a consumer invention.

### Authority and work separation

| Concern | Authority/result |
| --- | --- |
| Operational typography | `dieter/tokens/dieter-typography.css`; consumers select only the complete `display-*`, `heading-*`, `body-*`, `label-*`, `caption*`, and `overline*` classes |
| Table presentation | `dieter/components/table/table.{css,html,spec.json}` |
| DevStudio reveal | Typography and Table routes plus generated Foundation tables |
| Consumers | DevStudio, Roma, Bob, and Prague operational UI |
| Public-widget typography | Existing `--typo-*`, `CKTypography`, account font library, and materializer remain authoritative; static fallback uses direct Inter |
| Product data | None changed |
| Runtime/deploy | Git-connected Pages for DevStudio/Roma/Bob/Prague and the standard Tokyo static-root R2 sync |

### Local implementation evidence

- Repository-wide search returns zero references to either rejected
  font-family variable, including 126 history and archived research fixtures.
- Outside the canonical Dieter typography source, operational UI has no local
  family, size, weight, line-height, or tracking composition; retained
  `font: inherit`, icon line-height, and toggle tracking are component mechanics,
  not visual type choices.
- No operational `<code>` or `<pre>` node, Table `th`, or Table `td` lacks its
  approved visual class.
- Table column headers use `label-s`; every body header/data cell uses `body-s`;
  code/token values compute to the same proportional Inter Tight treatment.
- Computed browser evidence on Core styles proves a muted header, white body and
  row-header cells, zero vertical cell border, compact end-aligned action cells,
  and no unintended horizontal overflow (`clientWidth = scrollWidth = 1154`).
  The governed horizontal-overflow composition still scrolls as required.
- Widget artifact generation preserves all eight widget pairs and Tokyo dry-run
  inventory remains 581 files (`dieter` 157, `prague` 348, `product` 76).
- Focused Dieter/DevStudio/Roma/Bob/Prague checks, widget/typography/runtime
  contracts, sequential Cloudflare builds, root lint, root typecheck, root build,
  `git diff --check`, R2 preflight, and Pages API preflight are GREEN.

The independent final audit is GREEN:

| ID | Result | Reconciliation |
| --- | --- | --- |
| V1 Silent substitution | GREEN | Direct Inter is the accepted widget fallback, not invented source truth. |
| V2 Silent healing | GREEN | No persisted or user-authored state is normalized or rewritten. |
| V3 Silent omission | GREEN | All operational consumers, Table cells, generated surfaces, and widget fallback sites were covered. |
| V4 Fail-open control | GREEN | Existing widget typography validation and missing-data failures remain intact. |
| V5 Corruption-as-absence | GREEN | No storage, account data, or corruption handling changed. |
| V6 Partial-success masquerade | GREEN | Local, exact-SHA Pages, R2, and deployed-browser evidence are stated separately; Prague's queued Pages state is not reported as deployed. |
| V7 Masquerade/redress | GREEN | No aliases, replacement variables, compatibility wrappers, or renamed copies preserve the rejected behavior. |
| V8 Runtime test dependency | GREEN | Tests assert the contract; runtime behavior does not depend on them. |

### Commit, deployment, and owning-surface evidence

Implementation commit
`c2f7ba16822534a9c47ed3a2475aca4528aea041` was pushed to `github/main`.
GitHub Actions passed at that exact source:

- `cloud-dev workers deploy` run `30594014413` uploaded all 581 standard
  static-root files to `tokyo-assets-dev` (`dieter/` 157, `prague/` 348,
  `product/` 76); every Worker deployment step was correctly skipped by its
  change gate;
- `cloud-dev prague app verify` run `30594014406`;
- `cloud-dev roma app verify` run `30594014412`;
- `cloud-dev surface reachability` run `30594149610`.

Cloudflare Pages completed successfully at the exact implementation SHA for:

- DevStudio deployment `f724a8c3-db34-4733-a669-811281bced0d`;
- Roma deployment `cdf8c9f9-07bc-4393-ab63-6047a3fb54bc`;
- Bob deployment `8c8a3afd-a86d-4f8b-89f9-9bd47b43e057`.

Prague deployment `3d5d254a-138d-4cc6-92bc-44f80eae4742` selected the exact
implementation SHA but remains queued behind the existing Prague Pages backlog.
The successful Prague source workflow and R2 sync do not masquerade that queued
Pages state as a completed deployment.

Authenticated deployed-browser reads proved:

- DevStudio Core styles uses `heading-2`, `heading-4`, `label-s`, and `body-s`;
  its shared tables render muted headers, white body and row-header cells, no
  vertical rules, compact end-aligned actions, proportional Inter Tight, and
  no unintended overflow or browser errors;
- Roma `/widgets` renders the governed shell and eight shared tables with no
  unclassed header/body cells, no rejected font-family variables, and no
  browser errors;
- Bob `/bob` renders its operational shell as `body-s` through the existing
  Inter Tight file-delivery class, with no rejected font-family variables and
  no browser errors.

R2 read-back hashes match committed bytes for all 12 changed public-widget
files: six widget stylesheets and the six shared branding/header/locale/social/
stage/typography assets. Existing account-authored typography remains intact;
no account product data, Worker code, or Supabase state changed. The
authentication command refreshed only the ignored cloud-dev browser-session
file.

This sub-correction does not close the broader C14 product-owner acceptance
boundary.

## 2026-07-30 UI Convergence Acceptance Matrix

Original A–M execution and localization-correction evidence below remains
point-in-time evidence. It cannot close this correction. Commits `2a070120`,
`5e7c0266`, and `2b013925` are pre-convergence source history. D4 convergence
implementation is `db8589f3`.

The correction started only from the frozen parent/H/I/K/L/M contract. It
changed product UI code, Git-connected Pages deployment state, and the standard
Tokyo static deploy roots in R2. It did not change account product data,
Workers, or Supabase.

### Authority Gate

| Concern | Authority for correction |
| --- | --- |
| Product surface | Dieter source defines; DevStudio demonstrates; DevStudio/Roma consume; applicable Bob consumes Table/Popup |
| Account/session coordinate | Unchanged; no account/session mutation |
| Storage coordinate | Standard `tokyo-assets-dev` static deploy roots `dieter/`, `prague/`, and `product/`; no `accounts/` product-data coordinate |
| Route/API boundary | No new service route or transport. One new generated DevStudio hash route, `#/dieter/layouts`; the existing foundation-token GET/POST validator recognizes exactly the four approved Layout tokens through the existing source-write authority. |
| Runtime/deploy | Existing Git-connected DevStudio, Roma, and `bob-dev` Pages builds plus the standard `cloud-dev workers deploy` static-root R2 sync; Worker deploy steps remain change-gated |
| Verification | Source/deletion searches, generated inventories, exact-SHA Pages status, GitHub Actions R2-sync status, and deployed browser evidence |

### Work Separation

| Lane | Correction requirement |
| --- | --- |
| Code | Dieter Layout/Table/Popup; existing generator changes; DevStudio/Roma/applicable Bob adoption; duplicate deletion |
| Product data | None |
| Deploy/runtime | Git-connected Pages and change-gated `cloud-dev workers deploy`; verify exact source SHA and the static-root R2 sync |
| Documentation | Correct living Dieter/UI/DevStudio/Roma/Bob docs after implementation proves current behavior |

### Required Order And Evidence

| Gate | Required result | Status |
| --- | --- | --- |
| C1 Dieter Layout/Page | Exact `dieter/layouts/main-container/{css,html,spec.json}`; `.main-container > .left-nav + .page`; Page header/actions/content; four exact editable Dieter tokens; existing governance recognizes layouts | GREEN |
| C2 DevStudio Layouts/Edit | `#/dieter/layouts` generated from C1; isolated real-viewport examples plus Page composition use exact production source; spec tokens open the existing authenticated token editor/commit path | GREEN |
| C3 DevStudio consumer | Actual shell and every route consume C1 Page composition; replaced `.docs-shell*`/generic page layout bases deleted | GREEN |
| C4 Dieter Table | Exact `table/{css,html,spec.json}`; semantic source example at `#/dieter/table`; final selectors | GREEN |
| C5 Table hard cut | Every consumer migrated; `operational-table` directory/imports/selectors/docs/tests have zero active hits | GREEN |
| C6 Dieter Popup | Exact `popup/{css,html,spec.json}` around native `<dialog>` at `#/dieter/popup`; existing lifecycle remains sole mechanics helper; Popover distinct | GREEN |
| C7 Popup hard cut | DevStudio, Roma, Bob Upsell, Bulk Edit, Object Manager migrated; replaced local visual bases deleted; behaviors unchanged | GREEN |
| C8 DevStudio presentation | Core/Colors/Icons/Typography/Layouts and all components use restrained semantic, source-derived presentation | GREEN |
| C9 Roma migration | Exact shared Layout/Page plus Table/Popup; `.roma-layout*`, outer `rd-*` duplication, and `.roma-modal*` replaced bases deleted; routes/operations unchanged | GREEN |
| C10 Bob boundary | Bob keeps `ToolDrawer | Workspace`; only applicable Table/Popup adoption; widget-preview layout unchanged | GREEN |
| C11 Local gates | Parent's exact commands and exact five existing verification files GREEN | GREEN |
| C12 Generated inventory | Exactly 5 Foundation, 24 component, and 2 Policy DevStudio routes generated from source | GREEN |
| C13 Deploy proof | `pnpm cf:api:preflight`; project reads for `devstudio`, `roma-dev`, and `bob-dev` at one successful exact SHA; successful change-gated static-root R2 sync with Worker deploy steps skipped | GREEN — `db8589f3` |
| C14 Browser proof | All 31 DevStudio routes; the 12 exact Roma route paths and route-specific Table/Popup workflows named by the parent; Bob Upsell/Bulk Edit/Object Manager through `/builder`; no console/page errors; product owner accepts deployed DevStudio visual set | OPEN |
| C15 Deletion proof | No compatibility aliases, copied Dieter CSS, second generators, parallel old/new selectors, runtime manifest/service, or generated Dieter mirror | GREEN |
| C16 Docs + V1–V8 | Living docs match delivered source; independent audit GREEN | GREEN |

### Convergence Execution Evidence

Implementation commit `db8589f3ecb9f4ffb779a0da413bd3b81b899be0`
was pushed to `github/main`. Cloudflare API preflight passed, then all three
Git-connected production Pages projects completed successfully at that exact
SHA:

- DevStudio deployment `004c6133-d6cb-416c-a6ec-47a45a94cb4f`;
- Roma deployment `ce24d49a-89fa-42ed-bce6-15fab9dfe302`;
- Bob deployment `3a6e0cb2-8e23-49c6-9e62-10df3a98f2bf`.

Every focused local command in the parent passed. The five named verification
files passed through their owning commands. DevStudio generated exactly 5
Foundation, 24 component, and 2 Policy routes. Its authenticated deployed suite
passed all 50 tests: all 31 routes, exact Layout source/edit behavior, real
Table overflow, Popup/token-editor behavior, Policy action placement, token
validation, and read-only backend-truth checks.

Deployed Roma passed all 12 named routes. `/widgets`, `/pages`, `/assets`, and
`/team` rendered the final shared Table contract. Roma and DevStudio both
passed Full `1440x900`, `768x1024`, `1024x768`, and `600x960`; Compact
`844x390`; unsupported portrait `390x844`; and landscape/portrait orientation
return. Bob loaded through Roma at `/builder/QD1G068MX7` and passed Full
`ToolDrawer | Workspace`, Compact one-ToolDrawer behavior, shared Popup markup,
and absence of the retired upsell base.

The independent implementation V1–V8 re-audit returned PASS for all eight
violations. Final documentation reconciliation remains C16.
Push-triggered GitHub Actions run `30588134245` completed successfully at the
same SHA. Every Worker deployment step was skipped by its change gate. Its
standard static-root step ran
`node scripts/tokyo-r2-deploy-sync.mjs --remote` and uploaded 581 files to
`tokyo-assets-dev`: `dieter/` 157, `prague/` 348, and `product/` 76. It did
not address `accounts/` or mutate account product data. No Worker code or
Supabase state changed. The verification login commands refreshed only the
ignored cloud-dev browser session files.

C14 remains OPEN because automated coverage did not execute every named Roma
and Bob Popup workflow and the product owner has not accepted the deployed
visual set. No agent may convert that missing acceptance into closure credit.

### Browser Evidence Detail

DevStudio proof is exhaustive, not sampled:

- 5 Foundation routes: Core styles, Colors, Icons, Typography, Layouts;
- 24 generated component routes, including Table and Popup;
- 2 Policy routes;
- Layouts Full, Compact-closed, and Compact-open;
- token edit/confirm/discard behavior;
- Table overflow and Popup visual/lifecycle behavior.

Completed Roma proof covers all 12 named routes, shared shell structure, shared
Table markup on the four owning routes, and the viewport/orientation matrix.
Completed Bob proof covers Full and Compact `ToolDrawer | Workspace`, shared
Popup markup, retired-upsell-base absence, and preview visibility. Executing
every Roma/Bob Popup workflow, including Upsell, Bulk Edit, and Object Manager,
remains required C14 coverage.

The exercised click/touch and native semantic behavior is verified. This
matrix does not authorize or claim a broad keyboard-support program. Only the
existing accepted native-dialog lifecycle is preserved.

### Closure Rule

126 remains open until C1–C16 are GREEN with exact file/deletion evidence,
generated counts, exact-SHA deployed evidence, browser evidence, and independent
V1–V8. A local build, a screenshot of one page, the original Step-9 evidence,
or the earlier localization closure cannot substitute for any open row.

## 2026-07-30 Localization Closure Correction

The earlier GREEN claim was incomplete. PRD 124 introduced per-locale runtime
artifacts. Commit `dfc4311e` briefly made translation generation overlay-only,
but 126-era commit `183ef046` coupled artifact construction back to Generate
Translations; `d91923fd` optimized that fan-out; `8f8bd76c` exposed its outcomes
in Bob. Commit `3cd86f49` closed 126 without reconciling the violation.

Current R2 pre-cleanup truth from a complete paginated inventory:

- 400 obsolete HTML/CSS/JS objects;
- 134 instance/locale coordinates;
- 5 affected instances;
- one incomplete coordinate (`0NP67CGKVQ`, `hu`, index only);
- 144 legitimate overlays across 9 instances, all to be preserved.

Required closure:

1. translation writes exact overlays only;
2. one root runtime consumes the exact requested overlay;
3. no active mutation/read route can address locale-derived runtime files;
4. all 9 overlay-bearing root runtimes are rematerialized;
5. cloud-dev base and `?locale=` responses are proven fail-closed;
6. exact obsolete R2 keys are deleted and recount is zero;
7. overlay/root preservation and independent V1–V8 are recorded.

### Implementation and remote-data evidence

The correction used a two-stage cutover so a new Tokyo route could never serve
an old base-only runtime as a requested translation.

1. `7fa262b4` removed locale-package generation from Bob/Roma and made the
   materializer root-only and overlay-aware. Bob Pages deployment
   `157557a0-ded8-48c6-85da-5b52d7eab862` and Roma Pages deployment
   `207d881f-5c6d-4ef1-8ef0-459d5690c4f7` both completed successfully at that
   SHA.
2. All 9 CLICKEEN instances were resaved through Roma using their exact existing
   `widgetType` and `config`. Each before/after config SHA-256 matched; the 3
   published and 6 unpublished states were unchanged. R2 read-back proved every
   root index has exactly one locale-context marker and root-only CSS/JS URLs,
   and every root runtime has the exact overlay boot contract.
3. `e59ba3e7` removed Tokyo locale-package storage/read/delete/public routes and
   installed root `?locale=` delivery. GitHub Actions run `30566585467` deployed
   Tokyo-worker successfully.
4. Four pre-existing Bengali overlays still used the revoked transitional
   `{v:1, values}` body while the other 140 used canonical `{values}`. Commit
   `95c2a269` added the exact editor-authorized Roma overlay PUT boundary and a
   Tokyo base-locale rejection. All four documents were rewritten through that
   route; their `values` hashes were identical before and after. All 144 overlays
   then passed the one canonical exact-schema audit.
5. Browser verification of
   `https://dev.clk.live/CLICKEEN/I5918UU0IA?locale=bn` proved Bengali DOM text,
   `<html lang="bn">`, and the same root `styles.css` and `runtime.js` URLs as
   base. Missing `?locale=fr` and retired `/locales/bn` both returned 404.
6. The exact 400-key deletion manifest is
   `evidence/126-localization-cleanup-manifest.txt`. GitHub Actions run
   `30567827936` deleted every key successfully. Complete R2 reconciliation
   changed 598 objects to 198, left 144 overlays, left zero instance
   `locales/` objects, and showed all 198 preserved key/size/timestamp records
   identical to the pre-delete inventory.
7. Final Git-connected Bob and Roma Pages deployments both completed
   successfully at `d82dd9ec`. The deployed product code was unchanged from the
   already-green `95c2a269` product cutover; the final SHA removed the one-use
   cleanup machinery and recorded its evidence.
8. The cloud-dev translation smoke was brought into line with the current Bob
   entry point and Roma event-stream result contract. Its final run generated
   all 28 active non-base locales for `QD1G068MX7`, read the exact saved
   inventory and Japanese overlay through Roma, selected Japanese in Bob, and
   proved an exact Japanese overlay value rendered in the widget preview.
9. The pre/post-smoke R2 keyset was identical: 198 instance objects, 144
   overlays, and zero retired instance `locales/` objects. Exactly 28 object
   records changed, all and only
   `QD1G068MX7/overlays/locales/{locale}.json`; no root, config, content,
   publication, support, or other instance object changed.
10. A fresh independent agent re-read R2, active code/docs, focused tests,
    Worker deploys, and both cleanup runs. It returned GREEN for V1–V8 and found
    no active locale-package authority. Its one wording finding
    (`translated and materialized`) was removed from the living Translation
    Agent operator doc before closure.

The old public responses were generated directly by the Worker from its R2
binding; the route never used `fetch()` or the Cache API. Repeated retired URL
reads have no `CF-Cache-Status` or `Age`, carry `cache-control: no-store`, and
return 404 from the deployed Worker. A local purge request and the later
purge-only GitHub Actions run `30568327401` were rejected with HTTP 401 before
mutation. That failed run deleted nothing and changed no product data. There is
no CDN-cached locale-package layer to preserve or purge; the one-use cleanup
workflow and script are removed after the successful R2 operation.

### Independent core-violation result

| ID | Result | Reconciliation |
| --- | --- | --- |
| V1 Silent substitution | GREEN | Exact requested overlay or explicit failure; no invented locale state. |
| V2 Silent healing | GREEN | Transitional overlay bodies were repaired only through the named exact write authority with value hashes preserved. |
| V3 Silent omission | GREEN | All 400 manifest keys were deleted; all 144 legitimate overlays and 9 root packages were reconciled. |
| V4 Fail-open control | GREEN | Missing overlay is 404 and corrupt overlay is 500; neither falls back to base. |
| V5 Corruption-as-absence | GREEN | Invalid stored locale state is not treated as missing or replaced. |
| V6 Partial-success masquerade | GREEN | Generation reports exact translated/failed locale outcomes; cleanup and smoke evidence name their complete scope. |
| V7 Masquerade/redress | GREEN | Locale-package routes, helpers, result types, workflow, and script are removed rather than renamed or wrapped. |
| V8 Runtime test dependency | GREEN | Normal delivery uses root runtime plus exact overlay; tests and inventory probes remain verification only. |

Current 126G correction: the historical Dieter builder, generated
`tokyo/product/dieter/**` mirror, manifest, editor bundle, and shared CDN
token/component files are being removed. Current source consumers compile or
materialize Dieter directly; only `dieter/icons/svg/**` is deployed. Historical
evidence below remains point-in-time evidence and is not current execution
authority.

Read-order note: this is a pre-execution correction ledger, not runtime or
product authority. Runtime code remains behavior truth; the human product owner
accepts product/architecture law and assigns it to the appropriate living doc or
final PRD. This file sits in `02-Executing/` as part of the repo pipeline topology;
that folder name does not make this work execution.

---

## 1. Headline

Substantial A-H foundation code changes landed prematurely during Phase 1. The
renewed read-only pass then completed across A-M: every domain has a current gap
and deletion map, a final executable PRD, and an exact-tree three-lens GREEN
review. Reviewed trees are A `c06fa7db`; B `4b480e50`; C `b5efaefc`; D
`31b81152`; E `ec1ed486`; F/G/H `4c5458b4`; I/J/K/L/M `22a92ec9`.

Step 9 subsequently began through the accepted one-domain-at-a-time process.
126A through 126M are now independently executed, verified,
documented, and GREEN. 126E was intentionally a no-product-code preservation
and ownership checkpoint. 126G deleted the legacy generated Dieter delivery
system and established direct source consumption plus icon-only R2 delivery.
126F then closed the remaining reduced-motion pseudo-element gap without adding
motion machinery. 126H removed the final dead focus-width token reference and
stale manifest count without changing visible focus. 126I then deleted dead
component behavior, converted fake controls to native controls, added only
three small CSS contracts, and reconciled the generated 3/22/2 DevStudio
inventory. 126J then delivered Bob's Full, Compact, and unsupported workspace
composition with one ToolDrawer and no responsive framework. 126K replaced
local modal wrappers and in-app confirms with native dialogs, preserved each
workflow's exact dismissal law, and connected Upgrade to one honest Roma
scaffold. 126L completed the DevStudio Full/Compact/unsupported shell and
adopted the small operational field/table contracts without adding a shell
framework or new test machinery. 126M then completed Roma's matching one-tree
shell, adopted the same small field/table contracts, deleted dead local control
CSS, and closed the deployed Roma/Bob/DevStudio workspace matrix. The historical pre-execution
findings below remain the record of why earlier code changes did not receive
execution credit before that formal pass.

1. **The 126 process was not followed.** The human has now confirmed that every A–M
   domain completes steps 1–8 before step 9 begins. A–H code changes landed while
   I–M remained baseline or directional documents. Those changes receive no step-9
   execution credit.
2. **The review bar was applied inconsistently.** A pre-execution review may be
   GREEN while naming code that the accepted PRD is explicitly designed to change.
   It should not be GREEN while a required human decision, mandated blast-radius
   coverage, or required execution precondition remains unresolved.
3. **The 126 status docs were stale before this realignment.** Every A-H PRD said
   `PRE-EXECUTION READY`, but their as-builts predated later code changes. The
   renewed current-source read, D1/D2/D3 propagation, exact gap maps, final PRDs,
   and exact-tree reviews completed across A-M before formal Step 9 began.
4. **The 126I pivot-layer input errors are now proven and corrected in active
   decision docs:** current source has 25 directories including `shared`, no
   `command-activity`, and no current `--color-surface`, `--radius-2`, or
   `--hspace-*` component references.
5. **The font-migration evidence question is closed.** Authenticated Roma routes show
   all seven fonts as `CLICKEEN` account assets; widget defaults expose the account
   font library; `QD1G068MX7` and its public runtime use account-asset URLs. The
   untracked local copies are non-deployed workspace residue outside 126 execution,
   not migration input or a pending product task.
6. **Product-owner convergence is complete.** D1 defines dialog dismissal, D2
   defines global workspace capability, and D3 keeps Upgrade connected to one
   honest pre-GA upsell scaffold. No new A-H product decision is open.

---

## 2. What The Review And Premature Code-Change Sequence Proves

### Commit timeline (Jun 28–29)

All eight GREEN peer-review commits land before the first premature code-change commit.
However, Git history does not prove that the reviews examined the detailed PRD
versions later committed by `5688403c`: tracked 126D–H PRDs were still short
directional skeletons at the review commits, while the reviews describe
"human-converged" documents. The reviewed working-tree content/tree is not recorded.
Code changes then continue and are corrected through subsequent commits.
This ordering is Git evidence; it is not review-provenance or deployment evidence.

| Time (Jun 28–29) | SHA | Commit |
|---|---|---|
| 15:27–15:39 | `ec699533`…`4e752989` | docs(126A–H): peer review — all GREEN (8 commits) |
| 22:27 | `5688403c` | commit labeled `feat(126A-D): execute UI foundation slices`; under the confirmed process this is a premature Phase-1 code change, not step-9 execution |
| 22:52–23:08 | `866c6be9`…`76af1ed4` | temporary Roma locale-package route work |
| 23:33–02:12 | `b132dfde`…`c299c783` | remove temporary route and continue/correct 126D–H code changes |

The ordering is unambiguous. Whether any intermediate commit reached a Cloudflare
runtime before the next commit requires GitHub Actions/Cloudflare deployment evidence
and is not asserted here.

### What GREEN meant, and where it was too permissive

The 126F, 126G, and 126H reviews were pre-execution reviews of final-PRD readiness.
Naming current code gaps and routing them to an exact future step-9 target is
compatible with a GREEN review. Later premature code changes addressing those gaps
do not convert the reviews or changes into execution.

The reviews were too permissive where they recorded unresolved prerequisites and
still returned GREEN:

- The 126F review says the easing value remains human-owned and that its future
  step-9 change is blocked until the human chooses it.
- The 126F–H reviews say structured blast-radius and V1–V8 sections described by
  the draft parent are absent, yet still label the PRDs execution-ready.
- The human-confirmed process requires every A–M domain to reach step 8 before
  step-9 execution. I–M had not done so.
- The reviewed tree/hash is absent, so the GREEN commits do not prove that the
  executable PRD versions committed later received peer review.

The reviews also correctly named future code targets that premature commits later
addressed. Those changes remain current as-built input for re-audit:

- **126F GREEN** named: "2 dead duration tokens, button untokenized (3× literal
  `150ms ease`), `--easing-standard` dangling (referenced, never defined), repeater
  JS inline transitions bypassing reduced-motion." → `5da0a36d fix(126F): align
  system motion law` fixes every one of these.
- **126G GREEN** named: "remove the `unknown` gitSha fallback, remove stale
  bridge-era/local-upload concepts and refusal guards." → `de408dda fix(126G):
  simplify ui ops pipeline truth` fixes all of these.
- **126H GREEN** named: "de-scope/delete `--focus-ring-*`, remove the numeric
  alias concept." → `c299c783 fix(126H): clean Dieter foundation substrate`
  removes `--radius-3/4`, `--focus-ring-*`, `--min-touch-target`.

**Verified in code:** `dieter/tokens/dieter-foundation-tokens.css:71-73` now
defines `--duration-snap: 140ms`, `--duration-base: 160ms`, and
`--easing-standard: ease`, confirming that current source changed.

### The first premature code-change commit was documentation-heavy

`5688403c` touched approximately 19.5k changed Markdown lines and 10.5k changed
non-Markdown lines. That is a scope/commit-shaping signal, not proof that the code
work was invalid. The commit combined pre-execution corpus changes with broad product
code changes, which blurred the phase boundary and made review harder. Later commits changed or
corrected several behaviors:

| Commit | What Git history proves |
|---|---|
| `caa0a6bf fix(126D)` | Corrected account-font preview/asset resolution after `5688403c`; `ResolvedAccountAsset` gained the metadata required to distinguish font assets. |
| `0c71faa9 fix(126E)` | Added missing translation terminal feedback and corrected Save command visibility after `5688403c`. |
| `866c6be9`…`76af1ed4`, removed by `b132dfde` | A temporary 219-line Roma locale-package refresh route was added after `5688403c`, expanded in two commits, and then deleted. It was not introduced by `5688403c`. |

**Human-confirmed gate rule:** a named code gap may be routed to future step-9
execution when the reviewed PRD specifies the intended result, blast radius, deletion
boundary, and verification. An unresolved human decision or mandatory pre-execution
artifact may not receive GREEN. The reviewed commit/tree must be recorded. No code or
product-data mutation resumes until every A–M domain completes steps 1–8.

---

## 3. Status-Doc Sweep — Every A–H Status Line Vs. Code Reality

Before this correction, every A–H PRD carried the identical status line
`PRE-EXECUTION READY - three-lane review green`, and each audit carried a READY/current
variant. Slice-related code changes had landed after those status lines were written.

### Original status lines found before correction

| Slice | PRD status (`126X__PRD__*.md:3`) | Audit status (`audits/126X__Audit__*.md:3`) |
|---|---|---|
| 126A | `PRE-EXECUTION READY - three-lane review green.` | `CODEX PRE-EXECUTION AUDIT - three-lane review green.` |
| 126B | `PRE-EXECUTION READY - three-lane review green.` | `CODEX PRE-EXECUTION AUDIT - three-lane review green.` |
| 126C | `PRE-EXECUTION READY - three-lane review green.` | `PRE-EXECUTION READY - three-lane review green.` |
| 126D | `PRE-EXECUTION READY - three-lane review green.` | `CODEX PRE-EXECUTION AUDIT - three-lane review green.` |
| 126E | `PRE-EXECUTION READY - three-lane review green.` | `CODEX PRE-EXECUTION AUDIT - three-lane review green.` |
| **126F** | `PRE-EXECUTION READY - three-lane review green.` | **`FROZEN PRE-EXECUTION AUDIT - not current source truth after 126F execution.`** |
| 126G | `PRE-EXECUTION READY - three-lane review green.` | `CODEX PRE-EXECUTION AUDIT - current execution map.` |
| 126H | `PRE-EXECUTION READY - three-lane review green.` | `CODEX PRE-EXECUTION AUDIT - three-lane review green.` |

### The original 126F internal contradiction (verified and now corrected)

- `126F__PRD__Motion.md:3`: `Status: PRE-EXECUTION READY - three-lane review green.`
- `audits/126F__Audit__Motion.md:5`:
  `Status: FROZEN PRE-EXECUTION AUDIT - not current source truth after 126F execution.`
  That wording incorrectly grants execution credit. Lines 11–17 describe outcomes
  after premature code changes:
  "`--easing-standard` is defined as a foundation token, `--duration-spin` is
  removed... system motion literals were replaced by Dieter motion tokens."

**Code truth (`dieter/tokens/dieter-foundation-tokens.css:71-73`):**
`--duration-snap`, `--duration-base`, and `--easing-standard: ease` are all defined.
Motion-related code changes landed. **Neither old status was correct: the PRD was
not pre-execution-ready, and the audit could not call the changes execution. The
fresh current-source pass and every later pre-execution gate required by that
finding were completed before formal Step 9 began.**

### Corrections applied

The realignment status lines kept all A-H slices in pre-execution. Code changes
existed, but they landed before the all-domain gate and received no Step-9
credit. Human convergence and Steps 5-8 completed across A-M at the reviewed
trees recorded in §1 before formal Step 9 began. The current execution status
is owned by the document header and §1.
A public read on 2026-07-14 confirmed
`https://tokyo.dev.clickeen.com/dieter/manifest.json` reports Git SHA `c299c783`,
which proves that the currently deployed Dieter bytes are observable at the public
Tokyo product root. The corresponding GitHub Actions deploy run has not been verified on this
machine, and the public read does not convert premature changes into execution.
Initial convention applied during the realignment, before later Step-5/6/7
progress (historical wording, not the current status authority):

```text
Status: PRE-EXECUTION CURRENT SOURCE RE-AUDITED - settled law retained; step-5 doctrine and step-6/7/8 artifacts pending; no step-9 execution credit.
```

126D additionally records the authenticated read-only evidence that the account-font
migration is complete. This closes the former product-data uncertainty but grants no
execution credit.

Audit and historical as-built/review status lines were normalized to frozen
point-in-time conventions. They are evidence, not current readiness authority:

```text
Status: FROZEN POINT-IN-TIME PRE-EXECUTION AUDIT — code changed afterward; no execution credit; see provenance note and current source.
```

---

## 4. Foundation Convergence Signals Are Real

This is not inferred from status lines. A drift read cross-checked every
`var(--...)` in Roma/Bob/Admin against the custom properties defined across
`dieter/tokens/*.css`. These are current-state inputs to the renewed pre-execution
audit. They do not prove implementation completion or replace later step-9 verification.

| Signal | Severity | Evidence |
|---|---|---|
| Hardcoded hex colors in inspected operational app source | **clean in inspected scope** | 0 raw hex in `roma/app/roma.css`, `bob/app/bob_app.css`, `admin/src/css/*.css`, or inspected app TSX. Dieter component CSS retains intentional hue-spectrum stops at `dieter/components/dropdown-fill/dropdown-fill.css:603-610`. This does not claim all product/widget CSS is hex-free. |
| Typography delivery | **multiple intentional lanes, explicit** | Operational UI uses the complete Dieter visual classes with no font-family variables or technical-value monospace exception. Roma and Bob use `next/font` only to deliver Inter Tight files (`roma/app/layout.tsx`, `bob/app/layout.tsx`); DevStudio imports the same font directly. Public-widget account-font delivery is separately proven through account assets. One delivery path is neither required nor planned. |
| Dieter token consumption | **shared source, different delivery** | Roma links the Tokyo Dieter root, Bob links its `/dieter` surface, and DevStudio bundles local Dieter source. All consume the Dieter token package, but this scan does not claim byte/provenance parity across those delivery lanes. |
| Current phantom component-token references | **clean** | Current `dieter/components/**/*.css` has 0 references to `--color-surface`, `--radius-2`, or `--hspace-*`. Historical source did contain them; see §6. |
| Ghost/undefined `var()` refs | **low** | 1 real ghost: `admin/src/css/utilities.css:74` references `--shadow-lg` (undefined; has fallback so it renders). Dieter defines `--shadow-elevated`/`--shadow-floating`/`--shadow-inset-control` (`dieter-foundation-tokens.css:76-78`), not `--shadow-lg`. |
| Parallel component systems | **med** | See §5. |

**Current contract/consumer evidence:** the `--btn-bg`/`--btn-color`/
`--btn-hover-*` pattern at `dieter/components/button/button.css:8-18` is an observed
source/consumer override contract used by `admin/src/css/layout.css:121-122`.
Preserve it unless a human-approved contract change includes every consumer; do not
delete it merely because it resembles an alias.

---

## 5. Roma Inventory Questions And Convergence

The drift read identified local Roma UI families for 126M classification. The
converged rule does not treat every `.roma-*` class as legacy or pretend one
class represents a parallel component system.

- **39 distinct `.roma-*` selectors** are defined in `roma/app/roma.css`. Roma also
  carries separate `.rd-*` shell/layout selectors and a substantial
  `.widget-defaults-*` control family, so `.roma-*` alone is not the full inventory.
- Bob has no `.bob-*` parallel namespace and consumes Dieter controls extensively.
  That is a useful comparison, not proof that every Bob or Roma surface has already
  converged.
- `.roma-input` is used for text inputs and selects. Its text-input role overlaps
  Dieter Textfield, but `diet-textfield` is structured component markup, not a class
  that can safely replace `.roma-input` in place. Selects require a separate product
  decision.
- Widget Defaults currently renders the compiled Bob/Dieter control package. The
  old hand-written input, textarea, and toggle rules under `.widget-defaults-*` are
  dead CSS deletion targets. Active `.widget-defaults-*` host/layout rules remain
  legitimate Roma composition and must not be deleted with the dead controls.
- `.roma-table`, `.roma-card`, `.roma-modal`, `.roma-toolbar`, and `.roma-nav*`
  were classified during convergence: Dieter owns the bounded shared table,
  field, and dialog mechanics; Roma retains application layout, state, and
  specialized composition.

**QA conclusion:** the complete Roma inventory is carried into 126M, the
mandatory ownership boundary is recorded in the owner register, and the
accepted D1/D3 outcomes now govern Roma dismissal and upsell behavior.

---

## 6. 126I Historical Input Corrections Applied

The original 126I convergence inputs contained two inventory errors and a set of
valid point-in-time findings presented as current. Active decision inputs are now
corrected. Historical audits remain point-in-time evidence; the exact uncommitted
working tree they inspected may be unknown.

### Current input 1: `command-activity` does not exist now

Both as-builts and the PRD cite `command-activity` as a known gap ("empty dead
directory"). It does not exist in the current worktree or tracked tree. Verified via
`ls`, `test -d`, and `find`; `git log` shows tracked source was replaced by
`agent-activity` in commit `8375e93a`. Because Git does not track empty directories
and the audit working tree is unrecorded, this does not prove the historical auditors
did not see an empty local directory.

| File | Applied treatment |
|---|---|
| `126I__PRD__Components.md` | `command-activity` removed from current inventory/gaps; tracked source uses `agent-activity`. |
| `audits/126I__AsBuilt_Codex.md` | Preserve the observation; annotate that exact working-tree provenance is unknown and current/tracked source has no directory. |
| `audits/126I__AsBuilt_GLM.md` | Preserve and annotate using the same provenance rule. |

### Historical input 2: pre-126G component count evidence

This table records the pre-126G generated-tree audit. The generated manifest and
Tokyo Dieter mirror no longer exist and are not current authorities. Current
active decision documents use the 25 source directories directly. Historical
counts may include an untracked empty directory, so preserve them as
point-in-time observations with unknown exact worktree provenance rather than
silently rewriting history.

| Inventory | Codex claim | GLM claim | Code truth | Evidence |
|---|---|---|---|---|
| Source dirs under `dieter/components/` | 26 (incl. `shared` + empty `command-activity`) | 27 | **25** | `ls -d dieter/components/*/` → 25 entries |
| Historical `manifest.json components` | 24 | — | 24 at audit time | Deleted by 126G |
| Historical `manifest.json componentsWithJs` | 20 | ~20 | 20 at audit time | Deleted by 126G |
| DevStudio `specModules` | 22 | ~24 | 22 ✓ | `admin/src/data/componentRegistry.generated.ts:73-96` |
| DevStudio `templateModules` | 23 | — | 23 ✓ | `componentRegistry.generated.ts:98-122` |
| DevStudio `cssModules` | 24 | — | 24 ✓ | `componentRegistry.generated.ts:124-149` |

The 25 actual dirs: agent-activity, bulk-edit, button, choice-tiles,
dropdown-actions, dropdown-border, dropdown-edit, dropdown-fill,
dropdown-shadow, dropdown-upload, icon, menuactions, object-manager, popaddlink,
popover, repeater, segmented, shared, slider, tabs, textedit, textfield,
textrename, toggle, valuefield.

| File | Applied treatment |
|---|---|
| `126I__PRD__Components.md` | Current source count set to 25; other inventories qualified. |
| `documentation/engineering/UI/components.md` | Current catalog count set to 25; current `command-activity` entry removed. |
| `audits/126I__AsBuilt_{Codex,GLM}.md` | Preserve historical counts; annotate current count and unknown exact working-tree provenance. |

### Stale input 3: historical CSS-variable findings were later fixed

The historical PRD and Codex as-built listed `--color-surface`, `--radius-2`, and
`--hspace-*` as current drift. Active PRD/living inputs are now corrected and
current source has zero hits, but these were not
invented audit findings: source at `75a5872b` contained all three patterns. Later
126 commits corrected them. The current baseline must mark them resolved; the
historical as-built must retain them with a provenance/superseded note; use an exact
source SHA only if it is recoverable.

Current source contains the following canonical token families, but QA does not
claim they are one-for-one semantic replacements for the old names:

| Cited (absent) | Current defined example/family | Evidence |
|---|---|---|
| `--color-surface` | `--role-surface` | `dieter/tokens/dieter-color-tokens.css:11` |
| `--radius-2` | `--control-radius-sm` | `dieter/tokens/dieter-foundation-tokens.css:46` |
| `--hspace-*` | `--vertspace-*` | `dieter/tokens/dieter-foundation-tokens.css:17-25` |

| File | Applied treatment |
|---|---|
| `126I__PRD__Components.md` | Names removed from the current-gap list and retained as resolved historical findings. |
| `audits/126I__AsBuilt_Codex.md` | Preserve the findings and annotate that later commits resolved them. Record the inspected source SHA only if recoverable; otherwise state that the exact working tree is unknown and cite the nearest Git evidence. |
| `audits/126I__AsBuilt_GLM.md` | Preserve point-in-time findings with the same provenance discipline; do not rewrite historical evidence to current source. |

**The real styling observations** (which the PRD should name instead, at line 88):
1. All z-index values are component-local and some share numeric values:
   `bulk-edit.css:20 z-index: 1000`, `object-manager.css:25 z-index: 1000`,
   `popover.css:16 z-index: 12`, and `textedit.css:119 z-index: 12`. This is a
   stacking-context question for 126J/126K convergence. The evidence does not by
   itself require a new global z-index token layer.
2. Hardcoded modal/surface widths: `bulk-edit.css:32 width: min(96vw, 980px)`,
   `object-manager.css:36-37 min-width: 320px; max-width: 520px`,
   `popaddlink.css:7 max-width: 360px`, `popover.css:34 inline-size: min(320px, 100%)`.
3. Redundant `var(--vertspace-N, …)` fallbacks in 11 component CSS files even
   though the token is defined (cosmetic).
4. Raw rgba shadow fallback at `textedit.css:167` (token `--shadow-floating` is
   defined, so the fallback is redundant).
5. Raw hue-rainbow gradient at `dropdown-fill.css:603-610` — intrinsic to the
   color-picker, likely intentional but untokenized.

---

## 7. Human-Convergence Boundary After Current-Source Re-Audit

The renewed pass removed false owner choices. Product law and current evidence
already decide the following:

- Toggle remains native checkbox HTML/CSS/spec; its unused custom Enter-key
  hydrator is deleted rather than exported into a new keyboard program.
- `textrename` has no current product consumer and is deleted rather than turned
  into a governance project.
- `repeater` and `object-manager` are distinct, active product workflows. Both
  stay; their exact component dependencies must be declared.
- Component-local stacking stays local unless the final dialog/surface gap map
  proves a shared mechanic is required. No global z-index scale is authorized.
- The component count is 25 source directories including `shared`; the runtime
  manifest contains 24 components. `command-activity` is absent.
- ToolDrawer specs, surface vocabulary, app/Dieter ownership, overlay semantics,
  dialog lifecycle correctness, tooltips, native dropdown triggers, and Bob-only
  translation attention are mandatory law, not owner choices.

Product judgment is complete for D1/D2/D3 in
`126__Product_Owner_Execution_Decisions.md`:

1. the accepted row-by-row blocking-dialog dismissal policy;
2. global operational workspace capability across Roma, Bob, and DevStudio;
3. legitimate Upgrade actions open or transition to the shared pre-GA upsell
   dialog scaffold without implying a working billing operation.

Operational native fields and operational table appearance are not owner
alternatives: Dieter-only design-system law requires the small shared visual
contracts and the register now records them as mandatory execution law.

This corrected boundary prevents implementation details, dead code, and semantic
correctness from being presented to the product owner as optional architecture.

---

## 8. Font-Migration Tail - Read-Only Evidence Closed

### What `b132dfde` already removed
- `tokyo-worker/src/asset-utils.ts`: removed `handleGetTokyoFontAsset` +
  `normalizeTokyoFontKey` (−25 lines).
- `tokyo-worker/src/routes/asset-routes.ts`: removed `/fonts/` route branch (−11).
- `tokyo-worker/wrangler.toml`: removed `/fonts/*` route.
- `roma/app/api/.../translations/packages/route.ts`: deleted the entire temporary
  route handler (−219 lines).
- Docs updated: `documentation/capabilities/localization.md` (−35), `services/bob.md`,
  `services/roma.md`.

**Verified current state:** `grep -rn '/fonts' tokyo-worker/src/` returns nothing.
`grep -n 'fonts' tokyo-worker/wrangler.toml` returns nothing. The `/fonts` edge
route is fully gone from code and config.

### Local residue

1. **Untracked local folder:** `tokyo/product/fonts/special/` (7 font files:
   `Frari.woff2`, `Giudecca.woff`, `Marin.woff`, `Orio.woff`, `Pachuka.woff2`,
   `Pachuka_line.woff2`, `Rialto.woff2`). Commit `5688403c` deleted these seven
   files from Git while temporarily retaining the Tokyo `/fonts` route because its
   commit record says remote inventory still used Orio and Pachuka Line. Copies are
   present untracked on this machine. `b132dfde` later removed the route.
   - **Not in the deploy-sync roots:** `scripts/tokyo-r2-deploy-sync.mjs:24-27`
     syncs only `tokyo/product/widgets`, `dieter/icons/svg`, `tokyo/roma`, and
     `tokyo/prague`. There is no `tokyo/product/fonts` root. These files do not
     deploy to R2 through the current sync.
   - **Not referenced in live source:** a scoped grep for the font names
     (Frari/Giudecca/Marin/Orio/Pachuka/Rialto) across `roma/`, `bob/`,
     `tokyo-worker/src/`, `packages/`, `dieter/`, `tokyo/product/widgets/`,
     `admin/src/` returns no hits (excluding false positives like
     `Europe/San_Marino` matching "Marin"). No live product code references them.
   - **Not in `.gitignore`:** the folder is simply untracked.

2. **Instance `QD1G068MX7`** currently uses Orio + Pachuka Line through the
   account font library. Its public `runtime.js` resolves both through
   `https://tokyo.dev.clickeen.com/assets/account/CLICKEEN/...`, not a Tokyo
   global font root.

3. **`fontLibrary` wiring is present in source:**
   `roma/lib/account-widget-defaults-direct.ts:10,22,23,33`,
   `roma/lib/account-instance-public-package.ts:264,266,278,328`,
   `roma/lib/account-widget-defaults-materialization.ts:76`,
   `roma/lib/builder-open.ts:14,79`. Source represents fonts as account assets under
   `accounts/{accountPublicId}/assets/...`, and the deprecated `source: 'tokyo'` path
   returns no hits. Authenticated product-route and public-runtime reads confirm this
   contract is active.

### Current conclusion

- `GET /api/account/assets` for `CLICKEEN` returns all seven fonts with the
  expected font MIME/byte records.
- `GET /api/account/widget-defaults` returns the account `fontLibrary` containing
  those account-asset records.
- `GET /api/account/widgets` and Builder-open routes are healthy in the
  authenticated product lane.
- `QD1G068MX7` uses Orio and Pachuka Line; its public runtime embeds the account
  asset URLs.
- No font product-data migration remains. The seven untracked local copies are
  non-deployed workspace residue outside 126D execution and remain untouched.

---

## 9. What Happens Next - Step 9

The execution boundary is now concrete:

1. **Steps 1-8 are complete for all A-M domains.** Each final peer review records
   the exact reviewed commit/tree; no review grants runtime execution credit.
2. **There is no remaining product-owner decision.** D1/D2/D3 and all A-M
   authority, scope, deletion, and verification choices are frozen.
3. **Historical audits remain evidence, not current authority.** The final PRDs,
   current audits, owner register, and this ledger define the Step-9 boundary.
4. **Font migration is closed.** The untracked local copies remain untouched
   outside the 126 execution scope.

### Recommended order
1. Completed: statuses, frozen historical evidence, and product-owner decisions
   are reconciled.
2. Completed: settled law, current-source gap maps, deletion maps, final PRDs,
   and exact-tree peer reviews cover every A-M domain.
3. Completed: 126A through 126M, one slice at a time.
4. Every slice advanced only after its implementation, focused checks, visual
   proof, docs, deploy/runtime evidence, product-data reconciliation where
   applicable, and independent V1-V8 audit were GREEN.
5. Premature A-H changes may be kept, changed, or deleted only according to their
   frozen final PRDs; their presence does not count as prior execution.

---

## 10. Final Program V1-V8 Reconciliation

The independent exact-tree pre-execution review and the completed Step-9
execution audits are GREEN. This document remains a QA/process artifact; runtime
and deployed evidence live in each executed PRD.

| ID | Question | Result |
|---|---|---|
| V1 Silent substitution | Does this doc replace missing/invalid truth with an invented value? | No. Every completion claim points to a current audit, executable PRD, and exact reviewed tree; premature code changes receive no Step-9 credit. |
| V2 Silent healing | Does this doc normalize/coerce invalid state without failure? | No. Historical audits remain point-in-time evidence with recoverable provenance or an explicit unknown-tree note; only active decision inputs are updated. |
| V3 Silent omission | Does this doc drop a required input/artifact/operation? | No. It retains the all-A-M pre-execution gate, complete Roma inventory, review-provenance gap, closed read-only font evidence, mandatory execution law, and accepted D1/D2/D3 decisions. |
| V4 Fail-open control | Does enforcement turn off when a dependency is missing? | N/A — no enforcement added. |
| V5 Corruption-as-absence | Does this doc treat corrupt state as missing/new/empty? | No. The stale status lines are named as drift, not ignored. |
| V6 Partial-success masquerade | Does this doc claim full success after some work was dropped? | No. Steps 1-8 and Step 9 are complete for A-M; 126A through 126M are executed and verified. |
| V7 Masquerade/redress | Does the same failing workflow continue under a different wrapper? | No. Verification cannot mutate code/product data or grant execution credit; exact reviewed-tree provenance is mandatory before step 9. |
| V8 Runtime test dependency | Does normal product work start depending on tests/probes? | No. |

---

## 11. Evidence index

Key claims were checked against current source, Git history, cloud-dev runtime,
and R2 read-back through 2026-07-26.
Runtime/deploy claims are bounded as stated above:

- `--easing-standard` defined: `dieter/tokens/dieter-foundation-tokens.css:71-73`
- Review→code-change continuation/correction ordering: `git log --oneline` (shas in §2)
- Public Dieter artifact observation: `https://tokyo.dev.clickeen.com/dieter/manifest.json` → `gitSha: c299c783...` on 2026-07-14; Actions provenance not verified
- Premature code-change commit doc:code ratio: `git show --stat 5688403c`
- Reviewed-PRD provenance gap: compare PRD blobs at the GREEN review commits with the detailed versions introduced by `5688403c`
- Current token source: `dieter/tokens/{tokens,dieter-color-tokens,dieter-foundation-tokens,dieter-typography}.css`
- Roma UI inventories: `.roma-*`, `.rd-*`, and `.widget-defaults-*` in `roma/app/roma.css`; representative consumers in `roma/components/**`
- `command-activity` absent: `ls dieter/components/` (25 dirs), `git log 8375e93a`
- Former variable names: present at `75a5872b`; absent from current `dieter/components/**/*.css`
- Toggle export gap: `dieter/components/index.ts:2-18`, `admin/src/main.ts:11-27,258-272`
- Temporary locale-package route chronology: `git show 866c6be9 617099ba 76af1ed4 b132dfde`
- Font route removed: `tokyo-worker/wrangler.toml` (no `/fonts`), `git show b132dfde`
- Font migration law: `126D__PRD__Typography.md:218-223,530-560`
- Deploy-sync roots: `scripts/tokyo-r2-deploy-sync.mjs:24-27`
- `fontLibrary` source wiring: `roma/lib/account-widget-defaults-direct.ts:10,22,23,33`, `roma/lib/account-instance-public-package.ts:264,266,278,328`
- Authenticated Roma evidence: `/api/account/assets`,
  `/api/account/widget-defaults`, `/api/account/widgets`, and Builder-open routes
  for `CLICKEEN` on 2026-07-14.
- Public font runtime evidence:
  `https://dev.clk.live/CLICKEEN/QD1G068MX7/runtime.js` uses Tokyo account-asset
  URLs for Orio and Pachuka Line.
- Human decision boundary:
  `126__Product_Owner_Execution_Decisions.md`; D1/D2/D3 accepted.
