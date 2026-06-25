# Headroom Context-Compression Layer — Clickeen Decision Brief

**Date:** June 25, 2026
**Subject:** Headroom (`headroom-ai`, by Tejas Chopra / Netflix) — the open-source "context compression layer for AI agents."
**Scope:** What the tool actually does (from source, not marketing); where and how it could attach to Clickeen; the realistic injection options and their trade-offs.
**Recommendation:** Do not adopt Headroom as-is on speculation. Instrument San Francisco's real per-call token spend first; if a cost surface exists, the highest-value move is a small **Clickeen-native, in-Worker, JSON-aware compactor** at the model-call chokepoint — not a Beta Python/ONNX sidecar with known correctness bugs. Treat Headroom as a *design reference*, not a *dependency*. (This is a recommendation with reasoning; only the human decides scope/build.)

---

## How this was evaluated (and one honest limitation)

I did the following, in order:

1. **Verified the tool is real** (not a Medium invention): repo [headroomlabs-ai/headroom](https://github.com/headroomlabs-ai/headroom); `headroom-ai` on npm (latest published `0.22.4`) and PyPI (Apache-2.0, "Development Status :: 4 - Beta"). Author confirmed as Tejas Chopra (Netflix) via [The Register](https://www.theregister.com/ai-ml/2026/05/31/netflix-wiz-creates-app-to-slash-ai-bills-then-open-sources-it/5248702).
2. **Cloned the repo** and read the primary source: `README.md`, `llms.txt`, `pyproject.toml`, `crates/headroom-core/Cargo.toml`, `headroom/compress.py`, the transform pipeline, the proxy/MCP/CLI, the TS SDK, telemetry, and the `REALIGNMENT/` bug track.
3. **Mapped Clickeen's real LLM egress** in source (San Francisco is the sole production model caller; base URLs are already env-overridable).
4. **Ran an architecture subagent** to independently corroborate the internals and the deployment-feasibility verdict (all claims below are source-cited).

**Honest limitation — I could not execute the engine on this machine.** `pip install headroom-ai` has **no prebuilt wheel for Intel macOS** (`x86_64-apple-darwin`), so pip fell back to a source build, which died because the Rust core transitively requires **ONNX Runtime (`ort-sys`)** and that ships no prebuilt artifact for this target. There is no Docker on this machine and no Rust toolchain to force a build. So the savings numbers below are **the vendor's published claims, attributed as such** — I did not reproduce them locally. This is itself a deployment-friction data point (see B.4): Headroom's build/runtime drags ONNX Runtime + downloaded ML models everywhere it goes.

---

# A. What the tool does

## A.1 The problem it names

Run a coding/agent loop for an hour and look at what actually went to the model: it's mostly *re-reading* — full log dumps, the same file printed three times, a 200-line JSON blob when the agent needed four fields. Headroom compresses that waste *before* it reaches the model, and (its better idea) keeps the originals retrievable so nothing is permanently lost.

## A.2 Real architecture — Rust core + Python + ONNX, four delivery modes

The build backend is **maturin** (`pyproject.toml`): the engine is a **Rust core** (`crates/headroom-core`) bound to Python via PyO3 (`crates/headroom-py`, cdylib `_core`), wrapped by a large Python package. `requires-python = ">=3.10"`. The same pipeline is exposed four ways:

- **Library** — `from headroom import compress` (`headroom/compress.py:162`), in-process.
- **HTTP proxy** — `headroom proxy` on `:8787` — **Python FastAPI** (`headroom/proxy/server.py`), OpenAI- *and* Anthropic-compatible. Intercepts `/v1/chat/completions`, `/v1/messages`, `/v1/responses`.
- **MCP server** — `headroom_compress` / `headroom_retrieve` / `headroom_stats` tools (`headroom/ccr/mcp_server.py`).
- **Agent wrap** — `headroom wrap claude|codex|…` — re-points the agent's base URL at the proxy; **does not touch API keys**.

> Note: there is a Rust `crates/headroom-proxy`, but the CLI **does not use it** — the CLI runs the Python proxy. The string "headroom-proxy" in `server.py` is just a telemetry label.

## A.3 The compression pipeline

Real stage order (`headroom/transforms/pipeline.py`): **`CacheAligner → ContentRouter → {compressor}`**. The README's "→ CCR" is conceptual; CCR markers are emitted *inside* compressors and retrieval is injected at the proxy layer.

- **CacheAligner** (`cache_aligner.py`) — **detector-only today.** It logs warnings about volatile tokens (UUIDs, timestamps, JWTs, hashes) but `apply()` returns **byte-equal messages**; it never mutates the prompt. The old rewrite path was removed for violating the cache-hot-zone invariant. **Translation: Headroom's advertised "stabilize prefixes so KV cache hits" benefit is currently inert.**
- **ContentRouter** (`content_router.py:1276`) — picks a compressor by content type: JSON→SmartCrusher, code→CodeCompressor, search→Search, build output→Log, diff→Diff, prose→Kompress. Detection uses the Rust native path (which itself uses Google's **Magika** ONNX classifier); pure-regex fallback on Windows. **Magika is optional** (try/except-guarded, only in the `[proxy]` extra).
- **SmartCrusher** (Rust `_core.SmartCrusher`) — the JSON/array workhorse. Lossless compaction (tabular JSON→CSV+schema, byte-perfect); optional **lossy row-drop** (keep first 30%, last 15%, max 15 items, drop the middle with a `<<ccr:HASH N_rows>>` marker); opaque-blob offload (long strings→marker, original cached).
- **CodeCompressor** — **tree-sitter** AST (not ast-grep for the library path). Preserves imports, signatures, type annotations, decorators; strips comments and keeps ~20% of function bodies (max 5 lines); docstring = first line. (ast-grep is a *proxy-interceptor* dep, not core `compress()`.)
- **Kompress** — ML text compressor (ModernBERT). **ONNX Runtime primary (no torch)**, torch fallback (`[ml]`). Model `chopratejas/kompress-v2-base` **downloaded from HuggingFace at runtime** (~30 MB, cached after first use).
- **TextCrusher** — deterministic BM25 extractive compressor for large prose; milliseconds, no ML.
- **CCR (Compress-Cache-Retrieve)** — originals stored in **SQLite** by default (`~/.headroom/ccr_store.db`, WAL, 30-min TTL, SHA-256[:24] key). Redis/in-memory backends available. The model calls `headroom_retrieve` to get an original back. **This is the genuinely elegant idea** — compression that doesn't force a cost-vs-correctness bet up front.

## A.4 Output-token reduction (what the model writes *back*)

`HEADROOM_OUTPUT_SHAPER=1` (off by default): **verbosity steering** (append a "be terse, don't restate" note to the system prompt — *appended*, so the prompt cache still hits) and **effort routing** (dial down thinking on routine tool-resume turns; full effort on new questions/errors). Because the unshaped counterfactual is unknowable, savings are reported as an **estimate with a confidence interval**, or **measured** if you hold out a 10% unshaped control group (`HEADROOM_OUTPUT_HOLDOUT=0.1`). The measurement discipline is exemplary — worth copying regardless of adoption.

## A.5 `headroom learn` + memory + TOIN

`headroom learn` mines failed sessions and writes corrections into `CLAUDE.md`/`AGENTS.md`. Persistent per-project memory = SQLite + HNSW vectors (`[memory]`). Separately, **TOIN (Tool Output Intelligence Network)** stores *tool-output compression patterns* locally (`headroom/telemetry/toin.py`) — privacy-relevant: review this if tool-output sensitivity matters.

## A.6 Telemetry / privacy

Aggregate-only beacons (versions, OS, tokens_saved, cache_hit_rate, models *by name only*) sent to a **Supabase** endpoint, INSERT-only. **No prompts, content, PII, or keys.** Important README/source discrepancy: telemetry is **opt-in / fail-closed** (`is_telemetry_enabled()` runs only when `HEADROOM_TELEMETRY` is an explicit on-value; unset = off). The README's "enabled by default" refers to the *warning notice*, not telemetry itself. Fail-closed everywhere (missing httpx / failed POST → silently skip).

## A.7 Maturity and known correctness bugs — read this before anything else

Status: **Beta** (`pyproject.toml`). The `REALIGNMENT/` track documents **five P0 "cache-killer" bugs** that can collapse Anthropic prompt-cache hit rates toward 0%:

1. System prompt mutated in the cache-hot zone.
2. **JSON re-serialization** (`httpx json=body`) changes separators → breaks upstream byte-equality.
3. `frozen_message_count: 0` hardcoded (Rust Anthropic path, with a TODO).
4. ICM drops messages from the cache hot zone instead of compressing only the live zone.
5. `serde_json` numeric precision loss (`1.0`→`1`).

Plus: SSE streaming decodes with `errors="ignore"/"replace"` (silently drops emoji/CJK bytes split across reads), and a lossy LiteLLM Anthropic→OpenAI bridge that drops `thinking`/`image`/`document` blocks.

Bugs 3–5 are in the Rust proxy crate the CLI doesn't use; bugs 1–2 and the streaming issue are in the Python path Clickeen *would* use. **Net: Headroom can currently *break* prompt-caching and drop bytes from streamed responses.** Anyone adopting it must validate cache-hit rate and streaming fidelity empirically, not trust the headline savings.

## A.8 The claims vs. the evidence

Vendor benchmarks (README, *not reproduced here*): 92% fewer tokens on code-search and SRE-debug payloads, 73% on issue triage; accuracy "preserved" on GSM8K/TruthfulQA/BFCL. These are plausible *for the workloads Headroom is built for* (developer-agent tool outputs, logs, code). They are vendor-published and I could not reproduce them. **Fit for Clickeen is discussed in B.6** — Clickeen's payloads are structured widget JSON + prompts, which is SmartCrusher's sweet spot but not the workloads in those tables.

---

# B. Where and how it could attach to Clickeen

## B.1 Clickeen's LLM egress map (source-verified)

**San Francisco is the sole production model caller.** Three outbound sites, all OpenAI-compatible:

| Site | File | Endpoint | Base URL overridable? |
|---|---|---|---|
| OpenAI provider | `sanfrancisco/src/providers/openai.ts:103-104` | `${OPENAI_BASE_URL}/v1/chat/completions` | **Yes** — `OPENAI_BASE_URL ?? 'https://api.openai.com'` |
| DeepSeek provider | `sanfrancisco/src/providers/deepseek.ts:47,51` | `${DEEPSEEK_BASE_URL}/v1/chat/completions` | **Yes** — `DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'` |
| Prague l10n (OpenAI Responses) | `sanfrancisco/src/prague-l10n-strings.ts:143` | `https://api.openai.com/v1/responses` | **No — hardcoded** |

Everything funnels through one function: **`callChatCompletion`** (`sanfrancisco/src/ai/chat.ts:41`), which dispatches to `callOpenAiChat` / `callDeepseekChat`. Messages are plain OpenAI `{role, content}`; calls are **non-streaming**; usage (`prompt_tokens`/`completion_tokens`) is read back for grant accounting.

**Who calls San Francisco:**
- **Roma** → San Francisco over HTTP via `SANFRANCISCO_BASE_URL` (`roma/lib/env/sanfrancisco.ts`).
- **Translation Agent & Product Copilot** → San Francisco via a **service binding** `SANFRANCISCO_AI_ENGINE` (Fetcher) to `https://sanfrancisco.internal/model/chat` (`agents/translation-agent/src/worker.ts:308-317`, `agents/product-copilot/src/worker.ts:90-100`).
- The only other LLM call in the repo is an **eval harness** (`agents/product-copilot/evals/real-eval.ts`), not runtime.

San Francisco itself is a **Cloudflare Worker** (`sanfrancisco/wrangler.toml`: `sanfrancisco-dev`, KV/D1/R2/Queues bindings).

## B.2 The decisive constraint

**Headroom's engine cannot run inside a Cloudflare Worker V8 isolate.** It is Python + Rust(PyO3) + ONNX Runtime + tree-sitter + SQLite + subprocess (ast-grep/difft/scc binaries downloaded at runtime). None of that is available in a Worker. And the **npm `headroom-ai` TS SDK is not an engine — it is a pure HTTP client**: every method (`compress`, `retrieve`, `stats`) is just `this._fetch("/v1/compress", …)` to a running proxy (`sdk/typescript/src/client.ts`), with **zero runtime dependencies** and a fallback that returns the *uncompressed* input on failure. So "install the SDK in the Worker" does nothing useful — it just adds a subrequest hop to a backend the Worker can't host.

**Conclusion: for Clickeen, Headroom is only ever an *external* service San Francisco calls.** The real question is *where that service runs and how San Francisco reaches it*.

## B.3 The natural injection surface (near-zero-code)

Because `OPENAI_BASE_URL` / `DEEPSEEK_BASE_URL` already exist, the cleanest possible wiring is **pure env**: point them at a Headroom proxy. San Francisco already sends `Bearer ${OPENAI_API_KEY}` and reads standard `usage` back, so grant accounting keeps working unchanged. The one gap is the hardcoded Prague `/v1/responses` call (B.1) — covering it needs a one-line env override added there, or it stays uncompressed.

## B.4 What a deployment actually requires

Running the proxy means standing up a **stateful Python/Rust/ONNX service** co-located so Workers can reach it:

- A **long-lived process** (FastAPI/uvicorn) — not serverless-cold-start friendly; ~30 MB ML model download from HuggingFace on first run (pre-cache or accept the cold start).
- **Persistent storage** for CCR originals (SQLite file, or Redis for horizontal scale). Retrieval round-trips must land on the same instance (sticky) or use Redis.
- **Auth + network exposure**: if the proxy sits in front of the real provider keys, it becomes an **open OpenAI-key relay** unless authenticated and private. Must not be public.
- **Added latency** on every model call (Worker → proxy → upstream), and a new operational surface (versioning the proxy, monitoring CCR size, the REALIGNMENT bugs).
- On **Intel macOS dev machines**, even `pip install` fails (no wheel, ort-sys build fails) — dev friction unless everyone develops against a shared containerized proxy.

## B.5 What does not work / what to avoid

- ❌ In-Worker compression (engine can't run there).
- ❌ TS SDK as an in-Worker engine (it's a client; adds a hop, does no work).
- ❌ Relying on **CacheAligner** today — it's detector-only, currently inert (A.3).
- ❌ Trusting headline savings without validating cache-hit rate and streaming fidelity (A.7).

## B.6 Fit against Clickeen doctrine

This is where it gets uncomfortable, and it's the core of the recommendation:

- **"No legacy inertia / design target state" (pre-GA).** Clickeen is pre-GA and explicitly should *design the target state, not harden/migrate scaffolding*. Bolting on a **Beta, third-party, stateful Python/ONNX sidecar with documented correctness bugs** is the definition of legacy-inertia-by-import — a new runtime surface, a new dependency graph, a new set of failure modes (prompt-cache collapse, byte-drops) that Clickeen would then "harden around."
- **"Code to use cases, not invented boundaries."** Headroom's full pipeline (Kompress prose ML, code tree-sitter, diff/log compressors) is general-purpose machinery. Clickeen's *actual* model payloads are **structured widget config/content JSON** (the schema-driven substrate) plus prompts. That is overwhelmingly **SmartCrusher territory** — lossless JSON compaction + optional lossy row-drop — which is the **highest-value, lowest-complexity 10% of Headroom**, needs **no ML, no sidecar, no binaries**, and **runs natively in the Worker**. The prose/code/log compressors serve workloads Clickeen largely doesn't have.
- **"Agent-operated product."** The cost surface is real and growing (Babel mass-translation, copilot, future apps). *Something* will likely be wanted — but "wanting token economy" does not force "adopt Headroom wholesale."
- **"Not the product owner."** Whether the cost surface justifies *any* of this is the human's call. The analysis below gives the options; it does not decree a build.

---

# C. Options

## C.1 Option matrix

| # | Option | Code change | Runtime surface | Latency | Reversibility | Risk | Doctrine fit |
|---|---|---|---|---|---|---|---|
| 1 | **External Headroom proxy via `OPENAI_BASE_URL`** | None (env only) | Python/ONNX container/VM + SQLite/Redis | +1 hop per call | Yes (CCR) | Beta bugs; key-relay; new ops | Low |
| 2 | **Headroom proxy in a Cloudflare Container + service binding** | Small (bind) | Container (CF-managed) | +internal hop | Yes | Same Beta bugs; sticky CCR | Medium |
| 3 | **TS SDK `HeadroomClient` from Worker → external proxy** | Small | Same as #1/#2 | +2 hops (dominated by #1) | Yes | Same; extra hop for nothing | Low |
| 4 | **MCP server for Clickeen's agents** | Large | Python process | n/a | Yes | Agents use service binding, not MCP — poor fit | Low |
| 5 | **Build a minimal native in-Worker JSON compactor** | Medium (at `chat.ts`) | None — runs in Worker | ~0 | Build CCR-lite in D1/KV if wanted | Low (own code) | **High** |
| 6 | **Measure first / defer** | Tiny (instrument usage) | None | 0 | n/a | None | **High** |

## C.2 The options, in plain terms

- **Option 1 — External proxy via env (the "off-the-shelf" path).** Set `OPENAI_BASE_URL`/`DEEPSEEK_BASE_URL` to a Headroom proxy you host. Zero Clickeen code change; San Francisco's grant accounting still works because usage flows back. *Cost:* you now operate a stateful Beta Python/ONNX service with known cache-correctness bugs, expose an authenticated OpenAI-key relay, and add latency to every call. *Use if:* you want maximum compression coverage fast and accept the operational burden.
- **Option 2 — Headroom in a Cloudflare Container + service binding.** Same engine, but hosted where Workers natively reach it (Container) and called the same way the agents already call San Francisco (`SANFRANCISCO_AI_ENGINE`-style Fetcher). The cleanest *topology* for a Workers shop — but it inherits every Headroom Beta bug and adds a stateful component to a substrate that is otherwise stateless Workers + R2/D1/Supabase.
- **Option 3 — TS SDK from the Worker.** Strictly worse than Option 1: the Worker would call the SDK, which calls the proxy, which calls the upstream — an extra hop for zero benefit. Included only to close the door on it.
- **Option 4 — MCP for agents.** Clickeen's agents reach San Francisco via service binding, not MCP, and San Francisco is not an MCP host. Poor fit; skip unless a future agent is genuinely MCP-hosted.
- **Option 5 — Build a minimal native compactor (the "design-target" path).** Add a small, JSON-aware compactor at the `callChatCompletion` chokepoint (`sanfrancisco/src/ai/chat.ts:41`), inspired by SmartCrusher: lossless structural compaction of large JSON tool/context payloads + optional lossy row-drop behind a marker. **No ML, no ONNX, no sidecar, no binaries — it runs in the Worker.** Optionally a CCR-lite (store originals in D1/KV, expose a retrieve path) only if a use case forces reversibility. This captures the ~80% of value that matches Clickeen's actual payloads, with none of the operational or correctness debt. *This is what "code to use cases, not boundaries" points at.*
- **Option 6 — Measure first (the "hates speculation" path).** San Francisco **already captures** `prompt_tokens`/`completion_tokens` per call (`providers/openai.ts:157`). Aggregate that by agent × provider × surface for a week. If token spend isn't actually a problem, **do nothing.** If it is, the data says *which* payloads to compress — and Option 5 almost certainly beats Options 1–2 on fit.

## C.3 Recommendation (reasoning, not a decree)

1. **Start with Option 6.** Instrument and measure real per-call token spend out of San Francisco. Do not adopt compression on speculation — Clickeen's doctrine is verify-first.
2. **If the data shows a cost surface**, prefer **Option 5** (native, in-Worker, JSON-aware compactor at the chokepoint) as the default — it matches Clickeen's structured-JSON payloads, needs no new infra, runs where the product runs, and avoids importing a Beta dependency with known correctness bugs. Use Headroom's *design* (per-content-type routing, lossless-first compaction, the reversibility pattern, the holdout-measurement discipline) as the reference.
3. **Reserve Options 1–2 (adopt Headroom-as-sidecar)** for the case where prose/code/log compression is genuinely needed *and* the operational burden is explicitly accepted — behind a feature flag, with A/B measurement (copy Headroom's holdout idea natively), and only after validating that the REALIGNMENT cache/streaming bugs don't bite Clickeen's providers and call shapes.

## C.4 Decisions that are the human's to make

- Is agent token cost a real, measured problem today, or anticipated? (Drives Option 6 → anything.)
- If yes: buy (adopt Headroom as a sidecar) vs. build (native compactor)? That is a scope/build call, not an engineering one.
- Is introducing a stateful Python/ONNX runtime acceptable in a substrate that is otherwise Workers + R2/D1/Supabase?
- For any adoption: is reversibility (CCR) required, and if so where do originals live (D1/KV vs. the sidecar's SQLite/Redis)?

---

# Appendix

## A-1 Headroom install/build reality (why I couldn't run it)
- No prebuilt wheel for Intel macOS → source build via maturin → fails at `ort-sys` (ONNX Runtime has no prebuilt artifact for `x86_64-apple-darwin`).
- `crates/headroom-core/Cargo.toml`: `fastembed` + `magika` are **hard deps** (both pull ONNX) — not feature-gated, so there is no "lite/ML-free" build.
- Runtime also fetches `difft` + `scc` from GitHub releases (`headroom/binaries.py`) and the Kompress model from HuggingFace.
- Conclusion: Headroom is a **server/container/long-lived-process workload**, not an edge workload.

## A-2 Key Headroom config env vars (for any sidecar deployment)
- Privacy: `HEADROOM_TELEMETRY` (opt-in), `HEADROOM_TELEMETRY_WARN`, `HEADROOM_TOIN_BACKEND/PATH`.
- Offline/binaries: `HEADROOM_BINARIES_OFFLINE`, `HEADROOM_BINARIES_MIRROR`, `HEADROOM_BINARIES_CACHE`.
- CCR: `HEADROOM_CCR_BACKEND` (memory/sqlite/redis), `HEADROOM_CCR_SQLITE_PATH`, `HEADROOM_CCR_TTL_SECONDS` (1800), `HEADROOM_REDIS_URL`.
- Compression: `HEADROOM_DISABLE_KOMPRESS`, `HEADROOM_LOSSLESS_ONLY`, `HEADROOM_TARGET_RATIO`, `HEADROOM_PROTECT_RECENT`, `HEADROOM_KOMPRESS_MAX_TOKENS` (50000), `HEADROOM_COMPRESSION_DEADLINE_MS` (20000).
- Output shaping: `HEADROOM_OUTPUT_SHAPER`, `HEADROOM_OUTPUT_HOLDOUT`, `HEADROOM_VERBOSITY_LEVEL`, `HEADROOM_EFFORT_ROUTER`.
- TS SDK: `HEADROOM_BASE_URL`, `HEADROOM_API_KEY`.

## A-3 Selected source citations
- Headroom (repo-relative): `headroom/compress.py:162` (API); `headroom/transforms/pipeline.py` (stages); `cache_aligner.py:266-282` (detector-only, byte-equal); `content_router.py:1276,2036` (routing, magika optional); `smart_crusher.py` (Rust `_core.SmartCrusher`, lossless+lossy); `code_compressor.py:417-426` (tree-sitter preserves); `kompress_compressor.py:38-40` (HF model); `cache/compression_store.py` + `cache/backends/sqlite.py` (CCR); `cli/proxy.py` + `proxy/server.py` (FastAPI proxy :8787); `ccr/mcp_server.py:514-611` (MCP tools); `cli/wrap.py` (wrap re-points base URLs); `sdk/typescript/src/client.ts` (HTTP client, zero deps); `telemetry/beacon.py:73-82` (opt-in/fail-closed); `REALIGNMENT/01-bug-list.md` (5 P0 cache bugs).
- Clickeen (repo-relative): `sanfrancisco/src/ai/chat.ts:41` (chokepoint); `sanfrancisco/src/providers/openai.ts:103-157` (env base URL, usage); `sanfrancisco/src/providers/deepseek.ts:47-51`; `sanfrancisco/src/prague-l10n-strings.ts:143` (hardcoded `/v1/responses`); `sanfrancisco/src/types.ts:136-141` (Env vars); `sanfrancisco/src/index.ts:197-235` (routes); `roma/lib/env/sanfrancisco.ts` (HTTP caller); `agents/translation-agent/src/worker.ts:308-317` + `agents/product-copilot/src/worker.ts:90-100` (service-binding callers).
