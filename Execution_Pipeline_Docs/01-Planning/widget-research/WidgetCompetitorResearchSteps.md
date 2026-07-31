# Widget Competitor Research Steps

STATUS: PROCEDURE — ordered, gated. Follow it in order.

Written 2026-07-31 after the Calculator research pass, which took eight rounds of
correction because it was done out of order. Every step below exists because
skipping it produced a wrong conclusion that reached a committed document.

Surfaces are named for Elfsight (`dash.elfsight.com`). The ordering and the
evidence rules generalise to any competitor.

---

## Why this exists

The Calculator pass produced, and committed, these errors:

| Error | Cause |
| --- | --- |
| Missed the template picker entirely — 116 templates, categories, live preview | Only ever clicked **Edit** on an existing widget; never once clicked **Create** |
| Missed Stripe payments, Mailchimp, Make.com, autoresponders, PDF export, reCAPTCHA | Never opened the **What's New** tab |
| Described those features wrongly once found | Read changelog **titles**, not the linked posts |
| Claimed they ship no consumer-utility calculators | Searched the gallery, got cost estimators, generalised from one biased sample |
| Nearly generalised "templates are pure data" to all widgets | True for Calculator, false for Event Calendar and Google Reviews |
| Missed Download Responses in CSV, Share by Link, Hide from Website | Never opened the widget card's overflow menu |
| Wrote a starter library with the wrong products in it | Designed it before seeing the competitor's category split |

Each is an ordering failure, not an intelligence failure. Hence a fixed order.

---

## Stop conditions

Stop and report rather than guess if:

- the account has no free slot and you have no authorisation to delete an instance;
- a surface requires payment to reach;
- a claim you want to make rests on a title, a thumbnail, or one sample;
- you find yourself researching a widget other than the one you were asked about.

---

## Step 0 — Scope and account state

1. Name the **one** widget under research. Write it down. Do not open another
   widget's editor until its document is committed.
2. Record account state: which apps exist, each app's plan badge, and each app's
   `WIDGETS n/n` and `VIEWS n/n` meters with the reset date.
3. Confirm you have a free widget slot, or authorisation to delete an instance.
   The creation flow in Step 2 is unreachable at the cap.

Gate: the target widget is named and a slot is available.

---

## Step 1 — The app surface, before any editor

At `dash.elfsight.com/apps/{app}`:

1. **The app header** — plan badge, primary CTA (Select Plan vs Upgrade), meters.
2. **All three tabs.** Widgets, **Request a Feature**, **What's New**. Do not
   skip the last two; they are Steps 5 and 6.
3. **The widget card overflow menu (`…`).** It carries surface that appears
   nowhere else. On Calculator it held Embed Code, Share by Link, **Download
   Responses in CSV**, Remove Branding (upgrade-gated), Duplicate, Rename, Hide
   from Website, Delete.
4. **The empty state.** Delete down to zero if authorised. The empty state copy
   states the intended entry paths in the vendor's own words.

Gate: every tab opened, overflow menu read, empty state captured.

---

## Step 2 — The creation flow

**This is the step that was skipped. Do it before opening any editor.**

1. Click **Create Widget** from the app page.
2. Record what appears *before* the editor. For Elfsight this is a full-screen
   **Choose a Template** step, not an editor.
3. In that step capture:
   - the **total count** — the grid pagination reads e.g. "1 – 4 of 116";
   - the **categories and their counts** — Calculator: Cost 32, Finance 30,
     Fitness & Health 17, Mortgage & Loan 16, Other 21;
   - whether the preview is **live and interactive** or a static image;
   - the commit control and its label.
4. Complete the flow. Record what the editor looks like **on arrival** — is it
   populated or empty?

Gate: the count, the categories, and the pre-editor step are recorded.

Note: if creation is blocked by the plan cap, that block is itself a finding —
record *where* the limit is enforced (creation vs save vs publish).

---

## Step 3 — The template system

1. Sample templates **across every category**, not just the first page. Minimum
   one per category, more where categories differ in kind.
2. For each, record: field/content set, result/output set, colour treatment, copy,
   and **layout**.
3. Answer explicitly: **what varies, and what does not?**
4. Cross-check the widget's own layout options. The observed rule is that
   **template variety tracks layout capability**:

   | Widget | Layout options | Templates vary by |
   | --- | --- | --- |
   | Calculator | none | content only |
   | Event Calendar | 8 | structure |
   | Google Reviews | 6+ | structure |

   Do not carry a finding about one widget's templates into another's document.
5. Check the cross-app gallery at `/templates` for scale and taxonomy, but do
   **not** substitute a gallery keyword search for the in-app picker. The search
   is ranked and biased; the picker is complete. That substitution produced the
   "no consumer utilities" error.

Gate: the varies / does-not-vary table is written, with the sample list behind it.

---

## Step 4 — The editor, exhaustively

1. Walk **every** rail section. Record the section names — they reveal the
   vendor's own model (Calculator's rail is Build / Action / Style / Settings,
   which makes the CTA a first-class object, not part of results).
