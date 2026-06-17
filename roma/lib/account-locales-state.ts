import { CK_REQUEST_ID_HEADER, parseAccountLocaleListStrict, parseAccountLocalePolicyStrict } from '@clickeen/ck-contracts';
import { resolveBerlinBaseUrl } from './env/berlin';

// Berlin supplies read-only account context through authenticated bootstrap.
// Roma owns account-settings mutation and passes locale intent downstream.
export async function loadCurrentAccountLocalesState(args: {
  accessToken: string;
  accountId: string;
  requestId?: string | null;
}): Promise<
  | {
      ok: true;
      selectedTargetLocales: string[];
      localePolicy: ReturnType<typeof parseAccountLocalePolicyStrict>;
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
        ...(args.requestId ? { [CK_REQUEST_ID_HEADER]: args.requestId } : {}),
      },
      cache: 'no-store',
    },
  );
  const payload = (await upstream.json().catch(() => null)) as
    | {
        account?: {
          selectedTargetLocales?: unknown;
          localePolicy?: unknown;
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
    selectedTargetLocales: parseAccountLocaleListStrict(payload?.account?.selectedTargetLocales),
    localePolicy: parseAccountLocalePolicyStrict(payload?.account?.localePolicy),
  };
}
