# Event Calendar — Competitor Analysis (Elfsight)

STATUS: PRIMARY-SOURCE RESEARCH (2026-07-31). Research only — defines no scope
and authorizes no build. Clickeen has no event calendar widget today.

Method: `../WidgetCompetitorResearchSteps.md`, executed in order against a live
authenticated free account, **starting from Create Widget at 0/1**. Every rail
section and the event editor were opened.

Evidence: `screenshots/` — 9 captures plus all 21 template thumbnails.

---

## 1. The funnel

**Empty state** (`01-empty-state.png`) — same copy as every app: *"…with the help
of ready-made templates or configure a unique widget from scratch."*

**Picker** (`02-template-picker.png`) — sidebar of 2-column thumbnails plus a
large **live interactive preview**. No categories, no counts, no pagination —
the Countdown shape, not Calculator's paginated grid.

**Editor opens populated** with the chosen template's events, taxonomy and layout.

### 1.1 The 21 templates — `screenshots/templates/`

All 21 pulled as real PNGs. Unlike Calculator's, these vary **structurally**:

| Template | Structure it demonstrates |
| --- | --- |
| Team Games Schedule | dense list, date badge, logo, HOME/AWAY tag, per-event CTA, row highlighting |
| Movie Show Schedule | **month grid** |
| Weekly School Schedule | **week grid** |
| Upcoming Events Sidebar Widget | **narrow vertical / sidebar** |
| University Events List | list **with filter chips and a Past Events section** |
| Slider Exhibition | **slider** |
| Museum, Festival Lineup, Concert Hall | image-led card grids |
| Conference Agenda, Convention Center | agenda / schedule |
| Club Events, City Events, Halloween Calendar | themed lists |
| Upcoming Webinars, Upcoming Classes | compact list |
| Hotel Shows & Entertainment Schedule | dark schedule |
| Blank | empty start |

**Template variety tracks layout capability.** Calculator has no layout axis and
its 116 templates vary only in content; Event Calendar has eight layouts and its
templates exercise them. Do not generalise one to the other.

---

## 2. Editor — five rail sections

**Events · Layout · Filters · Theme · Settings**

### 2.1 Events — three data sources — `03-events-data-sources.png`

| Source | |
| --- | --- |
| **Manage Events Manually** | authored |
| **Import from CSV** | bulk import |
| **Connect to Google Calendar** | live external sync |

This is the first widget in this research with a genuine **integration-sourced**
content path. Clickeen's `CONTEXT.md` names integration-sourced content as one of
three content authorities and nothing implements it.

### 2.2 Event manager — `08-event-manager.png`

Event list with per-row overflow, **+ Add Event**, search, and a **…** menu. Then:

- **Past Events** →
- **Event Types** → · **Venues** → · **Hosts** →  — three *reusable taxonomies*,
  managed separately from events
- **Google Calendar Integration** →

Venues and Hosts as first-class entities, not per-event strings, is the
structural decision worth noting.

### 2.3 The per-event model — `09-event-editor.png`

| Field | Notes |
| --- | --- |
| Event Title | |
| Starts / Ends | date + time |
| **All Day** | toggle |
| **Time Zone** | per event |
| **Repeat** | **per-event recurrence** |
| Description | rich text |
| Cover Image | |
| **Event Type** | from the Event Types taxonomy |
| **Venue** | from the Venues taxonomy |
| **Tags** | |
| **Images** | gallery |
| **Video** | |
| **Actions** | per-event CTA (e.g. "Get Tickets") |
| **Attachment** | file |
| **Custom Event Color** | per-event override |

Fifteen fields per event, with recurrence and a timezone **on each event**.

### 2.4 Layout — eight modes — `04-layout-eight-modes.png`

**List · Grid · Masonry · Carousel · Slider · Month · Week · Day**

Plus **Group Events by**, **Events per Page** (10), **Events per Page on Mobile**
(10), **Width** (940px), and disclosures for **Widget Title**, **Event Elements**,
**Past Events**.

