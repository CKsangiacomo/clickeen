# Widget Prague Pages Builder

**Purpose:** The canonical build spec for generating Prague Marketing Pages for any Clickeen widget. This is a construction manual—it defines inputs, constraints, and output blocks. It is not a positioning brainstorm, a creative writing exercise, or a strategy document.

> [!IMPORTANT]
> **Golden Rule:** The Builder is an **Executor**, not a Strategist.
> Every claim must be supported by the widget’s approved PRD (`[Widget]_PRD.md`) or by the platform truths below. Do not invent features. Do not improvise.

---

## Step 1: Extract Certified Inputs (The Constraints)

You must extract the following variables from the approved PRD (`[Widget]_PRD.md`). These are mandatory inputs. If an input is missing or unclear in the PRD, stop and resolve it—**do not guess**.

### 1A. Platform Truths (Constant)
These are the only universal benefits you may assume across all widgets:
*   **Great Design:** Templates, customization, polish.
*   **One-Click Install:** Zero-input setup, URL extraction.
*   **Modern Infra:** Edge hosting, LCP-safe delivery, SEO-native.
*   **AI Copilot (Ombra):** Auto-writing, auto-translation.

### 1B. Copy Principles (Non-Negotiable Standard)
*   **No SaaS Clichés:** Ever. Ban words like: "Boost trust", "Reduce support", "Optimize", "Empower", "Leverage", "Revolutionize", "Scalable", "Seamlessly".
*   **Terminology Mandate:** Always call the end-user a **website visitor**. These widgets live on real websites.
*   **Technical Truth Only:** If it’s not in the PRD, don’t claim it. Safe phrasing: "Pixel-perfect control" / "Matches your brand through deep customization."
*   **Design Philosophy:** Clickeen does not inherit the site’s CSS. We ship a curated design system. The real depth lives in the **Appearance Panel** (Shadows, Borders, Surface Styles, Corner Radius).
*   **Write Sensations, Not Metrics:** Describe what it looks like, feels like, or what happens—not corporate outcomes.
*   **Confidence:** Short, punchy sentences. Category-leader tone.
*   **Technical Proof:** Prefer specific technical terms when mentioning SEO/performance: **JSON-LD**, **Schema.org**, **SSR (Server Side Rendering)**, **Indexable**, **Core Web Vitals**.

### 1C. Widget-Specific Inputs (Mandatory Extraction)
Extract these verbatim from the PRD and code references specified:
*   **[Industry List]:** PRD Section C
*   **[Primary Value Prop]:** The exact "Operational Problem" or "Visitor Need"
*   **[Widget Actions]:** The specific automated actions performed
*   **[Target Outcomes]:** The concrete result for business or website visitor
*   **[Layout Types]:** Supported layouts from `widget.css`
*   **[Style Range]:** Supported visual variants from `widget.css`

---

## Step 2: Construct Overview Page (`/`)

**Purpose:** The Overview page is the category anchor for a widget. It defines what the widget is, why it exists, and why Clickeen is the authority—without relying on testimonials, metrics, or abstract claims.

### Block 1: `hero` — The Definition
*   **Strategic Goal:** Define the widget by balancing **Aesthetic Quality** with **Core Benefit**.
*   **Copy Strategy:**
    *   **Headline:** Must juxtapose *how it looks* (aesthetic) with *what it delivers* (benefit). The benefit must be tangible, not abstract.
    *   **Subhead:** Frame the widget as a premium upgrade the user's site *deserves*, then immediately promise **Operational Relief** (describe the work that disappears).
*   **Creative Scope:** HIGH (synthesis of form and function).

### Block 2: `minibob` — The Template
*   **Strategic Goal:** Prove the "One-Click Install" promise.
*   **Copy Strategy:**
    *   **Headline:** "Watch your [Widget Name] build itself." (Fixed Formula).
    *   **Subhead:** "Enter your website URL and we'll [Widget Action] instantly." (Fixed Formula).
    *   **Constraint:** The only variable is the valid [Widget Action] from the PRD. Do not invent new verbs.
*   **Creative Scope:** ZERO (Templated Truth).

### Block 3: `subpage-cards` — The Map
*   **Goal:** Orient the visitor. Show what depth exists.
*   **Fixed Headline:** "Everything you need to build the perfect [Widget Name]"
*   **Card Strategies:**
    *   **Card 1 (Templates):** "Find your look". **Variable Body:** Must list specific [Layout Types] from PRD (e.g., "Grid, Carousel, or List") and promise "Native Fit".
    *   **Card 2 (Examples):** "See the results". **Fixed Body:** "From boutique hotels to high-volume retailers, see how businesses use [Widget Name] to [Target Outcomes]."
    *   **Card 3 (Features):** "Unlock the power". **Fixed Body:** "Go beyond the basics with enterprise-grade power. Deep dive into Ombra AI editing, instant localization, and our SEO-native architecture."
*   **Creative Scope:** LOW (Only Card 1 and [Variables] change).

