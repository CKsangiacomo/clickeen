# content.countdown — Countdown competitor analysis (2026 refresh)

STATUS: PRIMARY-SOURCE RESEARCH (2026-07-31). Research only — defines no scope
and authorizes no build.

Supersedes the competitor half of `Countdown_competitoranalysis.md`, which
describes a version of the product that no longer exists.

Method: `WidgetCompetitorResearchSteps.md`, executed in order against a live
authenticated free account.

---

## 0. The finding that reframes everything

**The Elfsight Countdown Timer we had documented is the legacy version.** The
account's instance carried a green "New version available" label and an **Update**
button with a notification badge. Accepting it produced this dialog:

> "You're about to update this widget to **Countdown Timer 3.0**. This major
> release introduces powerful new capabilities, deeper customization, and
> entirely new ways to use countdowns on your site. Please note that updating may
> affect any custom CSS or JS modifications."

3.0's own release notes, verbatim from that dialog:

- Flexible Repetition Settings: run your countdown once, repeat it on a schedule, or restart it automatically
- **Built-in Form Builder: collect leads or any visitor information directly inside the widget**
- Seamless Integrations: connect your form to Zapier, Google Sheets, Mailchimp, or send webhooks
- Multiple Actions & New Action Types: trigger forms, let users add events to Google Calendar
- New Embed Options: floating bar, banner, or full-width section
- Google Analytics Integration
- Enhanced Mobile Experience
- New Visual Themes & More Customization

⚠️ "Custom CSS and JavaScript may require adjustments after the update."

Everything below Step 4 describes **3.0**, captured after accepting the update.

### This corrects our own architecture claim

`planning_Research__Elfsight_Competitive_Breakdown.md` §5.5 states that Elfsight
"ships a new hash, flips `stable`, and every widget on the internet updates,"
and contrasts that with Clickeen needing to re-materialize instances.

**That is only true of patch releases.** Major versions are opt-in per widget,
require an explicit user action in the dashboard, and carry a written warning
that the user's customizations may break. An instance created in Feb 2025 was
still on the old major in Jul 2026 — roughly seventeen months of drift on a
single test account.

So the incumbent carries the same fleet-update problem we do, plus a second one:
a permanently fragmented install base across major versions, and customer-visible
breakage as the price of moving. Clickeen's re-materialization gap is a smaller
liability than previously written, and materializing from one current source is
arguably the better position.

---

## 1. App surface (Step 1)

| Concern | Value |
| --- | --- |
| Plan badge | `SELECT PLAN`, green **Select Plan** CTA |
| Meters | `WIDGETS 1/1`, `VIEWS 0/200`, resets Aug 19 |
| Tabs | Widgets · Request a Feature · What's New (dot = unread) |

Widget card overflow menu:

```text
Embed Code · Share by Link · Remove Elfsight Branding [UPGRADE]
Duplicate · Rename widget · Hide from Website
Update to New Version [1]        <- Countdown only
Delete Widget
```

The overflow is **app-specific**. Calculator's carries *Download Responses in CSV*
and no update entry; Countdown's carries the update entry and no CSV. Reading it
per app is the only way to see this surface.

---

## 2. Creation flow and templates (Steps 2–3) — COMPLETED 2026-07-31

Evidence: `screenshots/03-empty-state.png` … `screenshots/07-timer-mode-gallery.png`.

### 2.1 Empty state — `03-empty-state.png`

Same copy as every other app: *"Create a captivating widget with the help of
ready-made templates or configure a unique widget from scratch."*

### 2.2 The picker shape differs from Calculator's — `04-create-template-picker.png`

Countdown's picker is a **sidebar of 2-column thumbnails plus a large live
preview**. There are **no categories, no counts, and no pagination** — unlike
Calculator, which gets a paginated grid with five named categories and a total.

So the picker itself is not one component reused across apps. Calculator and
Countdown get materially different template-selection experiences.

### 2.3 Template set maps onto the three timer modes — `05-picker-template-list-scrolled.png`

Observed, in sidebar order:

