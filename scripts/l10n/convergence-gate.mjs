#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DEFAULT_ACCOUNT_ID = '00000000-0000-0000-0000-000000000100';
const DEFAULT_EXPECTED_INSTANCE_COUNT = 4;
const DEFAULT_TIMEOUT_MS = 3 * 60_000;
const DEFAULT_INTERVAL_MS = 5_000;
const DEFAULT_STALL_MS = 90_000;
const DEFAULT_SUBJECT = 'account';
const DEFAULT_IDS_FALLBACK = [
  'wgt_main_countdown',
  'wgt_main_faq',
  'wgt_main_logoshowcase',
  'wgt_curated_faq_lightblurs_generic',
];

function stableStringify(value) {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  const body = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',');
  return `{${body}}`;
}

function parsePositiveInt(value, fallback, label) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`[l10n-gate] ${label} must be a positive number`);
  }
  return Math.floor(parsed);
}

function readLocalEnvValue(key) {
  const direct = process.env[key];
  if (direct) return String(direct).trim();
  try {
    const raw = fs.readFileSync('.env.local', 'utf8');
    const match = raw.match(new RegExp(`^${key}=(.+)$`, 'm'));
    return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : null;
  } catch {
    return null;
  }
}

function readLocalFileValue(filePath) {
  try {
    const resolved = path.join(process.cwd(), filePath);
    if (!fs.existsSync(resolved)) return null;
    const raw = fs.readFileSync(resolved, 'utf8').trim();
    return raw || null;
  } catch {
    return null;
  }
}

function normalizeBaseUrl(value, fallback) {
  const candidate = typeof value === 'string' && value.trim() ? value.trim() : fallback;
  return candidate.replace(/\/+$/, '');
}