### Block 4: `locale-showcase` — Global Proof
*   **Strategic Goal:** Establish global readiness as a default.
*   **Copy Strategy:**
    *   **Headline:** Aspirational idiom or universal truth about global reach.
    *   **Subhead:** Promise "Native" communication for every visitor.
*   **Reference Copy (Paraphrase from this):**
    *   *Headline:* "The world is your oyster."
    *   *Subhead:* "Welcome every website visitor like a local. Instant, natural translations for a global audience."
*   **Creative Scope:** MEDIUM (Paraphrasing Encouraged).
    *   *Constraint:* You MUST vary the phrasing per widget. Find a fresh angle on "global" that fits the widget's utility.

### Block 5: `steps` — The Value Loop (Widget Specific)
*   **Strategic Goal:** Explain the specific algorithmic value of *this* widget.
*   **Strategy:** You must construct a logical loop: **Trigger → Action → Result**.
    *   **Step 1 (The Trigger):** The problem or event on the site that initiates the need.
    *   **Step 2 (The Action):** What the widget *physically* does to intervene.
    *   **Step 3 (The Result):** The operational relief or business outcome generated.
*   **Creative Scope:** MEDIUM (Must synthesize PRD logic).
    *   *Constraint:* Do not use generic headers like "Step 1". Use active verb headers.

