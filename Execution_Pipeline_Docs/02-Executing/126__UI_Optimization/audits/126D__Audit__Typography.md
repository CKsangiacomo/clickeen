# 126D - Current-Source Pre-Execution Audit: Typography

Status: STEP 6 COMPLETE - current source audited at tree `8716a842`; Step 7 is
defined in `../126D__PRD__Typography.md`; no Step-9 product execution credit.
PRD: `../126D__PRD__Typography.md`.

## Audit Question

What typography work remains in the current codebase after the completed
account-font migration, and what must 126D execute without reopening closed
storage, route, or product-data work?

## Active Authorities

- Operational UI typography: `dieter/tokens/dieter-typography.css`.
- Account font metadata: current account `widget-defaults.json` `fontLibrary`.
- Uploaded font bytes: `accounts/{accountPublicId}/assets/{filename}`.
- Bob account/session coordinate: Roma current account -> Bob open payload.
- Account-independent widget editor compilation: Bob compiler plus widget
  `spec.json` editor contract.
- Account-bound editing authorities: Bob document session for instances and
  Roma Widget Defaults for account shell/widget-core defaults. Both receive the
  current account font library.
- Family transition and relational validation law:
  `packages/widget-shell/src/font-library.ts`.
- Control intent presentation: Dieter emits a requested value; it does not own
  account-font companion selection.
- Public widget typography: saved structured typography plus
  `tokyo/product/widgets/shared/typography.js`.

The compiler cannot be an account font authority because the same compiled
widget contract serves every account. Bob session open and Roma Widget Defaults
are the two places where compiled controls meet the current account library.

## Commands And Checks

The Step-6 pass read current source and ran:

```bash
pnpm --filter @clickeen/widget-shell typecheck
pnpm --filter @clickeen/bob typecheck
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/roma test:instance-package
pnpm --filter @clickeen/devstudio typecheck
pnpm validate:widgets
cmp dieter/tokens/dieter-typography.css \
  tokyo/product/dieter/tokens/dieter-typography.css
```

All passed. DevStudio generation produced no tracked diff.

The audit also compiled the current FAQ widget and tested an account font
against the compiled contract:

```text
family control kind: enum
compiled family count: 18
compiled enum contains Orio: false
FAQ config with title.family = Orio: rejected
reason: coreui.errors.instance.config.invalid:typography.roles.title.family
```

## Proven Current State

### Closed Work

- Account font libraries exist and are carried from Roma into Bob.
- Missing or malformed account font libraries fail Bob open.
- Account-uploaded fonts are normal account assets.
- Materialization resolves account font assets and includes used fonts plus
  Inter in public packages.
- Google and account-asset runtime source authorities remain distinct.
- Root `/fonts/**`, `/fonts/special/**`, `source: 'tokyo'`, and active
  `--font-display` behavior are absent.
- Dieter source and generated typography output match.
- Current widget-shell typecheck, Bob typecheck, Roma typecheck, package tests,
  DevStudio typecheck, and eight-widget validation are green.

No remote font migration, R2 mutation, Supabase mutation, root-font route,
font registry, or compatibility path belongs to 126D Step 9.

The seven untracked files under `tokyo/product/fonts/special/` are local
workspace residue. They are not tracked source, deploy input, or product data.
Their deletion cannot be credited as a Git execution slice and they remain
untouched by this pre-execution pass.

### Real Product Defect: Editors Offer Font State They Cannot Reliably Accept

The visible family menus are replaced from the account font library in
`bob/components/td-menu-content/accountFonts.ts`. That part is current.

The compiled family controls are different:

1. `bob/lib/compiler/modules/typography.ts` serializes
   `createDefaultAccountFontLibrary()` family options into every compiled
   widget.
2. `bob/lib/compiler/controls.ts` turns those options into a fixed enum.
3. `bob/lib/session/useSessionBoot.ts` validates the saved instance against
   that fixed enum before it validates the account font library.
4. `bob/lib/session/useSessionEditing.ts` and save validation continue using
   the fixed compiled controls.
