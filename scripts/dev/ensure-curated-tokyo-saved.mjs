#!/usr/bin/env node

const SUPABASE_URL = String(process.env.SUPABASE_URL || '')
  .trim()
  .replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const TOKYO_WORKER_BASE_URL = String(
  process.env.TOKYO_WORKER_BASE_URL || 'http://localhost:8791',
)
  .trim()
  .replace(/\/+$/, '');
const TOKYO_DEV_JWT = String(process.env.TOKYO_DEV_JWT || '').trim();

function fail(message) {
  console.error(`[ensure-curated-tokyo-saved] ${message}`);
  process.exit(1);
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asTrimmedString(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function createSupabaseHeaders() {
  const headers = new Headers();
  headers.set('apikey', SUPABASE_SERVICE_ROLE_KEY);
  headers.set('authorization', `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`);
  headers.set('accept', 'application/json');
  return headers;
}

function createTokyoHeaders(accountId) {
  const headers = new Headers();
  headers.set('authorization', `Bearer ${TOKYO_DEV_JWT}`);
  headers.set('x-account-id', accountId);
  headers.set('accept', 'application/json');
  return headers;
}

async function loadCuratedRows() {
  const headers = createSupabaseHeaders();
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/curated_widget_instances?select=public_id,widget_type,owner_account_id,config,meta&order=created_at.asc&limit=500`,
    {
      method: 'GET',
      headers,
      cache: 'no-store',
    },
  );
  const text = await response.text().catch(() => '');
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    fail(`failed to load curated rows (${response.status})${text ? ` ${text}` : ''}`);
  }
  if (!Array.isArray(payload)) {
    fail('curated row payload is invalid');
  }
  return payload;
}

async function hasSavedSnapshot(publicId, accountId) {
  const response = await fetch(
    `${TOKYO_WORKER_BASE_URL}/renders/instances/${encodeURIComponent(publicId)}/saved.json?accountId=${encodeURIComponent(accountId)}`,
    {
      method: 'GET',
      headers: createTokyoHeaders(accountId),
      cache: 'no-store',
    },
  );
  if (response.status === 404) return false;
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    fail(
      `failed to read Tokyo saved snapshot for ${publicId} (${response.status})${
        text ? ` ${text}` : ''
      }`,
    );
  }
  return true;
}

async function writeSavedSnapshot(row) {
  const publicId = asTrimmedString(row?.public_id);
  const widgetType = asTrimmedString(row?.widget_type);
  const accountId = asTrimmedString(row?.owner_account_id);
  const config = isRecord(row?.config) ? row.config : null;
  const meta = row?.meta === null || row?.meta === undefined ? null : isRecord(row?.meta) ? row.meta : null;

  if (!publicId || !widgetType || !accountId || !config) {
    fail(`invalid curated row while syncing Tokyo saved snapshots (${JSON.stringify(row)})`);
  }

  const response = await fetch(
    `${TOKYO_WORKER_BASE_URL}/renders/instances/${encodeURIComponent(publicId)}/saved.json?accountId=${encodeURIComponent(accountId)}`,
    {
      method: 'PUT',
      headers: (() => {
        const headers = createTokyoHeaders(accountId);
        headers.set('content-type', 'application/json');
        return headers;
      })(),
      cache: 'no-store',
      body: JSON.stringify({
        widgetType,
        config,
        displayName: publicId,
        source: 'curated',
        meta,
      }),
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    fail(
      `failed to write Tokyo saved snapshot for ${publicId} (${response.status})${
        text ? ` ${text}` : ''
      }`,
    );
  }
}

async function main() {
  if (!SUPABASE_URL) fail('SUPABASE_URL is required');
  if (!SUPABASE_SERVICE_ROLE_KEY) fail('SUPABASE_SERVICE_ROLE_KEY is required');
  if (!TOKYO_DEV_JWT) fail('TOKYO_DEV_JWT is required');
  if (!TOKYO_WORKER_BASE_URL) fail('TOKYO_WORKER_BASE_URL is required');

  const rows = await loadCuratedRows();
  let repaired = 0;

  for (const row of rows) {
    const publicId = asTrimmedString(row?.public_id);
    const accountId = asTrimmedString(row?.owner_account_id);
    if (!publicId || !accountId) {
      fail(`curated row missing public_id or owner_account_id (${JSON.stringify(row)})`);
    }
    const exists = await hasSavedSnapshot(publicId, accountId);
    if (exists) continue;
    await writeSavedSnapshot(row);
    repaired += 1;
  }

  console.log(
    `[ensure-curated-tokyo-saved] verified ${rows.length} curated/main rows; repaired ${repaired} missing Tokyo saved snapshots`,
  );
}

await main();
