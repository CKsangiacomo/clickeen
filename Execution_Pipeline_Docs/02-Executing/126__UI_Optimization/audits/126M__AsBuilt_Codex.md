# 126M Roma UI - As-Built Audit - Codex

Status: CODEX ONLY - Phase 1 Step 1 as-built audit.

Scope: Roma UI current system only. This audit records current runtime/docs/code
truth before convergence. It does not execute Step 4+, does not select fixes,
does not change source code, and does not edit GLM artifacts.

## 1. Authority Boundary

Roma is the authenticated current-account app and Builder host.

Evidence:

- `documentation/services/roma.md:1` names Roma as the account app.
- `documentation/services/roma.md:5` says Roma routes the user to the current
  account, enforces account capability, and saves account-owned work through
  Tokyo.
- `documentation/services/roma.md:40` names `GET /api/bootstrap` as the account
  context bootstrap.
- `documentation/services/roma.md:45` through `documentation/services/roma.md:50`
  list user identity, current account, role, account public id, authz capsule,
  and entitlement snapshot.
- `documentation/services/roma.md:55` says browser code uses same-origin Roma
  APIs.
- `documentation/services/roma.md:58` through `documentation/services/roma.md:72`
  map Roma route families to Berlin, Tokyo-worker, Roma settings/defaults,
  Bob compiler proxy, and San Francisco through grants.
- `documentation/architecture/CONTEXT.md:109` states Roma is the app and routes
  the user to the current account.
- `documentation/architecture/CONTEXT.md:110` states Bob is the Builder editor.
- `documentation/architecture/CONTEXT.md:111` states Tokyo stores and serves
  account runtime data.

As-built reading:

- Roma UI work must preserve the current-account authority boundary.
- Roma is not a generic admin UI and not the Bob editor.
- Bob editing remains browser-memory work; Roma owns persistence routes.

## 2. App Entry And Dieter Loading

Roma loads Roma CSS and Dieter CSS from the Tokyo Dieter artifact base.

Evidence:

- `roma/app/layout.tsx:1` imports `./roma.css`.
- `roma/app/layout.tsx:3` imports `resolveTokyoBaseUrl`.
- `roma/app/layout.tsx:5` through `roma/app/layout.tsx:6` build
  `DIETER_BASE` from Tokyo.
- `roma/app/layout.tsx:13` loads Dieter `tokens/tokens.css`.
- `roma/app/layout.tsx:14` loads Dieter segmented CSS.
- `roma/app/layout.tsx:15` loads Dieter button CSS.
- `roma/app/layout.tsx:16` loads Dieter textfield CSS.
- `roma/app/layout.tsx:17` loads Dieter toggle CSS.
- `roma/app/layout.tsx:18` loads Dieter popover CSS.
- `roma/app/layout.tsx:20` applies the Inter Tight font class to the body.

As-built reading:

- Roma is token-aware and has Dieter CSS available.
- Roma does not import Dieter React components for the shell/domains inspected
  in this audit.
- Dieter adoption in Roma currently means CSS/class usage, not custom element
  migration.

## 3. Authenticated Shell And Navigation

Roma authed routes are thin domain wrappers around a shared shell.

Evidence:

- `roma/app/(authed)/layout.tsx:2` imports `RomaAccountBoundary`.
- `roma/app/(authed)/layout.tsx:5` wraps authed children in
  `RomaAccountBoundary`.
- `roma/app/(authed)/layout.tsx:8` sets the runtime to `edge`.
- `roma/app/(authed)/layout.tsx:9` forces dynamic rendering.
- `roma/app/(authed)/domain-page-shell.tsx:4` imports `RomaShell`.
- `roma/app/(authed)/domain-page-shell.tsx:5` imports
  `RomaAccountNoticeModal`.
- `roma/app/(authed)/domain-page-shell.tsx:6` imports
  `RomaDomainErrorBoundary`.
- `roma/app/(authed)/domain-page-shell.tsx:16` renders `RomaShell` with the
  active domain and title.
- `roma/app/(authed)/domain-page-shell.tsx:17` renders the account notice modal
  inside every domain shell.
- `roma/app/(authed)/domain-page-shell.tsx:18` uses a Suspense fallback with
  `roma-module-surface`.
- `roma/app/(authed)/domain-page-shell.tsx:19` wraps the domain component in the
  Roma error boundary.
- `roma/components/roma-shell.tsx:17` through `roma/components/roma-shell.tsx:22`
  define default header actions with Dieter text-button classes.
- `roma/components/roma-shell.tsx:35` renders `.roma-layout`.
- `roma/components/roma-shell.tsx:36` renders `.roma-layout__nav`.
- `roma/components/roma-shell.tsx:40` renders `.rd-domain`.
- `roma/components/roma-shell.tsx:41` renders `.rd-header`.
- `roma/components/roma-shell.tsx:43` through `roma/components/roma-shell.tsx:46`
  render a mobile `details` nav drawer.
