# PERSONALIZATION AGENTS — Acquisition Preview vs Paid Onboarding

Status: Executed / superseded. Preview + onboarding personalization shipped; this doc is historical.
Source of truth: `documentation/` and `Execution_Pipeline_Docs/03-Executed/033__PRD__07-14_Remaining_Work_Closeout.md`.

**File:** PERSONALIZATION_AGENTS_PRD.md  
**Status:** Draft (Codex-ready)  
**Owner:** Clickeen Platform / AI  
**Applies to:** Prague (acquisition pages), Bob (onboarding + in-product)  
**Taxonomy:** These are **Agents** (not Copilots).

---

## 1) Why this exists
We want **instant personalization** with very low engineering effort in acquisition flows, and a **tiered deep-personalization** capability for paid tiers that removes onboarding friction (NAP, business details, offerings).

This PRD defines one underlying capability with **two modes**:
1) **Acquisition Preview Mode** (Prague): “Make this widget yours” → light scrape → personalize only the widget copy on the Prague page instance.
2) **Onboarding Personalization Mode** (Paid tiers): deeper enrichment (site + profiles) → populate a workspace/business profile and optionally seed widget defaults.

These modes should share infrastructure (San Francisco agent runtime + policy), but have different scopes, budgets, and tool permissions.

---

## 2) Product goals (tight)
### 2.1 Acquisition Preview Mode (Prague)
**Goal:** The user immediately sees *their business reflected* in the Prague widget instance (titles/headings/CTA microcopy), without requiring them to create an account or fill forms.

**Success metric:** Higher conversion into “Try in editor / Signup” because the page feels personalized.

**Key constraint:** Very low LOE and low risk. No broad scraping platform.

### 2.2 Onboarding Personalization Mode (Paid tiers)
**Goal:** For paid users, reduce friction by auto-filling business identity information (NAP + what they do) from high-quality sources and by tier.

**Success metric:** Higher activation rate (publish), faster time-to-first-widget, better retention.

---

## 3) Non-goals
- Not building a universal web-crawler
- Not scraping gated/private content without explicit provider-supported authorization
- Not attempting “perfect brand system extraction” (logo/colors) in Acquisition Preview Mode
- Not creating a new Copilot (only two copilots exist; this is an Agent)

---

## 4) Lingo alignment (required)
- **Copilots:** SDR Copilot, CS Copilot (only two)
- **Agents:** task executors; this PRD defines Personalization Agents
- **Jobs:** queued work units executed by agents

---

## 5) Agent design: one capability, two task classes
Recommended implementation: one agent package with two handlers (or one handler parameterized by mode).

### 5.1 Canonical agent IDs
- `agent.personalization.preview.v1` (Acquisition Preview Mode)
- `agent.personalization.onboarding.v1` (Onboarding Personalization Mode)

These IDs become entries in the Agent Registry (see SF plan).

### 5.2 Task classes (drives policy + tools)
- `personalization.acquisitionPreview`
- `personalization.onboardingProfile`

---

## 6) Inputs and outputs (contracts)
### 6.1 Acquisition Preview output (copy overrides only)
**Input**
- `url` (required)
- `templateContext` (required): which Prague page + which curated instance we’re personalizing (ex: FAQ widget instance)
- Optional: `locale` (default en-US)

**Output**
```json
{
  "brandName": "Acme Dental",
  "businessType": "dentist",
  "copyOverrides": {
    "heroTitle": "FAQs for Acme Dental",
    "heroSubtitle": "Insurance, appointments, and what to expect",
    "sectionTitle": "Common questions",
    "ctaText": "Book your visit"
  },
  "confidence": 0.74,
  "notes": ["Used head meta only"]
}
```

**Important:** Output must be safe and bounded:
- Only whitelisted copy fields are allowed to change
- No URLs injected (unless explicitly allowed)
- No HTML beyond what the widget already allows

### 6.2 Onboarding Personalization output (Business Profile)
**Input**
- `workspaceId` (required, authenticated)
- `url` (required)
- Optional connected profiles (tier-gated):
  - `gbpPlaceId` or `gbpAccountRef` (if user connected Google)
  - `facebookPageId` (if connected)
  - `instagramHandle` (if connected)
- Optional: `locale`

**Output**
```json
{
  "businessProfile": {
    "name": "Acme Dental",
    "category": "Dentist",
    "description": "...",
    "nap": {
      "address": "...",
      "phone": "...",
      "city": "...",
      "state": "...",
      "postal": "..."
    },
    "hours": { "mon": "...", "tue": "..."},
    "services": ["Cleanings", "Implants", "Emergency"],
    "toneHints": ["friendly", "professional"]
  },
  "recommendations": {
    "templates": [
      {"widgetType":"faq","templateId":"faq_local_dentist_v2"},
      {"widgetType":"reviews","templateId":"reviews_local_v1"}
    ],
    "defaultCopyPackId": "local_dentist_pack_en"
  },
  "confidence": 0.81,
  "sourcesUsed": ["website", "gbp"]
}
```

### 6.3 Business Profile storage (v1 decision)
Store business profiles in **Michael (Supabase)** with RLS enforced.
Recommended table:
`workspace_business_profiles` (workspace_id, profile jsonb, sources jsonb, updated_at).
Paris is the only writer; Bob reads via Paris APIs.

---

## 7) Data sources by mode (keep LOE sane)
### 7.1 Acquisition Preview Mode: **Light scrape**
1) **HEAD meta only** (fast path)
- title, meta description, og:title, og:description, og:site_name
- JSON-LD `@type` signals if present (Organization/LocalBusiness)

