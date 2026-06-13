# content.countdown — Countdown Widget PRD

STATUS: PRD

## What this widget does (1 sentence)
Renders a configurable countdown / personal countdown / number counter with optional CTA and “after end” behavior, edited in Bob and rendered deterministically in the embed.

## 0) Non-negotiables (Architecture)
1. **Account instances are the authoring unit**: Bob edits one account widget instance at a time.
2. **No silent fixups**: editor + runtime must not invent state, merge defaults, coerce invalid values, or generate IDs at render time.
3. **Deterministic render**: the same instance state produces the same output every time.
4. **CSS-first variants**: variants are driven by `data-*` + CSS variables; JS only sets attributes/vars and updates text/visibility.

## Entitlements + limits (v1)

- Tier values live in the global matrix: `packages/ck-policy/entitlements.matrix.json`.
- Widget policy-key mapping lives in `tokyo/product/widgets/countdown/limits.json`.
- The PRD lists entitlement keys and how they map to state paths; do not repeat per-tier matrices here.

### Limits mapping (initial)

```text
key                 | kind | path(s)                        | metric/mode         | enforce                    | notes
------------------- | ---- | ------------------------------ | ------------------- | -------------------------- | -----------------------------
branding.remove     | flag | behavior.showBacklink          | boolean (deny false)| load ignore; ops+publish reject | Remove branding
```

Plan limits are global usage counters (no per-widget matrices):
- `copilot.turns.monthly.max` (Copilot send)
- `storage.bytes.max` (total account storage for uploaded files; enforced at the upload boundary)

If Countdown needs tier packaging beyond usage/limits, prefer limits first; only introduce new flags when the capability is truly binary and user-visible.

## 1) Where the widget lives (authoritative)
Widget definition (the software): `tokyo/product/widgets/countdown/`
- `spec.json` — defaults + structured Builder editor contract
- `widget.html` — semantic scaffold + stable `data-role` hooks
- `widget.css` — scoped styles (Dieter tokens)
- `widget.client.js` — deterministic `applyState(state)`
- `limits.json` — widget path/op mapping to `ck-policy` entitlement keys
- `editable-fields.json` — editable/translatable text field contract

## 2) Types available (core framework)
In Clickeen terms, **Type = miniwidget**.

Countdown has 3 Types (selected by `countdown.timer.mode`):
- `date` — countdown to a specific date/time + timezone
- `personal` — per-visitor countdown starting at first view (optional repeat)
- `number` — count up/down toward a target over a duration

Rule: `countdown.timer.mode` is the only Type axis. Everything else is a normal control binding.

## 3) Canonical state (authoritative)
Defaults are the state contract. No runtime merges.

Shell groups:
- `header.*` and `headerCta.*` — shared Header and shared Header CTA content/behavior.
- `stage.*`, `pod.*`, `coreSize.*` — shared Stage/Pod/Core Size layout.
- `appearance.headerCta.*`, `appearance.localeSwitcher*`, and `appearance.podBorder` — shared Shell appearance.
- `behavior.showBacklink` and `behavior.socialShare.*` — shared Shell Settings.
- `typography.*` — shared typography panel roles declared by Shell and Countdown Core.
- `localeSwitcher.*` — shared Locale Switcher settings.

Countdown Core groups:
- `countdown.timer.*` — timer type and mode settings.
- `countdown.appearance.*` — Countdown timer text/tile appearance.
- `countdown.actions.*` — "during" CTA and "after end" behavior.

Editable/translatable text primitives live in `tokyo/product/widgets/countdown/editable-fields.json`.

- `header.title`
- `header.subtitleHtml`
- `countdown.timer.labels.days`
- `countdown.timer.labels.hours`
- `countdown.timer.labels.minutes`
- `countdown.timer.labels.seconds`
- `headerCta.label`
- `countdown.actions.during.text`
- `countdown.actions.after.text`

The widget must not add `localization.json`, layer sidecars, text packs, or wildcard producer payloads.

