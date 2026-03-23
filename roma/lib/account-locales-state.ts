import { parseAccountL10nPolicyStrict, parseAccountLocaleListStrict } from '@clickeen/ck-contracts';
import { resolveBerlinBaseUrl } from './env/berlin';

export async function loadCurrentAccountLocalesState(args: {
  accessToken: string;
  accountId: string;
}): Promise<
  | {
      ok: true;
      locales: string[];
      policy: ReturnType<typeof parseAccountL10nPolicyStrict>;
    }
  | {
      ok: false;
      status: number;
      payload: unknown;
      detail?: string;
    }
> {
  const berlinBase = resolveBerlinBaseUrl().replace(/\/+$/, '');
  const upstream = await fetch(
    `${berlinBase}/v1/accounts/${encodeURIComponent(args.accountId)}`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${args.accessToken}`,
        accept: 'application/json',
      },
      cache: 'no-store',
    },
  );
  const payload = (await upstream.json().catch(() => null)) as
    | {
        account?: {
          l10nLocales?: unknown;
          l10nPolicy?: unknown;
        } | null;
        error?: unknown;
      }
    | null;

  if (!upstream.ok) {
    return {
      ok: false,
      status: upstream.status,
      payload,
      detail: `berlin_account_http_${upstream.status}`,
    };
  }

  return {
    ok: true,
    locales: parseAccountLocaleListStrict(payload?.account?.l10nLocales),
    policy: parseAccountL10nPolicyStrict(payload?.account?.l10nPolicy),
  };
}
