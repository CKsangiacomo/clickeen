import type { LocalizationOp } from '@clickeen/ck-contracts';

function splitPath(path: string): string[] {
  return String(path || '')
    .split('.')
    .map((seg) => seg.trim())
    .filter(Boolean);
}

function isIndex(segment: string): boolean {
  return /^\d+$/.test(segment);
}

function applyOpsToTextPack(
  basePack: Record<string, string>,
  ops: LocalizationOp[],
): Record<string, string> {
  const next = { ...basePack };
  for (const op of ops) {
    if (!(op.path in next)) continue;
    next[op.path] = op.value;
  }
  return next;
}

function buildLocalizedTextPack(args: {
  baseLocale: string;
  locale: string;
  basePack: Record<string, string>;
  baseOps: LocalizationOp[];
  userOps: LocalizationOp[];
}): Record<string, string> {
  if (args.locale === args.baseLocale) return { ...args.basePack };
  const withLocale = applyOpsToTextPack(args.basePack, args.baseOps);
  return applyOpsToTextPack(withLocale, args.userOps);
}

function setExistingStringAtPath(
  root: unknown,
  path: string,
  nextValue: string,
): void {
  const parts = splitPath(path);
  if (!parts.length) return;

  let current: any = root;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]!;
    const last = i === parts.length - 1;

    if (isIndex(part)) {
      const idx = Number(part);
      if (!Array.isArray(current)) return;
      if (idx < 0 || idx >= current.length) return;
      if (last) {
        if (typeof current[idx] !== 'string') return;
        current[idx] = nextValue;
        return;
      }
      current = current[idx];
      continue;
    }

    if (!current || typeof current !== 'object' || Array.isArray(current)) return;
    if (!(part in current)) return;
    if (last) {
      if (typeof current[part] !== 'string') return;
      current[part] = nextValue;
      return;
    }
    current = current[part];
  }
}

function applyTextPackToConfig(
  config: Record<string, unknown>,
  textPack: Record<string, string>,
): Record<string, unknown> {
  const cloned = structuredClone(config) as Record<string, unknown>;
  for (const [path, value] of Object.entries(textPack)) {
    if (!path || typeof value !== 'string') continue;
    setExistingStringAtPath(cloned, path, value);
  }
  return cloned;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtmlToText(input: string): string {
  const raw = String(input ?? '');
  if (!raw.trim()) return '';

  const withoutBlocks = raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|tr|blockquote)>/gi, '\n');

  const withoutTags = withoutBlocks.replace(/<[^>]+>/g, ' ');
  const decoded = decodeHtmlEntities(withoutTags);
  return decoded.replace(/\s+/g, ' ').trim();
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

type FaqState = {
  title?: string;
  sections?: Array<{
    id?: string;
    title?: string;
    faqs?: Array<{
      id?: string;
      question?: string;
      answer?: string;
    }>;
  }>;
  seoGeo?: { enabled?: boolean };
  seo?: {
    enableSchema?: boolean;
    canonicalUrl?: string;
  };
};

function faqExcerptHtml(args: {
  state: Record<string, unknown>;
  locale: string;
}): string {
  const state = asRecord(args.state) as FaqState | null;
  const enabled = state?.seoGeo?.enabled === true;
  if (!enabled) return '';

  const locale = args.locale.trim() || 'en';
  const title =
    stripHtmlToText(asString(state?.title)) || 'Frequently Asked Questions';

  const items: Array<{ q: string; a: string }> = [];
  (state?.sections || []).forEach((section) => {
    (section?.faqs || []).forEach((faq) => {
      if (items.length >= 12) return;
      const q = stripHtmlToText(asString(faq?.question));
      const a = stripHtmlToText(asString(faq?.answer));
      if (!q || !a) return;
      items.push({ q, a });
    });
  });

  if (!items.length) return '';

  const rows = items
    .map(
      ({ q, a }) => `
      <div class="ck-excerpt__item">
        <dt class="ck-excerpt__q">${escapeHtml(q)}</dt>
        <dd class="ck-excerpt__a">${escapeHtml(a)}</dd>
      </div>`,
    )
    .join('');

  return `
  <section class="ck-excerpt ck-excerpt--faq" data-ck-excerpt="faq" data-ck-locale="${escapeHtml(
    locale,
  )}">
    <h2 class="ck-excerpt__title">${escapeHtml(title)}</h2>
    <dl class="ck-excerpt__list">
      ${rows}
    </dl>
  </section>
  `.trim();
}

function faqSchemaJsonLd(args: {
  state: Record<string, unknown>;
  locale: string;
}): string {
  const state = asRecord(args.state) as FaqState | null;
  const locale = args.locale.trim() || 'en';
  const enabled = state?.seoGeo?.enabled === true;
  const schemaEnabled = state?.seo?.enableSchema !== false;
  if (!enabled || !schemaEnabled) return '';

  const canonicalUrl = asString(state?.seo?.canonicalUrl).trim();
  const entities: Array<Record<string, unknown>> = [];
  (state?.sections || []).forEach((section) => {
    (section?.faqs || []).forEach((faq) => {
      const q = stripHtmlToText(asString(faq?.question));
      const a = stripHtmlToText(asString(faq?.answer));
      if (!q || !a) return;
      entities.push({
        '@type': 'Question',
        name: q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: a,
        },
      });
    });
  });

  const faqPage: Record<string, unknown> = {
    '@type': 'FAQPage',
    inLanguage: locale,
    mainEntity: entities,
  };
  if (canonicalUrl) {
    faqPage['@id'] = canonicalUrl;
    faqPage.url = canonicalUrl;
  }

  return JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@graph': [faqPage],
    },
    null,
    0,
  );
}

