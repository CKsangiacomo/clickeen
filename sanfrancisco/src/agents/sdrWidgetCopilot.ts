import type { AIGrant, Env, Usage } from '../types';
import { HttpError, asString, isRecord } from '../http';
import { getGrantMaxTokens, getGrantTimeoutMs } from '../grants';
import globalDictionary from '../lexicon/global_dictionary.json';

type ControlSummary = {
  path: string;
  panelId?: string;
  groupId?: string;
  groupLabel?: string;
  type?: string;
  kind?: string;
  label?: string;
  options?: Array<{ label: string; value: string }>;
  enumValues?: string[];
  min?: number;
  max?: number;
  itemIdPath?: string;
};

type WidgetCopilotInput = {
  sessionId: string;
  prompt: string;
  widgetType: string;
  currentConfig: Record<string, unknown>;
  controls: ControlSummary[];
};

type WidgetOp =
  | { op: 'set'; path: string; value: unknown }
  | { op: 'insert'; path: string; index: number; value: unknown }
  | { op: 'remove'; path: string; index: number }
  | { op: 'move'; path: string; from: number; to: number };

type WidgetCopilotResult = {
  message: string;
  ops?: WidgetOp[];
  cta?: { text: string; action: 'signup' | 'upgrade' | 'learn-more'; url?: string };
};

type OpenAIChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  model?: string;
};

type CopilotSession = {
  sessionId: string;
  createdAtMs: number;
  lastActiveAtMs: number;
  successfulEdits: number;
  turns: Array<{ role: 'user' | 'assistant'; content: string }>;
};

type GlobalDictionary = typeof globalDictionary;

function parseJsonFromModel(raw: string): unknown {
  const trimmed = raw.trim();
  let cleaned = trimmed;

  if (cleaned.startsWith('```')) {
    const lines = cleaned.split('\n');
    lines.shift(); // ``` or ```json
    while (lines.length && lines[lines.length - 1]?.trim() === '```') lines.pop();
    cleaned = lines.join('\n').trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstObj = cleaned.indexOf('{');
    const lastObj = cleaned.lastIndexOf('}');
    if (firstObj >= 0 && lastObj > firstObj) {
      const slice = cleaned.slice(firstObj, lastObj + 1);
      try {
        return JSON.parse(slice);
      } catch {
        // continue
      }
    }
    throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'deepseek', message: 'Model did not return valid JSON' });
  }
}

function isWidgetOp(value: unknown): value is WidgetOp {
  if (!isRecord(value)) return false;
  const op = asString(value.op);
  const path = asString(value.path);
  if (!op || !path) return false;
  if (op === 'set') return value.value !== undefined;
  if (op === 'insert') return typeof value.index === 'number' && value.value !== undefined;
  if (op === 'remove') return typeof value.index === 'number';
  if (op === 'move') return typeof value.from === 'number' && typeof value.to === 'number';
  return false;
}

