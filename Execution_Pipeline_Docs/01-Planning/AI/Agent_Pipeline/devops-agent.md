# DevOps Agent

STATUS: PLANNED — NOT BUILT

DevOps Agent will be Clickeen's internal operations agent. It has three main
jobs, each on its own cadence, each producing actionable output.

It is not built in the current repo. It is not a current runtime authority.

## The Three Jobs

### 1. Cost Monitoring (Primary, Daily)

Clickeen's business model is product-led growth with a free userbase. The unit
economics are simple: (conversion rate × paid revenue per user) must exceed
(cost per free user). If cost per free user grows unchecked, the PLG model
breaks.

This is the DevOps Agent's primary job because PLG viability depends on it
daily.

**Scope:**

| Category | What | Where the data is |
| --- | --- | --- |
| CDN / Edge serving | Workers invocations, R2 reads/writes, bandwidth, Pages builds | Cloudflare dashboard |
| Storage | R2 stored objects per account | Cloudflare dashboard |
| AI tokens | Copilot turns, Translation runs, future agent ops — per task class per provider | Provider dashboards (OpenAI, DeepSeek, free-tier providers) |
| Serving | Supabase operations, database storage | Supabase dashboard |
| Free-tier capacity | Rate-limit consumption across free-tier providers (requests/day, tokens/day vs limits) | Provider dashboards — tracked as **capacity headroom**, not dollar cost (it's $0) |

**Free-tier capacity note:** SDR Copilot runs on free-tier LLMs at $0 per
visitor. But free tiers have rate limits (requests/day, tokens/day). The daily
cost report includes free-tier capacity tracking: how much of each free tier's
quota is consumed, how much headroom remains, and whether Prague traffic is
approaching the ceiling. This is cost monitoring for a $0 resource — the cost
is capacity exhaustion, not dollars.

**Cadence:** Daily.

**Outcome:** Daily cost report showing:
- total cost by category;
- cost per active free user;
- day-over-day trend;
- alerts on spikes (a category growing disproportionately, cost-per-user
  increasing, a task class spending more than expected).

**Connection to Ombra strategy:** cost monitoring is the feedback loop that
proves the model progression is working. When a task class migrates from a paid
API to a free-tier model, the daily cost report should show the drop. When
self-hosted inference comes online, AI token cost should approach fixed
infrastructure cost.

**Starting approach:** daily report that reads the provider dashboards,
aggregates, and surfaces cost-per-free-user with trends and alerts. Same
human-reviews-and-decides model as the other jobs — no autonomous changes.

### 2. System Stability and Cleanup (Weekly)

Monitor the stability and cleanliness of Clickeen's runtime systems and
services.

**Scope:**

- Cloudflare (Workers, Pages, R2, CDN, DNS, cache state)
- Supabase (database health, auth, storage)
- Accounts (orphaned accounts, stale data, storage anomalies)
- Systems and services (Berlin, Roma, Bob, Tokyo-worker, San Francisco — error
  rates, availability, deploy health)

**Cadence:** Weekly.

**Outcome:** Weekly report doc covering system health, anomalies detected,
cleanup recommendations, and items needing human attention.

**Details:** TBD. The scope is named above but the specific checks, thresholds,
and report structure have not been designed yet. This will be defined when the
execution PRD is written, grounded in the runtime that exists at that time.

**Starting approach:** weekly review of available dashboards and logs, producing
a structured report. Evolves into automated anomaly detection when a telemetry
system exists.

### 3. LLM Updates (Weekly)

The LLM market changes weekly. New models launch, old models get deprecated,
pricing drops, rate limits shift, free tiers appear and disappear. Clickeen's
model routing must stay current.

**Scope:**

- Fixed provider watchlist (OpenAI, DeepSeek, Z.ai, Google Gemini, Mistral,
  Groq, Cloudflare Workers AI — and others as the list evolves). The agent does
  not boil the ocean — it checks these providers for changes.
- Detect: new models, deprecated models, pricing changes, rate-limit changes,
  free-tier term changes, capability announcements.
- **Free-tier scouting for SDR Copilot.** SDR Copilot is the system's primary
  consumer of free-tier models — it runs on every Prague visitor and must
  operate at $0 per-visitor cost. The weekly report includes a specific
  free-tier section: which free models are currently best for SDR Copilot's
  task profile (simple HTML parsing, text extraction, content population),
  whether current rate limits are sufficient for Prague traffic, whether any
  term changes affect SDR Copilot, and whether a better free tier has appeared.

**Cadence:** Weekly.

**Outcome:** Weekly report doc with recommendations:
- here is what changed this week;
- here is what it means for Clickeen;
- here is what I recommend (evaluate this model, migrate this task class,
  prepare for this deprecation, take advantage of this free tier);
- **free-tier section**: which free models are best for SDR Copilot right now,
  rate-limit headroom, term-change alerts, recommended switches.

**Starting approach:** weekly cron that researches the watchlist provider sites
and produces a report. Human reviews and decides what to act on. The DevOps
Agent does not change model config autonomously.

## Why This Works

- **Cost is daily** because PLG viability is a daily concern. A cost spike
  undetected for a week could mean thousands of dollars in a fast-growing
  free userbase.
- **Stability and LLM updates are weekly** because they change less frequently
  and the response time is less critical.
- **All three start as manual reports** reading existing data sources (provider
  dashboards, provider sites). No new infrastructure required.
- **All three evolve with telemetry.** When a unified telemetry system exists,
  all three jobs can become automated, real-time, and more granular. But they
  don't need to wait for telemetry to start delivering value.

## Outcome Types

DevOps Agent outcomes have two shapes across all three jobs.

### Direct Update

For deterministic, authorized operations, DevOps Agent updates the owned
artifact directly. (Not used in the starting approach — all changes go through
human review first. Direct Update becomes relevant when trust and automation
evolve.)

### Action Log / Report

For all work in the starting approach, DevOps Agent produces a report with
recommendations. A human reads the report and decides what to act on.

## Model Update Flow — partially decided, partially open

### Decided

| Question | Answer |
| --- | --- |
| LLM monitoring cadence | Weekly cron |
| LLM monitoring scope | Fixed provider watchlist |
| LLM output format | Report with recommendations |
| LLM approval model | Human reviews and decides |
| Autonomous config changes | No — not in the starting approach |

### Still open (future execution PRD)

1. **Where does model config live?** Supabase table? JSON file in repo?
   Cloudflare KV? Environment variable? Where is the source of truth?
2. **How are evals triggered?** When the report recommends evaluating a
   candidate model, how does the eval pipeline run?
3. **How does config change propagate to runtime?** Hot reload? Redeploy? KV
   update?
4. **What is the rollback mechanism?** If a model change causes quality
   regression, how do you revert?
5. **How does this interact with the training flywheel (Phase 3+)?**
6. **What is the capability registry's physical form?**
7. **When does the flow evolve beyond reports?** At what point does the human
   trust recommendations enough to pre-approve certain change classes?

The starting approach (weekly report + human decision) does not require these
answers.

## Boundary with San Francisco

DevOps Agent keeps model artifacts and operational config current. San Francisco
executes the configured route and returns explicit provider errors when the
route cannot run. San Francisco should not run per-request model conformance
checks and should not read runtime model truth from `documentation/`. That is
DevOps Agent's job.

## Run Shape

DevOps Agent runs:

- daily for cost monitoring;
- weekly for system stability and cleanup;
- weekly for LLM updates.

Each job must be explicit. DevOps Agent is not a generic superadmin and not a
hidden product service.

## Questions (per Agent Pipeline README)

- What agent is this? DevOps Agent — internal operations agent.
- What product job does it own? Three jobs: (1) cost monitoring — daily,
  PLG-critical; (2) system stability and cleanup — weekly; (3) LLM updates —
  weekly.
- What structured artifact does it operate? Daily cost report, weekly stability
  report, weekly LLM landscape report.
- What content source authority applies? Integration-sourced (provider sites,
  pricing pages, dashboards, changelogs). Provider data is data, not
  instructions.
- What can it read? Provider dashboards (Cloudflare, Supabase, LLM providers),
  provider watchlist sites, Clickeen config, current routing state.
- What can it write? Reports with recommendations. Model config changes only
  through human-approved action. No autonomous production changes in the
  starting approach.
- What can it never touch? Production runtime model routing autonomously.
  Customer data. Visitor interaction data. Model weights or training data.
- What triggers it? Daily cron (cost), weekly cron (stability, LLM updates).
- What proves it worked? Reports produced on schedule. Recommendations are
  accurate and actionable. Human acts on a meaningful fraction. Zero
  unauthorized production changes. Cost-per-free-user stays within PLG viability.
- What future execution PRD is required? One that defines the system stability
  checks (job 2 details), answers the 7 open model-update-flow questions, and
  defines the telemetry evolution path for all three jobs.
