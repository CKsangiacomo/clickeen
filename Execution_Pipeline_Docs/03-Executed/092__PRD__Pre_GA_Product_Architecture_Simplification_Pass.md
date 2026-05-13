# PRD 092 - Pre-GA Product Architecture Simplification Pass

Status: Executed
Owner: Codex
Date: 2026-05-12
Architecture source: `documentation/architecture/CONTEXT.md`
Strategy source: `documentation/strategy/WhyClickeen.md`
Service sources:
- `documentation/services/roma.md`
- `documentation/services/bob.md`
- `documentation/services/tokyo-worker.md`
- `documentation/services/venice.md`
- `documentation/services/berlin.md`
- `documentation/services/prague.md`
- `documentation/capabilities/seo-geo.md`
Prior simplification PRDs:
- `Execution_Pipeline_Docs/03-Executed/089B__PRD__Product_Path_Boundary_Truth_And_PRD_89_Closure.md`
- `Execution_Pipeline_Docs/03-Executed/090__PRD__Berlin_World_Class_Auth_System.md`
- `Execution_Pipeline_Docs/03-Executed/091__PRD__Codebase_And_Architecture_Simplification_Closure.md`
Additional audit source: `/Users/pietro_macpro_home/Downloads/Clickeen_simplification_audit.md`, reviewed 2026-05-12 against local `HEAD` `09e7d109`
Peer review source: `/Users/pietro_macpro_home/Downloads/PRD_092_review.md`, reviewed 2026-05-12 against local `HEAD` `0e6d620f`

## 1. Purpose

PRD 092 is a pre-GA simplification pass for a repo built through many AI-written PRDs.

The purpose is not to delete anything that looks unfinished. The purpose is to make the product and codebase easier to reason about by preserving documented product intent and removing accidental implementation residue around it.

The governing product spine remains:

```text
Roma account shell
  -> Bob Builder editor kernel
  -> Roma account save/orchestration boundary
  -> Tokyo-worker saved instance and published artifact authority
  -> Venice public iframe/embed runtime
```

Supporting services keep their current ownership:

- Berlin owns auth, sessions, account bootstrap, and account authz capsules.
- Prague owns marketing, SEO pages, demos, and funnel surfaces.
- San Francisco owns bounded AI transformations.
- Dieter owns UI primitives and tokens.
- Workspace packages own narrow cross-service contracts only when they clarify boundaries.

PRD 092 must produce a simpler product architecture without damaging deliberate SaaS scaffolding, SEO/GEO embed behavior, tier-policy architecture, or future build targets.

The additional simplification audit adds a sharper implementation lens:

- tiny helper duplication has become contract drift;
- duplicated security primitives include one byte-safety footgun;
- Roma still imports Tokyo widget spec truth through `widget-config-contract`;
- Roma route and error-helper boilerplate is a template future agents will copy;
- several small single-caller files are PRD scar tissue rather than architecture;
- Dieter dropdown lifecycle needs a deliberate design primitive, not an accidental cleanup;
- generic overlay abstractions are a Phase B concern, not a GA blocker.

The peer review confirms the direction but changes execution strategy:

- PRD 092 must not execute as one monolithic cleanup pass.
- Wave A is boring simplification and verification hardening.
- Wave B is structural widget-catalog, SEO/GEO capability, policy, and Tokyo boundary work.
- Meta-work must be bounded to files losing, moving, or gaining authority.
- Roma widget-config validation and Tokyo-worker validation must not coexist as two product authorities.

## 2. Corrected Simplification Doctrine

The previous analysis overreached in several places by treating some unfinished-looking code as deletion-worthy before proving whether it was documented product intent.

PRD 092 corrects that. Every target must be classified before change:

| Classification | Meaning | Default action |
|---|---|---|
| Documented product intent | A real current or planned product area described in architecture/service docs | Preserve and make clearer |
| Deliberate scaffold | A future product domain intentionally present before full implementation | Preserve, but make UX honest |
| Current product behavior | A path users or deployed services rely on today | Preserve unless replacing in same slice |
| Enforcement gap | A policy/contract that exists but is not yet enforced everywhere | Implement enforcement or mark blocked |
| Accidental public residue | Stub, placeholder, old route, or fake behavior visible outside internal dev | Remove or hide |
| Duplicate truth | Two authorities for one product fact | Collapse to one authority |
| Self-healing product path | Runtime repairs broken truth instead of failing at a named boundary | Remove from product path |
| Operator repair boundary | Explicit internal repair endpoint/tooling | Preserve only if named and guarded |

## 3. Non-Negotiable Guardrails

1. Documentation first: read the relevant docs before changing each area.
2. Product truth before topology: active callers do not prove a concept belongs.
3. Preserve Roma domain scaffolding unless it conflicts with product truth.
4. Do not delete SEO/GEO embed behavior.
5. Do not flatten Venice into "iframe only" in a way that loses host-page SEO/GEO metadata injection.
6. Do not kill policies because enforcement is incomplete. Finish enforcement or record a blocked gap.
7. Do not delete stubs until they are classified as accidental residue rather than deliberate build targets.
8. Do not create new frameworks, platforms, or generic utilities to simplify local mess.
9. Delete accidental behavior before extracting helpers.
10. Every surviving concern must have one named authority.
11. Generated artifacts are not hand-authored complexity unless the repo intentionally reviews them as source.
12. Each slice must be green before the next slice starts.

