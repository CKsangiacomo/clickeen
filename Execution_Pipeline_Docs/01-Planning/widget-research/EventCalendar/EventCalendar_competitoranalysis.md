# Event Calendar — Competitor Analysis And Build Considerations

Status: PRIMARY-SOURCE COMPETITIVE RESEARCH (2026-07-31)
Type: Research. Defines no scope and authorizes no build. Clickeen has no event
calendar widget today.

## Method

Live authenticated Elfsight account driven in-browser on 2026-07-31. The Event
Calendar editor was opened and the Events, Layout, and Settings panels walked.
The sample instance was a sports fixture list rendering in Italian.

Editor chrome rendered in the account's UI language; control semantics were read
from structure, values, and the live preview.

## Part 0 — Read this first: this one is a bridge

Of the three unbuilt widgets researched, Event Calendar is the only one that can
ship **with or without** an integration.

It offers three data sources, and the first two require no connector at all:

1. **Manage events manually** — authored content, exactly like every Clickeen
   widget today.
2. **Import from CSV** — authored content, bulk-loaded.
3. **Connect to Google Calendar** — integration-sourced, with all the refresh and
   staleness problems described in the Google Reviews analysis.

That makes it the natural first step toward integration-sourced widgets: build
the manual and CSV paths on the existing materialize-at-save model, ship a
complete product, and add the Google Calendar source later once a connector
framework exists. Google Reviews has no such path — without the connector there
is no widget.

Event Calendar is also the only one of the three where a **repeating structured
record** is the content model. That is closer to what
`documentation/strategy/SchemaFirstApps.md` describes than any widget Clickeen
currently ships, and it is a reasonable proving ground for it.

## Part 1 — What Elfsight ships

**Editor shape:** five rail sections — Events, Layout, (filters/sorting), (style),
Settings — plus panel and live preview.

### Events panel

Three source cards, presented as equals:

| Source | Icon |
| --- | --- |
| **Manage events manually** | pencil |
| **Import from CSV** | CSV |
| **Connect to Google Calendar** | Google Calendar |

### The event record

Read from the rendered cards. Each event carries:

| Field | Example |
| --- | --- |
| Start date | FEB 7 |
| End date | FEB 8 |
| Image / logo | team crest thumbnail |
| Category or tag | "LONTANO" (Away) / "CASA" (Home) |
| Title | "contro i Royals" |
| Start and end time | "7 febbraio 23:00 - 8 febbraio 01:00" |
| Location | "AT&T Park – San Francisco Giants" |
| CTA | "Ottieni i biglietti" (Get tickets) |

Cards render with alternating emphasis — some with a dark filled background —
suggesting a per-event featured or category-driven styling axis.