function parseWidgetCopilotInput(input: unknown): WidgetCopilotInput {
  if (!isRecord(input)) throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid input', issues: [{ path: 'input', message: 'Expected an object' }] });
  const sessionId = (asString(input.sessionId) ?? '').trim();
  const prompt = (asString(input.prompt) ?? '').trim();
  const widgetType = (asString(input.widgetType) ?? '').trim();
  const currentConfig = isRecord(input.currentConfig) ? input.currentConfig : null;
  const controls = Array.isArray(input.controls) ? input.controls : null;

  const issues: Array<{ path: string; message: string }> = [];
  if (!sessionId) issues.push({ path: 'input.sessionId', message: 'Missing required value' });
  if (!prompt) issues.push({ path: 'input.prompt', message: 'Missing required value' });
  if (!widgetType) issues.push({ path: 'input.widgetType', message: 'Missing required value' });
  if (!currentConfig) issues.push({ path: 'input.currentConfig', message: 'currentConfig must be an object' });
  if (!controls) issues.push({ path: 'input.controls', message: 'controls must be an array' });
  if (issues.length) throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid input', issues });

  const safeControls: ControlSummary[] = (controls as any[])
    .filter((c) => isRecord(c) && typeof c.path === 'string' && c.path.trim())
    .map((c) => ({
      path: String(c.path),
      panelId: typeof c.panelId === 'string' ? c.panelId : undefined,
      groupId: typeof c.groupId === 'string' ? c.groupId : undefined,
      groupLabel: typeof c.groupLabel === 'string' ? c.groupLabel : undefined,
      type: typeof c.type === 'string' ? c.type : undefined,
      kind: typeof c.kind === 'string' ? c.kind : undefined,
      label: typeof c.label === 'string' ? c.label : undefined,
      options:
        Array.isArray(c.options) && c.options.every((o: any) => isRecord(o) && typeof o.label === 'string' && typeof o.value === 'string')
          ? (c.options as Array<{ label: string; value: string }>)
          : undefined,
      enumValues: Array.isArray(c.enumValues) && c.enumValues.every((v: unknown) => typeof v === 'string') ? c.enumValues : undefined,
      min: typeof c.min === 'number' ? c.min : undefined,
      max: typeof c.max === 'number' ? c.max : undefined,
      itemIdPath: typeof c.itemIdPath === 'string' ? c.itemIdPath : undefined,
    }));

  return { sessionId, prompt, widgetType, currentConfig: currentConfig as Record<string, unknown>, controls: safeControls };
}

function containsAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n.toLowerCase()));
}

function getConcept(dict: GlobalDictionary, id: string) {
  return dict.concepts.find((c) => c.id === id) ?? null;
}

function getScope(dict: GlobalDictionary, id: string) {
  return dict.scopes.find((s) => s.id === id) ?? null;
}

function inferScopeFromPath(controlPath: string): 'stage' | 'pod' | 'content' {
  if (controlPath.startsWith('stage.')) return 'stage';
  if (controlPath.startsWith('pod.')) return 'pod';
  return 'content';
}

function maybeClarify(dict: GlobalDictionary, input: WidgetCopilotInput): string | null {
  const prompt = input.prompt;

  const backgroundConcept = getConcept(dict, 'background');
  if (backgroundConcept && containsAny(prompt, backgroundConcept.synonyms)) {
    const hasStageBackground = input.controls.some((c) => inferScopeFromPath(c.path) === 'stage' && c.path.includes('background'));
    const hasPodBackground = input.controls.some((c) => inferScopeFromPath(c.path) === 'pod' && c.path.includes('background'));
    if (hasStageBackground && hasPodBackground) {
      const q =
        dict.clarifications.find((c) => c.conceptId === 'background')?.question ??
        'Do you mean the stage background or the widget container background?';
      return q;
    }
  }

  return null;
}

async function getSession(env: Env, sessionId: string): Promise<CopilotSession> {
  const key = `sdrw:session:${sessionId}`;
  const existing = await env.SF_KV.get(key, 'json');
  if (!existing) {
    const now = Date.now();
    return { sessionId, createdAtMs: now, lastActiveAtMs: now, successfulEdits: 0, turns: [] };
  }
  if (!isRecord(existing)) throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'sanfrancisco', message: 'Session store is corrupted' });
  const turns = Array.isArray(existing.turns) ? existing.turns : null;
  if (!turns) throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'sanfrancisco', message: 'Session store is corrupted' });
  return existing as CopilotSession;
}

async function putSession(env: Env, session: CopilotSession): Promise<void> {
  const key = `sdrw:session:${session.sessionId}`;
  await env.SF_KV.put(key, JSON.stringify(session), { expirationTtl: 60 * 60 * 24 });
}

