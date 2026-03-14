import type { CkErrorKind, CkErrorResponse } from './types';
import { json } from './http';

export function ckError(error: CkErrorResponse['error'], status: number) {
  return json({ error } satisfies CkErrorResponse, { status });
}

function normalizeApiErrorShape(code: string, status: number): {
  kind: CkErrorKind;
  reasonKey: string;
} {
  const normalized = String(code || '').trim().toUpperCase();
  switch (normalized) {
    case 'INSTANCE_NOT_FOUND':
      return { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
    case 'LOCALE_NOT_ENTITLED':
      return { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' };
    case 'LAYER_INVALID':
    case 'LAYER_KEY_INVALID':
    case 'LOCALE_INVALID':
    case 'OPS_INVALID_TYPE':
    case 'FINGERPRINT_MISMATCH':
      return { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' };
    case 'LAYER_NOT_FOUND':
      return { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.payload.invalid' };
    case 'INTERNAL_ERROR':
      return { kind: 'INTERNAL', reasonKey: 'coreui.errors.internal.serverError' };
    default:
      if (status === 403) return { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' };
      if (status === 404) return { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
      if (status >= 400 && status < 500) return { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' };
      return { kind: 'INTERNAL', reasonKey: 'coreui.errors.internal.serverError' };
  }
}

function normalizeApiErrorDetail(message: string, detail?: unknown): string | undefined {
  const messageText = typeof message === 'string' ? message.trim() : '';
  if (detail == null || detail === '') return messageText || undefined;
  if (typeof detail === 'string') return messageText ? `${messageText} :: ${detail}` : detail;
  try {
    const jsonDetail = JSON.stringify(detail);
    return messageText ? `${messageText} :: ${jsonDetail}` : jsonDetail;
  } catch {
    return messageText || String(detail);
  }
}

function extractApiErrorPaths(detail?: unknown): string[] | undefined {
  if (!Array.isArray(detail)) return undefined;
  const paths = detail
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
      const path = (entry as { path?: unknown }).path;
      return typeof path === 'string' && path.trim() ? path.trim() : null;
    })
    .filter((path): path is string => Boolean(path));
  return paths.length ? Array.from(new Set(paths)) : undefined;
}

export function apiError(code: string, message: string, status: number, detail?: unknown) {
  const normalized = normalizeApiErrorShape(code, status);
  const normalizedDetail = normalizeApiErrorDetail(message, detail);
  const paths = extractApiErrorPaths(detail);
  return json(
    {
      error: {
        kind: normalized.kind,
        reasonKey: normalized.reasonKey,
        ...(normalizedDetail ? { detail: normalizedDetail } : {}),
        ...(paths ? { paths } : {}),
        code,
        message,
      },
    },
    { status },
  );
}

export function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