### Block 6: `split` (Visual Right) — Absolute Design Control
*   **Strategic Goal:** Prove that the user has granular control over every visual property (Radius, Shadow, Typography).
*   **Copy Strategy:**
    *   **Headline:** Assert "Your Design, Your Rules". Focus on the power to create *any* aesthetic.
    *   **Subhead:** List the specific controls (Shadows, Borders, Spacing) to prove depth.
    *   **Constraint:** Do NOT use words like "Native Match" or "Inherits" (implies magic/CSS). Do NOT use "Custom CSS" (we don't support it). Use "Visual Editor" or "No-Code Control".
*   **Creative Scope:** HIGH (Empowerment).

### Block 7: `big-bang` — The Substantiated Dream
*   **Goal:** State the aspirational outcome and justify it technically.
*   **Rule:** Back every dream with Widget Actions, Style Range, Ombra AI, and Global Performance.
*   **Creative Scope:** HIGH (but provable)

### Block 8: `global-moat` — Platform Proof
*   **Goal:** Recap why this only exists on Clickeen.
*   **Pillars:** AI Precision (Ombra), Global by Default (Auto-Translation), SEO-Native (JSON-LD).
*   **Creative Scope:** LOW

### Block 9: `platform-strip` — Enterprise Baseline
*   **Goal:** Reassure without selling.
*   **Descriptors:** Global Scale, Enterprise Privacy, Zero-Configuration.
*   **Creative Scope:** LOW

### Block 10: `cta-bottom-block` — Conversion
*   **Goal:** Action without hype.
*   **Rule:** Benefit-driven, not urgency-driven.
*   **Creative Scope:** MEDIUM (constrained)

---

## Step 3: Construct Templates Page (`/templates`)

**Purpose:** A celebration of visual variety. Proves that the "Sky is the limit" for design. The page must feel like a candy store of styles—from trending modern looks to timeless classics.

### Block 1: `hero` — The "Infinite Vibes" Carousel
*   **Goal:** Immediately prove visual versatility.
*   **Content:**
    *   **Headline:** "One widget, infinite vibes." (or similar variant emphasizing range)
    *   **Subhead:** "From trending [Style A] to timeless [Style B]. Switch styles instantly without touching content."
    *   **Visual:** **MANDATORY CAROUSEL**.
        *   Do not use a static image.
        *   Pass an `items` array to the `hero` block in JSON.
        *   Include 4 distinct variants (e.g., Glassmorphism, Minimal, Bold, Neo-Brutalism).
        *   This triggers the auto-playing, dot-navigable carousel mode.
*   **Why:** Users think widgets look "one way." This hero smashes that objection in the first 3 seconds.

### Block 2: `split-carousel` (Visual Left) — Trending & Modern
*   **Goal:** Show off what is "Hot" right now. (e.g., Glassmorphism, Bold Typography, Pop colors).
*   **Visual:** **MANDATORY CAROUSEL**.
    *   Use `split-carousel` block type.
    *   Layout must be `visual-left`.
    *   Showcase 3-4 trending variants.
*   **Tone:** Exciting, fresh, "Now".
*   **Creative Scope:** HIGH

### Block 3: `split` (Visual Right) — Classic & Timeless
*   **Goal:** Show off what is "Traditional" and safe. (e.g., Minimal, Clean, Corporate lines).
*   **Tone:** Reliable, elegant, understated. 
*   **Creative Scope:** HIGH

### Block 4: `big-bang` — The Range Statement
*   **Strategic Goal:** Reinforce that you aren't stuck with one look.
*   **Reference Copy (Paraphrase from this):**
    *   *Headline:* "Light mode. Dark mode. Any mode, it's your mode."
    *   *Body:* "The platform handles the complexity. Auto-switching themes included."
*   **Creative Scope:** MEDIUM
    *   *Constraint:* You MUST vary the phrasing per widget. Keep the rhythm (X. Y. Z.), but adapt the words.

### Block 5: `control-moat` — Design Freedom & Precision
*   **Goal:** Prove that customization feels effortless but is technically deep.
*   **Strategy:** Highlight specific, granular controls (Per-corner radius, independent padding, dynamic type scales).
*   **Reference Copy:**
    *   *Headline:* "Design freedom, built in."
    *   *Subhead:* "From layouts to finishes to fonts—customization that feels effortless."
*   **Creative Scope:** LOW (Stick to the specific feature list: Layouts, Appearance, Typography).

### Block 6–10: `split` — Specific Variances
*   **Mandatory Splits to Include:**
    *   **Dark/Light Mode:** Show how the widget adapts seamlessly.
    *   **Layout Density:** Compact vs Spacious (Information density).
    *   **Typography:** Expressive headings vs Functional readability.
*   **Creative Scope:** MEDIUM (Show, don't just tell).

### Block 11–13: `split-carousel` — The Style Showcases
*   **Goal:** Prove "One Widget, Infinite Looks."
*   **Mechanism:** A carousel of live embeds on one side, static copy on the other.
*   **Content Rule:** ALL embeds in the carousel MUST use identical content (same questions/data). Only the *skin* (theme/style) changes.
*   **Use Cases:**
    *   **Seasonal:** (Halloween theme vs Christmas theme).
    *   **Trends:** (Glassmorphism vs Brutalism vs Neumorphism).
    *   **Mode:** (Light vs Dark vs High Contrast).
*   **Creative Scope:** MEDIUM (Explain the versatility).

### Block 14: `steps` — Design Workflow
*   **Abstract Workflow:** Pick a vibe → Tweak the details → Publish.
*   **Constraint:** Make it sound fun, not like "configuration."
*   **Creative Scope:** MEDIUM

### Block 15: `cta-bottom-block`
*   **Headline:** "Start designing for free."
*   **Creative Scope:** HIGH
*   Functionality is explained here.

---

## Step 4: Construct Examples Page (`/examples`)

**Purpose:** Enumerates correct, real-world instantiations. Proves correctness, not value.

### Block 1: `hero` — Observational Framing
*   **Goal:** Signal observed patterns, not marketing claims.
*   **Rules:** No promises, no benefits, no outcomes as wins.
*   **Creative Scope:** LOW

### Block 2–4 & 6–7: `split` — Example Instantiations
*   **Structure:** One industry, one page context, one action per split.
*   **Tone:** Descriptive. Literal. Calm. (As if describing a live site).
*   **Formula:** `[Industry Name]` → `[User Problem]` → `[Operational Solution]`.

### Block 5: `big-bang` — Universality Reset
*   **Goal:** Reframe examples as representative.
*   **Rule:** State that PRD behavior applies wherever the need exists.
*   **Creative Scope:** LOW–MEDIUM

### Block 8: `steps` — Adoption (Minimal)
*   **Steps:** Add widget → Widget adapts → Optional refinement → Live.
*   **Constraint:** No configuration detail.

### Block 9: `platform-strip` — Foundation
*   **Goal:** Quiet reassurance. No new claims, no AI talk.

### 4E. Forbidden Language (HARD BAN)
*   **Business/Marketing:** convert, drive results, increase, engagement, revenue, ROI.
*   **Emotional:** powerful, delightful, seamless, effortless, loved by.
*   **Speculative:** "helps businesses...", "customers want...", "imagine if...".

### 4F. Final Validation Test
An Examples page is correct only if **every sentence can be traced directly to a PRD field or an observable UI change.**

---

## Step 5: Construct Features Page (`/features`)

**Purpose:** Technical and product authority page. Explains *how* it works and *why* it is superior.

### 5A. Mandatory Feature Extraction
Extract from PRD: [Primary Value Prop], [Widget Capabilities], [Widget Actions], [System Dependencies], [Design Controls].

### 5B. What a Feature IS
A concrete, user-visible capability enabled by implementation.
*   ✅ "Server-side rendered content"
*   ❌ "Improves SEO"

### 5C. Page Construction
*   **Block 1: Hero:** Authority claim based on technology.
*   **Block 2: AI Editing:** Explain AI as a capability (what it does).
*   **Block 3: Global:** Tie localization to visible output.
*   **Block 4: Composability:** Focus on embed model and isolation.
*   **Block 5: Steps (Why This Wins):** Technical, Product, and System differentiators.
*   **Block 6: Big-Bang:** Future proofing via system design.
*   **Block 7: Ecosystem:** Focus on versioning and stability.
*   **Blocks 8-10:** Recap Design, Infra, and Stability.

### 5D. Forbidden Language
*   "Boost", "Increase", "Improve", "Delight", "World-class", "Game-changing".

### 5E. Final Validation Test
Features explain **why the widget is well-built**, not why it feels good.