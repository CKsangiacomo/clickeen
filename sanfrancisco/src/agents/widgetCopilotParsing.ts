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

  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    return { ok: false, cleaned: trimmed };
  }
}
