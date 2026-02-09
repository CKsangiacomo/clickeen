import { asString, isRecord } from '../http';

export type FetchHtmlResult =
  | {
    ok: true;
    finalUrl: string;
    status: number;
    contentType: string;
    html: string;
    truncated: boolean;
  }
  | { ok: false; status?: number; message: string };

export type FetchPageTextResult =
  | {
    ok: true;
    finalUrl: string;
    status: number;
    contentType: string;
    title?: string;
    text: string;
    truncated: boolean;
  }
  | { ok: false; status?: number; message: string };

export type HeadMeta = {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogSiteName?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  jsonLdTypes?: string[];
  jsonLdName?: string;
  jsonLdDescription?: string;
};

const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_MAX_BYTES = 750_000;

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

export function extractUrlCandidates(text: string): string[] {
  const urls = new Set<string>();
  const httpRanges: Array<{ start: number; end: number }> = [];

  const add = (raw: string) => {
    const trimmed = raw.trim().replace(/[),.;]+$/g, '');
    if (!trimmed) return;
    urls.add(trimmed);
  };

  for (const m of text.matchAll(/\bhttps?:\/\/[^\s<>"')]+/gi)) {
    add(m[0]);
    if (typeof m.index === 'number') httpRanges.push({ start: m.index, end: m.index + m[0].length });
  }

  const isInsideHttpUrl = (index: number) => httpRanges.some((r) => index >= r.start && index < r.end);

  for (const m of text.matchAll(/\b(?![\w.+-]+@)([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s<>"')]+)?\b/gi)) {
    if (typeof m.index === 'number' && isInsideHttpUrl(m.index)) continue;
    add(m[0]);
  }

  return Array.from(urls);
}

export function normalizeUrl(candidate: string): URL | null {
  const raw = candidate.trim();
  if (!raw) return null;
  try {
    if (/^https?:\/\//i.test(raw)) return new URL(raw);
    return new URL(`https://${raw}`);
  } catch {
    return null;
  }
}

export function isBlockedFetchUrl(url: URL): string | null {
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

async function fetchHtmlPage(args: { url: URL; timeoutMs: number; maxBytes?: number; maxRedirects?: number }): Promise<FetchHtmlResult> {
  const maxRedirects = args.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxBytes = args.maxBytes ?? DEFAULT_MAX_BYTES;

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
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'accept-language': 'en-US,en;q=0.9',
            'cache-control': 'no-cache',
            pragma: 'no-cache',
            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'none',
            'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
      if (!bodyText) return { ok: false, status: res.status, message: 'Page content was empty.' };

      return {
        ok: true,
        finalUrl: current.toString(),
        status: res.status,
        contentType: contentType || 'unknown',
        html: bodyText,
        truncated,
      };
    }

    return { ok: false, message: 'Too many redirects.' };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchSinglePageText(args: { url: URL; timeoutMs: number; maxBytes?: number; maxRedirects?: number }): Promise<FetchPageTextResult> {
  const res = await fetchHtmlPage(args);
  if (!res.ok) return res;

  const isHtml = res.contentType.includes('text/html');
  const extracted = isHtml ? htmlToText(res.html) : { text: res.html.trim() };
  if (!extracted.text) return { ok: false, status: res.status, message: 'Page content was empty.' };

  return {
    ok: true,
    finalUrl: res.finalUrl,
    status: res.status,
    contentType: res.contentType,
    title: isHtml ? extracted.title : undefined,
    text: extracted.text,
    truncated: res.truncated,
  };
}

function normalizeWhitespace(value: string): string {
  return decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();
}

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of tag.matchAll(/([a-zA-Z0-9:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    const key = match[1]?.toLowerCase() ?? '';
    const value = match[3] ?? match[4] ?? match[5] ?? '';
    if (key) attrs[key] = normalizeWhitespace(value);
  }
  return attrs;
}

function extractHeadHtml(html: string): string {
  const match = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (match?.[1]) return match[1];
  return html.slice(0, 8000);
}

function extractJsonLd(headHtml: string): { types: string[]; names: string[]; descriptions: string[] } {
  const types: string[] = [];
  const names: string[] = [];
  const descriptions: string[] = [];

  for (const match of headHtml.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = match[1] ?? '';
    if (!raw.trim()) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const queue: unknown[] = Array.isArray(parsed) ? parsed.slice() : [parsed];
    while (queue.length) {
      const item = queue.shift();
      if (!item) continue;
      if (Array.isArray(item)) {
        queue.push(...item);
        continue;
      }
      if (!isRecord(item)) continue;

      const typeValue = item['@type'];
      if (typeof typeValue === 'string') types.push(typeValue);
      if (Array.isArray(typeValue)) {
        typeValue.forEach((t) => {
          if (typeof t === 'string') types.push(t);
        });
      }
      const nameValue = (item as any).name;
      if (typeof nameValue === 'string') names.push(normalizeWhitespace(nameValue));
      const descValue = (item as any).description;
      if (typeof descValue === 'string') descriptions.push(normalizeWhitespace(descValue));

      Object.values(item).forEach((value) => {
        if (isRecord(value) || Array.isArray(value)) queue.push(value);
      });
    }
  }

  return { types, names, descriptions };
}

export function parseHeadMeta(html: string): HeadMeta {
  const head = extractHeadHtml(html);

  const titleMatch = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? normalizeWhitespace(titleMatch[1]) : undefined;

  let description: string | undefined;
  let ogTitle: string | undefined;
  let ogDescription: string | undefined;
  let ogSiteName: string | undefined;
  let twitterTitle: string | undefined;
  let twitterDescription: string | undefined;

  for (const match of head.matchAll(/<meta\s+[^>]*>/gi)) {
    const tag = match[0];
    const attrs = parseAttributes(tag);
    const name = (attrs.name || '').toLowerCase();
    const property = (attrs.property || '').toLowerCase();
    const content = attrs.content ? normalizeWhitespace(attrs.content) : '';
    if (!content) continue;

    if (name === 'description' && !description) description = content;
    if (property === 'og:title' && !ogTitle) ogTitle = content;
    if (property === 'og:description' && !ogDescription) ogDescription = content;
    if (property === 'og:site_name' && !ogSiteName) ogSiteName = content;
    if (name === 'twitter:title' && !twitterTitle) twitterTitle = content;
    if (name === 'twitter:description' && !twitterDescription) twitterDescription = content;
  }

  const jsonLd = extractJsonLd(head);
  const jsonLdTypes = jsonLd.types.length ? Array.from(new Set(jsonLd.types)) : undefined;
  const jsonLdName = jsonLd.names.find(Boolean);
  const jsonLdDescription = jsonLd.descriptions.find(Boolean);

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(ogTitle ? { ogTitle } : {}),
    ...(ogDescription ? { ogDescription } : {}),
    ...(ogSiteName ? { ogSiteName } : {}),
    ...(twitterTitle ? { twitterTitle } : {}),
    ...(twitterDescription ? { twitterDescription } : {}),
    ...(jsonLdTypes ? { jsonLdTypes } : {}),
    ...(jsonLdName ? { jsonLdName } : {}),
    ...(jsonLdDescription ? { jsonLdDescription } : {}),
  };
}

export function extractBodySnippet(html: string, maxChars: number): string {
  const extracted = htmlToText(html);
  const text = extracted.text.trim();
  if (!text) return '';
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[truncated]`;
}

export async function fetchHeadMeta(args: { url: URL; timeoutMs: number; maxBytes?: number; maxRedirects?: number }): Promise<
  | { ok: true; finalUrl: string; status: number; contentType: string; meta: HeadMeta; truncated: boolean }
  | { ok: false; status?: number; message: string }
> {
  const res = await fetchHtmlPage({
    url: args.url,
    timeoutMs: args.timeoutMs,
    maxBytes: args.maxBytes ?? 60_000,
    maxRedirects: args.maxRedirects,
  });
  if (!res.ok) return res;
  if (!res.contentType.includes('text/html')) {
    return { ok: false, status: res.status, message: `Unsupported content-type: ${res.contentType || 'unknown'}.` };
  }

  return {
    ok: true,
    finalUrl: res.finalUrl,
    status: res.status,
    contentType: res.contentType,
    meta: parseHeadMeta(res.html),
    truncated: res.truncated,
  };
}

export async function fetchHtmlSnippet(args: { url: URL; timeoutMs: number; maxBytes?: number; maxRedirects?: number; maxChars?: number }): Promise<
  | { ok: true; finalUrl: string; status: number; contentType: string; snippet: string; truncated: boolean }
  | { ok: false; status?: number; message: string }
> {
  const res = await fetchHtmlPage({
    url: args.url,
    timeoutMs: args.timeoutMs,
    maxBytes: args.maxBytes ?? 80_000,
    maxRedirects: args.maxRedirects,
  });
  if (!res.ok) return res;
  if (!res.contentType.includes('text/html')) {
    return { ok: false, status: res.status, message: `Unsupported content-type: ${res.contentType || 'unknown'}.` };
  }

  const snippet = extractBodySnippet(res.html, args.maxChars ?? 2000);
  if (!snippet) return { ok: false, status: res.status, message: 'Page content was empty.' };

  return {
    ok: true,
    finalUrl: res.finalUrl,
    status: res.status,
    contentType: res.contentType,
    snippet,
    truncated: res.truncated,
  };
}
