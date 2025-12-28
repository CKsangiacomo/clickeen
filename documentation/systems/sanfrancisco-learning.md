# San Francisco Learning Architecture

**STATUS: PLANNING — CORE SYSTEM DESIGN**  
**Created:** 2024-12-27  
**Dependency:** sanfrancisco.md (AI orchestration layer)

---

## Overview

Every San Francisco agent must improve over time. Agents don't "learn" by default—LLMs are static. San Francisco builds a **learning system** around them:

```
┌─────────────────────────────────────────────────────────────────┐
│                   SAN FRANCISCO LEARNING                        │
│                                                                 │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐     │
│  │  Agent  │───▶│  Log    │───▶│ Analyze │───▶│ Improve │     │
│  │  Runs   │    │  Store  │    │ Outcomes│    │ Prompts │     │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘     │
│       ↑                                            │           │
│       └────────────── Better Prompt ───────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

**Principle:** Day 1 agents will be mediocre. Day 100 agents should be excellent—automatically.

---

## The Learning Components

### 1. Interaction Log (Universal)

Every agent interaction is logged with the same structure:

```typescript
interface AgentInteraction {
  // Identity
  id: string;
  agentId: AgentType;
  timestamp: Date;
  
  // Context
  sessionId?: string;          // User session (for SDR, Copilots)
  userId?: string;             // Authenticated user (if any)
  locale?: string;             // Language/market context
  
  // Input
  input: {
    prompt: string;            // What user/system asked
    context: object;           // Widget config, current state, etc.
  };
  
  // Output
  output: {
    response: object;          // Agent's response (varies by agent)
    model: string;             // Which LLM was used
    tokens: number;            // Token usage
    latency: number;           // Response time ms
  };
  
  // Outcomes (populated async)
  outcomes: {
    technical: TechnicalOutcome;
    behavioral: BehavioralOutcome;
    business: BusinessOutcome;
  };
  
  // Quality
  quality: {
    autoScore?: number;        // Automated quality score (0-1)
    humanReview?: 'good' | 'bad' | 'golden';
    userFeedback?: 'helpful' | 'not-helpful';
  };
}
```

### 2. Outcome Types

Different agents have different success signals:

```typescript
// Technical: Did it work?
interface TechnicalOutcome {
  valid: boolean;              // Output passed validation
  applied: boolean;            // Output was used/applied
  error?: string;              // If failed, why
}

// Behavioral: Did user engage?
interface BehavioralOutcome {
  continued: boolean;          // User continued after response
  abandoned: boolean;          // User left immediately
  followUp: boolean;           // User asked follow-up
  timeToNext?: number;         // Seconds until next action
}

// Business: Did it drive value?
interface BusinessOutcome {
  converted?: boolean;         // Signed up (SDR)
  paid?: boolean;              // Became paying (SDR)
  taskCompleted?: boolean;     // Finished what they started (Copilot)
  contentPublished?: boolean;  // Content went live (Writer)
  ranking?: number;            // SEO position (Writer)
  engagement?: number;         // CTR, time on page (Marketing)
}
```

### 3. Per-Agent Success Signals

| Agent | Technical | Behavioral | Business |
|-------|-----------|------------|----------|
| **SDR Copilot** | ops valid | user continued | converted, paid |
| **Editor Copilot** | ops valid | user continued, completed task | satisfaction |
| **UI Translator** | valid locale | user kept translation | no corrections needed |
| **Marketing Copywriter** | valid format | — | CTR, conversion rate |
| **Content Writer** | valid article | — | rankings, traffic |
| **Support Agent** | valid response | issue resolved | no escalation |

---

## The Example Bank

### Structure

```typescript
interface ExampleBank {
  agentId: AgentType;
  examples: GoldenExample[];
  lastUpdated: Date;
  version: number;
}

interface GoldenExample {
  id: string;
  input: object;
  output: object;
  outcomes: object;
  
