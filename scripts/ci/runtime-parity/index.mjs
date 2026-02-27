#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { ensureRuntimeProfileAuth, resolveRuntimeProfile } from './env-profiles.mjs';
import { runBootstrapParityScenario } from './scenarios/bootstrap-parity.mjs';
import { runInstanceOpenParityScenario } from './scenarios/instance-open-parity.mjs';
import { runAssetLifecycleParityScenario } from './scenarios/asset-lifecycle-parity.mjs';
import { runRomaAssetsUiCopyScenario } from './scenarios/roma-assets-ui-copy.mjs';
import { runPublishImmediacyScenario } from './scenarios/publish-immediacy.mjs';
import { runPublicAccessParityScenario } from './scenarios/public-access-parity.mjs';
import { buildParityDiff } from './diff-reporter.mjs';

const USAGE = `
Usage:
  node scripts/ci/runtime-parity/index.mjs --env <local|cloud-dev> [--mode <auth|public>] [--json-out <file>] [--compare <file>]

Preferred explicit env vars (auth mode):
  RUNTIME_PARITY_AUTH_BEARER_CLOUD
                                    Auth bearer for cloud-dev probe user (preferred explicit bearer)
  RUNTIME_PARITY_AUTH_BEARER         Auth bearer fallback (used when env-specific bearer is not set)
  (If bearer vars are absent, runtime-parity auto-mints a probe bearer via Roma session routes + probe credentials.)

Optional env vars:
  RUNTIME_PARITY_TOKYO_DEV_JWT
  RUNTIME_PARITY_AUTH_BEARER_LOCAL
  RUNTIME_PARITY_PROBE_EMAIL
  RUNTIME_PARITY_PROBE_PASSWORD
  RUNTIME_PARITY_PROBE_EMAIL_LOCAL
  RUNTIME_PARITY_PROBE_PASSWORD_LOCAL
  RUNTIME_PARITY_PROBE_EMAIL_CLOUD
  RUNTIME_PARITY_PROBE_PASSWORD_CLOUD
  RUNTIME_PARITY_BOB_BASE_URL
  RUNTIME_PARITY_ROMA_BASE_URL
  RUNTIME_PARITY_PARIS_BASE_URL
  RUNTIME_PARITY_TOKYO_BASE_URL
  RUNTIME_PARITY_VENICE_BASE_URL
  RUNTIME_PARITY_PUBLIC_ID
  RUNTIME_PARITY_PUBLISH_PUBLIC_ID
  RUNTIME_PARITY_ACCOUNT_ID
  RUNTIME_PARITY_WORKSPACE_ID
  RUNTIME_PARITY_PUBLISH_BUDGET_MS
`;

