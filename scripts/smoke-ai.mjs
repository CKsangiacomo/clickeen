import fs from 'node:fs';

function loadDotEnvLocal(path) {
  if (!fs.existsSync(path)) return;
  const raw = fs.readFileSync(path, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnvLocal(new URL('../.env.local', import.meta.url).pathname);

const PARIS_BASE_URL = (process.env.PARIS_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const SANFRANCISCO_BASE_URL = (process.env.SANFRANCISCO_BASE_URL || 'http://localhost:3002').replace(/\/$/, '');
const BOB_BASE_URL = (process.env.BOB_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const PARIS_DEV_JWT = process.env.PARIS_DEV_JWT;

if (!PARIS_DEV_JWT) {
  console.error('[smoke-ai] Missing PARIS_DEV_JWT (set it in .env.local)');
  process.exit(2);
}

async function mustJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON, got: ${text.slice(0, 300)}`);
  }
}

async function main() {
  console.log('[smoke-ai] grant → execute (debug.grantProbe)');

  const grantRes = await fetch(`${PARIS_BASE_URL}/api/ai/grant`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${PARIS_DEV_JWT}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      agentId: 'debug.grantProbe',
      mode: 'ops',
      budgets: { maxTokens: 16, timeoutMs: 2000, maxRequests: 1 },
    }),
  });

  if (!grantRes.ok) {
    const body = await grantRes.text().catch(() => '');
    throw new Error(`Grant failed (${grantRes.status}): ${body}`);
  }
  const grantPayload = await mustJson(grantRes);
  if (!grantPayload?.grant) throw new Error('Grant response missing "grant"');

  const execRes = await fetch(`${SANFRANCISCO_BASE_URL}/v1/execute`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant: grantPayload.grant,
      agentId: 'debug.grantProbe',
      input: { ping: 'ok' },
    }),
  });

  if (!execRes.ok) {
    const body = await execRes.text().catch(() => '');
    throw new Error(`Execute failed (${execRes.status}): ${body}`);
  }
  const execPayload = await mustJson(execRes);
  if (!execPayload?.result?.ok) throw new Error('Execute response missing result.ok');

  console.log('[smoke-ai] ok: grant + execute');

  if (process.env.SMOKE_AI_UPSTREAM === '1') {
    console.log('[smoke-ai] upstream: bob /api/ai/sdr-copilot');
    const res = await fetch(`${BOB_BASE_URL}/api/ai/sdr-copilot`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Make the title blue.',
        widgetType: 'faq',
        currentConfig: {
          title: 'Frequently Asked Questions',
        },
        controls: [{ path: 'appearance.questionColor', kind: 'color', label: 'Question text color' }],
        sessionId: 'smoke',
      }),
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) throw new Error(`FAQ copilot failed (${res.status}): ${text}`);
    const payload = JSON.parse(text);
    if (typeof payload?.message !== 'string') throw new Error('SDR copilot returned no message');
    console.log('[smoke-ai] ok: upstream SDR copilot');
  } else {
    console.log('[smoke-ai] skipping upstream (set SMOKE_AI_UPSTREAM=1 to run)');
  }
}

main().catch((err) => {
  console.error(`[smoke-ai] FAIL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
