# Google Reviews — Competitor Analysis And Build Considerations

Status: PRIMARY-SOURCE COMPETITIVE RESEARCH (2026-07-31)
Type: Research. Defines no scope and authorizes no build. Clickeen has no
reviews widget today.

## Method

Live authenticated Elfsight account driven in-browser on 2026-07-31. All seven
rail sections of the Google Reviews editor opened and read. The widget's content
language was switched from Kannada to English during inspection so the rendered
strings could be read; the editor chrome remained in the account's own UI
language.

Not covered: the Google data pipeline itself (API used, refresh cadence, cache
policy, quota handling). None of that is visible from the editor.

## Part 0 — Read this first: the architectural problem

Every widget Clickeen ships today renders **authored** content. The user types
it, Roma materializes it at save, Tokyo serves the bytes, and the bytes are
correct until the user edits again.

A reviews widget renders **integration-sourced** content. The user authors none
of it. New reviews arrive continuously from Google, ratings move, and the owner
may reply to a review a week after publish. The content changes with **no save
event**.

That breaks the materialize-at-save model directly. There is no user action to
hang re-materialization on.

This is not an argument against building it — it is the first design decision,
and it has to be made before anything else in this document matters. Three broad
shapes exist:

1. **Scheduled re-materialization.** A job refreshes the source, re-runs the
   materializer, and writes new bytes. Keeps serving dumb and keeps output
   crawlable. Requires the fleet re-materialization capability that does not
   exist yet, plus a refresh scheduler and a per-instance staleness policy.
2. **Runtime fetch.** The served artifact fetches reviews client-side. Cheap to
   build; forfeits the crawlable-HTML advantage that is Clickeen's main structural
   edge over Elfsight, and reproduces exactly what their embed does.
3. **Hybrid.** Materialize a snapshot at publish for crawlers, refresh on a
   schedule. Content in HTML, bounded staleness.

`documentation/architecture/CONTEXT.md` already names integration-sourced content
as one of three source authorities, with the rule that agents may use, summarize,
extract, route, display, analyze, and derive from it but may not rewrite source
truth. The authority is specified. Nothing implements it. This widget would be
the first.

## Part 1 — What Elfsight ships

**Editor shape:** seven rail sections — Content, AI Features, Layout, Header,
Reviews, Style, Settings — plus panel and live preview. Substantially bigger than
their FAQ (four sections, ~15 controls).

### Content

- A **source card** naming the connected Google business, showing its address
  (observed: "1444 Burlingame Ave, Burli…"), with an overflow menu.
- Prompt to add **additional Google sources** — so one widget can aggregate
  multiple locations.
- A **Reviews list** with filter and search affordances, and explanatory copy
  about which reviews are and are not available.

### AI Features

Two features, one free and one premium-marked.

**AI-Generated Summary** (on by default). Product copy: *"Elfsight AI analyzes
all reviews and prepares a summary of key facts and things most important to
customers."* Sub-controls:

| Control | Type | Values |
| --- | --- | --- |
| Summary Style | tiles | List · Text |
| Text Typing Animation | toggle | on |
| AI Image Animation | toggle | on |

Rendered output is a distinct card at the top of the widget: an "AI-Generated
Summary" label, "Based on 849 Google reviews", an aggregate star rating, and
three checkmarked bullet points synthesized from the review corpus.

**AI Translate Reviews** (off by default, premium-marked). Product copy: *"Make
all reviews understandable to your visitors. Translate them into the language
selected in settings using world-class AI models. Translation may take some time
and will appear in the widget when complete."*

Note the shape: translation is **asynchronous**, produces a derivative, and does
not claim to modify the Google source. That is precisely Clickeen's overlay
model applied to integration content — and precisely what the Translation Agent
already does for authored content.

### Layout

Six layout tiles plus a "See all layouts" affordance, so the real count is
higher:

Carousel · Grid · Masonry · List · Slider · **Badge**

The Badge layout is a compact summary widget — "Excellent on Google, 4.9,
★★★★★, 1923 reviews" — with no individual review cards. Worth noting as a
distinct product shape: it is the highest-conversion, lowest-space form and is
what most sites actually want in a footer or header.

Layout customization:

| Control | Observed value |
| --- | --- |
| Width | 1516px |
| Items per page | 8 |
| Items per page on mobile | 8 |
| Item spacing | 20px |
| Load more button | toggle, on |

### Header

Not separately captured; a dedicated rail section exists, and the rendered header
carries the Google wordmark, an aggregate rating ("4.40"), a star row, a review
count ("(849)"), and a **"Review us on Google"** CTA button.

That CTA matters commercially: the widget is not only a display surface, it is a
review-acquisition funnel back to the business's Google listing.

### Reviews

Per-review presentation, and the richest section:

- **Review Style** — carousel of 3 card designs
- **Review Source Style** — carousel of 6 attribution treatments

Visibility toggles:

| Toggle | Default |
| --- | --- |
| Show reviewer photo | on |
| Show reviewer name | on |
| Show verified badge | off |
| Show review source | on |
| Show date | on |
| Show rating | on |
| Show images | off |
| Show business owner reply | off |

Reviewer photos fall back to a coloured initial avatar when absent. Dates render
as relative time ("1 month ago", "7 months ago"). Long reviews truncate with a
"Read more" affordance.

### Style

Notably richer than their FAQ:

| Control | Type | Detail |
| --- | --- | --- |
| Color Scheme | segmented | **Light · Dark** |
| Accent Color | swatches | 16 presets + eyedropper |
| Font | dropdown | Default (inherit from website) + Google Fonts |