function systemPrompt(): string {
  const stage = getScope(globalDictionary, 'stage');
  const pod = getScope(globalDictionary, 'pod');
  const content = getScope(globalDictionary, 'content');
  const modern = globalDictionary.intents.find((i) => i.id === 'modern');
  const classic = globalDictionary.intents.find((i) => i.id === 'classic');
  const playful = globalDictionary.intents.find((i) => i.id === 'playful');

  return [
    "You help users customize widgets in Clickeen's playground (Minibob).",
    '',
    'INPUT: user request + current widget config + available editable controls',
    'OUTPUT: JSON with ops array + friendly message + optional conversion CTA',
    '',
    'RULES:',
    '1) Generate valid ops that target available control paths only.',
    '2) Respect control constraints:',
    '   - If a control kind is "enum": value MUST be one of enumValues.',
    '   - If min/max exist: keep numeric values within range.',
    '   - If user asks for something not possible, ask a short clarifying question instead of guessing.',
    '3) Keep changes minimal — one thing at a time.',
    '4) If the user asks a question or requests an explanation, return NO ops and answer briefly.',
    '5) Message should confirm what changed (1–2 sentences).',
    '6) If user asks for a paid feature, explain kindly and suggest signup/upgrade.',
    '',
    'GLOBAL VOCABULARY (applies to all widgets):',
    `- Scopes:`,
    `  - stage: ${stage?.description ?? 'background behind the widget'}`,
    `  - pod: ${pod?.description ?? 'widget container'}`,
    `  - content: ${content?.description ?? 'inside the widget'}`,
    `- If user says "background" and both stage + pod backgrounds exist, ask which scope they mean.`,
    `- If user says "font(s)" without specifying a target, default to changing all available typography roles (title, section titles, questions, answers).`,
    `- If user asks for a "modern/classic/playful font", pick from enumValues using these candidates:`,
    `  - modern: ${(modern?.fontCandidates ?? []).slice(0, 12).join(', ')}`,
    `  - classic: ${(classic?.fontCandidates ?? []).slice(0, 12).join(', ')}`,
    `  - playful: ${(playful?.fontCandidates ?? []).slice(0, 12).join(', ')}`,
    '',
    'Output MUST be JSON, with this shape:',
    '{ "ops"?: WidgetOp[], "message": string, "cta"?: { "text": string, "action": "signup"|"upgrade"|"learn-more", "url"?: string } }',
    '',
    'WidgetOp:',
    '{ op:"set", path:string, value:any } | { op:"insert", path:string, index:number, value:any } | { op:"remove", path:string, index:number } | { op:"move", path:string, from:number, to:number }',
    '',
    'Do NOT wrap JSON in markdown fences.',
    'Do NOT include any surrounding text.',
  ].join('\n');
}