| Template | Mode it exercises |
| --- | --- |
| Countdown Timer | date |
| Halloween Sale Countdown | date, holiday theme |
| Black Friday Sale Banner | date, banner position |
| Special Offer Banner | date, banner position |
| Urgency Countdown | date |
| Event Start Countdown | date |
| Limited-Shipping Banner | date, banner |
| Wedding Countdown | date |
| Launch Countdown | date |
| **Trust Counter** | **number counter** — "10000" |
| **Stock Countdown** | **number counter** — "Items left in stock: 25" |
| **Fame Counter** | **number counter** — "People viewing this product: 09" |
| Countdown to New Year | date, holiday |
| Thanksgiving Day | date, holiday |
| Hanukkah | date, holiday |
| **Evergreen Timer** | **personal / per-visitor** |

The three number-counter templates are the interesting ones: they use the counter
mode as **scarcity and social proof**, not as a timer at all. That is a product
use case our countdown's `number` mode could serve today and does not advertise.

### 2.4 Runtime version is pinned in the iframe URL

The editor loads from:

```text
universe-static.elfsightcdn.com/app-releases/countdown-timer/stable/v3.1
```

Per-app-type, `stable` channel, explicit semantic version. Countdown is on
**v3.1**, not merely "3.0".

---

## 3. The 3.0 editor (Step 4)

Rail went from three sections to five.

| Legacy | 3.0 |
| --- | --- |
| Timer · Button · Appearance | **Timer · Actions · Position · Theme · Settings** |

"Button" became **Actions** (plural, extensible). "Appearance" became **Theme**.
**Position** was promoted from a radio group inside Timer to its own rail section.

### 3.1 Timer panel

| Control | Type | Notes |
| --- | --- | --- |
| Mode | **card with a `Change` link** | Shows "Countdown to Date — Counts down to a specific date and time". Legacy used a plain dropdown of three types. |
| Heading | rich text | with the same inline toolbar as other apps |
| Starts | date + time | |
| Ends | date + time | |
| **All Day** | toggle | new in 3.0 |
| Time Zone | dropdown | `(GMT-07:00) America…` |
| **Repeat** | sub-panel | new in 3.0, the headline feature |
| **Hide Widget Before Countdown Starts** | toggle | new in 3.0 — **scheduled activation**, captured `06-editor-on-arrival.png` |

`Hide Widget Before Countdown Starts` closes a gap listed against our countdown
in §6.4 item 2 of the earlier analysis: nothing in our widget makes it appear
only between two dates.

### 3.1a Mode gallery — resolved — `07-timer-mode-gallery.png`

The `Change` link opens **Countdown Mode**, confirming 3.0 kept all three legacy
modes with clearer naming and explicit descriptions:

| Mode | Their description |
| --- | --- |
| **Countdown to Date** | "Counts down to a specific date and time" |
| **Personal Countdown** | "Starts for each visitor when they first open the page" |
| **Number Counter** | "Counts up or down between chosen numbers" |

Note "counts up or down" — the counter mode does count up. Their #2 feature
request, "Count up from a particular date" (18 votes), is specifically about
*time*, which neither product does.

### 3.2 Repeat Event

Calendar-grade recurrence, derived from the start date:

```text
Does Not Repeat            Daily
Weekly on Wednesday        Monthly on the first Wednesday
Annually on December 1     Every weekday (Monday to Friday)
Custom
```

"Monthly on the first Wednesday" is an ordinal-weekday rule. This is RRULE-shaped
recurrence, not a simple interval. Clickeen's countdown has no recurrence concept
at all.

### 3.3 Actions

Two lifecycle phases, each an extensible list:

```text
DURING COUNTDOWN        + Add Action
AFTER COUNTDOWN ENDS    Hide Timer — "Remove the timer after it finishes"  [...]
```

Legacy had a single "Action After Timer Finishes" dropdown with three fixed
options. 3.0 has a phase-scoped action *collection*.

Action types (`Choose Action`):

| Type | Description |
| --- | --- |
| **Link** | Redirect visitors to a chosen URL |
| **Form** | **Open a form to collect user data** |
| **Add to Google Calendar** | Save the event to Google Calendar |