- `roma/components/roma-shell.tsx:53` renders the domain canvas as `.rd-canvas`
  unless overridden.
- `roma/components/roma-nav.tsx:22` sets `aria-current="page"` on active domain
  entries.
- `roma/components/roma-nav.tsx:45` renders the nav with `aria-label="Roma nav"`.
- `roma/components/roma-nav.tsx:60` maps main domains.
- `roma/components/roma-nav.tsx:63` through `roma/components/roma-nav.tsx:72`
  render settings as a nested `details` nav section.
- `roma/lib/domains.ts:1` through `roma/lib/domains.ts:13` define 12 Roma
  domain keys.
- `roma/lib/domains.ts:22` through `roma/lib/domains.ts:35` define domain
  labels, hrefs, and descriptions.
- `roma/lib/domains.ts:37` through `roma/lib/domains.ts:44` define main domains.
- `roma/lib/domains.ts:46` through `roma/lib/domains.ts:54` define settings
  domains.

Current domain keys:

- `home`
- `profile`
- `builder`
- `widgets`
- `pages`
- `assets`
- `team`
- `billing`
- `usage`
- `ai`
- `settings`
- `widgetDefaults`

As-built reading:

- The shell is shared, but the shell classes are local `.roma-*` and `.rd-*`
  primitives.
- Domain routing is structured and centralized enough for later convergence to
  use as current truth.
- The settings section is a nested nav group, not a separate shell.

## 4. Roma CSS Surface

`roma/app/roma.css` is still the large local UI layer.

Evidence:

- `roma/app/roma.css` is 762 lines in the current working tree.
- `roma/app/roma.css:19` through `roma/app/roma.css:35` define the Roma layout
  grid and nav column.
- `roma/app/roma.css:37` through `roma/app/roma.css:132` define the nav, brand,
  links, settings subnav, and sign-out button.
- `roma/app/roma.css:139` through `roma/app/roma.css:246` define `.rd-domain`,
  `.rd-header`, `.rd-canvas`, `.rd-canvas--builder`, and
  `.rd-canvas-module`.
- `roma/app/roma.css:248` through `roma/app/roma.css:255` define
  `.roma-module-surface`.
- `roma/app/roma.css:257` through `roma/app/roma.css:499` define the
  `widget-defaults` form/control subsystem.
- `roma/app/roma.css:423` through `roma/app/roma.css:461` hand-style checkbox
  inputs as toggles for widget defaults.
- `roma/app/roma.css:463` through `roma/app/roma.css:478` define
  `widget-defaults-input` and textarea behavior.
- `roma/app/roma.css:501` through `roma/app/roma.css:520` define the instance
  rename form.
- `roma/app/roma.css:522` through `roma/app/roma.css:534` define local stack and
  grid helpers.
- `roma/app/roma.css:536` through `roma/app/roma.css:551` define `.roma-card`.
- `roma/app/roma.css:553` through `roma/app/roma.css:569` define
  `.roma-codeblock`.
- `roma/app/roma.css:571` through `roma/app/roma.css:584` define
  `.roma-toolbar`.
- `roma/app/roma.css:586` through `roma/app/roma.css:609` define account-locale
  list/option/toggle layout.
- `roma/app/roma.css:611` through `roma/app/roma.css:623` define `.roma-input`.
- `roma/app/roma.css:625` through `roma/app/roma.css:641` define
  `.roma-form-grid` and `.roma-field`.
- `roma/app/roma.css:643` through `roma/app/roma.css:670` define `.roma-table`.
- `roma/app/roma.css:672` through `roma/app/roma.css:676` define
  `.roma-cell-actions`.
- `roma/app/roma.css:678` through `roma/app/roma.css:712` define local modal
  backdrop, panel, and actions.
- `roma/app/roma.css:714` through `roma/app/roma.css:722` define the Builder
  iframe.
- `roma/app/roma.css:724` through `roma/app/roma.css:762` define the mobile
  breakpoint and table overflow behavior.

Raw local pixel values in CSS:

- `roma/app/roma.css:190` uses `margin-top: 8px`.
- `roma/app/roma.css:194` uses `padding: 8px`.
- `roma/app/roma.css:201` uses `gap: 8px`.
- `roma/app/roma.css:603` uses `margin-top: 2px`.
- `roma/app/roma.css:675` uses `gap: 8px`.
- `roma/app/roma.css:684` uses `padding: 20px`.
- `roma/app/roma.css:711` uses `margin-top: 4px`.

As-built reading:

- Roma has Dieter tokens available but still owns a full local component/surface
  layer.
- `widget-defaults` is a second dense local form/control system inside the Roma
  local layer.
