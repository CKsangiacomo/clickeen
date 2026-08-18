import { CK_REQUEST_ID_HEADER, type AccountLocalePolicy } from '@clickeen/ck-contracts';
import { resolveBerlinBaseUrl } from './env/berlin';

type BerlinAccountLocalesPayload = {
  account: {
    activeLocales: string[];
    localePolicy: AccountLocalePolicy;
  };
};

// Berlin supplies read-only account context through authenticated bootstrap.
// Roma owns account-settings mutation and passes locale intent downstream.
export async function loadCurrentAccountLocalesState(args: {
  accessToken: string;
  accountId: string;
  requestId?: string | null;
}): Promise<
  | {
      ok: true;
      activeLocales: string[];
      localePolicy: AccountLocalePolicy;
    }
  | {
      ok: false;
      status: number;
      payload: unknown;
    }
> {
  const berlinBase = resolveBerlinBaseUrl().replace(/\/+$/, '');
  const upstream = await fetch(
    `${berlinBase}/accounts/${encodeURIComponent(args.accountId)}`,
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
  if (!upstream.ok) {
    const payload = await upstream.json();
    return {
      ok: false,
      status: upstream.status,
      payload,
    };
  }

  const payload = await upstream.json() as BerlinAccountLocalesPayload;

  return {
    ok: true,
    activeLocales: payload.account.activeLocales,
    localePolicy: payload.account.localePolicy,
  };
}
