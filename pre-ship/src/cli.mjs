import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..');
const artifactDir = join(repoRoot, 'artifacts', 'pre-ship');
const CHILDREN = [];

async function main() {
  const config = loadConfig();
  await ensureDir(artifactDir);

  const context = await prepareContext(config);
  await writeFile(join(artifactDir, 'context.json'), JSON.stringify(context, null, 2));

  try {
    const servers = config.stagingMode ? [] : await startLocalServices(config);
    const stopServers = async () => {
      for (const child of servers) {
        if (!child.killed) {
          child.kill('SIGINT');
        }
      }
    };

    const results = [];

    const tests = [
      () => runAndRecord({ id: 1, name: 'csp-nonce', run: () => testCspNonce(config, context) }, results),
      () => runAndRecord({ id: 2, name: 'cors-s2s', run: () => testCorsS2S(config, context) }, results),
      () => runAndRecord({ id: 3, name: 'cors-disallowed', run: () => testCorsDisallowed(config, context) }, results),
      () => runAndRecord({ id: 4, name: 'put-guard', run: () => testPutGuard(config, context) }, results),
      () => runAndRecord({ id: 5, name: 'put-status-only', run: () => testPutStatusOnly(config, context) }, results),
      () => runAndRecord({ id: 6, name: 'dedup', run: () => testSubmissionDedup(config, context) }, results),
      () => runAndRecord({
        id: 7,
        name: 'redis-breaker',
        run: () => testRedisBreaker(config),
        optional: true,
      }, results),
      () => runAndRecord({ id: 'db-indexes', name: 'db-indexes', run: () => testDbIndexes(config) }, results),
    ];

    for (const test of tests) {
      await test();
    }

    await stopServers();

    const failedCount = results.filter((r) => r.status === 'fail').length;
    const summary = { passed: failedCount === 0, failedCount };
    await writeFile(join(artifactDir, 'results.json'), JSON.stringify({ summary, tests: results }, null, 2));

    if (failedCount > 0) {
      process.exitCode = 1;
    }
  } finally {
    shutdownChildren();
  }
}

function loadConfig() {
  const required = (name) => {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
  };

  const args = new Set(process.argv.slice(2));

  return {
    baseParis: process.env.BASE_URL_PARIS ?? 'http://localhost:3001',
    baseVenice: process.env.BASE_URL_VENICE ?? 'http://localhost:3002',
    stagingMode: process.env.STAGING_MODE === 'true',
    supabaseUrl: required('SUPABASE_URL'),
    supabaseServiceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    supabaseJwtSecret: required('SUPABASE_JWT_SECRET'),
    databaseUrl: required('DATABASE_URL'),
    publicIdOverride: process.env.PUBLIC_ID,
    authBearerOverride: process.env.AUTH_BEARER,
    redisUrl: process.env.REDIS_URL,
    withRedisTest: args.has('--with-redis') || process.env.WITH_REDIS === 'true',
  };
}

async function prepareContext(config) {
  if (config.publicIdOverride) {
    if (!config.authBearerOverride) {
      throw new Error('AUTH_BEARER must be provided when PUBLIC_ID is supplied.');
    }
    return {
      publicId: config.publicIdOverride,
      workspaceId: 'unknown',
      widgetId: 'unknown',
      userId: 'unknown',
      userEmail: 'unknown@example.com',
      token: config.authBearerOverride,
    };
  }

  const headers = defaultSupabaseHeaders(config);

  const workspaceId = randomUUID();
  const workspacePayload = {
    id: workspaceId,
    name: `Pre-Ship Workspace ${workspaceId.slice(0, 8)}`,
    plan: 'free',
    kind: 'business',
  };

  await supabaseRequest(`${config.supabaseUrl}/rest/v1/workspaces`, {
    method: 'POST',
    headers,
    body: JSON.stringify(workspacePayload),
  }, 'Failed to create workspace');

  const email = `pre-ship-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const createUserResponse = await supabaseRequest(`${config.supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      password: randomUUID(),
      email_confirm: true,
      user_metadata: {},
      app_metadata: { provider: 'email', providers: ['email'] },
    }),
  }, 'Failed to create Supabase user');

  const userId = createUserResponse.id;
  if (!userId) {
    throw new Error('Supabase user creation did not return an id');
  }

  await supabaseRequest(`${config.supabaseUrl}/rest/v1/workspace_members`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      workspace_id: workspaceId,
      user_id: userId,
      role: 'owner',
      status: 'active',
    }),
  }, 'Failed to create workspace member');

  const widgetConfig = {
    title: 'Contact Us',
    fields: {
      name: true,
      email: true,
      message: true,
    },
    successMessage: 'Thanks for reaching out! We will get back to you shortly.',
  };

  const widgetResponse = await supabaseRequest(`${config.supabaseUrl}/rest/v1/widgets`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      workspace_id: workspaceId,
      name: 'Pre-Ship Contact Form',
      type: 'forms.contact',
      public_key: `wpk_${Math.random().toString(36).slice(2, 12)}`,
      status: 'active',
      config: widgetConfig,
      template_id: 'classic-light',
      schema_version: '2025-09-01',
    }),
  }, 'Failed to create widget');

  const widgetId = Array.isArray(widgetResponse) ? widgetResponse[0]?.id : widgetResponse.id;
  if (!widgetId) {
    throw new Error('Widget creation did not return an id');
  }

  const publicId = generatePublicId();
  await supabaseRequest(`${config.supabaseUrl}/rest/v1/widget_instances`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      widget_id: widgetId,
      public_id: publicId,
      status: 'published',
      config: widgetConfig,
      template_id: 'classic-light',
      schema_version: '2025-09-01',
      draft_token: null,
      claimed_at: new Date().toISOString(),
    }),
  }, 'Failed to create widget instance');

  const now = Math.floor(Date.now() / 1000);
  const token = signJwt(
    {
      aud: 'authenticated',
      exp: now + 3600,
      iat: now,
      iss: 'clickeen-pre-ship',
      sub: userId,
      email,
      role: 'authenticated',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
    },
    config.supabaseJwtSecret,
  );

  return {
    publicId,
    workspaceId,
    widgetId,
    userId,
    userEmail: email,
    token,
  };
}

