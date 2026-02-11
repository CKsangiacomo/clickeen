# Localization & Global Strategy

**STATUS: PLANNING — REVIEW BEFORE EXECUTION**  
**Created:** 2024-12-27  
**Dependency:** Infrastructure_Cloudflare_Plan.md (Global GA confirmed)

---

## Overview

Clickeen launches globally from day one. This document covers the nuances beyond infrastructure:

1. **Product UI Localization** — Bob, Site, Minibob interfaces
2. **Marketing Content** — Funnels, PLG copy, landing pages
3. **SEO Content** — Blog posts, help articles per market
4. **Typography** — Asian, Cyrillic, RTL font systems
5. **Invoicing & Payments** — EU VAT, country-specific requirements
6. **AI Agent Orchestration** — Which LLM does what

---

## 1. Product UI Localization

### What Needs Translation

| Surface | Strings | Complexity |
|---------|---------|------------|
| Bob (editor) | ~500 | High — UI context matters |
| Site (marketing) | ~200 | Medium — persuasive copy |
| Minibob (playground) | ~100 | Medium — onboarding UX |
| Error messages | ~50 | High — must be clear |
| Email templates | ~30 | Medium — transactional |

### Agent: `UI-Translator`

**Role:** Curates and maintains product UI translations  
**Not just translation — localization:**
- Understands UI context (button labels, tooltips, errors)
- Maintains terminology consistency across surfaces
- Handles pluralization rules per language
- Adapts date/time/number formats

**LLM:** Claude Sonnet (high-quality, context-aware)  
**Process:**
```
1. Extract strings from codebase → JSON
2. Claude translates with UI context provided
3. Human review (native speaker, 1x per language)
4. Store in i18n system (e.g., Paraglide, next-intl)
5. Agent monitors for new strings, triggers re-translation
```

**Quality Control:**
- [ ] Terminology glossary per language (brand terms, UI patterns)
- [ ] Screenshot context for ambiguous strings
- [ ] A/B test critical conversion copy

### Target Markets (Prioritized)

**GOLD MARKETS (Priority):**
| Market | Languages | Notes |
|--------|-----------|-------|
| 🇺🇸 USA | English | Default, largest |
| 🇨🇦 Canada | English, French | Bilingual, high-value |
| 🇦🇺 Australia | English | No extra work |
| 🇬🇧 UK | English | No extra work |
| 🇪🇺 EU | German, French, Italian, Dutch, Spanish | High purchasing power |
| 🇯🇵 Japan | Japanese | High-value, quality-conscious |
| 🇧🇷 Brazil | Portuguese | Huge SMB market |
| 🇦🇷 Argentina | Spanish | Strong tech culture, price in USD (ARS volatile) |
| 🇲🇽 Latin America | Spanish | Mexico, Colombia, Chile, Peru |
| 🇮🇳 India | English, Hindi | 1.4B population, English-first |
| 🇹🇼 Taiwan | Traditional Chinese | High-value, no GFW issues |

**AFRICA (Emerging Gold):**
| Market | Languages | Notes |
|--------|-----------|-------|
| 🇳🇬 Nigeria | English | 220M pop, booming tech/SMB scene |
| 🇿🇦 South Africa | English | Established economy, gateway to Africa |
| 🇰🇪 Kenya | English | Tech hub, M-Pesa, innovation culture |
| 🇬🇭 Ghana | English | Growing tech ecosystem |
| 🇸🇳 Francophone West Africa | French | Senegal, Ivory Coast, Cameroon |
| 🇲🇦 Morocco | French | Bridge to Africa + EU ties |

*Africa is linguistically "free" — English + French already cover major markets. Main work: payment methods (M-Pesa, Flutterwave, local options).*

**ON HOLD (Geopolitical):**
| Market | Reason |
|--------|--------|
| 🇨🇳 China | Great Firewall, regulations, geopolitical risk |
| 🇷🇺 Russia | Sanctions, payment restrictions, geopolitical risk |

### Priority Languages (Product UI)

| Priority | Language | Markets Covered |
|----------|----------|-----------------|
| 1 | English | USA, Canada, Australia, India, UK, global fallback |
| 2 | Spanish | Latin America, US Hispanic, Spain |
| 3 | Portuguese | Brazil |
| 4 | German | Germany, Austria, Switzerland |
| 5 | French | France, Canada, Belgium, Africa |
| 6 | Japanese | Japan |
| 7 | Italian | Italy |
| 8 | Dutch | Netherlands, Belgium |

**Phase 2:**
- Hindi (India — massive reach)
- Traditional Chinese (Taiwan, Hong Kong)
- Korean (South Korea)
- Polish (EU growth market)
- Turkish (emerging market)

