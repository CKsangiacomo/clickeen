#!/usr/bin/env node

import {
  createSupabaseClient,
  createSupabaseHeaders as createSupabaseHeadersFromClient,
} from './local-supabase.mjs';
import { requestLoopback } from './local-loopback-http.mjs';
import { resolveFirstRootEnvValue } from './local-root-env.mjs';

const TOKYO_WORKER_BASE_URL = String(
  process.env.TOKYO_WORKER_BASE_URL || 'http://localhost:8791',
)
  .trim()
  .replace(/\/+$/, '');
const TOKYO_DEV_JWT = resolveFirstRootEnvValue(['TOKYO_DEV_JWT', 'CK_INTERNAL_SERVICE_JWT']);
const PLATFORM_ACCOUNT_ID = String(
  process.env.CK_PLATFORM_ACCOUNT_ID || '00000000-0000-0000-0000-000000000100',
)
  .trim()
  .toLowerCase();
const TOKYO_INTERNAL_SERVICE_ID = 'devstudio.local';

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
  return createSupabaseHeadersFromClient(SUPABASE_CLIENT);
}

const SUPABASE_CLIENT = createSupabaseClient({ preferLocal: true });
const SUPABASE_URL = SUPABASE_CLIENT.base;

function createTokyoHeaders(accountId) {
  const headers = new Headers();
  headers.set('authorization', `Bearer ${TOKYO_DEV_JWT}`);
  headers.set('x-account-id', accountId);
  headers.set('x-ck-internal-service', TOKYO_INTERNAL_SERVICE_ID);
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

async function loadPlatformAccountRows() {
  const headers = createSupabaseHeaders();
  const [widgetsResponse, instancesResponse] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/widgets?select=id,type&limit=500`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    }),
    fetch(
      `${SUPABASE_URL}/rest/v1/widget_instances?select=public_id,display_name,status,widget_id,account_id,config&account_id=eq.${encodeURIComponent(PLATFORM_ACCOUNT_ID)}&order=created_at.asc&limit=500`,
      {
        method: 'GET',
        headers,
        cache: 'no-store',
      },
    ),
  ]);

  const widgetsText = await widgetsResponse.text().catch(() => '');
  const instancesText = await instancesResponse.text().catch(() => '');
  const widgetsPayload = widgetsText ? JSON.parse(widgetsText) : null;
  const instancesPayload = instancesText ? JSON.parse(instancesText) : null;

  if (!widgetsResponse.ok) {
    fail(`failed to load widget types (${widgetsResponse.status})${widgetsText ? ` ${widgetsText}` : ''}`);
  }
  if (!instancesResponse.ok) {
    fail(
      `failed to load platform account widget rows (${instancesResponse.status})${
        instancesText ? ` ${instancesText}` : ''
      }`,
    );
  }
  if (!Array.isArray(widgetsPayload)) {
    fail('widgets payload is invalid while syncing DevStudio Tokyo saved snapshots');
  }
  if (!Array.isArray(instancesPayload)) {
    fail('platform account widget payload is invalid while syncing DevStudio Tokyo saved snapshots');
  }

  const widgetTypeById = new Map();
  for (const row of widgetsPayload) {
    const id = asTrimmedString(row?.id);
    const type = asTrimmedString(row?.type);
    if (!id || !type) continue;
    widgetTypeById.set(id, type);
  }

  return instancesPayload.map((row) => ({
    public_id: row?.public_id,
    display_name: row?.display_name,
    status: row?.status,
    account_id: row?.account_id,
    config: row?.config,
    widget_type: widgetTypeById.get(asTrimmedString(row?.widget_id) || '') || null,
  }));
}

async function hasSavedSnapshot(publicId, accountId) {
  const response = requestLoopback(
    `${TOKYO_WORKER_BASE_URL}/renders/instances/${encodeURIComponent(publicId)}/saved.json?accountId=${encodeURIComponent(accountId)}`,
    {
      method: 'GET',
      headers: createTokyoHeaders(accountId),
    },
  );
  if (response.status === 404) return false;
  if (!response.ok) {
    fail(
      `failed to read Tokyo saved snapshot for ${publicId} (${response.status})${
        response.text ? ` ${response.text}` : ''
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

  const response = requestLoopback(
    `${TOKYO_WORKER_BASE_URL}/renders/instances/${encodeURIComponent(publicId)}/saved.json?accountId=${encodeURIComponent(accountId)}`,
    {
      method: 'PUT',
      headers: (() => {
        const headers = createTokyoHeaders(accountId);
        headers.set('content-type', 'application/json');
        return headers;
      })(),
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
    fail(
      `failed to write Tokyo saved snapshot for ${publicId} (${response.status})${
        response.text ? ` ${response.text}` : ''
      }`,
    );
  }
}

async function writePlatformAccountSavedSnapshot(row) {
  const publicId = asTrimmedString(row?.public_id);
  const widgetType = asTrimmedString(row?.widget_type);
  const accountId = asTrimmedString(row?.account_id);
  const config = isRecord(row?.config) ? row.config : null;
  const displayName = asTrimmedString(row?.display_name);

  if (!publicId || !widgetType || !accountId || !config) {
    fail(
      `invalid platform account row while syncing Tokyo saved snapshots (${JSON.stringify(row)})`,
    );
  }

  const response = requestLoopback(
    `${TOKYO_WORKER_BASE_URL}/renders/instances/${encodeURIComponent(publicId)}/saved.json?accountId=${encodeURIComponent(accountId)}`,
    {
      method: 'PUT',
      headers: (() => {
        const headers = createTokyoHeaders(accountId);
        headers.set('content-type', 'application/json');
        return headers;
      })(),
      body: JSON.stringify({
        widgetType,
        config,
        displayName: displayName || publicId,
        source: 'account',
        meta: null,
      }),
    },
  );
  if (!response.ok) {
    fail(
      `failed to write Tokyo saved snapshot for platform account instance ${publicId} (${response.status})${
        response.text ? ` ${response.text}` : ''
      }`,
    );
  }
}

async function main() {
  if (!SUPABASE_URL) fail('SUPABASE_URL is required');
  if (!TOKYO_DEV_JWT) fail('TOKYO_DEV_JWT is required');
  if (!TOKYO_WORKER_BASE_URL) fail('TOKYO_WORKER_BASE_URL is required');

  const [curatedRows, platformRows] = await Promise.all([
    loadCuratedRows(),
    loadPlatformAccountRows(),
  ]);
  let repaired = 0;

  for (const row of curatedRows) {
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

  for (const row of platformRows) {
    const publicId = asTrimmedString(row?.public_id);
    const accountId = asTrimmedString(row?.account_id);
    if (!publicId || !accountId) {
      fail(`platform account row missing public_id or account_id (${JSON.stringify(row)})`);
    }
    const exists = await hasSavedSnapshot(publicId, accountId);
    if (exists) continue;
    await writePlatformAccountSavedSnapshot(row);
    repaired += 1;
  }

  console.log(
    `[ensure-curated-tokyo-saved] verified ${curatedRows.length} curated/main rows and ${platformRows.length} platform account rows; repaired ${repaired} missing Tokyo saved snapshots`,
  );
}

await main();
