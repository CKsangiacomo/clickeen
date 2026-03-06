import { resolveBerlinBaseUrl } from './env/berlin';

type MichaelAccountRow = {
  id?: unknown;
  l10n_locales?: unknown;
  l10n_policy?: unknown;
};

type MichaelAccountLocalesResult =
  | {
      ok: true;
      row: MichaelAccountRow | null;
    }
  | {
      ok: false;
      status: number;
      reasonKey: string;
      detail?: string;
    };

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

function resolveMichaelBaseUrl(): string {
  const value = (process.env.SUPABASE_URL || '').trim();
  if (!value) {
    throw new Error('bob.errors.config.supabase_url_missing');
  }
  return value.replace(/\/+$/, '');
}

function resolveMichaelAnonKey(): string {
  const value = (process.env.SUPABASE_ANON_KEY || '').trim();
  if (!value) {
    throw new Error('bob.errors.config.supabase_anon_key_missing');
  }
  return value;
}

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
      reasonKey: 'bob.errors.auth.berlin_unavailable',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

function encodeFilterValue(value: string): string {
  return encodeURIComponent(value);
}

export async function getAccountLocalesRow(accountId: string, berlinAccessToken: string): Promise<MichaelAccountLocalesResult> {
  try {
    const michaelAccess = await resolveMichaelAccessToken(berlinAccessToken);
    if (!michaelAccess.ok) {
      return michaelAccess;
    }

    const headers = new Headers();
    headers.set('apikey', resolveMichaelAnonKey());
    headers.set('authorization', `Bearer ${michaelAccess.accessToken}`);
    headers.set('accept', 'application/json');

    const response = await fetch(
      `${resolveMichaelBaseUrl()}/rest/v1/accounts?select=id,l10n_locales,l10n_policy&id=eq.${encodeFilterValue(accountId)}&limit=1`,
      {
        method: 'GET',
        headers,
        cache: 'no-store',
      },
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

    const rows = Array.isArray(payload) ? (payload as MichaelAccountRow[]) : [];
    return { ok: true, row: rows[0] || null };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      reasonKey: 'bob.errors.proxy.michael_unavailable',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
