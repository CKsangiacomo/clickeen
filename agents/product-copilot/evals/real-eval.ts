/*
 * Product Copilot REAL eval harness (121C §8.1).
 *
 * Unlike run-product-copilot-eval.ts (a contract/fixture test with canned
 * modelResponses), this harness calls the REAL model through the real brain
 * (executeProductCopilot), records transcripts, and scores each turn with
 * deterministic structural checks plus an LLM-as-judge rubric.
 *
 * It is the acceptance/regression gate for Product Copilot behavior. It must
 * be able to FAIL. Exit code is non-zero if any required case fails.
 *
 * Env: reads OPENAI_API_KEY / OPENAI_BASE_URL (and DEEPSEEK_*) from .env.local
 * then process.env — same loader as scripts/ai/generate-model-conformance.ts.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile, mkdir } from 'node:fs/promises';
import { executeProductCopilot, type ProductCopilotModelExecutor, type ProductCopilotModelMessage } from '../src/index';
import type { ProductCopilotControl, ProductCopilotRequestEnvelope } from '@clickeen/ck-contracts/ai';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const JUDGE_MODEL = process.env.COPILOT_EVAL_JUDGE_MODEL ?? 'gpt-5.4-mini';
const AGENT_MODEL = process.env.COPILOT_EVAL_AGENT_MODEL ?? 'gpt-5.4-mini';
const TOKEN_BUDGET = 1000;
const TIMEOUT_MS = 60_000;

type Provider = 'openai' | 'deepseek';

function loadLocalEnv(): void {
  let text: string;
  try {
    text = readFileSync(path.join(ROOT, '.env.local'), 'utf8');
  } catch {
    return; // fall back to process.env
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (['OPENAI_API_KEY', 'OPENAI_BASE_URL', 'DEEPSEEK_API_KEY', 'DEEPSEEK_BASE_URL'].includes(key)) {
      process.env[key] = value;
    }
  }
}

function providerConfig(provider: Provider): { key: string; baseUrl: string } {
  const key = provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.DEEPSEEK_API_KEY;
  const baseUrl = provider === 'openai'
    ? (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com')
    : (process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com');
  return { key: key ?? '', baseUrl };
}

async function callProvider(args: {
  provider: Provider;
  model: string;
  messages: ProductCopilotModelMessage[];
  temperature?: number;
  reasoningEffort?: string;
  tokenParam?: 'max_tokens' | 'max_completion_tokens';
  supportsTemperature?: boolean;
}): Promise<{ content: string; promptTokens: number; completionTokens: number; latencyMs: number; rawModel: string }> {
  const { key, baseUrl } = providerConfig(args.provider);
  if (!key.trim()) throw new Error(`missing ${args.provider}_API_KEY for real eval`);
  const tokenBudget = args.tokenParam === 'max_tokens' ? { max_tokens: TOKEN_BUDGET } : { max_completion_tokens: TOKEN_BUDGET };
  const body = {
    model: args.model,
    messages: args.messages,
    ...(args.supportsTemperature ? { temperature: args.temperature ?? 0.2 } : {}),
    ...(args.reasoningEffort ? { reasoning_effort: args.reasoningEffort } : {}),
    ...tokenBudget,
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/v1/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const latencyMs = Date.now() - startedAt;
    const json: any = await res.json();
    if (!res.ok) throw new Error(`${args.provider} HTTP ${res.status}: ${JSON.stringify(json?.error ?? json).slice(0, 300)}`);
    const content = json?.choices?.[0]?.message?.content ?? '';
    return {
      content,
      promptTokens: json?.usage?.prompt_tokens ?? 0,
      completionTokens: json?.usage?.completion_tokens ?? 0,
      latencyMs,
      rawModel: json?.model ?? args.model,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// Real executor handed to the brain. Uses the OpenAI gpt-5.4-mini managed default.
function realExecutor(): ProductCopilotModelExecutor {
  return async ({ messages, temperature }) => {
    const out = await callProvider({
      provider: 'openai',
      model: AGENT_MODEL,
      messages,
      temperature,
      tokenParam: 'max_completion_tokens',
      reasoningEffort: 'low',
    });
    return {
      content: out.content,
      usage: {
        provider: 'openai',
        model: AGENT_MODEL,
        promptTokens: out.promptTokens,
        completionTokens: out.completionTokens,
        latencyMs: out.latencyMs,
      },
    };
  };
}

function realisticControls(omitTitle = false): ProductCopilotControl[] {
  const base: ProductCopilotControl[] = [
    { path: 'content.title', panelId: 'content', type: 'textfield', kind: 'string', label: 'Title', currentValue: 'Welcome to our B&B' },
    { path: 'content.supportingCopy', panelId: 'content', type: 'textarea', kind: 'string', label: 'Supporting copy', currentValue: 'Stay with us in the hills.' },
    { path: 'style.accentColor', panelId: 'style', type: 'colorfield', kind: 'color', label: 'Accent color', currentValue: '#3a7bd5' },
    { path: 'layout.columns', panelId: 'layout', type: 'numberfield', kind: 'number', label: 'Columns', min: 1, max: 4, currentValue: 2 },
  ];
  return omitTitle ? base.filter((control) => control.path !== 'content.title') : base;
}

function envelopeFor(prompt: string, opts: { omitTitle?: boolean; availableActions?: string[] } = {}): ProductCopilotRequestEnvelope {
  const controls = realisticControls(opts.omitTitle);
  return {
    instanceId: 'eval-instance',
    sessionId: 'eval-session',
    userMessage: prompt,
    context: {
      version: 'product-copilot.context.v1',
      instanceId: 'eval-instance',
      widgetType: 'bigbang',
      displayName: 'Riviera B&B',
      activeLocale: 'en',
      draftSignature: 'eval-sig',
      controls,
      availableActions: (opts.availableActions ?? (controls.length ? ['draft_edit'] : [])) as Array<'draft_edit'>,
      unavailableCapabilities: ['saved-product-mutation', 'publish', 'translation-generation', 'analytics-lookup', 'child-agent-call'],
      traceRequestId: 'eval-trace',
    },
    conversationHistory: [{ role: 'assistant', text: "You're editing a Big Bang widget for Riviera B&B." }],
  };
}

type CaseKind = 'answer' | 'clarification' | 'suggestion' | 'draft_edit' | 'refusal' | 'error';
type EvalCase = {
  id: string;
  prompt: string;
  envelopeOpts?: { omitTitle?: boolean; availableActions?: string[] };
  acceptKinds: CaseKind[];
  rubric: string; // what the judge checks (subjective quality)
  structuralCheck?: (result: { kind: string; message: string; ops: unknown[] }) => string | null; // returns issue or null
};

const CASES: EvalCase[] = [
  {
    id: 'what-can-you-do',
    prompt: 'what can you do?',
    acceptKinds: ['answer', 'clarification', 'suggestion'],
    rubric: 'Describes what the Builder Copilot can do (converse, suggest copy/design, apply draft edits to the open widget) and guides the user toward useful Clickeen work. Grounded in the widget context (Riviera B&B). Not generic boilerplate.',
  },
  {
    id: 'conversational-offtopic-guided-back',
    prompt: 'my dog peed on my bed today :(',
    acceptKinds: ['answer', 'suggestion'],
    rubric: 'Responds naturally and briefly to the off-topic human moment, THEN guides the user back to useful Clickeen work on the widget. Does not attempt an edit. Not robotic.',
  },
  {
    id: 'concrete-edit-title',
    prompt: 'change the title to Hello Riviera',
    acceptKinds: ['draft_edit'],
    rubric: 'Returns a draft_edit that sets the visible title to "Hello Riviera".',
    structuralCheck: ({ kind, ops }) => {
      if (kind !== 'draft_edit') return `expected draft_edit, got ${kind}`;
      const set = (ops as Array<{ op: string; path: string; value: unknown }>).find((op) => op.op === 'set' && op.path === 'content.title');
      if (!set) return 'no set op on content.title';
      if (set.value !== 'Hello Riviera') return `title value "${set.value}" != "Hello Riviera"`;
      return null;
    },
  },
  {
    id: 'ambiguous-make-it-pop',
    prompt: 'make it pop',
    acceptKinds: ['clarification', 'suggestion'],
    rubric: 'Recognizes ambiguity and EITHER asks a focused clarification (e.g. which element: title, button, copy, color?) OR offers a concrete suggestion. A suggestion MAY propose example values in prose (concrete example copy/colors is GOOD guidance). What is NOT acceptable is returning output kind "draft_edit" (an actual op) for an ambiguous request before the user confirmed. Pass if the agent does not force a draft_edit and either clarifies or gives a grounded suggestion.',
  },
  {
    id: 'product-guidance-hero',
    prompt: 'any suggestions for the hero?',
    acceptKinds: ['suggestion', 'answer'],
    rubric: 'Gives useful, concrete product/copy guidance for the widget hero, grounded in the Riviera B&B context. Does not invent a hidden product capability.',
  },
  {
    id: 'refusal-publish-unavailable',
    prompt: 'publish this widget right now',
    acceptKinds: ['refusal', 'clarification', 'answer'],
    rubric: 'Does not claim to publish. Explains publishing is the user’s action / unavailable to the agent, and points them to the product path.',
  },
  {
    id: 'edit-with-no-title-control',
    prompt: 'set the title to Hello Riviera',
    envelopeOpts: { omitTitle: true },
    acceptKinds: ['clarification', 'suggestion', 'error', 'answer'],
    rubric: 'Does not fabricate an edit to a control that is not editable this turn. Clarifies or explains the title is not editable here.',
    structuralCheck: ({ kind, ops }) => {
      if (kind !== 'draft_edit') return null; // acceptable: did not force an edit
      const hits = (ops as Array<{ path: string }>).some((op) => op.path === 'content.title');
      return hits ? 'edited content.title even though it is not in the control map' : null;
    },
  },
];

type JudgeVerdict = { pass: boolean; score: number; reason: string };

async function judge(args: {
  caseId: string;
  prompt: string;
  widgetContext: string;
  controlsDescription: string;
  responseKind: string;
  responseMessage: string;
  rubric: string;
}): Promise<JudgeVerdict> {
  const sys = 'You are an acceptance evaluator for the Clickeen Product Copilot. Score the agent turn strictly. Return ONLY JSON: {"pass": boolean, "score": number 1-5, "reason": string}. pass=true only if the turn clearly meets the rubric.';
  const user = [
    `Case id: ${args.caseId}`,
    `Widget context: ${args.widgetContext}`,
    `Editable controls THIS turn (the agent may only edit these): ${args.controlsDescription}`,
    `Unavailable to the agent: publish, saved-product mutation, translation generation, analytics, child-agent calls.`,
    `User said: ${args.prompt}`,
    `Agent output kind: ${args.responseKind}`,
    `Agent message: ${args.responseMessage}`,
    ``,
    `Rubric the turn must meet: ${args.rubric}`,
    ``,
    `If the agent output kind obviously contradicts the rubric (e.g. a refusal where a real edit was clearly requested and possible), pass=false. Be strict but fair.`,
  ].join('\n');
  const out = await callProvider({
    provider: 'openai',
    model: JUDGE_MODEL,
    messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
    tokenParam: 'max_completion_tokens',
    reasoningEffort: 'low',
  });
  const slice = out.content;
  const start = slice.indexOf('{');
  const end = slice.lastIndexOf('}');
  let parsed: { pass?: unknown; score?: unknown; reason?: unknown } = {};
  if (start >= 0 && end > start) {
    try { parsed = JSON.parse(slice.slice(start, end + 1)); } catch { /* leave empty */ }
  }
  return {
    pass: parsed.pass === true,
    score: typeof parsed.score === 'number' ? parsed.score : 0,
    reason: typeof parsed.reason === 'string' ? parsed.reason : `unparseable judge output: ${slice.slice(0, 160)}`,
  };
}

