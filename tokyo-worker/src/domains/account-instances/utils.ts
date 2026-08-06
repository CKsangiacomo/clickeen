import { normalizeLocale, normalizeSha256Hex, prettyStableJson, sha256Hex } from '../../asset-utils';

const UTF8_ENCODER = new TextEncoder();

export function encodeStableJson(value: unknown): Uint8Array {
  return UTF8_ENCODER.encode(prettyStableJson(value));
}

export function jsonSha256Hex(value: unknown): Promise<string> {
  const bytes = encodeStableJson(value);
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return sha256Hex(arrayBuffer);
}

export function normalizeStorageId(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized ? normalized : null;
}

export function normalizeFingerprint(value: unknown): string | null {
  return normalizeSha256Hex(value);
}

export function normalizeLocaleList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const locales: string[] = [];
  for (const entry of value) {
    const locale = normalizeLocale(entry);
    if (!locale) return null;
    if (!locales.includes(locale)) locales.push(locale);
  }
  return locales;
}
