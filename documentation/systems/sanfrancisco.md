# San Francisco — AI Workforce OS

**STATUS: NORMATIVE — PHASE 1 PLANNING**

San Francisco is Clickeen's AI operating system — the infrastructure that runs all AI agents who operate the company.

---

## The Workforce OS

Clickeen is an **AI-First Company**:

| Layer | Who/What | Responsibility |
|-------|----------|----------------|
| **Vision** | 1 Human | Product vision, architecture, taste, strategic decisions |
| **Building** | AI Coding | Write code from specs (Cursor, Claude, GPT) |
| **Operating** | AI Agents (San Francisco) | Sales, support, marketing, localization, ops |

**San Francisco runs the workforce:**

| Agent | Role | Replaces |
|-------|------|----------|
| SDR Copilot | Convert visitors in Minibob | Sales team |
| Editor Copilot | Help users customize widgets | Product specialists |
| Support Agent | Resolve user issues | Support team |
| Marketing Copywriter | Funnels, landing pages, PLG copy | Marketing team |
| Content Writer | Blog, SEO, help articles | Content team |
| UI Translator | Product localization | Localization team |
| Ops Monitor | Alerts, incidents, monitoring | DevOps/SRE team |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      SAN FRANCISCO SYSTEM                           │
│                                                                     │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐       │
│  │    API    │  │   State   │  │   Jobs    │  │   Admin   │       │
│  │           │  │           │  │           │  │           │       │
│  │ • Agents  │  │ • Sessions│  │ • Crons   │  │ • Review  │       │
│  │ • Routes  │  │ • Context │  │ • Pipes   │  │ • Metrics │       │
│  │ • LLM     │  │ • History │  │ • Analysis│  │ • Config  │       │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘       │
│        │              │              │              │               │
│        └──────────────┴──────────────┴──────────────┘               │
│                              │                                      │
│                    ┌─────────┴─────────┐                           │
│                    │   Data Layer      │                           │
│                    │   D1 + KV + R2    │                           │
│                    └───────────────────┘                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Infrastructure | Purpose |
|-----------|----------------|---------|
| **API** | Cloudflare Workers | Handle agent requests |
| **State** | Cloudflare KV | Session storage (24h TTL) |
| **Persistence** | D1 + R2 | Queryable metadata + raw payloads |
| **Jobs** | Queues + Cron Triggers | Async logging, scheduled analysis |
| **Admin** | DevStudio integration | Review queue, metrics, prompt editor |

---

## API Endpoints

```
GET  /healthz                 → Service health (no auth)
POST /v1/execute              → All agents (strict grant required)
POST /v1/learning/outcome     → Attach outcomes (internal; called by Paris)
```

### Execute Request

```typescript
interface ExecuteRequest {
  grant: string;              // HMAC-signed AI Grant from Paris
  agentId: AgentType;         // 'sdr.copilot' | 'editor.copilot' | etc.
  input: object;              // Agent-specific input
  trace?: { requestId?: string };
}

interface ExecuteResponse {
  requestId: string;
  agentId: AgentType;
  result: AgentResult;        // ops[], message, suggestions, etc.
  usage: { model: string; tokens: number; latencyMs: number };
}
```

### AI Grant (Security)

Paris issues grants; San Francisco validates them:

```typescript
interface AIGrant {
  iat: number;                // Issued at (epoch seconds)
  exp: number;                // Expires at (epoch seconds)
  sub: string;                // Subject (user/session ID)
  caps: string[];             // Capabilities: ['agent:sdr.copilot']
  budgets: {
    maxTokens: number;
    maxRequests: number;
    maxCostUsd: number;
  };
  trace?: { requestId?: string };
}
```

---

## Learning System

**Principle:** Day 1 agents are mediocre. Day 100 agents are excellent — automatically.

```
┌─────────────────────────────────────────────────────────────────┐
│                   LEARNING LOOP                                  │
│                                                                 │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐     │
│  │  Agent  │───▶│  Log    │───▶│ Analyze │───▶│ Improve │     │
│  │  Runs   │    │  Store  │    │ Outcomes│    │ Prompts │     │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘     │
│       ↑                                            │           │
│       └────────────── Better Prompt ───────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

### Interaction Logging

Every agent interaction is logged:

```typescript
interface AgentInteraction {
  id: string;
  agentId: AgentType;
  timestamp: Date;
  sessionId?: string;
  userId?: string;
  locale?: string;
  
  input: { prompt: string; context: object };
  output: { response: object; model: string; tokens: number; latency: number };
  
  outcomes: {
    technical: { valid: boolean; applied: boolean; error?: string };
    behavioral: { continued: boolean; abandoned: boolean; followUp: boolean };
    business: { converted?: boolean; paid?: boolean; taskCompleted?: boolean };
  };
  
