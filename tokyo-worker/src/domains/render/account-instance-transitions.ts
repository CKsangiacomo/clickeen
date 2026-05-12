import { resolvePolicyFromEntitlementsSnapshot, type RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';
import faqSpec from '../../../../tokyo/product/widgets/faq/spec.json';
import countdownSpec from '../../../../tokyo/product/widgets/countdown/spec.json';
import logoShowcaseSpec from '../../../../tokyo/product/widgets/logoshowcase/spec.json';
import type { Env } from '../../types';
import {
  enqueueAccountInstanceSyncJob,
  syncAccountInstanceAndRecordStatus,
  type SyncL10nIntent,
} from '../account-instance-sync';
import { readAccountInstanceIndex } from './instance-index';
import { syncLiveSurface } from './live-surface';
import {
  readInstanceServeState,
  readSavedRenderConfig,
  writeSavedRenderConfig,
} from './saved-config';
import type { InstanceServeState, SavedRenderPointer } from './types';
import { normalizeStorageId } from './utils';

export class AccountInstanceTransitionError extends Error {
  status: number;
  kind: 'VALIDATION' | 'DENY' | 'NOT_FOUND' | 'UPSTREAM_UNAVAILABLE';
  reasonKey: string;

  constructor(args: {
    status: number;
    kind: AccountInstanceTransitionError['kind'];
    reasonKey: string;
    detail?: string;
  }) {
    super(args.detail ?? args.reasonKey);
    this.name = 'AccountInstanceTransitionError';
    this.status = args.status;
    this.kind = args.kind;
    this.reasonKey = args.reasonKey;
  }
}

type AccountAuthzSnapshot = Pick<
  RomaAccountAuthzCapsulePayload,
  'profile' | 'role' | 'entitlements'
>;

type WidgetSpecWithDefaults = {
  defaults?: unknown;
};

const WIDGET_SPECS: Record<string, WidgetSpecWithDefaults> = {
  faq: faqSpec,
  countdown: countdownSpec,
  logoshowcase: logoShowcaseSpec,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertScopedIds(accountIdRaw: string, instanceIdRaw: string): {
  accountId: string;
  instanceId: string;
} {
  const accountId = normalizeStorageId(accountIdRaw);
  const instanceId = normalizeStorageId(instanceIdRaw);
  if (!accountId || !instanceId) {
    throw new AccountInstanceTransitionError({
      status: 422,
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.render.invalid',
    });
  }
  return { accountId, instanceId };
}

function transitionFailureFromSavedRead(result: { kind: 'NOT_FOUND' | 'VALIDATION'; reasonKey: string }): never {
  if (result.kind === 'NOT_FOUND') {
    throw new AccountInstanceTransitionError({
      status: 404,
      kind: 'NOT_FOUND',
      reasonKey: 'coreui.errors.instance.notFound',
      detail: result.reasonKey,
    });
  }
  throw new AccountInstanceTransitionError({
    status: 422,
    kind: 'VALIDATION',
    reasonKey: result.reasonKey,
  });
}

function toTranslationFollowup(error: unknown):
  | { ok: true }
  | { ok: false; reasonKey: string; detail: string; status: number } {
  if (!error) return { ok: true };
  const detail = error instanceof Error ? error.message : String(error);
  return {
    ok: false,
    reasonKey: 'coreui.errors.translations.acceptanceFailed',
    detail,
    status: detail === 'tokyo_saved_not_found' ? 404 : 502,
  };
}

function mintAccountInstanceId(): string {
  return `ins_${crypto.randomUUID()}`;
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return typeof structuredClone === 'function'
    ? (structuredClone(value) as Record<string, unknown>)
    : (JSON.parse(JSON.stringify(value)) as Record<string, unknown>);
}

function normalizeDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 120 ? trimmed : null;
}

function resolveWidgetDefaults(widgetType: string): Record<string, unknown> | null {
  const spec = WIDGET_SPECS[widgetType];
  return spec && isRecord(spec.defaults) ? cloneRecord(spec.defaults) : null;
}

async function enqueueTranslationFollowup(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  live: boolean;
  baseFingerprint?: string | null;
  previousBaseFingerprint?: string | null;
  accountAuthz: AccountAuthzSnapshot;
  l10nIntent: SyncL10nIntent;
}): Promise<ReturnType<typeof toTranslationFollowup>> {
  try {
    await enqueueAccountInstanceSyncJob(args);
    return { ok: true };
  } catch (error) {
    return toTranslationFollowup(error);
  }
}

