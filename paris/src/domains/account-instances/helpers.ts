import { evaluateLimits } from '@clickeen/ck-policy';
import type { LimitsSpec, Policy } from '@clickeen/ck-policy';
import type {
  CuratedInstanceRow,
  Env,
  InstanceRow,
} from '../../shared/types';
import { ckError, errorDetail } from '../../shared/errors';
import { readJson } from '../../shared/http';
import { supabaseFetch } from '../../shared/supabase';
import { formatCuratedDisplayName, readCuratedMeta } from '../../shared/curated-meta';
import { asTrimmedString } from '../../shared/validation';
import { loadWidgetLimits } from '../../shared/tokyo';
import {
  AssetUsageValidationError,
  syncAccountAssetUsageForInstance,
  validateAccountAssetUsageForInstance,
} from '../../shared/assetUsage';
import {
  inferInstanceKindFromPublicId,
  isCuratedInstanceRow,
  resolveCuratedRowKind,
} from '../../shared/instances';
import type { AccountL10nPolicy } from '../../shared/l10n';
export type AccountLocaleOverlayPayload = {
  locale: string;
  source: string | null;
  baseFingerprint: string | null;
  baseUpdatedAt: string | null;
  hasUserOps: boolean;
  baseOps: Array<{ op: 'set'; path: string; value: string }>;
  userOps: Array<{ op: 'set'; path: string; value: string }>;
};

export type AccountInstanceEnvelope = {
  publicId: string;
  displayName: string;
  ownerAccountId: string;
  status: 'published' | 'unpublished';
  widgetType: string;
  config: Record<string, unknown>;
  meta: Record<string, unknown> | null;
  updatedAt: string | null;
  baseFingerprint: string;
  policy: Policy;
  account: {
    id: string;
    tier: string;
    websiteUrl: string | null;
  };
  localization: {
    accountLocales: string[];
    invalidAccountLocales: string | null;
    localeOverlays: AccountLocaleOverlayPayload[];
    policy: AccountL10nPolicy;
  };
};

export function validateAccountInstanceEnvelope(payload: AccountInstanceEnvelope): string | null {
  if (!payload.publicId) return 'publicId missing';
  if (!payload.displayName) return 'displayName missing';
  if (!payload.ownerAccountId) return 'ownerAccountId missing';
  if (payload.status !== 'published' && payload.status !== 'unpublished') return 'status invalid';
  if (!payload.widgetType) return 'widgetType missing';
  if (!payload.config || typeof payload.config !== 'object' || Array.isArray(payload.config)) return 'config invalid';
  if (!/^[a-f0-9]{64}$/i.test(payload.baseFingerprint)) return 'baseFingerprint invalid';
  if (!payload.policy || typeof payload.policy !== 'object') return 'policy missing';
  if (!payload.account?.id) return 'account.id missing';
  if (!payload.account?.tier) return 'account.tier missing';
  if (!Array.isArray(payload.localization.accountLocales)) return 'localization.accountLocales invalid';
  if (!Array.isArray(payload.localization.localeOverlays)) return 'localization.localeOverlays invalid';
  if (!payload.localization.policy || typeof payload.localization.policy !== 'object') return 'localization.policy invalid';
  if ((payload.localization.policy as any).v !== 1) return 'localization.policy.v invalid';
  return null;
}

export const DEFAULT_INSTANCE_DISPLAY_NAME = 'Untitled widget';

function accountAssetValidationPaths(detail: string): string[] | undefined {
  const match = String(detail || '').match(/ at ([^:]+):/);
  const path = match?.[1]?.trim() || '';
  return path ? [path] : undefined;
}

export async function validateAccountAssetUsageForInstanceStrict(args: {
  env: Env;
  accountId: string;
  publicId: string;
  config: Record<string, unknown>;
}): Promise<Response | null> {
  try {
    await validateAccountAssetUsageForInstance(args);
    return null;
  } catch (error) {
    const detail = errorDetail(error);
    if (error instanceof AssetUsageValidationError) {
      return ckError(
        {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.payload.invalid',
          detail,
          paths: accountAssetValidationPaths(detail),
        },
        422,
      );
    }
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail }, 500);
  }
}

export async function syncAccountAssetUsageForInstanceStrict(args: {
  env: Env;
  accountId: string;
  publicId: string;
  config: Record<string, unknown>;
}): Promise<Response | null> {
  try {
    await syncAccountAssetUsageForInstance(args);
    return null;
  } catch (error) {
    const detail = errorDetail(error);
    if (error instanceof AssetUsageValidationError) {
      return ckError(
        {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.payload.invalid',
          detail,
          paths: accountAssetValidationPaths(detail),
        },
        422,
      );
    }
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail }, 500);
  }
}

