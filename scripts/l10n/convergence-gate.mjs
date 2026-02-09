#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_EXPECTED_INSTANCE_COUNT = 4;
const DEFAULT_TIMEOUT_MS = 3 * 60_000;
const DEFAULT_INTERVAL_MS = 5_000;
const DEFAULT_STALL_MS = 90_000;
const DEFAULT_SUBJECT = 'devstudio';
const DEFAULT_IDS_FALLBACK = [
  'wgt_main_countdown',
  'wgt_main_faq',
  'wgt_main_logoshowcase',
  'wgt_curated_faq.lightblurs.v01',
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

function normalizeBaseUrl(value, fallback) {
  const candidate = typeof value === 'string' && value.trim() ? value.trim() : fallback;
  return candidate.replace(/\/+$/, '');
}

function parseArgs(argv) {
  const args = {
    workspaceId:
      process.env.L10N_GATE_WORKSPACE_ID || process.env.DEV_WORKSPACE_ID || DEFAULT_WORKSPACE_ID,
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
    triggerCuratedEnqueue:
      String(process.env.L10N_GATE_TRIGGER_CURATED_ENQUEUE || '').trim() === '1',
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
    if (token === '--trigger-curated-enqueue') {
      args.triggerCuratedEnqueue = true;
      continue;
    }
    if (token.startsWith('--workspace-id=')) {
      args.workspaceId = token.split('=').slice(1).join('=').trim();
      continue;
    }
    if (token === '--workspace-id') {
      args.workspaceId = String(argv[i + 1] || '').trim();
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

  if (!args.workspaceId) throw new Error('[l10n-gate] workspaceId is required');
  if (!args.subject) throw new Error('[l10n-gate] subject is required');
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/l10n/convergence-gate.mjs [options]

Options:
  --workspace-id <uuid>           Workspace id (default: ${DEFAULT_WORKSPACE_ID})
  --paris-base-url <url>          Paris base URL (default: http://localhost:3001)
  --subject <name>                Subject query param (default: ${DEFAULT_SUBJECT})
  --public-id <id>                Explicit instance id (repeatable)
  --expect-count <n>              Expected instance count (default: ${DEFAULT_EXPECTED_INSTANCE_COUNT})
  --timeout-ms <n>                Max convergence wait (default: ${DEFAULT_TIMEOUT_MS})
  --interval-ms <n>               Poll interval (default: ${DEFAULT_INTERVAL_MS})
  --stall-ms <n>                  Max unchanged blocked window (default: ${DEFAULT_STALL_MS})
  --trigger-curated-enqueue       Auto-trigger enqueue-selected for curated instances before polling
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

function resolveAuthHeaders() {
  const token = (process.env.PARIS_DEV_JWT || readLocalEnvValue('PARIS_DEV_JWT') || '').trim();
  if (!token) {
    throw new Error('[l10n-gate] Missing PARIS_DEV_JWT (set env var or .env.local)');
  }
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
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

  const publish = entry.publish;
  const l10n = entry.l10n;

  if (toStringOrNull(publish.publicId) !== entry.publicId) {
    issues.push(`publish.status publicId mismatch (${toStringOrNull(publish.publicId) || 'null'})`);
  }
  if (toStringOrNull(l10n.publicId) !== entry.publicId) {
    issues.push(`l10n.status publicId mismatch (${toStringOrNull(l10n.publicId) || 'null'})`);
  }

  const publishFingerprint = toStringOrNull(publish?.revision?.l10nBaseFingerprint);
  const l10nFingerprint = toStringOrNull(l10n?.baseFingerprint);
  if (!publishFingerprint) issues.push('publish.status revision.l10nBaseFingerprint missing');
  if (!l10nFingerprint) issues.push('l10n.status baseFingerprint missing');
  if (publishFingerprint && l10nFingerprint && publishFingerprint !== l10nFingerprint) {
    issues.push('baseFingerprint mismatch between publish.status and l10n.status');
  }

  const publishLocales = toLocaleMap(publish?.locales, 'publish.status', issues);
  const l10nLocales = toLocaleMap(l10n?.locales, 'l10n.status', issues);

  const publishLocaleKeys = Array.from(publishLocales.keys()).sort();
  const publishNonBaseLocaleKeys = publishLocaleKeys.filter((locale) => locale !== 'en');
  const l10nLocaleKeys = Array.from(l10nLocales.keys()).sort();
  const missingInL10n = diffList(publishNonBaseLocaleKeys, l10nLocaleKeys);
  const missingInPublish = diffList(l10nLocaleKeys, publishNonBaseLocaleKeys);
  if (missingInL10n.length)
    issues.push(`locales missing in l10n.status: ${missingInL10n.join(', ')}`);
  if (missingInPublish.length)
    issues.push(`locales missing in publish.status: ${missingInPublish.join(', ')}`);

  publishNonBaseLocaleKeys.forEach((locale) => {
    const publishLocale = publishLocales.get(locale);
    const l10nLocale = l10nLocales.get(locale);
    if (!l10nLocale) return;
    const publishState = toStringOrNull(publishLocale?.l10n?.status);
    const l10nState = toStringOrNull(l10nLocale?.status);
    const publishClass = normalizeL10nStatusClass(publishState);
    const l10nClass = normalizeL10nStatusClass(l10nState);
    if (publishState && l10nState && publishClass !== l10nClass) {
      issues.push(`locale ${locale} status mismatch publish=${publishState} l10n=${l10nState}`);
    }
  });

  const summary = publish?.summary || {};
  const l10nSummary = summary?.l10n || {};
  const overall = toStringOrNull(publish?.pipeline?.overall) || 'unknown';
  const nextAction = toStringOrNull(publish?.pipeline?.l10n?.nextAction?.key);
  const stageReasons =
    publish?.pipeline?.l10n?.stageReasons &&
    typeof publish.pipeline.l10n.stageReasons === 'object' &&
    !Array.isArray(publish.pipeline.l10n.stageReasons)
      ? publish.pipeline.l10n.stageReasons
      : {};
  const instanceStatus = toStringOrNull(publish?.instanceStatus) || 'unknown';

  const metrics = {
    instanceStatus,
    overall,
    pointerFlipped: toCount(summary.pointerFlipped),
    total: toCount(summary.total),
    awaitingL10n: toCount(summary.awaitingL10n),
    awaitingSnapshot: toCount(summary.awaitingSnapshot),
    inFlight: toCount(l10nSummary.inFlight),
    retrying: toCount(l10nSummary.retrying),
    failedTerminal: toCount(l10nSummary.failedTerminal),
    needsEnqueue: toCount(l10nSummary.needsEnqueue),
    nextAction,
    stageReasons,
  };

  if (metrics.instanceStatus !== 'published') {
    issues.push(`instance status is ${metrics.instanceStatus}, expected published`);
  }

  const terminalFailure =
    metrics.failedTerminal > 0 || toCount(summary.failed) > 0 || metrics.overall === 'failed';

  const converged =
    metrics.instanceStatus === 'published' &&
    metrics.overall === 'ready' &&
    metrics.awaitingL10n === 0 &&
    metrics.awaitingSnapshot === 0 &&
    metrics.inFlight === 0 &&
    metrics.retrying === 0 &&
    metrics.needsEnqueue === 0 &&
    metrics.failedTerminal === 0 &&
    metrics.total > 0 &&
    metrics.pointerFlipped === metrics.total;

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
    metrics.awaitingL10n,
    metrics.awaitingSnapshot,
    `${metrics.pointerFlipped}/${metrics.total}`,
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

async function fetchInstanceSnapshot({ parisBaseUrl, workspaceId, subject, headers, publicId }) {
  const query = `subject=${encodeURIComponent(subject)}&_t=${Date.now()}`;
  const publishUrl = `${parisBaseUrl}/api/workspaces/${encodeURIComponent(
    workspaceId,
  )}/instances/${encodeURIComponent(publicId)}/publish/status?${query}`;
  const l10nUrl = `${parisBaseUrl}/api/workspaces/${encodeURIComponent(
    workspaceId,
  )}/instances/${encodeURIComponent(publicId)}/l10n/status?${query}`;
  try {
    const [publish, l10n] = await Promise.all([
      fetchJson(publishUrl, { headers }),
      fetchJson(l10nUrl, { headers }),
    ]);
    return { publicId, publish, l10n };
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

function isCuratedLikePublicId(publicId) {
  return publicId.startsWith('wgt_curated_') || publicId.startsWith('wgt_main_');
}

async function triggerCuratedEnqueue({ evaluations, parisBaseUrl, workspaceId, subject, headers }) {
  const triggered = [];
  for (const row of evaluations) {
    if (!isCuratedLikePublicId(row.publicId)) continue;
    if ((row.metrics?.overall ?? '') === 'ready') continue;
    const url = `${parisBaseUrl}/api/workspaces/${encodeURIComponent(
      workspaceId,
    )}/instances/${encodeURIComponent(row.publicId)}/l10n/enqueue-selected?subject=${encodeURIComponent(
      subject,
    )}`;
    const payload = await postJson(url, headers, {});
    triggered.push({
      publicId: row.publicId,
      queued: toCount(payload?.queued),
      skipped: toCount(payload?.skipped),
      ok: Boolean(payload?.ok),
    });
  }
  return triggered;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const environment = resolveEnvironmentLabel(args.parisBaseUrl);
  const headers = resolveAuthHeaders();
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
      `[l10n-gate] env=${environment} paris=${args.parisBaseUrl} workspace=${args.workspaceId} subject=${args.subject}`,
    );
    console.log(`[l10n-gate] instances=${publicIds.join(', ')}`);
  }

  while (true) {
    poll += 1;
    const snapshots = await Promise.all(
      publicIds.map((publicId) =>
        fetchInstanceSnapshot({
          parisBaseUrl: args.parisBaseUrl,
          workspaceId: args.workspaceId,
          subject: args.subject,
          headers,
          publicId,
        }),
      ),
    );
    const evaluations = snapshots.map(evaluateSnapshot);
    finalEvaluations = evaluations;
    const nowMs = Date.now();

    if (poll === 1 && args.triggerCuratedEnqueue) {
      const triggered = await triggerCuratedEnqueue({
        evaluations,
        parisBaseUrl: args.parisBaseUrl,
        workspaceId: args.workspaceId,
        subject: args.subject,
        headers,
      });
      triggeredActions.push(...triggered);
      if (!args.json && triggered.length > 0) {
        console.log(
          `[l10n-gate] triggered curated enqueue: ${triggered
            .map((item) => `${item.publicId}(queued=${item.queued},skipped=${item.skipped})`)
            .join(', ')}`,
        );
      }
      if (triggered.length > 0) {
        await sleep(Math.min(args.intervalMs, 2_000));
        continue;
      }
    }

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
    workspaceId: args.workspaceId,
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