---

## 2. Marketing Content (Funnels, PLG Copy)

### What Needs Creation

| Content Type | Volume | Frequency |
|--------------|--------|-----------|
| Landing pages | 5-10 per language | Once, iterate |
| Funnel copy (signup, onboarding) | ~20 screens | Once, iterate |
| PLG in-app prompts | ~15 | Ongoing |
| Email sequences | 10-15 emails | Once, iterate |
| Social proof / testimonials | Varies | Ongoing |

### Agent: `Marketing-Copywriter`

**Role:** Creates persuasive, culturally-adapted marketing copy  
**Not translation — creation:**
- Understands local market pain points
- Adapts tone for cultural norms
- Uses local idioms and references
- Optimizes for local conversion patterns

**LLM:** GPT-4o (creative, marketing-tuned)  
**Process:**
```
1. Define campaign/page goal + English brief
2. GPT-4o creates localized version (not translates)
3. Include local market context in prompt:
   - Competitor landscape in that country
   - Cultural values (direct vs. indirect, formal vs. casual)
   - Local success stories / social proof
4. Human review for brand consistency
5. A/B test key pages
```

**Cultural Considerations:**

| Market | Tone | Emphasis |
|--------|------|----------|
| US | Direct, benefit-focused | Speed, ROI |
| Germany | Precise, feature-focused | Quality, reliability |
| Japan | Polite, detail-oriented | Trust, support |
| Brazil | Warm, relationship-focused | Community, ease |
| France | Elegant, sophisticated | Design, innovation |

---

## 3. SEO Content (Blog, Help Articles)

### Content Strategy Per Market

| Content Type | Purpose | Volume |
|--------------|---------|--------|
| Blog posts | Organic traffic, authority | 4-8/month/language |
| Help articles | Support deflection | 50+ per language |
| Widget tutorials | Conversion, SEO | 15+ per widget/language |
| Comparison pages | Bottom-funnel | 5-10 per language |

### Agent: `Content-Writer`

**Role:** Creates SEO-optimized content for each market  
**Fully automated pipeline:**

**LLM:** DeepSeek (cost-effective for volume) + Claude for editing  
**Process:**
```
1. Keyword research per market (Ahrefs/SEMrush API or manual seed)
2. Content brief generation (topic, keywords, structure)
3. DeepSeek drafts article (cost: ~$0.01/article)
4. Claude edits for quality (cost: ~$0.05/article)
5. Auto-publish to blog CMS
6. Track rankings, iterate
```

**Localization Nuances:**
- Different keywords matter in different markets
- Local competitors to compare against
- Local holidays/events for timely content
- Local case studies and examples

### Agent: `Content-Manager`

**Role:** Orchestrates multi-language content calendar  
**Responsibilities:**
- Maintains content calendar per market
- Triggers Content-Writer for new articles
- Monitors SEO performance per market
- Identifies content gaps
- Coordinates translation of evergreen content

---

## 4. Typography & Fonts

### The Problem

Google Fonts we curated (17 fonts) are Latin-script focused. Asian, Cyrillic, and Arabic scripts need different fonts.

### Font Strategy

| Script | Languages | Font Approach |
|--------|-----------|---------------|
| **Latin** | EN, ES, PT, DE, FR, IT, NL | Current 17 fonts work |
| **Cyrillic** | Russian, Ukrainian | Subset of current fonts + additions |
| **Japanese** | Japanese | Noto Sans JP, M PLUS 1p |
| **Korean** | Korean | Noto Sans KR, Pretendard |
| **Chinese** | Simplified, Traditional | Noto Sans SC/TC |
| **Arabic** | Arabic, Farsi | Noto Sans Arabic + RTL support |
| **Thai** | Thai | Noto Sans Thai |

### Implementation

**Dieter Changes:**
```css
/* Font fallback chain */
--ck-font-family-base: 'Inter', 'Noto Sans JP', 'Noto Sans KR', 
                        'Noto Sans SC', 'Noto Sans Arabic', sans-serif;
```

**Widget Typography:**
- Detect user's language preference
- Load appropriate font subset
- Performance: Only load scripts that page needs

**Bob Editor:**
- Font picker shows fonts that support user's script
- Preview with correct glyphs

### RTL Support (Arabic, Hebrew, Farsi)

| Component | RTL Requirement |
|-----------|-----------------|
| Bob UI | CSS `direction: rtl` + layout flip |
| Widget HTML | Inherit from parent page |
| Dieter components | Review all for RTL compatibility |

**Priority:** Phase 2 (after Latin + Asian markets)

---