Note: `workspace.websiteUrl` is a workspace setting (persistent on the workspace). It is not part of widget instance config; Copilot may use it as context.

### Detailed State from Competitor Analysis
- `countdown.timer.mode`: 'date' | 'personal' | 'number' (visual cards with icons: calendar for date, user for personal, numbers for number).
- `countdown.timer.targetDate`: ISO `YYYY-MM-DDTHH:MM(:SS)` text for date mode.
- `countdown.timer.timezone`: Text field (IANA timezone, or `browser`) for date mode.
- `countdown.timer.timeAmount`: Numeric (1-999, default 1) for personal mode.
- `countdown.timer.timeUnit`: 'hours' | 'minutes' | 'days' | 'weeks' | 'months' (default: 'hours') for personal mode.
- `countdown.timer.repeat`: '1 minute' | '5 minutes' | '1 hour' | '1 day' | '1 week' | 'never' (default: 'never') for personal mode.
- `countdown.timer.targetNumber`: Numeric (0-9999999) for number mode.
- `countdown.timer.startingNumber`: Numeric (default 0) for number mode.
- `countdown.timer.countDuration`: Numeric seconds (default 5) for number mode.
- Countdown has no widget-owned layout placement control. Content alignment,
  pod sizing, and stage sizing are owned by the shared Stage/Pod Shell controls.
- Countdown has no widget-owned theme preset system. Any future theme system must
  be shared Shell/product infrastructure, not a Countdown-only dead control.
- `pod.background`: Fill picker (color/gradient/image/video) for the widget surface.
- `countdown.appearance.textColor`: Color picker (fill object, type `color`).
- `countdown.appearance.itemBackground`: Fill picker (color/gradient) for timer tiles.
- `countdown.appearance.cardwrapper.border`: Border (enabled/width/color).
- `countdown.appearance.cardwrapper.shadow`: Shadow (enabled/inset/x/y/blur/spread/color/alpha).
- `countdown.appearance.cardwrapper.radiusLinked|radius|radiusTL|TR|BR|BL`: Radius controls for tiles.
- `countdown.appearance.separator`: Color/style picker.
- During-countdown action type is fixed to link in V1 and must not be stored as
  an account default unless a future Builder control makes it editable.
- `countdown.actions.during.url`: URL input (supports `#`, root-relative, http(s), mailto, and tel).
- `countdown.actions.during.text`: Text input (default: "Purchase now").
- `countdown.actions.during.style`: 'primary' | 'secondary'.
- `countdown.actions.during.newTab`: Boolean (default true).
- `countdown.actions.after.type`: 'hide' | 'link'.
- `countdown.actions.after.url`: URL (if link).
- `countdown.actions.after.text`: Text (if link).

## 4) DOM contract (stable hooks)
All runtime selectors must be scoped within `[data-ck-widget="countdown"]`.

Required roles (minimum):
- Root: `[data-ck-widget="countdown"]`
- Heading: `[data-role="heading"]`
- Timer container: `[data-role="timer"]`
- Unit tiles: `[data-role="unit"][data-unit="days|hours|minutes|seconds"]`
  - value: `[data-role="value"]`
  - label: `[data-role="label"]`
- Header CTA: `[data-role="header-cta"]` (anchor/button)
- After-end message: `[data-role="after-message"]`

## 5) Runtime requirements (deterministic)
`widget.client.js` must:
- Validate state shape up front (throw clear errors; no merges).
- Set `data-mode="<date|personal|number>"` on root.
- Update all text/visibility via stable `data-role` hooks.
- Keep `applyState(state)` pure: do not create timers/intervals inside it. Schedule ticking outside `applyState` and render from the latest state.
- Drive all visual differences via CSS vars + `data-*`.
- Apply platform globals:
  - `CKStagePod.applyStagePod(state.stage, state.pod, root, state.appearance)`
  - `CKTypography.applyTypography(state.typography, root, roleMap)`
  - `CKHeader.applyHeader(state, root)`
  - `CKCoreSize.applyCoreSize(state.coreSize, coreEl)`
  - `CKSurface.applyCardWrapper(state.countdown.appearance.cardwrapper, root)` (sets `--ck-cardwrapper-*` for timer tiles)
  - `CKBranding.applyBacklink(root, state)`
  - `CKSocialShare.apply(root, state, options)`

