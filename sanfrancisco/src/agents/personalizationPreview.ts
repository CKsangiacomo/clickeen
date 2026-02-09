import { normalizeLocaleToken } from '@clickeen/l10n';
import type { AIGrant, Env, Usage } from '../types';
import { HttpError, isRecord } from '../http';
import { callChatCompletion } from '../ai/chat';
import { fetchHeadMeta, fetchHtmlSnippet, isBlockedFetchUrl, normalizeUrl } from '../utils/webFetch';

export type PersonalizationPreviewInput = {
  url: string;
  locale?: string;
  templateContext?: Record<string, unknown>;
  allowedOverrides: string[];
};

export type PersonalizationPreviewResult = {
  brandName: string;
  businessType: string;
  copyOverrides: Record<string, string>;
  confidence: number;
  notes: string[];
};

type PreviewSignals = {
  url: string;
  locale: string;
  templateContext?: Record<string, unknown>;
  head?: Record<string, unknown>;
  snippet?: string;
  derived?: {
    brandNameGuess?: string;
    businessTypeGuess?: string;
    descriptionGuess?: string;
  };
};

const DEFAULT_LOCALE = 'en-us';
const HEAD_TIMEOUT_MS = 20_000;
const HEAD_TIMEOUT_MS_MINIBOB = 2_500;
const SNIPPET_TIMEOUT_MS = 25_000;
const MODEL_TIMEOUT_MS_MINIBOB = 4_000;
const MODEL_MAX_TOKENS_MINIBOB = 320;
const MAX_COPY_LENGTH = 400; // Increased to allow decent FAQ answers
const MAX_NOTES = 6;

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLocale(raw: unknown): string {
  const normalized = normalizeLocaleToken(raw);
  if (normalized) return normalized;
  return DEFAULT_LOCALE;
}

function clampConfidence(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function trimCopy(value: string): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  if (trimmed.length <= MAX_COPY_LENGTH) return trimmed;
  return trimmed.slice(0, MAX_COPY_LENGTH).trim();
}

function containsUrl(value: string): boolean {
  return /\bhttps?:\/\//i.test(value) || /\bwww\./i.test(value);
}

function sanitizeOverrides(raw: unknown, allowed: string[]): Record<string, string> {
  if (!isRecord(raw)) return {};
  const out: Record<string, string> = {};
  for (const key of allowed) {
    const value = asTrimmedString((raw as any)[key]);
    if (!value) continue;
    if (containsUrl(value)) continue;
    const trimmed = trimCopy(value);
    if (trimmed) out[key] = trimmed;
  }
  return out;
}

function sanitizeNotes(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return fallback;
  const notes = raw
    .map((item) => asTrimmedString(item))
    .filter(Boolean)
    .slice(0, MAX_NOTES);
  return notes.length ? notes : fallback;
}

function stripMarkdownFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  const lines = trimmed.split('\n');
  lines.shift(); // opening fence (``` or ```json)
  while (lines.length && lines[lines.length - 1]?.trim() === '```') lines.pop();
  return lines.join('\n').trim();
}

function removeTrailingCommas(raw: string): string {
  return raw.replace(/,\s*([}\]])/g, '$1');
}

function extractFirstJsonObject(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      depth += 1;
      continue;
    }
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return raw.slice(start, i + 1);
      }
    }
  }

  return null;
}

function tryParseJsonFromModel(raw: string): unknown | null {
  const cleaned = stripMarkdownFence(raw)
    .replace(/\u00a0/g, ' ') // nbsp
    .replace(/[“”]/g, '"')
    .trim();

  const candidates = [cleaned, removeTrailingCommas(cleaned)];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // continue
    }
  }

  const extracted = extractFirstJsonObject(cleaned);
  if (extracted) {
    const extractedCandidates = [extracted, removeTrailingCommas(extracted)];
    for (const candidate of extractedCandidates) {
      try {
        return JSON.parse(candidate);
      } catch {
        // continue
      }
    }
  }

  return null;
}

