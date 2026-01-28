import type { AIGrant, Env, Usage } from '../types';
import { HttpError, asString, isRecord } from '../http';
import { getGrantMaxTokens, getGrantTimeoutMs } from '../grants';
import { callChatCompletion } from '../ai/chat';
import { extractUrlCandidates, fetchSinglePageText, isBlockedFetchUrl, normalizeUrl } from '../utils/webFetch';
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
  meta?: {
    intent?: 'edit' | 'explain' | 'clarify';
    outcome?: 'ops_applied' | 'no_ops' | 'invalid_ops';
    promptVersion?: string;
    policyVersion?: string;
    dictionaryHash?: string;
    language?: string;
    languageConfidence?: number;
    allowlistSource?: 'sdr_allowlist' | 'localization_fallback';
  };
};

type CopilotSession = {
  sessionId: string;
  createdAtMs: number;
  lastActiveAtMs: number;
  successfulEdits: number;
  turns: Array<{ role: 'user' | 'assistant'; content: string }>;
  source?: { url: string; fetchedAtMs: number; title?: string };
  conversationLanguage?: string;
  languageConfidence?: number;
  pendingConsent?: { kind: 'website'; url: string; askedAtMs: number };
  pendingPolicy?:
    | {
        kind: 'scope';
        createdAtMs: number;
        ops: WidgetOp[];
        scopes: Array<'stage' | 'pod' | 'content'>;
      }
    | {
        kind: 'group';
        createdAtMs: number;
        ops: WidgetOp[];
        groups: Array<{ key: string; label: string }>;
      };
};

type GlobalDictionary = typeof globalDictionary;

const PROMPT_VERSION = 'sdr.widget.copilot.v1@2025-12-30';
const POLICY_VERSION = 'light_edits.v1';

