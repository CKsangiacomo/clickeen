# Countdown — Elfsight Gap Analysis (Post-Build)

Status: PRIMARY-SOURCE COMPETITIVE RESEARCH (2026-07-31)
Type: Research. Defines no scope and authorizes no build.

Relationship to existing docs in this folder:

- `Countdown_PRD.md` — canonical Clickeen product definition. Unchanged by this file.
- `Countdown_competitoranalysis.md` (1961 lines) — the **pre-build** spec, written
  from saved screenshots, with implementation phases and a 70%-parity goal. It
  describes an Elfsight UI with five tabs (Timer / Actions / Position / Theme /
  Settings), a "+ Add Action" repeater, five position options, and four base plus
  ten holiday themes.

  **Elfsight has since redesigned.** The shipping editor as of 2026-07-31 has
  three rail sections (Timer / Button / Appearance), four position options, five
  style presets, and eight holiday themes. Actions are no longer a repeater. That
  document should be read as a historical build spec, not as current competitor
  truth.

This document records what Elfsight ships **today** against what Clickeen
**actually built**.

## Method

Elfsight side: live authenticated account, driven in-browser 2026-07-31. All
three rail sections opened, all disclosures expanded, all three timer types
selected to observe conditional controls. The widget's Type was restored to its
original value afterward.

Clickeen side: full source read of `tokyo/product/widgets/countdown/` plus the
shared shell and Builder compiler. Control count verified against the compiled
manifest at `roma/generated/widgets/countdown.json`.

## Headline

| | Elfsight Countdown | Clickeen Countdown |
| --- | --- | --- |
| Editor controls | **~25** | **213** |
| Typography | 1 font + 1 size + 2 abstract sliders | **61** controls (6 roles × 10 + hidden global) |
| Timer modes | 3 | 3 — **the same 3** |
| Style presets | 5 styles + 8 holiday themes | none |
| Placement modes | 4 (incl. 2 floating banners) | 1 (inline only) |
| End actions | 3 (Hide / Show Message / Redirect) | 2 (Hide / Link) |
| Unit visibility | per-unit checkboxes | days-only, via a 3-value format enum |
| Escape hatches | Custom CSS + Custom JS | none |

The three timer modes match exactly, which is the most useful finding here — the
core product thesis is settled and the differences are all at the edges.

Note this widget is **not** the FAQ story. Elfsight's Countdown has real
typography and theming; their FAQ has none. Their design surface varies per app,
so "Elfsight gives you three colours and a CSS box" is true of FAQ and false of
Countdown.

## Part 1 — Elfsight's complete Countdown surface

**Editor shape:** rail (Timer / Button / Appearance) + panel + live preview.

### Timer panel

| Control | Type | Values |
| --- | --- | --- |
| **Type** | dropdown | Start-To-Finish Timer · Remaining Time Counter Per Visitor · Start-To-Finish Number Counter |
| Start | date + time picker | e.g. "December 1, 2021 at 12:00 AM" |
| End | date + time picker | — |
| Time Zone | dropdown | e.g. "(GMT-07:00) America…" |
| **Position** | radio group | Install To Required Position · Static Top Banner · Floating Top Banner · Floating Bottom Banner |
| Message Before Timer | rich text | with formatting toolbar |
| Counters & Labels | disclosure | see below |
| Action After Timer Finishes | disclosure | see below |
| Timer Align | disclosure | not opened |

Start / End / Time Zone are replaced in per-visitor mode by:

| Control | Type |
| --- | --- |
| Remaining Time Period | number |
| Set The Time In | dropdown (Hours observed) |
| **Counter Restart Settings** | disclosure → `Enable Counter Restart` toggle, `Time Period Before Restart` number, `Set The Time In` dropdown |

**Counters & Labels:** `Display The Count In` — four independent checkboxes for
Days / Hours / Minutes / Seconds — plus four free-text fields, `Days Label`,
`Hours Label`, `Minutes Label`, `Seconds Label`.

**Action After Timer Finishes:** `Select Action` → **Hide Timer** · **Show
Message** · **Redirect To URL**.

### Button panel

One control: `Show Button` (toggle, off by default). Further button controls
presumably appear when enabled; not observed.

### Appearance panel

| Control | Type | Detail |
| --- | --- | --- |
| **Style** | carousel | 5 presets, digit-style previews |
| **Holiday Theme** | carousel | 8 themes |
| Colors | disclosure | Timer · Labels · Message · Button · Background (5) |
| Sizes & Fonts | disclosure | see below |
| Animation | disclosure | dropdown, "None" selected |
| Custom CSS | code editor | — |
| Custom JS | code editor | with Validate button |

