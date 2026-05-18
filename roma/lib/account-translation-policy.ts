import { normalizeDesiredAccountLocales } from './account-locales';
import { loadCurrentAccountLocalesState } from './account-locales-state';

export type AccountTranslationLanguagePolicy = {
  baseLocale: string;
  desiredLocales: string[];
  countryToLocale: Record<string, string>;
};

export async function loadAccountTranslationLanguagePolicy(args: {
  accessToken: string;
  accountId: string;
  requestId?: string | null;
}): Promise<
  | { ok: true; value: AccountTranslationLanguagePolicy }
  | {
      ok: false;
      status: number;
      error: {
        kind: 'AUTH' | 'DENY' | 'UPSTREAM_UNAVAILABLE';
        reasonKey: string;
        detail?: string;
      };
    }
> {
  const state = await loadCurrentAccountLocalesState(args);
  if (!state.ok) {
    const status = state.status === 401 ? 401 : state.status === 403 ? 403 : 502;
    return {
      ok: false,
      status,
      error: {
        kind:
          status === 401
            ? 'AUTH'
            : status === 403
              ? 'DENY'
              : 'UPSTREAM_UNAVAILABLE',
        reasonKey:
          status === 401
            ? 'coreui.errors.auth.required'
            : status === 403
              ? 'coreui.errors.auth.forbidden'
              : 'coreui.errors.auth.contextUnavailable',
        detail: state.detail || `berlin_account_http_${state.status}`,
      },
    };
  }

  return {
    ok: true,
    value: {
      baseLocale: state.policy.baseLocale,
      desiredLocales: normalizeDesiredAccountLocales({
        baseLocale: state.policy.baseLocale,
        locales: state.locales,
      }),
      countryToLocale: state.policy.ip.countryToLocale,
    },
  };
}
