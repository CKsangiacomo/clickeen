import type { Env } from '../types';
import { HttpError, isRecord } from '../http';
import {
  extractUrlCandidates,
  fetchSinglePageText,
  isBlockedFetchUrl,
  normalizeUrl,
} from '../utils/webFetch';
import { WIDGET_COPILOT_PROMPT_PROFILES } from './widgetCopilotPromptProfiles';

type WidgetCopilotInputLite = {
  prompt: string;
  widgetType: string;
  currentConfig: Record<string, unknown>;
};

type WidgetCopilotCta = { text: string; action: 'signup' | 'upgrade' | 'learn-more'; url?: string };

type SdrSessionLike = {
  pendingConsent?: { kind: 'website'; url: string; askedAtMs: number };
  source?: { url: string; fetchedAtMs: number; title?: string };
  lastActiveAtMs: number;
  turns: Array<{ role: 'user' | 'assistant'; content: string }>;
  conversationLanguage?: string;
  languageConfidence?: number;
};

type WidgetOpLite =
  | { op: 'set'; path: string; value: unknown }
  | { op: 'insert'; path: string; index: number; value: unknown }
  | { op: 'remove'; path: string; index: number }
  | { op: 'move'; path: string; from: number; to: number };

export type SdrAllowlistEntry = { path: string; type: 'string' | 'richtext'; role?: string };
type SdrAllowlistFile = { v: 1; paths: SdrAllowlistEntry[] };

export type SdrSourcePage = {
  url: string;
  title?: string;
  text: string;
  truncated: boolean;
  status: number;
  contentType: string;
};

export type SdrWebsiteSourceResult =
  | { kind: 'continue'; sourcePage: SdrSourcePage | null }
  | { kind: 'reply'; message: string; usageModel: string };

export type SdrPreludeResult =
  | { kind: 'continue'; websiteIntent: boolean }
  | { kind: 'reply'; message: string; usageModel: string; intent: 'clarify'; cta?: WidgetCopilotCta; language?: string };

export type SdrPromptContext =
  | {
      kind: 'continue';
      context: {
        allowlistEntries: SdrAllowlistEntry[];
        allowlistSource: 'sdr_allowlist' | 'localization_fallback';
        systemPrompt: string;
        userPrompt: string;
      };
    }
  | { kind: 'reply'; message: string; usageModel: string; intent: 'clarify' };

function normalizeOpPath(raw: string): string {
  return String(raw || '')
    .replace(/\[(\d+)\]/g, '.$1')
    .replace(/\.+/g, '.')
    .replace(/^\./, '')
    .replace(/\.$/, '');
}

function splitPathSegments(pathStr: string): string[] {
  return String(pathStr || '')
    .split('.')
    .map((seg) => seg.trim())
    .filter(Boolean);
}

function isNumericSegment(seg: string): boolean {
  return /^\d+$/.test(seg);
}

function pathMatchesAllowlist(pathStr: string, allowPath: string): boolean {
  const pathSegs = splitPathSegments(pathStr);
  const allowSegs = splitPathSegments(allowPath);
  if (pathSegs.length !== allowSegs.length) return false;
  for (let i = 0; i < allowSegs.length; i += 1) {
    const allow = allowSegs[i];
    const actual = pathSegs[i];
    if (allow === '*') {
      if (!isNumericSegment(actual)) return false;
      continue;
    }
    if (allow !== actual) return false;
  }
  return true;
}

function collectEntriesForPath(args: {
  value: unknown;
  segments: string[];
  currentPath: string;
  out: Array<{ path: string; value: string }>;
}) {
  const { value, segments, currentPath, out } = args;
  if (!segments.length) {
    if (typeof value === 'string') {
      out.push({ path: currentPath, value });
    }
    return;
  }
  const [head, ...tail] = segments;
  if (!head) return;
  if (head === '*') {
    if (!Array.isArray(value)) return;
    value.forEach((item, index) => {
      collectEntriesForPath({
        value: item,
        segments: tail,
        currentPath: currentPath ? `${currentPath}.${index}` : String(index),
        out,
      });
    });
    return;
  }
  if (Array.isArray(value) && isNumericSegment(head)) {
    const index = Number(head);
    collectEntriesForPath({
      value: value[index],
      segments: tail,
      currentPath: currentPath ? `${currentPath}.${head}` : head,
      out,
    });
    return;
  }
  if (!value || typeof value !== 'object') return;
  collectEntriesForPath({
    value: (value as Record<string, unknown>)[head],
    segments: tail,
    currentPath: currentPath ? `${currentPath}.${head}` : head,
    out,
  });
}