## 5. Invoicing & Payments

### EU VAT Requirements

EU businesses require VAT-compliant invoices with:
- VAT number validation
- Reverse charge for B2B
- Country-specific VAT rates
- Invoice in local language (or English)

**Solution:** Stripe Tax + Stripe Invoicing
- Automatic VAT calculation
- Compliant invoices generated
- Handles B2B reverse charge

### Country-Specific Invoicing

| Country | Special Requirements |
|---------|---------------------|
| Germany | Strict invoice numbering, Rechnungsnummer |
| France | Mention légales on invoice |
| Italy | Electronic invoicing (SDI) for B2B |
| Brazil | Nota Fiscal requirements |
| Japan | Consumption tax, specific format |

**Solution:** Stripe handles most of this. For edge cases (Italy SDI, Brazil NF), use specialized integrations or limit B2B in those markets initially.

### Multi-Currency

| Currency | Markets |
|----------|---------|
| USD | US, default |
| EUR | EU countries |
| GBP | UK |
| BRL | Brazil |
| JPY | Japan |
| MXN | Mexico |

**Implementation:** Stripe multi-currency pricing. Show local currency, charge in local currency.

### Payment Methods

| Market | Preferred Methods |
|--------|-------------------|
| US | Card, Apple Pay, Google Pay |
| EU | Card, SEPA, Klarna |
| Brazil | PIX, Boleto |
| Japan | Card, Konbini |
| Germany | Card, SEPA, Giropay |
| Argentina | Card (USD pricing), Mercado Pago |
| India | Card, UPI, Razorpay |
| Nigeria | Card, Flutterwave, Paystack |
| Kenya | M-Pesa, Card |
| South Africa | Card, PayFast |

**Solution:** Stripe Payment Element auto-shows relevant methods per market.

**Africa Strategy:**
- Stripe supports Nigeria, South Africa, Kenya directly
- For broader Africa: Flutterwave or Paystack as Stripe alternative
- M-Pesa critical for East Africa (Kenya, Tanzania)
- Consider starting with card-only, add local methods based on demand

---

## 6. AI Agent Orchestration

### Agent Roster for Globalization

| Agent | LLM | Responsibility | Cost Profile |
|-------|-----|----------------|--------------|
| `UI-Translator` | Claude Sonnet | Product UI strings | Low volume, high quality |
| `Marketing-Copywriter` | GPT-4o | Funnels, PLG copy | Medium volume |
| `Content-Writer` | DeepSeek + Claude | Blog, SEO content | High volume, low cost |
| `Content-Manager` | Claude Haiku | Orchestration, scheduling | Low cost |
| `Legal-Translator` | Claude Sonnet | Terms, Privacy, Invoices | Low volume, high accuracy |
| `Support-Agent` | Claude Haiku | Multi-language support | Medium volume |

### Automated Content Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    CONTENT ORCHESTRATION                    │
│                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌─────────────┐ │
│  │   Content-   │────▶│   Content-   │────▶│    CMS      │ │
│  │   Manager    │     │   Writer     │     │  (Publish)  │ │
│  │              │     │              │     │             │ │
│  │ • Calendar   │     │ • DeepSeek   │     │ • Blog      │ │
│  │ • Gaps       │     │ • Claude     │     │ • Help      │ │
│  │ • Schedule   │     │ • Edit       │     │ • i18n      │ │
│  └──────────────┘     └──────────────┘     └─────────────┘ │
│         │                                         │        │
│         ▼                                         ▼        │
│  ┌──────────────┐                         ┌─────────────┐  │
│  │   SEO        │                         │  Analytics  │  │
│  │   Tracker    │◀────────────────────────│  (Rankings) │  │
│  └──────────────┘                         └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Cost Estimate (Content at Scale)

| Content Type | Volume/month | Cost/unit | Monthly Cost |
|--------------|--------------|-----------|--------------|
| Blog posts (8 langs × 4) | 32 | $0.10 | $3.20 |
| Help articles (updates) | 50 | $0.05 | $2.50 |
| Marketing copy (updates) | 20 | $0.20 | $4.00 |
| UI string updates | 100 | $0.02 | $2.00 |
| **Total** | | | **~$12/month** |

Content localization at scale is essentially free with AI.

---

## 7. Implementation Phases

### Phase 1: Core Markets (GA)
**Markets:** USA, Canada, UK, Australia, EU core, Latin America (incl. Argentina), Brazil  
**Languages:** English, Spanish, Portuguese, German, French  
**Scope:**
- [ ] Product UI translated (Bob, Site)
- [ ] Marketing funnels localized
- [ ] Help articles (top 20)
- [ ] Multi-currency: USD, EUR, GBP, CAD, AUD, BRL, MXN
- [ ] Argentina: Price in USD (ARS too volatile)
- [ ] Stripe Tax enabled (handles VAT automatically)

