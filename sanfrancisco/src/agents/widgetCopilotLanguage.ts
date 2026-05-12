import globalDictionary from '../lexicon/global_dictionary.json';

export type WidgetCopilotLanguageSession = {
  conversationLanguage?: string;
  languageConfidence?: number;
};

function fnv1aHashHex(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export const DICTIONARY_HASH = fnv1aHashHex(JSON.stringify(globalDictionary));

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

const UI_STRINGS: Record<string, Record<string, string>> = {
  en: {
    cloudflareError:
      'That looks like a Cloudflare error page. Please share a working URL or paste the page text.',
  },
  es: {
    cloudflareError:
      'Eso parece una página de error de Cloudflare. Comparte una URL válida o pega el texto.',
  },
  ja: {
    cloudflareError: 'Cloudflareのエラーページのようです。別のURLか本文を貼ってください。',
  },
  ar: {
    cloudflareError: 'يبدو أنها صفحة خطأ من Cloudflare. أرسل رابطًا صالحًا أو الصق النص.',
  },
  ru: {
    cloudflareError: 'Похоже на страницу ошибки Cloudflare. Пришлите рабочий URL или вставьте текст.',
  },
};

function normalizeLocaleToken(raw: string): string {
  return String(raw || '').trim().toLowerCase().replace(/_/g, '-');
}

function normalizeTextToken(input: string): string {
  return String(input || '').toLowerCase().replace(/[^a-z0-9\u00C0-\u017F]+/g, ' ').trim();
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

function mapLanguageToken(raw: string): string | null {
  const normalized = normalizeLocaleToken(raw);
  const mapped = LANGUAGE_NAME_MAP[normalized];
  if (mapped) return mapped;
  if (LANGUAGE_CODE_SET.has(normalized)) return normalized;
  const base = normalized.split('-')[0];
  return LANGUAGE_CODE_SET.has(base) ? base : null;
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

function scoreStopwords(prompt: string): { lang: string; score: number } | null {
  const tokens = normalizeTextToken(prompt).split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  let best: { lang: string; score: number } | null = null;
  for (const lang of STOPWORD_LANGS) {
    const set = new Set(STOPWORDS[lang]);
    const score = tokens.reduce((acc, token) => acc + (set.has(token) ? 1 : 0), 0);
    if (!best || score > best.score) best = { lang, score };
  }
  return best;
}

export function resolveConversationLanguage(
  session: WidgetCopilotLanguageSession,
  prompt: string,
): { language: string; confidence: number } {
  const explicit = detectExplicitLanguage(prompt);
  if (explicit) return { language: explicit, confidence: 0.99 };

  const scriptLang = detectScriptLanguage(prompt);
  if (scriptLang) return { language: scriptLang, confidence: 0.95 };

  const scored = scoreStopwords(prompt);
  if (scored && scored.score >= 2) return { language: scored.lang, confidence: 0.85 };

  const sticky = session.conversationLanguage ? normalizeLocaleToken(session.conversationLanguage) : 'en';
  return { language: sticky || 'en', confidence: session.languageConfidence ?? 0.5 };
}

export function translateCopilotUi(lang: string, key: keyof (typeof UI_STRINGS)['en']): string {
  const normalized = normalizeLocaleToken(lang);
  const table = UI_STRINGS[normalized] ?? UI_STRINGS.en;
  return table[key] ?? UI_STRINGS.en[key];
}