- The mobile/table behavior is current UI truth and cannot be assumed absent.
- This audit records current CSS only; it does not select tokenization or
  deletion work.

## 5. Dieter Usage In Roma UI

Roma uses Dieter text-button CSS broadly, but most form/table/modal/card surfaces
are not Dieter-backed.

Evidence:

- `rg -o "diet-[A-Za-z0-9_-]+" roma/app roma/components -g '*.tsx' -g '*.css'`
  shows Dieter usage concentrated in `diet-btn-txt` and
  `diet-btn-txt__label`.
- The same scan shows no `diet-textfield`, `diet-toggle`, `diet-segmented`,
  `diet-popover`, or `diet-button` class hits in `roma/app` or
  `roma/components`.
- `roma/components/roma-shell.tsx:17` through `roma/components/roma-shell.tsx:22`
  use `diet-btn-txt` for shell actions.
- `roma/components/widgets-domain.tsx:421` through
  `roma/components/widgets-domain.tsx:425` use `diet-btn-txt` for create.
- `roma/components/widgets-domain.tsx:526` through
  `roma/components/widgets-domain.tsx:569` use `diet-btn-txt` for row actions.
- `roma/components/pages-domain.tsx:720` through
  `roma/components/pages-domain.tsx:765` use `diet-btn-txt` for metadata,
  publish, unpublish, and copy actions.
- `roma/components/assets-domain.tsx:401` through
  `roma/components/assets-domain.tsx:404` use `diet-btn-txt` for delete.
- `roma/components/account-locale-settings-card.tsx:316` through
  `roma/components/account-locale-settings-card.tsx:328` use `diet-btn-txt` for
  refresh/save actions.
- `roma/components/widget-defaults-builder-controls.tsx` references Dieter/Bob
  builder-control classes such as `diet-choice-tiles__field`,
  `diet-dropdown-actions__value-field`, `diet-dropdown-edit__field`, and
  `diet-textedit__field`.

As-built reading:

- Button styling is the strongest Dieter adoption in Roma.
- Text fields, toggles, segmented controls, popovers, tables, cards, and modals
  remain local or Bob-control-derived in inspected Roma surfaces.
- Later convergence must be class/markup-aware, because loaded Dieter styles are
  CSS files rather than imported React components.

## 6. Shared Primitive Layer State

The shared Roma primitive layer described by older 126M seed text does not exist
as current runtime.

Evidence:

- `find roma/components/ui -maxdepth 2 -type f` returns no files in the current
  working tree.
- `rg -n "DataTable|PageHeader|EmptyState|FormField|Toast|Modal" roma/components
  roma/app -g '*.tsx' -g '*.ts'` finds only `RomaAccountNoticeModal` and its
  import.
- `roma/components` is a flat component folder with domain components and
  helpers.

As-built reading:

- Roma domains are not current consumers of shared UI primitives named
  `DataTable`, `PageHeader`, `EmptyState`, `FormField`, `Modal`, or `Toast`.
- Current repeated UI is local markup and CSS, not a primitive-based layer.

## 7. Large Domain Files

Large domain components remain in the current tree.

Current line counts:

- `roma/components/pages-domain.tsx`: 1106 lines.
- `roma/components/builder-domain.tsx`: 973 lines.
- `roma/components/widget-defaults-domain.tsx`: 718 lines.
- `roma/components/widgets-domain.tsx`: 624 lines.
- `roma/components/assets-domain.tsx`: 488 lines.
- `roma/components/account-locale-settings-card.tsx`: 334 lines.
- `roma/components/team-domain.tsx`: 311 lines.
- `roma/components/team-member-domain.tsx`: 303 lines.
- `roma/components/profile-domain.tsx`: 289 lines.
- `roma/components/settings-domain.tsx`: 190 lines.
- `roma/components/accept-invite-domain.tsx`: 126 lines.
- `roma/components/roma-account-notice-modal.tsx`: 110 lines.
- `roma/components/usage-domain.tsx`: 77 lines.
- `roma/components/roma-nav.tsx`: 78 lines.
- `roma/components/roma-shell.tsx`: 58 lines.
- `roma/components/home-domain.tsx`: 41 lines.
- `roma/components/ai-domain.tsx`: 40 lines.
- `roma/components/billing-domain.tsx`: 33 lines.

As-built reading:

- The old 126M seed counts are stale in at least the Builder count.
- Current audit should use the line counts above, not inherited prior-draft
  numbers.

## 8. Widgets Domain

Widgets owns account widget instance lifecycle UI and uses local table/form/modal
patterns.

Evidence:

- `roma/components/widgets-domain.tsx:64` exports `WidgetsDomain`.
- `roma/components/widgets-domain.tsx:73` through
  `roma/components/widgets-domain.tsx:83` define local action, error, upgrade,
  data, loading, refresh, rename, and rename-error state.