type CountdownState = {
  timer?: {
    mode?: string;
    headline?: string;
    targetDate?: string;
    timezone?: string;
    timeAmount?: number;
    timeUnit?: string;
    repeat?: string;
    startingNumber?: number;
    targetNumber?: number;
    countDuration?: number;
  };
  actions?: {
    during?: { text?: string };
    after?: { type?: string; text?: string };
  };
  seoGeo?: { enabled?: boolean };
};

function countdownExcerptHtml(args: {
  state: Record<string, unknown>;
  locale: string;
}): string {
  const state = asRecord(args.state) as CountdownState | null;
  const enabled = state?.seoGeo?.enabled === true;
  if (!enabled) return '';

  const locale = args.locale.trim() || 'en';
  const headline = stripHtmlToText(asString(state?.timer?.headline)) || 'Countdown';

  const mode = asString(state?.timer?.mode).trim() || 'date';
  const rows: Array<{ q: string; a: string }> = [];

  if (mode === 'date') {
    const targetDate = asString(state?.timer?.targetDate).trim();
    const timezone = asString(state?.timer?.timezone).trim();
    const suffix = timezone ? ` (${timezone})` : '';
    if (targetDate) rows.push({ q: 'Ends', a: `${targetDate}${suffix}` });
  } else if (mode === 'personal') {
    const timeAmount = asNumber(state?.timer?.timeAmount);
    const timeUnit = asString(state?.timer?.timeUnit).trim();
    if (timeAmount !== null && timeUnit) {
      rows.push({ q: 'Duration', a: `${timeAmount} ${timeUnit}` });
    }

    const repeat = asString(state?.timer?.repeat).trim();
    if (repeat && repeat !== 'never') rows.push({ q: 'Repeat', a: repeat });
  } else if (mode === 'number') {
    const start = asNumber(state?.timer?.startingNumber);
    const end = asNumber(state?.timer?.targetNumber);
    const duration = asNumber(state?.timer?.countDuration);
    if (start !== null && end !== null) {
      const suffix = duration !== null ? ` (${duration}s)` : '';
      rows.push({ q: 'Counter', a: `${start} -> ${end}${suffix}` });
    }
  }

  const duringText = stripHtmlToText(asString(state?.actions?.during?.text)).trim();
  if (duringText) rows.push({ q: 'CTA', a: duringText });

  const afterType = asString(state?.actions?.after?.type).trim();
  const afterText = stripHtmlToText(asString(state?.actions?.after?.text)).trim();
  if (afterType === 'link' && afterText) rows.push({ q: 'After end', a: afterText });

  const list = rows
    .map(
      ({ q, a }) => `
      <div class="ck-excerpt__item">
        <dt class="ck-excerpt__q">${escapeHtml(q)}</dt>
        <dd class="ck-excerpt__a">${escapeHtml(a)}</dd>
      </div>`,
    )
    .join('');

  return `
  <section class="ck-excerpt ck-excerpt--countdown" data-ck-excerpt="countdown" data-ck-locale="${escapeHtml(
    locale,
  )}">
    <h2 class="ck-excerpt__title">${escapeHtml(headline)}</h2>
    ${list ? `<dl class="ck-excerpt__list">${list}</dl>` : ''}
  </section>
  `.trim();
}

function generateMetaPack(args: {
  widgetType: string;
  state: Record<string, unknown>;
  locale: string;
}): { schemaJsonLd: string; excerptHtml: string } {
  const widgetType = args.widgetType.trim().toLowerCase();
  const locale = args.locale.trim() || 'en';
  if (widgetType === 'faq') {
    return {
      schemaJsonLd: faqSchemaJsonLd({ state: args.state, locale }),
      excerptHtml: faqExcerptHtml({ state: args.state, locale }),
    };
  }
  if (widgetType === 'countdown') {
    return {
      schemaJsonLd: '',
      excerptHtml: countdownExcerptHtml({ state: args.state, locale }),
    };
  }
  return { schemaJsonLd: '', excerptHtml: '' };
}

export function buildLocaleMirrorPayload(args: {
  widgetType: string;
  baseConfig: Record<string, unknown>;
  baseLocale: string;
  locale: string;
  baseTextPack: Record<string, string>;
  baseOps: LocalizationOp[];
  userOps: LocalizationOp[];
  seoGeoLive: boolean;
}): { textPack: Record<string, string>; metaPack: Record<string, unknown> | null } {
  const textPack = buildLocalizedTextPack({
    baseLocale: args.baseLocale,
    locale: args.locale,
    basePack: args.baseTextPack,
    baseOps: args.baseOps,
    userOps: args.userOps,
  });
  if (!args.seoGeoLive) {
    return { textPack, metaPack: null };
  }
  const localizedConfig = applyTextPackToConfig(args.baseConfig, textPack);
  return {
    textPack,
    metaPack: generateMetaPack({
      widgetType: args.widgetType,
      state: localizedConfig,
      locale: args.locale,
    }),
  };
}