function fnv1aHashHex(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const DICTIONARY_HASH = fnv1aHashHex(JSON.stringify(globalDictionary));

type SdrAllowlistEntry = { path: string; type: 'string' | 'richtext'; role?: string };
type SdrAllowlistFile = { v: 1; paths: SdrAllowlistEntry[] };

const STOPWORD_LANGS = ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl'] as const;
const STOPWORDS: Record<(typeof STOPWORD_LANGS)[number], string[]> = {
  en: ['the', 'and', 'is', 'are', 'for', 'with', 'your', 'you', 'we', 'our'],
  es: ['el', 'la', 'y', 'es', 'para', 'con', 'tu', 'sus', 'nuestro', 'nosotros'],
  fr: ['le', 'la', 'et', 'est', 'pour', 'avec', 'votre', 'vos', 'notre', 'nous'],
  de: ['der', 'die', 'und', 'ist', 'für', 'mit', 'dein', 'ihre', 'unser', 'wir'],
  it: ['il', 'la', 'e', 'è', 'per', 'con', 'tuo', 'vostro', 'nostro', 'noi'],
  pt: ['o', 'a', 'e', 'é', 'para', 'com', 'seu', 'sua', 'nosso', 'nós'],
  nl: ['de', 'het', 'en', 'is', 'voor', 'met', 'jouw', 'uw', 'ons', 'wij'],
};

const LANGUAGE_NAME_MAP: Record<string, string> = {
  english: 'en',
  german: 'de',
  deutsch: 'de',
  french: 'fr',
  français: 'fr',
  spanish: 'es',
  español: 'es',
  italian: 'it',
  italiano: 'it',
  portuguese: 'pt',
  português: 'pt',
  dutch: 'nl',
  nederlands: 'nl',
  russian: 'ru',
  русский: 'ru',
  arabic: 'ar',
  العربية: 'ar',
  japanese: 'ja',
  日本語: 'ja',
  korean: 'ko',
  한국어: 'ko',
  chinese: 'zh',
  中文: 'zh',
  hindi: 'hi',
  हिन्दी: 'hi',
};

const LANGUAGE_CODE_SET = new Set(['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ru', 'ar', 'ja', 'ko', 'zh', 'he', 'hi']);

const CONSENT_LEXICON: Record<string, { yes: string[]; no: string[] }> = {
  en: { yes: ['yes', 'yep', 'yeah', 'ok', 'okay', 'sure'], no: ['no', 'nope', 'nah'] },
  es: { yes: ['sí', 'si', 'claro', 'vale'], no: ['no'] },
  fr: { yes: ['oui', 'daccord', "d'accord"], no: ['non'] },
  de: { yes: ['ja', 'klar'], no: ['nein'] },
  it: { yes: ['sì', 'si', 'va bene'], no: ['no'] },
  pt: { yes: ['sim', 'claro'], no: ['não', 'nao'] },
  nl: { yes: ['ja', 'oké', 'oke'], no: ['nee'] },
  ru: { yes: ['да', 'ок', 'хорошо'], no: ['нет'] },
  ar: { yes: ['نعم', 'موافق'], no: ['لا'] },
  hi: { yes: ['हाँ', 'ठीक'], no: ['नहीं'] },
  ja: { yes: ['はい', 'お願いします', 'ok', 'okay'], no: ['いいえ', 'だめ'] },
  ko: { yes: ['네', '예', '좋아요'], no: ['아니요'] },
  zh: { yes: ['是', '好', '可以'], no: ['不', '不要'] },
};

const UI_STRINGS: Record<
  string,
  Record<
    string,
    string
  >
> = {
  en: {
    askWebsiteUrl: 'Share your website URL so I can personalize the widget.',
    askConsentWebsiteRead: 'Can I read one public page from that URL to personalize your widget? (Yes/No)',
    askBusinessBasics: 'Tell me your business and audience (1 sentence each).',
    askSingleUrl: 'I found multiple URLs. Which single page should I use?',
    blockedUrl: 'I can only read public https pages. That URL is not allowed.',
    fetchFailed: 'I tried to read that page but couldn’t. Please share a working URL or paste the text.',
    cloudflareError:
      'That looks like a Cloudflare error page. Please share a working URL or paste the page text.',
    missingAllowlist: 'This widget is not SDR-enabled yet. Try another widget or continue manually.',
    invalidOps:
      'I tried to apply an edit, but it didn’t match the editable fields. Please ask for a specific copy change.',
    yesNo: 'Yes or No?',
  },
  es: {
    askWebsiteUrl: 'Comparte tu URL para personalizar el widget.',
    askConsentWebsiteRead: '¿Puedo leer una página pública para personalizar tu widget? (Sí/No)',
    askBusinessBasics: 'Cuéntame tu negocio y tu audiencia (1 frase cada uno).',
    askSingleUrl: 'Encontré varias URLs. ¿Cuál página debo usar?',
    blockedUrl: 'Solo puedo leer páginas públicas https. Esa URL no está permitida.',
    fetchFailed: 'Intenté leer esa página, pero falló. Comparte una URL válida o pega el texto.',
    cloudflareError:
      'Eso parece una página de error de Cloudflare. Comparte una URL válida o pega el texto.',
    missingAllowlist: 'Este widget aún no está habilitado para SDR.',
    invalidOps:
      'Intenté aplicar un cambio, pero no coincide con los campos editables. Pide un cambio de texto específico.',
    yesNo: '¿Sí o No?',
  },
  ja: {
    askWebsiteUrl: 'サイトURLを共有してください。内容を合わせて調整します。',
    askConsentWebsiteRead: 'そのURLの公開ページを1ページ読んでもよろしいですか？（はい/いいえ）',
    askBusinessBasics: '事業内容と対象顧客を1文ずつ教えてください。',
    askSingleUrl: '複数のURLが見つかりました。どのページを使いますか？',
    blockedUrl: '公開HTTPSページのみ読み取れます。そのURLは許可されていません。',
    fetchFailed: '読み取りに失敗しました。別のURLか本文を貼ってください。',
    cloudflareError: 'Cloudflareのエラーページのようです。別のURLか本文を貼ってください。',
    missingAllowlist: 'このウィジェットはまだSDRに対応していません。',
    invalidOps: '編集対象に一致しませんでした。具体的なコピー変更を指定してください。',
    yesNo: 'はい / いいえ',
  },
  ar: {
    askWebsiteUrl: 'شارك رابط موقعك لأقوم بتخصيص الودجت.',
    askConsentWebsiteRead: 'هل تسمح لي بقراءة صفحة عامة واحدة للتخصيص؟ (نعم/لا)',
    askBusinessBasics: 'عرّفني على عملك وجمهورك بجملة لكلٍ منهما.',
    askSingleUrl: 'وجدت عدة روابط. أي صفحة يجب أن أستخدم؟',
    blockedUrl: 'يمكنني قراءة صفحات https العامة فقط. هذا الرابط غير مسموح.',
    fetchFailed: 'لم أتمكن من قراءة الصفحة. أرسل رابطًا صالحًا أو الصق النص.',
    cloudflareError: 'يبدو أنها صفحة خطأ من Cloudflare. أرسل رابطًا صالحًا أو الصق النص.',
    missingAllowlist: 'هذا الودجت غير مفعّل لـ SDR بعد.',
    invalidOps: 'حاولت التعديل لكن الحقول غير قابلة للتطابق. اطلب تغيير نص محدد.',
    yesNo: 'نعم أم لا؟',
  },
  ru: {
    askWebsiteUrl: 'Пришлите URL сайта, чтобы я персонализировал виджет.',
    askConsentWebsiteRead: 'Можно прочитать одну публичную страницу для персонализации? (Да/Нет)',
    askBusinessBasics: 'Опишите бизнес и аудиторию (по одному предложению).',
    askSingleUrl: 'Я нашёл несколько URL. Какую страницу использовать?',
    blockedUrl: 'Я могу читать только публичные https-страницы. Этот URL не разрешён.',
    fetchFailed: 'Не удалось прочитать страницу. Пришлите рабочий URL или вставьте текст.',
    cloudflareError: 'Похоже на страницу ошибки Cloudflare. Пришлите рабочий URL или вставьте текст.',
    missingAllowlist: 'Этот виджет пока не поддерживает SDR.',
    invalidOps: 'Не удалось применить изменения. Попросите конкретное изменение текста.',
    yesNo: 'Да или нет?',
  },
};

function normalizeLocaleToken(raw: string): string {
  return String(raw || '').trim().toLowerCase().replace(/_/g, '-');
}

function hasScriptRegex(input: string, re: RegExp): boolean {
  return re.test(input);
}

function detectScriptLanguage(prompt: string): string | null {
  if (hasScriptRegex(prompt, /[\u0600-\u06FF]/)) return 'ar';
  if (hasScriptRegex(prompt, /[\u0400-\u04FF]/)) return 'ru';
  if (hasScriptRegex(prompt, /[\u0590-\u05FF]/)) return 'he';
  if (hasScriptRegex(prompt, /[\u0900-\u097F]/)) return 'hi';
  if (hasScriptRegex(prompt, /[\uAC00-\uD7AF]/)) return 'ko';
  if (hasScriptRegex(prompt, /[\u3040-\u30FF]/)) return 'ja';
  if (hasScriptRegex(prompt, /[\u4E00-\u9FFF]/)) return 'zh';
  return null;
}

function detectExplicitLanguage(prompt: string): string | null {
  const s = (prompt || '').toLowerCase();
  const directiveMatch = s.match(/(?:^|\s)\/?(?:lang|language)\s*[:=]\s*([a-z\u00C0-\u017F-]+)/);
  if (directiveMatch?.[1]) {
    const mapped = mapLanguageToken(directiveMatch[1]);
    if (mapped) return mapped;
  }
  const switchMatch = s.match(/\b(?:switch|change)\s+to\s+([a-z\u00C0-\u017F-]+)\b/);
  if (switchMatch?.[1]) {
    const mapped = mapLanguageToken(switchMatch[1]);
    if (mapped) return mapped;
  }
  const match = s.match(/\b(reply|respond|answer)\s+in\s+([a-z\u00C0-\u017F-]+)\b/);
  if (match && match[2]) {
    const mapped = mapLanguageToken(match[2]);
    if (mapped) return mapped;
  }
  const override = Object.keys(LANGUAGE_NAME_MAP).find((key) => s.includes(key));
  return override ? LANGUAGE_NAME_MAP[override] : null;
}

function mapLanguageToken(raw: string): string | null {
  const normalized = normalizeLocaleToken(raw);
  const mapped = LANGUAGE_NAME_MAP[normalized];
  if (mapped) return mapped;
  if (LANGUAGE_CODE_SET.has(normalized)) return normalized;
  const base = normalized.split('-')[0];
  return LANGUAGE_CODE_SET.has(base) ? base : null;
}

function scoreStopwords(prompt: string): { lang: string; score: number } | null {
  const tokens = normalizeToken(prompt).split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  let best: { lang: string; score: number } | null = null;
  for (const lang of STOPWORD_LANGS) {
    const set = new Set(STOPWORDS[lang]);
    const score = tokens.reduce((acc, t) => acc + (set.has(t) ? 1 : 0), 0);
    if (!best || score > best.score) best = { lang, score };
  }
  return best;
}

function resolveConversationLanguage(session: CopilotSession, prompt: string): { language: string; confidence: number } {
  const explicit = detectExplicitLanguage(prompt);
  if (explicit) return { language: explicit, confidence: 0.99 };

  const scriptLang = detectScriptLanguage(prompt);
  if (scriptLang) return { language: scriptLang, confidence: 0.95 };

  const scored = scoreStopwords(prompt);
  if (scored && scored.score >= 2) {
    return { language: scored.lang, confidence: 0.85 };
  }

  const sticky = session.conversationLanguage ? normalizeLocaleToken(session.conversationLanguage) : 'en';
  return { language: sticky || 'en', confidence: session.languageConfidence ?? 0.5 };
}

function t(lang: string, key: keyof (typeof UI_STRINGS)['en']): string {
  const normalized = normalizeLocaleToken(lang);
  const table = UI_STRINGS[normalized] ?? UI_STRINGS.en;
  return table[key] ?? UI_STRINGS.en[key];
}

function isYesNo(prompt: string, lang: string): 'yes' | 'no' | null {
  const normalized = normalizeLocaleToken(lang);
  const lex = CONSENT_LEXICON[normalized] ?? CONSENT_LEXICON.en;
  const token = normalizeToken(prompt);
  if (lex.yes.some((y) => token.includes(normalizeToken(y)))) return 'yes';
  if (lex.no.some((n) => token.includes(normalizeToken(n)))) return 'no';
  return null;
}

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
    value: (value as any)[head],
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
      const entries = file.paths
        .filter((p) => p && typeof p.path === 'string')
        .map((p) => ({
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
  const entries = file.paths
    .filter((p) => p && typeof p.path === 'string')
    .map((p) => ({
      path: String(p.path || '').trim(),
      type: p?.type === 'richtext' ? 'richtext' : 'string',
    }))
    .filter((p) => p.path && !/branding|legal|disclaimer|powered|copyright/i.test(p.path));
  return entries.length ? { entries, source: 'localization_fallback' } : null;
}

function validateOpsAgainstAllowlist(args: {
  ops: WidgetOp[];
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
    if (typeof (op as any).value !== 'string') {
      issues.push({ path: normalized, message: 'value must be a string' });
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true };
}

function baseMeta(
  intent: NonNullable<WidgetCopilotResult['meta']>['intent'],
  outcome: NonNullable<WidgetCopilotResult['meta']>['outcome'],
  extras?: Pick<NonNullable<WidgetCopilotResult['meta']>, 'language' | 'languageConfidence' | 'allowlistSource'>,
): NonNullable<WidgetCopilotResult['meta']> {
  return {
    intent,
    outcome,
    promptVersion: PROMPT_VERSION,
    policyVersion: POLICY_VERSION,
    dictionaryHash: DICTIONARY_HASH,
    ...(extras ?? {}),
  };
}

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
    // Fail soft: if the model returned plain text, treat it as an assistant message and
    // apply no ops. This avoids surfacing transient "invalid JSON" as a 502 in the UI.
    const fallback = cleaned.trim();
    const tooLong = fallback.length > 1200;
    const text = (tooLong ? `${fallback.slice(0, 1200)}\n\n[truncated]` : fallback).trim();
    return {
      message:
        text ||
        'I had trouble generating a structured edit. Please try again, or ask for one specific change (e.g. “translate the FAQs to French”).',
      _parseFallback: true,
    };
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

function looksLikeExplainIntent(prompt: string): boolean {
  const s = (prompt || '').trim().toLowerCase();
  if (!s) return false;

  const hasEditVerb =
    /\b(change|make|set|update|adjust|edit|add|remove|delete|rewrite|rephrase|translate|localize|style|apply)\b/i.test(s);
  if (hasEditVerb) return false;

  if (s.includes('?')) return true;

  if (/^(what|why|how|when|where|which|who)\b/i.test(s)) return true;
  if (/^(can|could|should|would|do|does|is|are|will)\b/i.test(s)) return true;
  if (/\b(help|explain|meaning|what does)\b/i.test(s)) return true;

  return false;
}

function languageClarifyMessage(lang: string): string {
  const normalized = normalizeLocaleToken(lang);
  if (normalized.startsWith('it')) {
    return 'Certo, posso parlare in italiano. Condividi il sito web così posso personalizzare il widget, oppure dimmi in 1–2 frasi che attività hai e a chi ti rivolgi.';
  }
  if (normalized.startsWith('fr')) {
    return "D’accord, je peux répondre en français. Partagez votre site pour que je personnalise le widget, ou décrivez votre activité et votre audience en 1–2 phrases.";
  }
  if (normalized.startsWith('de')) {
    return 'Alles klar, ich kann auf Deutsch antworten. Teile deine Website, damit ich das Widget personalisieren kann, oder beschreibe dein Angebot und deine Zielgruppe in 1–2 Sätzen.';
  }
  if (normalized.startsWith('es')) {
    return 'Perfecto, puedo responder en español. Comparte tu web para personalizar el widget o cuéntame tu negocio y tu audiencia en 1–2 frases.';
  }
  if (normalized.startsWith('pt')) {
    return 'Claro, posso responder em português. Compartilhe seu site para eu personalizar o widget ou descreva seu negócio e público em 1–2 frases.';
  }
  if (normalized.startsWith('nl')) {
    return 'Prima, ik kan in het Nederlands antwoorden. Deel je website zodat ik de widget kan personaliseren, of beschrijf je bedrijf en doelgroep in 1–2 zinnen.';
  }
  if (normalized.startsWith('ru')) {
    return 'Хорошо, могу отвечать по‑русски. Пришлите сайт, чтобы я персонализировал виджет, или опишите бизнес и аудиторию в 1–2 предложениях.';
  }
  if (normalized.startsWith('ar')) {
    return 'حسنًا، يمكنني الرد بالعربية. شارك موقعك لأخصص الودجت، أو صف عملك وجمهورك بجملة أو جملتين.';
  }
  if (normalized.startsWith('ja')) {
    return '日本語でお答えできます。サイトURLを共有してください。難しければ、事業内容と対象顧客を1〜2文で教えてください。';
  }
  if (normalized.startsWith('ko')) {
    return '네, 한국어로 답할 수 있어요. 웹사이트를 공유해 주시면 위젯을 개인화할게요. 어렵다면 사업과 대상 고객을 1–2문장으로 알려주세요.';
  }
  if (normalized.startsWith('zh')) {
    return '好的，我可以用中文回复。请分享你的网站以便我个性化小组件，或用1–2句话介绍你的业务和受众。';
  }
  if (normalized.startsWith('hi')) {
    return 'ठीक है, मैं हिंदी में जवाब दे सकता हूँ। कृपया अपनी वेबसाइट साझा करें ताकि मैं विजेट को पर्सनलाइज़ कर सकूँ, या अपने व्यवसाय और दर्शकों के बारे में 1–2 वाक्य बताएं।';
  }
  return 'Got it — I can reply in that language. Share your website so I can personalize the widget, or describe your business and audience in 1–2 sentences.';
}

function looksLikeLanguageOnlyIntent(prompt: string): { language: string } | null {
  const explicit = detectExplicitLanguage(prompt);
  if (!explicit) return null;

  const s = (prompt || '').trim().toLowerCase();
  if (!s) return null;

  // If the user is explicitly asking to translate/rewrite content, let the model handle it.
  if (/\b(translate|traduci|tradurre|rewrite|rephrase|localize|translation)\b/i.test(s)) return null;

  const wordCount = s.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 6) return { language: explicit };

  // Otherwise, treat explicit language mentions as language-only unless other edit verbs appear.
  if (/\b(edit|change|update|modify|adjust|add|remove|delete)\b/i.test(s)) return null;
  return { language: explicit };
}

function normalizeToken(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function bestControlMatch(prompt: string, controls: ControlSummary[]): ControlSummary | null {
  const p = normalizeToken(prompt);
  if (!p) return null;
  const pTokens = new Set(p.split(' ').filter(Boolean));
  if (pTokens.size === 0) return null;

  let best: { score: number; control: ControlSummary } | null = null;
  for (const c of controls) {
    const label = typeof c.label === 'string' ? c.label : '';
    const path = typeof c.path === 'string' ? c.path : '';
    const groupLabel = typeof c.groupLabel === 'string' ? c.groupLabel : '';
    const hay = normalizeToken([label, path, groupLabel].filter(Boolean).join(' '));
    if (!hay) continue;
    const hTokens = hay.split(' ').filter(Boolean);
    if (hTokens.length === 0) continue;

    let score = 0;
    for (const t of hTokens) {
      if (pTokens.has(t)) score += 1;
    }
    if (label && p.includes(normalizeToken(label))) score += 3;
    if (path && p.includes(normalizeToken(path))) score += 2;
    if (score <= 0) continue;

    if (!best || score > best.score) best = { score, control: c };
  }

  if (!best || best.score < 2) return null;
  return best.control;
}

function explainMessage(input: WidgetCopilotInput): string {
  const s = normalizeToken(input.prompt);

  if (/\b(what can you do|what can i do|how do i use|how does this work)\b/i.test(input.prompt)) {
    return (
      'I can help you customize this widget by changing the settings that are available in the editable controls. ' +
      'Ask for one small change at a time (title, colors, layout, fonts, or content like questions/answers).'
    );
  }

  if (s.includes('accordion')) {
    return (
      'An accordion shows each FAQ as a collapsible item. Usually you click a question to expand its answer. ' +
      'If you enable multi-open, multiple answers can stay expanded at the same time.'
    );
  }

  if (/\bmulti[-\s]*open\b/i.test(input.prompt) || s.includes('multi open') || s.includes('multiopen')) {
    return '“Multi-open” controls whether multiple FAQ items can be expanded at once (instead of only one at a time).';
  }

  if (/\bexpand[-\s]*all\b/i.test(input.prompt) || s.includes('expand all') || s.includes('expandall')) {
    return '“Expand all” controls whether all FAQ items start expanded (all answers visible).';
  }

  if (/\bexpand[-\s]*first\b/i.test(input.prompt) || s.includes('expand first') || s.includes('expandfirst')) {
    return '“Expand first” controls whether the first FAQ item starts expanded when the widget loads.';
  }

  const matched = bestControlMatch(input.prompt, input.controls);
  if (matched) {
    const label = matched.label?.trim() || matched.path;
    const where = matched.groupLabel?.trim() || matched.panelId || 'the editor';
    const kind = matched.kind ? ` (${matched.kind})` : '';
    if (matched.kind === 'enum' && Array.isArray(matched.enumValues) && matched.enumValues.length > 0) {
      const values = matched.enumValues.slice(0, 12).join(', ');
      return `“${label}”${kind} is an editable setting in ${where}. Allowed values include: ${values}. Tell me what you want it set to and I’ll change it.`;
    }
    if (matched.kind === 'boolean') {
      return `“${label}”${kind} is a toggle in ${where}. Tell me if you want it on or off and I’ll update it.`;
    }
    return `“${label}”${kind} is an editable setting in ${where}. Tell me what you want and I’ll change it.`;
  }

  return (
    "I can explain specific settings if you mention them by name (like “multi-open”, “expand all”, or “show title”). " +
    'Or tell me what you want to change and I’ll apply it.'
  );
}

function bestControlForPath(path: string, controls: ControlSummary[]): ControlSummary | null {
  const target = (path || '').trim();
  if (!target) return null;

  let best: { len: number; control: ControlSummary } | null = null;

  for (const c of controls) {
    const cp = typeof c.path === 'string' ? c.path.trim() : '';
    if (!cp) continue;
    if (cp === target) return c;
    if (target.startsWith(cp + '.')) {
      const len = cp.length;
      if (!best || len > best.len) best = { len, control: c };
      continue;
    }
    if (cp.startsWith(target + '.')) {
      const len = target.length;
      if (!best || len > best.len) best = { len, control: c };
    }
  }

  return best?.control ?? null;
}

function groupForPath(path: string, controls: ControlSummary[]): { key: string; label: string } | null {
  const control = bestControlForPath(path, controls);
  if (!control) return null;
  const key = (control.groupId || control.groupLabel || control.panelId || '').trim();
  if (!key) return null;
  const label = (control.groupLabel || control.panelId || key).trim();
  return { key, label };
}

function pathLooksSensitive(path: string): boolean {
  return /\b(url|href|domain|script|html|embed)\b/i.test(path);
}

type LightEditsDecision =
  | { ok: true }
  | {
      ok: false;
      message: string;
      pendingPolicy?: CopilotSession['pendingPolicy'];
    };

type OpsValidationIssue = { opIndex: number; path: string; message: string };

type OpsValidationResult = { ok: true } | { ok: false; issues: OpsValidationIssue[] };

function isNumericString(value: string): boolean {
  return /^-?\d+(?:\.\d+)?$/.test(value.trim());
}

function validateOpsAgainstControls(args: { ops: WidgetOp[]; controls: ControlSummary[] }): OpsValidationResult {
  const issues: OpsValidationIssue[] = [];

  for (let opIndex = 0; opIndex < args.ops.length; opIndex += 1) {
    const op = args.ops[opIndex]!;
    const path = op.path;
    const control = bestControlForPath(path, args.controls);
    if (!control) {
      issues.push({ opIndex, path, message: 'Unknown path (not in editable controls)' });
      continue;
    }
    if (!control.kind) {
      issues.push({ opIndex, path, message: 'Control kind is unknown' });
      continue;
    }

    if (op.op === 'insert' || op.op === 'remove' || op.op === 'move') {
      if (control.kind !== 'array') {
        issues.push({ opIndex, path, message: 'Target must be an array control' });
        continue;
      }
      if (op.op === 'insert' && control.itemIdPath) {
        const item = op.value as any;
        const id = item && typeof item === 'object' && !Array.isArray(item) ? item[control.itemIdPath] : null;
        if (typeof id !== 'string' || !id.trim()) {
          issues.push({ opIndex, path, message: `Inserted item must include a non-empty "${control.itemIdPath}"` });
        }
      }
      continue;
    }

    // set op
    if (op.op === 'set') {
      if (control.kind === 'enum' && Array.isArray(control.enumValues) && control.enumValues.length > 0) {
        if (typeof op.value !== 'string' || !control.enumValues.includes(op.value)) {
          issues.push({ opIndex, path, message: 'Value must be one of the allowed enum values' });
        }
        continue;
      }

      if (control.kind === 'number' || typeof control.min === 'number' || typeof control.max === 'number') {
        let n: number | null = null;
        if (typeof op.value === 'number' && Number.isFinite(op.value)) n = op.value;
        if (typeof op.value === 'string' && isNumericString(op.value)) n = Number(op.value);
        if (n == null || !Number.isFinite(n)) {
          issues.push({ opIndex, path, message: 'Value must be a number' });
          continue;
        }
        if (typeof control.min === 'number' && n < control.min) {
          issues.push({ opIndex, path, message: `Value must be >= ${control.min}` });
        }
        if (typeof control.max === 'number' && n > control.max) {
          issues.push({ opIndex, path, message: `Value must be <= ${control.max}` });
        }
        continue;
      }

      if (control.kind === 'boolean') {
        const ok =
          typeof op.value === 'boolean' ||
          (typeof op.value === 'string' && (op.value.toLowerCase() === 'true' || op.value.toLowerCase() === 'false'));
        if (!ok) issues.push({ opIndex, path, message: 'Value must be true or false' });
        continue;
      }
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true };
}

function evaluateLightEditsPolicy(args: { ops: WidgetOp[]; controls: ControlSummary[] }): LightEditsDecision {
  const opsCount = args.ops.length;
  const uniquePaths = new Set(args.ops.map((o) => o.path));
  const scopes = new Set(args.ops.map((o) => inferScopeFromPath(o.path)));
  const groups = new Map<string, { key: string; label: string }>();
  for (const op of args.ops) {
    const g = groupForPath(op.path, args.controls);
    if (g) groups.set(g.key, g);
  }

  const hasSensitive = args.ops.some((o) => pathLooksSensitive(o.path));
  const isContentOnly = scopes.size === 1 && scopes.has('content');

  // Content personalization needs to update multiple copy fields at once.
  // TEMP: 5x limits during dev; tighten before GA.
  const devMultiplier = 5;
  const maxOps = (isContentOnly ? 30 : 6) * devMultiplier;
  const maxUniquePathsTouched = (isContentOnly ? 20 : 4) * devMultiplier;
  const maxScopesTouched = 1;
  const maxGroupsTouched = (isContentOnly ? 3 : 1) * devMultiplier;

  if (opsCount > maxOps) {
    return {
      ok: false,
      message: `That’s a lot to change at once (${opsCount} edits). Please ask for one smaller change (e.g. “change the title” or “make the pod background white”).`,
    };
  }

  if (uniquePaths.size > maxUniquePathsTouched) {
    return {
      ok: false,
      message: `That would touch many settings at once (${uniquePaths.size} paths). Please ask for one smaller change first.`,
    };
  }

  if (scopes.size > maxScopesTouched) {
    const scopeList = Array.from(scopes);
    const labels = scopeList.map((s) => s).join(' + ');
    const picks = scopeList.filter((s) => s === 'stage' || s === 'pod' || s === 'content');
    const pickText = picks.join(' or ');
    const tokenText = picks.join(' | ');
    const msg =
      `That would change multiple areas (${labels}). Which should I change first: ${pickText}?` +
      `\nReply with: ${tokenText}` +
      `\nTo apply across the whole widget, reply: apply across widget`;
    return {
      ok: false,
      message: msg,
      pendingPolicy: { kind: 'scope', createdAtMs: Date.now(), ops: args.ops, scopes: scopeList },
    };
  }

  if (groups.size > maxGroupsTouched) {
    const groupList = Array.from(groups.values()).slice(0, 6);
    const lines = groupList.map((g, idx) => `${idx + 1}) ${g.label}`).join('\n');
    const msg =
      `That would change multiple panels. Which panel should I start with?\n` +
      `${lines}\n` +
      `Reply with the number (1-${groupList.length}).\n` +
      `To apply across the whole widget, reply: apply across widget`;
    return {
      ok: false,
      message: msg,
      pendingPolicy: { kind: 'group', createdAtMs: Date.now(), ops: args.ops, groups: groupList },
    };
  }

  if (hasSensitive) {
    return {
      ok: false,
      message:
        'That change would modify a sensitive setting (URL/embed/script). Please confirm by replying exactly: apply across widget',
      pendingPolicy: { kind: 'scope', createdAtMs: Date.now(), ops: args.ops, scopes: Array.from(scopes) },
    };
  }

  return { ok: true };
}

function extractExactToken(prompt: string): string {
  return (prompt || '').trim().toLowerCase();
}

function selectScopeFromPrompt(prompt: string, scopes: Array<'stage' | 'pod' | 'content'>): 'stage' | 'pod' | 'content' | null {
  const token = extractExactToken(prompt);
  if (!token) return null;
  if (token === 'stage' && scopes.includes('stage')) return 'stage';
  if (token === 'pod' && scopes.includes('pod')) return 'pod';
  if (token === 'content' && scopes.includes('content')) return 'content';

  const lower = token;
  const hasStage = lower.includes('stage');
  const hasPod = lower.includes('pod');
  const hasContent = lower.includes('content');
  const count = Number(hasStage) + Number(hasPod) + Number(hasContent);
  if (count !== 1) return null;
  if (hasStage && scopes.includes('stage')) return 'stage';
  if (hasPod && scopes.includes('pod')) return 'pod';
  if (hasContent && scopes.includes('content')) return 'content';
  return null;
}

function filterOpsByScope(ops: WidgetOp[], scope: 'stage' | 'pod' | 'content'): WidgetOp[] {
  return ops.filter((o) => inferScopeFromPath(o.path) === scope);
}

function selectGroupFromPrompt(prompt: string, groups: Array<{ key: string; label: string }>): { key: string; label: string } | null {
  const token = extractExactToken(prompt);
  if (!token) return null;
  const n = Number(token);
  if (Number.isFinite(n) && Number.isInteger(n)) {
    const idx = n - 1;
    if (idx >= 0 && idx < groups.length) return groups[idx] ?? null;
  }
  const normalized = normalizeToken(prompt);
  for (const g of groups) {
    if (normalizeToken(g.label) === normalized) return g;
  }
  return null;
}

function filterOpsByGroup(ops: WidgetOp[], groupKey: string, controls: ControlSummary[]): WidgetOp[] {
  return ops.filter((o) => groupForPath(o.path, controls)?.key === groupKey);
}

function maybeClarify(dict: GlobalDictionary, input: WidgetCopilotInput): string | null {
  const prompt = input.prompt;

  // If user says "based on my website" but doesn't include a URL, don't guess or pivot to styling.
  // Ask for a single page URL (we only fetch one page, no crawling).
  if (/\b(based on|from)\b[\s\S]{0,40}\b(my )?website\b/i.test(prompt)) {
    const hasUrl = extractUrlCandidates(prompt).length > 0;
    if (!hasUrl) {
      return 'Paste a URL to a single page that contains the content you want to base the FAQs on (for example: https://example.com/faq).';
    }
  }

  // "Rewrite the questions" is ambiguous:
  // - rewrite existing Q/A text already present in currentConfig
  // - generate new FAQs based on the user's website/source page
  // Ask one tight clarification to avoid guessing or falling back to unrelated styling changes.
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

  // Overbroad requests tend to produce brittle edits (and are hard to map to controls deterministically).
  // Ask the user to pick a starting area.
  if (/\b(adjust|change|update|make)\b[\s\S]{0,30}\b(everything|all of it|the whole thing|all settings)\b/i.test(prompt)) {
    return (
      'That’s a broad request. What should I start with?\n' +
      '- Content (FAQ questions/answers)\n' +
      '- Styling (colors/fonts/layout)\n' +
      '\n' +
      'Reply “content” or “styling” and I’ll do that first.'
    );
  }

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

  const languageConcept = getConcept(dict, 'language');
  if (languageConcept && containsAny(prompt, languageConcept.synonyms)) {
    return (
      dict.clarifications.find((c) => c.conceptId === 'language')?.question ??
      'I can personalize the widget, not translate it. Share your website so I can tailor the copy, or describe your business and audience in 1–2 sentences.'
    );
  }

  const fontConcept = getConcept(dict, 'font');
  if (fontConcept && containsAny(prompt, fontConcept.synonyms)) {
    const q = dict.clarifications.find((c) => c.conceptId === 'font')?.question ?? 'Which text should I change: everything, the title, questions, or answers?';
    return q;
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

function systemPrompt(language: string): string {
  return [
    "You are Clickeen's Minibob SDR agent.",
    '',
    `All user-visible strings MUST be in locale: ${language}.`,
    'INPUT: user request + allowlisted copy fields + optional source page text.',
    'OUTPUT: JSON with set-only ops + message + optional conversion CTA.',
    '',
    'If SOURCE_PAGE_TEXT is present, it is extracted from exactly one public web page (no crawling). Use it only to inform copy edits.',
    '',
    'WHAT YOU MAY DO (ONLY):',
    '1) Edit text by returning SET ops on allowlisted copy paths.',
    '2) Ask for a website URL (then consent) or ask 1 short clarifying question needed to personalize copy.',
    '3) After a visible win, return a conversion CTA (signup/publish/upgrade).',
    '',
    'GUARDRAILS:',
    '- Never translate the widget as a goal. Personalize copy using the website or business context.',
    '- Keep edits minimal and conversion-focused.',
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

export async function executeSdrWidgetCopilot(params: { grant: AIGrant; input: unknown }, env: Env): Promise<{ result: WidgetCopilotResult; usage: Usage }> {
  const input = parseWidgetCopilotInput(params.input);
  const session = await getSession(env, input.sessionId);
  const languageInfo = resolveConversationLanguage(session, input.prompt);
  const conversationLanguage = languageInfo.language || 'en';
  if (!session.conversationLanguage || (session.conversationLanguage !== conversationLanguage && languageInfo.confidence >= 0.85)) {
    session.conversationLanguage = conversationLanguage;
    session.languageConfidence = languageInfo.confidence;
  }
  session.pendingPolicy = undefined;

  const cfError = looksLikeCloudflareErrorPage(input.prompt);
  if (cfError) {
    session.lastActiveAtMs = Date.now();
    const msg = t(conversationLanguage, 'cloudflareError') + (cfError.status ? ` (HTTP ${cfError.status})` : '');

    session.turns = [
      ...session.turns,
      { role: 'user' as const, content: input.prompt },
      { role: 'assistant' as const, content: msg },
    ].slice(-10) as CopilotSession['turns'];
    await putSession(env, session);

    return {
      result: { message: msg, meta: baseMeta('clarify', 'no_ops', { language: conversationLanguage, languageConfidence: session.languageConfidence }) },
      usage: { provider: 'local', model: 'cloudflare_error_detector', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
    };
  }

  if (session.pendingPolicy) {
    const pending = session.pendingPolicy;
    const token = extractExactToken(input.prompt);

    if (token === 'apply across widget') {
      const ops = pending.ops;
      session.pendingPolicy = undefined;
      session.lastActiveAtMs = Date.now();
      const msg = 'Ok — applying across the whole widget.';
      session.turns = [
        ...session.turns,
        { role: 'user' as const, content: input.prompt },
        { role: 'assistant' as const, content: msg },
      ].slice(-10) as CopilotSession['turns'];
      await putSession(env, session);
      return {
        result: { message: msg, ops, meta: baseMeta('edit', 'ops_applied') },
        usage: { provider: 'local', model: 'policy_confirm_all', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
      };
    }

    if (pending.kind === 'scope') {
      const chosen = selectScopeFromPrompt(input.prompt, pending.scopes);
      if (chosen) {
        const ops = filterOpsByScope(pending.ops, chosen);
        session.pendingPolicy = undefined;
        session.lastActiveAtMs = Date.now();
        const msg = `Ok — applying to ${chosen} only.`;
        session.turns = [
          ...session.turns,
          { role: 'user' as const, content: input.prompt },
          { role: 'assistant' as const, content: msg },
        ].slice(-10) as CopilotSession['turns'];
        await putSession(env, session);
        return {
          result: { message: msg, ops, meta: baseMeta('edit', 'ops_applied') },
          usage: { provider: 'local', model: 'policy_scope_pick', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
        };
      }
    }

    if (pending.kind === 'group') {
      const chosen = selectGroupFromPrompt(input.prompt, pending.groups);
      if (chosen) {
        const ops = filterOpsByGroup(pending.ops, chosen.key, input.controls);
        session.pendingPolicy = undefined;
        session.lastActiveAtMs = Date.now();
        const msg = `Ok — applying to “${chosen.label}” only.`;
        session.turns = [
          ...session.turns,
          { role: 'user' as const, content: input.prompt },
          { role: 'assistant' as const, content: msg },
        ].slice(-10) as CopilotSession['turns'];
        await putSession(env, session);
        return {
          result: { message: msg, ops, meta: baseMeta('edit', 'ops_applied') },
          usage: { provider: 'local', model: 'policy_group_pick', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
        };
      }
    }

    // If the user didn't answer with an accepted token, drop the pending policy and treat this as a new request.
    session.pendingPolicy = undefined;
  }

  const languageOnly = looksLikeLanguageOnlyIntent(input.prompt);
  if (languageOnly) {
    session.conversationLanguage = languageOnly.language;
    session.languageConfidence = Math.max(session.languageConfidence ?? 0.5, 0.95);
    session.lastActiveAtMs = Date.now();
    const msg = languageClarifyMessage(languageOnly.language);
    session.turns = [
      ...session.turns,
      { role: 'user' as const, content: input.prompt },
      { role: 'assistant' as const, content: msg },
    ].slice(-10) as CopilotSession['turns'];
    await putSession(env, session);
    return {
      result: { message: msg, meta: baseMeta('clarify', 'no_ops', { language: languageOnly.language, languageConfidence: session.languageConfidence }) },
      usage: { provider: 'local', model: 'language_intent', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
    };
  }

  if (conversationLanguage === 'en' && looksLikeExplainIntent(input.prompt)) {
    session.lastActiveAtMs = Date.now();
    const msg = explainMessage(input);

    session.turns = [
      ...session.turns,
      { role: 'user' as const, content: input.prompt },
      { role: 'assistant' as const, content: msg },
    ].slice(-10) as CopilotSession['turns'];
    await putSession(env, session);

    return {
      result: { message: msg, meta: baseMeta('explain', 'no_ops', { language: conversationLanguage, languageConfidence: session.languageConfidence }) },
      usage: { provider: 'local', model: 'router_v1', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
    };
  }

  const clarification = conversationLanguage === 'en' ? maybeClarify(globalDictionary, input) : null;
  if (clarification) {
    session.lastActiveAtMs = Date.now();
    session.turns = [
      ...session.turns,
      { role: 'user' as const, content: input.prompt },
      { role: 'assistant' as const, content: clarification },
    ].slice(-10) as CopilotSession['turns'];
    await putSession(env, session);

    return {
      result: { message: clarification, meta: baseMeta('clarify', 'no_ops', { language: conversationLanguage, languageConfidence: session.languageConfidence }) },
      usage: { provider: 'local', model: 'global_dictionary', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
    };
  }

  const maxTokens = getGrantMaxTokens(params.grant);
  const timeoutMs = getGrantTimeoutMs(params.grant);

  let sourcePage:
    | { url: string; title?: string; text: string; truncated: boolean; status: number; contentType: string }
    | null = null;
  let consentedUrl: URL | null = null;
  {
    if (session.pendingConsent?.kind === 'website') {
      const decision = isYesNo(input.prompt, conversationLanguage);
      if (decision === 'yes') {
        consentedUrl = normalizeUrl(session.pendingConsent.url);
        session.pendingConsent = undefined;
      } else if (decision === 'no') {
        session.pendingConsent = undefined;
        const msg = t(conversationLanguage, 'askBusinessBasics');
        session.lastActiveAtMs = Date.now();
        session.turns = [
          ...session.turns,
          { role: 'user' as const, content: input.prompt },
          { role: 'assistant' as const, content: msg },
        ].slice(-10) as CopilotSession['turns'];
        await putSession(env, session);
        return {
          result: { message: msg, meta: baseMeta('clarify', 'no_ops', { language: conversationLanguage, languageConfidence: session.languageConfidence }) },
          usage: { provider: 'local', model: 'consent_declined', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
        };
      } else {
        const msg = t(conversationLanguage, 'yesNo');
        session.lastActiveAtMs = Date.now();
        session.turns = [
          ...session.turns,
          { role: 'user' as const, content: input.prompt },
          { role: 'assistant' as const, content: msg },
        ].slice(-10) as CopilotSession['turns'];
        await putSession(env, session);
        return {
          result: { message: msg, meta: baseMeta('clarify', 'no_ops', { language: conversationLanguage, languageConfidence: session.languageConfidence }) },
          usage: { provider: 'local', model: 'consent_ambiguous', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
        };
      }
    }

    const candidates = extractUrlCandidates(input.prompt)
      .map(normalizeUrl)
      .filter((u): u is URL => Boolean(u));

    const unique = Array.from(new Map(candidates.map((u) => [u.toString(), u])).values());
    if (!consentedUrl && unique.length > 1) {
      const msg = `${t(conversationLanguage, 'askSingleUrl')}\n\n- ${unique.map((u) => u.toString()).join('\n- ')}`;
      session.lastActiveAtMs = Date.now();
      session.turns = [
        ...session.turns,
        { role: 'user' as const, content: input.prompt },
        { role: 'assistant' as const, content: msg },
      ].slice(-10) as CopilotSession['turns'];
      await putSession(env, session);

      return {
        result: { message: msg, meta: baseMeta('clarify', 'no_ops', { language: conversationLanguage, languageConfidence: session.languageConfidence }) },
        usage: { provider: 'local', model: 'url_parser', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
      };
    }

    const url = consentedUrl ?? unique[0] ?? null;
    if (url) {
      const blocked = isBlockedFetchUrl(url);
      if (blocked) {
        const msg = `${t(conversationLanguage, 'blockedUrl')} (${blocked})`;
        session.lastActiveAtMs = Date.now();
        session.turns = [
          ...session.turns,
          { role: 'user' as const, content: input.prompt },
          { role: 'assistant' as const, content: msg },
        ].slice(-10) as CopilotSession['turns'];
        await putSession(env, session);

        return {
          result: { message: msg, meta: baseMeta('clarify', 'no_ops', { language: conversationLanguage, languageConfidence: session.languageConfidence }) },
          usage: { provider: 'local', model: 'url_guard', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
        };
      }

      if (!consentedUrl) {
        session.pendingConsent = { kind: 'website', url: url.toString(), askedAtMs: Date.now() };
        const msg = t(conversationLanguage, 'askConsentWebsiteRead');
        session.lastActiveAtMs = Date.now();
        session.turns = [
          ...session.turns,
          { role: 'user' as const, content: input.prompt },
          { role: 'assistant' as const, content: msg },
        ].slice(-10) as CopilotSession['turns'];
        await putSession(env, session);
        return {
          result: { message: msg, meta: baseMeta('clarify', 'no_ops', { language: conversationLanguage, languageConfidence: session.languageConfidence }) },
          usage: { provider: 'local', model: 'consent_request', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
        };
      }

      const fetchRes = await fetchSinglePageText({ url, timeoutMs: Math.min(12_000, Math.max(1_500, timeoutMs - 1_000)) });
      if (!fetchRes.ok) {
        const msg =
          `${t(conversationLanguage, 'fetchFailed')} ${url.toString()}` +
          (fetchRes.status ? ` (HTTP ${fetchRes.status})` : '');

        session.lastActiveAtMs = Date.now();
        session.turns = [
          ...session.turns,
          { role: 'user' as const, content: input.prompt },
          { role: 'assistant' as const, content: msg },
        ].slice(-10) as CopilotSession['turns'];
        await putSession(env, session);

        return {
          result: { message: msg, meta: baseMeta('clarify', 'no_ops', { language: conversationLanguage, languageConfidence: session.languageConfidence }) },
          usage: { provider: 'local', model: 'single_page_fetch', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
        };
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

  const hasUrl = extractUrlCandidates(input.prompt).length > 0;
  if (!hasUrl && /\b(website|site|url)\b/i.test(input.prompt)) {
    const msg = t(conversationLanguage, 'askWebsiteUrl');
    session.lastActiveAtMs = Date.now();
    session.turns = [
      ...session.turns,
      { role: 'user' as const, content: input.prompt },
      { role: 'assistant' as const, content: msg },
    ].slice(-10) as CopilotSession['turns'];
    await putSession(env, session);
    return {
      result: { message: msg, meta: baseMeta('clarify', 'no_ops', { language: conversationLanguage, languageConfidence: session.languageConfidence }) },
      usage: { provider: 'local', model: 'ask_website_url', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
    };
  }

  if (!hasUrl && /\b(my|our)\s+(business|company)\b/i.test(input.prompt)) {
    const msg = t(conversationLanguage, 'askBusinessBasics');
    session.lastActiveAtMs = Date.now();
    session.turns = [
      ...session.turns,
      { role: 'user' as const, content: input.prompt },
      { role: 'assistant' as const, content: msg },
    ].slice(-10) as CopilotSession['turns'];
    await putSession(env, session);
    return {
      result: { message: msg, meta: baseMeta('clarify', 'no_ops', { language: conversationLanguage, languageConfidence: session.languageConfidence }) },
      usage: { provider: 'local', model: 'ask_business_basics', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
    };
  }

  const allowlist = await loadSdrAllowlist(env, input.widgetType);
  if (!allowlist || !allowlist.entries.length) {
    const msg = t(conversationLanguage, 'missingAllowlist');
    session.lastActiveAtMs = Date.now();
    session.turns = [
      ...session.turns,
      { role: 'user' as const, content: input.prompt },
      { role: 'assistant' as const, content: msg },
    ].slice(-10) as CopilotSession['turns'];
    await putSession(env, session);
    return {
      result: { message: msg, meta: baseMeta('clarify', 'no_ops', { language: conversationLanguage, languageConfidence: session.languageConfidence }) },
      usage: { provider: 'local', model: 'missing_allowlist', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
    };
  }

  const maxRequests = typeof params.grant.budgets?.maxRequests === 'number' ? params.grant.budgets.maxRequests : 1;

  const allowlistedValues = collectAllowlistedValues(input.currentConfig, allowlist.entries).slice(0, 20);
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
    'Allowlisted copy fields (path → current value):',
    allowlistedValues
      .map((entry) => {
        const role = entry.role ? ` (${entry.role})` : '';
        return `- ${entry.path}${role}: ${entry.value}`;
      })
      .join('\n'),
  ].join('\n');

  const messages = [
    { role: 'system', content: systemPrompt(conversationLanguage) },
    ...session.turns,
    { role: 'user', content: user },
  ];

  const overallStartedAt = Date.now();
  const first = await callChatCompletion({
    env,
    grant: params.grant,
    agentId: 'sdr.widget.copilot.v1',
    messages,
    temperature: 0.2,
    maxTokens,
    timeoutMs,
  });

  let content = first.content;
  let lastUsage = first.usage;
  let promptTokens = lastUsage.promptTokens;
  let completionTokens = lastUsage.completionTokens;

  let parsed = parseJsonFromModel(content);
  if (!isRecord(parsed)) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: lastUsage.provider, message: 'Model output must be an object' });

  let message = (asString(parsed.message) ?? '').trim();
  if (!message) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: lastUsage.provider, message: 'Model output missing message' });

  let opsRaw = parsed.ops;
  let ops = Array.isArray(opsRaw) ? opsRaw.filter(isWidgetOp) : undefined;

  const parseFallback = Boolean((parsed as any)?._parseFallback === true);
  const preValidation = ops && ops.length ? validateOpsAgainstControls({ ops, controls: input.controls }) : ({ ok: true } as const);

  const elapsedMs = Date.now() - overallStartedAt;
  const remainingTimeoutMs = timeoutMs - elapsedMs;
  const canRepair = maxRequests >= 2 && remainingTimeoutMs >= 4_000;

  if (canRepair && (parseFallback || (!preValidation.ok))) {
    let issueText = 'The previous response was invalid.';
    if (parseFallback) {
      issueText = 'Your previous response was not valid JSON.';
    } else if (!preValidation.ok) {
      issueText = `Validation errors:\n${preValidation.issues
        .slice(0, 6)
        .map((i) => `- ${i.path}: ${i.message}`)
        .join('\n')}`;
    }

    const previous = content.length > 2200 ? `${content.slice(0, 2200)}\n\n[truncated]` : content;
    const repairSystem =
      systemPrompt(conversationLanguage) +
      '\n\nREPAIR MODE:\n- Return ONLY a JSON object (no markdown, no extra text).\n- Fix the schema/validation errors.\n- If you cannot produce valid ops, return message-only (no ops) and ask one short clarifying question.';
    const repairUser = [
      user,
      '',
      'Your previous response was invalid. Please repair it.',
      issueText,
      '',
      'Previous response:',
      previous,
      '',
      'Return corrected JSON only.',
    ].join('\n');

    const repairTimeoutMs = Math.min(4_000, Math.max(1_000, remainingTimeoutMs - 500));
    const repairMaxTokens = Math.min(160, maxTokens);

    const repaired = await callChatCompletion({
      env,
      grant: params.grant,
      agentId: 'sdr.widget.copilot.v1',
      messages: [
        { role: 'system', content: repairSystem },
        { role: 'user', content: repairUser },
      ],
      temperature: 0,
      maxTokens: repairMaxTokens,
      timeoutMs: repairTimeoutMs,
    });

    lastUsage = repaired.usage;
    promptTokens += repaired.usage.promptTokens;
    completionTokens += repaired.usage.completionTokens;
    content = repaired.content;

    parsed = parseJsonFromModel(content);
    if (!isRecord(parsed)) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: lastUsage.provider, message: 'Model output must be an object' });
    message = (asString(parsed.message) ?? '').trim();
    if (!message) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: lastUsage.provider, message: 'Model output missing message' });
    opsRaw = parsed.ops;
    ops = Array.isArray(opsRaw) ? opsRaw.filter(isWidgetOp) : undefined;
  }

  const latencyMs = Date.now() - overallStartedAt;

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

  let finalMessage = message;
  let finalOps = ops && ops.length ? ops : undefined;
  let finalCta: WidgetCopilotResult['cta'] | undefined = cta;
  let finalMeta: WidgetCopilotResult['meta'] = baseMeta(finalOps ? 'edit' : 'clarify', finalOps ? 'ops_applied' : 'no_ops');

  if (finalOps && finalOps.length) {
    const validated = validateOpsAgainstControls({ ops: finalOps, controls: input.controls });
    if (!validated.ok) {
      const details = validated.issues
        .slice(0, 3)
        .map((i) => `- ${i.path}: ${i.message}`)
        .join('\n');
      finalMessage =
        'I tried to apply an edit, but it didn’t match the widget’s editable controls. ' +
        'Please try again and mention the setting you want to change (e.g. “stage background”, “FAQ title”, “accordion multi-open”).' +
        (details ? `\n\nDetails:\n${details}` : '');
      finalOps = undefined;
      finalCta = undefined;
      finalMeta = baseMeta('clarify', 'invalid_ops');
      session.pendingPolicy = undefined;
    } else {
      const policy = evaluateLightEditsPolicy({ ops: finalOps, controls: input.controls });
      if (!policy.ok) {
        finalMessage = policy.message;
        finalOps = undefined;
        finalCta = undefined;
        finalMeta = baseMeta('clarify', 'no_ops');
        session.pendingPolicy = policy.pendingPolicy;
      } else {
        session.pendingPolicy = undefined;
      }
    }
  } else {
    session.pendingPolicy = undefined;
  }

  const hasEdit = Boolean(finalOps && finalOps.length > 0);
  session.lastActiveAtMs = Date.now();
  session.successfulEdits = hasEdit ? session.successfulEdits + 1 : session.successfulEdits;
  session.turns = [
    ...session.turns,
    { role: 'user' as const, content: input.prompt },
    { role: 'assistant' as const, content: finalMessage },
  ].slice(-10) as CopilotSession['turns'];
  await putSession(env, session);

  const result: WidgetCopilotResult = {
    message: finalMessage,
    ...(finalOps && finalOps.length ? { ops: finalOps } : {}),
    ...(finalCta ? { cta: finalCta } : {}),
    meta: finalMeta,
  };

  const usage: Usage = {
    provider: lastUsage.provider,
    model: lastUsage.model,
    promptTokens,
    completionTokens,
    latencyMs,
  };

  return { result, usage };
}
