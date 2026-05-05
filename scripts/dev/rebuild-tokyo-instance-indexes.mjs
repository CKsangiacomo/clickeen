#!/usr/bin/env node

const DEFAULT_BASE = process.env.TOKYO_WORKER_BASE || 'http://localhost:4001';
const DEFAULT_PLATFORM_ACCOUNT_ID =
  process.env.CK_PLATFORM_ACCOUNT_ID || '00000000-0000-0000-0000-000000000100';

function usage() {
  console.log(`Usage:
  node scripts/dev/rebuild-tokyo-instance-indexes.mjs --account <uuid> [--account <uuid> ...] [--base <url>] [--write] [--compare-db]

Defaults:
  --base ${DEFAULT_BASE}
  --account ${DEFAULT_PLATFORM_ACCOUNT_ID} when no account is provided

Auth:
  Uses TOKYO_DEV_JWT for local/devstudio internal auth.
`);
}

function parseArgs(argv) {
  const args = {
    accounts: [],
    base: DEFAULT_BASE,
    write: false,
    compareDb: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (entry === '--help' || entry === '-h') {
      usage();
      process.exit(0);
    }
    if (entry === '--account') {
      const value = argv[index + 1];
      if (!value) throw new Error('--account requires a value');
      args.accounts.push(value.trim());
      index += 1;
      continue;
    }
    if (entry === '--base') {
      const value = argv[index + 1];
      if (!value) throw new Error('--base requires a value');
      args.base = value.trim();
      index += 1;
      continue;
    }
    if (entry === '--write') {
      args.write = true;
      continue;
    }
    if (entry === '--compare-db') {
      args.compareDb = true;
      continue;
    }
    throw new Error(`Unknown argument: ${entry}`);
  }
  if (!args.accounts.length) args.accounts.push(DEFAULT_PLATFORM_ACCOUNT_ID);
  return args;
}

async function rebuildAccount(args, accountId) {
  const token = String(process.env.TOKYO_DEV_JWT || '').trim();
  if (!token) throw new Error('TOKYO_DEV_JWT is required');
  const response = await fetch(`${args.base.replace(/\/+$/, '')}/__internal/renders/instances/index/rebuild.json`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json',
      'x-account-id': accountId,
      'x-ck-internal-service': 'devstudio.local',
    },
    body: JSON.stringify({ dryRun: !args.write }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`tokyo_rebuild_failed:${accountId}:${response.status}:${JSON.stringify(payload)}`);
  }
  return payload;
}

async function fetchDbPublicIds(accountId) {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) return null;
  const params = new URLSearchParams({
    select: 'public_id',
    account_id: `eq.${accountId}`,
    order: 'public_id.asc',
  });
  const response = await fetch(`${url}/rest/v1/widget_instances?${params.toString()}`, {
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      accept: 'application/json',
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(payload)) {
    throw new Error(`supabase_fetch_failed:${accountId}:${response.status}:${JSON.stringify(payload)}`);
  }
  return payload
    .map((row) => (typeof row?.public_id === 'string' ? row.public_id.trim() : ''))
    .filter(Boolean);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  for (const accountId of args.accounts) {
    const report = await rebuildAccount(args, accountId);
    console.log(JSON.stringify(report, null, 2));
    if (args.compareDb) {
      const dbPublicIds = await fetchDbPublicIds(accountId);
      if (!dbPublicIds) {
        console.log(JSON.stringify({ accountId, dbCompareSkipped: 'SUPABASE_URL_or_SERVICE_ROLE_missing' }, null, 2));
        continue;
      }
      const tokyoPublicIds = Array.isArray(report.entryPublicIds)
        ? report.entryPublicIds.filter((entry) => typeof entry === 'string' && entry.trim()).map((entry) => entry.trim())
        : [];
      const tokyoPublicIdSet = new Set(tokyoPublicIds);
      const dbPublicIdSet = new Set(dbPublicIds);
      console.log(
        JSON.stringify(
          {
            accountId,
            dbRows: dbPublicIds.length,
            dbRowsWithoutTokyoSavedDocument: dbPublicIds.filter((publicId) => !tokyoPublicIdSet.has(publicId)),
            tokyoSavedDocumentsWithoutDbRow: tokyoPublicIds.filter((publicId) => !dbPublicIdSet.has(publicId)),
          },
          null,
          2,
        ),
      );
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
