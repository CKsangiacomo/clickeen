import { normalizeLocale, normalizeSha256Hex, prettyStableJson, sha256Hex } from '../../asset-utils';
import type { SavedRenderL10nFailure, SavedRenderL10nStatus } from './types';

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

export function normalizePublicId(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized ? normalized : null;
}

export function normalizeFingerprint(value: unknown): string | null {
  return normalizeSha256Hex(value);
}

export function normalizeLocaleList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => normalizeLocale(entry))
        .filter((entry): entry is string => Boolean(entry)),
    ),
  );
}

export function normalizeSavedL10nStatus(value: unknown): SavedRenderL10nStatus | null {
  return value === 'queued' || value === 'working' || value === 'ready' || value === 'failed'
    ? value
    : null;
}

export function normalizeSavedL10nFailures(value: unknown): SavedRenderL10nFailure[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const payload = entry as Record<string, unknown>;
    const locale = normalizeLocale(payload.locale);
    const reasonKey =
      typeof payload.reasonKey === 'string' ? payload.reasonKey.trim() : '';
    if (!locale || !reasonKey) return [];
    const detail = typeof payload.detail === 'string' ? payload.detail.trim() : '';
    return [{ locale, reasonKey, ...(detail ? { detail } : {}) }];
  });
}
