import {
  parseAccountLocalePolicyStrict,
  parseAccountLocaleListStrict,
  type AccountLocalePolicy,
  validateAccountLocalePolicy,
  validateAccountLocaleList,
} from '@clickeen/ck-contracts';
import { resolvePolicy, type Policy } from '@clickeen/ck-policy';
import type { BerlinAccountContext } from '../bootstrap/types';
import { json, validationError } from '../http';
import { readSupabaseAdminJson, supabaseAdminErrorResponse, supabaseAdminFetch } from '../supabase-admin';
import { type Env } from '../types';

type LocaleMutationResult =
  | { ok: true; warnings: string[] }
  | { ok: false; response: Response };

const DEFAULT_ACCOUNT_LOCALE_POLICY: AccountLocalePolicy = {
  v: 1,
  baseLocale: 'en',
  ip: { countryToLocale: {} },
};

function canManageAccountLocales(role: BerlinAccountContext['role']): boolean {
  return role === 'owner' || role === 'admin';
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function resolveLocaleList(
  value: unknown,
  path: string,
): { ok: true; locales: string[] } | { ok: false; issues: Array<{ path: string; message: string }> } {
  const issues = validateAccountLocaleList(value, path, { allowNull: true });
  if (issues.length) return { ok: false, issues };
  if (value == null) return { ok: true, locales: [] };
  return { ok: true, locales: parseAccountLocaleListStrict(value) };
}

function resolveAccountLocalePolicy(raw: unknown): AccountLocalePolicy {
  try {
    return parseAccountLocalePolicyStrict(raw);
  } catch {
    return DEFAULT_ACCOUNT_LOCALE_POLICY;
  }
}

function resolveTranslatedLocaleEntitlementMax(policy: Policy): number | null {
  const raw = policy.limits['l10n.locales.max'];
  return raw == null ? null : Math.max(0, Math.floor(raw));
}

function enforceLocaleSelection(policy: Policy, locales: string[]): Response | null {
  const maxTranslatedLocales = resolveTranslatedLocaleEntitlementMax(policy);
  if (maxTranslatedLocales != null && locales.length > maxTranslatedLocales) {
    return json(
      {
        error: {
          kind: 'DENY',
          reasonKey: 'coreui.upsell.reason.limitReached',
          upsell: 'UP',
          detail: `l10n.locales.max=${maxTranslatedLocales}`,
        },
      },
      { status: 403 },
    );
  }

  return null;
}

async function patchAccountLocales(args: {
  env: Env;
  accountId: string;
  selectedTargetLocales: string[];
  nextPolicy: AccountLocalePolicy | null;
}): Promise<LocaleMutationResult> {
  const params = new URLSearchParams({ id: `eq.${args.accountId}` });
  const response = await supabaseAdminFetch(args.env, `/rest/v1/accounts?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      selected_target_locales: args.selectedTargetLocales,
      locale_policy: args.nextPolicy,
    }),
  });
  const payload = await readSupabaseAdminJson<Array<{ id?: unknown }> | Record<string, unknown>>(response);
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload),
    };
  }
  const rows = Array.isArray(payload) ? payload : [];
  if (!rows[0]?.id) {
    return {
      ok: false,
      response: json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.notFound' } }, { status: 404 }),
    };
  }
  return { ok: true, warnings: [] };
}

export async function handleAccountLocalesUpdate(args: {
  request: Request;
  env: Env;
  account: BerlinAccountContext;
}): Promise<Response> {
  if (!canManageAccountLocales(args.account.role)) {
    return json({ error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } }, { status: 403 });
  }

  let payload: unknown = null;
  try {
    payload = await args.request.json();
  } catch {
    return validationError('coreui.errors.payload.invalidJson');
  }
  if (!isPlainRecord(payload)) {
    return validationError('coreui.errors.payload.invalid');
  }

  const localesResult = resolveLocaleList((payload as { selectedTargetLocales?: unknown }).selectedTargetLocales, 'selectedTargetLocales');
  if (!localesResult.ok) {
    return json(localesResult.issues, { status: 422 });
  }

  const policy = resolvePolicy({ profile: args.account.tier, role: args.account.role });
  const entitlementGate = enforceLocaleSelection(policy, localesResult.locales);
  if (entitlementGate) return entitlementGate;

  let nextPolicyPersisted: unknown = args.account.localePolicy;
  if (Object.prototype.hasOwnProperty.call(payload, 'localePolicy')) {
    const policyRaw = (payload as { localePolicy?: unknown }).localePolicy;
    if (policyRaw != null) {
      const issues = validateAccountLocalePolicy(policyRaw, 'localePolicy');
      if (issues.length) return json(issues, { status: 422 });
      nextPolicyPersisted = parseAccountLocalePolicyStrict(policyRaw);
    } else {
      nextPolicyPersisted = null;
    }
  }

  const previousLocales = resolveLocaleList(args.account.selectedTargetLocales, 'selectedTargetLocales');
  if (!previousLocales.ok) {
    return json(
      {
        error: {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.account.locales.invalid',
          detail: JSON.stringify(previousLocales.issues),
        },
      },
      { status: 500 },
    );
  }

  const nextPolicy = resolveAccountLocalePolicy(nextPolicyPersisted);
  const patched = await patchAccountLocales({
    env: args.env,
    accountId: args.account.accountId,
    selectedTargetLocales: localesResult.locales,
    nextPolicy: nextPolicyPersisted as AccountLocalePolicy | null,
  });
  if (!patched.ok) return patched.response;

  const warnings = [...patched.warnings];

  return json({
    accountId: args.account.accountId,
    selectedTargetLocales: localesResult.locales,
    localePolicy: nextPolicy,
    warnings: warnings.length ? warnings : undefined,
  });
}