### 3.4 Legacy detail, retained for diffing

Captured before the update, and now historical: three timer types (Start-To-Finish,
Remaining Time Counter Per Visitor, Start-To-Finish Number Counter); Counters &
Labels with per-unit show/hide and custom labels; Timer Align; Style carousel of 5
digit treatments; Holiday Theme carousel of 8; 5 colors; Sizes & Fonts (one font,
message size, two abstract sliders); Animation; Custom CSS; Custom JS.

Whether each survived into 3.0 is **unverified** — the Theme and Settings rail
sections were not opened in this pass.

---

## 4. What's New (Step 5)

16 entries read. Dates, kinds, and view counts:

| Date | Entry | Kind | Views |
| --- | --- | --- | --- |
| Jun 3 | Automatic date and time format detection | Improved | 14 |
| Mar 31 | **Bulk add multiple options in Dropdown field** | New | 12 |
| Mar 18 | **Automate your workflows with Make.com integration** | New | 16 |
| Mar 4 | **Add Company Logo and Signature to Autoresponder Emails** | New | 24 |
| Dec 29 2025 | Control display of scheduled timers | New | 60 |
| Dec 4 2025 | Enhancements for the **Phone field** | Improved | 32 |
| Nov 18 2025 | Default Country control for **Phone fields** | New | 21 |
| Nov 14 2025 | Action After Countdown fixed | Fixed | 24 |
| Nov 11 2025 | New **Phone field** with country selection, masks, validation | New | 28 |
| Oct 23 2025 | Number formatting, time calculation fixes | Fixed | 39 |
| **Oct 9 2025** | **[MAJOR UPDATE] Auto-repeat, layout enhancements, new buttons, themes** | New | **198**, 4 replies |
| Dec 10 2024 | "Install to Required Position" fixed | Fixed | 63 |
| Aug 1 2024 | Incorrect display of the timer fixed | Fixed | 54 |
| Jun 27 2024 | Incorrect handling of message links fixed | Fixed | 28 |
| Nov 10 2023 | Better time zone accuracy and DST adjustments | Improved | 170 |

### One Form engine, installed across apps

Three Countdown entries are **identical to Calculator's**, same dates: bulk-add
Dropdown options (Mar 31), Make.com (Mar 18), autoresponder logo and signature
(Mar 3/4). Countdown also shipped Phone-field work across three releases.

A countdown timer has no native use for a Phone field, a Dropdown field, or an
autoresponder. These are one **shared Form Builder component** being installed
into multiple widgets — which is what the 3.0 dialog means by "Built-in Form
Builder," and why the same integration list (Zapier, Google Sheets, Mailchimp,
webhooks) appears in both apps.

**Lead capture is their platform bet, not a per-widget feature.** This raises the
stakes on the open question in `Calculator_PRD.md` §17.3 considerably: it is not a
Calculator decision, it is a Clickeen platform decision.

---

## 5. Request a Feature (Step 6)

A public voting board with vote counts, reply counts, view counts, and triage
states (`Gathering feedback` / `Planned`).

| Votes | Request | State | Views |
| --- | --- | --- | --- |
| **87** | **To be able to use countdown timers in emails** | Gathering feedback | 399 |
| 18 | Count up from a particular date | Gathering feedback | 276 |
| 10 | Display button on mobile view | **Planned** | 132 |
| 8 | Synchronize the countdown on desktop and mobile | Gathering feedback | 46 |
| 6 | Creating a Countdown GIF Timer | Gathering feedback | 167 |
| 6 | **More than one font size for the header text and plain text** | **Planned** | 125 |
| 4 | Option to display a `:` character between the digits | **Planned** | 158 |
| 4 | **Set different fonts for the message and counters** | Gathering feedback | 14 |
| 4 | Timer starts counting only when the visitor clicks the button | Gathering feedback | 16 |

### Three things this says

**Their #1 request by 5× is structurally impossible for them.** Email clients do
not execute JavaScript, and their entire delivery model is a shared
`platform.js` that renders client-side. Serving a countdown into an email
requires a server-rendered animated image endpoint — a different product.
Request #5, "Countdown GIF Timer," is the same need stated as an implementation.