function collectAllowlistedValues(config: Record<string, unknown>, allowlist: SdrAllowlistEntry[]) {
  const out: Array<{ path: string; value: string; role?: string; type: SdrAllowlistEntry['type'] }> = [];
  allowlist.forEach((entry) => {
    const segments = splitPathSegments(entry.path);
    if (!segments.length) return;
    const collected: Array<{ path: string; value: string }> = [];
    collectEntriesForPath({ value: config, segments, currentPath: '', out: collected });
    collected.forEach((item) => out.push({ ...item, role: entry.role, type: entry.type }));
  });
  return out;
}

async function fetchTokyoJson(env: Env, pathname: string): Promise<{ status: number; json: unknown | null }> {
  const base = String(env.TOKYO_BASE_URL || '').trim();
  if (!base) {
    throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'tokyo', message: 'Missing TOKYO_BASE_URL' });
  }
  const url = `${base.replace(/\/+$/, '')}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) return { status: res.status, json: null };
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function loadSdrAllowlist(env: Env, widgetType: string): Promise<{
  entries: SdrAllowlistEntry[];
  source: 'sdr_allowlist' | 'localization_fallback';
} | null> {
  const basePath = `/widgets/${encodeURIComponent(widgetType)}`;
  const primary = await fetchTokyoJson(env, `${basePath}/sdr.allowlist.json`);
  if (primary.status !== 404 && primary.json) {
    const file = primary.json as SdrAllowlistFile;
    if (file && file.v === 1 && Array.isArray(file.paths)) {
      const entries: SdrAllowlistEntry[] = file.paths
        .filter((p) => p && typeof p.path === 'string')
        .map((p): SdrAllowlistEntry => ({
          path: p.path.trim(),
          type: p.type === 'richtext' ? 'richtext' : 'string',
          ...(p.role ? { role: p.role } : {}),
        }))
        .filter((p) => p.path);
      return { entries, source: 'sdr_allowlist' };
    }
    throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'tokyo', message: 'Invalid sdr.allowlist.json' });
  }

  const environment = String(env.ENVIRONMENT || 'local').trim().toLowerCase();
  const allowFallback =
    environment === 'local' || environment === 'cloud-dev' || environment === 'dev' || environment === 'development';
  if (!allowFallback) return null;

  const fallback = await fetchTokyoJson(env, `${basePath}/localization.json`);
  if (!fallback.json) return null;
  const file = fallback.json as { v?: number; paths?: Array<{ path?: string; type?: string }> } | null;
  if (!file || file.v !== 1 || !Array.isArray(file.paths)) return null;
  const entries: SdrAllowlistEntry[] = file.paths
    .filter((p) => p && typeof p.path === 'string')
    .map((p): SdrAllowlistEntry => ({
      path: String(p.path || '').trim(),
      type: p?.type === 'richtext' ? 'richtext' : 'string',
    }))
    .filter((p) => p.path && !/branding|legal|disclaimer|powered|copyright/i.test(p.path));
  return entries.length ? { entries, source: 'localization_fallback' } : null;
}

export function looksLikeSdrWebsiteIntent(prompt: string): boolean {
  if (extractUrlCandidates(prompt).length > 0) return true;
  return /\b(my|our|from|based on|read|scan|crawl)\b[\s\S]{0,24}\b(website|site|homepage|domain|web page|webpage)\b/i.test(prompt);
}

export function looksLikeSdrRewriteIntent(args: { prompt: string; widgetType: string }): boolean {
  if ((args.widgetType || '').trim().toLowerCase() !== 'faq') return false;
  const prompt = args.prompt || '';
  const hasRewriteVerb =
    /\b(rewrite|rephrase|shorten|shorter|longer|expand|simplify|simpler|clarify|improve|better|different|edit|update|change)\b/i.test(
      prompt,
    );
  if (!hasRewriteVerb) return false;
  const hasFaqNouns = /\b(faq|q&a|qa|question|questions|answer|answers)\b/i.test(prompt);
  if (hasFaqNouns) return true;
  const hasStyleHints = /\b(color|font|typography|layout|padding|radius|shadow|border|stage|pod|background|button|icon)\b/i.test(prompt);
  return !hasStyleHints;
}

export function buildSdrUnsupportedMessage(): {
  message: string;
  cta: { text: string; action: 'signup' };
} {
  return {
    message:
      'I can do two things here: rewrite your FAQ questions/answers, or personalize them from one website URL. ' +
      'For design, layout, and advanced controls, create a free account to use the full editor.',
    cta: { text: 'Create a free account', action: 'signup' },
  };
}

export function maybeClarifySdr(input: WidgetCopilotInputLite): string | null {
  const prompt = input.prompt;

  if (/\b(based on|from)\b[\s\S]{0,40}\b(my )?website\b/i.test(prompt)) {
    const hasUrl = extractUrlCandidates(prompt).length > 0;
    if (!hasUrl) {
      return 'Paste a URL to a single page that contains the content you want to base the FAQs on (for example: https://example.com/faq).';
    }
  }

  if (/\b(rewrite|rephrase|modernize|refresh)\b/i.test(prompt) && /\b(faq|question|questions|answer|answers)\b/i.test(prompt)) {
    const sections = (input.currentConfig as any)?.sections;
    const hasExistingFaqs =
      Array.isArray(sections) &&
      sections.some((s) => Array.isArray((s as any)?.faqs) && (s as any).faqs.some((f: any) => typeof f?.question === 'string'));

    if (hasExistingFaqs) {
      return (
        'Do you want me to rewrite the existing FAQ questions/answers that are already in this widget (keeping the same meaning), ' +
        'or generate new FAQs based on your website?\n' +
        'Reply “rewrite existing” to update what’s already here, or paste a URL if you want new FAQs.'
      );
    }
  }

  return null;
}

export function resolveSdrPrelude(args: {
  input: WidgetCopilotInputLite;
  session: SdrSessionLike;
  detectLanguageOnlyIntent: (prompt: string) => { language: string } | null;
  buildLanguageClarifyMessage: (language: string) => string;
}): SdrPreludeResult {
  const { input, session } = args;

  if ((input.widgetType || '').trim().toLowerCase() !== 'faq') {
    const unsupported = buildSdrUnsupportedMessage();
    session.lastActiveAtMs = Date.now();
    session.turns = [
      ...session.turns,
      { role: 'user' as const, content: input.prompt },
      { role: 'assistant' as const, content: unsupported.message },
    ].slice(-10);
    return {
      kind: 'reply',
      message: unsupported.message,
      cta: unsupported.cta,
      usageModel: 'sdr_widget_type_gate',
      intent: 'clarify',
    };
  }

  const languageOnly = args.detectLanguageOnlyIntent(input.prompt);
  if (languageOnly) {
    session.conversationLanguage = languageOnly.language;
    session.languageConfidence = Math.max(session.languageConfidence ?? 0.5, 0.95);
    session.lastActiveAtMs = Date.now();
    const message = `${args.buildLanguageClarifyMessage(languageOnly.language)}\n\nTell me: “rewrite existing FAQs” or share one website URL.`;
    session.turns = [
      ...session.turns,
      { role: 'user' as const, content: input.prompt },
      { role: 'assistant' as const, content: message },
    ].slice(-10);
    return {
      kind: 'reply',
      message,
      usageModel: 'sdr_language_intent',
      intent: 'clarify',
      language: languageOnly.language,
    };
  }

  const rewriteIntent = looksLikeSdrRewriteIntent({ prompt: input.prompt, widgetType: input.widgetType });
  const websiteIntent = looksLikeSdrWebsiteIntent(input.prompt) || session.pendingConsent?.kind === 'website';
  if (!rewriteIntent && !websiteIntent) {
    const unsupported = buildSdrUnsupportedMessage();
    session.lastActiveAtMs = Date.now();
    session.turns = [
      ...session.turns,
      { role: 'user' as const, content: input.prompt },
      { role: 'assistant' as const, content: unsupported.message },
    ].slice(-10);
    return {
      kind: 'reply',
      message: unsupported.message,
      cta: unsupported.cta,
      usageModel: 'sdr_capability_gate',
      intent: 'clarify',
    };
  }

  const clarification = maybeClarifySdr(input);
  if (clarification) {
    session.lastActiveAtMs = Date.now();
    session.turns = [
      ...session.turns,
      { role: 'user' as const, content: input.prompt },
      { role: 'assistant' as const, content: clarification },
    ].slice(-10);
    return {
      kind: 'reply',
      message: clarification,
      usageModel: 'sdr_router',
      intent: 'clarify',
    };
  }

  return { kind: 'continue', websiteIntent };
}

export function buildSdrSystemPrompt(language: string): string {
  const profile = WIDGET_COPILOT_PROMPT_PROFILES.sdr;
  return [
    profile.intro,
    '',
    `All user-visible strings MUST be in locale: ${language}.`,
    'INPUT: user request + allowlisted copy fields + optional source page text.',
    'OUTPUT: JSON with set-only ops + message + optional conversion CTA.',
    '',
    'If SOURCE_PAGE_TEXT is present, it is extracted from exactly one public web page (no crawling). Use it only to inform copy edits.',
    '',
    'WHAT YOU MAY DO (ONLY):',
    '1) Rewrite existing FAQ questions/answers using SET ops on allowlisted copy paths.',
    '2) Personalize FAQ questions/answers from one website URL (after consent) using SET ops on allowlisted copy paths.',
    '3) If the request is outside these two capabilities, return message-only plus CTA action "signup".',
    profile.objective,
    '',
    'GUARDRAILS:',
    '- Do not edit styling/layout controls.',
    profile.focus,
    '- Confirm what changed in 1–2 sentences.',
    '',
    'Output MUST be JSON, with this shape:',
    '{ "ops"?: WidgetOp[], "message": string, "cta"?: { "text": string, "action": "signup"|"upgrade"|"learn-more", "url"?: string } }',
    '',
    'WidgetOp:',
    '{ op:"set", path:string, value:any }',
    '',
    'Do NOT wrap JSON in markdown fences.',
    'Do NOT include any surrounding text.',
  ].join('\n');
}

export async function buildSdrPromptContext(args: {
  env: Env;
  widgetType: string;
  currentConfig: Record<string, unknown>;
  prompt: string;
  conversationLanguage: string;
  sourcePage: SdrSourcePage | null;
  translate: (lang: string, key: string) => string;
}): Promise<SdrPromptContext> {
  const allowlist = await loadSdrAllowlist(args.env, args.widgetType);
  if (!allowlist || !allowlist.entries.length) {
    return {
      kind: 'reply',
      message: args.translate(args.conversationLanguage, 'missingAllowlist'),
      usageModel: 'missing_allowlist',
      intent: 'clarify',
    };
  }

  const allowlistedValues = collectAllowlistedValues(args.currentConfig, allowlist.entries).slice(0, 20);
  const userPrompt = [
    `Widget type: ${args.widgetType}`,
    '',
    `User request: ${args.prompt}`,
    ...(args.sourcePage
      ? [
          '',
          `SOURCE_PAGE_URL: ${args.sourcePage.url}`,
          ...(args.sourcePage.title ? [`SOURCE_PAGE_TITLE: ${args.sourcePage.title}`] : []),
          'SOURCE_PAGE_TEXT:',
          args.sourcePage.text,
        ]
      : []),
    '',
    'Allowlisted copy fields (path -> current value):',
    allowlistedValues
      .map((entry) => {
        const role = entry.role ? ` (${entry.role})` : '';
        return `- ${entry.path}${role}: ${entry.value}`;
      })
      .join('\n'),
  ].join('\n');

  return {
    kind: 'continue',
    context: {
      allowlistEntries: allowlist.entries,
      allowlistSource: allowlist.source,
      systemPrompt: buildSdrSystemPrompt(args.conversationLanguage),
      userPrompt,
    },
  };
}

export async function resolveSdrWebsiteSource(args: {
  prompt: string;
  conversationLanguage: string;
  timeoutMs: number;
  session: SdrSessionLike;
  translate: (lang: string, key: string) => string;
  isYesNo: (prompt: string, language: string) => 'yes' | 'no' | null;
}): Promise<SdrWebsiteSourceResult> {
  let consentedUrl: URL | null = null;
  const prompt = args.prompt;
  const lang = args.conversationLanguage;
  const session = args.session;

  if (session.pendingConsent?.kind === 'website') {
    const decision = args.isYesNo(prompt, lang);
    if (decision === 'yes') {
      consentedUrl = normalizeUrl(session.pendingConsent.url);
      session.pendingConsent = undefined;
    } else if (decision === 'no') {
      session.pendingConsent = undefined;
      const message = args.translate(lang, 'askBusinessBasics');
      session.lastActiveAtMs = Date.now();
      session.turns = [
        ...session.turns,
        { role: 'user' as const, content: prompt },
        { role: 'assistant' as const, content: message },
      ].slice(-10);
      return { kind: 'reply', message, usageModel: 'consent_declined' };
    } else {
      const message = args.translate(lang, 'yesNo');
      session.lastActiveAtMs = Date.now();
      session.turns = [
        ...session.turns,
        { role: 'user' as const, content: prompt },
        { role: 'assistant' as const, content: message },
      ].slice(-10);
      return { kind: 'reply', message, usageModel: 'consent_ambiguous' };
    }
  }

  const candidates = extractUrlCandidates(prompt)
    .map(normalizeUrl)
    .filter((u): u is URL => Boolean(u));

  const unique = Array.from(new Map(candidates.map((u) => [u.toString(), u])).values());
  if (!consentedUrl && unique.length > 1) {
    const message = `${args.translate(lang, 'askSingleUrl')}\n\n- ${unique.map((u) => u.toString()).join('\n- ')}`;
    session.lastActiveAtMs = Date.now();
    session.turns = [
      ...session.turns,
      { role: 'user' as const, content: prompt },
      { role: 'assistant' as const, content: message },
    ].slice(-10);
    return { kind: 'reply', message, usageModel: 'url_parser' };
  }

  const url = consentedUrl ?? unique[0] ?? null;
  if (!url) {
    const message = args.translate(lang, 'askWebsiteUrl');
    session.lastActiveAtMs = Date.now();
    session.turns = [
      ...session.turns,
      { role: 'user' as const, content: prompt },
      { role: 'assistant' as const, content: message },
    ].slice(-10);
    return { kind: 'reply', message, usageModel: 'sdr_ask_website_url' };
  }

  const blocked = isBlockedFetchUrl(url);
  if (blocked) {
    const message = `${args.translate(lang, 'blockedUrl')} (${blocked})`;
    session.lastActiveAtMs = Date.now();
    session.turns = [
      ...session.turns,
      { role: 'user' as const, content: prompt },
      { role: 'assistant' as const, content: message },
    ].slice(-10);
    return { kind: 'reply', message, usageModel: 'url_guard' };
  }

  if (!consentedUrl) {
    session.pendingConsent = { kind: 'website', url: url.toString(), askedAtMs: Date.now() };
    const message = args.translate(lang, 'askConsentWebsiteRead');
    session.lastActiveAtMs = Date.now();
    session.turns = [
      ...session.turns,
      { role: 'user' as const, content: prompt },
      { role: 'assistant' as const, content: message },
    ].slice(-10);
    return { kind: 'reply', message, usageModel: 'consent_request' };
  }

  const fetchRes = await fetchSinglePageText({ url, timeoutMs: Math.min(12_000, Math.max(1_500, args.timeoutMs - 1_000)) });
  if (!fetchRes.ok) {
    const message =
      `${args.translate(lang, 'fetchFailed')} ${url.toString()}` +
      (fetchRes.status ? ` (HTTP ${fetchRes.status})` : '');
    session.lastActiveAtMs = Date.now();
    session.turns = [
      ...session.turns,
      { role: 'user' as const, content: prompt },
      { role: 'assistant' as const, content: message },
    ].slice(-10);
    return { kind: 'reply', message, usageModel: 'single_page_fetch' };
  }

  const excerptLimit = 10_000;
  const sourcePage: SdrSourcePage = {
    url: fetchRes.finalUrl,
    ...(fetchRes.title ? { title: fetchRes.title } : {}),
    text: fetchRes.text.length > excerptLimit ? `${fetchRes.text.slice(0, excerptLimit)}\n\n[truncated]` : fetchRes.text,
    truncated: fetchRes.truncated || fetchRes.text.length > excerptLimit,
    status: fetchRes.status,
    contentType: fetchRes.contentType,
  };

  session.source = { url: fetchRes.finalUrl, fetchedAtMs: Date.now(), ...(fetchRes.title ? { title: fetchRes.title } : {}) };
  return { kind: 'continue', sourcePage };
}

export function validateSdrOpsAgainstAllowlist(args: {
  ops: WidgetOpLite[];
  allowlist: SdrAllowlistEntry[];
}): { ok: true } | { ok: false; issues: Array<{ path: string; message: string }> } {
  const issues: Array<{ path: string; message: string }> = [];
  for (const op of args.ops) {
    if (op.op !== 'set') {
      issues.push({ path: op.path, message: 'only set ops are allowed' });
      continue;
    }
    const normalized = normalizeOpPath(op.path);
    if (!normalized) {
      issues.push({ path: op.path, message: 'invalid path' });
      continue;
    }
    const allowed = args.allowlist.some((entry) => pathMatchesAllowlist(normalized, entry.path));
    if (!allowed) {
      issues.push({ path: normalized, message: 'path not allowlisted' });
      continue;
    }
    if (typeof op.value !== 'string') {
      issues.push({ path: normalized, message: 'value must be a string' });
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true };
}