  quality: {
    autoScore?: number;
    humanReview?: 'good' | 'bad' | 'golden';
    userFeedback?: 'helpful' | 'not-helpful';
  };
}
```

### Example Bank

Golden examples are automatically selected based on outcomes:

```typescript
// SDR Copilot scoring
score = (
  (opsValid ? 0.2 : 0) +
  (userContinued ? 0.2 : 0) +
  (userConverted ? 0.4 : 0) +
  (userPaid ? 0.2 : 0)
);
```

### Prompt Evolution

```
v1 (human) → Run for N interactions → Analyze → v2 (auto-suggested)
                                                      ↓
                                              A/B test v1 vs v2
                                                      ↓
                                              Winner becomes default
```

---

## Data Storage

San Francisco owns its own storage (does NOT read/write Michael):

| Store | Purpose | Data |
|-------|---------|------|
| **KV** | Hot state | Active sessions (24h TTL) |
| **R2** | Raw payloads | Full input/output/traces |
| **D1** | Indexes | Sessions, interactions, prompts, examples |

### D1 Schema

```sql
CREATE TABLE sf_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  subject_kind TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  locale TEXT
);

CREATE TABLE sf_interactions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  score REAL
);

CREATE TABLE sf_prompts (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  prompt_text TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE sf_examples (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  score REAL NOT NULL,
  tags_json TEXT
);
```

---

## Jobs

| Job | Frequency | Purpose |
|-----|-----------|---------|
| `score-interactions` | Hourly | Calculate quality scores |
| `update-example-banks` | Daily 3AM | Refresh golden examples |
| `analyze-and-improve` | Weekly | Generate prompt suggestions |
| `cleanup-old-sessions` | Daily 2AM | Remove expired data |
| `on-user-converted` | Event | Update outcomes on conversion |
| `on-user-paid` | Event | Update outcomes on payment |

---

## Code Structure

```
sanfrancisco/
├── src/
│   ├── index.ts              # Worker entry (fetch + queue + scheduled)
│   ├── agents/
│   │   ├── sdrCopilot.ts     # SDR agent implementation
│   │   ├── editorCopilot.ts  # Editor agent implementation
│   │   └── ...
│   ├── jobs/
│   │   ├── cron.ts           # Scheduled jobs
│   │   └── queue.ts          # Queue consumers
│   ├── learning/
│   │   ├── scoring.ts        # Score calculation per agent
│   │   ├── selection.ts      # Example selection algorithms
│   │   ├── analysis.ts       # Failure pattern analysis
│   │   └── evolution.ts      # Prompt improvement logic
│   ├── lib/
│   │   ├── llm.ts            # LLM client (DeepSeek, Claude)
│   │   ├── d1.ts             # D1 helpers
│   │   ├── r2.ts             # R2 helpers
│   │   ├── kv.ts             # KV session helpers
│   │   └── prompts.ts        # Prompt building
│   ├── grants.ts             # Grant verification
│   ├── http.ts               # HTTP utilities
│   └── types.ts              # Shared types
├── wrangler.toml
└── package.json
```

---

## Deployment

```toml
# sanfrancisco/wrangler.toml
name = "sanfrancisco-dev"
main = "src/index.ts"
compatibility_date = "2025-12-28"

[[kv_namespaces]]
binding = "SF_KV"
id = "xxx"

[[d1_databases]]
binding = "SF_D1"
database_name = "sanfrancisco_d1_dev"
database_id = "xxx"

[[r2_buckets]]
binding = "SF_R2"
bucket_name = "sanfrancisco-logs-dev"

[[queues.producers]]
binding = "SF_EVENTS"
queue = "sanfrancisco-events-dev"

[[queues.consumers]]
queue = "sanfrancisco-events-dev"
```

### Environment Variables

```bash
AI_GRANT_HMAC_SECRET=xxx
DEEPSEEK_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
OPENAI_API_KEY=xxx
```

---

## Cost Estimate

| Component | Usage | Monthly Cost |
|-----------|-------|--------------|
| Workers | 100M requests | ~$50 |
| KV | 10M reads, 1M writes | ~$5 |
| D1 | Metadata storage | ~$5 |
| R2 | Log storage | ~$10 |
| Queues | Background work | ~$5 |
| DeepSeek | Agent calls | ~$100 |
| Claude | Analysis | ~$50 |
| **Total** | | **~$225/month** |

---

## Implementation Phases

### Phase 1: Foundation (Current)
- [x] Worker with `/v1/execute`
- [x] Grant verification
- [x] SDR Copilot agent
- [ ] KV session management
- [ ] Queue-based logging

### Phase 2: Learning Infrastructure
- [ ] D1 schema + R2 buckets
- [ ] Scoring algorithms
- [ ] Example bank management
- [ ] Daily update jobs

### Phase 3: Admin Interface
- [ ] DevStudio San Francisco pages
- [ ] Review queue
- [ ] Prompt editor
- [ ] Metrics dashboard

### Phase 4: Automation
- [ ] Failure analysis job
- [ ] Auto-suggested improvements
- [ ] A/B testing framework
- [ ] Outcome tracking webhooks