Personal countdown persistence rule (deterministic):
- Store start time in `localStorage` keyed by **widget instance id** (use `state.instanceId` or runtime `instanceId`; do not invent random ids).
- If the key is missing: set it once and reuse.

## 6) ToolDrawer panels (required mapping)
Panels:
- **Content**: shared Header controls plus `countdown.timer.*` and `countdown.actions.*`.
- **Layout**: shared Header/Core Size/Stage/Pod controls only.
- **Appearance**: shared Header CTA/Stage/Pod/Locale Switcher appearance plus
  `countdown.appearance.*`.
- **Typography**: `typography.*` (explicitly declared shared typography panel)
- **Settings**: shared behavior controls only.

ToolDrawer spacing rule (authoring):
- Vertical rhythm is **clusters + groups only**. Use explicit cluster objects and field `groupId` values in `spec.json.editor`.
- No custom spacing wrappers or per-control margins; only cluster/group labels add bottom margin.

### Detailed Panels from Competitor Analysis
- **Content Panel**:
  - Mode selector: Visual cards with icons (calendar for date, user for personal, numbers for number).
  - Date mode: Date/time pickers, timezone field (`browser` or IANA).
  - Personal mode: Time amount/unit inputs, repeat dropdown.
  - Number mode: Target/starting numbers, duration input.
  - Headline: Rich text editor (bold, italic, link, lists, code view; max 500 chars).
  - CTA (while running) + After timer ends.
- **Layout Panel**:
  - Stage/Pod: Shared layout controls (pod width/content width, stage alignment, stage canvas sizing, stage/pod padding).
  - Core Size: Shared Core Size controls for the Countdown body.
- **Appearance Panel**:
  - Colors: Pod background, text, timer tiles, separators.
  - Borders/shadows: Timer tile radius/border/shadow + pod border.
## 7) Defaults (authoritative `spec.json` → `defaults`)
The implementer must translate this PRD into a complete defaults object in `tokyo/product/widgets/countdown/spec.json`.
Defaults must include:
- Countdown Core defaults only. Shell defaults come from the shared Shell/account defaults authority.
- `countdown.timer: { mode: 'date', targetDate: '2030-01-01T00:00', timezone: 'UTC' }`
- `countdown.appearance: { textColor: { type: 'color', color: 'var(--color-system-black)' }, itemBackground: { type: 'color', color: 'var(--color-system-gray-5)' }, cardwrapper: { radiusLinked: true, radius: '2xl', radiusTL: '2xl', radiusTR: '2xl', radiusBR: '2xl', radiusBL: '2xl', border: { enabled: false, width: 1, color: 'var(--color-system-gray-5)' }, shadow: { enabled: false, inset: false, x: 0, y: 8, blur: 24, spread: 0, alpha: 18, color: '#000000' } }, separator: ':' }`
- `countdown.actions: { during: { url: '#', text: 'Purchase now', style: 'primary', newTab: true }, after: { type: 'hide' } }`

## 8) Additional Notes from Competitor Analysis
- Unit controls: Show/hide individual units (days/hours/minutes/seconds); format: separated boxes or inline.
- Separators: Customizable (colon, slash, etc.).
- Limits: Include `copilot.turns.monthly.max` if AI interactions are added.
- Babel/locales: default strings above are declared through `editable-fields.json`; producer payloads use concrete paths only.

## Links
- `documentation/architecture/CONTEXT.md`
- `documentation/widgets/WidgetComplianceSteps.md`
- `documentation/widgets/Countdown/Countdown_competitoranalysis.md`