2. In each panel, open **every** disclosure, dropdown, carousel, and colour
   picker. Record option counts and exact values.
3. **Select each enum value** and record which controls appear and disappear.
   Conditional control sets are a major part of the design and are invisible
   otherwise.
4. Drill into repeating items — open a row, then a sub-row. Record per-item
   fields and any author-visible identifier tokens.
5. Record the escape hatches (Custom CSS / Custom JS) and any copy around them.
6. Count the controls. State the number.

Gate: a complete control inventory exists with counts, and every conditional
branch has been triggered at least once.

---

## Step 5 — What's New (the changelog)

**Never skip, and never read only the titles.**

1. Open the app's **What's New** tab. Record every entry with its date and its
   kind (New / Improved / Fixed).
2. Note the **view counts**. They rank what customers care about. Calculator's
   most-read entry by 10× was "Accept payments via Stripe Integration."
3. **Open the posts.** Entries link to community threads containing the actual
   mechanism, and often a postmortem. Reading titles alone produced a wrong
   product model that had to be rewritten.
4. Pay attention to the **title prefix**. "Forms: Google reCAPTCHA is required
   now" appearing in the Calculator changelog is how you learn the vendor
   classifies Calculator as a Form app.
5. Fixed entries are as informative as New ones — they name components that exist
   ("Lead Form", "mail tags", "hidden fields", "print docs").

Gate: every entry from the last 12 months listed; every New entry's post read.

---

## Step 6 — Demand signals

1. Open **Request a Feature**. This is what customers are asking for and the
   vendor has not built — the clearest available read on their roadmap gaps.
2. Note any in-product prompts that crowdsource the roadmap. Elfsight embeds
   "Request a Feature" inside the Custom CSS panel, and "find the CSS you need on
   our forum" beside it.

Gate: the top requests are recorded.

---

## Step 7 — Install and serving

1. From an app **with a plan selected**, click **Install**. Capture the embed
   snippet verbatim.
2. Record the delivery model: script host, whether content is in the markup, how
   the instance is addressed, and any lazy or deferred loading attribute.
3. Record the other install tabs (Share Link, Request Installation) and any
   platform-tutorial surface.
4. From an app **without** a plan, click Install. Record where the paywall sits
   in the flow and what the redirect carries.

Gate: the embed snippet is captured verbatim.

---

## Step 8 — Pricing and limits

1. Both pricing tabs — single app and bundle. Record every tier, every limit, and
   which features are struck through per tier.
2. Record which axis is metered (views, widgets, projects, collaborators).
3. Test where each limit is **enforced** — creation, save, or publish. These
   differ and the difference is a product decision.

Gate: a tier table exists and can be diffed against
`packages/ck-policy/entitlements.matrix.json`.

---

## Step 9 — Cross-check against Clickeen

Do not diff a competitor against memory of our own product.

1. Read our widget source, or task an agent to inventory it — `spec.json`,
   `editable-fields.json`, `limits.json`, `widget.html`, `widget.css`,
   `widget.client.js`.
2. Use **composed** control counts as the Builder renders them, not `spec.json`
   declarations. FAQ declares 36 and renders 233.
3. Check the folder for existing research before writing. `widget-research/`
   already contains PRDs, competitor analyses, and saved assets, and prior docs
   may be stale in ways worth recording.

Gate: our side is read from source, not recalled.

---

## Evidence rules

- **A title is not a finding.** Open the thing.
- **A thumbnail is not a layout.** Load the live preview.
- **One sample is not a pattern.** State your sample size in the document.
- **A keyword search is a biased sample.** Prefer the complete in-product list.
- Quote the vendor verbatim when the wording carries the finding.
- Separate **Verified** from **Inferred** in the write-up, and list what you did
  not read so nobody mistakes it for covered.
- Record the date. Elfsight has redesigned at least once under this repo's nose —
  `Countdown_competitoranalysis.md` describes a five-tab editor that no longer
  exists.

---

## Anti-patterns

| Do not | Instead |
| --- | --- |
| Open the editor first | Step 2 before Step 4, always |
| Read a changelog list | Open the posts |
| Generalise one widget's template behaviour | Re-test per widget (Step 3.4) |
| Design our starter library before seeing theirs | Step 3 before writing scope |
| Research a second widget mid-pass | Finish and commit the first |
| Write "they don't have X" from a search | Confirm against the complete list |

---

## Output

Per widget, in `widget-research/{Widget}/`:

- `{Widget}_competitoranalysis.md` — discovery, in the competitor's vocabulary.
- `{Widget}_PRD.md` — the arbiter, in Clickeen's vocabulary. This is where the
  build spec lives: Core Manifest, state, panels using real Bob control types,
  Binding Map, entitlements, delivery steps.

The CA proposes; the PRD rules. Countdown is the precedent — its CA's `theme.*`,
`position.*`, and `settings.customCSS` trees were all rejected when its PRD was
written.

Screenshots per `ElfsightCaptureManifest.md`.
