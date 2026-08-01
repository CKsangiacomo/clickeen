# Countdown — Competitor Analysis (Elfsight, 2026 refresh)

STATUS: PRIMARY-SOURCE RESEARCH (2026-07-31). Research only — defines no scope
and authorizes no build.

Supersedes the competitor half of `Countdown_competitoranalysis.md`, which
describes a version of the product that no longer exists.

Method: `../WidgetCompetitorResearchSteps.md`, executed in order against a live
authenticated free account, **starting from Create Widget at 0/1**. Every panel
and disclosure in the current editor was opened.

Evidence: `screenshots/` — 15 captures plus all 89 template thumbnails.
Runtime under test:
`universe-static.elfsightcdn.com/app-releases/countdown-timer/stable/v3.11.1/…`

---

## 0. We had documented a dead version

The account's instance carried a green **New version available** badge. Accepting
it produced a dialog announcing **Countdown Timer 3.0**, warning that "Custom CSS
and JavaScript may require adjustments after the update."

The shipped runtime is **v3.11.1** — "3.0" is the marketing major; the runtime is
eleven minors past it.

### This corrects our own architecture claim

`planning_Research__Elfsight_Competitive_Breakdown.md` §5.5 says Elfsight "ships a
new hash, flips `stable`, and every widget on the internet updates."

**True only of patches.** Majors are opt-in per widget, require explicit user
action, and warn that customisations may break. An instance created Feb 2025 was
still on the old major in Jul 2026 — seventeen months of drift on one test
account.

The incumbent carries our re-materialisation problem *plus* a permanently
fragmented install base. Materialising from one current source is the better
position.

---

## 1. App surface — `01-empty-state.png`

| Concern | Value |
| --- | --- |
| Plan badge | `SELECT PLAN` |
| Meters | `WIDGETS 1/1`, `VIEWS 0/200`, resets Aug 19 |
| Tabs | Widgets · Request a Feature · What's New |

Overflow: Embed Code · Share by Link · Remove Elfsight Branding [UPGRADE] ·
Duplicate · Rename widget · Hide from Website · Delete Widget. **Update to New
Version** appears only while a major is pending, then disappears.

Empty-state copy names their two entry paths: *"…with the help of ready-made
templates or configure a unique widget from scratch."*

---

## 2. Creation flow and templates

### 2.1 The picker differs per app — `02-template-picker.png`

Countdown's picker is a **sidebar of 2-column thumbnails plus a live preview**,
with **no categories, counts, or pagination**. Calculator's is a paginated grid
with five named categories and a total. Not one shared component.

**The widget does not exist until a template is committed.** Create mints a
provisional id; closing the picker discards it and the app returns to 0/1.

### 2.2 The full catalogue — 89 templates, `screenshots/templates/`

All 89 pulled as real PNGs from the CDN.

| Family | Examples |
| --- | --- |
| **Seasonal / holiday** (largest) | Black Friday, Cyber Monday, Christmas, Halloween ×4, Easter ×2, Thanksgiving, Valentine's, New Year, Kwanzaa, Hannukah, Boxing Day, Veterans Day, Super Bowl, Election ×4 |
| **Fixed-duration presets** | 30-Sec, 1-Min, 5-Minute, 1 Hour, Day, Month, Seconds |
| **Evergreen / per-visitor** | Evergreen Timer, Evergreen Countdown Timer, Evergreen Sale, Evergreen Exclusive |
| **Scarcity & social proof** | Scarcity, Fame Counter, Trust Counter, Stock Countdown, Fomo Countdown Timer, Last Chance, Today only |
| **Life events** | Wedding, Marriage, Baby ×2, Pregnancy, Birthday, Retirement, Party, Vacation |
| **Business** | Webinar, Conference ×2, Meeting, Launch ×2, Coming Soon, Sales, Limited Offer, Tax, School, Church ×2 |
| **Notable** | **Email Countdown Timer**, Ticker Countdown Timer, Blank |