Clickeen is not obviously closer, but it is closer: a materialized-artifact
pipeline that already writes files per instance at save time is a shorter path to
"also emit a GIF at this URL" than a client-side runtime is.

**Two of their top ten ask for per-role typography — which Clickeen ships by
default.** "More than one font size for the header text and plain text" (Planned)
and "Set different fonts for the message and counters" are both requests for what
our typography role system does out of the box. Their Sizes & Fonts panel offers
one font for the whole widget.

**"Count up from a particular date" (18 votes) is a mode we also lack.** Our
countdown counts down only.

---

## 6. Gaps against Clickeen (Step 9, verified against source)

Clickeen side read from `tokyo/product/widgets/countdown/**`. Composed control
count is **214** — 160 shared Shell, 54 widget-specific — but only **34 touch
`countdown.*` paths**. The widget is thin; the Shell around it is thick.

### 6.1 Modes — closer than expected

We already have all three of the legacy Elfsight modes:

| Mode | `countdown.timer.mode` | Behaviour |
| --- | --- | --- |
| Fixed date | `date` | one absolute instant |
| Per-visitor evergreen | `personal` | anchored at first view, `localStorage` |
| Number counter | `number` | animates start → target over N seconds |

Whether 3.0 kept all three is **unverified** — the mode gallery behind `Change`
was not opened.

### 6.2 What 3.0 has that we do not

| Capability | Elfsight 3.0 | Clickeen |
| --- | --- | --- |
| **Recurrence** | Daily, Weekly on ⟨day⟩, Monthly on the first ⟨day⟩, Annually, Every weekday, Custom | six flat intervals (`never`, 1 min, 5 min, 1 hr, 1 day, 1 week), **personal mode only**, and it is a modulo over the original anchor rather than a schedule |
| **Date and time entry** | date picker + time picker | **plain `textfield`**, user types `2030-01-01T00:00`; regex-validated, throws on anything else |
| **Timezone entry** | dropdown | **plain `textfield`**, user types an IANA name or `browser` |
| All Day toggle | yes | none |
| Actions | two-phase collection (During / After), multiple per phase | one during-CTA, one after-behaviour |
| Action types | Link · **Form** · Add to Google Calendar | Link only |
| Placement | floating bar, banner, full-width section | **no floating** — merged defaults have no `stage.floating`, so zero floating controls are emitted |
| Themes | Style carousel (5) + Holiday Theme carousel (8) | **no presets at all**; `spec.json` has no `presets` key |

### 6.3 What we have that they do not

- **Per-role typography.** Six roles × 10 properties. Two of their top-ten
  feature requests — "more than one font size for the header text and plain text"
  (Planned) and "set different fonts for the message and counters" — are asking
  for exactly this. They ship one font for the whole widget.
- **Shell depth.** Stage/Pod fills including image and video, inside shadows,
  18-channel social share, locale switcher, corner control per corner.
- **No Custom CSS or JS escape hatch**, by design.

### 6.4 Defects found in our source while diffing

These are not competitive gaps; they are things wrong with what we shipped.
Each is an absence or a behaviour in source, not an inference.