## 4. Product Boundaries That Must Survive

### 4.1 Roma

Roma keeps its domain navigation and SaaS product-shell scaffolding:

- `/home`
- `/profile`
- `/widgets`
- `/builder`
- `/assets`
- `/team`
- `/billing`
- `/usage`
- `/ai`
- `/settings`

Simplification may improve empty states, unavailable states, copy, route helpers, and verification. It must not delete Roma domains just because they are not fully commercialized before GA.

Required distinction:

- Good: "Billing exists as planned scaffold; no payment provider configured yet."
- Bad: a dead-end screen pretending billing is fully operational or preserving a fake billing truth.

### 4.2 Venice And SEO/GEO Embed

Venice remains the public iframe/embed runtime and must preserve these current routes:

- `/widget/{instanceId}`
- `/embed/latest/loader.js`
- `/embed/v2/loader.js`
- `/renders/widgets/{instanceId}/live/r.json`
- `/renders/widgets/{instanceId}/config.json`
- `/renders/widgets/{instanceId}/meta/live/{locale}.json`
- `/renders/widgets/{instanceId}/meta/{locale}/{metaFp}.json`
- `/l10n/widgets/{instanceId}/index.json`
- `/l10n/widgets/{instanceId}/{locale}/overlay.json`
- `/widgets/**`
- `/dieter/**`

SEO/GEO embed is real product architecture:

- Prague can opt into indexable embeds with `embedMode="indexable"`.
- The host snippet can use `data-ck-optimization="seo-geo"`.
- Venice loader fetches Tokyo-published pointer/meta bytes.
- Venice injects Schema.org JSON-LD into the host `<head>`.
- Venice injects a readable excerpt into the host DOM.
- UI still renders inside the iframe.
- Missing SEO/GEO bytes must not block iframe render.
- Venice must remain DB-free and must not generate SEO/GEO at request time.

Allowed simplification:

- Deduplicate iframe creation.
- Deduplicate resize handling.
- Deduplicate CSP/load error handling.
- Deduplicate script-level and placeholder-level mount code.
- Remove unused helpers only after proving they are unused.

Forbidden simplification:

- Removing SEO/GEO meta fetch/injection.
- Removing placeholder embed support documented by Venice.
- Removing `/embed/latest/loader.js` while Bob/Prague/docs still use it.
- Moving SEO/GEO generation into Venice request-time logic.

### 4.3 Prague

Prague remains a marketing, SEO, demo, and funnel surface.

Minibob/demo surfaces must not become account users, editor identities, policy profiles, or save-capable product modes. But deliberate marketing/demo scaffolding is allowed.

Required distinction:

- Good scaffold: a block that intentionally reserves space for future marketing content or live account instance embeds.
- Toxic residue: customer-visible "stub", "missing implementation", or fake preview copy that ships as product UX.

PRD 092 may only remove Prague stubs after proving they are accidental public residue and not required by the page composition contract.

### 4.4 Policy And Tier Architecture

Policy architecture must survive and become more enforceable.

The smart pre-GA move is not to delete policies. The smart move is to make each surfaced policy enforceable at the correct product boundary.

Known examples:

- `embed.seoGeo.enabled` is a real entitlement and must remain enforced by Bob/Tokyo-worker/Venice behavior.
- `views.monthly.max` is a real tier policy but remains an enforcement gap unless Venice/public embed telemetry and limit behavior exist.
- `instances.published.max`, storage limits, Copilot turn limits, branding rules, and localization limits must stay aligned with their named owners.

Required behavior:

- A tier policy can exist before GA.
- A tier policy can be hidden from customer-facing surfaces until enforcement is complete.
- A tier policy must not be advertised as active if enforcement is incomplete.
- Enforcement gaps must become explicit work items, not deletion targets.

### 4.5 Tokyo-worker

Tokyo-worker owns account widget instance storage, generated public artifacts, l10n overlays, and publish/unpublish materialization.

Generated artifacts are not source truth:

- `widgets/index.json`
- `published/config.json`
- `l10n/base/{fingerprint}.snapshot.json`
- `seo/meta/**`

Allowed simplification:

- Keep explicit operator repair boundaries.
- Remove automatic self-healing from live product paths.
- Collapse direct artifact mutation routes if they bypass saved/publish transitions.
- Split route files only after behavior is reduced.

Forbidden simplification:

- Removing explicit operator repair boundaries without replacement.
- Treating generated read models as source truth.
- Moving saved config or publish authority to Roma/Bob/Venice.

### 4.6 Bob And San Francisco

Bob remains the editor kernel hosted by Roma.

San Francisco remains the AI transformation service.

Allowed simplification:

- Make Bob hosted-account commands explicit instead of fake local HTTP concepts where that reduces confusion.
- Keep Copilot policy/safety gates that protect real user edits.
- Split San Francisco Copilot logic by real responsibility if the behavior remains the same and verification improves.

Forbidden simplification:

- Creating a second authoring path.
- Treating Copilot/demo/minibob as account ownership truth.
- Removing safety confirmation behavior just because it looks verbose.

## 5. Simplification Targets

### Target A - Evidence Baseline And Bounded Classification Matrix

Before any code changes, create a classification matrix for files that will lose, move, or gain authority.