The widget also renders a **past events** section and an **empty state** with
author-editable copy ("Sorry, no events at the moment. But really interesting
things will arrive soon.").

### Layout panel

**Eight layouts**, the largest set of any Elfsight widget seen in this research:

List · Grid · Masonry · Carousel · Slider · **Month** · **Week** · **Day**

The last three are true calendar views — a month grid, a week view, and a day
view — which is a categorically different rendering problem from the first five.

| Control | Value observed |
| --- | --- |
| Group events | dropdown, "None" |
| Events per page | 10 |
| Events per page on mobile | 10 |
| Width | 940px |
| Widget title | disclosure |
| Event elements | disclosure |
| Past events | disclosure |

Product copy in this panel, paraphrased: *"You can use the same widget several
times on your website with different layouts — change it dynamically through
attributes in the widget code. The calendar layout changes dynamically."*

That is a notable capability: **one saved widget, many embeds, layout overridden
per placement via a data attribute on the embed div.** A month view in one place
and a compact list in a sidebar, from a single source of truth.

### Settings panel

| Control | Detail |
| --- | --- |
| **Action on event click** | radio — View event details in a popup · Go to the event's button link · Nothing |
| Popup elements | disclosure |
| **Enable direct link for events** | toggle, on — "a unique identifying URL is added, making it easy to copy the URL and share a specific event" |
| **Events in visitor's local timezone** | toggle, off — by default an event shows in its own timezone, with the visitor's local time appended when they differ; enabling it converts everything to the viewer's timezone. Copy explicitly cites online events as the use case. |
| Language | dropdown (Italiano observed) |
| Edit text | per-string copy override |
| Custom CSS | code editor |
| Custom JS | code editor |

Two of these are worth flagging.

**Per-event deep links.** Clickeen's FAQ already implements exactly this pattern
(`faq.geo.enableDeepLinks`, stable per-question anchors, hash restore on load).
The mechanism transfers directly.

**Timezone handling is thoughtful.** Default is event-local with the visitor's
time appended when it differs — not a blunt convert-everything. Compare
Clickeen's countdown, where `timezone` is a raw unvalidated textfield.

## Part 2 — What building this in Clickeen would require

### Exists and would transfer

| Capability | Where |
| --- | --- |
| Repeating item authoring | `object-manager` + `repeater` controls, as used by FAQ sections and questions |
| Per-item deep links | FAQ's `geo.enableDeepLinks` pattern |
| Entitlement-gated item counts | `items.group.*.max` — FAQ already uses all three tiers |
| Grid and masonry rendering | FAQ's `multicolumn` layout with `grid` / `masonry` sub-layout |
| Typography, fill, border, shadow, radius | shared shell |
| Translation of authored strings | overlay model — event titles, locations, categories, CTA labels, empty-state copy |
| Image handling per item | account asset references, already used elsewhere |

A manual-source event calendar in List / Grid / Masonry form is close to
assembly from parts Clickeen already has. It is the FAQ content model with a
richer item shape.

### Does not exist

| Capability | Notes |
| --- | --- |
| **Calendar views** (month / week / day) | A genuinely different rendering problem — date grids, week boundaries, multi-day event spanning, overflow when a day has many events. This is the bulk of the work. |
| **Date/time authoring UI** | Clickeen has no date picker anywhere. Countdown's target date is a raw regex-validated textfield — see `Countdown_ElfsightGapAnalysis.md` Part 3.6. A calendar makes this unavoidable. |
| **Timezone model** | Per-event timezone, plus optional visitor-local conversion. Countdown's single-pass offset resolution is already flagged as DST-risky; a calendar needs this done properly. |
| **Recurring events** | Not observed in this pass, but standard for the category. Implies RRULE-style expansion. |
| **Past/upcoming partitioning** | Requires evaluating "now" — which for a materialized static artifact means the partition must be computed client-side at render, not baked at save. |
| **CSV import** | A bulk-authoring path Clickeen has nowhere. |
| **Popup detail view** | Dieter has `popup` and `popover`; the composition is new. |
| **Per-embed layout override** | Clickeen's embed is a URL, not a script + attributed div. Achieving this would mean a query parameter on `clk.live/{account}/{instance}` — which interacts with cache keys and with the one-artifact-per-instance storage model. |
| **Google Calendar connector** | Same foundation gap as Google Reviews. Deferrable. |

### The one that needs a decision early

**"Past events" and "upcoming events" are time-relative.** A materialized artifact
is computed once at save. If the partition is baked in, a calendar published in
January will still call February's events "upcoming" in March.

So the partition must be evaluated in the browser at render time against
`Date.now()`. That is entirely compatible with static serving — countdown already
does exactly this — but it means the served HTML contains **all** events and the
runtime decides presentation. Worth being deliberate about, because it also means
past events remain in the crawlable HTML unless explicitly excluded at
materialization.

## Part 3 — Product observations

**Eight layouts is the differentiator, and three of them are the real product.**
Month, Week, and Day views are what makes this an *event calendar* rather than a
styled list. A version shipping only List/Grid/Masonry is a different, smaller
product — legitimate, but it should be named as such rather than treated as
phase one of the same thing.

**The record is the schema-first proving ground.** An event is a structured
record with typed fields — dates, times, location, image, category, link. That is
closer to `SchemaFirstApps.md` than anything Clickeen ships. If the substrate
thesis is going to be tested on a widget, this is the one.

**Date authoring can't be dodged here.** Countdown got away with a raw textfield
because there is one date. A calendar has one per event, authored repeatedly. The
date picker Clickeen has been able to avoid becomes mandatory — and building it
well would retroactively fix countdown's worst authoring moment.

**Per-embed layout override is a genuinely good idea.** One event source rendered
as a month grid on the events page and a compact upcoming-three list in the
footer, without duplicating content. It does not fit Clickeen's current
one-artifact-per-instance model cleanly, which makes it worth thinking about
before the model hardens rather than after.

**Timezone deserves borrowing wholesale.** Event-local by default, visitor's time
appended when they differ, optional full conversion. That is a better model than
anything currently in the Clickeen countdown.

## Part 4 — Open questions for the team

Not decisions.

1. **Do calendar views (month/week/day) ship, or is scope List/Grid/Masonry?**
   This is the single largest scoping question and it changes what the product
   is.
2. **Manual + CSV first, connector later?** This is the only researched widget
   where that sequencing yields a complete product at each step.
3. **Does a date/time picker get built as a Dieter component?** It is needed here,
   it would fix countdown, and it does not exist. That makes it a shared-contract
   candidate rather than widget-local work.
4. **Recurring events — in or out?** Standard for the category, and a large
   increment (expansion rules, exceptions, end conditions).
5. **How is the past/upcoming boundary handled at materialization?** See Part 2.
   Also: are past events emitted into the crawlable HTML at all?
6. **Is per-embed layout override worth supporting**, and if so how does it
   interact with one-artifact-per-instance storage and edge cache keys?
7. **What is the entitlement axis?** FAQ uses `items.group.*.max` for sections and
   questions. Events per calendar is the obvious analogue.
