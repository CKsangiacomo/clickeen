import { stripHtmlToText } from './text';
import { escapeHtml } from '@venice/lib/html';

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

export function countdownExcerptHtml(args: { state: Record<string, unknown>; locale: string }): string {
  const state = (asRecord(args.state) as unknown) as CountdownState;
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
    if (timeAmount !== null && timeUnit) rows.push({ q: 'Duration', a: `${timeAmount} ${timeUnit}` });

    const repeat = asString(state?.timer?.repeat).trim();
    if (repeat && repeat !== 'never') rows.push({ q: 'Repeat', a: repeat });
  } else if (mode === 'number') {
    const start = asNumber(state?.timer?.startingNumber);
    const end = asNumber(state?.timer?.targetNumber);
    const duration = asNumber(state?.timer?.countDuration);
    if (start !== null && end !== null) {
      const suffix = duration !== null ? ` (${duration}s)` : '';
      rows.push({ q: 'Counter', a: `${start} → ${end}${suffix}` });
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
  <section class="ck-excerpt ck-excerpt--countdown" data-ck-excerpt="countdown" data-ck-locale="${escapeHtml(locale)}">
    <h2 class="ck-excerpt__title">${escapeHtml(headline)}</h2>
    ${list ? `<dl class="ck-excerpt__list">${list}</dl>` : ''}
  </section>
  `.trim();
}

