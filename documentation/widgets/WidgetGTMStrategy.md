# Widget GTM Strategy

STATUS: CANONICAL (AI-executable)
OWNER: Product Dev Team + GTM Dev Team
RELATED:
- `documentation/architecture/CONTEXT.md`
- `documentation/widgets/WidgetPraguePagesBuilder.md`
- `documentation/widgets/WidgetBuildContract.md`

---

## 0) Why this exists

This document exists to stop vague marketing copy.

For every widget, AI must produce Prague page content that is:
- simple to read
- concrete
- provably true from code/architecture
- easy to localize

This is not an investor narrative doc.
This is a production copy system for `/widgets/{widget}/overview|templates|examples|features`.

---

## 1) Non-negotiable rules

1. One claim = one proof.
2. If a claim cannot be tied to a system fact, do not use it.
3. Benefits are capabilities, not slogans.
4. Prefer mechanism language over hype language.
5. No invented metrics.
6. Use positive capability framing.

---

## 2) Inputs required before writing copy

Required input set for any widget:

| Input | Source | Why needed |
| --- | --- | --- |
| Widget visitor problem | widget PRD | Core value proposition |
| Widget actions (what it actually does) | widget PRD + `tokyo/widgets/{widgetType}/` | Prevent fake claims |
| Supported layouts and visual range | `spec.json`, `widget.css`, pages | Templates/examples accuracy |
| Localization behavior | `localization.json`, l10n docs/contracts | Correct language claims |
| Embed/runtime behavior | architecture docs + runtime code | Infra claims |
| Curated instance references | `tokyo/widgets/{widgetType}/pages/*.json` | Visual proof on Prague pages |

If any required input is missing, stop and resolve before generating copy.

---

## 3) Canonical Benefit Library

Use this section as the source of truth for Prague copy generation.
These benefits are reusable across widgets.

### 1) DESIGN BENEFITS

What users can visually create, instantly, without code, across every widget.

#### 1.1 Every widget lets users go live instantly by choosing a style - or design from scratch.
- `1.1.1` Users can pick a style and publish in seconds.
- `1.1.2` Power users can start from a blank canvas and design everything.
- `1.1.3` Speed and control are both first-class options, no template trap.

#### 1.2 Every widget offers unprecedented styling depth - without writing any CSS or JS.
- `1.2.1` Users control spacing, layout, surfaces, borders, radius, shadows, and inner components directly in the UI.
- `1.2.2` Styling is not limited to colors or themes, it includes structural control.
- `1.2.3` Custom CSS/JS is unnecessary because the editor is powerful enough.

#### 1.3 Every widget supports unmatched typography control - for every single piece of text.
- `1.3.1` Headings, body text, labels, CTAs, captions, and inline copy are styled independently.
- `1.3.2` Typography is role-based and per-string, not one global font setting.
- `1.3.3` This is critical for brand-driven sites where typography is identity.

#### 1.4 Every widget supports rich inline text formatting - safely.
- `1.4.1` Users can apply bold, italic, underline, strike, and links directly in text fields.
- `1.4.2` Formatting is constrained and safe, so layout and structure remain intact.
- `1.4.3` Rich text behavior is consistent across widgets.

#### 1.5 Every widget can be designed around the pod/stage - not forced into a boxed layout.
- `1.5.1` Widgets can live in heroes, banners, sidebars, dark sections, or full-bleed areas.
- `1.5.2` The container itself is a design surface.
- `1.5.3` Widgets feel native to the page, not bolted on.

#### 1.6 Every widget works across mobile and desktop, all screen sizes and densities - automatically.
- `1.6.1` No breakpoints for users to manage.
- `1.6.2` No responsive CSS for users to write.
- `1.6.3` Mobile, tablet, and desktop work by default.

#### 1.7 Every widget supports light and dark modes out of the box.
- `1.7.1` Widgets adapt to light and dark sections.
- `1.7.2` No duplicate widgets or alternate designs are required.
- `1.7.3` Visual consistency is preserved.

#### 1.8 Every widget can use rich media as part of its design and content.
- `1.8.1` Images, video, and Lottie assets are supported inputs.
- `1.8.2` Motion and media are intentional capabilities, not hacks.
- `1.8.3` High-craft visuals are possible without custom frontend work.

#### 1.STYLE Canonical style catalog (marketable names + short definitions)

Use these names when generating Templates-page copy and style showcases.

Evergreen set:
- `Pure Canvas` - Clean minimal style focused on clarity, whitespace, and readability.
- `Serif Signature` - Editorial look with typographic personality and premium tone.
- `Enterprise Prime` - Structured, trustworthy style for B2B and compliance-heavy brands.
- `Velvet UI` - Soft, refined interface style with gentle depth and modern polish.
- `Studio Modern` - Balanced contemporary system look inspired by product UI patterns.
- `Clarity+` - High-contrast accessibility-first style prioritizing legibility and navigation.