  // Why it's golden
  score: number;               // Composite success score
  addedBy: 'auto' | 'human';
  tags: string[];              // e.g., ['conversion', 'faq-widget', 'color-change']
}
```

### Auto-Selection Criteria

```typescript
// Example: SDR Copilot golden selection
function selectGoldenSDR(interactions: AgentInteraction[]): GoldenExample[] {
  return interactions
    .filter(i => 
      i.outcomes.technical.valid &&
      i.outcomes.technical.applied &&
      i.outcomes.business.converted  // User signed up!
    )
    .sort((a, b) => 
      // Prefer: paid > converted > continued
      scoreInteraction(b) - scoreInteraction(a)
    )
    .slice(0, 100)  // Keep top 100
    .map(toGoldenExample);
}
```

### Diversity Selection

Don't just pick the "best" examples—pick diverse examples that cover different scenarios:

```typescript
function selectDiverseExamples(
  bank: ExampleBank, 
  count: number
): GoldenExample[] {
  // Cluster by: widget type, request type, outcome type
  const clusters = clusterExamples(bank.examples);
  
  // Pick from each cluster
  return clusters
    .map(cluster => pickBest(cluster, Math.ceil(count / clusters.length)))
    .flat()
    .slice(0, count);
}
```

---

## Prompt Evolution

### Prompt Structure

```typescript
interface AgentPrompt {
  agentId: AgentType;
  version: number;
  
  // The prompt
  systemPrompt: string;
  fewShotCount: number;        // How many examples to inject
  
  // Metadata
  createdAt: Date;
  createdBy: 'human' | 'auto';
  parentVersion?: number;
  
  // Performance
  metrics: {
    interactions: number;
    successRate: number;
    conversionRate?: number;
    avgScore: number;
  };
}
```

### Evolution Process

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROMPT EVOLUTION                             │
│                                                                 │
│  v1 (human)                                                     │
│    ↓                                                            │
│  Run for N interactions                                         │
│    ↓                                                            │
│  Analyze: What failed? What worked?                             │
│    ↓                                                            │
│  v2 (auto-suggested, human-approved)                            │
│    ↓                                                            │
│  A/B test v1 vs v2                                              │
│    ↓                                                            │
│  Winner becomes default                                         │
│    ↓                                                            │
│  Repeat                                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Auto-Improvement Analysis

```typescript
async function analyzeAndSuggestImprovements(
  agentId: AgentType,
  recentInteractions: AgentInteraction[]
): Promise<PromptSuggestion[]> {
  
  // 1. Find failure patterns
  const failures = recentInteractions.filter(i => !i.outcomes.technical.valid);
  const failurePatterns = groupByPattern(failures);
  
  // 2. Find success patterns
  const successes = recentInteractions.filter(i => 
    i.outcomes.technical.valid && i.outcomes.business.converted
  );
  const successPatterns = groupByPattern(successes);
  
  // 3. Ask Claude to analyze and suggest
  const analysis = await claude.analyze({
    prompt: `
      Analyze these agent interaction patterns and suggest prompt improvements.
      
      CURRENT PROMPT:
      ${getCurrentPrompt(agentId)}
      
      FAILURE PATTERNS:
      ${JSON.stringify(failurePatterns)}
      
      SUCCESS PATTERNS:
      ${JSON.stringify(successPatterns)}
      
      Suggest specific prompt changes to:
      1. Reduce failures
      2. Replicate successes
      
      Output as JSON: { suggestions: [{ change: string, rationale: string }] }
    `
  });
  
  return analysis.suggestions;
}
```

---

## Feedback Signals

### Implicit Signals (Automatic)

| Signal | How Detected | Meaning |
|--------|--------------|---------|
| User continued | Next action within 5min | Response was useful |
| User abandoned | No action, session ended | Response failed |
| Ops applied | No validation error | Technically correct |
| Task completed | User finished flow | Helpful overall |
| Conversion | Signup event | SDR succeeded |
| Payment | Payment event | High-value conversion |

### Explicit Signals (User Feedback)

```
┌─────────────────────────────────────────┐
│ ✨ Changed the title to blue.           │
│                                         │
│ Was this helpful?  [👍] [👎]            │
└─────────────────────────────────────────┘
```

- Don't show on every response (annoying)
- Show after 3rd interaction, or on abandonment
- Track correlation: thumbs up → continued → converted?

### Human Review (Admin)

```
┌─────────────────────────────────────────────────────────────────┐
│  San Francisco Learning Dashboard                                  │
│                                                                 │
│  Agent: SDR Copilot    Period: Last 7 days                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Success Rate: 78% ↑3%    Conversion: 12% ↑1%            │   │
│  │ Failures: 22%            Pending Review: 15             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Needs Review:                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Input: "make it look more professional"                 │   │
│  │ Output: { ops: [], message: "I'm not sure..." }         │   │
│  │ Outcome: ❌ No ops, user abandoned                      │   │
│  │                                                         │   │
│  │ [Good Response] [Bad - Add to Failures] [Write Golden]  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Prompt Suggestions (Auto-Generated):                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. Add examples for subjective requests like            │   │
│  │    "professional", "modern", "clean"                    │   │
│  │    [Apply] [Dismiss] [Edit]                             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Per-Agent Learning Specifics

