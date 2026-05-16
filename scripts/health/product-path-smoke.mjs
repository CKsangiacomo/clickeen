#!/usr/bin/env node

const DEFAULT_ROMA_BASE = 'https://roma.dev.clickeen.com';
const DEFAULT_VENICE_BASE = 'https://venice.dev.clickeen.com';
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_CONCURRENCY = 6;

const ONE_BY_ONE_GIF = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

function printUsage() {
  console.log(`Usage: pnpm health:product-path [options]

Runs product-path smoke checks against Roma and Venice.

Required for authenticated checks:
  --cookie <cookie>            Roma browser cookie header. Also reads CK_ROMA_COOKIE or ROMA_COOKIE.

Options:
  --roma-base <url>            Roma base URL (default: ${DEFAULT_ROMA_BASE})
  --venice-base <url>          Venice base URL (default: ${DEFAULT_VENICE_BASE})
  --account-public-id <id>     Account public ID for Venice read checks
  --instance-id <id>           Published instanceId for Venice read checks
  --source-instance-id <id>    Account instanceId to duplicate during --write checks
  --concurrency <n>            Concurrent auth/account probes (default: ${DEFAULT_CONCURRENCY})
  --timeout-ms <n>             Request timeout (default: ${DEFAULT_TIMEOUT_MS})
  --write                      Run write+cleanup checks: tiny asset upload/delete and account instance duplicate/delete
  --public-only                Skip authenticated Roma checks; requires --instance-id
  --json                       Print machine-readable summary
  --help                       Show this message
`);
}