Trend-forward set:
- `Liquid Glass` - Frosted/translucent surfaces with blur and layered depth.
- `Rebel Blocks` - Bold neo-brutal visual language with hard contrast and strong hierarchy.
- `Soft Pop 3D` - Playful clay-like style with rounded forms and tactile depth.
- `Midnight Luxe` - Dark premium aesthetic with restrained highlights and strong contrast.
- `Chrome Wave` - Y2K-inspired metallic energy with glossy accents and high shine.
- `Neon Aura` - Gradient-led glow style for expressive, high-energy visual identity.

#### ICP.CATALOG Canonical ICP list (and why they benefit from Clickeen)

Why these ICPs:
- They serve high visitor traffic with repeated questions.
- They often need multilingual coverage.
- They update operational content frequently and need publish speed.
- They benefit from strong visual control without custom frontend work.

ICP list:
- `Hotels & Resorts` - Frequent guest questions across many locales; publish-once updates keep every placement aligned.
- `Vacation Rentals & Property Managers` - Repeated check-in and property rules across listings; one workflow scales cleanly.
- `Restaurants, Cafes & Bars` - Menu, allergen, and hours questions need fast mobile answers for local and tourist audiences.
- `Tour Operators & Travel Agencies` - Pickup, policy, and itinerary clarity in multiple languages improves booking confidence.
- `Attractions, Museums & Theme Parks` - High-volume visitor logistics benefit from consistent, localized answers.
- `Event Venues & Ticketed Experiences` - Event details change often; instant publish propagation prevents stale information.
- `Spas, Wellness & Aesthetic Clinics` - Trust-heavy service questions benefit from branded presentation and clear localized copy.
- `Transportation & Mobility Services` - Timing and baggage rules require reliable, always-current on-page guidance.
- `Cruise & Shore Excursion Providers` - Global traveler mix demands multilingual, high-clarity pre-book information.
- `Destination Services (DMC, local concierge)` - Multi-market service catalogs need composable style/content/language control.
- `E-commerce Brands (cross-border)` - Shipping, returns, and duties content changes often across regions and languages.
- `SaaS & Digital Products (global self-serve)` - Product onboarding and support copy must stay synchronized across locales.
- `Education & Training Providers (international audiences)` - Admissions and course policy clarity benefits from predictable multilingual UX.
- `Professional Services (legal, finance, consulting)` - Regulated trust contexts require precise copy and brand-consistent presentation.

### 2) PLATFORM / INFRA + AI BENEFITS

What makes widgets installable, scalable, intelligent, and safe.

#### 2.1 Every widget provides multiple embed options so it works on any website.
- `2.1.1` Recommended embed for most sites.
- `2.1.2` Scriptless iframe embed for restrictive builders.
- `2.1.3` Works on WordPress, Webflow, Shopify, site builders, and custom stacks.

#### 2.2 Every widget works on modern websites that behave like apps.
- `2.2.1` Pages that update without reloads still render widgets correctly.
- `2.2.2` Widgets do not disappear or duplicate during navigation.
- `2.2.3` No engineering is required to fix embeds.

#### 2.3 Every widget updates everywhere with one click.
- `2.3.1` Edit once, then click Publish.
- `2.3.2` The update propagates instantly to every placement.
- `2.3.3` No re-embedding and no redeploying.

#### 2.4 Every widget loads fast globally by default.
- `2.4.1` Served from edge infrastructure worldwide.
- `2.4.2` No CDN configuration required by users.
- `2.4.3` Performance is a default property.

#### 2.5 Clickeen does not require custom CSS or custom JS, because users do not need escape hatches.
- `2.5.1` Competing tools often rely on pasted CSS/JS to patch limitations.
- `2.5.2` Clickeen puts capability into the core system.
- `2.5.3` Users stay productive and safe in product-native workflows.

#### 2.AI.0 In Clickeen, AI helps, but users always stay in control.
- `2.AI.0.1` AI suggests and assists; it never silently changes live widgets.
- `2.AI.0.2` Every AI output can be accepted, edited, overridden, or rejected.
- `2.AI.0.3` Nothing publishes automatically; users decide.

#### 2.AI.1 Every widget can use Ombra AI, purpose-built for widget content.
- `2.AI.1.1` Ombra generates structured, UI-ready copy, not chat responses.
- `2.AI.1.2` Suggestions appear directly where users edit.
- `2.AI.1.3` AI assists and users decide.

#### 2.AI.2 Every widget can run on the best LLM for the job.
- `2.AI.2.1` Cost-effective models for scale.
- `2.AI.2.2` High-quality models for precision.
- `2.AI.2.3` No lock-in to a single model or tone.

#### 2.AI.3 Clickeen is AI-native, not AI-bolted-on.
- `2.AI.3.1` AI is embedded in creation, editing, publishing, and localization.
- `2.AI.3.2` AI understands context: widget type, field intent, language, and placement.
- `2.AI.3.3` AI respects publish boundaries and user intent.

### 3) LOCALIZATION BENEFITS

Global by default.

#### 3.1 Every widget ships with up to 29 languages out of the box.
- `3.1.1` Multilingual support is immediate.
- `3.1.2` No duplicate widgets per language.
- `3.1.3` Global readiness is default.

