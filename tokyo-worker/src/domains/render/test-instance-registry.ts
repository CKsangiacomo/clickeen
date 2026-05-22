import type { Env } from '../../types';

type InstanceRow = {
  id: string;
  account_id: string;
  widget_type: string;
  publish_status: 'published' | 'unpublished';
  translation_status: 'idle' | 'queued' | 'running' | 'failed';
  created_at: string;
  edited_at: string;
};

const stores = new Map<string, Map<string, InstanceRow>>();
let installed = false;
let previousFetch: typeof fetch | null = null;

function rowKey(accountId: string, instanceId: string): string {
  return `${accountId}/${instanceId}`;
}

function findStore(url: string): { baseUrl: string; rows: Map<string, InstanceRow> } | null {
  for (const [baseUrl, rows] of stores) {
    if (url.startsWith(`${baseUrl}/rest/v1/instances`)) return { baseUrl, rows };
  }
  return null;
}

function filterValue(url: URL, name: string): string | null {
  const raw = url.searchParams.get(name);
  return raw?.startsWith('eq.') ? raw.slice(3) : null;
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

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function handleFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input));
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
  env.SUPABASE_URL = baseUrl;
  env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
  return rows;
}
