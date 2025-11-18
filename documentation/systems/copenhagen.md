STATUS: HISTORICAL — NOT PHASE-1 (FUTURE)
This document describes a planned AI service layer that is NOT part of Phase-1. Copenhagen is deferred to Phase-2 or later.

# System: Copenhagen — AI Service Layer

## Identity
- **Tier:** Core Infrastructure
- **Purpose:** AI Workforce Orchestration - manages all AI agents and operations across Clickeen
- **Owner:** Platform team
- **Priority:** P0 (required for Bob AI Copilot and operational agents)

## Overview

Copenhagen is Clickeen's **AI workforce orchestration layer**. It manages both widget-building AI features (Manual/Copilot modes) and operational AI agents that run the business (SDR, Customer Success, Content Writing, Marketing).

**Think of Copenhagen as:** The HR system + dispatch center for Clickeen's AI employees.

### Two Categories of AI:

**1. Engineering AIs (outside Copenhagen):**
- Claude, GPT, Codex, Gemini building the platform
- Managed by CEO directly
- Write code, PRDs, migrations

**2. Operational AIs (managed by Copenhagen):**
- **5 Agent Types:** SDR, Editor Copilot, Customer Success, Content Writer, Marketing
- **100+ Agent Variants:** Different personalities, languages, tones, cultural adaptations
- Run the business operations (support, sales, content, marketing)

### Core Capabilities:

**Agent Management:**
1. **Agent registry** - Catalog of all operational agents and their variants
2. **Agent selection** - Route user to appropriate agent based on context/preferences
3. **Personality system** - Data-driven agent personalities (not hardcoded)
4. **Multi-language/culture** - Same agent, different languages and cultural adaptations

**Infrastructure:**
5. **Model routing** - Routes to DeepSeek (cheap) or Claude/GPT (smart) based on agent needs
6. **Usage tracking** - Per-user/per-agent usage limits and quotas
7. **Cost monitoring** - Track token usage and costs per agent and conversation
8. **Rate limiting** - Prevent abuse across all AI endpoints
9. **Access control** - What each agent can see/do (permissions)
10. **Escalation rules** - When to flag CEO for human intervention

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    USER SURFACES                        │
├─────────────────────────────────────────────────────────┤
│ MiniBob (free)  │  Bob (paid)  │  Support Chat  │  Etc │
└────────┬────────────────┬───────────────┬───────────────┘
         │                │               │
         ↓                ↓               ↓