Do not build a full inventory of every file mentioned by the PRD. Files that are read, verified, or intentionally preserved do not need matrix rows unless the execution slice changes their authority.

Required columns:

- File/path
- Service owner
- Current caller(s)
- Documentation source
- Classification
- Surviving authority
- Proposed action
- Blast radius
- Verification command

Acceptance:

- No target is executed without a classification.
- The matrix is bounded to changed files and authority-moving files.
- The Slice 0 matrix is the execution snapshot; later slices update it only when new evidence changes the planned authority.
- Any "delete" action must cite why the target is not documented product intent, deliberate scaffold, current product behavior, enforcement architecture, or operator repair.

### Target B - Verification Surface

Unify verification so pre-GA simplification is safe.

Required audit:

- Root `pnpm typecheck` coverage by package.
- Root `pnpm lint` coverage by package.
- Root `pnpm test` coverage by package.
- Direct build/typecheck availability for `bob`, `roma`, `venice`, `tokyo-worker`, `sanfrancisco`, `berlin`, `prague`, `dieter`.

Required correction:

- Add missing package scripts only where they run real checks.
- Avoid no-op scripts that create false green.
- Product-path smoke is limited to local checks or explicitly documented credential/env blockers.

Acceptance:

- Every deployable service has a named local verification command.
- Root verification either covers the service or documents why a direct command must be run.
- Cloud-dev/GitHub Actions workflow repair is out of scope unless a local verification script is demonstrably stale because of the workflow.

### Target C - Venice Loader Internal Simplification

Simplify `venice/app/embed/v2/loader.ts` without changing public embed semantics.

Required preservation:

- script-level `data-instance-id` embed.
- placeholder `data-clickeen-id` embed.
- `/embed/latest/loader.js` alias.
- trigger support currently documented/used.
- locale handling.
- iframe render path.
- resize postMessage handling.
- CSP/load error surfacing.
- SEO/GEO meta pointer and pack fetches.
- JSON-LD and excerpt injection.
- non-blocking SEO/GEO failure behavior.

Required correction:

- One iframe factory.
- One resize/error attachment path.
- One mount path parameterized by host element/options.
- Remove unused helpers only after proving they are unused.
- Keep loader script small enough to reason about, but do not chase LOC at the expense of clarity.

Acceptance:

- Venice build/typecheck green.
- Loader route returns JS.
- Placeholder embed still mounts.
- Script-level embed still mounts.
- SEO/GEO mode still attempts pointer/meta fetch and still renders iframe if meta is absent.

### Target D - Roma Scaffold Honesty And Route Boringness

Preserve Roma domains while making scaffolded product areas honest and boring.

Required audit:

- Billing domain.
- Usage domain.
- AI domain.
- Settings domain.
- Home/widgets/builder empty states.

Required correction:

- Keep intentional SaaS scaffolding.
- Remove misleading copy that implies unavailable systems are live.
- Avoid deleting domains as a substitute for finishing product UX.
- Collapse duplicate route helpers only when it deletes local behavior and keeps boundaries clear.

Acceptance:

- Roma build/typecheck green.
- Domain nav remains intact.
- Scaffolded domains are visibly intentional and do not create fake product truth.

### Target E - Prague Stub Classification

Classify Prague stubs and placeholders before deletion.

Required audit:

- Component-level fallback copy.
- Marketing block missing-instance behavior.
- `InstanceEmbed` behavior when `PUBLIC_VENICE_URL` is missing.
- Page composition contracts that intentionally allow missing embeds.

Required correction:

- Deliberate build targets remain.
- Customer-visible accidental stub text is removed, hidden, or turned into build-time failure depending on the contract.
- Minibob remains a demo/funnel surface, not an account authoring surface.

Acceptance:

- Prague build green.
- No public page renders accidental "stub" copy.
- Intentional scaffold states are documented in product language.

### Target F - Customer-Facing Policy Enforcement Readiness

Create an enforcement readiness map for customer-facing policy keys that are advertised, surfaced, or used to gate product behavior before GA.

Do not turn this target into a consulting-style inventory of every policy key. Registry-wide cleanup is a follow-up unless a key is visible to customers or blocks another PRD 092 slice.

Required columns:

- Policy key
- Tier values
- Owner
- Product surface
- Enforcement point
- Current status
- Gap if any
- Pre-GA action

Required correction:

- Do not delete policy keys because enforcement is incomplete.
- Implement missing enforcement only where this PRD can do it safely.
- Otherwise mark the key as blocked with exact owner and required future slice.
- Hide or soften customer-facing claims for policies that are not enforced yet.

Acceptance:

- `embed.seoGeo.enabled` remains enforced and documented.
- `views.monthly.max` has either real Venice/public embed enforcement or a documented blocked implementation plan.
- `instances.published.max` and any currently surfaced creation/publish policy have an enforcement status.
- Registry claims match code behavior.

### Target G - Tokyo-worker Artifact Boundary Audit

Audit Tokyo-worker internal routes and generated artifact writes.

Required classification:

- Product transition route.
- Public read route.
- Queue job.
- Operator repair route.
- Dead/pre-GA compatibility route.
- Direct artifact mutation bypass.

Required correction:

- Product reads must not rebuild or heal generated state.
- Operator repair must be explicit, guarded, and documented.
- Direct artifact mutation bypasses must be deleted or isolated behind an operator-only boundary.
- Generated artifacts must remain derived from source truth.