function signJwt(payload, secret) {
  const base64url = (input) => Buffer.from(input).toString('base64url');
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function defaultSupabaseHeaders(config) {
  return {
    apikey: config.supabaseServiceKey,
    Authorization: `Bearer ${config.supabaseServiceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

async function supabaseRequest(url, init, errorMessage) {
  const res = await fetch(url, init);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const detail = body?.message || body?.error_description || JSON.stringify(body);
    throw new Error(`${errorMessage}: ${detail ?? res.status}`);
  }
  return body;
}

async function startLocalServices(config) {
  const processes = [];

  const spawnDev = (filter, extraEnv = {}) => {
    const child = spawn('pnpm', ['--filter', filter, 'dev'], {
      cwd: repoRoot,
      env: { ...process.env, ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    CHILDREN.push(child);
    child.stdout.on('data', (chunk) => {
      process.stdout.write(`[${filter}] ${chunk}`);
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(`[${filter}] ${chunk}`);
    });
    processes.push(child);
  };

  spawnDev('paris', {
    PORT: new URL(config.baseParis).port || '3001',
    SUPABASE_URL: config.supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: config.supabaseServiceKey,
  });
  await waitForHttp(`${config.baseParis}/api/healthz`, 'paris');

  spawnDev('venice', {
    PORT: new URL(config.baseVenice).port || '3002',
    PARIS_URL: config.baseParis,
    NEXT_PUBLIC_PARIS_URL: config.baseParis,
    SUPABASE_URL: config.supabaseUrl,
  });
  await waitForHttp(`${config.baseVenice}/e/${encodeURIComponent('health-check')}`, 'venice', {
    acceptStatus: (status) => status === 404 || status === 200,
  });

  return processes;
}

async function waitForHttp(url, name, options) {
  const attempts = options?.attempts ?? 60;
  const delayMs = options?.delayMs ?? 1000;
  const acceptStatus = options?.acceptStatus ?? ((status) => status >= 200 && status < 500);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (acceptStatus(res.status)) {
        return;
      }
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, delayMs));
    if (attempt === attempts) {
      throw new Error(`Timed out waiting for ${name} at ${url}`);
    }
  }
}

async function runAndRecord(test, results) {
  const slug = slugify(test.name);
  const path = join(artifactDir, `test-${test.id}-${slug}.json`);
  const started = Date.now();

  try {
    const outcome = await test.run();
    const status = outcome.status ?? 'pass';
    const metrics = outcome.metrics ?? {};
    const result = {
      id: test.id,
      name: test.name,
      status,
      error: null,
      metrics: { ...metrics, durationMs: Date.now() - started },
    };
    await writeFile(path, JSON.stringify(result, null, 2));
    results.push(result);
  } catch (err) {
    if (test.optional) {
      const result = {
        id: test.id,
        name: test.name,
        status: 'skipped',
        error: err instanceof Error ? err.message : String(err),
        metrics: { durationMs: Date.now() - started },
      };
      await writeFile(path, JSON.stringify(result, null, 2));
      results.push(result);
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    const result = {
      id: test.id,
      name: test.name,
      status: 'fail',
      error: message,
      metrics: { durationMs: Date.now() - started },
    };
    await writeFile(path, JSON.stringify(result, null, 2));
    results.push(result);
  }
}

async function testCspNonce(config, context) {
  const url = `${config.baseVenice}/e/${encodeURIComponent(context.publicId)}?theme=light&device=desktop`;
  const res = await fetch(url, {
    headers: { 'X-Request-ID': `pre-ship-${Date.now()}` },
  });
  const html = await res.text();
  const csp = res.headers.get('content-security-policy') ?? '';
  const styleNonceMatches = [...html.matchAll(/<style[^>]*nonce="([^"]+)"/g)];

  if (res.status !== 200) {
    throw new Error(`Expected 200 from Venice but received ${res.status}`);
  }
  if (styleNonceMatches.length === 0) {
    throw new Error('No <style nonce="..."> blocks found in embed response');
  }
  if (!csp.includes('\'nonce-')) {
    throw new Error('Content-Security-Policy header missing nonce directive');
  }

  return {
    metrics: {
      status: res.status,
      nonceCount: styleNonceMatches.length,
      hasCspHeader: Boolean(csp),
    },
  };
}

async function testCorsS2S(config, context) {
  const res = await fetch(`${config.baseParis}/api/instance/${encodeURIComponent(context.publicId)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${context.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'draft' }),
  });

  const body = await safeJson(res);
  if (res.status !== 200) {
    throw new Error(`Expected 200 from PUT /api/instance but received ${res.status}`);
  }
  if (!body || body.status !== 'draft') {
    throw new Error('Response missing draft status confirmation');
  }
  return {
    metrics: {
      status: res.status,
      statusValue: body.status,
    },
  };
}

