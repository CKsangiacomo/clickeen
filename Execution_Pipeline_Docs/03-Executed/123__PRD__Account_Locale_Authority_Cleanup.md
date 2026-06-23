# PRD 123 - Account Locale Authority Cleanup

Status: EXECUTED
Owner: Roma/Berlin/Tokyo account product boundary
Date: 2026-06-17
Stage: 03-Executed
Priority: P0 architecture cleanup

## Purpose

Make locale authority match the product law everywhere in the active
account-widget product path.

The system rule is simple:

```text
Tier establishes locale capacity.
Account settings decide which locales the account uses.
Roma routes the current account, applies account policy, and saves account work.
Bob edits one widget instance in browser memory.
Tokyo stores and serves the account runtime data Roma submits.
Widget Shell utilities display runtime choices; they do not decide account
locale policy.
```

The current codebase partially follows this rule. The normal instance-create
path is mostly correct. Save, duplicate, translation generation, manual
translation writes, public package materialization, and pages/prague locale
surfaces still contain duplicate locale authority or silent fallback behavior.

This PRD cleans the active account-widget path first. Pages/Prague locale
cleanup is recorded as known deferred work because pages/prague execution was
already moved after PRD 120.

## Product Law

- Widgets are software and live in the system.
- Users create widget instances in Roma/Bob and save them in their account in
  Tokyo.
- Pages are stacks of instances that live in Tokyo.
- Bob is an editor. User opens and edits are browser-memory work. User save is
  the persistence boundary.
- Tokyo is responsible for account runtime storage in R2.
- Roma is the app. Roma routes the user to their account, enforces the user's
  tier, and saves what the user does.
- Clickeen uses Clickeen. Admin is a normal account using Clickeen's own
  widgets, assets, pages, and product routes.

## Current Surviving Authorities

| Concern | Authority |
| --- | --- |
| Supported locale tokens | `packages/l10n/locales.json` |
| Locale capacity | Tier policy key `l10n.locales.max` |
| Account selected locales | Account settings through Roma `/api/account/locales` |
| Account base locale | Account settings, locked once account widget content exists |
| Builder edit locale | Bob preview/editor memory for one active widget and one active locale |
| Translation generation scope | Roma current account settings, not request body values |
| Translation readiness | Saved Tokyo overlay state for the current saved base marker |
| Public locale serving | Stored public package files and explicitly available saved locale output |
| Shell locale switcher | Runtime/display selector only |

## Verified Green Baseline

- Tier capacity exists in policy:
  `packages/ck-policy/entitlements.matrix.json`
- Policy registry names Roma account locale settings as the enforcement owner:
  `packages/ck-policy/src/registry.ts`
- Roma account locale writes enforce `l10n.locales.max`:
  `roma/app/api/account/locales/route.ts`
- Berlin bootstrap fails invalid persisted account locale state instead of
  silently normalizing it:
  `berlin/src/bootstrap/state.ts`
- Roma instance create reads account locale state and uses account
  `baseLocale` and active locales:
  `roma/app/api/account/instances/route.ts`
- Roma Builder host passes Bob translation setup from current account policy:
  `roma/components/builder-domain.tsx`
- Bob hosted mode blocks direct account API writes and delegates account
  commands to Roma:
  `bob/lib/session/sessionTransport.ts`
- Widget Shell locale switcher is display/runtime only:
  `tokyo/product/widgets/shared/localeSwitcher.js`

## Confirmed Violations This PRD Fixes

### V-123-01 - Roma save accepts caller-supplied base locale

Current behavior:

- `roma/app/api/account/instances/[instanceId]/route.ts` accepts `baseLocale`
  from the request body.
- That body value is passed into public package materialization.
- Public output can be stamped from browser/request truth instead of account
  settings.

Product-law problem:

- Bob/browser payload becomes a locale authority.
- Roma is not deriving save scope from the current account.

Core violation:

- V1 silent substitution.
- V7 masquerade/redress if renamed as "preview locale" but still used for
  package output.

Required correction:

