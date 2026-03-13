import type { Policy } from '@clickeen/ck-policy';
import type { Env } from '../../shared/types';
import { json } from '../../shared/http';
import { ckError, errorDetail } from '../../shared/errors';
import { asTrimmedString } from '../../shared/validation';
import { resolveEditorPolicyFromRequest } from '../../shared/policy';
import { authorizeAccount } from '../../shared/account-auth';
import { isCuratedInstanceRow, resolveInstanceKind } from '../../shared/instances';
import { normalizeSupportedLocaleToken, resolveAccountL10nPolicy } from '../../shared/l10n';
import { loadInstanceByAccountAndPublicId } from '../instances';
import { loadInstanceOverlays } from '../l10n/service';
import { resolveActivePublishLocales } from './service';
import {
  normalizeLocalizationOpsForPayload,
  type AccountLocaleOverlayPayload,
} from './helpers';

type LocalizationPayload = {
  accountLocales: string[];
  invalidAccountLocales: string | null;
  localeOverlays: AccountLocaleOverlayPayload[];
  policy: {
    v: number;
    baseLocale: string;
    ip: {
      enabled: boolean;
      countryToLocale: Record<string, string>;
    };
    switcher: {
      enabled: boolean;
    };
  };
};

export async function loadAccountLocalizationPayload(args: {
  env: Env;
  publicId: string;
  accountLocalesRaw: unknown;
  accountL10nPolicyRaw: unknown;
  policy: Policy;
}): Promise<LocalizationPayload> {
  const accountL10nPolicy = resolveAccountL10nPolicy(args.accountL10nPolicyRaw);
  const baseLocale = accountL10nPolicy.baseLocale;
  const { locales: accountLocales, invalidAccountLocales } = resolveActivePublishLocales({
    accountLocales: args.accountLocalesRaw,
    policy: args.policy,
    baseLocale,
  });

  const overlayRows = await loadInstanceOverlays(args.env, args.publicId);
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

  const localeOverlays: AccountLocaleOverlayPayload[] = Array.from(overlayByLocale.entries())
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

  return {
    accountLocales,
    invalidAccountLocales,
    localeOverlays,
    policy: accountL10nPolicy,
  };
}

export async function handleAccountGetLocalization(
  req: Request,
  env: Env,
  accountId: string,
  publicId: string,
) {
  const authorized = await authorizeAccount(req, env, accountId, 'viewer');
  if (!authorized.ok) return authorized.response;
  const account = authorized.account;

  const policyResult = resolveEditorPolicyFromRequest(req, account, authorized.role);
  if (!policyResult.ok) return policyResult.response;

  const instance = await loadInstanceByAccountAndPublicId(env, accountId, publicId);
  if (!instance) {
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);
  }

  const instanceKind = resolveInstanceKind(instance);
  if (instanceKind === 'curated') {
    if (account.is_platform !== true) {
      return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
    }
    if (isCuratedInstanceRow(instance) && asTrimmedString(instance.owner_account_id) !== accountId) {
      return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
    }
  }

  try {
    const localization = await loadAccountLocalizationPayload({
      env,
      publicId,
      accountLocalesRaw: account.l10n_locales,
      accountL10nPolicyRaw: account.l10n_policy,
      policy: policyResult.policy,
    });
    return json({ localization });
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
}
