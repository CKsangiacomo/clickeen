import { buildL10nSnapshot, computeBaseFingerprint, type AllowlistEntry } from '@clickeen/l10n';
import type { Env } from '../../types';
import { accountInstanceL10nBaseSnapshotKey } from './keys';
import { loadJson, putJson } from './storage';
import { normalizeAllowlistEntries } from './normalize';
import { normalizeFingerprint, normalizePublicId } from './utils';

export function resolveTokyoPublicBaseUrl(env: Env): string | null {
  const configured =
    typeof env.TOKYO_PUBLIC_BASE_URL === 'string' ? env.TOKYO_PUBLIC_BASE_URL.trim() : '';
  return configured ? configured.replace(/\/+$/, '') : null;
}

export async function loadWidgetLocalizationAllowlist(args: {
  env: Env;
  widgetType: string;
}): Promise<AllowlistEntry[]> {
  const baseUrl = resolveTokyoPublicBaseUrl(args.env);
  if (!baseUrl) return [];

  const response = await fetch(
    `${baseUrl}/widgets/${encodeURIComponent(args.widgetType)}/localization.json`,
    {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
    },
  );

  if (response.status === 404) {
    return [];
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new Error(`tokyo_widget_localization_http_${response.status}`);
  }

  return normalizeAllowlistEntries(payload);
}

function normalizeSavedL10nSnapshot(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const snapshot: Record<string, string> = {};
  for (const [path, value] of Object.entries(raw as Record<string, unknown>)) {
    const normalizedPath = typeof path === 'string' ? path.trim() : '';
    if (!normalizedPath || typeof value !== 'string') return null;
    snapshot[normalizedPath] = value;
  }
  return snapshot;
}

export async function loadSavedRenderL10nBase(args: {
  env: Env;
  accountId: string;
  publicId: string;
  widgetType: string;
  baseFingerprint?: string | null;
}): Promise<{
  baseFingerprint: string;
  snapshot: Record<string, string>;
  allowlist: AllowlistEntry[];
} | null> {
  const publicId = normalizePublicId(args.publicId);
  const accountId = normalizePublicId(args.accountId);
  if (!publicId) throw new Error('[tokyo] load-saved-render-l10n-base invalid publicId');
  if (!accountId) throw new Error('[tokyo] load-saved-render-l10n-base invalid accountId');
  const widgetType = typeof args.widgetType === 'string' ? args.widgetType.trim() : '';
  if (!widgetType) throw new Error('[tokyo] load-saved-render-l10n-base missing widgetType');

  const allowlist = await loadWidgetLocalizationAllowlist({
    env: args.env,
    widgetType,
  });
  const baseFingerprint = normalizeFingerprint(args.baseFingerprint);
  if (!baseFingerprint) return null;

  const existing = await loadJson<{ snapshot?: unknown }>(
    args.env,
    accountInstanceL10nBaseSnapshotKey(accountId, publicId, baseFingerprint),
  );
  const existingSnapshot = normalizeSavedL10nSnapshot(existing?.snapshot);
  if (!existingSnapshot) return null;

  return {
    baseFingerprint,
    snapshot: existingSnapshot,
    allowlist,
  };
}

export async function ensureSavedRenderL10nBase(args: {
  env: Env;
  accountId: string;
  publicId: string;
  widgetType: string;
  config: Record<string, unknown>;
  existingBaseFingerprint?: string | null;
}): Promise<{
  baseFingerprint: string;
  snapshot: Record<string, string>;
  allowlist: AllowlistEntry[];
}> {
  const publicId = normalizePublicId(args.publicId);
  const accountId = normalizePublicId(args.accountId);
  if (!publicId) throw new Error('[tokyo] ensure-saved-render-l10n-base invalid publicId');
  if (!accountId) throw new Error('[tokyo] ensure-saved-render-l10n-base invalid accountId');
  const widgetType = typeof args.widgetType === 'string' ? args.widgetType.trim() : '';
  if (!widgetType) throw new Error('[tokyo] ensure-saved-render-l10n-base missing widgetType');

  const allowlist = await loadWidgetLocalizationAllowlist({
    env: args.env,
    widgetType,
  });

  const snapshot = buildL10nSnapshot(args.config, allowlist);
  const baseFingerprint = await computeBaseFingerprint(snapshot);
  const existingBaseFingerprint = normalizeFingerprint(args.existingBaseFingerprint);

  if (existingBaseFingerprint && existingBaseFingerprint === baseFingerprint) {
    const existing = await loadSavedRenderL10nBase({
      env: args.env,
      accountId,
      publicId,
      widgetType,
      baseFingerprint,
    });
    if (existing) {
      return existing;
    }
  }

  const existingCurrent = await loadSavedRenderL10nBase({
    env: args.env,
    accountId,
    publicId,
    widgetType,
    baseFingerprint,
  });
  if (existingCurrent) {
    return existingCurrent;
  }

  await putJson(args.env, accountInstanceL10nBaseSnapshotKey(accountId, publicId, baseFingerprint), {
    v: 1,
    publicId,
    baseFingerprint,
    snapshot,
  });
  return { baseFingerprint, snapshot, allowlist };
}
