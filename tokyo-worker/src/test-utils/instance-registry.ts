import type { Env } from '../types';

type InstanceRow = {
  id: string;
  account_id: string;
  widget_type: string;
  publish_status: 'published' | 'unpublished';
  translation_status: 'idle' | 'queued' | 'running' | 'failed';
  created_at: string;
  edited_at: string;
};

type TranslationOperationRow = {
  id: string;
  account_public_id: string;
  instance_id: string;
  base_locale: string;
  target_locales: unknown;
  base_content_marker: string;
  generation_request_marker: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'timed_out';
  requested_at: string;
  updated_at: string;
  expires_at: string;
  reason_key?: string | null;
  detail?: string | null;
};

type TranslationOperationLocaleRow = {
  operation_id: string;
  locale: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'stale';
  enqueue_status: 'pending' | 'sent' | 'failed';
  job_id?: string | null;
  base_content_marker: string;
  requested_at: string;
  updated_at: string;
  completed_at?: string | null;
  reason_key?: string | null;
  detail?: string | null;
};

type TestSupabaseStore = {
  instances: Map<string, InstanceRow>;
  operations: Map<string, TranslationOperationRow>;
  operationLocales: Map<string, TranslationOperationLocaleRow>;
};

const stores = new Map<string, Map<string, InstanceRow>>();
const supabaseStores = new Map<string, TestSupabaseStore>();
let installed = false;
let previousFetch: typeof fetch | null = null;

function rowKey(accountId: string, instanceId: string): string {
  return `${accountId}/${instanceId}`;
}

function findStore(url: string): { baseUrl: string; rows: Map<string, InstanceRow> } | null {
  for (const [baseUrl, store] of supabaseStores) {
    if (url.startsWith(`${baseUrl}/rest/v1/instances`)) return { baseUrl, rows: store.instances };
  }
  return null;
}

function findSupabaseStore(url: string): { baseUrl: string; store: TestSupabaseStore; table: 'operations' | 'operationLocales' } | null {
  for (const [baseUrl, store] of supabaseStores) {
    if (url.startsWith(`${baseUrl}/rest/v1/translation_generation_operations`)) {
      return { baseUrl, store, table: 'operations' };
    }
    if (url.startsWith(`${baseUrl}/rest/v1/translation_generation_operation_locales`)) {
      return { baseUrl, store, table: 'operationLocales' };
    }
  }
  return null;
}

function filterValue(url: URL, name: string): string | null {
  const raw = url.searchParams.get(name);
  return raw?.startsWith('eq.') ? raw.slice(3) : null;
}

function filterSet(url: URL, name: string): Set<string> | null {
  const raw = url.searchParams.get(name);
  if (!raw?.startsWith('in.(') || !raw.endsWith(')')) return null;
  return new Set(raw.slice(4, -1).split(',').filter(Boolean));
}

function filteredRows(url: URL, rows: Map<string, InstanceRow>): InstanceRow[] {
  const accountId = filterValue(url, 'account_id');
  const instanceId = filterValue(url, 'id');
  return [...rows.values()]
    .filter((row) => !accountId || row.account_id === accountId)
    .filter((row) => !instanceId || row.id === instanceId)
    .sort((left, right) => {
      const byEdited = right.edited_at.localeCompare(left.edited_at);
      return byEdited || left.id.localeCompare(right.id);
    });
}

function filteredOperationRows(url: URL, rows: Map<string, TranslationOperationRow>): TranslationOperationRow[] {
  const id = filterValue(url, 'id');
  const accountId = filterValue(url, 'account_public_id');
  const instanceId = filterValue(url, 'instance_id');
  return [...rows.values()]
    .filter((row) => !id || row.id === id)
    .filter((row) => !accountId || row.account_public_id === accountId)
    .filter((row) => !instanceId || row.instance_id === instanceId)
    .sort((left, right) => {
      const byUpdated = right.updated_at.localeCompare(left.updated_at);
      return byUpdated || left.id.localeCompare(right.id);
    });
}