function buildSystemPrompt(allowedOverrides: string[], widgetType?: string): string {
  const isFaq = widgetType === 'faq';

  return [
    'You are Clickeen personalization agent for acquisition preview.',
    'No URLs. No HTML. Plain text only.',
    '',
    '# OUTPUT FORMAT (IMPORTANT)',
    'Return ONLY override lines. No markdown, no extra text.',
    'One override per line:',
    '<key>\\t<value>',
    '',
    `Allowed keys: ${allowedOverrides.join(', ') || 'none'}.`,
    '',
    '# GOAL',
    'Personalize the widget copy to match the provided website URL/Signals.',
    'Rewrite the copy to sound like this business.',
    '',
    isFaq
      ? '# FAQ INSTRUCTIONS\n- This is an FAQ widget.\n- If allowedOverrides include FAQ questions/answers, rewrite them to be SPECIFIC to this business.\n- Invent realistic questions customers would actually ask.\n- Write helpful answers (2-3 sentences max).\n- If allowedOverrides include section/header/CTA fields, update those too.'
      : '# INSTRUCTIONS\n- Keep copy punchy and human (1 sentence max per field).',
    '',
    'ALWAYS output at least 1 override line, even if signals are weak.',
  ].join('\n');
}

function buildUserPrompt(signals: PreviewSignals): string {
  return [
    'Signals (JSON):',
    JSON.stringify(signals, null, 2),
  ].join('\n');
}

function hasUsefulHead(head: Record<string, unknown> | undefined): boolean {
  if (!head) return false;
  const keys = ['title', 'description', 'ogTitle', 'ogDescription', 'ogSiteName', 'twitterTitle', 'jsonLdName'];
  return keys.some((k) => typeof (head as any)[k] === 'string' && String((head as any)[k]).trim().length > 2);
}

function splitTitleParts(raw: string): string[] {
  const title = raw.replace(/\s+/g, ' ').trim();
  if (!title) return [];
  let parts = [title];

  const splitOn = (sep: string) => {
    parts = parts.flatMap((p) => p.split(sep));
  };

  if (title.includes('|')) splitOn('|');
  if (title.includes(' — ')) splitOn(' — ');
  if (title.includes(' – ')) splitOn(' – ');
  if (title.includes(' - ')) splitOn(' - ');
  if (title.includes(': ')) splitOn(': ');

  return parts.map((p) => p.trim()).filter(Boolean);
}

