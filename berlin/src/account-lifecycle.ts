import { json } from './http';
import { readSupabaseAdminJson, supabaseAdminErrorResponse, supabaseAdminFetch } from './supabase-admin';
import { type Env } from './types';

type Result<T> = { ok: true; value: T } | { ok: false; response: Response };

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

async function patchAccount(
  env: Env,
  accountId: string,
  body: Record<string, unknown>,
): Promise<Result<void>> {
  const params = new URLSearchParams({ id: `eq.${accountId}` });
  const response = await supabaseAdminFetch(env, `/rest/v1/accounts?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  const payload = await readSupabaseAdminJson<Array<{ id?: unknown }> | Record<string, unknown>>(response);
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload),
    };
  }
  const rows = Array.isArray(payload) ? payload : [];
  if (!asTrimmedString(rows[0]?.id)) {
    return {
      ok: false,
      response: json(
        { error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.notFound' } },
        { status: 404 },
      ),
    };
  }
  return { ok: true, value: undefined };
}

export async function handleAccountTierDropDismiss(args: {
  env: Env;
  accountId: string;
}): Promise<Response> {
  const dismissed = await patchAccount(args.env, args.accountId, {
    tier_drop_dismissed_at: new Date().toISOString(),
  });
  if (!dismissed.ok) return dismissed.response;

  return json({
    ok: true,
    accountId: args.accountId,
    kind: 'tier_drop',
  });
}
