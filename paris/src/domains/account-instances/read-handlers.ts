import { computeBaseFingerprint } from '@clickeen/l10n';
import type { Env } from '../../shared/types';
import { json } from '../../shared/http';
import { ckError, errorDetail } from '../../shared/errors';
import { assertConfig } from '../../shared/validation';
import { resolveEditorPolicyFromRequest } from '../../shared/policy';
import { authorizeAccount } from '../../shared/account-auth';
import { isCuratedInstanceRow, resolveInstanceKind } from '../../shared/instances';
import { resolveAdminAccountId } from '../../shared/admin';
import { normalizeSupportedLocaleToken, resolveAccountL10nPolicy } from '../../shared/l10n';
import { loadInstanceByAccountAndPublicId, resolveWidgetTypeForInstance } from '../instances';
import { loadInstanceOverlays } from '../l10n/service';
import { resolveActivePublishLocales } from './service';
import {
  normalizeLocalizationOpsForPayload,
  resolveAccountInstanceDisplayName,
  validateAccountInstanceEnvelope,
  type AccountInstanceEnvelope,
  type AccountLocaleOverlayPayload,
} from './helpers';

export async function handleAccountGetInstance(
  req: Request,
  env: Env,
  accountId: string,
  publicId: string,
) {
  const authorized = await authorizeAccount(req, env, accountId, 'viewer');
  if (!authorized.ok) return authorized.response;
  const account = authorized.account;

  const policyResult = resolveEditorPolicyFromRequest(req, account);
  if (!policyResult.ok) return policyResult.response;

  const instance = await loadInstanceByAccountAndPublicId(env, accountId, publicId);
  if (!instance)
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);
  const configResult = assertConfig(instance.config);
  if (!configResult.ok) {
    return ckError(
      {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.payload.invalid',
        detail: `Invalid persisted instance config for ${String(instance.public_id || 'unknown')}: ${configResult.issues[0]?.message || 'invalid config'}`,
      },
      500,
    );
  }
  const instanceKind = resolveInstanceKind(instance);
  if (instanceKind === 'curated') {
    const adminAccountId = resolveAdminAccountId(env);
    if (accountId !== adminAccountId) {
      return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
    }
  }

  const widgetType = await resolveWidgetTypeForInstance(env, instance);
  if (!widgetType)
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.instance.widgetMissing' }, 500);

  const baseFingerprint = await computeBaseFingerprint(instance.config);
  const accountL10nPolicy = resolveAccountL10nPolicy(account.l10n_policy);
  const baseLocale = accountL10nPolicy.baseLocale;
  const { locales: accountLocales, invalidAccountLocales } = resolveActivePublishLocales(
    {
      accountLocales: account.l10n_locales,
      policy: policyResult.policy,
      baseLocale,
    },
  );

  let localeOverlays: AccountLocaleOverlayPayload[] = [];
  try {
    const overlayRows = await loadInstanceOverlays(env, publicId);
    const overlayByLocale = new Map<
      string,
      { localeRow: (typeof overlayRows)[number] | null; userRow: (typeof overlayRows)[number] | null }
    >();

    overlayRows.forEach((row) => {
      const locale = normalizeSupportedLocaleToken(row.layer_key);
      if (!locale) return;
      if (row.layer !== 'locale' && row.layer !== 'user') return;
      const current = overlayByLocale.get(locale) ?? { localeRow: null, userRow: null };
      if (row.layer === 'locale') current.localeRow = row;
      if (row.layer === 'user') current.userRow = row;
      overlayByLocale.set(locale, current);
    });

    localeOverlays = Array.from(overlayByLocale.entries())
      .map(([locale, entry]) => {
        const localeRow = entry.localeRow;
        const userRow = entry.userRow;
        const baseOps = normalizeLocalizationOpsForPayload(localeRow?.ops);
        const userOps =
          userRow != null
            ? normalizeLocalizationOpsForPayload(userRow.ops)
            : normalizeLocalizationOpsForPayload(localeRow?.user_ops);
        return {
          locale,
          source:
            typeof localeRow?.source === 'string'
              ? localeRow.source
              : typeof userRow?.source === 'string'
                ? userRow.source
                : null,
          baseFingerprint:
            typeof localeRow?.base_fingerprint === 'string'
              ? localeRow.base_fingerprint
              : typeof userRow?.base_fingerprint === 'string'
                ? userRow.base_fingerprint
                : null,
          baseUpdatedAt:
            typeof localeRow?.base_updated_at === 'string'
              ? localeRow.base_updated_at
              : typeof userRow?.base_updated_at === 'string'
                ? userRow.base_updated_at
                : null,
          hasUserOps: userOps.length > 0,
          baseOps,
          userOps,
        };
      })
      .sort((a, b) => a.locale.localeCompare(b.locale));
  } catch (error) {
    const detail = errorDetail(error);
    return ckError(
      {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.db.readFailed',
        detail,
      },
      500,
    );
  }

  const envelope: AccountInstanceEnvelope = {
    publicId: instance.public_id,
    displayName: resolveAccountInstanceDisplayName(instance),
    ownerAccountId: account.id,
    status: instance.status,
    widgetType,
    config: instance.config,
    meta: isCuratedInstanceRow(instance) ? (instance.meta ?? null) : null,
    updatedAt: instance.updated_at ?? null,
    baseFingerprint,
    policy: policyResult.policy,
    account: {
      id: account.id,
      tier: account.tier,
      websiteUrl: account.website_url,
    },
    localization: {
      accountLocales,
      invalidAccountLocales,
      localeOverlays,
      policy: accountL10nPolicy,
    },
  };
  const envelopeError = validateAccountInstanceEnvelope(envelope);
  if (envelopeError) {
    return ckError(
      {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.payload.invalid',
        detail: `Invalid InstanceEnvelope: ${envelopeError}`,
      },
      500,
    );
  }
  return json(envelope);
}
