# UX Writer Agent — Async Localization Intelligence System

STATUS: PRD (not yet implemented)
Created: 2026-01-02

---

## 1) What this is

UX Writer is an **async, durable agent** that continuously improves Clickeen's UI copy and localization by:

1. **Researching** — Analyzing best-in-class products country-by-country to learn UX writing patterns
2. **Auditing** — Comparing our i18n catalogs against learned patterns and internal consistency rules
3. **Proposing** — Generating improved strings with full reasoning
4. **Writing** — Outputting reports and proposed changes for human review

This is **not** a real-time copilot. It's a background intelligence system optimized for quality, cost efficiency, and scale — not latency.

---

## 2) Design principles

| Principle | What it means |
|-----------|---------------|
| **Durable, not fast** | Runs over hours/days. Survives crashes. Resumes from checkpoint. |
| **Token-efficient** | Caches research. Chunks context. Two-phase analysis. Never wastes tokens. |
| **Big data capable** | Handles 100+ competitors, 50+ locales, 10,000+ keys. |
| **Observable** | Progress queryable. Audit trail stored. Dashboard possible. |
| **Human-in-the-loop** | Agent proposes. Humans accept/reject. No auto-commit to live files. |

---

## 3) Architecture

### 3.1 System diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          UX Writer Agent System                             │
│                                                                             │
│  ┌──────────────┐                                                           │
│  │ Cron Trigger │─────────────────────────────────────────┐                │
│  │ (weekly)     │                                         │                │
│  └──────────────┘                                         │                │
│                                                           ▼                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Orchestrator (Durable Object)                                       │   │
│  │                                                                     │   │
│  │ Singleton per run. Owns the entire audit lifecycle.                 │   │
│  │                                                                     │   │
│  │ State:                                                              │   │
│  │   runId: "2026-01-02-001"                                           │   │
│  │   phase: "RESEARCH" | "AUDIT" | "PROPOSE" | "WRITE" | "DONE"        │   │
│  │   startedAt: timestamp                                              │   │
│  │   locales: { en: "done", es: "pending", de: "in_progress", ... }    │   │
│  │   competitors: { notion: "done", canva: "pending", ... }            │   │
│  │   checkpoint: { type: "audit", locale: "de", keyIndex: 142 }        │   │
│  │   stats: { tokensUsed: 0, tasksCompleted: 0, issuesFound: 0 }       │   │
│  │                                                                     │   │
│  │ Methods:                                                            │   │
│  │   start() → enqueue RESEARCH tasks                                  │   │
│  │   onTaskComplete(taskId, result) → update state, maybe advance phase│   │
│  │   alarm() → check progress, retry stuck tasks, continue pipeline    │   │
│  │   getStatus() → return current state for dashboard                  │   │
│  └────────────────────────────────┬────────────────────────────────────┘   │
│                                   │                                        │
│                     Enqueues tasks│                                        │
│                                   ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Task Queue (Cloudflare Queue)                                       │   │
│  │                                                                     │   │
│  │ Durable. Retries on failure. Parallel consumption.                  │   │
│  │                                                                     │   │
│  │ Task types:                                                         │   │
│  │   { type: "research", competitor: "notion", locale: "en" }          │   │
│  │   { type: "audit", locale: "es", widgetName: "faq" }                │   │
│  │   { type: "propose", locale: "de", findings: [...] }                │   │
│  └────────────────────────────────┬────────────────────────────────────┘   │
│                                   │                                        │
│                     Workers consume (parallel)                             │
│                                   ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Task Workers (stateless)                                            │   │
│  │                                                                     │   │
│  │ research:                                                           │   │
│  │   1. Fetch competitor page (or use cached)                          │   │
│  │   2. Extract UX patterns (LLM: summarize, don't store raw HTML)     │   │
│  │   3. Store patterns in D1 (research_patterns table)                 │   │
│  │   4. Notify orchestrator: task complete                             │   │
│  │                                                                     │   │
│  │ audit:                                                              │   │
│  │   1. Load our catalog for locale+widget from R2                     │   │
│  │   2. Load relevant patterns from D1                                 │   │
│  │   3. Compare (LLM: find inconsistencies, gaps, improvements)        │   │
│  │   4. Store findings in D1 (audit_findings table)                    │   │
│  │   5. Notify orchestrator: task complete                             │   │
│  │                                                                     │   │
│  │ propose:                                                            │   │
│  │   1. Load findings for locale from D1                               │   │
│  │   2. Generate improved strings (LLM: propose with reasoning)        │   │
│  │   3. Store proposals in R2 (ux-audits/{runId}/proposed/)            │   │
│  │   4. Notify orchestrator: task complete                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                   │                                        │
│                                   ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Storage Layer                                                       │   │
│  │                                                                     │   │
│  │ D1 (SQLite) — structured, queryable                                 │   │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │ │ research_patterns                                               │ │   │
│  │ │   competitor TEXT, locale TEXT, fetchedAt INTEGER,              │ │   │
│  │ │   patterns JSON (tone, length, terminology, examples)           │ │   │
│  │ │                                                                 │ │   │
│  │ │ audit_findings                                                  │ │   │
│  │ │   runId TEXT, locale TEXT, widgetName TEXT, key TEXT,           │ │   │
│  │ │   issueType TEXT, severity TEXT, currentValue TEXT,             │ │   │
│  │ │   reasoning TEXT, createdAt INTEGER                             │ │   │
│  │ │                                                                 │ │   │
│  │ │ run_history                                                     │ │   │
│  │ │   runId TEXT PRIMARY KEY, startedAt INTEGER, completedAt INTEGER│ │   │
│  │ │   status TEXT, stats JSON                                       │ │   │
│  │ └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                     │   │
│  │ R2 (Objects) — files, reports                                       │   │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │ │ ux-audits/{runId}/                                              │ │   │
│  │ │   report.md              (human-readable summary)               │ │   │
│  │ │   proposed/en.json       (full catalog, ready to use)           │ │   │
│  │ │   proposed/es.json                                              │ │   │
│  │ │   diffs/en.diff          (unified diff for quick review)        │ │   │
│  │ │   diffs/es.diff                                                 │ │   │
│  │ │   metadata.json          (run stats, timing, token usage)       │ │   │
│  │ │                                                                 │ │   │
│  │ │ research-cache/{competitor}/{locale}.json                       │ │   │
│  │ │   (extracted patterns, reused across runs if fresh)             │ │   │
│  │ └─────────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Cloudflare bindings

```toml
# wrangler.toml (ux-writer service)

name = "ux-writer"

[[queues.producers]]
queue = "ux-writer-tasks"
binding = "TASK_QUEUE"

[[queues.consumers]]
queue = "ux-writer-tasks"
max_batch_size = 1
max_retries = 3

[[d1_databases]]
binding = "DB"
database_name = "ux-writer"
database_id = "..."

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "ux-writer-storage"

[[durable_objects.bindings]]
name = "ORCHESTRATOR"
class_name = "UXWriterOrchestrator"

[triggers]
crons = ["0 3 * * 0"]  # Every Sunday at 3am UTC
```

---

## 4) Pipeline phases

### 4.1 RESEARCH

**Goal**: Learn UX writing patterns from best-in-class products, per locale.

**Competitors** (curated list, stored in config):
```json
{
  "competitors": [
    { "name": "notion", "urls": { "en": "https://notion.so", "es": "https://notion.so/es", ... } },
    { "name": "canva", "urls": { "en": "https://canva.com", "es": "https://canva.com/es", ... } },
    { "name": "figma", "urls": { "en": "https://figma.com", ... } },
    { "name": "shopify", "urls": { "en": "https://shopify.com", ... } },
    { "name": "stripe", "urls": { "en": "https://stripe.com", ... } }
  ]
}
```

**Task flow**:
1. Orchestrator enqueues `{ type: "research", competitor, locale }` for each combo
2. Worker fetches page (or uses cache if <30 days old)
3. Worker calls LLM to extract patterns:
   - **Tone**: formal/casual/neutral, pronouns (you/we/they)
   - **Length**: avg button text, avg label, max tooltip
   - **Terminology**: what they call common concepts (item, add, save, etc.)
   - **Examples**: 10-20 representative strings with context
4. Worker stores structured patterns in D1 `research_patterns`
5. Worker notifies orchestrator

**Caching rule**: If `research_patterns` row exists and `fetchedAt > now - 30 days`, skip fetch. Research is expensive; reuse aggressively.

### 4.2 AUDIT

**Goal**: Compare our i18n catalogs against patterns + internal consistency rules.

**Issue types detected**:
| Issue | Description |
|-------|-------------|
| `terminology_mismatch` | Our term differs from industry standard (e.g., "element" vs "item") |
| `tone_inconsistent` | Casual in one place, formal in another (same locale) |
| `too_long` | String exceeds length norms (may break UI) |
| `too_short` | String is terse to the point of unclear |
| `missing_plural` | Plural-capable key lacks `other` form |
| `placeholder_mismatch` | `{count}` vs `{n}` inconsistency |
| `untranslated` | Key exists in `en` but missing in target locale |
| `stale` | Key unchanged since last audit despite flagged issues |

**Task flow**:
1. Orchestrator enqueues `{ type: "audit", locale, widgetName }` for each combo
2. Worker loads our catalogs via Tokyo i18n manifest:
   - Fetch `tokyo/i18n/manifest.json`
   - Fetch `tokyo/i18n/{locale}/{bundle}.{hash}.json` for `coreui` + `{widgetName}`
3. Worker loads relevant patterns from D1
4. Worker calls LLM to compare and identify issues
5. Worker stores findings in D1 `audit_findings`
6. Worker notifies orchestrator

**Chunking**: Process one widget at a time. Never send entire catalog in one LLM call.

### 4.3 PROPOSE

**Goal**: Generate improved strings for all flagged issues.

**Task flow**:
1. Orchestrator waits for all AUDIT tasks to complete
2. Orchestrator enqueues `{ type: "propose", locale }` for each locale with findings
3. Worker loads findings from D1
4. Worker calls LLM to generate proposals:
   - For each finding: current value, proposed value, reasoning
5. Worker writes:
   - Full proposed catalog → R2 `ux-audits/{runId}/proposed/{locale}.json`
   - Unified diff → R2 `ux-audits/{runId}/diffs/{locale}.diff`
6. Worker notifies orchestrator

### 4.4 WRITE

**Goal**: Produce final report and mark run complete.

**Task flow**:
1. Orchestrator waits for all PROPOSE tasks to complete
2. Orchestrator aggregates stats from D1
3. Orchestrator generates `report.md`:
   - Summary (issues by type, by locale, by severity)
   - Top 10 highest-impact changes
   - Per-locale breakdown with links to diffs
   - Token usage and timing stats
4. Orchestrator writes report → R2 `ux-audits/{runId}/report.md`
5. Orchestrator writes metadata → R2 `ux-audits/{runId}/metadata.json`
6. Orchestrator updates `run_history` in D1
7. Orchestrator sets phase = "DONE"

---

## 5) Token efficiency

| Strategy | Implementation |
|----------|----------------|
| **Cache research** | D1 `research_patterns` with 30-day TTL. Skip fetch if fresh. |
| **Incremental audit** | Track `lastAuditedAt` per key. Only re-audit if key changed or pattern changed. |
| **Chunk by widget** | Never send full catalog. One widget's keys per LLM call. |
| **Structured extraction** | Research LLM returns JSON schema, not prose. Smaller output. |
| **Two-phase propose** | Audit phase is cheap (identify). Propose phase is expensive (generate). Only propose for flagged keys. |
| **Embedding retrieval** | (Future) Store patterns as embeddings. Retrieve top-k relevant per key. |

**Token budget tracking**:
- Each task logs `tokensUsed` to orchestrator
- Orchestrator tracks cumulative usage in `stats.tokensUsed`
- Can set hard cap: if `tokensUsed > MAX_TOKENS`, pause and alert

---

## 6) Observability

### 6.1 Dashboard API

Orchestrator exposes `getStatus()`:

```json
{
  "runId": "2026-01-02-001",
  "phase": "AUDIT",
  "startedAt": "2026-01-02T03:00:00Z",
  "progress": {
    "research": { "total": 25, "done": 25 },
    "audit": { "total": 48, "done": 31, "inProgress": 2 },
    "propose": { "total": 0, "done": 0 }
  },
  "stats": {
    "tokensUsed": 142000,
    "issuesFound": 87,
    "tasksCompleted": 56,
    "tasksFailed": 0
  },
  "eta": "2026-01-02T05:30:00Z"
}
```

### 6.2 Alerts

| Condition | Action |
|-----------|--------|
| Task failed 3x | Log to `run_history`, skip task, continue |
| Token budget exceeded | Pause run, alert human |
| No progress for 1 hour | Orchestrator `alarm()` retries stuck tasks |
| Run complete | (Optional) Post to Slack/Discord |

---

## 7) Human review workflow

```
┌─────────────────────────────────────────────────────────────────┐
│  Agent completes run                                            │
│                                                                 │
│  R2: ux-audits/2026-01-02-001/                                  │
│       ├── report.md                                             │
│       ├── proposed/en.json                                      │
│       ├── proposed/es.json                                      │
│       ├── diffs/en.diff                                         │
│       └── diffs/es.diff                                         │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  Human dev                                                      │
│                                                                 │
│  1. Read report.md (summary, top issues, reasoning)             │
│  2. Review diffs/*.diff (quick scan per locale)                 │
│  3. Accept:                                                     │
│     - Apply proposed changes to source catalogs in `i18n/{locale}/`│
│     - Run `pnpm build:i18n` to regenerate `tokyo/i18n/*` outputs │
│     - OR cherry-pick specific changes                           │
│  4. Commit to git                                               │
│  5. Mark findings as "accepted" or "rejected" in D1 (feedback)  │
└─────────────────────────────────────────────────────────────────┘
```

**Feedback loop**: If human marks finding as "rejected", agent learns to deprioritize similar suggestions (stored in D1, used in future PROPOSE phase).

---

## 8) Configuration

```json
// ux-writer-config.json (stored in R2 or repo)
{
  "competitors": [
    { "name": "notion", "urls": { "en": "...", "es": "...", "de": "..." } },
    { "name": "canva", "urls": { "en": "...", "es": "..." } }
  ],
  "locales": ["en", "es", "de", "fr", "pt"],
  "widgets": ["coreui", "faq", "logoShowcase", "testimonials"],
  "researchCacheTtlDays": 30,
  "tokenBudgetPerRun": 500000,
  "llm": {
    "research": { "model": "gpt-4o-mini", "maxTokens": 2000 },
    "audit": { "model": "gpt-4o-mini", "maxTokens": 4000 },
    "propose": { "model": "gpt-4o", "maxTokens": 4000 }
  },
  "schedule": "0 3 * * 0"
}
```

---

## 9) File structure in repo

```
services/
  ux-writer/
    src/
      index.ts              # Cron trigger + queue consumer entry
      orchestrator.ts       # Durable Object
      workers/
        research.ts
        audit.ts
        propose.ts
      lib/
        llm.ts              # LLM client with token tracking
        patterns.ts         # Pattern extraction schema
        diff.ts             # Unified diff generation
    wrangler.toml
    package.json

documentation/
  Agents/
    UXWriterAgent.PRD.md    # This doc
```

---

## 10) Success criteria

| Metric | Target |
|--------|--------|
| **Run completion** | 100% of scheduled runs complete without human intervention |
| **Token efficiency** | <500k tokens per full run (all locales, all widgets) |
| **Issue detection precision** | >80% of flagged issues accepted by human reviewer |
| **Proposal quality** | >60% of proposed strings accepted as-is |
| **Latency** | Full run completes in <6 hours |

---

## 11) Future extensions (not blocking V1)

- **Embedding-based retrieval**: Store patterns as vectors, retrieve top-k per key
- **Auto-PR**: Agent creates GitHub PR instead of just writing to R2
- **A/B testing integration**: Track which proposals improve engagement
- **Real-time mode**: Trigger audit on i18n file change (not just weekly cron)
- **Multi-repo**: Support analyzing multiple products/repos

---

## 12) Dependencies

| Dependency | Purpose |
|------------|---------|
| Cloudflare Workers | Runtime |
| Cloudflare Durable Objects | Orchestrator state |
| Cloudflare Queues | Task distribution |
| Cloudflare D1 | Structured storage (patterns, findings, history) |
| Cloudflare R2 | Object storage (reports, proposed files, cache) |
| OpenAI API (or similar) | LLM for extraction, comparison, generation |
| i18n system (tokyo/i18n/) | Source catalogs to audit |