function escapeRegex(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractBusinessTypeFromDescription(description: string, brandName: string): string {
  const desc = description.replace(/\s+/g, ' ').trim();
  if (!desc) return '';
  const brand = brandName.replace(/\s+/g, ' ').trim();

  const baseRe = brand
    ? new RegExp(
        `\\b${escapeRegex(brand)}\\b\\s+is\\s+(?:an?|the)\\s+(.+?)(?:\\s+(?:that|who|which|for|focused|speciali[sz]es|investing|providing|offering)\\b|[.,;]|$)`,
        'i',
      )
    : /\bis\s+(?:an?|the)\s+(.+?)(?:\s+(?:that|who|which|for|focused|speciali[sz]es|investing|providing|offering)\b|[.,;]|$)/i;

  const m = desc.match(baseRe);
  if (!m?.[1]) return '';
  return trimCopy(m[1]);
}

function deriveBusinessSignals(args: {
  url: URL;
  head?: Record<string, unknown>;
}): { brandName: string; businessType: string; description: string } {
  const head = args.head ?? {};
  const description =
    asTrimmedString((head as any).description) ||
    asTrimmedString((head as any).ogDescription) ||
    asTrimmedString((head as any).twitterDescription) ||
    '';

  const titleCandidate =
    asTrimmedString((head as any).ogTitle) ||
    asTrimmedString((head as any).twitterTitle) ||
    asTrimmedString((head as any).title) ||
    '';
  const titleParts = splitTitleParts(titleCandidate);

  const brandCandidate =
    asTrimmedString((head as any).jsonLdName) ||
    asTrimmedString((head as any).ogSiteName) ||
    (titleParts[0] ? titleParts[0].trim() : '');

  const brandName = brandCandidate && !containsUrl(brandCandidate) ? trimCopy(brandCandidate) : '';

  let businessType = '';
  if (titleParts.length >= 2) {
    const candidate = trimCopy(titleParts[1] ?? '');
    if (candidate && !containsUrl(candidate) && (!brandName || !candidate.toLowerCase().includes(brandName.toLowerCase()))) {
      businessType = candidate;
    }
  }
  if (!businessType && description) {
    const candidate = extractBusinessTypeFromDescription(description, brandName);
    if (candidate && !containsUrl(candidate)) businessType = candidate;
  }

  const normalizedDescription = trimCopy(description);

  if (!brandName) {
    const host = args.url.hostname.replace(/^www\./i, '');
    const fallback = host.split('.')[0] || host;
    const normalized = fallback.replace(/[-_]+/g, ' ').trim();
    return { brandName: trimCopy(normalized), businessType, description: normalizedDescription };
  }

  return { brandName, businessType, description: normalizedDescription };
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'") || (first === '`' && last === '`')) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function parseCopyOverridesFromModelText(raw: string, allowedOverrides: string[]): Record<string, string> {
  const cleaned = stripMarkdownFence(raw)
    .replace(/\u00a0/g, ' ')
    .replace(/[“”]/g, '"')
    .trim();

  const allowed = new Set(allowedOverrides);

  const parsed = tryParseJsonFromModel(cleaned);
  if (isRecord(parsed)) {
    const maybeOverrides = isRecord((parsed as any).copyOverrides) ? (parsed as any).copyOverrides : parsed;
    const overrides = sanitizeOverrides(maybeOverrides, allowedOverrides);
    if (Object.keys(overrides).length) return overrides;
  }

  const rawOverrides: Record<string, string> = {};
  const lines = cleaned.split(/\r?\n/);
  for (const lineRaw of lines) {
    const line = lineRaw.trim().replace(/^[-*]\s+/, '');
    if (!line) continue;

    const tabIndex = line.indexOf('\t');
    if (tabIndex !== -1) {
      const key = line.slice(0, tabIndex).trim();
      const value = stripWrappingQuotes(line.slice(tabIndex + 1).trim());
      if (!key || !value) continue;
      if (!allowed.has(key)) continue;
      rawOverrides[key] = value;
      continue;
    }

    const sepMatch = line.match(/^([^:=]+?)\s*[:=]\s*(.+)$/);
    if (!sepMatch) continue;
    const key = (sepMatch[1] ?? '').trim();
    const value = stripWrappingQuotes((sepMatch[2] ?? '').trim());
    if (!key || !value) continue;
    if (!allowed.has(key)) continue;
    rawOverrides[key] = value;
  }

  return sanitizeOverrides(rawOverrides, allowedOverrides);
}

function buildFallbackOverrides(args: {
  allowedOverrides: string[];
  currentCopy?: Record<string, unknown>;
  brandName: string;
  businessType: string;
  description: string;
}): Record<string, string> {
  const allowed = args.allowedOverrides;
  const brandName = args.brandName;
  const businessType = args.businessType;
  const description = args.description;

  const currentCopy = args.currentCopy ?? {};
  const getCurrent = (key: string) => {
    const value = currentCopy[key];
    return typeof value === 'string' ? value : '';
  };

  const isVenture = /\b(venture|vc|capital|invest)\b/i.test(`${businessType} ${description}`);
  const safeDescription = description || (brandName && businessType ? `${brandName} is ${businessType}.` : '');

  const overrides: Record<string, string> = {};

  if (brandName && allowed.includes('header.title')) {
    overrides['header.title'] = `Frequently Asked Questions about ${brandName}`;
  }
  if (safeDescription && allowed.includes('header.subtitleHtml')) {
    overrides['header.subtitleHtml'] = safeDescription;
  }
  if (brandName && allowed.includes('cta.label')) {
    overrides['cta.label'] = isVenture ? 'Pitch us' : `Contact ${brandName}`;
  }

  type FaqKeys = { question?: string; answer?: string };
  const faqByIndex = new Map<number, FaqKeys>();
  for (const key of allowed) {
    const m = key.match(/\.faqs\.(\d+)\.(question|answer)$/);
    if (!m) continue;
    const idx = Number(m[1]);
    if (!Number.isFinite(idx)) continue;
    const entry = faqByIndex.get(idx) ?? {};
    if (m[2] === 'question') entry.question = key;
    if (m[2] === 'answer') entry.answer = key;
    faqByIndex.set(idx, entry);
  }

  const indices = Array.from(faqByIndex.keys()).sort((a, b) => a - b);

  const ventureQuestions = [
    (b: string) => `What is ${b}?`,
    (b: string) => `What does ${b} invest in?`,
    (b: string) => `What stage does ${b} invest in?`,
    (b: string) => `How can founders reach ${b}?`,
  ];
  const ventureAnswers = [
    () => safeDescription,
    () => {
      const m = safeDescription.match(/\binvesting in\b[\s\S]{0,60}$/i);
      return m ? `We focus on ${trimCopy(m[0].replace(/^investing in/i, '').trim())}.` : 'We focus on a focused set of sectors aligned with our thesis.';
    },
    () => (businessType ? `We focus on ${businessType.replace(/\.$/, '')}.` : 'We focus on early-stage opportunities where we can be a strong partner.'),
    () => 'Use the contact page on our website to share a quick overview, and we’ll route it to the right person.',
  ];

  const genericQuestions = [
    (b: string) => `What is ${b}?`,
    (b: string) => `What does ${b} do?`,
    (b: string) => `Who is ${b} for?`,
    (b: string) => `How can I contact ${b}?`,
  ];
  const genericAnswers = [
    () => safeDescription,
    () => (brandName && businessType ? `${brandName} is ${businessType.replace(/\.$/, '')}.` : safeDescription),
    () => 'It’s built for people who want a clear, fast way to get answers and take the next step.',
    () => 'Use the contact link on the page, and we’ll get back to you shortly.',
  ];

  for (let i = 0; i < indices.length; i += 1) {
    const idx = indices[i];
    const keys = faqByIndex.get(idx);
    if (!keys) continue;

    const qTemplate = isVenture ? ventureQuestions : genericQuestions;
    const aTemplate = isVenture ? ventureAnswers : genericAnswers;

    const question = brandName ? qTemplate[Math.min(i, qTemplate.length - 1)](brandName) : '';
    const answer = aTemplate[Math.min(i, aTemplate.length - 1)]();

    if (keys.question && question) overrides[keys.question] = question;
    if (keys.answer && answer) overrides[keys.answer] = answer;
  }

  if (brandName) {
    for (const key of allowed) {
      if (overrides[key]) continue;
      const cur = getCurrent(key);
      if (!cur) continue;
      if (!/\bclickeen\b/i.test(cur)) continue;
      overrides[key] = trimCopy(cur.replace(/\bclickeen\b/gi, brandName));
    }
  }

  return sanitizeOverrides(overrides, allowed);
}

export async function executePersonalizationPreview(args: {
  env: Env;
  grant: AIGrant;
  input: PersonalizationPreviewInput;
}): Promise<{ result: PersonalizationPreviewResult; usage: Usage }> {
  const urlRaw = asTrimmedString(args.input.url);
  if (!urlRaw) throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Missing url' });

  const url = normalizeUrl(urlRaw);
  if (!url) throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid url' });
  const blocked = isBlockedFetchUrl(url);
  if (blocked) throw new HttpError(400, { code: 'BAD_REQUEST', message: `URL is not allowed (${blocked}).` });

  const locale = normalizeLocale(args.input.locale);
  const allowedOverrides = args.input.allowedOverrides;
  const notes: string[] = [];

  // [Minibob vs Bob] Minibob (anon grants) is leadgen: shallow, fast, reliable.
  const isLightweightMode = args.grant.sub.kind === 'anon';

  let head: Record<string, unknown> | undefined;
  const headTimeoutMs = isLightweightMode ? HEAD_TIMEOUT_MS_MINIBOB : HEAD_TIMEOUT_MS;
  const headRes = await fetchHeadMeta({ url, timeoutMs: headTimeoutMs });
  if (headRes.ok) {
    head = headRes.meta;
    notes.push('Used head meta');
  }

  let snippet: string | undefined;
  if (!isLightweightMode && !hasUsefulHead(head)) {
    const snippetRes = await fetchHtmlSnippet({ url, timeoutMs: SNIPPET_TIMEOUT_MS });
    if (snippetRes.ok) {
      snippet = snippetRes.snippet;
      notes.push('Used homepage snippet');
    }
  } else if (isLightweightMode && !head) {
    notes.push('Lightweight mode: shallow scan only');
  }

  const derived = deriveBusinessSignals({ url, head });

  const signals: PreviewSignals = {
    url: url.toString(),
    locale,
    ...(args.input.templateContext ? { templateContext: args.input.templateContext } : {}),
    ...(head ? { head } : {}),
    ...(snippet ? { snippet } : {}),
    derived: {
      ...(derived.brandName ? { brandNameGuess: derived.brandName } : {}),
      ...(derived.businessType ? { businessTypeGuess: derived.businessType } : {}),
      ...(derived.description ? { descriptionGuess: derived.description } : {}),
    },
  };

  const widgetType = String((args.input.templateContext?.widget as any) || '').trim().toLowerCase();

  const currentCopy = isRecord((args.input.templateContext as any)?.currentCopy)
    ? (((args.input.templateContext as any).currentCopy as any) as Record<string, unknown>)
    : undefined;

  const modelStartedAt = Date.now();
  let content = '';
  let usage: Usage = {
    provider: 'deepseek',
    model: args.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
    promptTokens: 0,
    completionTokens: 0,
    latencyMs: 0,
  };

  try {
    const modelRes = await callChatCompletion({
      env: args.env,
      grant: args.grant,
      agentId: 'agent.personalization.preview.v1',
      messages: [
        { role: 'system', content: buildSystemPrompt(allowedOverrides, widgetType) },
        { role: 'user', content: buildUserPrompt(signals) },
      ],
      temperature: 0.2,
      ...(isLightweightMode ? { timeoutMs: MODEL_TIMEOUT_MS_MINIBOB, maxTokens: MODEL_MAX_TOKENS_MINIBOB } : {}),
    });
    content = modelRes.content;
    usage = modelRes.usage;
  } catch (err) {
    const message = err instanceof HttpError ? err.error?.message ?? err.message : err instanceof Error ? err.message : 'Unknown error';
    notes.push(`Model skipped (${message})`);
    usage = { ...usage, latencyMs: Date.now() - modelStartedAt };
  }

  const modelOverrides = content ? parseCopyOverridesFromModelText(content, allowedOverrides) : {};
  const fallbackOverrides =
    Object.keys(modelOverrides).length > 0
      ? modelOverrides
      : buildFallbackOverrides({
          allowedOverrides,
          currentCopy,
          brandName: derived.brandName,
          businessType: derived.businessType,
          description: derived.description,
        });

  if (Object.keys(modelOverrides).length > 0) {
    notes.push('Used model copy overrides');
  } else {
    notes.push('Used fallback copy overrides');
  }

  const confidence = head || snippet ? 0.6 : 0.35;
  const finalNotes = (notes.length ? notes : ['Signals were limited']).slice(0, MAX_NOTES);

  const result: PersonalizationPreviewResult = {
    brandName: derived.brandName,
    businessType: derived.businessType,
    copyOverrides: fallbackOverrides,
    confidence,
    notes: finalNotes,
  };

  return { result, usage };
}