#### 3.2 One content change updates every language and every placement.
- `3.2.1` Edit once, then Publish.
- `3.2.2` All languages stay in sync automatically.
- `3.2.3` No manual translation management.

#### 3.3 Localization is AI-driven and intent-aware, not literal machine translation.
- `3.3.1` Translations preserve meaning, tone, and CTA strength.
- `3.3.2` Translations are optimized for real UI usage and GEO friendliness.
- `3.3.3` Output feels native in each language.

#### 3.4 Users can override any translation instantly, while keeping system coherence.
- `3.4.1` Brand terms and local nuance are easy to adjust.
- `3.4.2` Overrides do not fork widgets or languages.
- `3.4.3` Users can revert to AI-generated translation at any time.

#### 3.5 Styles, content, and language are fully composable.
- `3.5.1` Any style works with any content in any language.
- `3.5.2` No design-language forks are required.
- `3.5.3` Composability is what allows clean scale to hundreds of widgets.

---

## 4) Metric claim policy (important)

We can use hard numbers, but only with evidence.

Allowed:
- "Edge delivery by default" (no number)
- "X ms p95" only if metric source is explicitly available and dated

Required format for numeric claims:
- `<claim> (<metric>, <date>, <source>)`
- Example: `Median widget load 82ms (2026-02-10, cloud-dev smoke run #123)`

If no verified metric exists, keep the claim non-numeric.

---

## 5) Widget-specific benefit extraction (per widget)

For each widget, define 3 to 5 widget-specific truths in this format:

| Field | Required content |
| --- | --- |
| `benefit_id` | Stable key, e.g. `faq.answer_on_page` |
| `claim_line` | 3-8 words, direct |
| `visitor_problem` | Real on-page problem |
| `widget_action` | What widget does in UI/runtime |
| `visible_result` | What visitor/user can observe |
| `proof_anchor` | PRD section, file path, or known UI behavior |

Example (FAQ):
- `claim_line`: "Answer questions on-page"
- `widget_action`: "Renders expandable Q/A sections"
- `visible_result`: "Visitor gets answer without leaving page"

---

## 6) How to distribute claims across the 4 Prague pages

### Overview (`/widgets/{widget}`)
Question answered: "What is this and why should I care?"

Use mix:
- 2 widget-specific claims
- 2 platform/infra claims from section `2`
- 1 localization claim from section `3`
- 1 AI control claim from section `2.AI`

Must include:
- one immediate proof block (`minibob` and/or curated embed)
- one localization proof block (`locale-showcase`)

### Templates (`/widgets/{widget}/templates`)
Question answered: "Will this match my brand?"

Use mix:
- mostly design claims from section `1`
- one short platform claim from section `2` (optional)

Must show:
- visual range (modern + classic)
- control depth (layout, appearance, typography)

### Examples (`/widgets/{widget}/examples`)
Question answered: "Will this work for my business case?"

Use mix:
- scenario-first, not feature-first
- each example maps: context -> widget action -> visible result
- each scenario should pull one relevant design/platform/localization claim from section `1/2/3`

Do not write abstract benefit slogans here.

### Features (`/widgets/{widget}/features`)
Question answered: "Why is this better engineered?"

Use mix:
- mechanism-heavy copy
- claim + proof cadence
- include technical language only when accurate (`SSR`, `JSON-LD`, `publish-gated`, `allowlist`, `edge`)

---

## 7) Copy style that localizes well

Localization quality improves when source copy is clean.

Rules:
1. One idea per sentence.
2. Keep idioms out of body copy.
3. Keep syntax simple in subtitles and feature bodies.
4. Prefer concrete nouns and verbs.
5. Avoid stacked metaphors and slang.

---

## 8) Output package expected from AI

For each widget, AI should produce:

1. A short `claim bank`:
- 3-5 widget-specific claims
- selected claims from sections `1`, `2`, `2.AI`, and `3`
- proof anchor for each claim

2. Four page copy maps:
- Overview
- Templates
- Examples
- Features

2.1 For `Examples`, include:
- selected ICP names from `ICP.CATALOG`
- one-line rationale per selected ICP for why Clickeen is a strong fit
- scenario mapping (`context -> widget action -> visible result`)

3. Final page JSON content for:
- `tokyo/widgets/{widgetType}/pages/overview.json`
- `tokyo/widgets/{widgetType}/pages/templates.json`
- `tokyo/widgets/{widgetType}/pages/examples.json`
- `tokyo/widgets/{widgetType}/pages/features.json`

4. A brief validation note:
- Which claims are numeric vs non-numeric
- Any claim intentionally excluded because proof was missing

---

## 9) Definition of done for GTM copy quality

The result is ready only if all are true:

1. Copy is direct and non-generic.
2. Every important claim maps to a known system fact.
3. Wording is capability-first and mechanism-backed.
4. Localization-safe writing style is respected.
5. The four pages have distinct jobs (no duplicated narrative).
6. Another AI can regenerate consistent pages using this doc without inventing benefits.