Acceptance:

- Tokyo-worker direct typecheck green.
- Product save/publish/unpublish routes still work.
- Public read routes still serve published bytes only.
- Index repair remains explicit if retained.

### Target H - Shared Package And Utility Hygiene

Prevent shared packages from becoming dumping grounds.

Required audit:

- `packages/ck-contracts`
- `packages/ck-policy`
- duplicate tiny helpers across app boundaries

Required correction:

- Split shared contracts by real domain only if it reduces coupling.
- Do not move every `isRecord` or `asTrimmedString` into a shared package.
- Keep unknown-to-typed validation at HTTP/storage ingress.
- Trust typed internal calls once data is inside a boundary.

Acceptance:

- Shared package exports remain understandable by domain.
- No new broad `utils` bucket.
- Typecheck green across affected packages.

### Target I - Contract Primitive Drift

Collapse duplicated tiny helpers only where the duplicate is now a contract risk.

Confirmed current `HEAD` examples:

- `isRecord` exists in `ck-contracts`, `ck-policy`, `roma`, `tokyo-worker`, `sanfrancisco`, and `dieter`.
- `asTrimmedString` exists with two different same-name contracts:
  - `string | null` when empty input is not a value.
  - `string` with `''` when empty input is normalized to empty string.
- `asRecord`, `isPlainRecord`, and `isPlainObject` are semantic cousins that increase name drift.

Required correction:

- Prefer one dependency-free contract primitive in `@clickeen/ck-contracts` for unknown-to-record guards.
- Prefer `asTrimmedString(value): string | null` as the shared strict contract.
- Where a caller needs `''`, make that fallback explicit at the caller.
- Do not centralize product-specific validation or domain parsing.
- Do not create a generic utility bucket.

Acceptance:

- The repeated helper count is materially lower.
- No caller silently changes `null`/`''` behavior.
- Contract primitive tests cover object, array, null, blank string, and non-blank string cases.
- Root typecheck green.

### Target J - Security Primitive Single Authority

Security primitives must not exist as local variants.

Confirmed current `HEAD` examples:

- `timingSafeEqual` exists in `sanfrancisco/src/grants.ts`, `sanfrancisco/src/signatures.ts`, and `tokyo-worker/src/auth.ts`.
- Tokyo-worker's string version uses `charCodeAt`, which is ASCII-safe for current tokens but not a byte-level constant-time string primitive.
- `sha256Hex` exists in Bob, `packages/l10n`, and Tokyo-worker.

Required correction:

- Create one narrow dependency-free crypto helper package or one explicitly named crypto module in an existing workspace package.
- Provide byte-level and string-level timing-safe comparison with string input encoded to bytes first.
- Provide `sha256Hex` for string and `ArrayBuffer` inputs.
- Replace local variants.
- Add unit tests for equal, unequal, length-mismatch, and non-ASCII string behavior.

Acceptance:

- No remaining local `timingSafeEqual` implementation outside the shared authority.
- No remaining local `sha256Hex` implementation where the shared helper is runtime-compatible.
- Tokyo-worker auth verification remains green.
- San Francisco grant/signature verification remains green.

### Target K - Roma Orchestrator Truth Import

Roma must not import Tokyo widget spec truth to validate saves.

Peer-review correction: this target is subsumed by Target Q and must execute in the same slice as widget catalog authority. Do not execute this as a standalone Roma cleanup, because that would touch `roma/lib/widget-config-contract.ts` twice and risk preserving two validators.

Confirmed current `HEAD` concern:

- `roma/lib/widget-config-contract.ts` imports `tokyo/product/widgets/*/spec.json`.
- Roma validates widget config before forwarding to Tokyo-worker.
- Tokyo-worker also owns the saved widget instance and validation boundary.
- Tokyo-worker does not currently have the equivalent widget-config validator; the work is to build the Tokyo-worker boundary validator and structured error path, then delete Roma's validator in the same commit/slice.

Why this matters:

- Roma is the account shell and orchestrator, not widget truth owner.
- Adding a widget should not require Roma to import new Tokyo spec files.
- Validation should fail at the Tokyo-worker saved-document boundary and return structured reasons to Roma.

Required correction:

- Build widget config contract validation at the Tokyo-worker saved-instance boundary.
- Roma forwards config and surfaces Tokyo-worker structured errors.
- Delete Roma's widget spec imports and Roma validator in the same commit/slice that lands the Tokyo-worker validator.

Acceptance:

- Roma no longer imports `tokyo/product/widgets/*/spec.json`.
- Tokyo-worker rejects invalid saved config at its boundary.
- Roma surfaces the returned structured error.
- Roma and Tokyo-worker do not both retain active widget-config validators after the slice lands.
- Bob/Roma save path remains green.

### Target L - Roma Route And Error Boilerplate

Reduce copy-paste templates future agents will reuse.

Confirmed current `HEAD` examples:

- `withNoStore` / `withSession` are repeated in multiple Roma route files.
- Several account/session routes proxy Berlin with the same method/path/body/session-cookie pattern.
- `resolveErrorReason` is repeated in Roma components.
- `resolve*ErrorCopy` functions repeat the same reason-key-to-copy pattern.
- `resolveTokyoControlErrorDetail` exists in several forms across Roma and Tokyo-worker.

Required correction:

- Export one Roma route response helper for no-store/session-cookie responses.
- Add a small Berlin account proxy helper only if it removes repeated route behavior without hiding product-specific authorization.
- Add a small reason-key/error-copy helper in the correct shared boundary.
- Keep route files readable as product routes; do not build a generic proxy platform.

Acceptance:

- Repeated Roma boilerplate drops materially.
- Route files still name the product route they implement.
- Error copy maps remain domain-local; only envelope parsing/factory behavior is shared.
- Roma verification green.

### Target M - PRD Micro-Decomposition Cleanup

Some small one-caller files are scar tissue from PRD-by-PRD construction.

This is low-priority cleanup. Inline or merge these files only when a PRD 092 slice already touches the caller or boundary. Do not open a separate sweep only to reduce file count.

Required audit:

- Single-export, single-caller files under Roma/Bob/Tokyo-worker/Berlin/Venice.
- Roma locale helper cluster.
- Small files that make a simple product operation look like a platform.

Required correction:

- Inline or merge only when it reduces cognitive surface.
- Do not merge files that represent a real boundary, public route, or reusable component.
- Do not use LOC count alone as the criterion.

Acceptance:

- The files removed or merged are all single-caller or single-boundary helpers.
- No public import/export contract is broken.
- Affected service verification green.
- No file is touched only because it appears small.

### Target N - Dieter Dropdown Lifecycle Design Gate

Dieter dropdown components show repeated lifecycle scaffolding, but this is a design-system primitive decision, not a casual cleanup.

Required audit:

- `dropdown-actions`
- `dropdown-border`
- `dropdown-edit`
- `dropdown-fill`
- `dropdown-shadow`
- `dropdown-upload`
- related text/edit/choice controls with the same state/install/sync/capture lifecycle shape

Required correction:

- Do not implement a dropdown lifecycle primitive inside PRD 092 unless a short design note proves the primitive reduces complexity without flattening component-specific behavior.
- If approved, create one typed lifecycle helper and migrate incrementally.
- If not approved, record as a separate Dieter PRD.

Acceptance:

- Either no Dieter code changes, with a documented follow-up PRD, or one approved primitive with component tests/build green.
- No component loses accessibility, value sync, or native form behavior.

### Target O - Overlay Primitive Phase-B Deferral

The localization overlay model may need a generic overlay primitive before Phase B, but it is not a GA blocker.

Required stance:

- Do not rename `Localization*` to `Overlay*` during PRD 092.
- Do not introduce generic `OverlaySource` types before an active Phase B product surface needs them.
- Record the finding as a pre-Phase-B architecture task.

Acceptance:

- No GA simplification slice spends time on speculative overlay abstraction.
- The Phase B follow-up notes preserve the rule: stale overlay is unavailable, not fallback.

### Target P - Promise Catch/Silent Swallow Sweep

Classify inline `.catch(...)` usage in product-path files before changing error handling.

This is bounded to Roma account routes, Tokyo-worker domain/product routes, Venice loader/embed paths, and Berlin auth/session paths unless another slice already touches a file.

Required classification:

- correct fail-fast;
- log-and-continue;
- intentional optional data;
- silent swallow that hides broken product truth.

Required correction:

- Remove silent swallows in product paths.
- Keep optional-data catches where absence is expected and user-safe.
- Prefer boundary-level errors over local suppression.

Acceptance:

- Any removed catch has a named boundary behavior.
- No optional UX surface becomes crashy because an optional fetch failed.

### Target Q - Widget Catalog Authority And Hardcoded Type Leaks

Roma, Bob, Tokyo-worker, Venice, Prague, and San Francisco must not become a hardcoded registry of individual widgets.

Correct principle:

- Widget-specific source belongs under the widget-owned authority, primarily `tokyo/product/widgets/*` and any generated catalog/manifest derived from it.
- Roma is the account shell and orchestration surface. It must not import widget spec truth or locally encode the full widget catalog.
- Bob is the generic Builder/editor kernel. It should compile one widget contract at a time from the widget spec, not branch on widget type.
- Tokyo-worker can own account instance creation/defaulting, but it must use a catalog authority rather than a hand-maintained widget switchboard.
- Prague, Venice, and San Francisco may consume widget metadata or generated artifacts, but must not grow per-widget exception tables as product architecture.

Confirmed current `HEAD` examples:

- `roma/lib/widget-config-contract.ts` imports `tokyo/product/widgets/faq/spec.json`, `countdown/spec.json`, and `logoshowcase/spec.json`.
- `roma/lib/widget-config-contract.ts` maintains `ACTIVE_WIDGET_TYPES`, `ACTIVE_WIDGET_DEFAULTS`, and widget-specific validators in Roma.
- `roma/components/widgets-domain.tsx` hardcodes `CREATE_WIDGET_OPTIONS` for three widgets and makes `faq` the special primary empty-state action.
- `tokyo-worker/src/domains/render/account-instance-transitions.ts` imports three widget specs and maintains a hand-authored `WIDGET_SPECS` map.
- Prague display helpers special-case `faq -> FAQ` instead of using catalog display metadata.
- `sanfrancisco/src/agents/csPromptPayload.ts` contains FAQ-biased content vocabulary that should come from widget/agent metadata if it becomes widget-aware behavior.

Required correction:

- Add or identify the single widget catalog authority used by product services.
- Roma create surfaces must read widget options from catalog/account policy, not a local static array.
- Tokyo-worker default creation must read defaults from catalog/spec authority, not a manually maintained `WIDGET_SPECS` table.
- Roma must stop validating widget configs from imported Tokyo specs; Tokyo-worker remains the saved-instance validation boundary.
- Prague labels must come from catalog display metadata when available.
- San Francisco widget-aware prompt behavior must come from explicit widget metadata or remain generic; do not grow a widget-name regex.
- Bob's spec-driven compiler path should be preserved as the reference pattern.

Acceptance:

- Adding a fourth widget does not require editing Roma source.
- Adding a fourth widget does not require editing a Tokyo-worker hardcoded widget map.
- Roma create UI can represent more than the first three widgets without code changes.
- Account policy can filter catalog visibility before a widget is offered to a user.
- Bob remains generic and has no product-path widget-type switch.
- Any remaining widget-name literal outside widget-owned source is classified as fixture, documentation, migration history, display fallback, or a blocked finding.

### Target R - Widget-Owned SEO/GEO Capability Dispatch

SEO/GEO embed behavior is real product architecture and must survive, but central widget-specific SEO/GEO switchboards must not grow forever.

Confirmed current `HEAD` examples:

- `tokyo-worker/src/domains/account-localization-mirror.ts` contains FAQ-specific and Countdown-specific excerpt/schema generation.
- `venice/lib/schema/index.ts` imports FAQ and Countdown schema/excerpt generators directly.

Required correction:

- Preserve SEO/GEO pointer/meta publishing and Venice host-page injection.
- Move per-widget SEO/GEO generation behind widget-owned capability metadata or a generated registry derived from widget-owned source.
- Keep Tokyo-worker as the write-time/meta-pack generation authority.
- Keep Venice DB-free and request-time generation-free; Venice should serve/inject published bytes or explicitly documented static capability output, not infer widget semantics at request time.
- Do not force every widget into one generic schema format if a widget needs custom Schema.org output.
- Do not delete FAQ/Countdown SEO/GEO behavior while removing the central switchboard.

Acceptance:

- FAQ and Countdown SEO/GEO behavior remains green.
- Adding another SEO/GEO-capable widget does not require adding a new central `if widgetType === ...` branch in Tokyo-worker.
- Venice does not need a growing per-widget schema import list to inject published SEO/GEO metadata.
- Missing SEO/GEO bytes remain non-blocking for iframe render.

### Target S - Catalog Labels, UX Scale, And Agent Metadata

Widget scale is a product UX problem, not only a code topology problem.

Required audit:

- Roma widget picker/create entry points.
- Roma empty states.
- Prague public widget display names.
- San Francisco prompt/context vocabulary.
- Bob compiled-widget route and compiler path.

Required correction:

- Replace hardcoded first-three-widget UX with catalog-driven labels, descriptions, grouping, and account-policy visibility.
- Preserve Bob's spec-driven compiler route as the scalable model.
- Keep Prague label fallbacks boring, but prefer catalog display metadata over widget-name string exceptions.
- Keep San Francisco generic unless a widget capability explicitly supplies agent guidance.
- Do not build a speculative marketplace/search platform unless the existing Roma product UX requires it for the current catalog scale.

Acceptance:

- Current three widgets still render/create/edit.
- The UX path has a clear boring extension path for 200 widgets: catalog metadata, account policy, grouping/search if needed, and one-widget-at-a-time editing.
- No new per-widget hardcoded UX list is introduced outside widget-owned fixtures or tests.

## 6. Execution Slices

Each slice must be green before the next starts.

PRD 092 executes in two waves. Do not run all slices as one continuous cleanup session.

Wave A - boring simplification and safety rails:

- Slice 0 - Documentation And Evidence Baseline
- Slice 1 - Verification Coverage
- Slice 2 - Contract And Security Primitive Convergence
- Slice 7 - Venice Loader Simplification With SEO/GEO Preservation
- Slice 8 - Roma Scaffold Honesty
- Slice 9 - Prague Stub Classification And Cleanup
- Slice 12 - Shared Contract Hygiene
- Slice 13 - Final Product-Path Verification for Wave A

Wave B - structural architecture work:

- Slice 3 - Roma Route And Error Boilerplate Cleanup
- Slice 4 - Widget Catalog Authority And Create Flow
- Slice 5 - Widget-Owned SEO/GEO Dispatch
- Slice 6 - Catalog Labels, UX Scale, And Agent Metadata
- Slice 10 - Policy Enforcement Readiness
- Slice 11 - Tokyo-worker Artifact Boundary Simplification
- Slice 13 - Final Product-Path Verification for Wave B

Wave B requires a fresh review checkpoint after Wave A. The widget catalog and SEO/GEO slices are correct architecture, but they are not routine LOC reduction.

### Slice 0 - Documentation And Evidence Baseline

Purpose:

- Rebuild the simplification target list from current `HEAD`.
- Tie every target to documentation or prove it is undocumented residue.

Required commands:

```bash
git status --short
rg -n "SEO/GEO|seoGeo|embed.seoGeo|views.monthly|stub|placeholder|not available|scaffold|rebuild|repair|compat|legacy|widget-config-contract|CREATE_WIDGET_OPTIONS|ACTIVE_WIDGET_TYPES|WIDGET_SPECS|generateMetaPack|widgetType ===|case 'faq'|case 'countdown'|timingSafeEqual|sha256Hex|function isRecord|function asTrimmedString|withNoStore|resolveErrorReason|resolveTokyoControlErrorDetail|\\.catch\\(" documentation roma bob prague venice tokyo-worker berlin sanfrancisco packages dieter
pnpm typecheck
pnpm lint
pnpm test
```