Three observations:

**Fixed-duration timers are sold as seven separate templates**, not as a mode.
They are personal-countdown presets.

**Scarcity is a named category** — seven templates use the number counter as
social proof, not as a timer ("Items left in stock: 25", "People viewing this
product: 09"). Our `number` mode could serve this today and does not advertise it.

**There is an Email Countdown Timer**, despite email clients not executing
JavaScript. Their top request by 5× is countdown timers in email. Not opened.

---

## 3. The editor — five rail sections

| Legacy | v3.11.1 |
| --- | --- |
| Timer · Button · Appearance | **Timer · Actions · Position · Theme · Settings** |

### 3.1 Timer — `03-editor-timer.png`

| Control | Notes |
| --- | --- |
| Mode | card with a **Change** link |
| Heading | rich text |
| Starts / Ends | date + time |
| **All Day** | toggle, new |
| Time Zone | dropdown |
| **Repeat** | sub-panel |
| **Hide Widget Before Countdown Starts** | **scheduled activation** |

That last one closes a gap listed against ours: nothing in our widget makes it
appear only between two dates.

### 3.2 Modes — three, unchanged in substance

| Mode | Their description |
| --- | --- |
| Countdown to Date | "Counts down to a specific date and time" |
| Personal Countdown | "Starts for each visitor when they first open the page" |
| Number Counter | "Counts up or down between chosen numbers" |

We have all three. "Counts up or down" applies to *numbers*; their #2 request —
count-up from a date (18 votes) — is about time, and neither product does it.

### 3.3 Repeat — calendar recurrence — `09-repeat-event.png`, `10-repeat-custom.png`

```text
Does Not Repeat · Daily · Weekly on Friday · Monthly on the second Friday
Annually on May 14 · Every weekday (Monday to Friday) · Custom
```

**Custom opens a real recurrence builder** — Frequency, Every N, **Repeat Ends**.
RRULE-shaped.

Ours is six flat intervals (`never`, 1 min, 5 min, 1 hr, 1 day, 1 week),
**personal mode only**, implemented as a modulo over the original anchor rather
than a schedule.

### 3.4 Position — five placement modes — `05-editor-position.png`

Visual tiles: **Inline · Full-width Section · Top Bar · Bottom Bar · Static Top
Bar**, plus **Content Width** (800px) and three-way **Alignment**.

Ours emits **zero** floating controls — merged defaults carry no `stage.floating`,
so `buildStagePodLayoutPanelFields` produces nothing. A capability gap, not a
naming difference.

### 3.5 Theme — thirteen presets — `06`, `07`, `08`

```text
Custom · Light · Dark · Gradient · Pastel
HOLIDAY: Halloween · Thanksgiving · Black Friday · Cyber Monday ·
         Christmas · New Year · Valentine's Day
```

Plus **Customize Theme**, a separate **Timer Style** carousel of **five digit
treatments**, **Animation: Flip**, **Separator**, **Time Format: D H:M:S**, and
**Show Labels**.

Three have no equivalent on our side:

- **No preset system at all** — `spec.json` has no `presets` key.
- **No digit animation** — our `widget.css` transitions only the CTA.
- **Separator** is first-class here. Ours is a three-glyph choice that cannot be
  hidden, and separators do not hide when a unit hides (defect §7.4.2).

### 3.6 Settings — `16-settings.png`

**Language** (with **Edit Texts**) · **Google Analytics** · **Custom CSS** ·
**Custom JS**.

Correction to an earlier note in this repo: Countdown *does* have Edit Texts — it
sits under Language rather than beside it.

---

## 4. Actions — a countdown that captures leads

The finding that matters most.

### 4.1 Two lifecycle phases — `04-editor-actions.png`

```text
DURING COUNTDOWN     Link → https://elfsight.com/     [+ Add Action]
AFTER COUNTDOWN ENDS Hide Timer — "Remove the timer after it finishes"
```

Each phase holds a *collection*. Legacy had one dropdown with three fixed options.

### 4.2 Three action types — `11-action-types.png`

| Type | Description |
| --- | --- |
| **Link** | Redirect visitors to a chosen URL |
| **Form** | **Open a form to collect user data** |
| **Add to Google Calendar** | Save the event to Google Calendar |

### 4.3 The Form action is a full lead-capture system — `12`–`15`

Adding it renders a live modal in the preview: **Contact Us** with Your Name,
Email (required), **Phone Number with country selector**, Your Message, a consent
checkbox linking Terms and Privacy Policy, Submit, and a **"protected by
reCAPTCHA"** notice.

Behind it:

- **Form builder** — Contact Us, Your Name, Email, Phone Number, Your Message,
  Consent, each with an overflow menu, plus **+ Add Field**. Button Text and
  Button Style above.
- **Submit Button** →
- **Email Notifications** — **Notify Me** (pre-filled with the account address),
  **Notify Respondents**, and **Email Sender Settings** (SMTP: "send messages
  directly from your email address").
- **Integrations** — **Google Sheets · Zapier · Make.com · Mailchimp · Webhooks**,
  plus Request Integration.

### 4.4 What this settles

A countdown timer ships a form builder, SMTP configuration, autoresponders and
five CRM integrations. The identical engine appears in Calculator — three
changelog entries are byte-identical across both apps on the same dates, and
Countdown shipped Phone-field work across three releases despite a countdown
having no native use for a phone field.

**Lead capture is their platform bet, installed per app.** That makes the open
question in `../Calculator/Calculator_PRD.md` §17.3 a Clickeen **platform**
decision, not a Calculator one.

---

## 5. What's New (Step 5)

16 entries. By views: **[MAJOR UPDATE] Auto-repeat, layout enhancements, new
buttons, themes** (Oct 9 2025, 198 views, 4 replies) — this is 3.0. **Better time
zone accuracy and DST adjustments** (Nov 2023, 170). **Control display of
scheduled timers** (Dec 2025, 60).

Form-engine entries identical to Calculator's: bulk-add Dropdown options (Mar 31),
Make.com (Mar 18), autoresponder logo and signature (Mar 3/4). Plus three Phone
field releases (Nov 11, Nov 18, Dec 4 2025).

**Posts not opened** — per the procedure, treat this as an index, not a
description of mechanisms.

---

## 6. Request a Feature (Step 6)

| Votes | Request | State |
| --- | --- | --- |
| **87** | **Countdown timers in emails** | Gathering feedback |
| 18 | Count up from a particular date | Gathering feedback |
| 10 | Display button on mobile view | **Planned** |
| 8 | Synchronise countdown on desktop and mobile | Gathering feedback |
| 6 | Countdown GIF Timer | Gathering feedback |
| 6 | **More than one font size for header and plain text** | **Planned** |
| 4 | **Separator character between digits** | **Planned** |
| 4 | **Different fonts for message and counters** | Gathering feedback |
| 4 | Timer starts when the visitor clicks a button | Gathering feedback |

**Their top request is structurally impossible for them.** Email clients do not
execute JavaScript and their delivery is a client-rendered `platform.js`. #1 and
#5 are the same need. A materialised-artifact pipeline that already writes files
per instance at save is a shorter path to "also emit a GIF at this URL".

**Two of their top ten ask for per-role typography** — which we ship by default.
Their Sizes & Fonts offers one font for the whole widget.

---

## 7. Gaps against Clickeen (Step 9, verified against source)

Composed control count on our side is **214** — 160 shared Shell, 54
widget-specific — but only **34 touch `countdown.*` paths**.

### 7.1 Modes — parity

We have all three: `date`, `personal` (localStorage-anchored), `number`.

### 7.2 What v3.11.1 has that we do not

| Capability | Elfsight | Clickeen |
| --- | --- | --- |
| **Recurrence** | 7 presets incl. ordinal-weekday + Custom RRULE builder with Repeat Ends | six flat intervals, personal mode only, modulo over anchor |
| **Date / time entry** | date + time pickers | **plain `textfield`**, types `2030-01-01T00:00` |
| **Timezone entry** | dropdown | **plain `textfield`**, IANA name or `browser` |
| All Day | yes | none |
| **Scheduled activation** | Hide Widget Before Countdown Starts | none |
| **Placement** | 5 modes incl. top/bottom/static bars | **no floating controls emitted** |
| **Themes** | 13 presets + 5 timer styles + Customize | **none** |
| **Animation** | Flip | none |
| Actions | 2-phase collection, 3 types | 1 during-CTA, 1 after-behaviour |
| **Lead capture** | form builder, SMTP, autoresponders, 5 integrations | none — out of scope by contract |
| Google Calendar action | yes | none |
| Google Analytics | yes | none |

### 7.3 What we have that they do not

- **Per-role typography** — six roles × 10 properties. Two of their top-ten
  requests ask for exactly this.
- **Shell depth** — Stage/Pod fills incl. image and video, inside shadows,
  18-channel social share, locale switcher, per-corner radii.
- **No Custom CSS/JS escape hatch**, by design.

### 7.4 Defects in our own source, found while diffing

| # | Defect | Evidence |
| --- | --- | --- |
| 1 | **Counter mode deletes itself ~5 s after load on factory defaults** — `number` finishes, phase `ended`, default `after.type: "hide"` hides the core | `renderPhase`, defaults |
| 2 | **Leading separator renders when a unit is hidden** — `updateUnits` hides units, nothing hides the three separator nodes | `updateUnits`, `widget.html` |
| 3 | **`appearance.textColor` is a dead control** — `var(--typo-timer-color, var(--countdown-text-color))`, and `timer.color` is always set | `widget.css` |
| 4 | **No `aria-live`, `role="timer"`, or `<time datetime>`** on a ticking value | `widget.html` |
| 5 | `months` = 30 days flat | `widget.client.js:466` |
| 6 | No pluralisation — renders "1 Days" | `updateUnits` |
| 7 | Personal timer **throws** when `localStorage` is unavailable — common in embedded iframes | `widget.client.js` |
| 8 | DST edge — offset sampled at wall-clock-as-UTC, not the true target instant | `resolveTargetTimestamp` |
| 9 | During-CTA appearance hardcoded; shared header CTA has 11 controls | `widget.css` |
| 10 | `itemKey: "countdown.item"` is inert | `spec.json` |
| 11 | Per-unit show/hide specified in `Countdown_PRD.md:185`, never built | PRD vs spec |
| 12 | `timer`/`label` roles omit line-height and tracking defaults yet render those controls | `spec.json` |

Fix 1–4 before any competitive feature work. 1 is a visible failure on defaults,
3 is a zero-dead-controls violation, 4 is the accessibility and answer-engine
argument we make about ourselves.

### 7.5 The honest headline

On **mechanics** we are closer than the feature lists suggest — all three modes
exist. We lose on **authoring** (ISO strings and IANA names typed into bare text
fields), **scheduling** (flat intervals vs calendar recurrence), **placement** (no
bars), **presets** (zero vs thirteen), and **lead capture** (absent by contract).

We win on typography, Shell depth, and output quality — and two of their own
top-ten requests confirm the typography advantage is one customers ask for.

---

## 8. Not covered

- **What's New posts** — list read, posts unopened.
- **Email Countdown Timer template** — not opened, despite being the most
  interesting item in the catalogue given request #1.
- **Customize Theme**, **Submit Button**, **Google Analytics**, **Custom CSS/JS**
  editors — disclosures not expanded.
- **Install dialog and pricing** — platform behaviour already recorded in
  `../../planning_Research__Elfsight_Competitive_Breakdown.md`; not re-verified.