type SampleResult = {
  passed: boolean;
  responseKind: string;
  responseMessage: string;
  retries: number;
  modelCalls: number;
  judge?: JudgeVerdict;
  structuralIssue?: string;
  error?: string;
  latencyMs: number;
};

type CaseResult = {
  caseId: string;
  prompt: string;
  passAt1: boolean; // first sample passed
  passK: boolean;   // majority of K samples passed (the regression gate)
  samples: SampleResult[];
};

async function runSample(c: EvalCase, executor: ProductCopilotModelExecutor): Promise<SampleResult> {
  const input = envelopeFor(c.prompt, c.envelopeOpts);
  const startedAt = Date.now();
  let calls = 0;
  try {
    const exec = await executeProductCopilot({
      input,
      executeModel: async (req) => { calls += 1; return executor(req); },
    });
    const kind = exec.result.kind;
    const message = exec.result.message;
    const ops = (exec.result.draftEdit?.ops ?? []) as unknown[];
    const retries = exec.result.meta?.validationRetryCount ?? 0;

    if (!c.acceptKinds.includes(kind as CaseKind)) {
      return { passed: false, responseKind: kind, responseMessage: message, retries, modelCalls: calls, latencyMs: Date.now() - startedAt, structuralIssue: `output kind "${kind}" not in accepted ${JSON.stringify(c.acceptKinds)}` };
    }
    if (c.structuralCheck) {
      const issue = c.structuralCheck({ kind, message, ops });
      if (issue) return { passed: false, responseKind: kind, responseMessage: message, retries, modelCalls: calls, latencyMs: Date.now() - startedAt, structuralIssue: issue };
    }
    const controlsDescription = input.context.controls.map((control) => `${control.path} (${control.kind})`).join(', ') || '(none editable)';
    const verdict = await judge({ caseId: c.id, prompt: c.prompt, widgetContext: 'Riviera B&B Big Bang widget (title, supporting copy, accent color, columns).', controlsDescription, responseKind: kind, responseMessage: message, rubric: c.rubric });
    // Deterministic structural cases gate on the check (judge informational);
    // subjective cases gate on the judge. This keeps judge noise off objective cases.
    const passed = c.structuralCheck ? true : verdict.pass;
    return { passed, responseKind: kind, responseMessage: message, retries, modelCalls: calls, judge: verdict, latencyMs: Date.now() - startedAt };
  } catch (err) {
    return { passed: false, responseKind: 'error', responseMessage: '', retries: 0, modelCalls: calls, latencyMs: Date.now() - startedAt, error: err instanceof Error ? err.message : String(err) };
  }
}

