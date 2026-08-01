# Calculator — Competitor Analysis (Elfsight)

STATUS: PRIMARY-SOURCE RESEARCH (2026-07-31). Research only — defines no scope
and authorizes no build. The ruling document is `Calculator_PRD.md`.

Method: `../WidgetCompetitorResearchSteps.md`, executed in order against a live
authenticated free account, **starting from Create Widget at 0/1** rather than
from an existing instance. This replaces an earlier pass that opened an existing
instance and therefore never saw the creation funnel.

Evidence: `screenshots/`. Every claim cites its capture.

---

## 1. The funnel, from zero

### 1.1 Empty state — `01-app-empty-state.png`

At zero widgets the app states its own intended entry paths:

> "Your first widget is almost here! Create a captivating widget with the help of
> **ready-made templates** or configure a **unique widget from scratch**."

Two paths. Templates named first.

### 1.2 Create opens a template picker, not an editor — `02-create-template-picker.png`

**Create Widget** opens a full-screen **Choose a Template** step:

- left sidebar, 2×2 thumbnail grid, pagination reading **"1 – 4 of 116"**
- right pane, a **live interactive preview** — the selected calculator runs,
  sliders move, results recompute
- **"Continue with this template →"** pinned bottom-left

The editor is reachable only through this step.

### 1.3 Five categories summing to 116 — `03-picker-categories.png`

| Category | Count |
| --- | --- |
| Cost Calculators | 32 |
| Finance Calculators | 30 |
| Fitness & Health Calculators | 17 |
| Mortgage & Loan Calculators | 16 |
| Other Calculators | 21 |
| **Total** | **116** |

### 1.4 The catalogue is not only lead-gen — `04-picker-fitness-health-category.png`

Fitness & Health, "1 – 4 of 17": **Body Mass Index (BMI)**, **Calorie**,
**Nutrition**, **Keto**.

This corrects an earlier claim in this repo that Elfsight ships no consumer
utilities. That came from a ranked keyword search, which surfaces only cost
estimators. The picker is the complete list; the search is a biased sample.

Finance, "1 – 4 of 30" — Profit Margin, Sales Tax, Car Insurance, Fees
(`05-picker-finance-category.png`).

### 1.5 The editor opens populated — `06-editor-on-arrival.png`

Continuing lands in the editor with the template's fields, formulas, formatting,
captions and CTA already configured. There is no blank state unless chosen.

---

## 2. Editor structure

Four rail sections: **Build · Action · Style · Settings**.

That **Action is a peer of Build**, not a sub-panel of it, is the most important
structural fact about this product.

### 2.1 Build — `06-editor-on-arrival.png`

1. **Elfsight AI Calculator Generator** card — *"Create a calculator just by
   describing it to the AI in plain language"* + **Generate Calculator**. First
   item in the panel, above all authoring.
2. **FIELDS** — ordered list, per-row overflow menu, **+ Add Field**
3. **CALCULATIONS** — ordered list, per-row overflow menu, **+ Add Calculation**
4. **Header** → · **Results Section** →

### 2.2 Field types — `10-add-field-types.png`

Six, in a 3×2 chooser: **Slider · Number · Dropdown · Choice · Image Choice ·
Heading**. Five inputs plus one structural.

### 2.3 Field model — `07-field-editor-slider.png`

Panel title is the field type.

| Control | Captured value |
| --- | --- |
| Label | Area in Square Meters |
| Hint | rich text — B / I / link / lists / more |
| Min Value | 1 |
| Max Value | 100 |
| Default Value | 50 |
| Slider Step | 1 |
| Format | Number (100 m²) |
| Conditional Logic | Off → |
| **Field ID** | `[area_in_square_meters]` |

Field ID is displayed, snake_cased from the label, bracket-delimited.

### 2.4 Conditional logic — `09-field-conditional-logic.png`

> "Enable Conditional Logic — Set the rules to control the field visibility based
> on values entered in other fields."