Plus seven per-element customization panels: Background, Widget title, Header,
Rating, Review card, Load more button, and Custom CSS.

### Settings

| Control | Detail |
| --- | --- |
| Filters | disclosure |
| Sorting | disclosure |
| **Language** | searchable dropdown, extensive locale list; localizes widget chrome |
| Edit text | link — per-string copy override |
| **Schema.org** | disclosure — structured data output |
| Enable external links | toggle, on |
| Open links in new tab | toggle, on |
| Rating format | dropdown (observed "4.90") |
| **Google Analytics** | disclosure |
| Custom JS | code editor |

Three of these deserve emphasis.

**Schema.org.** They expose structured-data output as a first-class setting. For
a reviews widget this is `Review` / `AggregateRating` markup, which is what
drives star ratings in search results. Clickeen emits no structured data for any
widget.

**Language + Edit text.** Chrome localization plus per-string overrides. This is
distinct from AI Translate Reviews, which handles the review *content*. Two
separate localization mechanisms for two different content authorities — a
distinction Clickeen's architecture already makes and could implement more
cleanly.

**Google Analytics.** A direct integration hook. Clickeen has no analytics
surface in any widget.

## Part 2 — What building this in Clickeen would require

Grouped by whether the capability exists today.

### Does not exist anywhere in Clickeen

| Capability | Notes |
| --- | --- |
| **Any integration/OAuth boundary** | No connector framework, no third-party credential storage, no token refresh. This is foundational and would be the first of its kind. |
| **A refresh mechanism for stored artifacts** | See Part 0. Depends on the re-materialization capability already identified as missing in `planning_Research__Elfsight_Competitive_Breakdown.md` §5.5. |
| **Structured data emission** | No JSON-LD anywhere in product code. Needed for `Review` / `AggregateRating`. |
| **An analytics hook** | No per-widget event surface. |
| **Per-string chrome localization** | Clickeen localizes *authored* content via overlays. It has no mechanism for localizing widget-owned UI strings ("Read more", "Posted on"). |

### Exists and would transfer

| Capability | Where it lives today |
| --- | --- |
| Typography system | 6–7 roles × 10 properties, shared shell |
| Fill / border / shadow / radius systems | shared shell |
| Stage + pod composition | shared shell |
| Locale switcher | shared shell |
| Social share | shared shell (18 channels) |
| Entitlement gating at op and save time | `limits.json` + Roma save policy |
| Translation of derivative content | Translation Agent + overlay model — maps directly onto AI Translate Reviews |
| Governed model execution | San Francisco — maps directly onto AI-Generated Summary |

The AI half is the part Clickeen is *best* positioned for. An AI review summary
is a governed model call producing a derivative artifact from integration-sourced
truth, written through a named authority — which is the exact shape San Francisco
and the agent homes were built for. Elfsight bolted AI onto a reviews product;
Clickeen would be running it through the plane that already exists.

### The genuinely hard part

Not the widget. The **data pipeline**: sourcing reviews from Google, respecting
API quota and terms, storing them under an account coordinate, refreshing on a
schedule, handling revoked access and deleted reviews, and deciding what happens
when the source is unreachable at refresh time — where Clickeen's fail-visible
tenet says you must not silently serve stale content as current.

## Part 3 — Product observations

**The Badge layout is the sleeper.** A compact "Excellent on Google, 4.9,
1923 reviews" badge is the highest-value, lowest-effort form of this widget and
a plausible standalone scope. It needs the aggregate rating and count only — not
individual reviews, not reviewer photos, not per-review styling — which
dramatically shrinks the data problem.

**Reviews are the retention argument.** Recorded in
`planning_Research__Elfsight_Competitive_Breakdown.md` §6: roughly half
Elfsight's best-sellers are integration-sourced, and that category has the
highest switching cost. Authored-content widgets can be retyped into a competitor
in an afternoon. A connected Google listing cannot.

**The review-acquisition CTA is a second product.** "Review us on Google" turns
a display widget into an acquisition loop for the business. Cheap to add, and it
is the reason a business keeps the widget installed.

**Structured data compounds with Clickeen's serving model.** Elfsight can emit
`AggregateRating` markup, but it is injected client-side into a lazy-loaded div.
Clickeen would emit it into HTML that non-JS crawlers actually read. Same
argument as the FAQ gap analysis, and it is stronger here because star ratings in
search results are a visible, attributable outcome.

## Part 4 — Open questions for the team

Not decisions.

1. **Which refresh model?** Part 0's three options have very different costs and
   different implications for the crawlable-output advantage. Nothing else in
   this document can be scoped before this is settled.
2. **Does the connector framework get built for this widget, or as its own
   foundation?** Google Reviews is one consumer; Instagram Feed, LinkedIn Feed,
   and All-in-One Reviews would be others. There is already an
   `InstagramFeed_PRD.md` in this folder anticipating the same need.
3. **Is Badge-only a viable first scope?** It shrinks the data problem to two
   numbers and defers per-review styling entirely.
4. **Where does chrome localization live?** Widget-owned UI strings are a new
   content class — neither authored account content nor integration source truth.
5. **What is the fail-visible behavior when Google is unreachable at refresh?**
   Serving the last good snapshot conflicts with never presenting stale content
   as current; serving nothing removes a widget from a customer's live page.
6. **Does the AI summary run per-instance or per-source?** Multiple instances of
   the same business listing would otherwise pay for the same model call
   repeatedly.
