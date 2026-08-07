# Event Calendar — platform readiness

STATUS: RESEARCH (2026-07-31). Findings about the Clickeen platform, verified
against source. Defines no scope and authorizes no build.

Companion to `EventCalendar_competitoranalysis.md`. That document describes what
Elfsight ships. This one describes what our platform would have to answer first.

Event Calendar would be the first Clickeen widget whose primary content is dates
and times. That turns out to matter far more than the layout work.

---

## 1. The blocking conflict: dates cannot be translated, and must be

`documentation/widgets/authoring/WidgetAuthoringChecklist.md` requires every
customer-visible text path to be declared in `editable-fields.json`. An event
date is customer-visible text. But the overlay model is
`Record<string, string>` — `packages/ck-contracts/src/translated-value-primitives.ts`
types it exactly that way, and validation is **exact against paths, never
against value shape** (`documentation/capabilities/localization.md:113-116`).

So both branches fail:

**Declare the date as translatable.** The Translation Agent receives
`"2026-11-14T19:00"` and is asked to translate it. It returns
`"14. November 2026, 19:00 Uhr"`. The overlay validator accepts it — non-empty
string at a string path. The value reaches the runtime and throws on the parse
regex. **The German visitor gets a broken widget, and the failure surfaces in
their browser rather than at translation time.**

**Omit it.** Every locale renders the base locale's format. A German visitor
reads `11/14/2026` as the eleventh day of a fourteenth month.

Countdown survives today only because it never formats a date — it renders four
zero-padded integers with author-typed labels, and `targetDate`/`timezone` are
deliberately absent from its `editable-fields.json`.

There is no third option in the current contract. `WidgetTextPrimitiveType` is
exactly `'string' | 'richtext'`; there is no way to declare a string
**non-translatable**, and no way to declare a value **derived**.

### The resolution is already sitting there unused

A BCP-47 tag **does** reach widget JavaScript. Four ways:

```text
ctx.locale                                 shared/runtime.js:57
window.CK_WIDGETS[instanceId].locale       ck-runtime-materializer/src/runtime.ts
document.documentElement.lang              rewritten per ?locale= request
window.CK_LOCALE_POLICY.languages          published at runtime
```

`tokyo-worker/src/routes/clk-live-routes.ts` string-replaces a stamped marker
per locale request and rewrites `<html lang>` at the same time.

**No widget has ever read it for formatting.** `Intl.DateTimeFormat` appears
twice in widget source, both in Countdown, both hardcoded to `'en-US'` —
deliberately, because both want a stable parseable shape rather than a localized
one. Zero uses of `Intl.RelativeTimeFormat`, `Intl.Locale`, or `Temporal`
anywhere.

So the correct model is: **a date is not authored content, it is derived
presentation** — a function of `(instant, timezone, locale, calendar)` computed
at render. Overlays carry authored content and are computed once per locale at
translation time, with no access to the viewer. They are the wrong instrument.

The author stores an instant and *format options*; the runtime formats with
`Intl.DateTimeFormat(ctx.locale, options)`. Only the author's own strings —
event title, description, venue name, CTA label — go through overlays.

---

## 2. Four contract violations to resolve before spec

| # | Violation | Source |
| --- | --- | --- |
| 1 | Any date path in `editable-fields.json` is a live hazard, per §1. The checklist and the translation model point in opposite directions for this widget. | `WidgetAuthoringChecklist.md` vs `localization.md` |
| 2 | Locale-derived rendering has no home in the artifact model. The materializer is forbidden from creating locale-derived files, and `localization.md:187` lists "no instance locale-derived HTML/CSS/JS objects" as a verified invariant. Client-side formatting at render is the only legal place — legal, available, and unused. | `ck-runtime-materializer/README.md` |
| 3 | A widget folder is **exactly six files**, and widget-local helpers for shared behaviour are forbidden. Event Calendar therefore **cannot ship its own `dates.js`**. A shared date module in `tokyo/product/widgets/shared/` is a prerequisite, not an implementation detail. | `WidgetAuthoringChecklist.md:32` |
| 4 | `schemaJsonLd` is explicitly **banned from widget source**, and `seo-geo.ts` files were deleted from the widget source model. An Event Calendar emitting `schema.org/Event` cannot do so from its own source. | `WidgetComplianceSteps.md:563` |

