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
  source?: { url: string; fetchedAtMs: number; title?: string };
};

type GlobalDictionary = typeof globalDictionary;

function looksLikeCloudflareErrorPage(text: string): { status?: number; reason: string } | null {
  const s = text.toLowerCase();
  if (!s) return null;

  // Common Cloudflare 5xx HTML markers.
  const hasCfWrapper = s.includes('id="cf-wrapper"') || s.includes("id='cf-wrapper'");
  const hasCfDetails = s.includes('id="cf-error-details"') || s.includes("id='cf-error-details'");
  const hasCdnCgi = s.includes('/cdn-cgi/') || s.includes('cdn-cgi/styles/main.css');
  const hasLandingLink = s.includes('cloudflare.com/5xx-error-landing');

  if (!(hasCfWrapper || hasCfDetails || hasCdnCgi || hasLandingLink)) return null;

  // Try to extract the numeric status code if present.
  const m = s.match(/error code\s*(\d{3})/);
  const code = m ? Number(m[1]) : undefined;
  return { status: Number.isFinite(code) ? code : undefined, reason: 'cloudflare_error_page' };
}

function extractUrlCandidates(text: string): string[] {
  const urls = new Set<string>();

  const add = (raw: string) => {
    const trimmed = raw.trim().replace(/[),.;]+$/g, '');
    if (!trimmed) return;
    urls.add(trimmed);
  };

  for (const m of text.matchAll(/\bhttps?:\/\/[^\s<>"')]+/gi)) add(m[0]);

  // Bare domains (optionally with a path). Avoid emails.
  for (const m of text.matchAll(/\b(?![\w.+-]+@)([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s<>"')]+)?\b/gi)) add(m[0]);

  return Array.from(urls);
}

function normalizeUrl(candidate: string): URL | null {
  const raw = candidate.trim();
  if (!raw) return null;
  try {
    if (/^https?:\/\//i.test(raw)) return new URL(raw);
    return new URL(`https://${raw}`);
  } catch {
    return null;
  }
}

function isBlockedFetchUrl(url: URL): string | null {
  const protocol = url.protocol.toLowerCase();
  if (protocol !== 'https:' && protocol !== 'http:') return 'unsupported_protocol';
  if (url.username || url.password) return 'userinfo_not_allowed';

  const port = url.port ? Number(url.port) : protocol === 'https:' ? 443 : 80;
  if (!Number.isFinite(port)) return 'invalid_port';
  if (port !== 80 && port !== 443) return 'port_not_allowed';

  const host = url.hostname.toLowerCase();
  if (!host) return 'invalid_host';
  if (host === 'localhost' || host.endsWith('.localhost')) return 'localhost_not_allowed';
  if (host.endsWith('.local')) return 'local_domain_not_allowed';

  // Block direct IPs (SSRF hard-stop). Hostnames may still resolve privately, but this is a V1 guardrail.
  const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  if (isIpv4) {
    const parts = host.split('.').map((p) => Number(p));
    if (parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return 'invalid_ip';
    const [a, b] = parts;
    if (a === 0) return 'private_ip';
    if (a === 10) return 'private_ip';
    if (a === 127) return 'private_ip';
    if (a === 169 && b === 254) return 'private_ip';
    if (a === 172 && b >= 16 && b <= 31) return 'private_ip';
    if (a === 192 && b === 168) return 'private_ip';
    if (a === 100 && b >= 64 && b <= 127) return 'private_ip';
    return null;
  }

  const isIpv6 = host.includes(':');
  if (isIpv6) {
    if (host === '::1') return 'private_ip';
    if (host.startsWith('fe80:')) return 'private_ip';
    if (host.startsWith('fc') || host.startsWith('fd')) return 'private_ip';
    return 'ip_not_allowed';
  }

  return null;
}

async function readResponseTextWithLimit(res: Response, maxBytes: number): Promise<{ text: string; truncated: boolean }> {
  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    if (text.length > maxBytes) return { text: text.slice(0, maxBytes), truncated: true };
    return { text, truncated: false };
  }

  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let received = 0;
  let truncated = false;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;

    received += value.byteLength;
    if (received > maxBytes) {
      truncated = true;
      const allowed = Math.max(0, value.byteLength - (received - maxBytes));
      chunks.push(decoder.decode(value.slice(0, allowed), { stream: true }));
      break;
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }

  chunks.push(decoder.decode());
  return { text: chunks.join(''), truncated };
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
      try {
        return String.fromCodePoint(code);
      } catch {
        return '';
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(String(hex), 16);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
      try {
        return String.fromCodePoint(code);
      } catch {
        return '';
      }
    });
}

function htmlToText(html: string): { title?: string; text: string } {
  const raw = html || '';
  const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/\s+/g, ' ').trim()) : undefined;

  let cleaned = raw;
  cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  cleaned = cleaned.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');

  cleaned = cleaned.replace(/<(br|hr)\s*\/?>/gi, '\n');
  cleaned = cleaned.replace(/<\/(p|div|section|article|header|footer|main|nav|li|h\d|pre|blockquote)>/gi, '\n');
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');
  cleaned = decodeHtmlEntities(cleaned);

  cleaned = cleaned.replace(/[ \t\r\f\v]+/g, ' ');
  cleaned = cleaned.replace(/\n[ \t]+/g, '\n');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.trim();

  return { title, text: cleaned };
}

async function fetchSinglePageText(args: { url: URL; timeoutMs: number }): Promise<
  | {
      ok: true;
      finalUrl: string;
      status: number;
      contentType: string;
      title?: string;
      text: string;
      truncated: boolean;
    }
  | { ok: false; status?: number; message: string }
> {
  const maxRedirects = 3;
  const maxBytes = 750_000;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(250, args.timeoutMs));

  try {
    let current = args.url;
    for (let i = 0; i <= maxRedirects; i++) {
      const blocked = isBlockedFetchUrl(current);
      if (blocked) return { ok: false, message: `URL is not allowed (${blocked}).` };

      let res: Response;
      try {
        res = await fetch(current.toString(), {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            accept: 'text/html, text/plain;q=0.9, */*;q=0.1',
            'user-agent': 'ClickeenCopilot/1.0 (single-page-fetch)',
          },
        });
      } catch (err) {
        const name = isRecord(err) ? asString((err as any).name) : null;
        if (name === 'AbortError') return { ok: false, message: 'Timed out fetching the page.' };
        return { ok: false, message: 'Failed to fetch the page.' };
      }

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get('location') || '';
        if (!location) return { ok: false, status: res.status, message: 'Redirect response missing Location header.' };
        try {
          current = new URL(location, current);
          continue;
        } catch {
          return { ok: false, status: res.status, message: 'Redirected to an invalid URL.' };
        }
      }

      if (!res.ok) return { ok: false, status: res.status, message: `Request failed (HTTP ${res.status}).` };

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      const isHtml = contentType.includes('text/html');
      const isText = contentType.includes('text/plain');
      if (!isHtml && !isText) return { ok: false, status: res.status, message: `Unsupported content-type: ${contentType || 'unknown'}.` };

      const { text: bodyText, truncated } = await readResponseTextWithLimit(res, maxBytes);
      const extracted = isHtml ? htmlToText(bodyText) : { text: bodyText.trim() };
      if (!extracted.text) return { ok: false, status: res.status, message: 'Page content was empty.' };

      return {
        ok: true,
        finalUrl: current.toString(),
        status: res.status,
        contentType: contentType || 'unknown',
        title: isHtml ? extracted.title : undefined,
        text: extracted.text,
        truncated,
      };
    }

    return { ok: false, message: 'Too many redirects.' };
  } finally {
    clearTimeout(timeout);
  }
}

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
    'If SOURCE_PAGE_TEXT is present, it is extracted from exactly one public web page (no crawling). Use it only to inform content edits (e.g., FAQ questions/answers).',
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

  const cfError = looksLikeCloudflareErrorPage(input.prompt);
  if (cfError) {
    const session = await getSession(env, input.sessionId);
    session.lastActiveAtMs = Date.now();
    const msg =
      'That looks like a Cloudflare error page' +
      (cfError.status ? ` (HTTP ${cfError.status})` : '') +
      ". I can't use it to update FAQs because it doesn't contain your site's content. " +
      'Please share a working URL (that loads the real page) or paste the page text you want me to base the FAQs on.';

    session.turns = [
      ...session.turns,
      { role: 'user' as const, content: input.prompt },
      { role: 'assistant' as const, content: msg },
    ].slice(-10) as CopilotSession['turns'];
    await putSession(env, session);

    return {
      result: { message: msg },
      usage: { provider: 'local', model: 'cloudflare_error_detector', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
    };
  }

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

  let sourcePage:
    | { url: string; title?: string; text: string; truncated: boolean; status: number; contentType: string }
    | null = null;
  {
    const candidates = extractUrlCandidates(input.prompt)
      .map(normalizeUrl)
      .filter((u): u is URL => Boolean(u));

    const unique = Array.from(new Map(candidates.map((u) => [u.toString(), u])).values());
    if (unique.length > 1) {
      const msg = `I found multiple URLs in your message. Which single page should I use?\n\n- ${unique.map((u) => u.toString()).join('\n- ')}`;
      session.lastActiveAtMs = Date.now();
      session.turns = [
        ...session.turns,
        { role: 'user' as const, content: input.prompt },
        { role: 'assistant' as const, content: msg },
      ].slice(-10) as CopilotSession['turns'];
      await putSession(env, session);

      return { result: { message: msg }, usage: { provider: 'local', model: 'url_parser', promptTokens: 0, completionTokens: 0, latencyMs: 0 } };
    }

    const url = unique[0] ?? null;
    if (url) {
      const blocked = isBlockedFetchUrl(url);
      if (blocked) {
        const msg = `I can only read public web pages. That URL is not allowed (${blocked}). Please share a normal public https URL.`;
        session.lastActiveAtMs = Date.now();
        session.turns = [
          ...session.turns,
          { role: 'user' as const, content: input.prompt },
          { role: 'assistant' as const, content: msg },
        ].slice(-10) as CopilotSession['turns'];
        await putSession(env, session);

        return { result: { message: msg }, usage: { provider: 'local', model: 'url_guard', promptTokens: 0, completionTokens: 0, latencyMs: 0 } };
      }

      const fetchRes = await fetchSinglePageText({ url, timeoutMs: Math.min(8_000, Math.max(1_500, timeoutMs - 1_000)) });
      if (!fetchRes.ok) {
        const msg =
          `I tried to read ${url.toString()} but couldn't: ${fetchRes.message}` +
          (fetchRes.status ? ` (HTTP ${fetchRes.status})` : '') +
          ' Please share a working URL or paste the page text.';

        session.lastActiveAtMs = Date.now();
        session.turns = [
          ...session.turns,
          { role: 'user' as const, content: input.prompt },
          { role: 'assistant' as const, content: msg },
        ].slice(-10) as CopilotSession['turns'];
        await putSession(env, session);

        return { result: { message: msg }, usage: { provider: 'local', model: 'single_page_fetch', promptTokens: 0, completionTokens: 0, latencyMs: 0 } };
      }

      const excerptLimit = 10_000;
      const excerpt = fetchRes.text.length > excerptLimit ? `${fetchRes.text.slice(0, excerptLimit)}\n\n[truncated]` : fetchRes.text;

      sourcePage = {
        url: fetchRes.finalUrl,
        title: fetchRes.title,
        text: excerpt,
        truncated: fetchRes.truncated || fetchRes.text.length > excerptLimit,
        status: fetchRes.status,
        contentType: fetchRes.contentType,
      };

      session.source = { url: fetchRes.finalUrl, fetchedAtMs: Date.now(), ...(fetchRes.title ? { title: fetchRes.title } : {}) };
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const baseUrl = env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com';
  const model = env.DEEPSEEK_MODEL ?? 'deepseek-chat';

  const user = [
    `Widget type: ${input.widgetType}`,
    '',
    `User request: ${input.prompt}`,
    ...(sourcePage
      ? [
          '',
          `SOURCE_PAGE_URL: ${sourcePage.url}`,
          ...(sourcePage.title ? [`SOURCE_PAGE_TITLE: ${sourcePage.title}`] : []),
          'SOURCE_PAGE_TEXT:',
          sourcePage.text,
        ]
      : []),
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
      let text = '';
      try {
        text = await res.text();
      } catch (err: unknown) {
        const name = isRecord(err) ? asString((err as any).name) : null;
        if (name === 'AbortError') throw new HttpError(429, { code: 'BUDGET_EXCEEDED', message: 'Execution timeout exceeded' });
      }
      throw new HttpError(502, {
        code: 'PROVIDER_ERROR',
        provider: 'deepseek',
        message: `Upstream error (${res.status}) ${text}`.trim(),
      });
    }
    try {
      responseJson = (await res.json()) as OpenAIChatResponse;
    } catch (err: unknown) {
      const name = isRecord(err) ? asString((err as any).name) : null;
      if (name === 'AbortError') throw new HttpError(429, { code: 'BUDGET_EXCEEDED', message: 'Execution timeout exceeded' });
      throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'deepseek', message: 'Invalid upstream JSON' });
    }
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