5. The DOM menu can therefore offer Orio, Pachuka, or any future account font
   while Bob rejects the resulting operation/config as invalid.
6. Bob Copilot also receives the fixed default enum rather than the current
   account's family choices.
7. The visible UI filters weights and styles by the selected family, but Bob's
   session contract validates only generic weight/style enums. Copilot or any
   operation producer can therefore create a family/weight/style combination
   that the public runtime later rejects.
8. Roma `Settings > Widget Defaults` renders the same compiled typography
   controls and current account font menu, but its control host writes values
   directly and its route contract validates paths/library shape only. Removing
   compiler family enums without account-font validation there would leave a
   second product editor accepting invalid combinations.
9. Dieter `dropdown-actions` currently chooses replacement weight/style values
   and emits a three-op family change before either host sees the user's intent.
   Adding that policy to Bob would create two transition authorities.
10. Typography cluster labels are visible in the panel but are not carried into
    compiled control `groupLabel`; Copilot sees generic labels such as `Font
    family` without the role they belong to.

This is V6 partial-success masquerade: the product offers a choice that its
own editing contract refuses.

### Correct Authority Change

The compiler must emit family controls as account-independent string controls,
with no default account family enum. `packages/widget-shell` must own two small
pure rules beside the existing account font library contract:

1. resolve one requested family transition into an explicit compatible
   family/weight/style result; and
2. validate every typography family/weight/style selection against one
   normalized account font library and return exact invalid paths.

Dieter emits only the requested family. Bob and Roma call the same resolver
against their current document and account library, then apply the explicit
three values atomically. An explicit disallowed companion is rejected; an
omitted companion preserves the current value when allowed, then prefers
`400`/`normal`, then the first allowed value. Rejection restores visible
controls from unchanged document truth and shows stable product copy. It does
not dirty the document, create Undo, or report an applied edit.

When Bob opens an instance, the session binds family controls to the normalized
current account library before config validation. Bob uses the shared validator
after open, edits, and before save. Roma uses the same validator for shell
defaults and every widget-core defaults document on GET and PUT. The visible
menus in both hosts use that same account library. No second font catalog or
transition policy is created.

### Widget Typography Roles

All eight current widget clients apply the same role keys present in their
composed defaults:

| Widget | Widget-specific roles |
| --- | --- |
| Big Bang | `bigBang` |
| Call to Action | `eyebrow` |
| Cards | `cardTitle`, `cardCopy` |
| Countdown | `timer`, `label` |
| FAQ | `section`, `question`, `answer` |
| Logo Showcase | none |
| Split Carousel Media | none |
| Split Media | none |

The shared shell roles are `title`, `body`, `button`, and `localeSwitcher`.
The earlier review claim that widget-shell's four roles contradict Bob's
larger set is rejected: widget-shell owns only shared shell roles; each widget
owns its content roles.

The current compiler still has one scalability defect: it owns a fixed list of
14 possible role keys and silently filters composed roles against that list.
A future widget role can therefore exist in defaults/runtime while disappearing
from Bob. Widget-specific role labels must be declared by the widget's shared
typography editor contract. The compiler may own labels only for the four
stable shell roles. It must enumerate actual composed roles and fail compilation
when a widget-specific role lacks an explicit label; it must never silently
omit a role.

The current runtime role maps are behaviorally correct for all eight widgets.
They must not be changed merely to add a second runtime validator. Instead,
`pnpm validate:widgets` must inspect the actual role map passed to
`CKTypography.applyTypography` in each `widget.client.js` and compare its exact
key set with the composed spec roles. The validator uses the TypeScript AST,
supports the current inline-object and local-object-plus-static-assignment
shapes, and fails on unsupported dynamic construction rather than guessing.
This proves the real runtime source without adding a role registry, runtime
branch, or rematerialization requirement.

Current generic labels also need three product-accuracy corrections:

- Big Bang `body` controls both the shared subtitle and supporting copy.
- Call to Action `title`/`body` also control the action headline/supporting
  text.