Acceptance:

- A classification matrix exists in the PRD execution notes or a follow-up audit artifact.
- The matrix includes only changed files and files whose authority is being moved.
- Any failing verification is documented as a blocker before code edits.

### Slice 1 - Verification Coverage

Purpose:

- Make green checks meaningful before simplification changes begin.

Scope:

- `package.json` files.
- `turbo.json`.
- existing health/verify scripts.
- GitHub Actions only if a local verification script is demonstrably stale because of the workflow.

Acceptance:

- No no-op check is added.
- Every deployable service has a real local verification command.
- Root verification is either comprehensive or explicitly supplemented.

### Slice 2 - Contract And Security Primitive Convergence

Purpose:

- Remove correctness footguns created by same-name helper drift and duplicated security primitives.

Scope:

- `@clickeen/ck-contracts` or a narrowly named workspace crypto module/package.
- Local `isRecord` / `asTrimmedString` copies where the shared contract fits.
- Local `timingSafeEqual` and `sha256Hex` copies where runtime-compatible.

Acceptance:

- Shared helper contracts are explicit and tested.
- Empty-string/null behavior is preserved intentionally at each caller.
- Security primitive tests cover byte-safety and non-ASCII string input.
- Affected services are green.

### Slice 3 - Roma Route And Error Boilerplate Cleanup

Purpose:

- Reduce route/error boilerplate that future agents will copy.

Widget-config validation removal is not part of this slice. It belongs to Slice 4 so Tokyo-worker validation and Roma validator deletion land together.

Scope:

- Roma no-store/session helper duplication.
- Berlin proxy route boilerplate.
- Roma reason-key/error-copy helper duplication.

Acceptance:

- Repeated route boilerplate is collapsed without hiding route ownership.
- Roma verification green.

### Slice 4 - Widget Catalog Authority And Create Flow

Purpose:

- Remove hardcoded widget catalog knowledge from Roma and Tokyo-worker so the product can scale beyond the first three widgets.

Scope:

- Roma widget create/list entry points.
- Roma account policy visibility for widget creation.
- Tokyo-worker account-instance default creation.
- Widget catalog/spec authority.
- Bob compiled-widget path as the reference generic consumer.

Required execution:

- Identify or create a single catalog authority derived from widget-owned source.
- Replace Roma `CREATE_WIDGET_OPTIONS` with catalog-driven options.
- Build Tokyo-worker saved-config validation from the catalog/spec authority.
- Remove Roma's local active-widget defaults/validators as product truth in the same commit/slice.
- Replace Tokyo-worker's hand-maintained `WIDGET_SPECS` map with catalog/spec lookup.
- Plumb Tokyo-worker structured validation errors back through Roma.
- Preserve current FAQ, Countdown, and Logo Showcase create/edit/save behavior.

Acceptance:

- Roma source does not need a code edit to list a newly cataloged widget.
- Tokyo-worker source does not need a hardcoded map edit to create a newly cataloged widget from defaults.
- Account policy can hide/show widgets before Roma offers creation.
- Tokyo-worker rejects invalid saved config at its boundary.
- Roma surfaces the returned structured error.
- Roma no longer imports `tokyo/product/widgets/*/spec.json`.
- Roma and Tokyo-worker do not both retain active widget-config validators after the slice lands.
- Bob still compiles widgets by spec and does not gain a widget-type switch.
- Roma, Bob, and Tokyo-worker verification green.

### Slice 5 - Widget-Owned SEO/GEO Dispatch

Purpose:

- Preserve SEO/GEO behavior while removing central per-widget SEO/GEO switchboards.

Scope:

- Tokyo-worker meta-pack generation.
- Venice SEO/GEO schema/excerpt dispatch only where still active.
- Widget-owned SEO/GEO capability metadata or generated registry.

Required execution:

- Classify current FAQ and Countdown SEO/GEO generation as product behavior to preserve.
- Move dispatch behind widget-owned capability lookup or generated registry.
- Keep Venice DB-free and non-blocking when SEO/GEO bytes are missing.
- Do not move request-time SEO/GEO generation into Venice.

Acceptance:

- FAQ and Countdown SEO/GEO outputs remain equivalent for current fixtures/smokes.
- Adding another SEO/GEO-capable widget does not require a new central `if widgetType === ...` branch.
- Venice still injects published host metadata and still renders iframe when metadata is absent.
- Tokyo-worker and Venice verification green.

### Slice 6 - Catalog Labels, UX Scale, And Agent Metadata

Purpose:

- Remove small widget-name exceptions that become product-scale UX debt at 200 widgets.

Scope:

- Prague widget display-label helpers.
- Roma widget labels/descriptions/categories from catalog metadata.
- San Francisco prompt/context vocabulary if widget-aware.
- Bob generic compiler path verification.

Required execution:

- Replace `faq -> FAQ` style label exceptions with catalog labels where the catalog is available.
- Keep fallback display labels boring and generic where catalog is unavailable.
- Keep San Francisco generic unless widget metadata explicitly supplies agent guidance.
- Verify Bob remains widget-agnostic in product path.

