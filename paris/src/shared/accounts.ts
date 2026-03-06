import type { AccountRow, Env } from './types';
import { supabaseFetch } from './supabase';
import { readJson } from './http';
import { ckError, errorDetail } from './errors';

export async function loadAccountById(env: Env, accountId: string): Promise<AccountRow | null> {
  const params = new URLSearchParams({
    select: 'id,status,is_platform,tier,name,slug,website_url,l10n_locales,l10n_policy',
    id: `eq.${accountId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/accounts?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load account (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = (await res.json()) as AccountRow[];
  return rows?.[0] ?? null;
}

export async function requireAccount(env: Env, accountId: string) {
  try {
    const account = await loadAccountById(env, accountId);
    if (!account) {
      return { ok: false as const, response: ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.notFound' }, 404) };
    }
    return { ok: true as const, account };
  } catch (error) {
    const detail = errorDetail(error);
    return {
      ok: false as const,
      response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500),
    };
  }
}