- `roma/components/widgets-domain.tsx:184` starts create-instance handling.
- `roma/components/widgets-domain.tsx:225` starts duplicate-instance handling.
- `roma/components/widgets-domain.tsx:266` starts delete-instance handling.
- `roma/components/widgets-domain.tsx:323` starts rename handling.
- `roma/components/widgets-domain.tsx:383` through
  `roma/components/widgets-domain.tsx:396` render error/loading feedback and a
  retry button.
- `roma/components/widgets-domain.tsx:400` through
  `roma/components/widgets-domain.tsx:402` render the empty widget-type state.
- `roma/components/widgets-domain.tsx:430` renders a `.roma-table`.
- `roma/components/widgets-domain.tsx:458` through
  `roma/components/widgets-domain.tsx:490` render inline rename input/actions.
- `roma/components/widgets-domain.tsx:502` renders publish status copy.
- `roma/components/widgets-domain.tsx:526` through
  `roma/components/widgets-domain.tsx:569` render publish/unpublish/rename/
  duplicate/delete row actions.
- `roma/components/widgets-domain.tsx:582` renders the "No instances yet" row.
- `roma/components/widgets-domain.tsx:592` through
  `roma/components/widgets-domain.tsx:600` render a local upgrade modal.

As-built reading:

- Widgets has richer state handling than smaller static domains.
- Widgets still uses local table and modal structures.
- Upgrade-prompt behavior is current UI state, not a shared primitive.

## 9. Pages Domain

Pages is the largest current Roma UI domain and includes page source editing,
localization settings, placement management, publishing controls, and local
modals.

Evidence:

- `roma/components/pages-domain.tsx:120` exports `PagesDomain`.
- `roma/components/pages-domain.tsx:129` through
  `roma/components/pages-domain.tsx:143` define pages, source, publish status,
  widget instances, locale options, modal state, loading, refreshing, source
  loading, mutation error, and action/copy states.
- `roma/components/pages-domain.tsx:315` sets
  `ipLocalizationBlocksPublish`.
- `roma/components/pages-domain.tsx:316` sets
  `pagePublishingUnavailable = true`.
- `roma/components/pages-domain.tsx:335` starts the shared page source save
  helper.
- `roma/components/pages-domain.tsx:365` starts create-page handling.
- `roma/components/pages-domain.tsx:402` starts delete-page handling.
- `roma/components/pages-domain.tsx:485` through
  `roma/components/pages-domain.tsx:493` save metadata/settings by calling the
  page source save helper.
- `roma/components/pages-domain.tsx:495` starts publish/unpublish handling.
- `roma/components/pages-domain.tsx:598` through
  `roma/components/pages-domain.tsx:601` render the create-page button.
- `roma/components/pages-domain.tsx:616` through
  `roma/components/pages-domain.tsx:617` render loading and empty page states.
- `roma/components/pages-domain.tsx:619` renders a `.roma-table`.
- `roma/components/pages-domain.tsx:660` renders source-loading state.
- `roma/components/pages-domain.tsx:673` through
  `roma/components/pages-domain.tsx:707` render metadata inputs as
  `.roma-input`.
- `roma/components/pages-domain.tsx:720` through
  `roma/components/pages-domain.tsx:765` render metadata/publish/copy actions.
- `roma/components/pages-domain.tsx:782` renders publish blocker copy.
- `roma/components/pages-domain.tsx:785` renders IP localization unavailable
  copy.
- `roma/components/pages-domain.tsx:786` renders page package unavailable copy.
- `roma/components/pages-domain.tsx:787` through
  `roma/components/pages-domain.tsx:788` render page-locked/copy guidance.
- `roma/components/pages-domain.tsx:799` through
  `roma/components/pages-domain.tsx:811` render default locale selection.
- `roma/components/pages-domain.tsx:839` renders a country-locale rules table.
- `roma/components/pages-domain.tsx:852` and
  `roma/components/pages-domain.tsx:862` use `.roma-input` in country-locale
  rows.
- `roma/components/pages-domain.tsx:909` through
  `roma/components/pages-domain.tsx:912` render save settings action.
- `roma/components/pages-domain.tsx:941` through
  `roma/components/pages-domain.tsx:1001` render the add-instances local modal.
- `roma/components/pages-domain.tsx:1030` renders the placed-widgets
  `.roma-table`.
- `roma/components/pages-domain.tsx:1052` renders unavailable/unpublished
  publish-blocking copy for placements.
- `roma/components/pages-domain.tsx:1100` renders "No widgets placed yet."

As-built reading:

- Pages has current UI truth for account pages and placement management.
- It contains explicit unavailable/stub-like copy that must not be silently
  erased in later docs.
- It depends heavily on local `.roma-input`, `.roma-table`, and `.roma-modal`
  patterns.

## 10. Assets Domain

