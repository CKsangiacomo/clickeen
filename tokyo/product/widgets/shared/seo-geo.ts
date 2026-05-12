export type SeoGeoMetaPack = {
  schemaJsonLd: string;
  excerptHtml: string;
};

export type SeoGeoMetaPackGenerator = (args: {
  state: Record<string, unknown>;
  locale: string;
}) => SeoGeoMetaPack;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function stripHtmlToText(input: string): string {
  const raw = String(input ?? "");
  if (!raw.trim()) return "";

  const withoutBlocks = raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|tr|blockquote)>/gi, "\n");

  const withoutTags = withoutBlocks.replace(/<[^>]+>/g, " ");
  const decoded = decodeHtmlEntities(withoutTags);
  return decoded.replace(/\s+/g, " ").trim();
}

export function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function asNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