| # | Defect | Evidence |
| --- | --- | --- |
| 1 | **Counter mode disappears ~5 s after load on factory defaults.** `number` mode finishes its 5 s animation, enters phase `ended`, and the default `actions.after.type: "hide"` sets `coreEl.hidden = true`. A "1,000 customers" counter deletes itself. | `renderPhase`, defaults |
| 2 | **Leading separator renders when a unit is hidden.** `updateUnits` toggles `unitEl.hidden` but the three `[data-role="separator"]` nodes are static siblings nothing hides. Default `auto` format with 0 days renders a leading `:` before hours. | `updateUnits`, `widget.html` |
| 3 | **`countdown.appearance.textColor` is a dead control for the digits.** CSS resolves `var(--typo-timer-color, var(--countdown-text-color))`, and `timer.color` is set by default, so the appearance control never wins. Violates the zero-dead-controls rule. | `widget.css` |
| 4 | **No accessibility or machine-readable output on a ticking value.** No `aria-live`, no `role="timer"`, no `<time datetime>`. Screen readers get no announcements; crawlers and answer engines get no deadline. | `widget.html` |
| 5 | **`months` is 30 days flat** in `getDurationSeconds`. "1 month" is not a calendar month. | `widget.client.js:466` |
| 6 | **No pluralisation.** At `days === 1` the label renders "1 Days". | `updateUnits` |
| 7 | **Personal timer throws when `localStorage` is unavailable** rather than degrading. Third-party storage is commonly blocked in embedded iframes — the exact deployment context. | `widget.client.js` |
| 8 | **DST edge.** `getTimeZoneOffset` samples the offset at the wall-clock-as-UTC instant, not the true target instant; within ~1 h of a transition the end time can be off by the transition delta. | `resolveTargetTimestamp` |
| 9 | **During-CTA appearance is hardcoded.** `--countdown-cta-bg: var(--color-system-blue)`, no colour, radius, padding or size control — while the shared *header* CTA has 11 appearance controls. | `widget.css` |
| 10 | **`itemKey: "countdown.item"` is inert.** No array under `countdown.item`, no repeater node. | `spec.json` |
| 11 | **Per-unit show/hide was specified and never built.** `Countdown_PRD.md:185` calls for individual unit toggles; only `timeFormat` (`auto` / `D:H:M:S` / `H:M:S`) exists, so minutes and seconds can never be hidden. | PRD vs spec |
| 12 | **Timer roles omit line-height and tracking defaults.** `timer` and `label` declare no `lineHeightPreset/Custom` or `trackingPreset/Custom`, and the Shell supplies them only for `title`/`body`/`button`/`localeSwitcher` — yet the typography panel renders those controls for both roles. | `spec.json` defaults |

Defects 1–4 are the ones I would fix before any competitive feature work. 1 is a
visible product failure on defaults, 3 is a contract violation, and 4 is the SEO
and accessibility argument we make about ourselves.

### 6.5 The honest headline

On timer *mechanics* we are closer to them than the feature lists suggest — we
have all three modes. Where we lose is **authoring** (typing an ISO string and an
IANA timezone into bare text fields), **scheduling** (flat intervals versus
calendar recurrence), **placement** (no floating or banner mode), and **presets**
(none versus thirteen).

Where we win is typography, Shell depth, and output quality — and two of their
own top-ten requests confirm the typography advantage is one customers ask for.

---

## 7. What this pass did not cover

Stated plainly so nobody mistakes it for covered.

**Closed on 2026-07-31:** Steps 2 and 3 (creation flow, picker, template set) and
the mode gallery behind `Change`. See §2 and §3.1a.

**Still open:**

- **3.0's Position, Theme, and Settings rail sections.** Not captured. The editor
  loads as a single cross-origin iframe (`app-releases/countdown-timer/stable/v3.1`)
  and synthetic clicks on the rail buttons stopped taking effect partway through
  the session — clicks reach the iframe (a double-click produced a text
  selection) but the rail items do not respond at any coordinate tried, including
  the icon centre, the label, and both `devicePixelRatio`-scaled variants. Panel
  content inside the Timer section was clickable earlier in the same session, so
  this is a tooling limitation, not a property of the product.

  What is known about these three from the pre-update legacy version — Style and
  Holiday Theme carousels, five colours, Sizes & Fonts, Animation, Position as a
  four-way radio — is recorded in §3.4 and must not be assumed to still hold in
  3.1.
- **The Form action's field types and integration configuration.** The action
  type list (Link / Form / Add to Google Calendar) was captured; what a Form
  action contains was not.
- **Step 7 install/serving and Step 8 pricing** — unchanged from the platform
  behaviour in `planning_Research__Elfsight_Competitive_Breakdown.md`; not
  re-verified here.
- The changelog **posts** were not opened for Countdown; only the list was read.
  Per the procedure, titles are not findings — treat §4 as an index, not a
  description of mechanisms.