Assets owns account asset listing, upload, delete, storage facts, and bulk upload
UI.

Evidence:

- `roma/components/assets-domain.tsx:116` exports `AssetsDomain`.
- `roma/components/assets-domain.tsx:131` through
  `roma/components/assets-domain.tsx:141` define assets, storage, error,
  loading, delete, upload, bulk modal, and bulk item state.
- `roma/components/assets-domain.tsx:144` starts asset loading.
- `roma/components/assets-domain.tsx:190` through
  `roma/components/assets-domain.tsx:204` perform delete request/error handling.
- `roma/components/assets-domain.tsx:314` through
  `roma/components/assets-domain.tsx:315` compute loading/unavailable storage
  labels.
- `roma/components/assets-domain.tsx:323` through
  `roma/components/assets-domain.tsx:325` render domain error text.
- `roma/components/assets-domain.tsx:378` renders a `.roma-table`.
- `roma/components/assets-domain.tsx:401` through
  `roma/components/assets-domain.tsx:404` render delete action.
- `roma/components/assets-domain.tsx:412` renders loading/unavailable asset
  table copy.
- `roma/components/assets-domain.tsx:418` renders empty asset state.
- `roma/components/assets-domain.tsx:427` through
  `roma/components/assets-domain.tsx:461` render the bulk upload local modal and
  table.

As-built reading:

- Assets has meaningful error/loading/empty handling.
- Assets still uses local table and modal implementations.

## 11. Builder Domain And Bob Host

Builder is a Roma domain that hosts Bob in an iframe and maps Bob commands to
Roma same-origin account routes.

Evidence:

- `roma/components/builder-domain.tsx:46` through
  `roma/components/builder-domain.tsx:48` include translation command names in
  the Bob account command union.
- `roma/components/builder-domain.tsx:149` through
  `roma/components/builder-domain.tsx:150` build concrete Builder routes.
- `roma/components/builder-domain.tsx:153` through
  `roma/components/builder-domain.tsx:219` map Bob commands to same-origin Roma
  routes.
- `roma/components/builder-domain.tsx:165` through
  `roma/components/builder-domain.tsx:170` map `update-instance` to
  `PUT /api/account/instances/:instanceId`.
- `roma/components/builder-domain.tsx:186` through
  `roma/components/builder-domain.tsx:203` map list/read/generate translations
  to translation routes.
- `roma/components/builder-domain.tsx:204` through
  `roma/components/builder-domain.tsx:215` map Copilot commands.
- `roma/components/builder-domain.tsx:221` through
  `roma/components/builder-domain.tsx:230` build Bob translation setup from
  base locale, active locales, and account policy.
- `roma/components/builder-domain.tsx:526` through
  `roma/components/builder-domain.tsx:528` request `text/event-stream` for
  `generate-translations`.
- `roma/components/builder-domain.tsx:550` through
  `roma/components/builder-domain.tsx:578` returns command results to Bob.
- `roma/components/builder-domain.tsx:594` through
  `roma/components/builder-domain.tsx:659` posts `ck:open-editor` and waits for
  Bob acknowledgement.
- `roma/components/builder-domain.tsx:674` through
  `roma/components/builder-domain.tsx:720` loads the Builder-open envelope,
  compiled widget, base locale, translation setup, and sends the Bob open
  payload.
- `roma/components/builder-domain.tsx:834` uses `window.confirm` for unsaved
  Builder navigation.
- `roma/components/builder-domain.tsx:877` through
  `roma/components/builder-domain.tsx:888` render no-instance-selected state.
- `roma/components/builder-domain.tsx:891` through
  `roma/components/builder-domain.tsx:963` render return/copy/open/error UI.
- `roma/components/builder-domain.tsx:950` renders copy status as body text.
- `roma/components/builder-domain.tsx:951` renders publish-before-copy copy.
- `roma/components/builder-domain.tsx:964` renders the Bob iframe.

As-built reading:

- Builder is the UI bridge between Roma authority and Bob editing.
- Bob account commands are explicit same-origin route mappings.
- Translation generation is exposed as a separate command from instance update.
- This audit found no top-of-builder stale-translation banner in
  `builder-domain.tsx`.

## 12. Save And Translation Boundary

Current route code separates source/base save from explicit translation
generation.

Save evidence:

- `roma/app/api/account/instances/[instanceId]/route.ts:49` starts the save
  `PUT` route.
- `roma/app/api/account/instances/[instanceId]/route.ts:50` requires current
  account context with editor role.
- `roma/app/api/account/instances/[instanceId]/route.ts:62` through
  `roma/app/api/account/instances/[instanceId]/route.ts:74` read the JSON
  payload.
- `roma/app/api/account/instances/[instanceId]/route.ts:116` through
  `roma/app/api/account/instances/[instanceId]/route.ts:140` load account
  locale state to resolve the base locale.
