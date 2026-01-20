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
};

const DEFAULT_LOCALE = 'en-us';
const HEAD_TIMEOUT_MS = 4_000;
const SNIPPET_TIMEOUT_MS = 5_000;
const MAX_COPY_LENGTH = 160;
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

function parseJsonFromModel(raw: string, provider: string): unknown {
  const trimmed = raw.trim();
  let cleaned = trimmed;

  if (cleaned.startsWith('```')) {
    const lines = cleaned.split('\n');
    lines.shift();
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
    throw new HttpError(502, { code: 'PROVIDER_ERROR', provider, message: 'Model did not return valid JSON' });
  }
}

function buildSystemPrompt(allowedOverrides: string[]): string {
  return [
    'You are Clickeen personalization agent for acquisition preview.',
    'Return ONLY JSON. No markdown, no extra text.',
    'No URLs. No HTML.',
    `Only use these copyOverride keys: ${allowedOverrides.join(', ') || 'none'}.`,
    'Keep copy short and human (1 sentence max per field).',
    'If unsure, leave copyOverrides empty and lower confidence.',
    '',
    'JSON shape:',
    '{ "brandName": string, "businessType": string, "copyOverrides": object, "confidence": number, "notes": string[] }',
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

  let head: Record<string, unknown> | undefined;
  const headRes = await fetchHeadMeta({ url, timeoutMs: HEAD_TIMEOUT_MS });
  if (headRes.ok) {
    head = headRes.meta;
    notes.push('Used head meta');
  }

  let snippet: string | undefined;
  if (!hasUsefulHead(head)) {
    const snippetRes = await fetchHtmlSnippet({ url, timeoutMs: SNIPPET_TIMEOUT_MS });
    if (snippetRes.ok) {
      snippet = snippetRes.snippet;
      notes.push('Used homepage snippet');
    }
  }

  const signals: PreviewSignals = {
    url: url.toString(),
    locale,
    ...(args.input.templateContext ? { templateContext: args.input.templateContext } : {}),
    ...(head ? { head } : {}),
    ...(snippet ? { snippet } : {}),
  };

  const { content, usage } = await callChatCompletion({
    env: args.env,
    grant: args.grant,
    agentId: 'agent.personalization.preview.v1',
    messages: [
      { role: 'system', content: buildSystemPrompt(allowedOverrides) },
      { role: 'user', content: buildUserPrompt(signals) },
    ],
    temperature: 0.2,
  });

  const parsed = parseJsonFromModel(content, usage.provider);
  if (!isRecord(parsed)) {
    throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: usage.provider, message: 'Model output must be an object' });
  }

  const brandNameRaw = trimCopy(asTrimmedString((parsed as any).brandName));
  const businessTypeRaw = trimCopy(asTrimmedString((parsed as any).businessType));
  const brandName = brandNameRaw && !containsUrl(brandNameRaw) ? brandNameRaw : '';
  const businessType = businessTypeRaw && !containsUrl(businessTypeRaw) ? businessTypeRaw : '';
  const copyOverrides = sanitizeOverrides((parsed as any).copyOverrides, allowedOverrides);
  const confidence = clampConfidence((parsed as any).confidence, head || snippet ? 0.6 : 0.35);
  const finalNotes = sanitizeNotes((parsed as any).notes, notes.length ? notes : ['Signals were limited']);

  const result: PersonalizationPreviewResult = {
    brandName,
    businessType,
    copyOverrides,
    confidence,
    notes: finalNotes,
  };

  return { result, usage };
}