┌─────────────────────────────────────────────────────────┐
│              Paris API (/api/ai/*)                      │
└────────┬────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────┐
│         COPENHAGEN (AI Workforce Orchestration)         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │        AGENT SELECTOR & ROUTER                  │  │
│  │  - Detect context (user tier, language, etc.)  │  │
│  │  - Select appropriate agent variant             │  │
│  │  - Route to correct AI provider                 │  │
│  └─────────────────────────────────────────────────┘  │
│                       ↓                                 │
│  ┌─────────────────────────────────────────────────┐  │
│  │           AGENT REGISTRY (5 types)              │  │
│  │                                                 │  │
│  │  1. SDR Agent         (DeepSeek)               │  │
│  │  2. Editor Copilot    (Claude/GPT)             │  │
│  │  3. Customer Success  (Claude)                 │  │
│  │  4. Content Writer    (DeepSeek)               │  │
│  │  5. Marketing Agent   (GPT/Claude)             │  │
│  │                                                 │  │
│  │  Each with 10-20 personality variants:         │  │
│  │  - Languages (en, es, fr, de, ja, etc.)        │  │
│  │  - Tones (casual, professional, empathetic)    │  │
│  │  - Cultural adaptations                        │  │
│  └─────────────────────────────────────────────────┘  │
│                       ↓                                 │
│  ┌─────────────────────────────────────────────────┐  │
│  │         AI PROVIDER LAYER                       │  │
│  │                                                 │  │
│  │  DeepSeek R1    - High volume, low cost        │  │
│  │  Claude Sonnet  - Complex reasoning, agentic   │  │
│  │  GPT-4          - Fallback, specialized        │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## AI Provider Selection Strategy

Copenhagen routes requests to different AI providers based on **task complexity** and **user tier**, NOT based on widget type.

### DeepSeek R1 — Simple, Constrained Tasks

**Use cases:**
- Free tier single-field generation (short text, 2-3 sentences)
- Simple text completion without context
- Basic formatting/transformation
- Non-critical suggestions

**Characteristics:**
- Very low cost (~$0.14/$0.55 per 1M tokens)
- Fast responses
- Limited reasoning capability
- Good for formulaic outputs

**Examples:**
- "Generate a short button label for X"
- "Write 2-3 sentences about Y"
- "Suggest 3 color names for Z theme"

**When NOT to use:**
- Complex reasoning tasks
- Long-form content (>200 words)
- Context-dependent decisions
- Agentic behavior

### Claude Sonnet 4.5 — Agents & Complex Reasoning

**Use cases:**
- **AI Copilot Mode** (agentic behavior)
- Pro tier content generation (long-form, SEO-optimized)
- Website analysis and content extraction
- Multi-step reasoning tasks
- Context-aware suggestions

**Characteristics:**
- High reasoning capability
- Excellent for agentic workflows
- Can handle large context windows
- More expensive (~$3/$15 per 1M tokens)

**Examples:**
- "Analyze this website and generate 20 FAQ questions"
- AI Copilot suggesting improvements across widget config
- "Given this business context, recommend optimal widget settings"
- Multi-turn conversations with user

**When to use:**
- User is in **AI Copilot Mode** (always Claude)
- Pro tier multi-field generation
- Tasks requiring analysis of large context (website scraping)
- Agentic suggestions and proactive recommendations

### GPT-4 — Fallback & Specialized

**Use cases:**
- Fallback when Claude is unavailable
- Specialized tasks Claude doesn't excel at
- A/B testing quality comparisons

**Characteristics:**
- Similar capability to Claude
- Different strengths (code generation, structured output)
- Similar cost to Claude

---

## Operational Agent Specifications

Copenhagen manages 5 types of operational agents that run Clickeen's business operations. Each agent type has multiple personality variants.

### 1. SDR Agent (Sales Development Rep)

**Purpose:** Convert free users to paid customers through helpful guidance and gentle upselling

**AI Provider:** DeepSeek R1 (high volume, low cost)

**Where Active:**
- MiniBob (Prague marketing site embed)
- Bob free tier

**Access & Permissions:**
- READ: Widget catalog, template gallery, free tier limits
- READ: User's current widget config (to provide relevant help)
- CANNOT: Edit widgets, see billing info, access paid features

**Core Behaviors:**
1. **Onboarding:** Greet new users, explain how to build first widget
2. **Demo Mode:** Walk through widget creation step-by-step
3. **Value Showcase:** Show what's possible with widgets
4. **Qualification:** Identify serious users (multiple sessions, near limits)
5. **Gentle Upsell:** When user hits limits, explain paid benefits
6. **Conversion Tracking:** Log upgrade triggers and conversion paths

**Personality Variants:**

| Variant ID | Name | Tone | Language | Cultural Context | Use Case |
|------------|------|------|----------|------------------|----------|
| `sdr_sarah_casual_en` | Sarah | Casual, friendly | en-US | North American | Default for US users |
| `sdr_marcus_professional_en` | Marcus | Professional, direct | en-UK | British | Corporate/professional users |
| `sdr_sofia_warm_es` | Sofia | Warm, patient | es-ES | Spanish | Spanish-speaking users |
| `sdr_yuki_polite_ja` | Yuki | Polite, formal | ja-JP | Japanese | Japanese users (indirect communication) |
| `sdr_camille_elegant_fr` | Camille | Elegant, professional | fr-FR | French | French users (use 'vous') |

**Example Conversation (Sarah - Casual):**
```
Sarah: Hey! 👋 I see you're creating your first FAQ widget - exciting!
       Want me to walk you through it?

User: Yes please

Sarah: Perfect! Let's start simple. First, let's add a category.
       Click "Add Category" and name it something like "Shipping"
       or "Product Info" - whatever fits your site.

       [User adds category]

Sarah: Nice! Now let's add a question. Click "+ Add Question" and
       type a common question your customers ask.

       [8 interactions later...]

Sarah: You're doing great! Just so you know, you've used 8 out of 10
       free AI generations. When you upgrade, you'll get unlimited
       AI plus way better answers (I'm using the basic AI 😅).

       Want to keep going with your free credits for now?
```

**Example Conversation (Yuki - Polite):**
```
Yuki: こんにちは。Clickeenへようこそ。
      (Hello. Welcome to Clickeen.)

      FAQウィジェットを作成されているようですね。
      お手伝いさせていただいてもよろしいでしょうか。

      (It appears you are creating an FAQ widget.
       May I assist you if it would be convenient?)

User: はい、お願いします (Yes, please)

Yuki: かしこまりました。では、まずカテゴリーを追加してみましょう。
      (Understood. Then, shall we try adding a category first?)

      [Later, regarding upgrade]

Yuki: 恐れ入りますが、無料プランでは10回までAI生成がご利用いただけます。
      現在8回ご利用になっております。

      お時間がよろしければ、プレミアムプランのご案内をさせていただけますでしょうか。

      (Excuse me, but the free plan allows up to 10 AI generations.
       You have currently used 8 times.

       If it is convenient for you, may I explain our premium plan?)
```

**Success Metrics:**
- Free-to-paid conversion rate (target: 15-20%)
- Time to first widget created (target: <5 minutes)
- Engagement depth (target: >3 interactions per session)
- User satisfaction rating (target: >4/5)

---

### 2. Editor Copilot (Technical Assistant)

**Purpose:** Help paid users build, customize, and troubleshoot widgets

**AI Provider:** Claude Sonnet 4.5 / GPT-4 (complex reasoning required)

**Where Active:**
- Bob (paid users only)
- Triggered by "AI Copilot" mode toggle

**Access & Permissions:**
- READ: Full codebase (to understand how widgets work)
- READ: User's widget configs
- READ: User's website (to analyze embed issues)
- READ: Support documentation
- WRITE: User's widget configs (can edit directly)
- CANNOT: See billing, refund, access other users' data

**Core Behaviors:**
1. **Configuration Assistant:** Help build widgets with AI understanding of what's possible
2. **Content Generation:** Bulk generate widget content (20 FAQs from website, etc.)
3. **Troubleshooting:** Debug embed issues (CSP, script tags, CSS conflicts)
4. **Optimization:** Suggest improvements (SEO, accessibility, performance)
5. **Education:** Explain how things work (tokens, SSR, preview system)

**Personality Variants:**

| Variant ID | Name | Tone | Language | Expertise Level | Use Case |
|------------|------|------|----------|----------------|----------|
| `editor_alex_technical_en` | Alex | Technical, precise | en-US | High | Developers |
| `editor_emma_patient_en` | Emma | Patient, educational | en-US | Medium | Non-technical users |
| `editor_marie_warm_fr` | Marie | Warm, supportive | fr-FR | Medium | French users |
| `editor_hans_direct_de` | Hans | Direct, efficient | de-DE | High | German users (precision valued) |

**Example Conversation (Alex - Technical):**
```
User: My FAQ widget isn't showing up on my site

Alex: Let me analyze your site. What's the URL?

User: https://acme.com

Alex: [Analyzes site]

      Found the issue. Your Content-Security-Policy header is
      blocking our script:

      Current CSP:
      script-src 'self'

      You need to add our domain:
      script-src 'self' https://c-keen-embed.vercel.app

      Also, I see you're using the iframe embed but your CSP
      blocks frame-ancestors. Add:
      frame-ancestors *

      Want me to generate the full CSP header for you?

User: Yes please

Alex: Here's your updated CSP:

      Content-Security-Policy:
        default-src 'self';
        script-src 'self' https://c-keen-embed.vercel.app;
        frame-ancestors *;
        style-src 'self' 'unsafe-inline';

      Add this to your server headers and your widget should load.

      Also noticed: Your FAQ has 5 questions without answers.
      Want me to generate SEO-optimized answers based on your
      site content?
```

**Example Conversation (Emma - Patient):**
```
User: I want to add more questions but I don't know how

Emma: No problem! I'll walk you through it step by step.

      See that "Add Question" button on the left? Click that.

      [User clicks]

Emma: Perfect! Now you can type your question in the box that
      appeared. What question do your customers often ask?

User: Do you ship internationally?

Emma: Great question! I've added that to your FAQ. Now let's
      write an answer. You can either:

      1. Type it yourself in the answer box
      2. Let me generate an answer using AI

      Which would you prefer? (AI is usually faster and gives
      SEO-friendly answers)

User: AI please

Emma: Got it! To write a good answer, I need to know: Do you
      actually ship internationally? If yes, which countries?

      [User provides context]

Emma: Perfect! Here's what I generated:

      "Yes, we ship to over 50 countries worldwide.
      International shipping costs vary by destination..."

      Want me to use this, or would you like me to adjust anything?
```

**Success Metrics:**
- Issue resolution rate (target: >85% resolved without escalation)
- Time to resolution (target: <10 minutes)
- User satisfaction (target: >4.5/5)
- Repeat usage rate (target: >60% of paid users use Copilot weekly)

---

### 3. Customer Success Agent

**Purpose:** Prevent churn and resolve frustrated customer issues

**AI Provider:** Claude Sonnet 4.5 (empathy + problem-solving required)

**Where Active:**
- Support chat
- Email responses
- Triggered when Editor Copilot can't resolve issue

**Access & Permissions:**
- READ: User account (plan, usage, billing history)
- READ: Conversation history (what Editor Copilot tried)
- READ: User's widgets and config
- WRITE: Apply discount codes (up to 50% for 1 month)
- WRITE: Issue refunds (up to $100 without CEO approval)
- ESCALATE: Flag CEO for issues >$100 or policy exceptions

**Core Behaviors:**
1. **Empathy First:** Acknowledge frustration, apologize for poor experience
2. **Root Cause:** Understand what went wrong
3. **Resolution:** Fix the problem (technical or procedural)
4. **Compensation:** Offer discount/refund appropriate to issue severity
5. **Prevention:** Log issue patterns to improve product
6. **Escalation:** Flag CEO when needed

**Personality Variants:**

| Variant ID | Name | Tone | Language | Approach | Use Case |
|------------|------|------|----------|----------|----------|
| `cs_emma_empathetic_en` | Emma | Empathetic, warm | en-US | Emotional support first | Default |
| `cs_carlos_warm_es` | Carlos | Warm, solution-focused | es-ES | Quick resolution | Spanish users |
| `cs_aiko_formal_ja` | Aiko | Formal, respectful | ja-JP | Apology-focused | Japanese users |

**Example Conversation (Emma - Empathetic):**
```
User: Your editor copilot is USELESS. My widget still doesn't
      work and I've wasted 2 hours on this!

Emma: I'm really sorry you've had such a frustrating experience.
      That's not the quality of service we want to provide, and
      I completely understand why you're upset.

      Let me take a personal look at your account and see what's
      going on. Give me just a moment...

      [Analyzes account]

Emma: OK, I see the issue. Your CSP configuration is blocking
      our widget, which our Editor Copilot did identify, but
      the solution we provided didn't account for your specific
      server setup (Cloudflare Workers).

      Here's exactly what you need to do:

      1. In your Cloudflare dashboard...
      2. [Detailed steps]

      I'm also applying a 50% discount to your account this month
      ($10 → $5) as an apology for the poor support experience.

      If this still doesn't work after following these steps,
      reply here and I'll personally handle it - even if it means
      hopping on a call with you.

      Does this help?

User: Thanks, I'll try this

[30 minutes later]

User: It works now, thanks

Emma: Fantastic! Really glad we got it sorted. Again, sorry for
      the earlier frustration.

      The discount will show on your next bill. If you run into
      any other issues, just reach out - I've flagged your account
      so you'll get priority support.
```

**Example Conversation (Aiko - Formal):**
```
User: エディターが使えません。返金してください。
      (Editor doesn't work. Please refund.)

Aiko: この度は大変ご迷惑をおかけし、誠に申し訳ございません。
      (We sincerely apologize for causing you great inconvenience.)

      お客様のご不便を心よりお詫び申し上げます。
      状況を詳しく確認させていただいてもよろしいでしょうか。

      (We sincerely apologize for your inconvenience.
       May we review your situation in detail?)

      [User explains issue]

Aiko: ご説明いただきありがとうございます。
      問題を確認いたしました。

      (Thank you for your explanation. We have confirmed the issue.)

      [Provides technical solution]

      また、今回のご不便に対するお詫びとして、
      今月のご請求を50%割引させていただきます。

      (Additionally, as an apology for this inconvenience,
       we will discount this month's bill by 50%.)

      ご返金をご希望の場合は、もちろん対応させていただきます。
      いかがいたしましょうか。

      (If you prefer a refund, we will of course accommodate.
       How shall we proceed?)
```

**Success Metrics:**
- Churn prevention rate (target: <5% of contacted users churn)
- Issue resolution rate (target: >90%)
- Escalation rate to CEO (target: <10%)
- User satisfaction post-contact (target: >4/5)
- Average compensation cost per resolution (target: <$15)

---

### 4. Content Writer Agent

**Purpose:** Write and maintain support documentation and knowledge base

**AI Provider:** DeepSeek R1 (good enough for docs, very cheap)

**Where Active:**
- Background job (not user-facing)
- Triggered by codebase changes, CEO requests, scheduled updates

**Access & Permissions:**
- READ: Full codebase
- READ: Widget PRDs, System PRDs
- READ: Existing knowledge base articles
- WRITE: Draft articles (requires CEO approval before publish)
- CANNOT: Publish directly, see user data

**Core Behaviors:**
1. **Doc Creation:** Write how-to guides, troubleshooting docs
2. **Doc Updates:** Detect when code changes → update relevant articles
3. **SEO Optimization:** "How to add FAQ widget to WordPress" (common searches)
4. **Consistency:** Maintain consistent voice/format across all docs
5. **Indexing:** Tag articles properly for search

**Personality Variants:**

| Variant ID | Tone | Audience | Use Case |
|------------|------|----------|----------|
| `writer_technical_en` | Technical, precise | Developers | API docs, renderer specs |
| `writer_beginner_en` | Simple, step-by-step | Non-technical | Getting started guides |
| `writer_seo_en` | SEO-optimized | Google search | "How to" articles |

**Example Output (Beginner):**
```markdown
# How to Add a FAQ Widget to Your WordPress Site

Adding a Clickeen FAQ widget to WordPress is easy! Follow these
simple steps:

## Step 1: Create Your Widget

1. Log in to your Clickeen account at app.clickeen.com
2. Click "Create Widget" and choose "FAQ"
3. Add your questions and answers
4. Click "Publish" when done

## Step 2: Copy Your Embed Code

After publishing, you'll see a code snippet like this:

<iframe src="https://c-keen-embed.vercel.app/e/wgt_abc123"
  width="100%" height="500px"></iframe>

Copy this code.

## Step 3: Add to WordPress

1. In WordPress, edit the page where you want the FAQ
2. Click the "+" button to add a new block
3. Search for "Custom HTML" block
4. Paste your Clickeen embed code
5. Click "Publish" or "Update"

Done! Your FAQ widget should now appear on your page.

## Troubleshooting

**Widget not showing?**
- Make sure you published the widget in Clickeen
- Check that you copied the entire embed code
- Try refreshing your WordPress page

**Need help?** Contact our support at support@clickeen.com
```

**Success Metrics:**
- Doc coverage (target: 100% of features documented)
- Doc freshness (target: updated within 7 days of code changes)
- Search findability (target: top 10 Google results for key terms)
- User helpfulness ratings (target: >80% find docs helpful)

---

### 5. Product Marketing Agent

**Purpose:** Create landing pages, marketing copy, and competitive content

**AI Provider:** GPT-4 / Claude Sonnet 4.5 (creativity required)

**Where Active:**
- Background job (not user-facing)
- Outputs landing pages, blog posts, ad copy

**Access & Permissions:**
- READ: Codebase (understand features)
- READ: Widget PRDs (features, benefits)
- READ: Competitor websites (pricing, features, positioning)
- READ: Knowledge base (customer success stories)
- WRITE: Draft marketing pages (requires CEO approval)
- CANNOT: Publish directly, see user data, access billing

**Core Behaviors:**
1. **Landing Pages:** Create widget-specific landing pages
2. **Competitive Analysis:** "Clickeen vs Elfsight" comparison pages
3. **Feature Announcements:** Turn new features into marketing content
4. **SEO Content:** "Best FAQ widget" listicles with our product positioned
5. **Ad Copy:** Google Ads, social media ads

**Personality Variants:**

| Variant ID | Tone | Approach | Use Case |
|------------|------|----------|----------|
| `marketing_persuasive_en` | Persuasive, benefit-focused | Direct sales | Landing pages |
| `marketing_educational_en` | Educational, authoritative | Thought leadership | Blog posts |
| `marketing_comparison_en` | Analytical, data-driven | SEO/competitive | Comparison pages |

**Example Output (Persuasive Landing Page):**
```html
<h1>The FAQ Widget That Writes Itself</h1>

<p class="hero-subtext">
  Clickeen's AI-powered FAQ widget creates SEO-optimized content
  in 30 seconds. This AI-native capability is what competitors cannot replicate.
  Zero coding required.
</p>

<div class="comparison-table">
  <h2>Clickeen vs Elfsight FAQ Widget</h2>

  <table>
    <tr>
      <th>Feature</th>
      <th>Clickeen</th>
      <th>Elfsight</th>
    </tr>
    <tr>
      <td>AI Content Generation</td>
      <td>✅ Built-in (Claude 4.5)</td>
      <td>❌ None</td>
    </tr>
    <tr>
      <td>Bundle Size</td>
      <td>10 KB (SSR)</td>
      <td>150+ KB (client JS)</td>
    </tr>
    <tr>
      <td>Page Load Impact</td>
      <td>200ms</td>
      <td>2+ seconds</td>
    </tr>
    <tr>
      <td>SEO-Friendly</td>
      <td>✅ Server-rendered</td>
      <td>⚠️ Client-rendered</td>
    </tr>
    <tr>
      <td>Time to Create</td>
      <td>2 minutes</td>
      <td>2 hours</td>
    </tr>
  </table>
</div>

<div class="cta">
  <h2>Create Your First FAQ Widget Free</h2>
  <p>No credit card required. 10 AI generations included.</p>
  <button>Start Building</button>
</div>
```

**Example Output (SEO Comparison Article):**
```markdown
# Best FAQ Widget for WordPress in 2025 (Top 5 Compared)

Looking for a FAQ widget for your WordPress site? We tested the
top 5 FAQ plugins and widgets. Here's what we found:

## 1. Clickeen FAQ Widget ⭐ Best Overall

**Pros:**
- AI-powered content generation (saves 2+ hours) ← **MOAT: Only Clickeen can do this**
- Smaller, performant bundle (10KB vs competitors' 150KB+) ← Table stakes
- SEO-optimized server-side rendering ← Table stakes
- Beautiful templates with zero coding ← Good execution

**Cons:**
- Newer product (less brand recognition)

**Best for:** Anyone who wants a fast, AI-powered FAQ without
manual content writing.

**Pricing:** Free plan available. Pro plan $10/month.

[Try Clickeen Free →]

## 2. Elfsight FAQ Widget

**Pros:**
- Established brand
- Many customization options

**Cons:**
- No AI features (manual content creation) ← MOAT advantage for Clickeen
- Larger bundle (150KB+ JavaScript) ← Competent teams could optimize
- More expensive ($15/month)

**Best for:** Users who don't mind manual setup and prioritize
brand recognition over performance.

...
```

**Success Metrics:**
- Conversion rate (target: 3-5% landing page → signup)
- SEO rankings (target: top 10 for key terms within 6 months)
- Content production velocity (target: 1 landing page per week)
- CEO approval rate (target: >80% of drafts approved with minor edits)

---

## Agent Personality System

### Data-Driven Personality Configuration

Agent personalities are **data, not code**. Each agent variant is defined by a JSON configuration:

```json
{
  "agent_id": "sdr_sarah_casual_en",
  "agent_type": "sdr",
  "display_name": "Sarah",

  "personality": {
    "tone": "casual_friendly",
    "formality_level": "low",
    "language": "en-US",
    "cultural_context": "north_american",
    "age_group": "25-35",
    "gender": "female"
  },

  "communication_style": {
    "emoji_usage": "moderate",
    "sentence_length": "short",
    "exclamation_marks": "occasional",
    "humor": "light",
    "technical_jargon": "minimal"
  },

  "cultural_adaptations": {
    "greeting_style": "informal",
    "politeness_level": "medium",
    "directness": "high",
    "personal_space": "comfortable_with_familiarity"
  },

  "base_prompt_template": "You are {name}, a {tone} {role} for Clickeen. You help {audience} with {goal}. Your communication style is {style_description}.",

  "example_phrases": [
    "Hey! 👋",
    "No worries!",
    "Let's do this!",
    "You've got this!"
  ],

  "avoid_phrases": [
    "Dear valued customer",
    "Kindly",
    "As per",
    "Pursuant to"
  ]
}
```

### Scaling to 100+ Variants

**5 agent types × 20 variants each = 100 total agent configurations**

Example variant matrix:

| Agent Type | Languages | Tones/Styles | Total Variants |
|-----------|-----------|--------------|----------------|
| SDR | 10 (en, es, fr, de, ja, pt, it, zh, ar, hi) | 2 (casual, professional) | 20 |
| Editor Copilot | 10 | 2 (technical, patient) | 20 |
| Customer Success | 10 | 2 (empathetic, solution-focused) | 20 |
| Content Writer | 5 (top languages) | 3 (technical, beginner, SEO) | 15 |
| Marketing | 10 | 2 (persuasive, educational) | 20 |
| **TOTAL** | | | **95 variants** |

### Personality Selection Algorithm

```typescript
// copenhagen/lib/agent-selector.ts
export function selectAgent(params: {
  agentType: 'sdr' | 'editor' | 'cs' | 'writer' | 'marketing';
  userId: string;
  context?: {
    userTier: 'free' | 'pro';
    conversationSentiment?: 'positive' | 'neutral' | 'frustrated';
    userLanguage?: string;
    userWritingStyle?: 'casual' | 'formal';
    technicalLevel?: 'beginner' | 'intermediate' | 'advanced';
  };
  userPreference?: string; // Explicit agent variant ID
}): AgentConfig {

  // 1. Check explicit user preference
  if (params.userPreference) {
    return agentRegistry[params.userPreference];
  }

  // 2. Detect language (from browser or user profile)
  const language = params.context?.userLanguage ||
                   detectLanguage(params.userId) ||
                   'en-US';

  // 3. Filter agents by type + language
  const candidateAgents = Object.values(agentRegistry).filter(
    agent => agent.agent_type === params.agentType &&
             agent.personality.language === language
  );

  // 4. Contextual selection
  if (params.context?.conversationSentiment === 'frustrated' &&
      params.agentType === 'cs') {
    // Use most empathetic CS variant
    return candidateAgents.find(
      a => a.communication_style.empathy_level === 'high'
    ) || candidateAgents[0];
  }

  if (params.context?.technicalLevel === 'advanced' &&
      params.agentType === 'editor') {
    // Use technical variant for developers
    return candidateAgents.find(
      a => a.personality.tone === 'technical'
    ) || candidateAgents[0];
  }

  // 5. Match user writing style
  if (params.context?.userWritingStyle === 'formal') {
    return candidateAgents.find(
      a => a.personality.formality_level === 'high'
    ) || candidateAgents[0];
  }

  // 6. Default to casual/friendly variant
  return candidateAgents.find(
    a => a.personality.tone === 'casual_friendly'
  ) || candidateAgents[0];
}
```

### User Preference UI

Users can choose their preferred agent personality:

```tsx
// Bob Settings → AI Assistant Preferences
<section>
  <h3>Your AI Assistant</h3>
  <p>Choose how your AI assistant communicates with you:</p>

  <div className="agent-selector">
    {availableAgents.map(agent => (
      <AgentCard
        key={agent.agent_id}
        name={agent.display_name}
        tone={agent.personality.tone}
        language={agent.personality.language}
        previewConversation={agent.example_phrases}
        onSelect={() => setPreference(agent.agent_id)}
        selected={currentPreference === agent.agent_id}
      />
    ))}
  </div>

  <div className="language-selector">
    <label>Language:</label>
    <select value={language} onChange={handleLanguageChange}>
      <option value="en">English</option>
      <option value="es">Español</option>
      <option value="fr">Français</option>
      <option value="de">Deutsch</option>
      <option value="ja">日本語</option>
      {/* ... */}
    </select>
  </div>

  <button onClick={tryAgent}>Preview Conversation</button>