export async function createAccountInstanceFromDefaults(args: {
  env: Env;
  accountId: string;
  widgetType: string;
  displayName?: unknown;
  l10n?: {
    summary?: {
      baseLocale: string;
      desiredLocales: string[];
    } | null;
  } | null;
}): Promise<{ pointer: SavedRenderPointer; config: Record<string, unknown> }> {
  const accountId = normalizeStorageId(args.accountId);
  const widgetType = normalizeStorageId(args.widgetType);
  if (!accountId || !widgetType) {
    throw new Error('tokyo.errors.render.invalid');
  }

  const config = resolveWidgetDefaults(widgetType);
  if (!config) {
    throw new Error('tokyo.errors.widget.unsupported');
  }

  const saved = await writeSavedRenderConfig({
    env: args.env,
    accountId,
    instanceId: mintAccountInstanceId(),
    widgetType,
    config,
    displayName: normalizeDisplayName(args.displayName),
    meta: null,
    ...(args.l10n !== undefined ? { l10n: args.l10n } : {}),
  });

  return { pointer: saved.pointer, config };
}

export async function saveAccountInstanceTransition(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  submittedWidgetType: string;
  config: Record<string, unknown>;
  displayName?: unknown;
  hasDisplayName: boolean;
  meta?: unknown;
  hasMeta: boolean;
  l10nIntent: SyncL10nIntent;
  accountAuthz: AccountAuthzSnapshot;
}): Promise<{
  ok: true;
  pointer: SavedRenderPointer;
  live: boolean;
  previousBaseFingerprint: string | null;
  translationFollowup: ReturnType<typeof toTranslationFollowup>;
}> {
  const { accountId, instanceId } = assertScopedIds(args.accountId, args.instanceId);
  const submittedWidgetType = String(args.submittedWidgetType || '').trim();
  if (!submittedWidgetType) {
    throw new AccountInstanceTransitionError({
      status: 422,
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.render.invalid',
    });
  }

  const existing = await readSavedRenderConfig({ env: args.env, accountId, instanceId });
  if (!existing.ok) transitionFailureFromSavedRead(existing);
  const existingWidgetType = existing.value.pointer.widgetType;
  if (submittedWidgetType !== existingWidgetType) {
    throw new AccountInstanceTransitionError({
      status: 422,
      kind: 'VALIDATION',
      reasonKey: 'coreui.errors.instance.widgetMismatch',
      detail: `submitted widgetType "${submittedWidgetType}" does not match Tokyo instance widgetType "${existingWidgetType}"`,
    });
  }

  const saved = await writeSavedRenderConfig({
    env: args.env,
    accountId,
    instanceId,
    widgetType: existingWidgetType,
    config: args.config,
    displayName: args.hasDisplayName ? args.displayName : existing.value.pointer.displayName,
    meta: args.hasMeta ? args.meta : existing.value.pointer.meta ?? null,
    l10n: {
      summary: {
        baseLocale: args.l10nIntent.baseLocale,
        desiredLocales: args.l10nIntent.desiredLocales,
      },
    },
  });
  const live = (await readInstanceServeState({ env: args.env, accountId, instanceId })) === 'published';
  const translationFollowup = await enqueueTranslationFollowup({
    env: args.env,
    accountId,
    instanceId,
    live,
    baseFingerprint: saved.pointer.l10n?.baseFingerprint ?? null,
    previousBaseFingerprint: saved.previousBaseFingerprint,
    accountAuthz: args.accountAuthz,
    l10nIntent: args.l10nIntent,
  });

  return {
    ok: true,
    pointer: saved.pointer,
    live,
    previousBaseFingerprint: saved.previousBaseFingerprint,
    translationFollowup,
  };
}

