import { readSupabaseAdminJson, supabaseAdminErrorResponse, supabaseAdminFetch } from './supabase-admin';
import { type Env } from './types';

type Result<T> = { ok: true; value: T } | { ok: false; response: Response };

export async function readSupabaseAdminListAll<T>(args: {
  env: Env;
  pathname: string;
  params: URLSearchParams;
  pageSize?: number;
  reasonKey?: string;
}): Promise<Result<T[]>> {
  const pageSize = Math.max(1, Math.min(args.pageSize ?? 200, 1000));
  const reasonKey = args.reasonKey ?? 'coreui.errors.db.readFailed';
  const rows: T[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const pageParams = new URLSearchParams(args.params);
    pageParams.set('limit', String(pageSize));
    pageParams.set('offset', String(offset));

    const response = await supabaseAdminFetch(args.env, `${args.pathname}?${pageParams.toString()}`, {
      method: 'GET',
    });
    const payload = await readSupabaseAdminJson<T[] | Record<string, unknown>>(response);
    if (!response.ok) {
      return {
        ok: false,
        response: supabaseAdminErrorResponse(reasonKey, response.status, payload),
      };
    }

    const pageRows = Array.isArray(payload) ? payload : [];
    rows.push(...pageRows);
    if (pageRows.length < pageSize) break;
  }

  return { ok: true, value: rows };
}
