import { type BerlinAccountContext } from '../bootstrap/types';
import { readSupabaseAdminJson, supabaseAdminErrorResponse, supabaseAdminFetch } from '../supabase-admin';
import { type Env } from '../types';

type Result<T> = { ok: true; value: T } | { ok: false; response: Response };

type PublishContainmentRow = {
  account_id?: unknown;
  reason?: unknown;
};

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function dbReadFailure(response: Response, payload: unknown): Response {
  return supabaseAdminErrorResponse('coreui.errors.db.readFailed', response.status, payload);
}

export async function loadAccountPublishContainment(args: {
  env: Env;
  account: BerlinAccountContext;
}): Promise<Result<{ active: boolean; reason: string | null }>> {
  const params = new URLSearchParams({
    select: 'account_id,reason',
    account_id: `eq.${args.account.accountId}`,
    limit: '1',
  });
  const response = await supabaseAdminFetch(args.env, `/rest/v1/account_publish_containment?${params.toString()}`, {
    method: 'GET',
  });
  const payload = await readSupabaseAdminJson<PublishContainmentRow[] | Record<string, unknown>>(response);
  if (!response.ok) return { ok: false, response: dbReadFailure(response, payload) };

  const rows = Array.isArray(payload) ? payload : [];
  const row = rows[0] ?? null;
  return {
    ok: true,
    value: {
      active: Boolean(asTrimmedString(row?.account_id)),
      reason: asTrimmedString(row?.reason),
    },
  };
}
