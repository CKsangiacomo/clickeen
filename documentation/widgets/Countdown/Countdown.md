# content.countdown — Countdown Widget PRD (Rebuild Canonical)

STATUS: NORMATIVE — rebuild target (widget definition currently removed from `tokyo/widgets/`)

Competitor material: `documentation/widgets/Countdown/CompetitorAnalysis/` (Elfsight + examples)

---

## What this widget does (1 sentence)

Creates urgency by rendering a timer (or counter) with optional CTA actions, styled as a section/bar/floating widget inside Stage/Pod.

---

## Types available (core framework)

Countdown has **3 Types** (each Type is a **miniwidget**):

Type selector: `timer.mode`

### Type 1 — Countdown to Date (`timer.mode = 'date'`)

- **Why/what’s different**: one global deadline that is the same for all visitors.
- **Primary experience**: counts down to a target date/time in a chosen timezone.
- **Runtime behavior**: compute target timestamp once from date/time/timezone; update remaining time every second.
- **DOM/CSS structure**: shows timer units block (Days/Hours/Minutes/Seconds).
- **Relevant controls**:
  - `timer.countdownToDate.targetDate`
  - `timer.countdownToDate.targetTime`
  - `timer.countdownToDate.timezone`

### Type 2 — Personal Countdown (`timer.mode = 'personal'`)

- **Why/what’s different**: deadline starts per visitor (creates personalized scarcity).
- **Primary experience**: “starts when the visitor first sees it”; persists across refresh.
- **Runtime behavior**:
  - persist `{ startMs, durationMs }` in localStorage (keyed by publicId when available)
  - changing duration in the editor deterministically restarts at “now”
  - optional repeat when timer ends
- **DOM/CSS structure**: shows timer units block.
- **Relevant controls**:
  - `timer.personalCountdown.timeAmount`
  - `timer.personalCountdown.timeUnit` (minutes | hours | days | weeks)
  - `timer.personalCountdown.repeatPreset` (never | 1min | 5min | 1hour | 1day | 1week | custom)
  - `timer.personalCountdown.repeatAmount` + `timer.personalCountdown.repeatUnit` (when preset = custom)

### Type 3 — Number Counter (`timer.mode = 'number'`)

- **Why/what’s different**: counts numerically instead of time (social proof / fundraising / milestones).
- **Primary experience**: animate from startingNumber → targetNumber over duration seconds.
- **Runtime behavior**: requestAnimationFrame loop until target reached.
- **DOM/CSS structure**: hides timer units block, shows number block.
- **Relevant controls**:
  - `timer.numberCounter.targetNumber`
  - `timer.numberCounter.startingNumber`
  - `timer.numberCounter.duration` (seconds)

### Why these are Types (not “just controls”)

Each Type changes the widget across:
- **Primary user experience**
- **Runtime behavior**
- **DOM/CSS structure**
- **Relevant controls**

That is the definition of **Type = miniwidget**.

---

## Layout (where/how the widget lives on the page)

Layout selector: `layout.type`

Layouts:
- `inline`
- `full-width`
- `top-bar` (fixed)
- `bottom-bar` (fixed)
- `static-top-bar`
- `floating`

Layout controls:
- `layout.alignment` (left | center | right)
- `layout.gap` (px)

Floating-only controls:
- `layout.floatingCorner` (top-left | top-right | bottom-left | bottom-right)
- `layout.floatingOffsetX` (px)
- `layout.floatingOffsetY` (px)
- `layout.floatingMaxWidth` (px)

Dismissible behavior:
- `layout.dismissible` is available only when `layout.type` is `top-bar` / `bottom-bar` / `floating`
- dismissal persists per instance in localStorage when publicId is available

### Stage/Pod is part of layout (always)

Stage/Pod defines the container that holds the widget:
- stage: outer section background + padding + alignment
- pod: widget surface background + padding + width + radius

Stage/Pod layout controls are compiler-injected; Stage/Pod appearance (fills) are authored in Appearance.

---

## Style and appearance

### Theme presets

Selector: `theme.preset`
- `custom`
- `light`
- `dark`
- `gradient`

Custom palette (when preset = custom):
- `theme.headingColor`
- `theme.timerColor`
- `theme.labelsColor`
- `theme.separatorColor`
- `theme.buttonColor`
- `theme.buttonTextColor`

### Timer presentation

- `theme.timerStyle`: `separated` | `inline`
- `theme.animation`: `none` | `fade` | `slide`
- `theme.separator`: `colon` | `dot` | `slash` | `line` | `none`
- `theme.timeFormat`: `DHMS` | `DHM` | `HMS` | `HM` | `MS`

Unit visibility toggles (combined with timeFormat):
- `theme.showDays`
- `theme.showHours`
- `theme.showMinutes`
- `theme.showSeconds`
- `theme.showLabels`

Sizes:
- `theme.headingSize` (px)
- `theme.timerSize` (%)
- `theme.labelSize` (px)
- `theme.buttonSize` (%)
- `theme.timerUnitRadiusPx` (px)

### Labels system

Labels state:
- `labels.mode`: `auto` | `custom`
- `labels.style`: `long` | `short` (auto mode)
- `labels.custom.days|hours|minutes|seconds` (custom mode)

Language:
- `settings.language` drives auto-label localization.

### Typography roles

Typography is standardized via shared module:
- `typography.roles.heading`
- `typography.roles.timer`
- `typography.roles.label`
- `typography.roles.button`

---

## Actions

During countdown:
- `actions.showButtonDuring`
- `actions.buttonText`
- `actions.buttonUrl`
- `actions.buttonStyle`: `primary` | `secondary` | `ghost`
- `actions.openInNewTab`

After countdown ends:
- `actions.afterAction`: `hide` | `nothing` | `show-button` | `message` | `message-button`
- `actions.afterButtonText` / `actions.afterButtonUrl` (when action shows a button)
- `actions.expiredMessage`

---

## Runtime requirements (non-negotiable)

- **Deterministic applyState**: state → DOM/CSS only; no hidden merges or fallbacks.
- **Scoped selectors**: only query inside `[data-ck-widget="countdown"]`.
- **Sanitize heading HTML**: `timer.headingHtml` must be sanitized before inserting into DOM.
- **Personal countdown persistence**: localStorage-based per visitor, stable per instance when publicId exists.
- **Dismissible persistence**: localStorage-based per instance when publicId exists.
- **Timezone correctness**: date countdown respects the configured timezone.
- **No custom code execution**: no custom JS, and no arbitrary user CSS injection in runtime.

---

## ToolDrawer panels (canonical)

- **Content**: Type selector (`timer.mode`) + type-specific fields + heading (`timer.headingHtml`)
- **Layout**: layout.type + alignment/gap + floating fields + compiler-injected Stage/Pod layout
- **Appearance**: theme preset + palette/visual controls + Stage/Pod appearance fills
- **Behavior**: CTA controls + after-action controls + backlink toggle
- **Advanced**: language selection

---

## Binding map (minimum required)

Every control must bind to one of:
- CSS variables
- data attributes on widget root
- DOM text/html/visibility on a `[data-role="..."]` element

Minimum bindings:
- `timer.mode` → `data-mode` + toggle timer-units vs number blocks
- `layout.type` → `data-layout` (+ floating corner attributes/vars)
- `theme.preset` → palette CSS vars
- `theme.timerStyle` → `data-timer-style`
- `theme.animation` → `data-animation` (or per-change attribute)
- `theme.separator` → `data-separator` (and separator element rendering)
- `layout.dismissible` → dismiss button visibility + localStorage