function parseArgs(argv) {
  const args = {
    env: 'local',
    mode: 'auth',
    jsonOut: '',
    compare: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      console.log(USAGE.trim());
      process.exit(0);
    }
    if (token === '--env') {
      const value = String(argv[i + 1] || '').trim();
      if (!value) throw new Error('Missing value for --env');
      args.env = value;
      i += 1;
      continue;
    }
    if (token === '--mode') {
      const value = String(argv[i + 1] || '').trim().toLowerCase();
      if (value !== 'auth' && value !== 'public') {
        throw new Error(`Invalid --mode value: ${value}`);
      }
      args.mode = value;
      i += 1;
      continue;
    }
    if (token === '--json-out') {
      args.jsonOut = String(argv[i + 1] || '').trim();
      if (!args.jsonOut) throw new Error('Missing value for --json-out');
      i += 1;
      continue;
    }
    if (token === '--compare') {
      args.compare = String(argv[i + 1] || '').trim();
      if (!args.compare) throw new Error('Missing value for --compare');
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function printScenario(result) {
  const icon = result.passed ? 'PASS' : 'FAIL';
  console.log(`[runtime-parity] ${icon} ${result.scenario}`);
  for (const check of result.checks) {
    const checkIcon = check.pass ? '  ✓' : '  ✗';
    console.log(`${checkIcon} ${check.name}`);
    if (!check.pass && Object.prototype.hasOwnProperty.call(check, 'actual')) {
      console.log(`    actual=${JSON.stringify(check.actual)}`);
    }
  }
}

function maybeWriteJson(filePath, payload) {
  if (!filePath) return;
  const abs = path.resolve(process.cwd(), filePath);
  const dir = path.dirname(abs);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(payload, null, 2));
  console.log(`[runtime-parity] Wrote report: ${path.relative(process.cwd(), abs)}`);
}

function maybeLoadJson(filePath) {
  if (!filePath) return null;
  const abs = path.resolve(process.cwd(), filePath);
  const raw = fs.readFileSync(abs, 'utf8');
  return JSON.parse(raw);
}

async function runScenario(name, runner, payload) {
  try {
    const result = await runner(payload);
    return {
      scenario: name,
      passed: Boolean(result.passed),
      checks: Array.isArray(result.checks) ? result.checks : [],
      fingerprint: result.fingerprint ?? null,
      contextUpdate: result.contextUpdate ?? null,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      scenario: name,
      passed: false,
      checks: [
        {
          name: `${name} execution`,
          pass: false,
          actual: detail,
        },
      ],
      fingerprint: { error: detail },
      contextUpdate: null,
    };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const resolvedProfile = resolveRuntimeProfile(args.env, { mode: args.mode });
  const profile = await ensureRuntimeProfileAuth(resolvedProfile);
  const startedAt = new Date().toISOString();

  const context = {
    accountId: '',
    workspaceId: '',
    probePublicId: profile.probePublicId || '',
  };

  const scenarioRunners =
    args.mode === 'auth'
      ? [
          ['bootstrap-parity', runBootstrapParityScenario],
          ['instance-open-parity', runInstanceOpenParityScenario],
          ['asset-lifecycle-parity', runAssetLifecycleParityScenario],
          ['roma-assets-ui-copy', runRomaAssetsUiCopyScenario],
          ['publish-immediacy', runPublishImmediacyScenario],
        ]
      : [['public-access-parity', runPublicAccessParityScenario]];

  const scenarios = [];
  for (const [name, runner] of scenarioRunners) {
    const result = await runScenario(name, runner, { profile, context });
    if (result.contextUpdate && typeof result.contextUpdate === 'object') {
      Object.assign(context, result.contextUpdate);
    }
    scenarios.push(result);
    printScenario(result);
  }

  const report = {
    suite: 'runtime-parity',
    env: profile.name,
    mode: profile.mode,
    startedAt,
    finishedAt: new Date().toISOString(),
    profile: {
      mode: profile.mode,
      bobBaseUrl: profile.bobBaseUrl,
      romaBaseUrl: profile.romaBaseUrl,
      parisBaseUrl: profile.parisBaseUrl,
      tokyoBaseUrl: profile.tokyoBaseUrl,
      veniceBaseUrl: profile.veniceBaseUrl,
      publishLatencyBudgetMs: profile.publishLatencyBudgetMs,
    },
    context,
    scenarios,
    passed: scenarios.every((scenario) => scenario.passed),
  };

  let parityDiff = null;
  if (args.compare) {
    const compared = maybeLoadJson(args.compare);
    const comparedMode = typeof compared?.mode === 'string' ? compared.mode : '';
    if (comparedMode && comparedMode !== report.mode) {
      throw new Error(`[runtime-parity] --compare report mode mismatch: current=${report.mode} compared=${comparedMode}`);
    }
    parityDiff = buildParityDiff(report, compared);
    report.parityDiff = parityDiff;
    console.log(`[runtime-parity] parityDiff=${parityDiff.pass ? 'PASS' : 'FAIL'} compare=${args.compare}`);
  }

  maybeWriteJson(args.jsonOut, report);

  if (!report.passed) {
    console.error('[runtime-parity] FAIL (scenario checks)');
    process.exit(1);
  }
  if (parityDiff && !parityDiff.pass) {
    console.error('[runtime-parity] FAIL (cross-env parity diff)');
    process.exit(1);
  }

  console.log(`[runtime-parity] OK env=${profile.name}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  console.error(USAGE.trim());
  process.exit(2);
});