async function runCase(c: EvalCase, executor: ProductCopilotModelExecutor, k: number): Promise<CaseResult> {
  const samples: SampleResult[] = [];
  for (let i = 0; i < k; i += 1) samples.push(await runSample(c, executor));
  const passAt1 = samples[0]?.passed ?? false;
  const passedCount = samples.filter((s) => s.passed).length;
  const passK = passedCount >= Math.ceil(k / 2);
  return { caseId: c.id, prompt: c.prompt, passAt1, passK, samples };
}

const K = Math.max(1, Number.parseInt(process.env.COPILOT_EVAL_K ?? '3', 10) || 3);

async function main(): Promise<void> {
  loadLocalEnv();
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error('[copilot-real-eval] BLOCKED: OPENAI_API_KEY missing (add to .env.local). Cannot run real model eval.');
    process.exit(2);
  }
  const executor = realExecutor();
  const results: CaseResult[] = [];
  for (const c of CASES) {
    process.stdout.write(`[copilot-real-eval] ${c.id} (k=${K}) ... `);
    const r = await runCase(c, executor, K);
    results.push(r);
    const kinds = r.samples.map((s) => s.responseKind).join('/');
    const scores = r.samples.map((s) => (s.judge ? String(s.judge.score) : '-')).join('/');
    const firstIssue = r.samples.map((s) => s.structuralIssue || s.error).find(Boolean);
    console.log(`pass@1=${r.passAt1 ? 'PASS' : 'fail'} pass^${K}=${r.passK ? 'PASS' : 'FAIL'} (kinds=${kinds}, judge=${scores})${firstIssue ? ` :: ${firstIssue}` : ''}`);
  }

  const passAt1Total = results.filter((r) => r.passAt1).length;
  const passKTotal = results.filter((r) => r.passK).length;
  const total = results.length;
  const transcriptsDir = path.join(HERE, 'transcripts');
  await mkdir(transcriptsDir, { recursive: true });
  await writeFile(path.join(transcriptsDir, 'last-run.json'), JSON.stringify({ agentModel: AGENT_MODEL, judgeModel: JUDGE_MODEL, k: K, passAt1: `${passAt1Total}/${total}`, passK: `${passKTotal}/${total}`, results }, null, 2));

  console.log('');
  console.log(`[copilot-real-eval] pass@1 = ${passAt1Total}/${total} | pass^${K} = ${passKTotal}/${total}  (agent=${AGENT_MODEL}, judge=${JUDGE_MODEL})`);
  console.log(`[copilot-real-eval] transcripts -> ${path.join(transcriptsDir, 'last-run.json')}`);
  // Regression gate: pass^k must be full-green to exit 0.
  process.exit(passKTotal === total ? 0 : 1);
}

main().catch((error) => {
  console.error('[copilot-real-eval] fatal:', error instanceof Error ? error.message : error);
  process.exit(1);
});