export async function duplicateAccountInstanceTransition(args: {
  env: Env;
  accountId: string;
  sourceInstanceId: string;
  l10nIntent: SyncL10nIntent;
  accountAuthz: AccountAuthzSnapshot;
}): Promise<{
  accountId: string;
  sourceInstanceId: string;
  instanceId: string;
  widgetType: string;
  status: InstanceServeState;
  translationFollowup: ReturnType<typeof toTranslationFollowup>;
}> {
  const { accountId, instanceId: sourceInstanceId } = assertScopedIds(args.accountId, args.sourceInstanceId);
  const source = await readSavedRenderConfig({
    env: args.env,
    accountId,
    instanceId: sourceInstanceId,
  });
  if (!source.ok) transitionFailureFromSavedRead(source);

  const instanceId = mintAccountInstanceId();
  const saved = await writeSavedRenderConfig({
    env: args.env,
    accountId,
    instanceId,
    widgetType: source.value.pointer.widgetType,
    config: source.value.config,
    displayName: null,
    meta: null,
    l10n: {
      summary: {
        baseLocale: args.l10nIntent.baseLocale,
        desiredLocales: args.l10nIntent.desiredLocales,
      },
    },
  });

  const translationFollowup = await enqueueTranslationFollowup({
    env: args.env,
    accountId,
    instanceId,
    live: false,
    baseFingerprint: saved.pointer.l10n?.baseFingerprint ?? null,
    previousBaseFingerprint: saved.previousBaseFingerprint,
    accountAuthz: args.accountAuthz,
    l10nIntent: args.l10nIntent,
  });

  return {
    accountId,
    sourceInstanceId,
    instanceId,
    widgetType: source.value.pointer.widgetType,
    status: 'unpublished',
    translationFollowup,
  };
}

export async function publishAccountInstanceTransition(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  accountAuthz: AccountAuthzSnapshot;
  l10nIntent: SyncL10nIntent;
}): Promise<{ instanceId: string; status: 'published'; changed: boolean }> {
  const { accountId, instanceId } = assertScopedIds(args.accountId, args.instanceId);
  const existing = await readSavedRenderConfig({ env: args.env, accountId, instanceId });
  if (!existing.ok) transitionFailureFromSavedRead(existing);
  const liveStatus = await readInstanceServeState({ env: args.env, accountId, instanceId });
  if (liveStatus === 'published') {
    return { instanceId, status: 'published', changed: false };
  }

  const policy = resolvePolicyFromEntitlementsSnapshot({
    profile: args.accountAuthz.profile,
    role: args.accountAuthz.role,
    entitlements: args.accountAuthz.entitlements ?? null,
  });
  const publishedLimitRaw = policy.limits['instances.published.max'];
  const publishedLimit =
    typeof publishedLimitRaw === 'number' && Number.isFinite(publishedLimitRaw)
      ? Math.max(0, Math.floor(publishedLimitRaw))
      : null;
  if (publishedLimit != null) {
    if (publishedLimit === 0) {
      throw new AccountInstanceTransitionError({
        status: 403,
        kind: 'DENY',
        reasonKey: 'coreui.upsell.reason.limitReached',
        detail: `instances.published.max=${publishedLimit}`,
      });
    }
    const index = await readAccountInstanceIndex({
      env: args.env,
      accountId,
    });
    if (!index.ok) {
      throw new AccountInstanceTransitionError({
        status: index.kind === 'NOT_FOUND' ? 404 : 422,
        kind: index.kind === 'NOT_FOUND' ? 'NOT_FOUND' : 'VALIDATION',
        reasonKey: index.reasonKey,
        detail: index.detail,
      });
    }
    const publishedCount = index.value.entries.filter((entry) => entry.publishStatus === 'published').length;
    if (publishedCount >= publishedLimit) {
      throw new AccountInstanceTransitionError({
        status: 403,
        kind: 'DENY',
        reasonKey: 'coreui.upsell.reason.limitReached',
        detail: `instances.published.max=${publishedLimit}`,
      });
    }
  }

  await syncAccountInstanceAndRecordStatus({
    env: args.env,
    accountId,
    instanceId,
    live: true,
    accountAuthz: args.accountAuthz,
    l10nIntent: args.l10nIntent,
  });
  return { instanceId, status: 'published', changed: true };
}

export async function unpublishAccountInstanceTransition(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<{ instanceId: string; status: 'unpublished'; changed: boolean }> {
  const { accountId, instanceId } = assertScopedIds(args.accountId, args.instanceId);
  const existing = await readSavedRenderConfig({ env: args.env, accountId, instanceId });
  if (!existing.ok) transitionFailureFromSavedRead(existing);
  const liveStatus = await readInstanceServeState({ env: args.env, accountId, instanceId });
  if (liveStatus === 'unpublished') {
    return { instanceId, status: 'unpublished', changed: false };
  }
  await syncLiveSurface(args.env, {
    v: 1,
    kind: 'sync-live-surface',
    accountId,
    instanceId,
    live: false,
    widgetType: existing.value.pointer.widgetType,
  });
  return { instanceId, status: 'unpublished', changed: true };
}