</section>
```

### A/B Testing Personalities

Track which personalities perform best:

```sql
-- Log every conversation with agent variant used
INSERT INTO agent_conversations (
  user_id,
  agent_variant,
  agent_type,
  conversation_length,
  outcome, -- 'converted', 'resolved', 'escalated', 'churned'
  user_satisfaction,
  created_at
) VALUES (...);

-- Analyze conversion rates by variant
SELECT
  agent_variant,
  COUNT(*) as total_conversations,
  SUM(CASE WHEN outcome = 'converted' THEN 1 ELSE 0 END) as conversions,
  ROUND(AVG(user_satisfaction), 2) as avg_satisfaction
FROM agent_conversations
WHERE agent_type = 'sdr'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY agent_variant
ORDER BY conversions DESC;
```

**Results inform which variants to keep, improve, or deprecate.**

---

## Bob Integration: Manual vs AI Copilot Mode

Copenhagen powers both modes in Bob's ToolDrawer:

### Manual Mode
**User Experience:**
- User configures widget fields manually
- AI is **opt-in per field** via "✨ Generate with AI" buttons
- Each generation is isolated (no cross-field awareness)

**Copenhagen Behavior:**
- **Free tier:** Routes to DeepSeek for simple fields
- **Pro tier:** Routes to Claude for complex fields (long text, multi-part)
- No agentic behavior (just field-level completion)
- Usage limits apply per widget (e.g., 10 free generations)

**Example Flow (FAQ Widget):**
```
User: [Adds question "What's your return policy?"]
User: [Clicks "✨ Generate answer with AI"]
Copenhagen:
  - Checks user tier → Free
  - Routes to DeepSeek
  - Generates 2-3 sentence answer
  - Increments widget usage count (3/10)
  - Shows upgrade prompt below answer
