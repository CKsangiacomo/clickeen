# Calculator — Competitor Analysis And Build Considerations

Status: PRIMARY-SOURCE COMPETITIVE RESEARCH (2026-07-31)
Type: Research. Defines no scope and authorizes no build. Clickeen has no
calculator widget today.

## Method

Live authenticated Elfsight account driven in-browser on 2026-07-31. The
Calculator editor was opened, the Build panel walked, and both a field editor and
a calculation editor opened and read in full. The sample instance was a mortgage
calculator.

Editor chrome rendered in the account's UI language; control semantics were read
from structure, values, and the live preview.

## Part 0 — Read this first: this is a different widget class

Every Clickeen widget today is **render-only**. Content goes in at author time,
HTML comes out, the visitor reads it. No visitor input, no state, no computation.

A calculator inverts that. The visitor supplies input, the widget computes, and
the output is a function of what the visitor typed. The widget is a small
application.

**The good news: this fits Clickeen's serving model better than reviews do.**

Unlike Google Reviews, a calculator has **no external data dependency**. The
fields, the formulas, and the formatting are all authored. They can be
materialized into `runtime.js` at save exactly like any other widget, and the
evaluation happens client-side in the visitor's browser. No refresh job, no
connector, no staleness policy, no API quota.

So the architectural cost is not in serving. It is in the **authoring surface**:
Clickeen would need a formula language, an expression evaluator, a dependency
graph between fields and calculations, and conditional logic — none of which
exist. That is real engineering, but it is self-contained and it does not
challenge any existing tenet.

## Part 1 — What Elfsight ships

**Editor shape:** four rail sections — Build, (design), (style), Settings — plus
panel and live preview.

### Build panel

Top of the panel, before anything else:

> **Elfsight AI Calculator Generator** — "Tell AI what you need and it will
> create a working calculator." → **Create calculator** button.

AI generation of the entire calculator from a natural-language prompt is
positioned as the primary entry point, above the manual builder.

Below it, two ordered lists and two disclosures:

| Section | Contents |
| --- | --- |
| **Fields** | Loan Amount · Interest Rate · Loan Period, each with an overflow menu, plus **+ Add field** |
| **Calculations** | Monthly Payment · Total Interest Paid, each marked with an `F` (formula) badge, plus **+ Add calculation** |
| Header | disclosure |
| Results section | disclosure |

### Field editor

Opened on "Loan Amount", whose type is **Slider**:

| Control | Value observed |
| --- | --- |
| Label | "Loan Amount" |
| Info / helper text | "Enter the total loan amount you want to borrow" — **rich text** with a formatting toolbar |
| Minimum value | 100000 |
| Maximum value | 5000000 |
| Default value | 500000 |
| Slider step | 50000 |
| Format | **Currency ($100)** |
| **Conditional logic** | Off — disclosure |
| **Field ID** | `[loan_amount]` |

The field ID is exposed to the author because it is the token formulas reference.
Slider is one field type; the "Add field" flow presumably offers others (number,
dropdown, toggle, date) — not enumerated during this pass.

The rendered field is a combined **text input + slider** with the min and max
printed beneath and the helper text below that.

### Calculation editor

Opened on "Monthly Payment":

| Control | Value observed |
| --- | --- |
| Name | "Monthly Payment" |
| **Formula** | `(Loan Amount*Interest Rate/(12*100))/(1-(1+Interest Rate/(12*100))^ (-12*Loan Period))` |
| Show in results | toggle, on |
| Result rank | segmented — **Primary result** · Secondary result |
| Format | Currency ($100) |
| Caption | "This is an approximate monthly repayment amount for your mortgage based on the given inputs." — **rich text** |
| Divider | toggle, on |
| Conditional logic | Off — disclosure |
| **Field ID** | `[monthly_payment]` |

The formula editor carries three insert menus — **Fields**, **Calculations**,
**Functions** — an operator row (`+` `-` `*` `/` `(` `)` `^`), and a **Create with
AI** action.

Two things follow from that formula:

- **Exponentiation is supported** (`^` with a negative exponent), so the
  expression language is not toy arithmetic. The sample is a real amortization
  formula.
- **Calculations can reference other calculations**, not just fields — the
  Calculations insert menu exists alongside Fields, and each calculation has its
  own `[field_id]`.

Below the formula editor, a link: *"Learn about creating formulas and functions
in our guide. Need additional features or custom functions? Submit your
request."* — so the function library is fixed and extended by request, the same
crowdsourced-roadmap pattern seen in their FAQ Custom CSS panel.