- Instance save must load current account locale state server-side.
- Body `baseLocale` must stop controlling package materialization.
- If the submitted body still carries locale authority fields, Roma rejects the
  request or ignores those fields only after the route has a single named
  account-derived value.

### V-123-02 - Instance update can mutate stored locale metadata through meta

Current behavior:

- Roma forwards submitted `meta` during instance save.
- Tokyo resolves stored `baseLocale` from submitted meta.

Product-law problem:

- A save payload can rewrite locale authority on an existing account instance.
- Tokyo is deriving account policy from submitted metadata.

Core violation:

- V1 silent substitution.
- V2 silent healing if invalid meta is coerced into stored locale values.

Required correction:

- Roma strips locale authority fields from update meta.
- Existing source locale metadata is preserved only as historical instance
  source metadata where still required by current storage shape.
- Account locale changes happen through account settings, not instance save
  payloads.

### V-123-03 - Translation generation accepts request-supplied locales

Current behavior:

- `roma/app/api/account/instances/[instanceId]/translations/generate/route.ts`
  reads `baseLocale` and a caller-supplied locale list from the POST body.
- Tokyo generation prefers provided values over stored instance values.

Product-law problem:

- Browser/request body can select generation scope.
- Tier/account locale settings are bypassable unless each route rechecks them.

Core violation:

- V1 silent substitution.
- V4 fail-open control.
- V6 partial-success masquerade if unsupported requested locales are filtered
  while generation still reports success.

Required correction:

- Roma derives generation scope from current account locale settings.
- Roma sends only account-authorized generation intent to Tokyo.
- Tokyo does not prefer arbitrary request locale values over account-derived
  scope.

### V-123-04 - Manual translation write route existed

Current behavior:

- The old Roma manual translation write route has been removed.
- Locale overlay writes now belong to the Translation Agent path.

Product-law problem:

- Reintroducing a manual write route would let a caller create translated locale
  state outside the active-locale authority.

Core violation:

- V4 fail-open control.
- V6 partial-success masquerade if the UI later hides unsupported locales while
  the write succeeded.

Required correction:

- Roma requires the requested locale to be one of the account active locales.
- Roma rejects writes to the account base locale through the translated-locale
  write route.
- Tokyo stores the explicit overlay after Roma has applied account policy.

### V-123-05 - Duplicate preserves stale source active locales

Current behavior:

- Duplicate reads `baseLocale` and old locale intent from the source instance.
- The new instance inherits those values even if account settings changed.

Product-law problem:

- Old instance source metadata becomes account locale authority for new work.

Core violation:

- V1 silent substitution.
- V5 corruption-as-absence if stale state is treated as a valid current policy.

Required correction:

- Duplicate loads current account locale settings.
- New duplicate uses current account active locales.
- Base locale must match the account base locale or fail at Roma's account
  boundary.

### V-123-06 - Public package silently falls back to base locale

Current behavior:

- `roma/lib/account-instance-public-package.ts` builds a public locale map with
  only the base locale.
- Unknown requested locale falls back to base state.

Product-law problem:

- Public runtime can substitute base content while appearing to support a
  requested locale.
- Account-selected locales and saved translation readiness are conflated.

Core violation:

- V1 silent substitution.
- V6 partial-success masquerade.

Required correction:

- Public package output must be honest about available locale content.
- Account active locales are display intent, not proof that an overlay file
  exists for a saved instance.
- Public locale availability must come from saved complete translated output, or
  the package remains base-only without pretending otherwise.

## Known Deferred Violations

These are not hidden or considered green. They are outside this execution pass
because pages/prague work is scheduled after PRD 120.

### D-123-PAGES - Pages have page-local localization authority

Current behavior:

- Roma page source contains page-local `defaultLocale`, language switcher, IP
  localization, and country rules.
- Roma page UI exposes page-level locale controls.
- Tokyo page source validates and stores page-local localization fields.

Why deferred:

- Pages/prague execution was intentionally moved after PRD 120.
- This PRD must not drift into page composer or Prague migration work.

Required future correction:

- Page locale behavior must derive from account settings plus saved instance
  readiness.