function parseArgs(argv) {
  const args = {
    accountId:
      process.env.L10N_GATE_ACCOUNT_ID ||
      process.env.DEV_ACCOUNT_ID ||
      DEFAULT_ACCOUNT_ID,
    parisBaseUrl: normalizeBaseUrl(
      process.env.L10N_GATE_PARIS_BASE_URL ||
        process.env.PARIS_BASE_URL ||
        process.env.NEXT_PUBLIC_PARIS_URL ||
        '',
      'http://localhost:3001',
    ),
    subject: process.env.L10N_GATE_SUBJECT || DEFAULT_SUBJECT,
    timeoutMs: parsePositiveInt(process.env.L10N_GATE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 'timeoutMs'),
    intervalMs: parsePositiveInt(
      process.env.L10N_GATE_INTERVAL_MS,
      DEFAULT_INTERVAL_MS,
      'intervalMs',
    ),
    stallMs: parsePositiveInt(process.env.L10N_GATE_STALL_MS, DEFAULT_STALL_MS, 'stallMs'),
    expectCount: parsePositiveInt(
      process.env.L10N_GATE_EXPECT_COUNT,
      DEFAULT_EXPECTED_INSTANCE_COUNT,
      'expectCount',
    ),
    publicIds: [],
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    if (token === '--json') {
      args.json = true;
      continue;
    }
    if (token.startsWith('--account-id=')) {
      args.accountId = token.split('=').slice(1).join('=').trim();
      continue;
    }
    if (token === '--account-id') {
      args.accountId = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (token.startsWith('--paris-base-url=')) {
      args.parisBaseUrl = normalizeBaseUrl(token.split('=').slice(1).join('='), args.parisBaseUrl);
      continue;
    }
    if (token === '--paris-base-url') {
      args.parisBaseUrl = normalizeBaseUrl(String(argv[i + 1] || ''), args.parisBaseUrl);
      i += 1;
      continue;
    }
    if (token.startsWith('--subject=')) {
      args.subject = token.split('=').slice(1).join('=').trim();
      continue;
    }
    if (token === '--subject') {
      args.subject = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (token.startsWith('--timeout-ms=')) {
      args.timeoutMs = parsePositiveInt(
        token.split('=').slice(1).join('='),
        args.timeoutMs,
        'timeoutMs',
      );
      continue;
    }
    if (token === '--timeout-ms') {
      args.timeoutMs = parsePositiveInt(argv[i + 1], args.timeoutMs, 'timeoutMs');
      i += 1;
      continue;
    }
    if (token.startsWith('--interval-ms=')) {
      args.intervalMs = parsePositiveInt(
        token.split('=').slice(1).join('='),
        args.intervalMs,
        'intervalMs',
      );
      continue;
    }
    if (token === '--interval-ms') {
      args.intervalMs = parsePositiveInt(argv[i + 1], args.intervalMs, 'intervalMs');
      i += 1;
      continue;
    }
    if (token.startsWith('--stall-ms=')) {
      args.stallMs = parsePositiveInt(token.split('=').slice(1).join('='), args.stallMs, 'stallMs');
      continue;
    }
    if (token === '--stall-ms') {
      args.stallMs = parsePositiveInt(argv[i + 1], args.stallMs, 'stallMs');
      i += 1;
      continue;
    }
    if (token.startsWith('--expect-count=')) {
      args.expectCount = parsePositiveInt(
        token.split('=').slice(1).join('='),
        args.expectCount,
        'expectCount',
      );
      continue;
    }
    if (token === '--expect-count') {
      args.expectCount = parsePositiveInt(argv[i + 1], args.expectCount, 'expectCount');
      i += 1;
      continue;
    }
    if (token.startsWith('--public-id=')) {
      const id = token.split('=').slice(1).join('=').trim();
      if (id) args.publicIds.push(id);
      continue;
    }
    if (token === '--public-id') {
      const id = String(argv[i + 1] || '').trim();
      if (!id) throw new Error('[l10n-gate] --public-id requires a value');
      args.publicIds.push(id);
      i += 1;
      continue;
    }
    throw new Error(`[l10n-gate] Unknown argument: ${token}`);
  }

  if (!args.accountId) throw new Error('[l10n-gate] accountId is required');
  if (!args.subject) throw new Error('[l10n-gate] subject is required');
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/l10n/convergence-gate.mjs [options]

Options:
  --account-id <uuid>             Account id (default: ${DEFAULT_ACCOUNT_ID})
  --paris-base-url <url>          Paris base URL (default: http://localhost:3001)
  --subject <name>                Subject query param (default: ${DEFAULT_SUBJECT})
  --public-id <id>                Explicit instance id (repeatable)
  --expect-count <n>              Expected instance count (default: ${DEFAULT_EXPECTED_INSTANCE_COUNT})
  --timeout-ms <n>                Max convergence wait (default: ${DEFAULT_TIMEOUT_MS})
  --interval-ms <n>               Poll interval (default: ${DEFAULT_INTERVAL_MS})
  --stall-ms <n>                  Max unchanged blocked window (default: ${DEFAULT_STALL_MS})
  --json                          Print JSON result only
  --help                          Show this help
  `);
}

function resolveInstanceIds(explicitIds) {
  const cleaned = explicitIds.map((id) => String(id || '').trim()).filter(Boolean);
  if (cleaned.length > 0) return Array.from(new Set(cleaned));

  const localRoot = path.join(process.cwd(), 'tokyo', 'l10n', 'instances');
  if (fs.existsSync(localRoot)) {
    const discovered = fs
      .readdirSync(localRoot)
      .filter((name) => /^wgt_(main_|curated_)/.test(name))
      .sort();
    if (discovered.length > 0) return discovered;
  }
  return [...DEFAULT_IDS_FALLBACK];
}

function resolveEnvironmentLabel(parisBaseUrl) {
  if (/localhost|127\.0\.0\.1/i.test(parisBaseUrl)) return 'local';
  return 'cloud-dev-or-remote';
}

function resolveParisDevJwt() {
  return (
    process.env.PARIS_DEV_JWT ||
    readLocalFileValue('Execution_Pipeline_Docs/paris.dev.jwt') ||
    readLocalEnvValue('PARIS_DEV_JWT') ||
    ''
  ).trim();
}

function resolveSupabaseConfig() {
  const baseUrl = (
    process.env.SUPABASE_URL ||
    readLocalEnvValue('SUPABASE_URL') ||
    ''
  ).trim();
  const serviceKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    readLocalEnvValue('SUPABASE_SERVICE_ROLE_KEY') ||
    process.env.SUPABASE_SERVICE_KEY ||
    readLocalEnvValue('SUPABASE_SERVICE_KEY') ||
    ''
  ).trim();
  if (!baseUrl || !serviceKey) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ''), serviceKey };
}

async function loadAccountRow(accountId) {
  const supabase = resolveSupabaseConfig();
  if (!supabase) return null;
  const query = new URLSearchParams({
    select: 'id,status,is_platform,tier,name,slug,website_url,l10n_locales,l10n_policy',
    id: `eq.${accountId}`,
    limit: '1',
  });
  const res = await fetch(`${supabase.baseUrl}/rest/v1/accounts?${query.toString()}`, {
    headers: {
      apikey: supabase.serviceKey,
      Authorization: `Bearer ${supabase.serviceKey}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[l10n-gate] Failed to load account ${accountId} from Supabase (${res.status}): ${text}`);
  }
  const body = await res.json().catch(() => null);
  return Array.isArray(body) ? body[0] || null : null;
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlHmac(secret, payloadBase64) {
  return crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function mintAccountCapsule(secret, account) {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1,
    typ: 'roma.account',
    iss: 'berlin',
    aud: 'roma',
    sub: 'devstudio.local',
    userId: 'devstudio.local',
    accountId: account.id,
    accountStatus: account.status,
    accountIsPlatform: account.is_platform === true,
    accountName: account.name,
    accountSlug: account.slug,
    accountWebsiteUrl: account.website_url ?? null,
    accountL10nLocales: account.l10n_locales,
    accountL10nPolicy: account.l10n_policy,
    profile: account.tier,
    role: 'owner',
    authzVersion: `devstudio.local:${account.id}:owner`,
    iat: nowSec,
    exp: nowSec + 15 * 60,
  };
  const payloadBase64 = base64UrlJson(payload);
  const signature = base64UrlHmac(secret, payloadBase64);
  return `ckac.v1.${payloadBase64}.${signature}`;
}

async function resolveAuthHeaders(accountId) {
  const token = resolveParisDevJwt();
  if (!token) {
    throw new Error('[l10n-gate] Missing PARIS_DEV_JWT (set env var, .env.local, or Execution_Pipeline_Docs/paris.dev.jwt)');
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };

  if (accountId) {
    const secret = (
      process.env.ROMA_AUTHZ_CAPSULE_SECRET ||
      readLocalFileValue('Execution_Pipeline_Docs/roma.authz.capsule.secret') ||
      readLocalEnvValue('ROMA_AUTHZ_CAPSULE_SECRET') ||
      ''
    ).trim();
    if (!secret) {
      throw new Error('[l10n-gate] Missing ROMA_AUTHZ_CAPSULE_SECRET for account-scoped product routes');
    }
    const account = await loadAccountRow(accountId);
    if (!account) {
      throw new Error(`[l10n-gate] Account ${accountId} not found; cannot mint authz capsule`);
    }
    headers['x-ck-internal-service'] = 'devstudio.local';
    headers['x-ck-authz-capsule'] = mintAccountCapsule(secret, account);
  }

  return headers;
}

function groupStatuses(rows) {
  return rows.reduce(
    (acc, row) => {
      const normalized = normalizeL10nStatusClass(row?.status);
      if (normalized === 'in_flight') acc.inFlight += 1;
      else if (normalized === 'failed') acc.failedTerminal += 1;
      else if (normalized === 'needs_enqueue') acc.needsEnqueue += 1;
      else if (normalized === 'succeeded') acc.succeeded += 1;
      return acc;
    },
    {
      inFlight: 0,
      failedTerminal: 0,
      needsEnqueue: 0,
      succeeded: 0,
    },
  );
}

function compareLocaleSets(expected, actual) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  return {
    missing: expected.filter((locale) => !actualSet.has(locale)),
    unexpected: actual.filter((locale) => !expectedSet.has(locale)),
  };
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text().catch(() => '');
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(
      `[l10n-gate] ${url} -> ${res.status} ${typeof body === 'string' ? body : JSON.stringify(body)}`,
    );
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error(`[l10n-gate] ${url} returned invalid JSON payload`);
  }
  return body;
}

async function postJson(url, headers, body = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text().catch(() => '');
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!res.ok) {
    throw new Error(
      `[l10n-gate] ${url} -> ${res.status} ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`,
    );
  }
  return payload;
}

function toCount(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toStringOrNull(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function toLocaleMap(value, label, issues) {
  const map = new Map();
  if (!Array.isArray(value)) {
    issues.push(`${label}.locales must be an array`);
    return map;
  }
  value.forEach((entry, idx) => {
    const locale = toStringOrNull(entry?.locale);
    if (!locale) {
      issues.push(`${label}.locales[${idx}].locale missing`);
      return;
    }
    if (map.has(locale)) {
      issues.push(`${label}.locales duplicate locale ${locale}`);
      return;
    }
    map.set(locale, entry);
  });
  return map;
}

function normalizeL10nStatusClass(status) {
  const normalized = toStringOrNull(status) || 'unknown';
  if (normalized === 'dirty' || normalized === 'superseded') return 'needs_enqueue';
  if (normalized === 'queued' || normalized === 'running') return 'in_flight';
  if (normalized === 'failed') return 'failed';
  if (normalized === 'succeeded') return 'succeeded';
  return normalized;
}

function diffList(left, right) {
  const rightSet = new Set(right);
  return left.filter((item) => !rightSet.has(item));
}

function evaluateSnapshot(entry) {
  const issues = [];
  if (entry.error) {
    return {
      publicId: entry.publicId,
      converged: false,
      blocked: true,
      terminalFailure: true,
      metrics: null,
      signature: 'fetch_error',
      issues: [entry.error],
    };
  }

  const localization = entry.localization;
  const l10n = entry.l10n;

  if (toStringOrNull(l10n.publicId) !== entry.publicId) {
    issues.push(`l10n.status publicId mismatch (${toStringOrNull(l10n.publicId) || 'null'})`);
  }

  const l10nFingerprint = toStringOrNull(l10n?.baseFingerprint);
  if (!l10nFingerprint) issues.push('l10n.status baseFingerprint missing');
  const baseLocale = toStringOrNull(localization?.policy?.baseLocale) || 'en';
  const allowedLocales = Array.isArray(localization?.accountLocales)
    ? localization.accountLocales.map((locale) => toStringOrNull(locale)).filter(Boolean)
    : [];
  const readyLocales = Array.isArray(localization?.readyLocales)
    ? localization.readyLocales.map((locale) => toStringOrNull(locale)).filter(Boolean)
    : [];
  const allowedNonBaseLocales = allowedLocales.filter((locale) => locale !== baseLocale);
  const readyNonBaseLocales = readyLocales.filter((locale) => locale !== baseLocale);
  const { missing: notReadyLocales, unexpected: unexpectedReadyLocales } = compareLocaleSets(
    allowedNonBaseLocales,
    readyNonBaseLocales,
  );
  if (unexpectedReadyLocales.length) {
    issues.push(`ready locales not in allowed set: ${unexpectedReadyLocales.join(', ')}`);
  }

  const l10nLocaleRows = Array.isArray(l10n?.locales) ? l10n.locales : [];
  const l10nLocaleMap = new Map();
  l10nLocaleRows.forEach((row) => {
    const locale = toStringOrNull(row?.locale);
    if (!locale) return;
    l10nLocaleMap.set(locale, row);
  });
  const missingInL10n = diffList(allowedNonBaseLocales, Array.from(l10nLocaleMap.keys()).sort());
  if (missingInL10n.length) {
    issues.push(`locales missing in l10n.status: ${missingInL10n.join(', ')}`);
  }

  const grouped = groupStatuses(l10nLocaleRows);
  const overall =
    grouped.failedTerminal > 0
      ? 'failed'
      : grouped.inFlight > 0
        ? 'translating'
        : notReadyLocales.length > 0 || grouped.needsEnqueue > 0
          ? 'pending'
          : 'ready';
  const nextAction =
    grouped.failedTerminal > 0
      ? 'inspect-failures'
      : grouped.inFlight > 0
        ? 'wait'
        : notReadyLocales.length > 0 || grouped.needsEnqueue > 0
          ? 'save-or-reconcile'
          : null;
  const stageReasons = {
    notReadyLocales,
  };

  const metrics = {
    baseLocale,
    overall,
    total: allowedNonBaseLocales.length,
    ready: readyNonBaseLocales.length,
    notReady: notReadyLocales.length,
    inFlight: grouped.inFlight,
    retrying: 0,
    failedTerminal: grouped.failedTerminal,
    needsEnqueue: grouped.needsEnqueue,
    nextAction,
    stageReasons,
  };

  const terminalFailure =
    metrics.failedTerminal > 0 || metrics.overall === 'failed';

  const converged =
    metrics.overall === 'ready' &&
    metrics.inFlight === 0 &&
    metrics.retrying === 0 &&
    metrics.needsEnqueue === 0 &&
    metrics.failedTerminal === 0 &&
    metrics.notReady === 0;

  const blocked = !converged && !terminalFailure;
  if (blocked && !metrics.nextAction) {
    issues.push('blocked pipeline is missing nextAction');
  }

  const signature = [
    metrics.overall,
    metrics.inFlight,
    metrics.retrying,
    metrics.failedTerminal,
    metrics.needsEnqueue,
    `${metrics.ready}/${metrics.total}`,
    stableStringify(metrics.stageReasons),
  ].join('|');

  return {
    publicId: entry.publicId,
    converged,
    blocked,
    terminalFailure,
    metrics,
    signature,
    issues,
  };
}

async function fetchInstanceSnapshot({ parisBaseUrl, accountId, subject, headers, publicId }) {
  const query = `subject=${encodeURIComponent(subject)}&_t=${Date.now()}`;
  const localizationUrl = `${parisBaseUrl}/api/accounts/${encodeURIComponent(
    accountId,
  )}/instances/${encodeURIComponent(publicId)}/localization?${query}`;
  const l10nUrl = `${parisBaseUrl}/api/accounts/${encodeURIComponent(
    accountId,
  )}/instances/${encodeURIComponent(publicId)}/l10n/status?${query}`;
  try {
    const [localizationPayload, l10n] = await Promise.all([
      fetchJson(localizationUrl, { headers }),
      fetchJson(l10nUrl, { headers }),
    ]);
    return { publicId, localization: localizationPayload.localization ?? null, l10n };
  } catch (error) {
    return {
      publicId,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarizeEvaluations(evaluations) {
  return {
    total: evaluations.length,
    converged: evaluations.filter((item) => item.converged).length,
    blocked: evaluations.filter((item) => item.blocked).length,
    failed: evaluations.filter((item) => item.terminalFailure || item.issues.length > 0).length,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const environment = resolveEnvironmentLabel(args.parisBaseUrl);
  const headers = await resolveAuthHeaders(args.subject === 'account' ? args.accountId : null);
  const publicIds = resolveInstanceIds(args.publicIds);

  if (args.expectCount > 0 && publicIds.length !== args.expectCount) {
    throw new Error(
      `[l10n-gate] Expected ${args.expectCount} instance ids but resolved ${publicIds.length}: ${publicIds.join(', ')}`,
    );
  }

  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const stateProgress = new Map();
  const triggeredActions = [];
  let poll = 0;
  let finalEvaluations = [];
  let failureReason = null;

  if (!args.json) {
    console.log(
      `[l10n-gate] env=${environment} paris=${args.parisBaseUrl} account=${args.accountId} subject=${args.subject}`,
    );
    console.log(`[l10n-gate] instances=${publicIds.join(', ')}`);
  }

  while (true) {
    poll += 1;
    const snapshots = await Promise.all(
      publicIds.map((publicId) =>
        fetchInstanceSnapshot({
          parisBaseUrl: args.parisBaseUrl,
          accountId: args.accountId,
          subject: args.subject,
          headers,
          publicId,
        }),
      ),
    );
    const evaluations = snapshots.map(evaluateSnapshot);
    finalEvaluations = evaluations;
    const nowMs = Date.now();

    let stalledAny = false;
    for (const evalRow of evaluations) {
      if (!evalRow.blocked || evalRow.terminalFailure || evalRow.issues.length > 0) {
        stateProgress.delete(evalRow.publicId);
        continue;
      }
      const prev = stateProgress.get(evalRow.publicId);
      if (!prev) {
        stateProgress.set(evalRow.publicId, {
          signature: evalRow.signature,
          lastChangedAtMs: nowMs,
        });
        continue;
      }
      if (prev.signature !== evalRow.signature) {
        stateProgress.set(evalRow.publicId, {
          signature: evalRow.signature,
          lastChangedAtMs: nowMs,
        });
        continue;
      }
      const unchangedMs = nowMs - prev.lastChangedAtMs;
      if (unchangedMs >= args.stallMs) {
        stalledAny = true;
        evalRow.issues.push(
          `blocked state stalled for ${unchangedMs}ms (signature: ${evalRow.signature})`,
        );
      }
    }

    const hasTerminalFailure = evaluations.some((row) => row.terminalFailure);
    const hasContractIssues = evaluations.some(
      (row) =>
        row.issues.length > 0 &&
        !row.issues.some((issue) => issue.startsWith('blocked state stalled')),
    );
    const allConverged = evaluations.every((row) => row.converged);
    const timedOut = nowMs - startedMs >= args.timeoutMs;

    const summary = summarizeEvaluations(evaluations);
    if (!args.json) {
      console.log(
        `[l10n-gate] poll=${poll} converged=${summary.converged}/${summary.total} blocked=${summary.blocked} failed=${summary.failed}`,
      );
    }

    if (allConverged) {
      failureReason = null;
      break;
    }
    if (hasTerminalFailure) {
      failureReason = 'terminal_failure';
      break;
    }
    if (hasContractIssues) {
      failureReason = 'status_contract_mismatch';
      break;
    }
    if (stalledAny) {
      failureReason = 'stalled_blocked_state';
      break;
    }
    if (timedOut) {
      failureReason = 'timeout';
      break;
    }

    await sleep(args.intervalMs);
  }

  const endedAt = new Date().toISOString();
  const endedMs = Date.now();
  const summary = summarizeEvaluations(finalEvaluations);
  const ok = !failureReason && summary.converged === summary.total;

  const result = {
    ok,
    failureReason,
    environment,
    accountId: args.accountId,
    subject: args.subject,
    parisBaseUrl: args.parisBaseUrl,
    startedAt,
    endedAt,
    durationMs: endedMs - startedMs,
    polls: poll,
    timeoutMs: args.timeoutMs,
    intervalMs: args.intervalMs,
    stallMs: args.stallMs,
    publicIds,
    triggeredActions,
    summary,
    instances: finalEvaluations.map((row) => ({
      publicId: row.publicId,
      converged: row.converged,
      blocked: row.blocked,
      terminalFailure: row.terminalFailure,
      metrics: row.metrics,
      issues: row.issues,
    })),
  };

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (ok) {
      console.log('[l10n-gate] PASS');
    } else {
      console.log(`[l10n-gate] FAIL (${failureReason || 'unknown'})`);
      finalEvaluations.forEach((row) => {
        if (!row.issues.length) return;
        console.log(`- ${row.publicId}`);
        row.issues.forEach((issue) => console.log(`  * ${issue}`));
      });
    }
    console.log('[l10n-gate] result');
    console.log(JSON.stringify(result, null, 2));
  }

  if (!ok) process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
