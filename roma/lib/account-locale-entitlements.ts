import { NextResponse } from 'next/server';
import type { resolvePolicy } from '@clickeen/ck-policy';

export function resolveTranslatedLocaleEntitlementMax(policy: ReturnType<typeof resolvePolicy>): number | null {
  const raw = policy.limits['l10n.locales.max'];
  return raw == null ? null : Math.max(0, Math.floor(raw));
}

export function enforceActiveLocaleEntitlement(policy: ReturnType<typeof resolvePolicy>, activeLocales: string[]): NextResponse | null {
  const maxTranslatedLocales = resolveTranslatedLocaleEntitlementMax(policy);
  if (maxTranslatedLocales != null && activeLocales.length > maxTranslatedLocales) {
    return NextResponse.json(
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