2) **Homepage snippet fallback** (only if meta is thin)
- download bounded bytes (example: first 80KB of HTML)
- extract visible text from a narrow area (e.g., first N characters of body text)
- goal is only to infer business type and a brand name

**Hard boundaries**
- one page max (homepage only)
- strict timeout (e.g., 3–5s)
- strict byte cap
- no deep crawling
- do not attempt NAP extraction here

### 7.2 Onboarding Personalization Mode: **Tiered enrichment**
**By tier (illustrative)**
- Free: website only (limited depth) + DeepSeek + low token budgets
- Paid Tier 1: website + 1 extra page (About/Services) + higher tokens
- Paid Tier 2+: website + richer extraction + profile sources (GBP/FB) if connected
- Paid Tier 3: “best effort” with provider choice (OpenAI/Anthropic) and larger budgets

**Important:** external profiles should ideally be accessed via OAuth/connectors (not fragile scraping).

---

## 8) What gets personalized (Acquisition Preview Mode)
Only text fields for the instance embedded in Prague.

Example: for FAQ widget instance on Prague:
- Page-level title/subtitle for the widget block
- FAQ section title (“Common Questions”)
- CTA microcopy (“Schedule an appointment”)

**Not allowed**
- structural changes (adding/removing sections)
- adding lots of FAQs
- changing layout, colors, fonts
- adding external links

This keeps the experience deterministic and low-risk.

---

## 9) System flows
### 9.1 Acquisition Preview Flow (Prague)
1) Prague shows CTA: “Make this widget yours”
2) User enters URL
3) Prague calls Paris: `POST /api/personalization/preview`
4) Paris enqueues job (or performs fast sync if you choose)
5) SF agent executes light fetch + classification + copy generation
6) Paris returns `copyOverrides` + `confidence`
7) Prague applies overrides on the embedded instance client-side (in-memory) and shows result immediately
8) CTA: “Continue in editor” → routes to signup or Bob

**Optimization:** In MVP you can do this synchronously if latency is acceptable (<2–3s). If not, keep the job/poll pattern.

### 9.2 Onboarding Personalization Flow (Bob)
1) In onboarding, user provides website + optionally connects Google/Facebook (paid)
2) Bob calls Paris: `POST /api/personalization/onboarding`
3) Paris computes entitlements/policy, enqueues job for SF
4) SF agent executes enrichment and returns `businessProfile`
5) Paris writes `businessProfile` to Supabase `workspace_business_profiles` (canonical store)
6) Bob reads it and pre-fills UI and recommends templates
7) User confirms/edits minimal fields and proceeds

---

## 10) Entitlements and “smartness by tier”
This agent must use the **policy-driven routing** system (provider + tokens + tools).

### 10.1 Proposed entitlements
- `personalization.preview.enabled` (bool) — likely true for all, with strict rate limits
- `personalization.onboarding.enabled` (bool) — paid only
- `personalization.sources.website.depth` (int) — how many pages / how deep
- `personalization.sources.gbp.enabled` (bool) — paid tiers
- `personalization.sources.facebook.enabled` (bool) — paid tiers
- `ai.providers.allowed` (list) — deepseek only vs include openai/anthropic
- `ai.providerChoice.enabled` (bool) — paid tiers can pick openai vs anthropic
- `ai.budget.tokens` (int) — task-class specific budgets

### 10.2 Provider routing rules (high level)
- Acquisition Preview: DeepSeek, low tokens, short timeout
- Onboarding: tier-based; allow provider choice for higher tiers

---

## 11) Security / abuse guardrails (minimal but required)
Even for “light scrape” you need the basics:
- block localhost/private IPs (SSRF)
- allow only http/https
- limit redirects
- strict byte caps
- strict timeouts
- do not store fetched page content long-term (store only extracted signals + outputs)

---

## 12) MVP implementation steps (very low LOE path)
### Phase 1: Acquisition Preview Mode (ship first)
1) Prague UI modal + URL input + loading state
2) Paris endpoint `/api/personalization/preview`
3) SF agent `agent.personalization.preview.v1`:
   - fetch head meta
   - if insufficient: fetch bounded homepage snippet
   - infer businessType and brandName
   - produce copyOverrides for a fixed schema (per Prague page)
4) Prague applies copyOverrides to the instance model and re-renders
5) Track events: started → success/fail → continue/signup

### Phase 2: Paid Onboarding Personalization (next)
1) Add workspace business profile store (if not already)
2) Paris endpoint `/api/personalization/onboarding`
3) SF agent `agent.personalization.onboarding.v1`:
   - website extraction with tier depth
   - optional connectors (GBP/FB) if configured
   - normalize and return businessProfile
4) Paris writes profile to workspace
5) Bob reads it to prefill onboarding + recommends templates

---

## 13) Open questions (keep tight)
1) For Acquisition Preview, do we compute “businessType” using a small LLM call or deterministic heuristics + a small model call only when needed?
2) For Prague instances, do we maintain a small set of vertical templates to swap in (dentist/restaurant/saas), or only override copy on the existing instance?
3) (Answered) Canonical Business Profile lives in Supabase (`workspace_business_profiles`) with RLS.
4) Do we allow provider choice (OpenAI/Anthropic) at onboarding only, or also for translations and other agents?

---

## Appendix A — Suggested endpoint names
- `POST /api/personalization/preview` (Prague)
- `POST /api/personalization/onboarding` (Bob)
- `GET /api/personalization/status/:jobId` (optional if async)
