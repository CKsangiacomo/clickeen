import { normalizeLocaleToken } from '@clickeen/l10n';
import type { AIGrant, Env, Usage } from '../types';
import { HttpError, isRecord } from '../http';
import { callChatCompletion } from '../ai/chat';
import { fetchHeadMeta, fetchHtmlSnippet, isBlockedFetchUrl, normalizeUrl } from '../utils/webFetch';

export type PersonalizationOnboardingInput = {
  workspaceId: string;
  url: string;
  locale?: string;
  websiteDepth?: number;
  gbpPlaceId?: string;
  facebookPageId?: string;
  instagramHandle?: string;
};

export type PersonalizationOnboardingResult = {
  businessProfile: Record<string, unknown>;
  recommendations?: Record<string, unknown>;
  confidence: number;
  sourcesUsed: string[];
  notes?: string[];
};

type PageSignal = {
  url: string;
  head?: Record<string, unknown>;
  snippet?: string;
};

type OnboardingSignals = {
  url: string;
  locale: string;
  websiteDepth: number;
  pages: PageSignal[];
  connectors?: Record<string, unknown>;
};

const DEFAULT_LOCALE = 'en-us';
const MAX_PAGES = 5;
const HEAD_TIMEOUT_MS = 4_000;
const SNIPPET_TIMEOUT_MS = 5_000;
const MAX_NOTES = 6;
const MAX_STRING = 600;
const MAX_ARRAY = 24;
const MAX_KEYS = 40;
const MAX_DEPTH = 4;

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLocale(raw: unknown): string {
  const normalized = normalizeLocaleToken(raw);
  if (normalized) return normalized;
  return DEFAULT_LOCALE;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? Math.floor(value) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function clampConfidence(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ');
}

function sanitizeText(value: string): string {
  const cleaned = stripHtml(value).replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (cleaned.length <= MAX_STRING) return cleaned;
  return cleaned.slice(0, MAX_STRING).trim();
}

function sanitizeNotes(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return fallback;
  const notes = raw
    .map((item) => sanitizeText(asTrimmedString(item)))
    .filter(Boolean)
    .slice(0, MAX_NOTES);
  return notes.length ? notes : fallback;
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return null;
  if (typeof value === 'string') {
    const text = sanitizeText(value);
    return text || null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    const items: unknown[] = [];
    for (const item of value) {
      const next = sanitizeValue(item, depth + 1);
      if (next === null || next === undefined) continue;
      items.push(next);
      if (items.length >= MAX_ARRAY) break;
    }
    return items.length ? items : null;
  }
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    let count = 0;
    for (const [key, val] of Object.entries(value)) {
      if (!key || typeof key !== 'string') continue;
      const cleanKey = key.trim();
      if (!cleanKey) continue;
      const next = sanitizeValue(val, depth + 1);
      if (next === null || next === undefined) continue;
      out[cleanKey] = next;
      count += 1;
      if (count >= MAX_KEYS) break;
    }
    return Object.keys(out).length ? out : null;
  }
  return null;
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

function buildSystemPrompt(locale: string): string {
  return [
    'You are Clickeen onboarding personalization agent.',
    `Target locale: ${locale}.`,
    'Return ONLY JSON. No markdown, no extra text.',
    'No HTML in outputs.',
    'Use best-effort inference based on the provided signals.',
    '',
    'Return JSON shape:',
    '{',
    '  "businessProfile": { "name": string, "category": string, "description"?: string, "nap"?: object, "hours"?: object, "services"?: string[], "toneHints"?: string[] },',
    '  "recommendations"?: { "templates"?: any[], "defaultCopyPackId"?: string },',
    '  "confidence": number,',
    '  "sourcesUsed": string[],',
    '  "notes"?: string[]',
    '}',
  ].join('\n');
}

function buildUserPrompt(signals: OnboardingSignals): string {
  return ['Signals (JSON):', JSON.stringify(signals, null, 2)].join('\n');
}

function hasUsefulHead(head: Record<string, unknown> | undefined): boolean {
  if (!head) return false;
  const keys = ['title', 'description', 'ogTitle', 'ogDescription', 'ogSiteName', 'twitterTitle', 'jsonLdName'];
  return keys.some((k) => typeof (head as any)[k] === 'string' && String((head as any)[k]).trim().length > 2);
}

function buildPageCandidates(baseUrl: URL, depth: number): URL[] {
  const candidates = ['/', '/about', '/services', '/pricing', '/contact', '/team', '/company'];
  const out: URL[] = [];

  const base = new URL(baseUrl.toString());
  out.push(base);

  for (const path of candidates) {
    if (out.length >= depth) break;
    const next = new URL(path, base.origin);
    if (out.some((u) => u.toString() === next.toString())) continue;
    out.push(next);
  }

  return out.slice(0, depth);
}

function mergeSourcesUsed(inputSources: string[], modelSources: unknown): string[] {
  const allowed = new Set(['website', 'gbp', 'facebook', 'instagram']);
  const out = new Set<string>();
  inputSources.forEach((s) => {
    if (allowed.has(s)) out.add(s);
  });
  if (Array.isArray(modelSources)) {
    modelSources.forEach((s) => {
      if (typeof s === 'string' && allowed.has(s.trim())) out.add(s.trim());
    });
  }
  return Array.from(out);
}

export async function executePersonalizationOnboarding(args: {
  env: Env;
  grant: AIGrant;
  input: PersonalizationOnboardingInput;
}): Promise<{ result: PersonalizationOnboardingResult; usage: Usage }> {
  const workspaceId = asTrimmedString(args.input.workspaceId);
  if (!workspaceId) throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Missing workspaceId' });

  const urlRaw = asTrimmedString(args.input.url);
  if (!urlRaw) throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Missing url' });
  const url = normalizeUrl(urlRaw);
  if (!url) throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid url' });
  const blocked = isBlockedFetchUrl(url);
  if (blocked) throw new HttpError(400, { code: 'BAD_REQUEST', message: `URL is not allowed (${blocked}).` });

  const locale = normalizeLocale(args.input.locale);
  const depth = clampInt(args.input.websiteDepth, 1, 1, MAX_PAGES);

  const pages: PageSignal[] = [];
  const notes: string[] = [];
  const candidateUrls = buildPageCandidates(url, depth);

  for (let i = 0; i < candidateUrls.length; i += 1) {
    const pageUrl = candidateUrls[i];
    const headRes = await fetchHeadMeta({ url: pageUrl, timeoutMs: HEAD_TIMEOUT_MS });
    let head: Record<string, unknown> | undefined;
    if (headRes.ok) {
      head = headRes.meta;
    }

    let snippet: string | undefined;
    if (i === 0 && !hasUsefulHead(head)) {
      const snippetRes = await fetchHtmlSnippet({ url: pageUrl, timeoutMs: SNIPPET_TIMEOUT_MS });
      if (snippetRes.ok) snippet = snippetRes.snippet;
    }

    if (i > 0) {
      const snippetRes = await fetchHtmlSnippet({ url: pageUrl, timeoutMs: SNIPPET_TIMEOUT_MS });
      if (snippetRes.ok) snippet = snippetRes.snippet;
    }

    if (head || snippet) {
      pages.push({ url: pageUrl.toString(), ...(head ? { head } : {}), ...(snippet ? { snippet } : {}) });
    }
  }

  if (!pages.length) {
    notes.push('Website fetch yielded no usable signals');
  } else {
    notes.push('Used website signals');
  }

  const connectors: Record<string, unknown> = {};
  const gbpPlaceId = asTrimmedString(args.input.gbpPlaceId);
  if (gbpPlaceId) connectors.gbpPlaceId = gbpPlaceId;
  const facebookPageId = asTrimmedString(args.input.facebookPageId);
  if (facebookPageId) connectors.facebookPageId = facebookPageId;
  const instagramHandle = asTrimmedString(args.input.instagramHandle);
  if (instagramHandle) connectors.instagramHandle = instagramHandle;

  const signals: OnboardingSignals = {
    url: url.toString(),
    locale,
    websiteDepth: depth,
    pages,
    ...(Object.keys(connectors).length ? { connectors } : {}),
  };

  const { content, usage } = await callChatCompletion({
    env: args.env,
    grant: args.grant,
    agentId: 'agent.personalization.onboarding.v1',
    messages: [
      { role: 'system', content: buildSystemPrompt(locale) },
      { role: 'user', content: buildUserPrompt(signals) },
    ],
    temperature: 0.2,
  });

  const parsed = parseJsonFromModel(content, usage.provider);
  if (!isRecord(parsed)) {
    throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: usage.provider, message: 'Model output must be an object' });
  }

  const rawProfile = sanitizeValue((parsed as any).businessProfile) as Record<string, unknown> | null;
  const businessProfile = rawProfile && isRecord(rawProfile) ? rawProfile : {};
  const rawRecommendations = sanitizeValue((parsed as any).recommendations) as Record<string, unknown> | null;
  const recommendations = rawRecommendations && isRecord(rawRecommendations) ? rawRecommendations : undefined;

  const confidence = clampConfidence((parsed as any).confidence, pages.length ? 0.6 : 0.35);
  const sourcesSeed: string[] = [];
  if (pages.length) sourcesSeed.push('website');
  if (gbpPlaceId) sourcesSeed.push('gbp');
  if (facebookPageId) sourcesSeed.push('facebook');
  if (instagramHandle) sourcesSeed.push('instagram');
  const sourcesUsed = mergeSourcesUsed(sourcesSeed, (parsed as any).sourcesUsed);
  const finalNotes = sanitizeNotes((parsed as any).notes, notes);

  const result: PersonalizationOnboardingResult = {
    businessProfile,
    ...(recommendations ? { recommendations } : {}),
    confidence,
    sourcesUsed,
    ...(finalNotes.length ? { notes: finalNotes } : {}),
  };

  return { result, usage };
}
