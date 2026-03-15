import { evaluateLimits } from '@clickeen/ck-policy';
import type { LimitsSpec, Policy } from '@clickeen/ck-policy';
import type { CuratedInstanceRow, Env, InstanceRow } from '../../shared/types';
import { ckError, errorDetail } from '../../shared/errors';
import { readJson } from '../../shared/http';
import { supabaseFetch } from '../../shared/supabase';
import { readCuratedMeta } from '../../shared/curated-meta';
import { loadWidgetLimits } from '../../shared/tokyo';
import {
  AssetUsageValidationError,
  validateAccountAssetUsageForInstance,
} from '../../shared/assetUsage';
import {
  inferInstanceKindFromPublicId,
  resolveCuratedRowKind,
} from '../../shared/instances';
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

export async function rollbackCreatedInstanceAfterPostCommitFailure(args: {
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
      `[ParisWorker] Failed to rollback created instance after post-commit failure (${res.status}): ${JSON.stringify(details)}`,
    );
  }
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
