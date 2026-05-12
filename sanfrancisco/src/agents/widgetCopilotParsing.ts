export type ModelJsonParseResult =
  | { ok: true; value: unknown }
  | { ok: false; cleaned: string };

export function looksLikeCloudflareErrorPage(text: string): { status?: number; reason: string } | null {
  const s = text.toLowerCase();
  if (!s) return null;

  const hasCfWrapper = s.includes('id="cf-wrapper"') || s.includes("id='cf-wrapper'");
  const hasCfDetails = s.includes('id="cf-error-details"') || s.includes("id='cf-error-details'");
  const hasCdnCgi = s.includes('/cdn-cgi/') || s.includes('cdn-cgi/styles/main.css');
  const hasLandingLink = s.includes('cloudflare.com/5xx-error-landing');
  if (!(hasCfWrapper || hasCfDetails || hasCdnCgi || hasLandingLink)) return null;

  const match = s.match(/error code\s*(\d{3})/);
  const code = match ? Number(match[1]) : undefined;
  return { status: Number.isFinite(code) ? code : undefined, reason: 'cloudflare_error_page' };
}

export function parseJsonFromModel(raw: string): ModelJsonParseResult {
  const trimmed = raw.trim();
  let cleaned = trimmed;

  if (cleaned.startsWith('```')) {
    const lines = cleaned.split('\n');
    lines.shift();
    while (lines.length && lines[lines.length - 1]?.trim() === '```') lines.pop();
    cleaned = lines.join('\n').trim();
  }

  try {
    return { ok: true, value: JSON.parse(cleaned) };
  } catch {
    const firstObj = cleaned.indexOf('{');
    const lastObj = cleaned.lastIndexOf('}');
    if (firstObj >= 0 && lastObj > firstObj) {
      const slice = cleaned.slice(firstObj, lastObj + 1);
      try {
        return { ok: true, value: JSON.parse(slice) };
      } catch {
        // continue
      }
    }
    return { ok: false, cleaned };
  }
}