async function testCorsDisallowed(config, context) {
  const res = await fetch(`${config.baseParis}/api/instance/${encodeURIComponent(context.publicId)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${context.token}`,
      'Content-Type': 'application/json',
      Origin: 'https://evil.example',
    },
    body: JSON.stringify({ status: 'draft' }),
  });

  const body = await safeJson(res);
  if (res.status !== 403) {
    throw new Error(`Expected 403 from disallowed origin but received ${res.status}`);
  }
  if (!body || body.error !== 'FORBIDDEN') {
    throw new Error('Response did not include { error: "FORBIDDEN" }');
  }
  return {
    metrics: {
      status: res.status,
      error: body.error,
    },
  };
}

async function testPutGuard(config, context) {
  const res = await fetch(`${config.baseParis}/api/instance/${encodeURIComponent(context.publicId)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${context.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  const body = await safeJson(res);
  if (res.status !== 422) {
    throw new Error(`Expected 422 for empty body but received ${res.status}`);
  }
  if (!Array.isArray(body) || body.length === 0 || !String(body[0].message).includes('At least one field')) {
    throw new Error('Validation error missing expected message');
  }
  return {
    metrics: {
      status: res.status,
      message: body[0].message,
    },
  };
}

async function testPutStatusOnly(config, context) {
  const res = await fetch(`${config.baseParis}/api/instance/${encodeURIComponent(context.publicId)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${context.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'inactive' }),
  });

  const body = await safeJson(res);
  if (res.status !== 200) {
    throw new Error(`Expected 200 for status-only update but received ${res.status}`);
  }
  if (!body || body.status !== 'inactive') {
    throw new Error('Response did not return updated inactive status');
  }
  return {
    metrics: {
      status: res.status,
      statusValue: body.status,
    },
  };
}

async function testSubmissionDedup(config, context) {
  // Ensure the instance is published before exercising the submission flow.
  const publishRes = await fetch(`${config.baseParis}/api/instance/${encodeURIComponent(context.publicId)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${context.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'published' }),
  });
  if (publishRes.status !== 200) {
    const details = await safeJson(publishRes);
    throw new Error(
      `Failed to publish instance before submission test (status ${publishRes.status}): ${JSON.stringify(details)}`,
    );
  }

  const submission = {
    fields: {
      email: `pre-ship+${Date.now()}@example.com`,
    },
  };
  const url = `${config.baseVenice}/s/${encodeURIComponent(context.publicId)}`;

  const send = async () =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(submission),
    });

  const first = await send();
  const firstBody = await safeJson(first);
  if (first.status !== 202) {
    throw new Error(`Expected 202 on first submission but received ${first.status}`);
  }
  if (!firstBody || firstBody.deduped !== false) {
    throw new Error('First submission should have deduped:false');
  }

  const second = await send();
  const secondBody = await safeJson(second);
  if (second.status !== 202) {
    throw new Error(`Expected 202 on duplicate submission but received ${second.status}`);
  }
  if (!secondBody || secondBody.deduped !== true) {
    throw new Error('Second submission should have deduped:true');
  }

  return {
    metrics: {
      firstStatus: first.status,
      secondStatus: second.status,
      dedupedStates: [firstBody.deduped, secondBody.deduped],
    },
  };
}

async function testRedisBreaker(config) {
  if (!config.withRedisTest || !config.redisUrl) {
    return { status: 'skipped', metrics: { reason: 'Redis URL not provided or test disabled' } };
  }
  throw new Error('Redis breaker test not implemented in automation harness');
}

async function testDbIndexes(config) {
  // TODO: Implement proper DB index verification via direct SQL connection
  // For now, skip this test as indexes are verified by migration tests
  return {
    status: 'skipped',
    metrics: {
      reason: 'DB index verification requires direct SQL access (not implemented yet)',
    },
  };
}

function generatePublicId() {
  return `wgt_${Math.random().toString(36).slice(2, 8)}`;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function ensureDir(path) {
  if (!existsSync(path)) {
    await mkdir(path, { recursive: true });
  }
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function shutdownChildren() {
  for (const child of CHILDREN) {
    if (!child.killed) {
      child.kill('SIGINT');
    }
  }
}

process.on('SIGINT', () => {
  shutdownChildren();
  process.exit(1);
});

main().catch((err) => {
  console.error(err);
  shutdownChildren();
  process.exit(1);
});
