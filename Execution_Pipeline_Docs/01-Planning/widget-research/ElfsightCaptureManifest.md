# Elfsight Screenshot Capture Manifest

Status: CAPTURE CHECKLIST (2026-07-31)

Every state below was inspected live on 2026-07-31 and is cited in one of the
research documents in this folder. This manifest exists so those citations can be
pinned to images.

## Why

`Countdown_competitoranalysis.md` describes a five-tab Elfsight UI (Timer /
Actions / Position / Theme / Settings) that no longer exists — the shipping editor
has three rail sections. Nobody noticed it had gone stale because there was
nothing to date the claims against. Screenshots pin a claim to a version.

## Convention

Follow `InstagramFeed/screenshots/` — numbered, semantic, panel-named:
`07-configurator-main.png`, not `Screenshot 2026-07-31 at 8.51.06 AM.png`.

```text
widget-research/{Widget}/screenshots/NN-panel-name.png
```

Account-level shots belong with the account-level research doc:

```text
widget-research/_elfsight-account/NN-name.png
```

Prefix every filename with the capture date in the folder README, or rename the
folder `screenshots-2026-07/` if a second capture pass is ever taken. The failure
mode this manifest exists to prevent is an undated image set.

## Account level

Cited by `Execution_Pipeline_Docs/01-Planning/planning_Research__Elfsight_Competitive_Breakdown.md`.

| File | Where | How to reach it |
| --- | --- | --- |
| `01-dashboard-app-page.png` | `dash.elfsight.com/apps/faq` | as-is — shows `WIDGETS 1/1`, `VIEWS 0/200`, reset date, `SELECT PLAN` badge |
| `02-pricing-single-app.png` | same | click **Install** on the widget card (app has no plan) → "Pick a plan to install the widget", FAQ tab |
| `03-pricing-95-apps-pack.png` | same | from 02, click the **95 Apps Pack** tab |
| `04-install-embed-code.png` | `dash.elfsight.com/apps/google-reviews` | click **Install** (this app is on the Free plan) → Embed Code dialog with `platform.js` snippet and the 24 platform tutorials |
| `05-catalog.png` | `dash.elfsight.com/catalog` | as-is — category rail and best-seller grid |

`04` is the single most important image in the set. It is the evidence for the
serving-model argument: one shared `platform.js`, an empty `div`, and
`data-elfsight-app-lazy`.

## FAQ

Cited by `FAQ/FAQ_ElfsightGapAnalysis.md`.

| File | How to reach it |
| --- | --- |
| `01-editor-content.png` | Edit the FAQ widget → Content panel root |
| `02-content-category.png` | click a category row → shows the **Icon** field |
| `03-content-question-richtext.png` | click a question → Answer field, with the `…` overflow open showing Underline / Strikethrough / Clear Formatting |
| `04-layout-accordion.png` | Layout panel, Accordion selected → four controls |
| `05-layout-list.png` | Layout panel, List selected → only Show Search Bar (proves conditional controls) |
| `06-appearance-templates.png` | Appearance → Template dropdown open, all four values |
| `07-appearance-custom-css.png` | Appearance → Custom CSS → the **"Explore the Forum"** and **"Request a Feature"** cards |
| `08-settings.png` | Settings panel → Display Videos / Display Images / Custom JS |

`07` is the one to prioritise. "Find the CSS you need on our forum, where users
share their solutions" is the clearest statement of their design philosophy
available anywhere, and it is quoted in the gap analysis.

## Countdown

Cited by `Countdown/Countdown_ElfsightGapAnalysis.md`.

| File | How to reach it |
| --- | --- |
| `01-timer-panel.png` | Edit the Countdown widget → Timer panel, incl. the four **Position** radios |
| `02-timer-type-dropdown.png` | Type dropdown open → all three modes |
| `03-timer-per-visitor.png` | select "Remaining Time Counter Per Visitor" → the panel recomposes |
| `04-counter-restart-settings.png` | from 03 → Counter Restart Settings |
| `05-counters-and-labels.png` | Counters & Labels → the four per-unit checkboxes |
| `06-action-after-finish.png` | Action After Timer Finishes → dropdown open, all three options |
| `07-appearance-styles-themes.png` | Appearance panel → Style carousel (5) and Holiday Theme carousel (8) |
| `08-appearance-colors.png` | Appearance → Colors → five colour rows |
| `09-appearance-sizes-fonts.png` | Appearance → Sizes & Fonts → font dropdown open showing "Default (Apply from Website)" |

`01`, `05`, and `06` carry the three biggest gaps: sticky placement, per-unit
visibility, and redirect-on-expiry.

## Google Reviews

Cited by `GoogleReviews/GoogleReviews_competitoranalysis.md`.

| File | How to reach it |
| --- | --- |
| `01-editor-content-source.png` | Edit → Content panel → the connected-source card |
| `02-ai-features.png` | AI Features panel → AI-Generated Summary sub-controls and the premium-marked AI Translate Reviews |
| `03-layout.png` | Layout panel → six layout tiles incl. **Badge**, plus "See all layouts" |
| `04-reviews-panel.png` | Reviews panel → the two style carousels and eight visibility toggles |
| `05-style.png` | Style panel → Light/Dark, accent swatches, seven per-element panels |
| `06-settings.png` | Settings panel → **Schema.org**, Google Analytics, Language, Edit text |
| `07-rendered-ai-summary.png` | the preview itself → the AI summary card with its three bullets |

`06` matters most: Schema.org output as a first-class setting is the direct
counterpoint to our zero structured-data position.

## Calculator

Cited by `Calculator/Calculator_competitoranalysis.md` and `Calculator/Calculator_PRD.md`.

| File | How to reach it |
| --- | --- |
| `01-build-panel.png` | Edit → Build panel → AI generator card, Fields list, Calculations list |
| `02-add-field-types.png` | **+ Add field** → the six-type picker |
| `03-field-editor-slider.png` | click "Loan Amount" → label, help text, min/max/default/step, format, conditional logic, `[field_id]` |
| `04-calculation-editor.png` | click "Monthly Payment" → formula, insert tabs, operator row, primary/secondary, caption |
| `05-function-library.png` | from 04 → the **Functions** tab open → all 14 functions |
| `06-results-section.png` | Results section → title, footer, Print / Download / Reset toggles |

`02` and `05` are load-bearing for the PRD: the field-type set and the function
set are both specified against them.

## Event Calendar

Cited by `EventCalendar/EventCalendar_competitoranalysis.md`.

| File | How to reach it |
| --- | --- |
| `01-events-sources.png` | Edit → Events panel → the three source cards (manual / CSV / Google Calendar) |
| `02-layout.png` | Layout panel → all eight layouts incl. Month / Week / Day, plus the per-embed layout-override note |
| `03-settings.png` | Settings panel → click action, per-event deep links, visitor-timezone toggle |
| `04-rendered-event-cards.png` | the preview → the event record shape (date range, image, category, time, location, CTA) |

`01` is the evidence for the bridge argument — two of the three sources need no
connector.

## Notes

- Capture at a consistent viewport. The states above were read at 1376×894.
- Do not capture anything showing account identifiers, billing details, or the
  connected Google business address beyond what is already quoted in the docs.
- If Elfsight has redesigned since 2026-07-31, capture what is there and note the
  drift in the relevant document rather than forcing the old shot list.