**Sizes & Fonts:** `Font` — a searchable dropdown whose first entry is **"Default
(Apply from Website)"**, followed by the alphabetical Google Fonts catalogue
(ABeeZee, Abel, Abril Fatface, Aclonica, Acme, Actor…). Then `Message Font Size`
(28px), `Timer Size` (slider Small→Large), `Button Size` (slider Small→Large).

## Part 2 — Clickeen's complete Countdown surface

213 composed controls, verified against the compiled manifest.

| Panel | Controls |
| --- | --- |
| content | 31 |
| typography | 61 |
| layout | 41 |
| appearance | 55 |
| settings | 25 |

**Three modes** (`countdown.timer.mode`): `date` (fixed target), `personal`
(evergreen per-visitor, `localStorage` keyed by instance id), `number` (rAF tween
from a starting to a target number over a duration).

**Repeat/restart** exists in `personal` mode: `never` · 1 minute · 5 minutes ·
1 hour · 1 day · 1 week. Cycle logic is `duration + repeat`, computed modulo the
stored start, so it restarts indefinitely without rewriting the start.

**Six typography roles** — `title`, `body`, `timer`, `label`, `button`,
`localeSwitcher` — each with family (18 curated fonts + account custom fonts),
size preset + custom, style, weight, colour, line-height preset + custom,
tracking preset + custom. The `timer` role gets container-query fluid sizing.

**Timer presentation:** `separated` (boxed tiles) or `inline` (flat, baseline
aligned); time format `auto` / `D:H:M:S` / `H:M:S`; separator `:` `/` `-`;
show-labels toggle; four translatable unit labels.

**Tile chrome:** background fill (colour + gradient), per-corner radius, border,
outside shadow — plus the full stage/pod system with colour/gradient/image/video
backgrounds and inside-shadow groups.

**Actions:** during-countdown CTA (url, text, primary/secondary, new-tab) and
after-countdown (`hide` or `link`).

**Limits:** `branding.remove` and `widget.socialShare.enabled` only. No numeric
caps.

## Part 3 — What Elfsight has that Clickeen does not

### 1. Placement modes — sticky and floating banners

Elfsight: four placement modes, two of which are floating banners pinned to the
top or bottom of the viewport, plus a static top banner.

Clickeen: inline only. The shared shell **has** `stage.floating.*` controls
(`bob/lib/compiler/modules/stagePod.ts`), but countdown declares no
`stage.floating` default, so `includeFloating` is false and none of them render.

This is the largest functional gap. A countdown's conversion value is
proportional to how unavoidable it is, and a sticky bar is the standard form. The
capability already exists in the shell — countdown simply doesn't opt in.

### 2. Per-unit visibility

Elfsight: four independent checkboxes. Any combination of days/hours/minutes/
seconds.

Clickeen: visibility is driven only by `countdown.appearance.timeFormat`, whose
three values can hide the days unit and nothing else. Seconds cannot be hidden —
and a countdown measured in weeks with a ticking seconds digit reads as noise.

Related defect: when days is auto-hidden, the three `[data-role="separator"]`
divs are never toggled, so a stray leading `:` remains.

### 3. Redirect on completion

Elfsight: Hide Timer · Show Message · **Redirect To URL**.

Clickeen: `hide` or `link`, where `link` renders a plain text anchor
(`.ck-countdown__after-link`, underline on hover, always `target="_self"`).

Redirect-on-expiry is a standard campaign mechanic — offer ends, send everyone to
the next page. There is also no rich "expired" message; only a single link.

### 4. Style presets and holiday themes

Elfsight: 5 digit-style presets and 8 holiday themes, both as preview carousels.

Clickeen: no preset concept. Every countdown starts from factory defaults and is
styled control by control.

The FAQ competitor analysis in the sibling folder already records the Clickeen
position on this — "starter designs are just Clickeen-owned instances users can
clone" — so the intended answer exists as a pattern. It is not implemented for
countdown.

### 5. Animation

Elfsight: an Animation control.

Clickeen: none. Grep confirms no `transition`, `animation`, or `@keyframes`
affecting the digits. The only motion is the `number` mode tween and a 0.2s
colour transition on the CTA. No flip, no slide, no urgency pulse.

### 6. Timezone and date pickers

Elfsight: a timezone dropdown with GMT-offset labels, and date + time pickers.

Clickeen: `countdown.timer.timezone` is a **raw textfield** validated only by
whether `Intl.DateTimeFormat` accepts it, with `"browser"` as an undocumented
magic literal offered only as placeholder text. `countdown.timer.targetDate` is a
**raw textfield** matched against `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/` —
a malformed string throws at runtime rather than being caught in the UI, and an
offset-bearing ISO string (`…T12:00-05:00`) is rejected.

This is the most user-hostile part of the Clickeen countdown.

### 7. Button as a first-class object