export async function rollbackCreatedInstanceOnUsageSyncFailure(args: {
  env: Env;
  accountId: string;
  publicId: string;
  isCurated: boolean;
}): Promise<void> {
  const path = args.isCurated
    ? `/rest/v1/curated_widget_instances?public_id=eq.${encodeURIComponent(args.publicId)}`
    : `/rest/v1/widget_instances?public_id=eq.${encodeURIComponent(args.publicId)}&account_id=eq.${encodeURIComponent(args.accountId)}`;
  const res = await supabaseFetch(args.env, path, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
  if (!res.ok) {
    const details = await readJson(res);
    console.error(
      `[ParisWorker] Failed to rollback created instance after usage sync error (${res.status}): ${JSON.stringify(details)}`,
    );
  }
}

export async function rollbackInstanceWriteOnUsageSyncFailure(args: {
  env: Env;
  accountId: string;
  publicId: string;
  before: InstanceRow | CuratedInstanceRow;
  isCurated: boolean;
}): Promise<void> {
  const patchPath = args.isCurated
    ? `/rest/v1/curated_widget_instances?public_id=eq.${encodeURIComponent(args.publicId)}`
    : `/rest/v1/widget_instances?public_id=eq.${encodeURIComponent(args.publicId)}&account_id=eq.${encodeURIComponent(args.accountId)}`;

  let rollbackPayload: Record<string, unknown> = {
    config: args.before.config,
  };
  if (args.isCurated) {
    const beforeCurated = args.before as CuratedInstanceRow;
    rollbackPayload = {
      ...rollbackPayload,
      status: beforeCurated.status,
      kind: resolveCuratedRowKind(args.publicId),
      meta: beforeCurated.meta ?? null,
    };
  } else {
    const beforeUser = args.before as InstanceRow;
    rollbackPayload = {
      ...rollbackPayload,
      status: beforeUser.status,
      display_name: beforeUser.display_name ?? DEFAULT_INSTANCE_DISPLAY_NAME,
      kind: beforeUser.kind ?? inferInstanceKindFromPublicId(args.publicId),
    };
  }

  const rollbackRes = await supabaseFetch(args.env, patchPath, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(rollbackPayload),
  });
  if (!rollbackRes.ok) {
    const details = await readJson(rollbackRes);
    console.error(
      `[ParisWorker] Failed to rollback instance write after usage sync error (${rollbackRes.status}): ${JSON.stringify(details)}`,
    );
  }
}

export async function rollbackCreatedInstanceAfterPostCommitFailure(args: {
  env: Env;
  accountId: string;
  publicId: string;
  isCurated: boolean;
}): Promise<void> {
  await rollbackCreatedInstanceOnUsageSyncFailure(args);
}

export async function rollbackInstanceWriteAfterPostCommitFailure(args: {
  env: Env;
  accountId: string;
  publicId: string;
  before: InstanceRow | CuratedInstanceRow;
  isCurated: boolean;
}): Promise<void> {
  await rollbackInstanceWriteOnUsageSyncFailure(args);
  try {
    await syncAccountAssetUsageForInstance({
      env: args.env,
      accountId: args.accountId,
      publicId: args.publicId,
      config: args.before.config,
    });
  } catch (error) {
    const detail = errorDetail(error);
    console.error(
      `[ParisWorker] Failed to restore asset usage references after rollback for ${args.publicId}: ${detail}`,
    );
  }
}

export function resolveAccountInstanceDisplayName(instance: InstanceRow | CuratedInstanceRow): string {
  if (isCuratedInstanceRow(instance)) {
    return formatCuratedDisplayName(readCuratedMeta(instance.meta), instance.public_id);
  }
  return asTrimmedString(instance.display_name) ?? DEFAULT_INSTANCE_DISPLAY_NAME;
}

export function resolveCuratedMetaUpdate(args: {
  currentMetaRaw: unknown;
  incomingMeta: Record<string, unknown> | null | undefined;
  displayName: string | null | undefined;
}): Record<string, unknown> | null | undefined {
  const { currentMetaRaw, incomingMeta, displayName } = args;
  if (incomingMeta === undefined && displayName === undefined) return undefined;
  const baseMeta = incomingMeta !== undefined ? incomingMeta : readCuratedMeta(currentMetaRaw);
  const nextMeta: Record<string, unknown> = baseMeta && typeof baseMeta === 'object' ? { ...baseMeta } : {};
  if (displayName !== undefined) {
    if (displayName === null) {
      delete nextMeta.styleName;
    } else {
      nextMeta.styleName = displayName;
    }
  }
  if (incomingMeta === null && Object.keys(nextMeta).length === 0) return null;
  return nextMeta;
}

export function normalizeLocalizationOpsForPayload(raw: unknown): Array<{ op: 'set'; path: string; value: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
      const op = (entry as { op?: unknown }).op;
      const path = (entry as { path?: unknown }).path;
      const value = (entry as { value?: unknown }).value;
      if (op !== 'set') return null;
      if (typeof path !== 'string' || !path.trim()) return null;
      if (typeof value !== 'string') return null;
      return { op: 'set' as const, path: path.trim(), value };
    })
    .filter((entry): entry is { op: 'set'; path: string; value: string } => Boolean(entry));
}
export async function enforceLimits(
  env: Env,
  policy: Policy,
  widgetType: string | null,
  config: Record<string, unknown>,
) {
  if (!widgetType) return null;
  let limits: LimitsSpec | null = null;
  try {
    limits = await loadWidgetLimits(env, widgetType);
  } catch (error) {
    const detail = errorDetail(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.limits.loadFailed', detail }, 500);
  }
  if (!limits) return null;

  const violations = evaluateLimits({ config, limits, policy, context: 'publish' });
  if (violations.length === 0) return null;

  const first = violations[0];
  return ckError(
    {
      kind: 'DENY',
      reasonKey: first.reasonKey,
      upsell: 'UP',
      detail: first.detail,
      paths: [first.path],
    },
    403,
  );
}

export function titleCase(input: string): string {
  return input
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(' ');
}