- `roma/app/api/account/instances/[instanceId]/route.ts:142` compiles widget
  software for the instance package.
- `roma/app/api/account/instances/[instanceId]/route.ts:150` through
  `roma/app/api/account/instances/[instanceId]/route.ts:162` enforce save
  policy.
- `roma/app/api/account/instances/[instanceId]/route.ts:163` through
  `roma/app/api/account/instances/[instanceId]/route.ts:179` materialize the
  base public package.
- `roma/app/api/account/instances/[instanceId]/route.ts:180` through
  `roma/app/api/account/instances/[instanceId]/route.ts:194` materialize source
  artifacts.
- `roma/app/api/account/instances/[instanceId]/route.ts:196` through
  `roma/app/api/account/instances/[instanceId]/route.ts:207` save source,
  content, and base public package to Tokyo.
- `roma/app/api/account/instances/[instanceId]/route.ts:212` through
  `roma/app/api/account/instances/[instanceId]/route.ts:218` return `{ ok:
  true }`.

Translation evidence:

- `roma/app/api/account/instances/[instanceId]/translations/generate/route.ts:1`
  imports route/runtime dependencies for translation generation.
- `roma/app/api/account/instances/[instanceId]/translations/generate/route.ts:3`
  through `roma/app/api/account/instances/[instanceId]/translations/generate/route.ts:6`
  import `generateAccountInstanceTranslations`.
- `roma/app/api/account/instances/[instanceId]/translations/generate/route.ts:7`
  imports locale package materialization.
- `roma/app/api/account/instances/[instanceId]/translations/generate/route.ts:23`
  through `roma/app/api/account/instances/[instanceId]/translations/generate/route.ts:125`
  define the streaming translation command path.
- `roma/app/api/account/instances/[instanceId]/translations/generate/route.ts:60`
  through `roma/app/api/account/instances/[instanceId]/translations/generate/route.ts:69`
  call the Translation Agent with activity forwarding.
- `roma/app/api/account/instances/[instanceId]/translations/generate/route.ts:83`
  through `roma/app/api/account/instances/[instanceId]/translations/generate/route.ts:105`
  materialize locale packages after accepted translation generation.
- `roma/app/api/account/instances/[instanceId]/translations/generate/route.ts:127`
  starts the non-streaming `POST` route.
- `roma/app/api/account/instances/[instanceId]/translations/generate/route.ts:193`
  through `roma/app/api/account/instances/[instanceId]/translations/generate/route.ts:201`
  call translation generation.
- `roma/app/api/account/instances/[instanceId]/translations/generate/route.ts:213`
  through `roma/app/api/account/instances/[instanceId]/translations/generate/route.ts:221`
  materialize locale packages.

Bob UI evidence:

- `bob/components/TranslationsPanel.tsx:137` through
  `bob/components/TranslationsPanel.tsx:143` disable/label translation
  generation when the widget is dirty or has no translation fields.
- `bob/components/TranslationsPanel.tsx:168` through
  `bob/components/TranslationsPanel.tsx:176` compute the Generate translations
  button state and label.
- `bob/components/TranslationsPanel.tsx:179` through
  `bob/components/TranslationsPanel.tsx:202` runs the explicit generate
  translations command.
- `bob/components/TranslationsPanel.tsx:233` renders the Generate translations
  button.
- `bob/components/TranslationsPanel.tsx:240` through
  `bob/components/TranslationsPanel.tsx:242` render generating activity rows.

As-built reading:

- Source/base save and translation generation are separate current route
  authorities.
- Translation generation is an explicit Bob Translations panel command.
- Current Roma Builder UI does not show a stale-translation attention banner
  before or around the Bob iframe.
- This audit does not reopen save behavior; it only records current boundaries.

## 13. Account Locale Settings UI

Roma Settings has account language UI that saves active locales and reports
overlay follow-up state.

Evidence:

- `roma/components/settings-domain.tsx:48` exports `SettingsDomain`.
- `roma/components/settings-domain.tsx:151` renders
  `AccountLocaleSettingsCard`.
- `roma/components/account-locale-settings-card.tsx:110` through
  `roma/components/account-locale-settings-card.tsx:123` resolve success copy
  from `overlayUpdate`.
- `roma/components/account-locale-settings-card.tsx:185` starts `saveSettings`.
- `roma/components/account-locale-settings-card.tsx:196` through
  `roma/components/account-locale-settings-card.tsx:208` build active locale
  and locale policy payload.
- `roma/components/account-locale-settings-card.tsx:210` through
  `roma/components/account-locale-settings-card.tsx:214` call
  `PUT /api/account/locales`.
- `roma/components/account-locale-settings-card.tsx:217` renders success copy
  from the saved response.
- `roma/components/account-locale-settings-card.tsx:227` through
  `roma/components/account-locale-settings-card.tsx:330` render the language
  settings card.