function filteredOperationLocaleRows(url: URL, rows: Map<string, TranslationOperationLocaleRow>): TranslationOperationLocaleRow[] {
  const operationId = filterValue(url, 'operation_id');
  const locale = filterValue(url, 'locale');
  const statuses = filterSet(url, 'status');
  return [...rows.values()]
    .filter((row) => !operationId || row.operation_id === operationId)
    .filter((row) => !locale || row.locale === locale)
    .filter((row) => !statuses || statuses.has(row.status))
    .sort((left, right) => left.locale.localeCompare(right.locale));
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function handleFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input));
  const supabaseMatch = findSupabaseStore(url.href);
  if (supabaseMatch) {
    const method = String(init?.method || 'GET').toUpperCase();
    if (supabaseMatch.table === 'operations') {
      if (method === 'GET') {
        const rows = filteredOperationRows(url, supabaseMatch.store.operations);
        const limit = Number(url.searchParams.get('limit') ?? '0');
        return json(limit > 0 ? rows.slice(0, limit) : rows);
      }
      if (method === 'POST') {
        const payload = JSON.parse(String(init?.body || '{}')) as TranslationOperationRow;
        const hasActive = [...supabaseMatch.store.operations.values()].some((row) =>
          row.account_public_id === payload.account_public_id &&
          row.instance_id === payload.instance_id &&
          (row.status === 'queued' || row.status === 'running')
        );
        if (hasActive && (payload.status === 'queued' || payload.status === 'running')) {
          return json({ code: '23505', message: 'duplicate active operation' }, 409);
        }
        supabaseMatch.store.operations.set(payload.id, { ...payload });
        return json([payload], 201);
      }
      if (method === 'PATCH') {
        const patch = JSON.parse(String(init?.body || '{}')) as Partial<TranslationOperationRow>;
        for (const row of filteredOperationRows(url, supabaseMatch.store.operations)) {
          supabaseMatch.store.operations.set(row.id, { ...row, ...patch });
        }
        return new Response(null, { status: 204 });
      }
    }
    if (supabaseMatch.table === 'operationLocales') {
      if (method === 'GET') {
        return json(filteredOperationLocaleRows(url, supabaseMatch.store.operationLocales));
      }
      if (method === 'POST') {
        const payload = JSON.parse(String(init?.body || '[]')) as TranslationOperationLocaleRow | TranslationOperationLocaleRow[];
        for (const row of Array.isArray(payload) ? payload : [payload]) {
          supabaseMatch.store.operationLocales.set(`${row.operation_id}/${row.locale}`, { ...row });
        }
        return json(Array.isArray(payload) ? payload : [payload], 201);
      }
      if (method === 'PATCH') {
        const patch = JSON.parse(String(init?.body || '{}')) as Partial<TranslationOperationLocaleRow>;
        for (const row of filteredOperationLocaleRows(url, supabaseMatch.store.operationLocales)) {
          supabaseMatch.store.operationLocales.set(`${row.operation_id}/${row.locale}`, { ...row, ...patch });
        }
        return new Response(null, { status: 204 });
      }
    }
  }
  const match = findStore(url.href);
  if (!match) {
    if (previousFetch) return previousFetch(input, init);
    return new Response('not found', { status: 404 });
  }
  const method = String(init?.method || 'GET').toUpperCase();
  if (method === 'GET') {
    return json(filteredRows(url, match.rows));
  }
  if (method === 'POST') {
    const payload = JSON.parse(String(init?.body || '{}')) as InstanceRow;
    match.rows.set(rowKey(payload.account_id, payload.id), { ...payload });
    return json([payload], 201);
  }
  if (method === 'PATCH') {
    const patch = JSON.parse(String(init?.body || '{}')) as Partial<InstanceRow>;
    for (const row of filteredRows(url, match.rows)) {
      match.rows.set(rowKey(row.account_id, row.id), { ...row, ...patch });
    }
    return new Response(null, { status: 204 });
  }
  if (method === 'DELETE') {
    for (const row of filteredRows(url, match.rows)) {
      match.rows.delete(rowKey(row.account_id, row.id));
    }
    return new Response(null, { status: 204 });
  }
  return new Response('method not allowed', { status: 405 });
}

export function attachTestInstanceRegistry(env: Env, initialRows: InstanceRow[] = []): Map<string, InstanceRow> {
  if (!installed) {
    previousFetch = globalThis.fetch;
    globalThis.fetch = handleFetch as typeof fetch;
    installed = true;
  }
  const baseUrl = `https://supabase.test/${crypto.randomUUID()}`;
  const rows = new Map(initialRows.map((row) => [rowKey(row.account_id, row.id), { ...row }]));
  stores.set(baseUrl, rows);
  supabaseStores.set(baseUrl, {
    instances: rows,
    operations: new Map(),
    operationLocales: new Map(),
  });
  env.SUPABASE_URL = baseUrl;
  env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
  return rows;
}