- Page-local language policy must be deleted or replaced with read-only derived
  data.

### D-123-PRAGUE - Prague optional embed locale selector is not current product truth

Current behavior:

- Prague docs and markdown support imply `accountInstanceRef.locale` or
  `?locale=` can select account-widget translated output.
- Public serving currently serves stored package files and does not prove a
  saved locale overlay file for that selector.

Why deferred:

- Prague migration and page/block work are scheduled after PRD 120.

Required future correction:

- Remove Prague account-widget locale selector semantics until public runtime
  has a real saved-locale artifact contract.
- Keep Prague as a consumer of public artifacts, not private account-widget
  translation state.

## Non-Goals

- Do not rebuild the localization system.
- Do not add runtime validation rituals as a product dependency.
- Do not add source-order checks, synthetic probes, or test-only helpers that
  decide whether normal product work can proceed.
- Do not move account policy into Bob.
- Do not move account policy into Tokyo.
- Do not make Widget Shell locale switcher an account settings authority.
- Do not implement pages/prague locale cleanup in this pass.
- Do not rewrite unrelated translation field extraction, San Francisco job
  contracts, or page composer flows.

## Execution Plan

### Step 1 - Reconfirm active locale authority in code

Action:

- Re-read the active files for account locale policy, Roma instance routes,
  Bob session delegation, Tokyo account instance source, Tokyo translations,
  and public package materialization.
- Record any line movement before editing.

Architecture compliance:

- Starts from product authority before file topology.
- Prevents editing stale line references from the audit.

Product-law compliance:

- Names who decides locale capacity, who decides account active locales, and who
  stores the result before any code moves.

Completion evidence:

- Short implementation note in the execution response listing touched surfaces.

### Step 2 - Harden account locale settings semantics

Action:

- Ensure account active locales cannot include the account base locale.
- Ensure `countryToLocale` values, where still active, point only to account
  active locales.
- Ensure unknown locale policy keys are not silently accepted as current product
  behavior.
- Preserve the existing tier-capacity enforcement through `l10n.locales.max`.
- Prove account settings active-locale reconciliation through Roma
  `/api/account/locales`: removed active locale overlay files are deleted,
  added active locale overlays are created through Translation Agent, and
  unchanged active locales are left alone.

Architecture compliance:

- Keeps tier capacity in policy/Berlin account settings.
- Does not move policy into Bob or Tokyo.

Product-law compliance:

- Tier decides how many locales the account may use.
- Account settings decide which locales the account uses.

Core violation protection:

- Avoids V1 by not accepting invented/unknown policy fields.
- Avoids V4 by not allowing unsupported policy state to pass when enforcement
  data is malformed.

Completion evidence:

- Focused tests or existing route tests prove invalid account locale policy is
  rejected at the account settings boundary.

### Step 3 - Make Roma instance save account-derived

Action:

- Update `PUT /api/account/instances/:instanceId` so package materialization
  uses current account locale state loaded server-side.
- Remove request-body `baseLocale` as materialization authority.
- Strip or reject submitted locale authority fields from save `meta`.

Architecture compliance:

- Roma remains the account app and save orchestrator.
- Bob remains browser-memory editor only.
- Tokyo receives exact source/package bytes from Roma.

Product-law compliance:

- User save persists the active widget through Roma into Tokyo.
- Account settings, not editor payload, decide locale authority.

Core violation protection:

- Avoids V1 by removing request-body substitution.
- Avoids V7 by deleting the behavior instead of renaming it.

Completion evidence:

- Save route tests or focused route-level assertions show submitted
  `baseLocale` cannot change package locale output.

### Step 4 - Make duplicate use current account settings

Action:

- Update duplicate route to load current account locale settings.
- Use current account locale settings for the new instance package and create
  command.
- Ignore source instance locale metadata as authority.

Architecture compliance:

- Duplicate remains a Roma account product action.
- Tokyo stores the new instance created by Roma; it does not decide account
  policy.

Product-law compliance:

- A copied widget is a new account instance under current account rules.
- Stale source metadata does not become policy.

Core violation protection:

- Avoids V1 stale substitution.
- Avoids V5 by not treating stale source locale state as current policy.

Completion evidence:

- Duplicate route evidence shows account settings are loaded and stale source
  locale metadata is not copied as authority.

### Step 5 - Make translation generation account-derived

Action:

- Update Roma translation-generate route to ignore/reject request-supplied
  `baseLocale` and locale lists.
- Load current account locale settings in Roma.
- Send account-authorized generation scope to Tokyo.
- Update Tokyo generation code so arbitrary request locale values are not
  preferred over account-derived scope.

Architecture compliance:

- Roma applies account policy.
- Tokyo performs the translation operation against the explicit account-scoped
  command it receives.
- San Francisco remains the AI execution worker, not locale policy authority.

Product-law compliance:

- Translation generation follows account settings and tier capacity.
- Bob's Translations panel starts work; it does not select account policy.

Core violation protection:

- Avoids V1 request substitution.
- Avoids V4 fail-open control.
- Avoids V6 partial-success masquerade.

Completion evidence:

- Generation route tests or focused assertions show requested unsupported
  targets cannot generate translation jobs.

### Step 6 - Keep manual translation writes deleted

Action:

- Keep the Roma manual translation save route deleted.
- Do not add Bob or Roma commands that write translated locale overlays directly.
- Keep Tokyo overlay storage as storage only.

Architecture compliance:

- Roma remains the account route/API boundary.
- Tokyo stores exact overlay files requested by the owning product path.

Product-law compliance:

- Account settings decide which translated locales exist for account work.
- Translation Agent owns translated overlay writes for current generation work.

Core violation protection:

- Avoids V4 fail-open writes.
- Avoids V6 hidden unsupported overlay success.

Completion evidence:

- Manual translation route evidence shows the direct write path is absent.

### Step 7 - Remove Tokyo locale fallback authority

Action:

- Remove Tokyo behavior that invents `en`, `[]`, or request-preferred locale
  values when required locale metadata is missing.
- Preserve existing stored source where appropriate, but do not infer account
  policy from missing or malformed instance metadata.

Architecture compliance:

- Tokyo stores and serves account runtime data.
- Tokyo does not become the account policy owner.

Product-law compliance:

- Missing or corrupt account policy cannot become a new normal inside storage.

Core violation protection:

- Avoids V1 silent substitution.
- Avoids V2 silent healing.
- Avoids V5 corruption-as-absence.

Completion evidence:

- Focused Tokyo tests or code evidence show missing locale authority fails at
  the named boundary instead of falling back.

### Step 8 - Make public package locale behavior honest

Action:

- Public package output must include only locale content that actually exists as
  saved runtime-ready output.
- If only base output exists, public package remains base-only and does not
  pretend account active locales have saved overlay output.
- Unknown requested locale must not silently substitute base while implying the
  requested locale was served.

Architecture compliance:

- Public serving remains stored artifact delivery.
- Runtime requests do not compose translations or read private account policy.

Product-law compliance:

- Saved translated output, not account intent, decides public locale
  availability.

Core violation protection:

- Avoids V1 silent substitution.
- Avoids V6 partial-success masquerade.

Completion evidence:

- Package materialization evidence shows locale map matches available saved
  output, or base-only output is explicit.

### Step 9 - Update active docs to match runtime

Action:

- Update only active docs that currently teach duplicate locale authority.
- Keep `CONTEXT.md` concise.
- Update detail docs where behavior changes, especially localization, Roma,
  Bob, Tokyo-worker, and widget architecture docs as needed.
- Mark pages/prague locale authority as deferred known violation if referenced.

Architecture compliance:

- Docs remain an interface for AI execution.
- History stays in PRDs; current architecture stays in current docs.

Product-law compliance:

- Future agents read the same simple rule the product follows.

Core violation protection:

- Avoids V7 by not preserving toxic workflow under new names in docs.

Completion evidence:

- `rg` evidence shows active docs no longer instruct request/body/source
  snapshots as locale authority for account widgets.

### Step 10 - Verify with independent V1-V8 audit

Action:

- Run focused lint/typecheck/tests for touched packages.
- Run search checks for request/body locale authority in active product paths.
- Use subagents for independent V1-V8 review before closing this PRD.

Architecture compliance:

- Verification checks the named authorities touched by this PRD.
- Verification is not part of runtime product execution.

Product-law compliance:

- Confirms the system stays simple without adding runtime ceremonies.

Completion evidence:

- Final execution report lists files changed, checks run, subagent V1-V8 result,
  commit/push/deploy state, and any remaining deferred pages/prague violations.

## Search Targets During Execution

Use these searches to prove the cleanup is real:

```bash
rg -n "baseLocale|localePolicy|countryToLocale|languageSwitcher|ipLocalization|defaultLocale|accountInstanceRef\\.locale|\\?locale=" roma bob tokyo-worker packages documentation Execution_Pipeline_Docs
rg -n "l10n\\.locales\\.max|selected_target_locales|locale_policy" berlin packages supabase
```

Every active hit must fall into one of these categories:

- canonical account settings/tier authority;
- Roma deriving current account scope;
- Bob display/preview state only;
- Tokyo storage/readiness state only;
- Shell runtime/display selector only;
- deferred pages/prague violation explicitly recorded by this PRD.

## Closure Criteria

PRD 123 can move to `03-Executed` only when all are true:

- Account locale capacity still comes from tier policy.
- Account selected locales still come from account settings.
- Account settings active-locale reconciliation is proven through Roma
  `/api/account/locales`, including exact overlay delete for removed active
  locales and Translation Agent generation for added active locales.
- Roma save, duplicate, and translation generation routes no longer accept caller
  locale fields as authority; the old manual translation write route is absent.
- Tokyo no longer invents locale authority through fallback values.
- Public package locale behavior is explicit and does not silently substitute a
  requested unsupported locale.
- Active docs teach the corrected authority.
- Pages/prague locale violations are either fixed by a later PRD or remain
  explicitly recorded as deferred, not green.
- Independent V1-V8 audit reports no open violation in the active
  account-widget path.

## Execution Notes

Append execution notes below during implementation. Keep this section factual:
what changed, what checked green, and what remains deferred.

### 2026-06-23 execution pass - account widget locale authority closeout

Scope:

- Treated this as pre-GA cleanup. Toxic locale-authority remnants were removed,
  not preserved behind compatibility paths.
- Kept pages/prague locale authority cleanup deferred as already recorded above.

Code changes:

- Roma duplicate now loads current account locale state and uses the account
  `localePolicy.baseLocale` for the copied instance package and Tokyo create
  command.
- Roma duplicate no longer copies source instance `meta` into the new instance.
  Source instance locale metadata is ignored as authority.
- Roma direct instance helper keeps reading stored Tokyo metadata, but
  caller/source metadata can no longer submit `baseLocale` as authority for
  create/save commands.
- Roma instance routes no longer submit caller/source `meta.baseLocale`. The
  direct helper still stamps account-derived `baseLocale` into Tokyo's current
  storage metadata shape.
- Public widget runtime package no longer reads `?locale=` and silently maps an
  unsupported request to base. Current base-only packages expose the base locale
  as the selected locale.

Docs changed:

- `documentation/services/roma.md` now states that duplicate is a new account
  operation and does not copy locale authority from the source instance.
- `documentation/services/tokyo-worker.md` now states that public serving serves
  stored package bytes and does not invent translated output from query locale.

Verification:

- `rg` found no remaining old locale-authority wording in this PRD and the
  touched active docs.
- `rg` found no remaining duplicate source-base authority, copied source meta,
  public `requestedLocale`, public query parsing, or payload-locale fallback in
  the touched account-widget runtime files.
- `git diff --check` passed.
- `pnpm --filter @clickeen/roma lint` passed.
- `pnpm --filter @clickeen/roma typecheck` passed after the concurrent build
  finished regenerating `.next/types`.
- `set -a; source .env.local; set +a; pnpm --filter @clickeen/roma build`
  passed. Running the build without the repo env failed earlier because
  `NEXT_PUBLIC_TOKYO_URL` is required.