- `roma/components/account-locale-settings-card.tsx:230` says account
  languages decide which translations Bob can generate.
- `roma/components/account-locale-settings-card.tsx:252` through
  `roma/components/account-locale-settings-card.tsx:271` render base language
  selection.
- `roma/components/account-locale-settings-card.tsx:284` through
  `roma/components/account-locale-settings-card.tsx:303` render active language
  checkboxes.
- `roma/components/account-locale-settings-card.tsx:307` through
  `roma/components/account-locale-settings-card.tsx:313` explain that locale
  switcher/IP behavior belongs to each widget in Builder.

As-built reading:

- Account language settings are explicit settings UI.
- Settings language save can report translation update follow-up state.
- The UI still uses local `.roma-select`, `.roma-inline-stack`, and
  `.roma-locale-settings__*` classes.

## 14. Other Domains And Copy

Smaller domains are a mix of static cards, forms, live reads, and product
governance copy.

Evidence:

- `roma/components/home-domain.tsx:6` exports `HomeDomain`.
- `roma/components/home-domain.tsx:17` through
  `roma/components/home-domain.tsx:33` render static `roma-card` quick actions.
- `roma/components/ai-domain.tsx:5` exports `AiDomain`.
- `roma/components/ai-domain.tsx:22` through `roma/components/ai-domain.tsx:32`
  render static `roma-card` AI entitlement facts.
- `roma/components/billing-domain.tsx:5` exports `BillingDomain`.
- `roma/components/billing-domain.tsx:12` says billing provider integration is
  not connected in this environment.
- `roma/components/billing-domain.tsx:15` through
  `roma/components/billing-domain.tsx:25` render static `roma-card` plan facts.
- `roma/components/usage-domain.tsx:17` through
  `roma/components/usage-domain.tsx:18` define storage usage/loading state.
- `roma/components/usage-domain.tsx:23` derives loading/unavailable storage
  copy.
- `roma/components/usage-domain.tsx:56` says broader usage reporting is not
  connected in Roma yet.
- `roma/components/team-domain.tsx:188` renders a `.roma-table` for members.
- `roma/components/team-domain.tsx:225` says invitations are Berlin-owned and
  the current surface only creates invitation records.
- `roma/components/team-domain.tsx:230` and
  `roma/components/team-domain.tsx:234` use `.roma-input` for invitation fields.
- `roma/components/team-domain.tsx:258` renders the invitations `.roma-table`.
- `roma/components/team-member-domain.tsx:184`,
  `roma/components/team-member-domain.tsx:208`, and
  `roma/components/team-member-domain.tsx:226` use inline `style={{...}}` on
  local stack layout.
- `roma/components/profile-domain.tsx:162` through
  `roma/components/profile-domain.tsx:253` render profile fields with
  `.roma-field` and `.roma-input`.
- `roma/components/profile-domain.tsx:259` and
  `roma/components/profile-domain.tsx:263` use inline `style={{...}}`.
- `roma/components/profile-domain.tsx:281` through
  `roma/components/profile-domain.tsx:283` render save notice.
- `roma/components/roma-domain-error-boundary.tsx:48` through
  `roma/components/roma-domain-error-boundary.tsx:68` render a domain rendering
  error surface and reload action.
- `roma/components/roma-account-notice-modal.tsx:47` exports the account notice
  modal.
- `roma/components/roma-account-notice-modal.tsx:86` through
  `roma/components/roma-account-notice-modal.tsx:106` render the notice with
  `.roma-modal-backdrop`, `.roma-modal`, and Dieter text button.

As-built reading:

- Home, billing, and AI are static card domains.
- Usage has a live storage usage read but broader reporting unavailable copy.
- Team/profile/settings use local forms/tables.
- Copy includes implementation/environment language that is current UI truth.

## 15. State Handling Matrix

Current state handling varies by domain.

Observed state branches:

- Account boundary: loading, auth redirect, unavailable, and reload states in
  `roma/components/roma-account-context.tsx:74` through
  `roma/components/roma-account-context.tsx:103`.
- Domain error boundary: rendering error surface in
  `roma/components/roma-domain-error-boundary.tsx:48` through
  `roma/components/roma-domain-error-boundary.tsx:68`.
- Widgets: loading, data error, mutation error, rename error, empty widget
  types, empty instances, upgrade modal.
- Pages: domain loading, refreshing, source loading, mutation error, empty
  pages, empty placements, publish blockers, unavailable package copy.
- Assets: loading, unavailable, empty assets, delete/upload/bulk errors.
- Team: loading members/invitations, invite error, empty invitation rows.
- Team member: loading, load error, mutation error, save/remove states.
- Profile: unavailable profile, save error, save notice.
- Settings: members loading/error, owner transfer loading/error, locale
  settings loading/error/success.