Elfsight: a dedicated Button rail section, plus Button Color and Button Size.

Clickeen: the during-CTA's fill, outline, radius, and padding are **hard-coded**
in `widget.css` with no editor path. Only its text, its typography role, and
primary-vs-secondary are editable. `--countdown-cta-bg`, `--countdown-cta-bg-hover`,
`--countdown-cta-outline`, and `--countdown-cta-outline-hover` have no controls.

### 8. "Default (Apply from Website)" font

Elfsight's font list leads with an inherit-from-host option, so the widget blends
into the page it lands on.

Clickeen offers 18 curated fonts and no inherit option, so every widget asserts a
font whether or not it matches the host.

## Part 4 — What Clickeen has that Elfsight does not

- **213 controls to ~25**, and **61 typography controls to 4**.
- **Six typography roles**, including dedicated `timer` and `label` roles with
  their own size scales, versus one global font and two abstract sliders.
- **Fill system** — gradient on tiles; colour/gradient/image/**video** on stage
  and pod.
- **Borders, outside shadows, and inside-shadow groups**; per-corner radius.
- **Locale overlays, an in-widget locale switcher, and four translatable unit
  labels.** Elfsight has no locale dimension for countdown.
- **Social share** with 18 channels and 8 anchor positions.
- **Entitlement enforcement** at both editor-op and save time.
- **Fluid typography** — the `timer` role scales against a container-query
  reference width.
- **A `number` counter mode** — matched by Elfsight, but Clickeen exposes
  starting number, target number, and tween duration independently.

## Part 5 — Defects found in the Clickeen Countdown during this review

Reported as findings.

1. **`countdown.appearance.textColor` is inert.** Every consumer reads
   `var(--typo-{role}-color, var(--countdown-text-color))`, and the typography
   engine sets `--typo-timer-color` / `--typo-label-color` unconditionally on
   every apply. The fallback never fires. The "Text color" control in the Timer
   text cluster cannot change the digits, the labels, or the after-link.
2. **Orphaned separator.** `updateUnits` toggles `[data-unit]` elements only; the
   three separator divs are never touched. With days hidden, a leading `:`
   remains.
3. **Unit labels are double-faded.** `.ck-countdown__label` wraps its colour in
   `color-mix(… transparent 30%)`, and the factory `label` colour is already
   `color-mix(… transparent 45%)`. The user's chosen colour always composites to
   roughly 70% opacity with no opt-out.
4. **Alignment is hard-coded.** `applyLayoutVars` forcibly writes
   `data-layout-align="center"`, making the left/right alignment CSS in
   `widget.css` unreachable.
5. **DST risk.** `resolveTargetTimestamp` computes the zone offset once from the
   UTC interpretation of the wall-clock parts without iterating to a fixed point.
   Targets near a DST transition can resolve an hour off.
6. **`months` is a flat 2,592,000 seconds** (30 days) in personal mode — no
   calendar-aware arithmetic.
7. **No accessibility for a live value.** Digits update via `textContent` with no
   `aria-live`, no `role="timer"`, and no `<time datetime>`. Screen readers get
   nothing as the countdown runs.
8. **`hide` does not hide the header.** Only `.ck-countdown__body` is hidden; the
   title, subtitle, and header CTA remain on the page after expiry.
9. **No pluralization.** Labels are static strings, so "1 Days" is unavoidable.
10. **URLs are not translatable.** `headerCta.href`,
    `countdown.actions.during.url`, and `.after.url` are absent from
    `editable-fields.json`, so a localized offer cannot point at a localized
    landing page. This applies to every widget, not just countdown.

## Part 6 — Observations for the team

Not decisions.

**The modes are settled.** Both products landed on exactly three: fixed date,
per-visitor evergreen, and number counter. That is a strong signal the model is
right and no fourth mode is missing.

**The gaps are conversion mechanics, not features.** Sticky placement, redirect
on expiry, per-unit visibility, and urgency animation are all about making the
countdown *do work* on the page. Clickeen's 213 controls make it look right and
then leave it sitting inline, ticking seconds nobody asked for, ending in a
plain text link.

**Sticky placement is the cheapest high-value item.** The shell already
implements `stage.floating.*`. Countdown declares no `stage.floating` default, so
the controls are suppressed. This is opt-in, not new capability.

**The date and timezone textfields undercut everything else.** A product with 61
typography controls asks users to hand-type `2026-01-20T12:00` and
`America/Los_Angeles` into unvalidated text inputs, where a typo throws at
runtime. That is the single worst authoring moment in the widget and it is the
first thing anyone configuring a countdown touches.

**The inert text-colour control is worse than a missing one.** It renders, it
accepts input, it saves — and it changes nothing. A user will set it, see no
effect, and conclude the product is broken.