### SDR Copilot

**Goal:** Maximize playground → signup → paid

**Key Learnings:**
- Which ops suggestions lead to continued engagement?
- Which CTA phrasings convert best?
- When to show conversion prompt (too early = annoying, too late = missed)?
- Which objections to handle, which to defer?

**Golden Example Criteria:**
```typescript
score = (
  (opsValid ? 0.2 : 0) +
  (userContinued ? 0.2 : 0) +
  (userConverted ? 0.4 : 0) +
  (userPaid ? 0.2 : 0)
);
```

---

### Editor Copilot (Full Bob)

**Goal:** Help users accomplish editing tasks

**Key Learnings:**
- Which complex requests map to which ops?
- When to ask clarifying questions vs. make assumptions?
- How to handle ambiguous requests?
- Content generation quality (for paid feature)

**Golden Example Criteria:**
```typescript
score = (
  (opsValid ? 0.3 : 0) +
  (userContinued ? 0.2 : 0) +
  (taskCompleted ? 0.3 : 0) +
  (userFeedback === 'helpful' ? 0.2 : 0)
);
```

---

### UI Translator

**Goal:** High-quality, consistent UI translations

**Key Learnings:**
- Terminology consistency (same term → same translation)
- UI context (button label vs. help text)
- Cultural adaptation (not just literal translation)
- User corrections (someone edited the translation)

**Golden Example Criteria:**
```typescript
score = (
  (validLocale ? 0.2 : 0) +
  (noCorrectionsNeeded ? 0.5 : 0) +
  (consistentTerminology ? 0.3 : 0)
);
```

**Special:** Track corrections. If human changes translation, that's negative signal AND training data for correct answer.

---

### Marketing Copywriter

**Goal:** Persuasive copy that converts

**Key Learnings:**
- Which headlines get clicks?
- Which CTAs convert?
- Cultural tone per market
- A/B test winners

**Golden Example Criteria:**
```typescript
score = (
  (validFormat ? 0.1 : 0) +
  (abTestWinner ? 0.5 : 0) +
  (conversionRate > baseline ? 0.4 : 0)
);
```

**Special:** Tight integration with A/B testing. Winning variants become golden examples.

---

### Content Writer

**Goal:** SEO content that ranks and engages

**Key Learnings:**
- What content structure ranks?
- Which topics drive traffic?
- Engagement patterns (time on page, scroll depth)
- Per-market keyword effectiveness

**Golden Example Criteria:**
```typescript
score = (
  (validArticle ? 0.1 : 0) +
  (ranksTop10 ? 0.4 : 0) +
  (trafficAboveBaseline ? 0.3 : 0) +
  (engagementAboveBaseline ? 0.2 : 0)
);
```

**Special:** Long feedback loop (SEO takes weeks). Mark content as "pending outcome" and update score over time.

---

### Support Agent

**Goal:** Resolve issues, deflect tickets