A second dependency graph over field values, independent of the formula graph.
Available on fields *and* calculations.

### 2.5 Calculation model — `11-calculation-editor-formula.png`

| Control | Captured value |
| --- | --- |
| Name | Total Cost of Tiles |
| **Formula** | `Area in Square Meters * SUM(Tile Type)` |
| Show in Results | on |
| Rank | **Primary Result** / Secondary Result |
| Format | Currency ($100) |
| Caption | rich text |
| Divider | off |
| Conditional Logic | Off → |
| Field ID | `[total_cost_of_tiles]` |

**Two authoring details that bear on our spec.**

Formulas reference fields by **display label**, not by the bracket Field ID shown
beneath the panel. Renaming a field therefore either breaks its formulas or
requires a rewrite pass — a decision our AST design must make explicitly.

`SUM(Tile Type)` on a dropdown means choice options carry numeric values and
`SUM` aggregates the selection.

Beneath the formula box: *"Need extra features or a custom function? **Submit
your request**"* — the library is fixed and extended by request.

### 2.6 Function library

`MAX · MIN · ROUND · ROUNDUP · ROUNDDOWN · ABS · RAND · RANDBETWEEN · SUM · IF ·
AND · OR · NOT · CONTAINS`

Operators `+ − * / ( ) ^`, plus an **AI formula generator**.

### 2.7 Action — the lead-capture system — `12-rail-action.png`

Mode: **Redirect · Lead Form · No Action**. The captured template defaults to
Lead Form.

- **Heading**, **Caption** (rich text), **Open Form Button Text**
- *"You can set a target action for users to take after they complete the
  calculation."*
- **LEAD FORM FIELDS** — Full Name · Email Address · Phone Number · Estimated
  Budget · Preferred Timeframe · Describe Your Request · How Did You Hear About
  Us? · Consent — each with an overflow menu, plus **+ Add Field**
- **Payment** → · **Submit Button** → · **Email Notifications** → ·
  **Integrations** →

The preview's "Shop Tiles Now" button is not a link. It opens this form.

### 2.8 Integrations — `13-action-integrations.png`

**Google Sheets · Zapier · Make.com · Mailchimp · Webhooks**, plus *"Request
Integration."*

### 2.9 Style — `14-rail-style.png`

**8 field-style presets** in a carousel · **Font** (one, whole widget) ·
**Background** → · four colours: **Text**, **Field Accent**, **Results
Background**, **Action Button**.

No layout axis. No per-role typography. This is why its 116 templates vary by
content rather than structure — there is no structure to vary.

### 2.10 Settings — `15-rail-settings.png`

**Calculator Width** (800px) · **Language** · **Edit Texts** · **Custom CSS** ·
**Custom JS**

---

## 3. Localization is chrome-only

`16-settings-language-list.png`, `17-settings-edit-texts.png`

**Language** is a searchable list with native and English names. **Edit Texts**
opens "Language & Texts" — a list of overridable strings:

> Clear · Download · Results · Calculation Results · Choose file · Print · Drop
> file here · "Please enter a valid (0)" · "This field is required" · "Please
> fill all the fields correctly" · "An error occurred when submitting the form,
> please try again" · "This file cannot be uploaded because the file format is
> unsupported" · "This file cannot be uploaded because file size limit (100 MB)
> is exceeded"

Every one is widget chrome. None is author content.

So: the Language picker swaps built-in strings; field labels, hints, captions and
headings remain in whatever language the author typed. **One instance serves one
language of content.** Five languages means five widgets against the widget cap.

Their "Translated and localized for 76 countries" claim describes this
chrome-string coverage.

---

## 4. Publish lands on the paywall — `18-publish-to-paywall.png`

**Publish** produces no embed code. It redirects to:

```text
/apps/calculator/pricing/single?redirectURL=…installationWidgetPid={widgetId}&headerCloseURL=%2Fapps%2Fcalculator
```