Note their own copy: *"If you want to use the same widget multiple times on your
website but with different layouts, you can change it dynamically through an
attribute in the widget code."* — layout is overridable per embed.

### 2.5 Filters & Search — `05-filters-search.png`

Visitor-facing **Search** toggle, then five filter axes: **Dates · Event Type ·
Venue · Host · Tags**.

*"You can set default values for filters by specifying attributes in the
installation code."* — filters are pre-settable per embed, so one widget serves
many filtered views.

### 2.6 Theme — `06-theme.png`

Six presets — **Light · Outline · Soft Tint · Deep Tint · Dark · Dark Outline** —
plus a 16-swatch **Accent Color** palette with a custom picker, and **Customize
Theme**.

### 2.7 Settings — `07-settings.png`

- **Action On Event Click**: View Event Details In Popup / Go To Event Button Link / None
- **Popup Elements** →
- **Enable Direct Linking to Events** — *"Adds a unique identifier to the URL when
  you open an event, making it easy to share specific events by copying the URL"*
- **Events in Visitors Local Time Zone** — converts event times to the viewer's zone
- **Language** with **Edit Texts**
- **Custom CSS** · **Custom JS**

---

## 3. What this would require that Clickeen does not have

Ordered by how much new architecture each implies.

| Requirement | Status in Clickeen |
| --- | --- |
| **Date/time as first-class content** | Only countdown handles dates, and it stores an ISO string in a plain `textfield` with no picker |
| **Per-event timezone + visitor-local conversion** | Nothing. Countdown has one widget-level timezone, also a bare textfield |
| **Recurrence** | Nothing. Countdown's repeat is six flat intervals, personal mode only |
| **Reusable taxonomies (Event Types, Venues, Hosts)** | No concept of entities referenced by items. `repeater`/`object-manager` model nested arrays, not shared lookups |
| **Visitor-facing filtering and search** | No widget has runtime visitor interaction beyond accordion toggles |
| **Past vs upcoming derivation** | Requires comparing content to *now* at render — our artifacts are materialised at save |
| **Eight layout modes incl. month/week/day grids** | Calendar grids are a rendering class we have never built |
| **CSV import** | No bulk-import path into instance content |
| **Google Calendar sync** | No connector infrastructure; integration-sourced content is specified but unbuilt |
| **Per-embed attribute overrides** | Our embed is one URL per instance; no attribute layer |
| **Deep links to individual events** | No sub-instance addressing |

### 3.1 The one that matters most for our serving model

**Past vs upcoming is time-dependent rendering.** Our artifacts are materialised
at save and served as static bytes. A calendar that must hide past events, or
show "this week", changes what it renders as time passes without any authored
change.

That is not solvable by re-materialising on a schedule without giving every
calendar instance a cron. The honest options are: compute in the client from a
materialised full event list (keeps static serving, costs SEO on the filtered
view), or accept that the served artifact is a full list and let filtering be
visitor-side only. This is a genuine architectural decision, not a feature gap,
and it should be settled before any build.

### 3.2 Where we would be structurally advantaged

- **Crawlable output.** An event list in the initial HTML is exactly what
  schema.org `Event` wants. Theirs is client-rendered and lazy — invisible to
  fetchers that do not execute JS. This is the strongest SEO case of any widget
  researched so far.
- **Per-role typography** across event title, date, venue, description.
- **Localisation.** Their Language picker swaps chrome strings only; author
  content stays in one language. Our overlay model serves N locales from one
  instance — and dates are the one content type where locale formatting matters
  most.

---

## 4. Not covered

- **Popup Elements**, **Event Elements**, **Widget Title**, **Past Events**
  disclosures — not expanded.
- **Google Calendar Integration** connect flow — not run.
- **Import from CSV** — column contract not seen.
- **Customize Theme**, **Custom CSS/JS** editors.
- **What's New** and the changelog posts.
- **Install dialog and pricing** — platform behaviour already recorded in
  `../../planning_Research__Elfsight_Competitive_Breakdown.md`.