Acceptance:

- No new per-widget display exception table is introduced outside widget-owned fixtures/tests.
- Current public pages still display acceptable labels.
- San Francisco does not grow a widget-name regex as catalog support.
- Prague, Roma, San Francisco, and Bob verification green where touched.

### Slice 7 - Venice Loader Simplification With SEO/GEO Preservation

Purpose:

- Reduce duplicate loader implementation while preserving documented embed behavior.

Scope:

- `venice/app/embed/v2/loader.ts`
- Venice tests or health checks if present/added.

Acceptance:

- Script-level iframe embed still works.
- Placeholder iframe embed still works.
- SEO/GEO mode still injects host metadata when Tokyo bytes exist.
- SEO/GEO failure still falls back to iframe UI.
- Venice verification green.

### Slice 8 - Roma Scaffold Honesty

Purpose:

- Keep Roma SaaS domains while removing accidental dead-end UX or fake claims.

Scope:

- Roma domain components.
- Roma domain docs if behavior/copy changes.

Acceptance:

- Domain navigation remains intact.
- Billing/usage/AI/settings scaffolds are honest and intentional.
- No scaffold claims unsupported enforcement or unavailable live systems.
- Roma verification green.

### Slice 9 - Prague Stub Classification And Cleanup

Purpose:

- Preserve deliberate marketing/build scaffolds while removing accidental public residue.

Scope:

- Prague component/block fallback behavior.
- Prague composition docs if needed.

Acceptance:

- No public page renders accidental implementation-stub text.
- Deliberate scaffold behavior remains.
- Minibob remains non-authoring.
- Prague verification green.

### Slice 10 - Policy Enforcement Readiness

Purpose:

- Keep tier architecture and close or name enforcement gaps.

Scope:

- `packages/ck-policy`
- Roma/Bob/Venice/Tokyo-worker surfaces that advertise or enforce policy.

Acceptance:

- Policy registry enforcement notes match code.
- Unenforced customer-facing claims are removed, softened, or blocked.
- `embed.seoGeo.enabled` remains intact.
- `views.monthly.max` has a concrete enforcement plan or implementation.

### Slice 11 - Tokyo-worker Artifact Boundary Simplification

Purpose:

- Ensure generated artifacts are derived read models, not competing product truth.

Scope:

- Tokyo-worker internal render routes.
- Queue/job boundaries.
- operator repair docs.

Acceptance:

- Product paths do not self-heal missing generated truth.
- Explicit operator repair remains explicit if retained.
- Direct artifact mutation bypasses are deleted or isolated.
- Tokyo-worker verification green.

### Slice 12 - Shared Contract Hygiene

Purpose:

- Reduce shared-package ambiguity without creating a new utility platform.

Scope:

- `packages/ck-contracts`
- narrow duplicate helpers only when extraction deletes more confusion than it adds.

Acceptance:

- Shared exports are domain-named.
- No generic dumping ground is introduced.
- Affected services remain green.

### Slice 13 - Final Product-Path Verification

Purpose:

- Prove the completed wave preserved the real product path.

Required verification:

```bash
pnpm build:dieter
pnpm typecheck
pnpm lint
pnpm test
```

Additional direct checks are required only for services touched by the completed wave or not covered by root verification:

- Bob build/typecheck.
- Roma build/typecheck.
- Venice build/typecheck.
- Tokyo-worker typecheck.
- San Francisco typecheck.
- Prague build.
- Berlin typecheck.
- Product-path smoke where credentials/env allow it.

Acceptance:

- All checks green or blocked by explicit external credential/env limitation.
- If Slice 1 made root verification comprehensive for a service, do not rerun duplicate direct checks without a reason.
- Documentation updated for any changed behavior.
- No deleted scaffold was undocumented after the fact.

## 7. Anti-Goals

This PRD must not:

- delete Roma domain scaffolding;
- delete SEO/GEO embed support;
- delete policies instead of enforcing them;
- collapse Prague marketing/demo into account authoring;
- introduce a new architecture framework;
- turn all duplicate tiny helpers into a shared utility package;
- split files only to reduce LOC;
- preserve accidental legacy behavior because it has callers;
- use grep-only verification as product proof;
- ship code that makes public UX look finished when the product behavior is not real.

## 8. Success Criteria

PRD 092 is successful when:

1. The simplification target list is evidence-based and classified.
2. Documented product architecture is preserved.
3. Deliberate scaffolding remains but is honest.
4. Accidental public residue is removed.
5. SEO/GEO embed behavior is preserved and easier to maintain.
6. Tier policies are either enforced or explicitly blocked with owners.
7. Tokyo generated artifacts remain derived read models.
8. Verification is stronger and less misleading than before.
9. Widget-specific behavior lives under widget-owned source, generated catalog/capability registries, or explicitly classified fixtures/docs.
10. Roma/Bob/Tokyo-worker can scale from 3 widgets to 200 widgets without per-widget product-shell edits.
11. Net code movement reduces ambiguity, not just LOC.
12. Future agents can read the docs and know what must survive before touching code.

## 9. Execution Rule

Do not execute PRD 092 until Slice 0 produces the classification matrix.

Do not start Wave B until Wave A is green and reviewed.

If a target cannot be classified, stop and ask for a product decision instead of guessing.