---

## 3. What does not exist at all

**No date control.** The complete Dieter/Bob control vocabulary is
`bulk-edit, choice-tiles, dropdown-actions, dropdown-border, dropdown-edit,
dropdown-fill, dropdown-shadow, object-manager, repeater, segmented, slider,
textfield, toggle, valuefield`. There is no date, time, datetime, or timezone
control. Countdown's precedent is a bare `textfield` where the author hand-types
`America/New_York`, validated by a try/catch probe.

Acceptable for one target date. Multiplied across every event row it is unusable,
and building the control is a Dieter PRD, not widget work.

**No shared date utility.** `tokyo/product/widgets/shared/` contains appearance,
branding, coreSize, fill, header, localeSwitcher, previewL10n, runtime,
socialShare, stagePod, surface, typography. No date, datetime, or format module.

**No structured data, and the mechanism was removed.** Zero JSON-LD in any widget
source. `embed.seoGeo.enabled` exists in the entitlements matrix marked
`status: 'enforced'`, referenced by no widget's `limits.json`, and generating
nothing. The closest existing feature is FAQ's `faq.geo.enableDeepLinks`, which
emits URL fragments and no markup.

An Event Calendar would be the first real consumer of that missing layer — and
`schema.org/Event` requires `startDate` in ISO 8601 **with offset**. That is a
stronger requirement than Countdown's zoneless string satisfies, so the storage
decision in §4 determines whether valid Event markup is derivable at all.

**No viewer timezone in runtime context.** `ctx` carries
`{ widgetShell, instanceId, payload, locale, state }`.
`Intl.DateTimeFormat().resolvedOptions().timeZone` is available client-side and
is probably the right answer — but it makes the widget's output not a pure
function of state, which nothing else in the platform does.

---

## 4. Decisions the spec must make

**Storage format.** Wall-clock + zone, or absolute instant? They differ
concretely: an all-day event and a "7pm local at the venue" event need
wall-clock; a livestream needs an instant. Countdown's `'browser'` sentinel makes
the target instant differ per visitor — for a calendar that would make two
visitors disagree about which *day* an event falls on.

**Timezone scope.** Per-event, or per-calendar? Plus DST transitions inside a
recurring series, and events that cross midnight in the viewer's zone but not the
venue's.

**Recurrence representation — the highest-risk decision.** RRULE is compact,
standard, and schema.org-compatible, but needs a parser and a UI the control
vocabulary cannot express. Materialized occurrence rows fit the existing
repeater/`idRules` pattern exactly, but explode item counts and **break the
identity model**: a generated occurrence has no authored `id`, and
`identityKeyForField` requires a real stored id at a concrete path, throwing
`saved_text_field_identity_missing` otherwise.

**Sorting and filtering.** Every existing repeater renders items in stored array
order, unconditionally. A calendar must sort by date and partition on
`Date.now()`. This is the first widget whose **rendered item set is not the
stored item set** — and both `previewL10n.js` and the overlay applier resolve
translations by concrete array index into the *stored* array. That holds as long
as only display is sorted. If anyone sorts the state array, translations
mis-bind. **State the invariant explicitly in the spec.**

**Time-dependent output vs. immutable artifacts.** `clk.live` index responses are
`no-store` but `styles.css` and `runtime.js` are fingerprinted and cached.
"Upcoming events" must be computed client-side at load. The served bytes are
identical for a page whose meaning changes daily, and there is no revalidation
tick. Decide whether an event disappearing mid-session is acceptable.

**Calendar export.** ICS download and "Add to Google Calendar" are table stakes
for the category — Elfsight ships the latter as an action type — and have no
platform analogue. The nearest thing is `socialShare.js`, which builds share URLs.

---

## 5. Sequencing implication

Four of the items above are platform work that must land before the widget:
a shared date module, a date/time control in Dieter, a decision on where
structured data is emitted, and a rule for declaring a string non-translatable
or a value derived.

None of them are Event Calendar features. All of them are Event Calendar
blockers, and three would benefit every future widget that touches a date.

The honest read is that Event Calendar is not the cheapest of the three unbuilt
widgets. It is the one that forces the platform to grow a capability it has
avoided so far — which may be an argument for building it, but not an argument
for estimating it like a layout exercise.