### Rendered output

The preview shows the full product shape:

- Title: "Mortgage Calculator"
- Left column: three input fields with sliders, values, ranges, helper text
- Right column, a results card:
  - **Primary result** — "Monthly Payment", `$2,684`, large type, with its caption
  - Divider
  - **Secondary result** — "Total Interest Paid", `$466,279`, smaller, with caption
  - A CTA block: "Ready to get started? Get in touch with our mortgage advisors
    for personalized advice!" and a **Book a Meeting** button

That CTA block is the commercial point of the whole widget. A calculator is a
lead-generation surface: the visitor invests effort, sees a number that matters
to them, and is asked to talk to someone at exactly that moment.

## Part 2 — What building this in Clickeen would require

### Does not exist anywhere in Clickeen

| Capability | Notes |
| --- | --- |
| **Visitor input handling** | No current widget accepts input. Needs input state, validation, and re-render on change. |
| **Expression language + evaluator** | Parse and evaluate author-written formulas safely at runtime. Must not be `eval`. |
| **Dependency graph** | Calculations reference fields and other calculations; needs topological evaluation and cycle detection. |
| **Number formatting** | Currency, percent, decimal precision, locale-aware separators. |
| **Conditional logic** | Present on both fields and calculations — show/hide based on other values. |
| **A function library** | Elfsight ships one and extends it by request. Scope is a product decision. |
| **Stable author-visible IDs** | `[loan_amount]` tokens. Clickeen has stable ids internally (`faq.sections[].id`) but never exposes them to authors as reference tokens. |

### Exists and would transfer

Typography, fill/border/shadow/radius, stage and pod, locale switcher, social
share, entitlement gating, and the whole materialization path. A calculator's
presentation layer is ordinary Clickeen widget work — Clickeen's 213–233 control
surface would make it far better-looking than Elfsight's.

Translation transfers cleanly too: field labels, helper text, calculation names,
captions, and CTA copy are all authored strings and fit the existing overlay
model exactly. Formulas and field IDs must **not** be translatable — the same
distinction `editable-fields.json` already draws.

### Where Clickeen is structurally advantaged

**AI generation maps onto the agent plane.** Elfsight's "Create calculator" and
"Create with AI" are model calls producing a structured artifact. Clickeen has
San Francisco for governed execution and agent homes for reasoning. Generating a
calculator spec — fields with types and ranges, formulas, formatting, captions —
is a structured-output task against a schema Clickeen would already own. This is
the single best fit between an Elfsight feature and Clickeen's existing
architecture found in this entire research pass.

**Crawlable output still applies, partly.** The computed result is
visitor-specific and not indexable, but the title, field labels, helper text,
captions, and CTA are authored content that would appear in Clickeen's served
HTML and not in Elfsight's empty div.

## Part 3 — Product observations

**Calculators are lead-generation, not content.** The result card's CTA is the
product. This is the first widget in this research where the conversion mechanic
is inseparable from the widget's purpose — which makes the CTA surface a
first-class design concern rather than an add-on.

**The field-type set is the scope dial.** Slider alone covers a large share of
real calculators (mortgage, loan, savings, ROI, pricing). Adding dropdown and
number covers most of the rest. The formula engine is the fixed cost; field types
are incremental.

**Primary versus secondary results is a small idea worth copying.** It gives the
author a way to say which number matters, and it drives the visual hierarchy of
the result card automatically.

**A function library is an open-ended commitment.** Elfsight manages it by
shipping a fixed set and taking requests. Whatever Clickeen ships becomes a
compatibility surface — formulas authored against it must keep evaluating.

**This is the most self-contained of the three unbuilt widgets.** No connector,
no refresh, no external quota, no staleness. Compared to Google Reviews it is
almost entirely local work.

## Part 4 — Open questions for the team

Not decisions.

1. **What is the expression language?** A safe evaluator is required; the scope
   of operators and functions is a product decision with long-term compatibility
   consequences.
2. **Which field types ship?** Slider only, or slider plus number plus dropdown?
3. **How is conditional logic expressed** in a way an agent can author and a
   materializer can serialize?
4. **Does the AI generator ship with it or after it?** It is Elfsight's primary
   entry point, and it is the piece Clickeen is best equipped to build — but it
   needs the schema to exist first.
5. **What is the CTA/lead surface?** A link is the minimum. A form implies
   submission storage, which is a much larger commitment and a new data class.
6. **Are results shareable or persistable?** A URL that reproduces a computed
   result is a distribution mechanic; it also implies encoding input state into
   the address.
