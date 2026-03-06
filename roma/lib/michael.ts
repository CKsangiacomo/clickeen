import { resolveBerlinBaseUrl } from './env/berlin';

type MichaelMemberRow = {
  account_id?: unknown;
  user_id?: unknown;
  role?: unknown;
  created_at?: unknown;
};

type MichaelMembersResult =
  | {
      ok: true;
      rows: MichaelMemberRow[];
    }
  | {
      ok: false;
      status: number;
      reasonKey: string;
      detail?: string;
    };

function resolveMichaelBaseUrl(): string {
  const value = (process.env.SUPABASE_URL || '').trim();
  if (!value) {
    throw new Error('roma.errors.config.supabase_url_missing');
  }
  return value.replace(/\/+$/, '');
}

function resolveMichaelAnonKey(): string {
  const value = (process.env.SUPABASE_ANON_KEY || '').trim();
  if (!value) {
    throw new Error('roma.errors.config.supabase_anon_key_missing');
  }
  return value;
}

function encodeFilterValue(value: string): string {
  return encodeURIComponent(value);
}

async function fetchMichael(pathWithQuery: string, accessToken: string): Promise<Response> {
  const michaelAccess = await resolveMichaelAccessToken(accessToken);
  if (!michaelAccess.ok) {
    throw new Error(`${michaelAccess.status}|${michaelAccess.reasonKey}|${michaelAccess.detail || ''}`);
  }

  const headers = new Headers();
  headers.set('apikey', resolveMichaelAnonKey());
  headers.set('authorization', `Bearer ${michaelAccess.accessToken}`);
  headers.set('accept', 'application/json');

  return fetch(`${resolveMichaelBaseUrl()}${pathWithQuery}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
}

type MichaelAccessResolution =
  | {
      ok: true;
      accessToken: string;
    }
  | {
      ok: false;
      status: number;
      reasonKey: string;
      detail?: string;
    };

async function resolveMichaelAccessToken(berlinAccessToken: string): Promise<MichaelAccessResolution> {
  const berlinBase = resolveBerlinBaseUrl().replace(/\/+$/, '');
  const headers = new Headers();
  headers.set('authorization', `Bearer ${berlinAccessToken}`);
  headers.set('accept', 'application/json');

  try {
    const response = await fetch(`${berlinBase}/auth/michael/token`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    const text = await response.text().catch(() => '');
    const payload = text ? (JSON.parse(text) as unknown) : null;
    if (!response.ok) {
      const reasonKey =
        payload && typeof payload === 'object' && !Array.isArray(payload)
          ? String(((payload as { error?: { reasonKey?: unknown } }).error?.reasonKey as string) || 'coreui.errors.auth.required')
          : 'coreui.errors.auth.required';
      return {
        ok: false,
        status: response.status,
        reasonKey,
        detail: text || undefined,
      };
    }
    const token =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? String((payload as { accessToken?: unknown }).accessToken || '').trim()
        : '';
    if (!token) {
      return {
        ok: false,
        status: 502,
        reasonKey: 'coreui.errors.auth.required',
        detail: 'missing_michael_access_token',
      };
    }
    return { ok: true, accessToken: token };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      reasonKey: 'roma.errors.auth.berlin_unavailable',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function listAccountMembersForAccount(accountId: string, accessToken: string): Promise<MichaelMembersResult> {
  try {
    const response = await fetchMichael(
      `/rest/v1/account_members?select=account_id,user_id,role,created_at&account_id=eq.${encodeFilterValue(accountId)}&order=created_at.asc&limit=500`,
      accessToken,
    );

    const text = await response.text().catch(() => '');
    const payload = text ? (JSON.parse(text) as unknown) : null;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        reasonKey: response.status === 401 ? 'coreui.errors.auth.required' : 'coreui.errors.db.readFailed',
        detail: text || undefined,
      };
    }

    const rows = Array.isArray(payload) ? (payload as MichaelMemberRow[]) : [];
    return { ok: true, rows };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('|')) {
      const [statusRaw, reasonKeyRaw, detailRaw] = message.split('|');
      const status = Number.parseInt(statusRaw || '502', 10);
      const reasonKey = (reasonKeyRaw || '').trim() || 'coreui.errors.db.readFailed';
      return {
        ok: false,
        status: Number.isFinite(status) ? status : 502,
        reasonKey,
        detail: detailRaw || undefined,
      };
    }
    return {
      ok: false,
      status: 502,
      reasonKey: 'roma.errors.proxy.michael_unavailable',
      detail: message,
    };
  }
}

export function readJwtSubject(accessToken: string): string | null {
  const parts = accessToken.split('.');
  if (parts.length !== 3) return null;
  try {
    const payloadPart = parts[1] || '';
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);
    const parsed = JSON.parse(decoded) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const sub = (parsed as { sub?: unknown }).sub;
    if (typeof sub !== 'string') return null;
    const normalizedSub = sub.trim();
    return normalizedSub || null;
  } catch {
    return null;
  }
}
