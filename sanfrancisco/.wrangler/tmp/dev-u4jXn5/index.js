var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/http.ts
var HttpError = class extends Error {
  static {
    __name(this, "HttpError");
  }
  status;
  error;
  constructor(status, error) {
    super(error.message);
    this.status = status;
    this.error = error;
  }
};
function json(value, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(value), { ...init, headers });
}
__name(json, "json");
function noStore(res) {
  const headers = new Headers(res.headers);
  headers.set("cache-control", "no-store");
  return new Response(res.body, { ...res, headers });
}
__name(noStore, "noStore");
async function readJson(request) {
  const text = await request.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, { code: "BAD_REQUEST", message: "Invalid JSON body" });
  }
}
__name(readJson, "readJson");
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
__name(isRecord, "isRecord");
function asString(value) {
  return typeof value === "string" ? value : null;
}
__name(asString, "asString");
function asNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
__name(asNumber, "asNumber");

// src/grants.ts
function base64UrlToBytes(input) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
__name(base64UrlToBytes, "base64UrlToBytes");
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
__name(timingSafeEqual, "timingSafeEqual");
async function hmacSha256(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return new Uint8Array(sig);
}
__name(hmacSha256, "hmacSha256");
async function verifyGrant(grant, secret) {
  const parts = grant.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") {
    throw new HttpError(401, { code: "GRANT_INVALID", message: "Invalid grant format" });
  }
  const payloadB64 = parts[1];
  const sigB64 = parts[2];
  let payload;
  try {
    const jsonText = new TextDecoder().decode(base64UrlToBytes(payloadB64));
    payload = JSON.parse(jsonText);
  } catch {
    throw new HttpError(401, { code: "GRANT_INVALID", message: "Invalid grant payload" });
  }
  if (!isRecord(payload)) throw new HttpError(401, { code: "GRANT_INVALID", message: "Invalid grant payload" });
  const v = asNumber(payload.v);
  const iss = asString(payload.iss);
  const exp = asNumber(payload.exp);
  const caps = Array.isArray(payload.caps) && payload.caps.every((c) => typeof c === "string") ? payload.caps : null;
  const budgets = isRecord(payload.budgets) ? payload.budgets : null;
  const mode = asString(payload.mode);
  const sub = isRecord(payload.sub) ? payload.sub : null;
  if (v !== 1 || iss !== "paris" || exp === null || !caps || !budgets || !sub || mode !== "editor" && mode !== "ops") {
    throw new HttpError(401, { code: "GRANT_INVALID", message: "Grant missing required fields" });
  }
  const subKind = asString(sub.kind);
  if (subKind === "anon") {
    if (!asString(sub.sessionId)) throw new HttpError(401, { code: "GRANT_INVALID", message: "Grant subject missing sessionId" });
  } else if (subKind === "user") {
    if (!asString(sub.userId) || !asString(sub.workspaceId)) {
      throw new HttpError(401, { code: "GRANT_INVALID", message: "Grant subject missing userId/workspaceId" });
    }
  } else if (subKind === "service") {
    if (!asString(sub.serviceId)) throw new HttpError(401, { code: "GRANT_INVALID", message: "Grant subject missing serviceId" });
  } else {
    throw new HttpError(401, { code: "GRANT_INVALID", message: "Grant subject kind is invalid" });
  }
  const expectedSig = await hmacSha256(secret, `v1.${payloadB64}`);
  const providedSig = base64UrlToBytes(sigB64);
  if (!timingSafeEqual(expectedSig, providedSig)) {
    throw new HttpError(401, { code: "GRANT_INVALID", message: "Grant signature mismatch" });
  }
  const nowSec = Math.floor(Date.now() / 1e3);
  if (exp <= nowSec) throw new HttpError(401, { code: "GRANT_EXPIRED", message: "Grant expired" });
  return payload;
}
__name(verifyGrant, "verifyGrant");
function assertCap(grant, capability) {
  if (!grant.caps.includes(capability)) {
    throw new HttpError(403, { code: "CAPABILITY_DENIED", message: `Capability denied: ${capability}` });
  }
}
__name(assertCap, "assertCap");
function getGrantMaxTokens(grant) {
  const maxTokens = grant.budgets.maxTokens;
  if (typeof maxTokens !== "number" || !Number.isFinite(maxTokens) || maxTokens <= 0) {
    throw new HttpError(400, { code: "GRANT_INVALID", message: "Grant budgets.maxTokens must be a positive number" });
  }
  return maxTokens;
}
__name(getGrantMaxTokens, "getGrantMaxTokens");
function getGrantTimeoutMs(grant) {
  const timeoutMs = grant.budgets.timeoutMs;
  if (timeoutMs === void 0) return 2e4;
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new HttpError(400, { code: "GRANT_INVALID", message: "Grant budgets.timeoutMs must be a positive number" });
  }
  return timeoutMs;
}
__name(getGrantTimeoutMs, "getGrantTimeoutMs");

