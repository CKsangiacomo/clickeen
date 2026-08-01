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

## 2. Creation flow and templates (Steps 2–3) — NOT COMPLETED

Both steps were blocked: the app sits at `1/1` on the free plan, and clearing the
slot was not completed within this pass. **Countdown's template count, category
split, and whether its templates vary structurally or only by content are
unknown.**

Do not infer them from Calculator. Calculator's 116 templates vary by content only
because Calculator exposes no layout axis; Event Calendar and Google Reviews
templates vary structurally. Countdown 3.0 exposes both Position and Theme axes,
so the structural hypothesis is plausible and untested.

This is the highest-value gap remaining in this document.

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

## 6. Gaps against Clickeen — provisional

Pending the source inventory (Step 9, in flight). Stated as questions to verify,
not as findings.

| 3.0 capability | Clickeen countdown | Verify |
| --- | --- | --- |
| Calendar-grade recurrence (7 presets + Custom) | none | confirm |
| Per-visitor evergreen timer | ? | legacy had it; confirm ours |
| Number counter mode | ? | legacy had it; confirm ours |
| Count-up mode | none (also absent in Elfsight — 18 votes) | confirm |
| All Day toggle | ? | confirm |
| Action collection with During/After phases | single completion behavior | confirm |
| Form action / lead capture | none — and out of scope by contract | platform decision |
| Add to Google Calendar action | none | confirm |
| Position as banner / floating bar / section | Shell stage/pod handles this | confirm equivalence |
| Theme presets and digit styles | ? | confirm |
| Per-role typography | **ships by default** | our advantage |
| Custom CSS / JS | deliberately absent | our position |

---

## 7. What this pass did not cover

Stated plainly so nobody mistakes it for covered:

- **Steps 2 and 3** — creation flow, template picker, template count, category
  split. Blocked at `1/1`.
- **3.0's Position, Theme, and Settings rail sections** — never opened.
- **The mode gallery behind `Change`** — 3.0's mode list is unknown; the legacy
  three types may or may not have survived.
- **The Form action's field types and integration configuration.**
- **Step 7 install/serving and Step 8 pricing** — unchanged from the platform
  behavior already recorded in
  `planning_Research__Elfsight_Competitive_Breakdown.md`; not re-verified here.
- The changelog **posts** were not opened for Countdown; only the list was read.
  Per the procedure, titles are not findings — treat §4 as an index, not a
  description of mechanisms.