function parseArgs(argv) {
  const args = {
    romaBase: process.env.ROMA_BASE_URL || process.env.CK_ROMA_BASE_URL || DEFAULT_ROMA_BASE,
    veniceBase: process.env.VENICE_BASE_URL || process.env.CK_VENICE_BASE_URL || DEFAULT_VENICE_BASE,
    cookie: process.env.CK_ROMA_COOKIE || process.env.ROMA_COOKIE || '',
    accountPublicId: process.env.CK_HEALTH_ACCOUNT_PUBLIC_ID || process.env.VENICE_ACCOUNT_PUBLIC_ID || '',
    instanceId: process.env.CK_HEALTH_INSTANCE_ID || process.env.VENICE_INSTANCE_ID || '',
    sourceInstanceId: process.env.CK_HEALTH_SOURCE_INSTANCE_ID || '',
    concurrency: DEFAULT_CONCURRENCY,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    write: false,
    publicOnly: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '').trim();
    if (!token) continue;
    if (token === '--') continue;
    if (token === '--help' || token === '-h') {
      printUsage();
      process.exit(0);
    }
    if (token === '--write') {
      args.write = true;
      continue;
    }
    if (token === '--public-only') {
      args.publicOnly = true;
      continue;
    }
    if (token === '--json') {
      args.json = true;
      continue;
    }
    if (token === '--roma-base') {
      args.romaBase = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (token === '--venice-base') {
      args.veniceBase = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (token === '--account-public-id') {
      args.accountPublicId = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (token === '--cookie') {
      args.cookie = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (token === '--instance-id') {
      args.instanceId = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (token === '--source-instance-id') {
      args.sourceInstanceId = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (token === '--concurrency') {
      args.concurrency = Number.parseInt(String(argv[i + 1] || ''), 10);
      i += 1;
      continue;
    }
    if (token === '--timeout-ms') {
      args.timeoutMs = Number.parseInt(String(argv[i + 1] || ''), 10);
      i += 1;
      continue;
    }
    throw new Error(`Unknown option: ${token}`);
  }

  args.romaBase = normalizeBaseUrl(args.romaBase, 'roma-base');
  args.veniceBase = normalizeBaseUrl(args.veniceBase, 'venice-base');
  args.cookie = normalizeCookie(args.cookie);
  args.accountPublicId = args.accountPublicId.trim();
  args.instanceId = args.instanceId.trim();
  args.sourceInstanceId = args.sourceInstanceId.trim();
  if (args.publicOnly && (!args.accountPublicId || !args.instanceId)) {
    throw new Error('--public-only requires --account-public-id and --instance-id');
  }
  if (args.write && !args.sourceInstanceId) {
    throw new Error('--write requires --source-instance-id / CK_HEALTH_SOURCE_INSTANCE_ID');
  }
  if (!Number.isInteger(args.concurrency) || args.concurrency < 1 || args.concurrency > 50) {
    throw new Error('--concurrency must be an integer from 1 to 50');
  }
  if (!Number.isInteger(args.timeoutMs) || args.timeoutMs < 1_000 || args.timeoutMs > 120_000) {
    throw new Error('--timeout-ms must be an integer from 1000 to 120000');
  }
  return args;
}

function normalizeBaseUrl(raw, label) {
  const value = String(raw || '').trim().replace(/\/+$/, '');
  if (!value) throw new Error(`${label} is required`);
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('invalid protocol');
    }
    return url.toString().replace(/\/+$/, '');
  } catch (error) {
    throw new Error(`${label} must be an absolute http(s) URL: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function normalizeCookie(raw) {
  return String(raw || '')
    .trim()
    .replace(/^cookie:\s*/i, '')
    .trim();
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function reasonFromPayload(payload) {
  if (!isRecord(payload)) return null;
  const error = payload.error;
  if (!isRecord(error)) return null;
  return [error.kind, error.reasonKey, error.detail].filter((value) => typeof value === 'string' && value.trim()).join(': ');
}

function extractInstances(payload) {
  if (!isRecord(payload) || !Array.isArray(payload.instances)) return [];
  return payload.instances.filter((entry) => isRecord(entry));
}

function selectAccountInstance(instances) {
  return instances.find((entry) => typeof entry.instanceId === 'string') || null;
}

function selectPublishedInstance(instances) {
  return instances.find((entry) => entry.status === 'published' && typeof entry.instanceId === 'string') || null;
}

function extractAccountPublicId(payload) {
  if (!isRecord(payload)) return '';
  const candidates = [
    payload.accountPublicId,
    isRecord(payload.accountContext) ? payload.accountContext.accountPublicId : null,
    isRecord(payload.activeAccount) ? payload.activeAccount.accountPublicId : null,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return '';
}

class HealthRunner {
  constructor(args) {
    this.args = args;
    this.results = [];
  }

  async request(base, path, init = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('request_timeout')), this.args.timeoutMs);
    const headers = new Headers(init.headers || {});
    if (this.args.cookie && !headers.has('cookie')) headers.set('cookie', this.args.cookie);
    if (!headers.has('accept')) headers.set('accept', 'application/json');
    const startedAt = Date.now();
    try {
      const response = await fetch(`${base}${path}`, {
        ...init,
        headers,
        cache: 'no-store',
        signal: controller.signal,
      });
      const text = await response.text().catch(() => '');
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') && text ? safeJson(text) : null;
      return {
        ok: response.ok,
        status: response.status,
        ms: Date.now() - startedAt,
        text,
        payload,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async check(name, boundary, task) {
    const startedAt = Date.now();
    try {
      const detail = await task();
      const printableDetail =
        typeof detail === 'string'
          ? detail
          : isRecord(detail) && typeof detail.detail === 'string'
            ? detail.detail
            : detail
              ? JSON.stringify(detail)
              : '';
      this.results.push({
        name,
        boundary,
        ok: true,
        ms: Date.now() - startedAt,
        detail: printableDetail,
      });
      return detail;
    } catch (error) {
      this.results.push({
        name,
        boundary,
        ok: false,
        ms: Date.now() - startedAt,
        detail: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  skip(name, boundary, detail) {
    this.results.push({ name, boundary, ok: true, skipped: true, ms: 0, detail });
  }
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function assertHttp(result, expected, label) {
  const expectedValues = Array.isArray(expected) ? expected : [expected];
  if (expectedValues.includes(result.status)) return;
  const reason = reasonFromPayload(result.payload) || result.text.slice(0, 240) || 'empty_response';
  throw new Error(`${label} returned HTTP ${result.status}; expected ${expectedValues.join(' or ')}; ${reason}`);
}

function assert2xx(result, label) {
  if (result.status >= 200 && result.status < 300) return;
  const reason = reasonFromPayload(result.payload) || result.text.slice(0, 240) || 'empty_response';
  throw new Error(`${label} returned HTTP ${result.status}; ${reason}`);
}

async function runUnauthenticatedBoundary(runner) {
  await runner.check('Roma unauthenticated account API rejects', 'roma.auth', async () => {
    const savedCookie = runner.args.cookie;
    runner.args.cookie = '';
    try {
      const result = await runner.request(runner.args.romaBase, '/api/account/widgets');
      assertHttp(result, 401, 'GET /api/account/widgets without cookie');
      return `HTTP ${result.status}`;
    } finally {
      runner.args.cookie = savedCookie;
    }
  });
}

async function runAuthConcurrency(runner) {
  const paths = ['/api/bootstrap', '/api/account/widgets', '/api/account/assets', '/api/account/usage', '/api/account/locales'];
  await runner.check('Roma auth/account concurrency', 'roma.auth', async () => {
    const tasks = [];
    for (let i = 0; i < runner.args.concurrency; i += 1) {
      for (const path of paths) {
        tasks.push(runner.request(runner.args.romaBase, path));
      }
    }
    const results = await Promise.all(tasks);
    const failed = results.find((result) => result.status < 200 || result.status >= 300);
    if (failed) {
      const reason = reasonFromPayload(failed.payload) || failed.text.slice(0, 240) || 'empty_response';
      throw new Error(`concurrent request failed with HTTP ${failed.status}; ${reason}`);
    }
    const maxMs = Math.max(...results.map((result) => result.ms));
    return `${results.length} requests ok; slowest ${maxMs}ms`;
  });
}

async function loadBootstrapAccountPublicId(runner) {
  const result = await runner.request(runner.args.romaBase, '/api/bootstrap');
  if (result.status < 200 || result.status >= 300) return '';
  return extractAccountPublicId(result.payload);
}

async function loadWidgets(runner) {
  return runner.check('Roma widget catalog', 'roma.widgets', async () => {
    const result = await runner.request(runner.args.romaBase, '/api/account/widgets');
    assert2xx(result, 'GET /api/account/widgets');
    const instances = extractInstances(result.payload);
    if (!instances.length) throw new Error('widget catalog returned zero instances');
    return { instances, detail: `${instances.length} account instances` };
  });
}

async function runBuilderAndL10n(runner, accountInstance) {
  if (!accountInstance) {
    runner.skip('Roma builder open', 'roma.builder', 'no account-owned instance available');
    runner.skip('Roma translations panel', 'roma.l10n', 'no account-owned instance available');
    return;
  }
  const instanceId = accountInstance.instanceId;
  await runner.check('Roma builder open', 'roma.builder', async () => {
    const result = await runner.request(runner.args.romaBase, `/api/builder/${encodeURIComponent(instanceId)}/open`);
    assert2xx(result, `GET /api/builder/${instanceId}/open`);
    if (!isRecord(result.payload) || !isRecord(result.payload.instance)) {
      throw new Error('builder open payload missing instance');
    }
    return instanceId;
  });
  await runner.check('Roma translations panel', 'roma.l10n', async () => {
    const result = await runner.request(runner.args.romaBase, `/api/account/instances/${encodeURIComponent(instanceId)}/translations`);
    assert2xx(result, `GET /api/account/instances/${instanceId}/translations`);
    if (!isRecord(result.payload)) throw new Error('translations payload is not an object');
    const state = isRecord(result.payload.summary) ? result.payload.summary.state : result.payload.state;
    return state ? `state=${String(state)}` : 'payload ok';
  });
}

async function runAssetRead(runner) {
  await runner.check('Roma asset quota/list', 'roma.assets', async () => {
    const result = await runner.request(runner.args.romaBase, '/api/account/assets');
    assert2xx(result, 'GET /api/account/assets');
    if (!isRecord(result.payload) || !Array.isArray(result.payload.assets)) {
      throw new Error('asset list payload missing assets[]');
    }
    const used = Number(result.payload.storageBytesUsed);
    const usedText = Number.isFinite(used) ? `${used} bytes used` : 'storage usage unavailable';
    return `${result.payload.assets.length} assets; ${usedText}`;
  });
}

async function runAssetWrite(runner) {
  let assetId = '';
  await runner.check('Roma asset upload/delete', 'roma.assets', async () => {
    const filename = `ck-health-${Date.now().toString(36)}.gif`;
    const upload = await runner.request(runner.args.romaBase, '/api/account/assets/upload', {
      method: 'POST',
      headers: {
        'content-type': 'image/gif',
        'x-filename': filename,
        'x-source': 'product-path-health',
      },
      body: ONE_BY_ONE_GIF,
    });
    assert2xx(upload, 'POST /api/account/assets/upload');
    if (!isRecord(upload.payload) || typeof upload.payload.assetId !== 'string') {
      throw new Error('upload payload missing assetId');
    }
    assetId = upload.payload.assetId;
    const cleanup = await runner.request(runner.args.romaBase, `/api/account/assets/${encodeURIComponent(assetId)}`, {
      method: 'DELETE',
    });
    assert2xx(cleanup, `DELETE /api/account/assets/${assetId}`);
    return `uploaded and deleted ${assetId}`;
  });
}

async function runDuplicateWrite(runner, sourceInstance) {
  if (!sourceInstance) {
    runner.skip('Roma instance duplicate/delete', 'roma.widgets', 'no source instance available');
    return null;
  }
  let createdInstanceId = '';
  await runner.check('Roma instance duplicate/delete', 'roma.widgets', async () => {
    const duplicate = await runner.request(
      runner.args.romaBase,
      `/api/account/instances/${encodeURIComponent(sourceInstance.instanceId)}/duplicate`,
      { method: 'POST' },
    );
    assertHttp(duplicate, 201, `POST /api/account/instances/${sourceInstance.instanceId}/duplicate`);
    if (!isRecord(duplicate.payload) || typeof duplicate.payload.instanceId !== 'string') {
      throw new Error('duplicate payload missing instanceId');
    }
    createdInstanceId = duplicate.payload.instanceId;

    const open = await runner.request(runner.args.romaBase, `/api/builder/${encodeURIComponent(createdInstanceId)}/open`);
    assert2xx(open, `GET /api/builder/${createdInstanceId}/open`);

    const translations = await runner.request(
      runner.args.romaBase,
      `/api/account/instances/${encodeURIComponent(createdInstanceId)}/translations`,
    );
    assert2xx(translations, `GET /api/account/instances/${createdInstanceId}/translations`);

    const cleanup = await runner.request(runner.args.romaBase, `/api/account/instances/${encodeURIComponent(createdInstanceId)}`, {
      method: 'DELETE',
    });
    assert2xx(cleanup, `DELETE /api/account/instances/${createdInstanceId}`);
    return `duplicated ${sourceInstance.instanceId} to ${createdInstanceId}, opened, checked l10n, deleted`;
  });
  return createdInstanceId || null;
}

async function runVenice(runner, accountPublicId, instanceId) {
  await runner.check('Venice loader', 'venice.public', async () => {
    const result = await runner.request(runner.args.veniceBase, '/embed/latest/loader.js');
    assert2xx(result, 'GET /embed/latest/loader.js');
    return `HTTP ${result.status}`;
  });

  if (!accountPublicId || !instanceId) {
    runner.skip('Venice public instance read', 'venice.public', 'no accountPublicId or published instanceId supplied or discovered');
    return;
  }

  await runner.check('Venice public instance read', 'venice.public', async () => {
    const pointer = await runner.request(
      runner.args.veniceBase,
      `/renders/accounts/${encodeURIComponent(accountPublicId)}/instances/${encodeURIComponent(instanceId)}/live/r.json`,
    );
    assert2xx(pointer, `GET /renders/accounts/${accountPublicId}/instances/${instanceId}/live/r.json`);
    const embed = await runner.request(runner.args.veniceBase, `/widget/${encodeURIComponent(accountPublicId)}/${encodeURIComponent(instanceId)}`);
    assert2xx(embed, `GET /widget/${accountPublicId}/${instanceId}`);
    return `${accountPublicId}/${instanceId}`;
  });
}

function printResults(results, json) {
  const failed = results.filter((result) => !result.ok);
  if (json) {
    console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2));
    return;
  }
  for (const result of results) {
    const icon = result.ok ? (result.skipped ? 'SKIP' : 'OK') : 'FAIL';
    const detail = result.detail ? ` - ${result.detail}` : '';
    console.log(`${icon} [${result.boundary}] ${result.name} (${result.ms}ms)${detail}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runner = new HealthRunner(args);

  await runUnauthenticatedBoundary(runner);
  await runVenice(runner, args.publicOnly ? args.accountPublicId : '', args.publicOnly ? args.instanceId : '');

  if (args.publicOnly) {
    printResults(runner.results, args.json);
    process.exit(runner.results.some((result) => !result.ok) ? 1 : 0);
  }

  if (!args.cookie) {
    runner.results.push({
      name: 'Authenticated Roma product path',
      boundary: 'roma.auth',
      ok: false,
      ms: 0,
      detail: 'missing --cookie / CK_ROMA_COOKIE / ROMA_COOKIE',
    });
    printResults(runner.results, args.json);
    process.exit(1);
  }

  await runAuthConcurrency(runner);
  const widgetsResult = await loadWidgets(runner);
  const instances = widgetsResult && Array.isArray(widgetsResult.instances) ? widgetsResult.instances : [];
  const accountInstance = selectAccountInstance(instances);
  await runAssetRead(runner);
  await runBuilderAndL10n(runner, accountInstance);

  if (args.write) {
    await runAssetWrite(runner);
    await runDuplicateWrite(runner, { instanceId: args.sourceInstanceId });
  }

  const publishedInstanceId = args.instanceId || selectPublishedInstance(instances)?.instanceId || '';
  const accountPublicId = args.accountPublicId || (await loadBootstrapAccountPublicId(runner));
  await runVenice(runner, accountPublicId, publishedInstanceId);

  printResults(runner.results, args.json);
  process.exit(runner.results.some((result) => !result.ok) ? 1 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