// src/agents/sdrCopilot.ts
function parseSdrInput(input) {
  if (!isRecord(input)) throw new HttpError(400, { code: "BAD_REQUEST", message: "Invalid input", issues: [{ path: "input", message: "Expected an object" }] });
  const sessionId = asString(input.sessionId);
  const message = asString(input.message);
  const issues = [];
  if (!sessionId) issues.push({ path: "input.sessionId", message: "Missing required value" });
  if (!message) issues.push({ path: "input.message", message: "Missing required value" });
  if (issues.length) throw new HttpError(400, { code: "BAD_REQUEST", message: "Invalid input", issues });
  return { sessionId, message };
}
__name(parseSdrInput, "parseSdrInput");
function parseSdrResult(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(502, { code: "PROVIDER_ERROR", provider: "deepseek", message: "Model did not return valid JSON" });
  }
  if (!isRecord(parsed)) throw new HttpError(502, { code: "PROVIDER_ERROR", provider: "deepseek", message: "Model output must be an object" });
  const message = asString(parsed.message);
  const next = asString(parsed.next);
  if (!message) throw new HttpError(502, { code: "PROVIDER_ERROR", provider: "deepseek", message: "Model output missing message" });
  if (next !== "continue" && next !== "end") throw new HttpError(502, { code: "PROVIDER_ERROR", provider: "deepseek", message: "Model output next must be continue|end" });
  const ctaRaw = parsed.cta;
  let cta;
  if (ctaRaw !== void 0) {
    if (!isRecord(ctaRaw)) throw new HttpError(502, { code: "PROVIDER_ERROR", provider: "deepseek", message: "Model output cta must be an object" });
    const kind = asString(ctaRaw.kind);
    const label = asString(ctaRaw.label);
    const href = asString(ctaRaw.href);
    if (kind !== "signup" || !label || !href) {
      throw new HttpError(502, { code: "PROVIDER_ERROR", provider: "deepseek", message: 'Model output cta must be { kind:"signup", label, href }' });
    }
    cta = { kind, label, href };
  }
  return { message, next, ...cta ? { cta } : {} };
}
__name(parseSdrResult, "parseSdrResult");
async function getSession(env, sessionId) {
  const key = `sdr:session:${sessionId}`;
  const existing = await env.SF_KV.get(key, "json");
  if (!existing) {
    const now = Date.now();
    return { sessionId, createdAtMs: now, lastActiveAtMs: now, turns: [] };
  }
  if (!isRecord(existing)) throw new HttpError(500, { code: "PROVIDER_ERROR", provider: "sanfrancisco", message: "Session store is corrupted" });
  const turns = Array.isArray(existing.turns) ? existing.turns : null;
  if (!turns) throw new HttpError(500, { code: "PROVIDER_ERROR", provider: "sanfrancisco", message: "Session store is corrupted" });
  return existing;
}
__name(getSession, "getSession");
async function putSession(env, session) {
  const key = `sdr:session:${session.sessionId}`;
  await env.SF_KV.put(key, JSON.stringify(session), { expirationTtl: 60 * 60 * 24 });
}
__name(putSession, "putSession");
async function executeSdrCopilot(params, env) {
  const { grant } = params;
  const input = parseSdrInput(params.input);
  if (!env.DEEPSEEK_API_KEY) {
    throw new HttpError(500, { code: "PROVIDER_ERROR", provider: "deepseek", message: "Missing DEEPSEEK_API_KEY" });
  }
  const session = await getSession(env, input.sessionId);
  const maxTokens = getGrantMaxTokens(grant);
  const timeoutMs = getGrantTimeoutMs(grant);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const baseUrl = env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const model = env.DEEPSEEK_MODEL ?? "deepseek-chat";
  const system = [
    "You are Clickeen SDR Copilot for a public website chat.",
    "Be concise, clear, and helpful. One short paragraph max.",
    "If relevant, encourage signup to unlock the full editor and copilots.",
    "Return ONLY a JSON object matching this TypeScript type:",
    '{ message: string; cta?: { kind:"signup"; label: string; href: string }; next: "continue"|"end" }'
  ].join("\n");
  const messages = [
    { role: "system", content: system },
    ...session.turns,
    { role: "user", content: input.message }
  ];
  const startedAt = Date.now();
  let responseJson;
  try {
    let res;
    try {
      res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
          "content-type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          max_tokens: maxTokens
        })
      });
    } catch (err) {
      const name = isRecord(err) ? asString(err.name) : null;
      if (name === "AbortError") {
        throw new HttpError(429, { code: "BUDGET_EXCEEDED", message: "Execution timeout exceeded" });
      }
      throw new HttpError(502, { code: "PROVIDER_ERROR", provider: "deepseek", message: "Upstream request failed" });
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new HttpError(502, { code: "PROVIDER_ERROR", provider: "deepseek", message: `Upstream error (${res.status}) ${text}`.trim() });
    }
    responseJson = await res.json();
  } finally {
    clearTimeout(timeout);
  }
  const latencyMs = Date.now() - startedAt;
  const content = responseJson.choices?.[0]?.message?.content;
  if (!content) throw new HttpError(502, { code: "PROVIDER_ERROR", provider: "deepseek", message: "Empty model response" });
  const result = parseSdrResult(content);
  session.lastActiveAtMs = Date.now();
  const nextTurns = [
    ...session.turns,
    { role: "user", content: input.message },
    { role: "assistant", content: result.message }
  ];
  session.turns = nextTurns.slice(-10);
  await putSession(env, session);
  const usage = {
    provider: "deepseek",
    model: responseJson.model ?? model,
    promptTokens: responseJson.usage?.prompt_tokens ?? 0,
    completionTokens: responseJson.usage?.completion_tokens ?? 0,
    latencyMs
  };
  return { result, usage };
}
__name(executeSdrCopilot, "executeSdrCopilot");