The wall is interposed inside the flow, carrying the widget id so installation
resumes after payment. Build, edit and configure are free; the wall lands at
existence.

---

## 5. Their own feature manifest — `19-paid-plan-feature-manifest.png`

Verbatim from the pricing page, "All paid plans include":

| | |
| --- | --- |
| AI-powered full calculator generator | 8 pre-built styles with custom fonts & colors |
| 6 adaptable fields for building any calculator | Simplify calculations with **hidden formulas** |
| User-friendly formula editor with excel style | **Conditional logic for fields & results** |
| **AI assistant for easy formula generation** | **Post-calculation form for lead capture** |
| Rich function library for complex calculations | Send results and client data to your email |
| **Send calculation details to client** | Translated and localized for 76 countries |
| **Post-calculation action button** | Auto-adapting layout for any device |
| Flexible result organization and structuring | Page-speed friendly lazy loading |
| **Customizable number formatting options** | Tech-free calculator customization |
| **116 ready-made templates** | Custom CSS Editor · Custom JS Editor |

Corroborates the counts above and adds **hidden formulas** — intermediate
calculations excluded from results, mapping to a `showInResults: false` flag.

---

## 6. Templates — `screenshots/templates/`

18 of 116 downloaded as real PNGs from
`universe-static.elfsightcdn.com/widget-thumbnails/{uuid}@2x.png`:

Mortgage · Loan · Construction Price · Event Cost · Interior Design Cost ·
Cleaning Cost · Window Cost · House Renovation Cost · Car Rental Cost · House
Painting Cost · Photography Pricing · Screen Printing · Product Price · Solar
Panel Price · T-Shirt Pricing · Printing Cost · Car Towing Cost · Video
Production Cost.

**This set is not representative.** All 18 are cost and pricing estimators
because the gallery search that produced them is ranked. The 17 consumer
utilities in Fitness & Health are absent from it (§1.4). The remaining ~98 need
paging through the gallery or the picker's own API, which is inside a
cross-origin iframe and unreachable from the parent document.

---

## 7. Not captured

Stated plainly so nothing is mistaken for covered:

- **Header** and **Results Section** disclosures in Build.
- **Payment**, **Submit Button**, **Email Notifications** panels under Action.
- **Background** disclosure under Style; **Custom CSS/JS** editors.
- The **AI Calculator Generator** flow — the card is captured, the generation
  experience is not.
- The **Install** dialog for Calculator specifically. Platform behaviour is in
  `../../planning_Research__Elfsight_Competitive_Breakdown.md` §7.
- **What's New posts.** The list was read in an earlier pass and summarised in
  `Calculator_PRD.md` §0.3. Per the procedure, titles are not findings; the posts
  remain unopened.
- **Request a Feature** — deliberately skipped.

---

## 8. Implications for the PRD

Observations only; rulings belong in `Calculator_PRD.md`.

1. **Their product is a lead-capture form with a calculator attached.** Action is
   one of four rail sections, ships eight prebuilt form fields, and carries
   payment, email notifications and five integrations. Our PRD scopes that out by
   contract and offers three positions in §17.3 — which now rests on direct
   evidence rather than inference from release notes.
2. **AI generation is their first affordance.** Top card in Build, and twice in
   their feature manifest. Our PRD's Path 2 ordering is confirmed as primary, not
   deferred.
3. **Their design surface is thin** — 8 presets, one font, four colours, no
   layout axis, no per-role typography. Our typography system is a real
   advantage; their Custom CSS/JS editors are the admission.
4. **Their localization is chrome-only.** One instance, one content language.
   The sharpest Babel contrast available, now evidenced.
5. **Formulas reference labels, not ids.** Our AST design must decide whether a
   field rename rewrites formulas or is refused.
6. **Conditional logic covers fields and results** and is a paid-plan headline.
   Our PRD defers it entirely — worth re-testing that deferral against this.