- FAQ `section` is specifically the section title.

Widget metadata may therefore override a shared label when the widget gives the
shared role broader product meaning. This removes the central onboarding list
and improves current UX without adding a registry.

## Exact Step-7 Blast Radius

### Product Code

| Path | Planned change |
| --- | --- |
| `packages/widget-shell/src/controls.ts` | Export the existing four shell typography role keys with their product labels so shell ownership is shared by compiler and validation code. |
| `packages/widget-shell/src/font-library.ts` | Add the sole pure account-font family-transition resolver and typography-selection validator. Return structured failures and exact invalid paths; perform no mutation or persisted fallback. |
| `bob/lib/compiler/modules/typography.ts` | Stop embedding default-account family options. Enumerate actual composed roles. Use four shell labels plus explicit widget role labels; fail on missing/extra widget role metadata. |
| `bob/lib/compiler/editor-contract.ts` | Accept and validate `shared.roleLabels` for the shared typography panel and pass it to the typography renderer. |
| `bob/lib/compiler/controls.ts` | Honor a non-empty explicit `group-label` before the technical field-group fallback so every typography control carries its role label into Copilot context. |
| `bob/lib/edit/typography-fonts.ts` | Delete the file. Its default-account catalog and re-exports have no remaining authority or consumers once generic weight labels live with the compiler. |
| `bob/lib/session/sessionConfig.ts` | Add the pure account-library control binder and one account-aware typography assertion for global/role family membership and per-role allowed weights/styles. |
| `bob/lib/session/useSessionBoot.ts` | Normalize the font library, bind the compiled family controls, then validate instance config and account typography selections against that same bound session contract. Store the bound compiled widget in session state. |
| `bob/lib/session/useSessionEditing.ts`, `bob/lib/session/WidgetDocumentSession.tsx`, `bob/lib/session/sessionTypes.ts` | Run account-aware validation before accepting edited state and expose one explicit edit-rejection method so control-host failures become existing `ops` error state without changing instance data or dirty state. |
| `bob/lib/session/useSessionSaving.ts` | Run the same account-aware assertion before sending save. |
| `bob/lib/edit/typography-family-ops.ts`, `bob/components/TdMenuContent.tsx`, `bob/components/td-menu-content/useTdMenuBindings.ts`, `bob/components/td-menu-content/linkedOps.ts` | Own the narrow host path adapter around the widget-shell resolver; Bob delegates family expansion to it, catches structured rejection, restores family/weight/style fields from unchanged session data, and reports mapped edit failure. Keep all other linked operations unchanged. |
| `bob/components/CopilotPane.tsx` | Carry role `groupLabel` into the AI capsule. Expand Copilot draft ops before inverse/apply/metadata. On rejection show `COPILOT_INVALID_EDIT_MESSAGE`; create no Undo token and emit no `edit_applied` outcome. |
| `bob/lib/control-host.ts` | Export the narrow typography family-op expansion adapter needed by Bob and Roma; keep session and persistence ownership out of this seam. |
| `dieter/components/dropdown-actions/dropdown-actions.ts`, `tokyo/product/dieter/components/dropdown-actions/dropdown-actions.js` | Delete Dieter's typography companion-selection branch. A family click emits only raw family intent; generated output must match source. Keep option filtering and normal dropdown lifecycle. |
| `roma/components/widget-defaults-builder-controls.tsx`, `roma/components/widget-defaults-domain.tsx` | Expand family intent through the shared control-host adapter, apply the resulting triple to shell/core draft state in one update, restore controls and show product copy on rejection, and keep the draft clean. |
| `roma/lib/account-widget-defaults-contract.ts` | Validate shell and every widget-core typography selection with the widget-shell validator on GET and PUT; return exact invalid paths. |
| `roma/tests/run-widget-defaults-typography.ts`, `roma/package.json` | Prove current-account custom-font transitions and rejection/unchanged-state/server-contract behavior for shell and widget-core defaults. |
| `tokyo/product/widgets/{big-bang,calltoaction,cards,countdown,faq}/spec.json` | Declare labels for widget-specific typography roles and the proven Big Bang/Call to Action shared-role overrides. Use `Section title` for FAQ `section`. |
| `scripts/widgets/compile-all.ts` | Inspect each actual widget client's `CKTypography.applyTypography` role map with the TypeScript AST and require exact key parity with that widget's composed spec roles. Fail unsupported/dynamic role-map construction. Add no registry. |
| `bob/tests/run-typography-contract.ts` | Prove all eight widgets, account-independent compilation, account-bound custom-font acceptance, transition/rejection rules, unchanged state on manual/Copilot rejection, no false Undo/outcome, role-label completeness, and role-aware Copilot metadata. |
| `bob/package.json` | Add the focused typography contract test command. |