// src/index.ts
var MAX_INFLIGHT_PER_ISOLATE = 8;
var inflight = 0;
function isExecuteRequest(value) {
  if (!isRecord(value)) return false;
  return typeof value.grant === "string" && typeof value.agentId === "string";
}
__name(isExecuteRequest, "isExecuteRequest");
function okHealth(env) {
  return noStore(
    json({
      ok: true,
      service: "sanfrancisco",
      env: env.ENVIRONMENT ?? "unknown",
      ts: Date.now()
    })
  );
}
__name(okHealth, "okHealth");
async function handleExecute(request, env, ctx) {
  if (inflight >= MAX_INFLIGHT_PER_ISOLATE) {
    throw new HttpError(429, { code: "BUDGET_EXCEEDED", message: "Service concurrency limit reached" });
  }
  inflight++;
  try {
    const body = await readJson(request);
    if (!isExecuteRequest(body)) {
      throw new HttpError(400, { code: "BAD_REQUEST", message: "Invalid request", issues: [{ path: "", message: "Expected { grant, agentId, input }" }] });
    }
    const grant = await verifyGrant(body.grant, env.AI_GRANT_HMAC_SECRET);
    assertCap(grant, `agent:${body.agentId}`);
    const requestId = asString(body.trace?.requestId) ?? crypto.randomUUID();
    const occurredAtMs = Date.now();
    if (body.agentId !== "sdr.copilot") {
      throw new HttpError(403, { code: "CAPABILITY_DENIED", message: `Unknown agentId: ${body.agentId}` });
    }
    const { result, usage } = await executeSdrCopilot({ grant, input: body.input }, env);
    const event = {
      v: 1,
      requestId,
      agentId: body.agentId,
      occurredAtMs,
      subject: grant.sub,
      trace: grant.trace,
      input: body.input,
      result,
      usage
    };
    ctx.waitUntil(
      env.SF_EVENTS.send(event).catch((err) => {
        console.error("[sanfrancisco] SF_EVENTS.send failed", err);
      })
    );
    const response = { requestId, agentId: body.agentId, result, usage };
    return noStore(json(response));
  } finally {
    inflight--;
  }
}
__name(handleExecute, "handleExecute");
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (request.method === "GET" && url.pathname === "/healthz") return okHealth(env);
      if (request.method === "POST" && url.pathname === "/v1/execute") return await handleExecute(request, env, ctx);
      throw new HttpError(404, { code: "BAD_REQUEST", message: "Not found" });
    } catch (err) {
      if (err instanceof HttpError) return noStore(json({ error: err.error }, { status: err.status }));
      console.error("[sanfrancisco] Unhandled error", err);
      return noStore(json({ error: { code: "PROVIDER_ERROR", provider: "sanfrancisco", message: "Unhandled error" } }, { status: 500 }));
    }
  },
  async queue(batch, env) {
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    for (const msg of batch.messages) {
      const e = msg.body;
      const key = `logs/${env.ENVIRONMENT ?? "unknown"}/${e.agentId}/${today}/${e.requestId}.json`;
      await env.SF_R2.put(key, JSON.stringify(e), { httpMetadata: { contentType: "application/json" } });
    }
  }
};

// ../node_modules/.pnpm/wrangler@4.54.0_@cloudflare+workers-types@4.20251228.0/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../node_modules/.pnpm/wrangler@4.54.0_@cloudflare+workers-types@4.20251228.0/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-eQLTxr/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../node_modules/.pnpm/wrangler@4.54.0_@cloudflare+workers-types@4.20251228.0/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-eQLTxr/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