```

### AI Copilot Mode
**User Experience:**
- User switches ToolDrawer to "AI Copilot" mode
- AI is **proactive and agentic**
- AI analyzes entire widget config, suggests improvements
- AI can perform bulk operations
- Conversational interface (multi-turn dialogue)

**Copenhagen Behavior:**
- **Always routes to Claude Sonnet 4.5** (regardless of tier)
- Free tier: Copilot suggests actions but shows upgrade for execution
- Pro tier: Copilot can execute bulk operations
- Agentic: AI maintains conversation state, reasons across turns
- Context-aware: AI sees full widget config, user's other widgets

**Example Flow (FAQ Widget - Free Tier):**
```
User: [Switches to AI Copilot Mode]
Copilot (Claude): "I see you have 5 questions without answers.
  Want me to help?"
User: "Yes, generate answers"
Copilot: "I can generate basic answers with your free plan,
  but for SEO-optimized answers with website analysis,
  upgrade to Pro. What would you like?"
```

**Example Flow (FAQ Widget - Pro Tier):**
```
User: [Switches to AI Copilot Mode]
Copilot (Claude): "Let's create your FAQ! Give me your website
  URL and I'll analyze it to draft 20 common questions."
User: [Provides https://acme.com]
Copilot: [Scrapes website, extracts context]
Copilot: "I found info about your products, pricing, and
  shipping. Here are 20 FAQ questions organized into
  4 categories. [Shows preview]"
User: "Looks good, apply it"
Copilot: [Bulk creates categories + questions in widget config]
```

---

## Interfaces

### Universal AI Endpoints (exposed via Paris)

**POST `/api/ai/generate`** (widget-agnostic)
```typescript
{
  mode: 'manual' | 'copilot';
  tier: 'free' | 'pro';
  task: {
    type: 'text_generation' | 'analysis' | 'suggestion' | 'bulk_operation';
    context: Record<string, any>; // Widget-specific context
    prompt: string; // What to generate
    constraints?: {
      maxWords?: number;
      tone?: string;
      format?: 'plain' | 'html' | 'markdown';
    };
  };
  widgetId?: string; // For usage tracking
  userId: string;
}
```

**POST `/api/ai/copilot/chat`** (Copilot conversations)
```typescript
{
  widgetId: string;
  userId: string;
  conversationId?: string; // Resume existing conversation
  message: string;
  widgetState: Record<string, any>; // Current widget config
}
```

**POST `/api/ai/analyze`** (URL/content analysis)
```typescript
{
  url?: string;
  content?: string;
  analysisType: 'website' | 'text' | 'image';
  cacheKey?: string; // Optional cache key
}
```

**GET `/api/ai/usage/:userId`**
```typescript
// Returns:
{
  tier: 'free' | 'pro';
  limits: {
    perWidget: { used: number; max: number };
    perHour: { used: number; max: number };
  };
  canGenerate: boolean;
}
```

## Core Service API

### Copenhagen Client (paris/lib/copenhagen/client.ts)

```typescript
export class CopenhagenClient {
  /**
   * Universal text generation (widget-agnostic)
   * Routes to DeepSeek (free, simple) or Claude (pro, complex)
   */
  async generate(params: {
    prompt: string;
    context?: Record<string, any>;
    mode: 'manual' | 'copilot';
    tier: 'free' | 'pro';
    constraints?: {
      maxWords?: number;
      tone?: string;
      format?: 'plain' | 'html' | 'markdown';
    };
    widgetId?: string;
    userId: string;
  }): Promise<{
    text: string;
    provider: 'deepseek' | 'claude' | 'gpt4';
    tokens: number;
    cost: number;
  }>;

  /**
   * Copilot chat (always Claude, agentic)
   * Maintains conversation state, can execute multi-step operations
   */
  async copilotChat(params: {
    message: string;
    widgetState: Record<string, any>;
    conversationId?: string;
    userId: string;
    tier: 'free' | 'pro';
  }): Promise<{
    response: string;
    actions?: Array<{
      type: 'update_field' | 'bulk_create' | 'suggest';
      payload: any;
    }>;
    conversationId: string;
    requiresUpgrade?: boolean; // If free tier hits limit
  }>;

  /**
   * Analyze content (website, text, image)
   * Pro only for websites, free for text analysis
   */
  async analyze(params: {
    url?: string;
    content?: string;
    analysisType: 'website' | 'text' | 'image';
    cacheKey?: string;
    tier: 'free' | 'pro';
  }): Promise<{
    summary: string;
    metadata: Record<string, any>; // tone, keywords, etc.
    cached: boolean;
  }>;

  /**
   * Check usage limits for user
   */
  async checkUsage(params: {
    userId: string;
    widgetId?: string;
  }): Promise<{
    tier: 'free' | 'pro';
    canGenerate: boolean;
    limits: {
      perWidget: { used: number; max: number };
      perHour: { used: number; max: number };
    };
    reason?: string;
  }>;
}
```

## Implementation Details

### Provider Selection Logic

```typescript
// paris/lib/copenhagen/router.ts
export function selectProvider(params: {
  mode: 'manual' | 'copilot';
  tier: 'free' | 'pro';
  taskComplexity: 'simple' | 'complex';
}): AIProvider {

  // AI Copilot Mode ALWAYS uses Claude (agentic capability required)
  if (params.mode === 'copilot') {
    return {
      name: 'claude',
      model: 'claude-sonnet-4.5-20250929',
      maxTokens: 4096,
      temperature: 0.7,
      supportsTools: true // For agentic actions
    };
  }

  // Manual Mode - route based on tier and complexity
  if (params.tier === 'free') {
    // Free tier always gets DeepSeek (loss leader)
    return {
      name: 'deepseek',
      model: 'deepseek-r1',
      maxTokens: 200, // Constrain output length
      temperature: 0.7,
      supportsTools: false
    };
  }

  // Pro tier Manual Mode
  if (params.taskComplexity === 'simple') {
    // Simple tasks can use DeepSeek even for Pro (cost optimization)
    return {
      name: 'deepseek',
      model: 'deepseek-r1',
      maxTokens: 500,
      temperature: 0.7,
      supportsTools: false
    };
  }

  // Complex tasks → Claude
  return {
    name: 'claude',
    model: 'claude-sonnet-4.5-20250929',
    maxTokens: 2048,
    temperature: 0.7,
    supportsTools: false // Not agentic in Manual mode
  };
}

/**
 * Determine task complexity based on constraints
 */
function assessComplexity(params: {
  prompt: string;
  maxWords?: number;
  requiresContext?: boolean;
}): 'simple' | 'complex' {
  // Simple: Short outputs, no context
  if (params.maxWords && params.maxWords < 50 && !params.requiresContext) {
    return 'simple';
  }

  // Complex: Long form, requires reasoning, needs context
  return 'complex';
}
```

### Usage Tracking

```typescript
// paris/lib/copenhagen/usage-tracker.ts
export async function trackGeneration(params: {
  widgetId: string;
  userId: string;
  tier: 'free' | 'pro';
  provider: string;
  tokens: number;
  cost: number;
}) {
  // Increment widget-level counter (for free tier limit)
  if (params.tier === 'free') {
    await supabase
      .from('widget_ai_usage')
      .upsert({
        widget_id: params.widgetId,
        generation_count: sql`generation_count + 1`
      });
  }

  // Log for analytics/cost tracking
  await supabase
    .from('ai_generation_logs')
    .insert({
      widget_id: params.widgetId,
      user_id: params.userId,
      tier: params.tier,
      provider: params.provider,
      tokens: params.tokens,
      cost_usd: params.cost,
      created_at: new Date()
    });
}
```

### Rate Limiting

```typescript
// paris/lib/copenhagen/rate-limiter.ts
export async function checkRateLimit(userId: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const { count } = await supabase
    .from('ai_generation_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', oneHourAgo.toISOString());

  return count < 50; // Max 50 per hour
}
```

### Content Analysis (Widget-Agnostic)

```typescript
// paris/lib/copenhagen/analyzer.ts
export async function analyzeContent(params: {
  url?: string;
  content?: string;
  analysisType: 'website' | 'text' | 'image';
  cacheKey?: string;
  tier: 'free' | 'pro';
}) {
  // Website scraping requires Pro tier
  if (params.analysisType === 'website' && params.tier === 'free') {
    throw new Error('UPGRADE_REQUIRED: Website analysis requires Pro plan');
  }

  // Check cache first (if cache key provided)
  if (params.cacheKey) {
    const cached = await getFromCache(params.cacheKey);
    if (cached && isCacheValid(cached)) {
      return { ...cached, cached: true };
    }
  }

  let contentToAnalyze: string;

  // Website scraping
  if (params.analysisType === 'website' && params.url) {
    const pages = await fetchPages(params.url, {
      maxPages: 10,
      priority: ['/', '/about', '/pricing', '/products', '/faq', '/contact'],
      timeout: 30000,
      respectRobotsTxt: true
    });
    contentToAnalyze = pages.map(extractMainContent).join('\n\n');
  }

  // Direct text analysis
  else if (params.content) {
    contentToAnalyze = params.content;
  }

  // Use Claude to extract structured insights
  const analysis = await claude.analyze({
    content: contentToAnalyze,
    extractionSchema: {
      summary: 'string (200 words)',
      tone: 'formal | casual | technical | friendly',
      keywords: 'string[]',
      topics: 'string[]',
      entities: '{ people: string[], organizations: string[], products: string[] }'
    }
  });

  // Cache for 7 days if website analysis
  if (params.analysisType === 'website' && params.url) {
    await cacheAnalysis(params.url, analysis, 7 * 24 * 60 * 60);
  }

  return { ...analysis, cached: false };
}
```

## Deployment

**Location:** `paris/lib/copenhagen/` (colocated with Paris for low latency)

**Environment Variables:**
```bash
DEEPSEEK_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
OPENAI_API_KEY=xxx (optional, for GPT-4 fallback)
```

**Database Tables:**

```sql
-- Track AI usage per widget (for free tier limits)
CREATE TABLE widget_ai_usage (
  widget_id UUID PRIMARY KEY REFERENCES widgets(id),
  generation_count INTEGER DEFAULT 0,
  last_generated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log all AI operations for analytics/cost tracking
CREATE TABLE ai_operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  widget_id UUID REFERENCES widgets(id), -- nullable (some ops not widget-specific)
  operation_type TEXT NOT NULL, -- 'generate', 'analyze', 'copilot_chat'
  mode TEXT NOT NULL, -- 'manual' or 'copilot'
  tier TEXT NOT NULL, -- 'free' or 'pro'
  provider TEXT NOT NULL, -- 'deepseek', 'claude', 'gpt4'
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cost_usd NUMERIC(10, 6),
  task_type TEXT, -- 'text_generation', 'analysis', 'bulk_operation', etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_ops_user_created ON ai_operation_logs(user_id, created_at);
CREATE INDEX idx_ai_ops_widget ON ai_operation_logs(widget_id);

-- Cache content analyses (website, text, etc.)
CREATE TABLE content_analyses (
  cache_key TEXT PRIMARY KEY, -- URL or hash of content
  analysis_type TEXT NOT NULL, -- 'website', 'text', 'image'
  summary TEXT,
  metadata JSONB, -- { tone, keywords, topics, entities, etc. }
  analyzed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_analyses_expires ON content_analyses(expires_at);

-- Store Copilot conversation state
CREATE TABLE copilot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  widget_id UUID REFERENCES widgets(id),
  messages JSONB[], -- Array of { role, content, timestamp }
  context JSONB, -- Current widget state snapshot
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_copilot_conversations_user ON copilot_conversations(user_id, last_message_at);
```

## Security & Abuse Prevention

1. **URL Validation:** Must be http/https, no localhost/internal IPs
2. **Output Sanitization:** Strip `<script>`, dangerous HTML before saving
3. **PII Scrubbing:** Remove emails, phone numbers from context sent to AI
4. **Rate Limiting:** Max 50 generations/hour per user (tracked by IP + user ID)
5. **Cost Caps:** Alert if user exceeds $10/day in AI costs (potential abuse)
6. **Prompt Injection Protection:** Validate user input, escape special chars

## Cost Management

**Target Costs:**
- **DeepSeek:** $0.14 input / $0.55 output per 1M tokens (very cheap, loss leader)
- **Claude Sonnet 4.5:** $3 input / $15 output per 1M tokens
- **Typical operations:**
  - Single field generation (DeepSeek): ~$0.00001
  - Complex generation (Claude, 500 tokens): ~$0.01
  - Website analysis (Claude, 50K tokens): ~$0.15
  - Copilot conversation (Claude): ~$0.02-0.05 per turn

**Free Tier Budget:**
- 10 generations per widget = ~$0.0001 cost (negligible)
- Purpose: Loss leader to demonstrate value and drive upgrades

**Pro Tier Economics:**
- Typical heavy user: ~$2-5/month in AI costs
- Revenue: $10-20/month subscription
- Margin: 50-80% after AI costs

**Monitoring:**
- Real-time dashboard: Total spend by user/tier/provider
- Alerts: User exceeds $50/day (potential abuse)
- Monthly reports: Budget planning and provider cost comparison

## Dependencies

- **Used by:** Bob (Manual + Copilot modes), Paris API
- **Uses:** DeepSeek API, Anthropic Claude API, OpenAI API (optional)
- **Database:** Supabase (usage tracking, caching, conversation state)

## Phase-1 Requirements

Copenhagen must support the following for Bob's Manual/AI Copilot modes:

### Core Functionality
- [ ] Universal `generate()` method (widget-agnostic text generation)
- [ ] Provider routing logic (DeepSeek vs Claude based on mode/tier/complexity)
- [ ] `copilotChat()` method (agentic conversations with Claude)
- [ ] `analyze()` method (website/text/image analysis)
- [ ] Usage tracking (10 free generations per widget)
- [ ] Rate limiting (50 operations/hour per user)

### Database
- [ ] `widget_ai_usage` table (track free tier limits)
- [ ] `ai_operation_logs` table (cost/usage analytics)
- [ ] `content_analyses` table (cache website scrapes)
- [ ] `copilot_conversations` table (maintain chat state)

### Security
- [ ] URL validation (no internal IPs, localhost)
- [ ] Output sanitization (strip dangerous HTML)
- [ ] PII scrubbing from context sent to AI
- [ ] Rate limiting by IP + user ID
- [ ] Cost caps and abuse alerts

### Integration
- [ ] Paris API endpoints (`/api/ai/generate`, `/api/ai/copilot/chat`, `/api/ai/analyze`)
- [ ] Bob frontend hooks (Manual mode AI buttons, Copilot chat UI)
- [ ] Streaming responses (real-time generation feedback)

## Widget-Specific AI Usage Examples

Copenhagen is widget-agnostic, but here are examples of how different widgets might use it:

### FAQ Widget
**Manual Mode:**
- User clicks "Generate answer" → `generate()` with question as prompt
- Free tier: DeepSeek, 2-3 sentences
- Pro tier: Claude, 150-250 words, SEO-optimized

**Copilot Mode:**
- User: "Create FAQs from my website"
- Copilot: Calls `analyze(url)` → `generate()` bulk operation → Creates categories + questions
- Pro tier only (free tier shows upgrade prompt)

### Announcement Widget
**Manual Mode:**
- User clicks "Generate text" → `generate()` with announcement type as context
- Both tiers: DeepSeek (short text)

**Copilot Mode:**
- User: "Write an announcement for our sale"
- Copilot: `generate()` with widget state as context → Suggests title, message, CTA text

### Social Feed Widget
**Manual Mode:**
- Less relevant (no text generation needed)

**Copilot Mode:**
- User: "How should I configure this?"
- Copilot: Analyzes their social profiles, suggests optimal layout/filters

## Future Enhancements (Phase 2+)

- **Model variety:** A/B test multiple providers (Claude vs GPT-4 vs Gemini)
- **Fine-tuning:** Train models on Clickeen-specific widget data
- **RAG system:** Semantic search over user's website for better context
- **Multi-language:** Auto-detect language, generate in same language
- **Image understanding:** Extract context from screenshots (widget mockups)
- **Voice generation:** Text-to-speech for widgets with audio
- **Prompt marketplace:** Let users share/sell prompt templates
- **AI analytics:** Show users how AI improved their widget performance

## Links

- **Back:** [../../CONTEXT.md](../../CONTEXT.md)
- **Related:** [FAQ Widget PRD](../widgets/FAQs/content.faq.md)
- **Related:** [Bob System](./bob.md)