**Key Learnings:**
- Which responses resolve issues?
- Which need escalation?
- User satisfaction signals
- Common issues and solutions

**Golden Example Criteria:**
```typescript
score = (
  (validResponse ? 0.2 : 0) +
  (issueResolved ? 0.4 : 0) +
  (noEscalation ? 0.2 : 0) +
  (userSatisfied ? 0.2 : 0)
);
```

---

## Data Pipeline

### Storage

```
┌─────────────────────────────────────────────────────────────────┐
│                    LEARNING DATA STORES                         │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Interactions│  │  Examples   │  │   Prompts   │             │
│  │ (raw logs)  │  │ (bank refs) │  │ (versions)  │             │
│  │             │  │             │  │             │             │
│  │ R2          │  │ D1          │  │ D1          │             │
│  │ immutable   │  │ queryable   │  │ queryable   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

### Tables

```sql
-- D1 (SQLite) schema (conceptual; names can change)
--
-- R2 stores the raw interaction payloads (input/output/outcomes). D1 stores
-- indexes + metadata so we can query, score, and select examples efficiently.

CREATE TABLE sf_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  subject_kind TEXT NOT NULL, -- 'anon' | 'user' | 'service'
  subject_id TEXT NOT NULL,   -- sessionId | userId | serviceId
  locale TEXT
);

CREATE TABLE sf_interactions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  r2_key TEXT NOT NULL,       -- points to the raw payload in R2
  score REAL                  -- 0..1 computed later
);

CREATE TABLE sf_examples (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,       -- points to the raw example payload in R2
  score REAL NOT NULL,
  tags_json TEXT
);

CREATE TABLE sf_prompts (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  prompt_text TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_sf_interactions_agent_time ON sf_interactions(agent_id, created_at_ms DESC);
CREATE INDEX idx_sf_examples_agent_score ON sf_examples(agent_id, score DESC);
```

### Jobs

| Job | Frequency | Purpose |
|-----|-----------|---------|
| `update-outcomes` | Real-time (webhook) | Add conversion/payment outcomes |
| `score-interactions` | Hourly | Calculate quality scores |
| `update-example-bank` | Daily | Select new golden examples |
| `analyze-failures` | Weekly | Generate prompt suggestions |
| `prompt-ab-test` | Ongoing | Compare prompt versions |

---

## Implementation Phases

### Phase 1: Logging Foundation
- [ ] `agent_interactions` table
- [ ] Logging middleware for all San Francisco agents
- [ ] Basic outcome tracking (technical only)

### Phase 2: Example Bank
- [ ] `agent_examples` table
- [ ] Auto-selection for golden examples
- [ ] Inject examples into prompts

### Phase 3: Outcome Tracking
- [ ] Behavioral outcomes (continued, abandoned)
- [ ] Business outcomes (converted, paid) via webhooks
- [ ] User feedback UI (thumbs up/down)

### Phase 4: Analysis & Evolution
- [ ] Failure pattern analysis
- [ ] Auto-generated prompt suggestions
- [ ] Admin dashboard for review
- [ ] A/B testing for prompts

### Phase 5: Full Automation
- [ ] Auto-approve prompt improvements (with guardrails)
- [ ] Per-market/locale learning
- [ ] Cross-agent learning (shared patterns)

---

## Success Metrics

| Metric | Week 1 | Month 1 | Month 3 |
|--------|--------|---------|---------|
| SDR conversion rate | 5% | 12% | 18% |
| Editor task completion | 60% | 75% | 85% |
| Translation correction rate | 20% | 10% | 5% |
| Content ranking (top 10) | 10% | 30% | 50% |

**The goal:** Measurable improvement every week, automatically.

---

## Open Questions

1. **Human review capacity:** How much human review is realistic? Weekly? Daily?
2. **A/B test traffic split:** 50/50 or winner-take-most with exploration?
3. **Cross-agent learning:** Can SDR learnings help Editor Copilot?
4. **Privacy:** How long to retain interaction logs? GDPR considerations?
5. **Cost monitoring:** Learning analysis uses Claude—budget for this?
