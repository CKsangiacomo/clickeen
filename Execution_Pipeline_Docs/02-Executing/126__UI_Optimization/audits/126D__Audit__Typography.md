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
- Account-bound editing authority: Bob document session after it receives the
  compiled widget and current account font library.
- Public widget typography: saved structured typography plus
  `tokyo/product/widgets/shared/typography.js`.

The compiler cannot be an account font authority because the same compiled
widget contract serves every account. The Bob session is the first place where
the compiled widget and current account font library meet.

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

### Real Product Defect: Bob Offers Account Fonts That Its Contract Rejects

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

This is V6 partial-success masquerade: the product offers a choice that its
own editing contract refuses.

### Correct Authority Change

The compiler must emit family controls as account-independent string controls,
with no default account family enum. When Bob opens an instance, the session
must bind those family controls to the normalized current account font library
before validating instance data. The bound controls become the session
authority for direct edits, Copilot, config validation, and save validation.
The same session contract must validate each role's family, weight, and style
against that account font record after open, after every operation, and before
save.

The visible menu continues to use the same account font library. No second font
catalog is created.

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

The shared public runtime currently iterates `roleConfig` but does not reject an
extra saved role absent from that map. It must compare the saved role-key set
with the widget role-config key set and fail explicitly on any missing or extra
key before applying typography. This is product contract enforcement, not a
test dependency or a new registry.

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
| `bob/lib/compiler/modules/typography.ts` | Stop embedding default-account family options. Enumerate actual composed roles. Use four shell labels plus explicit widget role labels; fail on missing/extra widget role metadata. |
| `bob/lib/compiler/editor-contract.ts` | Accept and validate `shared.roleLabels` for the shared typography panel and pass it to the typography renderer. |
| `bob/lib/edit/typography-fonts.ts` | Delete the file. Its default-account catalog and re-exports have no remaining authority or consumers once generic weight labels live with the compiler. |
| `bob/lib/session/sessionConfig.ts` | Add the pure account-library control binder and one account-aware typography assertion for global/role family membership and per-role allowed weights/styles. |
| `bob/lib/session/useSessionBoot.ts` | Normalize the font library, bind the compiled family controls, then validate instance config and account typography selections against that same bound session contract. Store the bound compiled widget in session state. |
| `bob/lib/session/useSessionEditing.ts` | Run the account-aware typography assertion after generic op/config validation and before accepting edited state. |
| `bob/lib/session/useSessionSaving.ts` | Run the same account-aware assertion before sending save. |
| `bob/lib/session/WidgetDocumentSession.tsx` | Pass the existing session metadata reference into editing so it uses the already-normalized current account library. |
| `bob/components/CopilotPane.tsx` | Build family options from the bound controls and filter each role's weight/style choices from the selected current-account family record. Keep final session validation authoritative. |
| `tokyo/product/widgets/{big-bang,calltoaction,cards,countdown,faq}/spec.json` | Declare labels for widget-specific typography roles and the proven Big Bang/Call to Action shared-role overrides. Use `Section title` for FAQ `section`. |
| `tokyo/product/widgets/shared/typography.js` | Require exact saved-role/roleConfig key parity before applying role typography; keep existing role application and font loading. |
| `bob/tests/run-typography-contract.ts` | Add deterministic current-product proof for all eight widgets, account-independent compilation, account-bound custom-font acceptance, unknown-font rejection, allowed/disallowed weight/style validation, role-label completeness, and shared-runtime missing/extra-role rejection. |
| `bob/package.json` | Add the focused typography contract test command. |

### Documentation

| Path | Planned change |
| --- | --- |
| `documentation/engineering/UI/typography.md` | State compiler/session font authority and explicit widget-role label ownership. |
| `documentation/services/bob.md` | Document account-bound compiled controls and the absence of a compiler default font catalog. |
| `documentation/widgets/authoring/ToolDrawerControls.md` | Document `shared.roleLabels` for widget-specific typography roles and compile failure on omission. |

### Generated, Product Data, And Deploy Surfaces

- No generated Dieter source change.
- No R2 or Supabase mutation.
- No account font data repair.
- No public package or instance regeneration.
- Widget `spec.json` changes deploy through the existing Tokyo product-root
  Git/Worker workflow.
- Bob changes deploy through the existing Git-connected Bob Pages workflow.
- Step-9 verification must prove both deployed SHA authorities and then open a
  real account-font instance through Roma/Bob.

### Explicit No-Touch

- `tokyo/product/fonts/special/*` during pre-execution and as Git evidence.
- Account asset bytes and `CLICKEEN` `fontLibrary` product data.
- Supabase.
- Tokyo-worker font routes or asset handlers.
- Roma materialization and public runtime font loading.
- San Francisco and translation state.
- Dieter tracking values, Admin local tracking, and Prague page typography;
  those remain with their named visual/surface owners.
- Widget-specific runtime role maps, because current role-key parity is proven;
  only the shared runtime's explicit parity assertion changes.

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
| V4 | GREEN: missing/malformed account font data remains fail-closed. |
| V5 | GREEN: corrupt config is not treated as absent/default. |
| V6 | TARGETED: the account menu and account-bound validation will use one authority. |
| V7 | GREEN: no special-font path or substitute registry is restored. |
| V8 | GREEN: tests prove source behavior and do not become runtime dependencies. |