export async function executeSdrWidgetCopilot(params: { grant: AIGrant; input: unknown }, env: Env): Promise<{ result: WidgetCopilotResult; usage: Usage }> {
  const input = parseWidgetCopilotInput(params.input);

  const clarification = maybeClarify(globalDictionary, input);
  if (clarification) {
    const session = await getSession(env, input.sessionId);
    session.lastActiveAtMs = Date.now();
    session.turns = [
      ...session.turns,
      { role: 'user' as const, content: input.prompt },
      { role: 'assistant' as const, content: clarification },
    ].slice(-10) as CopilotSession['turns'];
    await putSession(env, session);

    return {
      result: { message: clarification },
      usage: { provider: 'local', model: 'global_dictionary', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
    };
  }

  if (!env.DEEPSEEK_API_KEY) {
    throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'deepseek', message: 'Missing DEEPSEEK_API_KEY' });
  }

  const session = await getSession(env, input.sessionId);
  const maxTokens = getGrantMaxTokens(params.grant);
  const timeoutMs = getGrantTimeoutMs(params.grant);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const baseUrl = env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com';
  const model = env.DEEPSEEK_MODEL ?? 'deepseek-chat';

  const user = [
    `Widget type: ${input.widgetType}`,
    '',
    `User request: ${input.prompt}`,
    '',
    'Editable controls (path → kind, label, constraints):',
    input.controls
      .slice(0, 180)
      .map((c) => {
        const parts: string[] = [];
        parts.push(`- ${c.path}`);
        if (c.kind) parts.push(`(${c.kind})`);
        if (c.label) parts.push(`— ${c.label}`);
        if (c.panelId) parts.push(`[panel:${c.panelId}]`);
        if (c.groupLabel) parts.push(`[group:${c.groupLabel}]`);

        if (c.kind === 'enum' && Array.isArray(c.enumValues) && c.enumValues.length) {
          const values = c.enumValues.slice(0, 24);
          parts.push(`[allowed:${values.join(', ')}${c.enumValues.length > values.length ? ', …' : ''}]`);
        }

        if (typeof c.min === 'number' || typeof c.max === 'number') {
          parts.push(`[range:${typeof c.min === 'number' ? c.min : '-∞'}..${typeof c.max === 'number' ? c.max : '∞'}]`);
        }
        return parts.join(' ');
      })
      .join('\n'),
    '',
    'Current config (JSON):',
    JSON.stringify(input.currentConfig),
  ].join('\n');

  const messages = [
    { role: 'system', content: systemPrompt() },
    ...session.turns,
    { role: 'user', content: user },
  ];

  const startedAt = Date.now();
  let responseJson: OpenAIChatResponse;
  try {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
          'content-type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          max_tokens: maxTokens,
        }),
      });
    } catch (err: unknown) {
      const name = isRecord(err) ? asString((err as any).name) : null;
      if (name === 'AbortError') throw new HttpError(429, { code: 'BUDGET_EXCEEDED', message: 'Execution timeout exceeded' });
      throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'deepseek', message: 'Upstream request failed' });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'deepseek', message: `Upstream error (${res.status}) ${text}`.trim() });
    }
    responseJson = (await res.json()) as OpenAIChatResponse;
  } finally {
    clearTimeout(timeout);
  }

  const latencyMs = Date.now() - startedAt;
  const content = responseJson.choices?.[0]?.message?.content;
  if (!content) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'deepseek', message: 'Empty model response' });

  const parsed = parseJsonFromModel(content);
  if (!isRecord(parsed)) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'deepseek', message: 'Model output must be an object' });

  const message = (asString(parsed.message) ?? '').trim();
  if (!message) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'deepseek', message: 'Model output missing message' });

  const opsRaw = parsed.ops;
  const ops = Array.isArray(opsRaw) ? opsRaw.filter(isWidgetOp) : undefined;

  const ctaRaw = parsed.cta;
  let cta: WidgetCopilotResult['cta'];
  if (isRecord(ctaRaw)) {
    const text = (asString(ctaRaw.text) ?? '').trim();
    const action = (asString(ctaRaw.action) ?? '').trim();
    const url = (asString(ctaRaw.url) ?? '').trim();
    if (text && (action === 'signup' || action === 'upgrade' || action === 'learn-more')) {
      cta = { text, action, ...(url ? { url } : {}) };
    }
  }

  const hasEdit = Boolean(ops && ops.length > 0);
  session.lastActiveAtMs = Date.now();
  session.successfulEdits = hasEdit ? session.successfulEdits + 1 : session.successfulEdits;
  session.turns = [
    ...session.turns,
    { role: 'user' as const, content: input.prompt },
    { role: 'assistant' as const, content: message },
  ].slice(-10) as CopilotSession['turns'];
  await putSession(env, session);

  const result: WidgetCopilotResult = {
    message,
    ...(ops && ops.length ? { ops } : {}),
    ...(cta ? { cta } : {}),
  };

  const usage: Usage = {
    provider: 'deepseek',
    model: responseJson.model ?? model,
    promptTokens: responseJson.usage?.prompt_tokens ?? 0,
    completionTokens: responseJson.usage?.completion_tokens ?? 0,
    latencyMs,
  };

  return { result, usage };
}