- Usage: storage loading/unavailable.
- Home: no domain-level loading/error/empty branch found.
- Billing: no domain-level loading/error/empty branch found.
- AI: no domain-level loading/error/empty branch found.

As-built reading:

- State handling exists, but it is not uniform.
- The smaller static domains should be treated as current static surfaces, not
  failed data surfaces unless later convergence changes product intent.

## 16. Same-Origin API Model

Roma UI calls same-origin routes; server routes call owning services.

Evidence:

- `roma/components/account-api.ts:22` through `roma/components/account-api.ts:28`
  define same-origin JSON fetch with Roma account headers.
- `roma/components/account-api.ts:30` through `roma/components/account-api.ts:65`
  expose `useRomaAccountApi`.
- `roma/app/api/bootstrap/route.ts` owns the `/api/bootstrap` UI bootstrap
  boundary.
- `roma/app/api/account/widgets/route.ts` owns the widget list/create route.
- `roma/app/api/account/instances/[instanceId]/route.ts` owns instance save and
  delete.
- `roma/app/api/account/instances/[instanceId]/translations/generate/route.ts`
  owns explicit translation generation.
- `roma/app/api/account/pages/route.ts` and
  `roma/app/api/account/pages/[pageId]/route.ts` own account page operations.
- `roma/app/api/account/assets/route.ts` and
  `roma/app/api/account/assets/upload/route.ts` own account asset operations.
- `roma/app/api/account/team/**` routes own team operations through Berlin.
- `roma/app/api/account/usage/route.ts` owns usage reads.
- `roma/app/api/builder/[instanceId]/open/route.ts` owns Builder-open envelope.
- `roma/app/api/widgets/[widgetname]/compiled/route.ts` owns Bob compiler
  payload proxy/read.

As-built reading:

- UI convergence must not bypass same-origin product routes.
- Product mutations remain route-owned, not direct UI storage writes.

## 17. Current Known Gaps Only

These are current-state gaps. They are not fixes.

- Roma has no current shared UI primitive layer under `roma/components/ui`.
- Roma loads Dieter CSS but uses Dieter mostly through text-button classes.
- Forms, tables, cards, modals, grids, shell, locale controls, and widget
  defaults remain local `.roma-*`, `.rd-*`, or `widget-defaults*` surfaces.
- `widget-defaults` is a dense second local form/control system and must be
  recorded separately from the general `.roma-*` layer.
- Current large domain components remain pages, builder, widget-defaults,
  widgets, and assets.
- Several prior-draft counts are stale and should not be reused without current
  audit.
- State handling differs by domain.
- Local modal/status patterns are repeated rather than centralized.
- Stub/internal/environment copy is visible in billing, usage, team, and pages.
- Source/base save and explicit translation generation are currently separate
  route authorities.
- The explicit Generate translations action exists in Bob's Translations panel.
- No top-of-builder stale-translation attention banner was found in Roma
  Builder UI.

## 18. Explicit Non-Decisions

- No code changes.
- No Roma redesign.
- No shared primitive implementation.
- No Dieter class migration.
- No CSS deletion.
- No domain splitting.
- No copy rewrite.
- No save/translation route change.
- No stale-translation banner implementation.
- No living-doc update.
- No GLM artifact edits.
- No Step 4+ convergence.

## 19. Compliance Check

Architecture compliance:

- Keeps Roma as current-account app authority.
- Keeps Bob as editor.
- Keeps Tokyo-worker as account storage boundary.
- Keeps Berlin/San Francisco/Tokyo ownership visible in route mapping.
- Records current Dieter consumption without inventing a new system.

Product compliance:

- No UI behavior changed.
- No product data changed.
- No account route changed.
- No save/localization operation changed.

Product-law compliance:

- No source truth was rewritten.
- No derivatives were generated.
- No product route authority was bypassed.
- No implementation plan was promoted to doctrine.

## 20. V1-V8 Pre-Execution Audit

This is documentation only and did not execute product behavior. Content check:

- V1 Silent substitution: avoided. Missing primitives and stale prior counts are
  named instead of replaced with invented values.
- V2 Silent healing: avoided. Local CSS, copy, and state gaps are recorded, not
  repaired in prose.
- V3 Silent omission: avoided. Shell, domains, Builder/Bob, save/translation,
  settings/locales, CSS, and API boundaries are included.
- V4 Fail-open control: not applicable; no controls changed.
- V5 Corruption-as-absence: avoided. Missing stale-translation banner is
  recorded as absent, not treated as implemented.
- V6 Partial-success masquerade: avoided. Backend route separation is not
  claimed as complete UI fulfillment.
- V7 Masquerade/redress: avoided. Local `.roma-*` surfaces are not renamed as
  Dieter adoption.
- V8 Runtime test dependency: not applicable; no runtime probes or tests added.