### Phase 2: Extended EU + Japan
**Markets:** + Japan, Italy, Netherlands, Belgium  
**Languages:** + Italian, Dutch, Japanese  
**Scope:**
- [ ] Noto Sans JP (Japanese fonts)
- [ ] JPY currency
- [ ] Japan-specific payment methods (Konbini)
- [ ] Japan marketing adaptation (formal tone, trust signals)

### Phase 3: Asia-Pacific Expansion
**Markets:** + Taiwan, India, South Korea  
**Languages:** + Traditional Chinese, Hindi, Korean  
**Scope:**
- [ ] Noto Sans TC (Traditional Chinese)
- [ ] Noto Sans KR (Korean)
- [ ] Hindi UI (India's English-first, but Hindi extends reach)
- [ ] INR, TWD, KRW currencies
- [ ] UPI payments (India)

### Phase 4: Africa Expansion
**Markets:** + Nigeria, South Africa, Kenya, Ghana, Francophone West Africa  
**Languages:** Already covered (English, French)  
**Scope:**
- [ ] African payment methods via Stripe (or Flutterwave/Paystack)
- [ ] M-Pesa integration (Kenya)
- [ ] NGN, ZAR, KES currencies
- [ ] Africa-specific SEO campaigns
- [ ] Local case studies (African SMBs)
- [ ] Morocco as EU-Africa bridge market

### Phase 5: Extended Growth
**Markets:** + Poland, Turkey, other emerging  
**Languages:** + Polish, Turkish  
**Scope:**
- [ ] Market-specific SEO campaigns
- [ ] Local case studies
- [ ] PLN, TRY currencies

### ON HOLD (No Timeline)
**Markets:** China, Russia  
**Reason:** Geopolitical risk, sanctions, infrastructure complexity  
**Revisit:** When situation changes

---

## 8. Quality Assurance

### Translation Review Process

```
1. AI generates translation
2. Auto-check: Grammar, terminology consistency
3. Native speaker review (contract, 1x per release)
4. Screenshot verification for UI context
5. Merge to main branch
```

### Monitoring

| Metric | Tool | Alert Threshold |
|--------|------|-----------------|
| Missing translations | CI check | Any missing = block deploy |
| Translation quality | User feedback | >3 complaints = review |
| SEO rankings | Ahrefs/SEMrush | Drop >10 positions = investigate |
| Conversion by locale | Analytics | >20% below baseline = review copy |

---

## 9. Technical Implementation

### i18n Stack

**Recommended:** `next-intl` for Next.js apps
- Type-safe translations
- Server components support
- ICU message format (pluralization, etc.)

**Structure:**
```
/messages
  /en.json
  /es.json
  /pt.json
  /de.json
  /fr.json
  ...
```

### Locale Detection

1. URL path prefix (`/es/`, `/de/`)
2. User preference (stored in account)
3. Browser `Accept-Language`
4. Geo-IP fallback

### SEO for Multi-Language

```html
<link rel="alternate" hreflang="en" href="https://clickeen.com/en/" />
<link rel="alternate" hreflang="es" href="https://clickeen.com/es/" />
<link rel="alternate" hreflang="x-default" href="https://clickeen.com/" />
```

---

## 10. Open Questions

1. **Taiwan approach:** Market as separate region or group with "Chinese Traditional" globally?
2. **India strategy:** English-only initially, or Hindi from Phase 3?
3. **Native speaker review:** Contract network or agency? (need reviewers for 8+ languages)
4. **Local case studies:** How to source pre-launch? AI-generated fictional examples?
5. **Japan:** Partner with local agency for cultural nuance? (high-context culture)
6. **Latin America:** Single "Spanish" or regional variants (MX, AR, ES)?
7. **Canada French:** Same as France French or Canadian variant?
8. **Argentina pricing:** USD-only or also offer ARS with frequent adjustments?
9. **Africa payments:** Stripe-only or integrate Flutterwave/Paystack for broader reach?
10. **Nigeria focus:** Largest African market — worth dedicated marketing push?
11. **M-Pesa priority:** Essential for Kenya/East Africa or Phase 4+ nice-to-have?

---

## References

- Stripe Tax: https://stripe.com/tax
- Stripe Global Payments: https://stripe.com/global
- next-intl: https://next-intl-docs.vercel.app/
- Noto Fonts: https://fonts.google.com/noto
- EU VAT Rules: https://europa.eu/youreurope/business/taxation/vat/