### Documentation

| Path | Planned change |
| --- | --- |
| `documentation/engineering/UI/typography.md` | State compiler/session font authority and explicit widget-role label ownership. |
| `documentation/engineering/UI/dieter.md` | State that Dieter emits control intent and never owns account-font transition policy. |
| `documentation/services/bob.md` | Document account-bound compiled controls and the absence of a compiler default font catalog. |
| `documentation/services/roma.md` | Document Widget Defaults as the second account-bound host of the same account font contract. |
| `documentation/widgets/authoring/ToolDrawerControls.md` | Document `shared.roleLabels` for widget-specific typography roles and compile failure on omission. |
| `documentation/widgets/shared/ShellUtilities.md` | Document shell-owned role labels and build-time parity between composed roles and each actual widget client map. |

### Generated, Product Data, And Deploy Surfaces

- No R2 or Supabase mutation.
- No account font data repair.
- No bulk or unsolicited public-package regeneration. The real Bob save proof
  rematerializes only the selected instance's base package through normal save.
- No widget runtime-source or materialized-runtime byte change.
- Dieter source and generated `dropdown-actions.js` change together and deploy
  through the existing product-root sync.
- Widget `spec.json` changes deploy through the existing Tokyo product-root
  Git/Worker workflow.
- Bob and Roma changes deploy through their Git-connected Pages projects.
- Step-9 verification must prove both Pages SHAs, the product-root action, and
  exact R2 read-back for changed specs and generated Dieter output before
  authenticated Bob and Roma product proof.

### Explicit No-Touch

- `tokyo/product/fonts/special/*` during pre-execution and as Git evidence.
- Account asset bytes and `CLICKEEN` `fontLibrary` product data.
- Supabase.
- Tokyo-worker font routes or asset handlers.
- Roma public runtime font loading and bulk package regeneration. The selected
  Bob smoke instance is rematerialized only by its normal verification save.
- San Francisco and translation state.
- Dieter components other than `dropdown-actions`, Dieter tracking values,
  Admin local tracking, and Prague page typography.
- `tokyo/product/widgets/shared/typography.js` and every widget
  `widget.client.js`; current behavior stays unchanged and build validation
  verifies those actual role maps.

## Step-6 Verdict

GREEN. The current defect, authority correction, exact files, deploy fanout,
no-touch set, and verification bar are deterministic. Step 7 may be finalized
from this audit. Step 9 remains prohibited until Step 8 independently reviews
the exact committed plan tree.

## V1-V8 Audit

| ID | Result |
| --- | --- |
| V1 | GREEN: no missing font is replaced with an invented family. |
| V2 | GREEN: invalid persisted font state remains a failure. |
| V3 | TARGETED: explicit widget role labels replace silent role omission. |
| V4 | TARGETED: Bob and Roma will both fail closed through the same validator. |
| V5 | GREEN: corrupt config is not treated as absent/default. |
| V6 | TARGETED: Dieter intent, both editors, save contracts, and runtime will use one authority. |
| V7 | GREEN: no special-font path or substitute registry is restored. |
| V8 | GREEN: tests prove source behavior and do not become runtime dependencies. |
