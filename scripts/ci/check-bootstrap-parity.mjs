#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const USAGE = `
Usage:
  node scripts/ci/check-bootstrap-parity.mjs --env <local|cloud-dev>
`;

function parseArgs(argv) {
  const args = {
    env: 'local',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      console.log(USAGE.trim());
      process.exit(0);
    }
    if (token === '--env') {
      const raw = String(argv[i + 1] || '').trim();
      if (!raw) throw new Error('Missing value for --env');
      if (raw !== 'local' && raw !== 'cloud-dev') {
        throw new Error(`Invalid --env value: ${raw}`);
      }
      args.env = raw;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function readFile(relPath) {
  const abs = path.join(repoRoot, relPath);
  return fs.readFileSync(abs, 'utf8');
}

function assertIncludes(file, tokens) {
  const contents = readFile(file);
  for (const token of tokens) {
    if (!contents.includes(token)) {
      throw new Error(`[bootstrap-parity] ${file} missing required token: ${token}`);
    }
  }
}

function assertExcludes(file, tokens) {
  const contents = readFile(file);
  for (const token of tokens) {
    if (contents.includes(token)) {
      throw new Error(`[bootstrap-parity] ${file} contains forbidden token: ${token}`);
    }
  }
}

function assertFileMissing(relPath) {
  const abs = path.join(repoRoot, relPath);
  if (fs.existsSync(abs)) {
    throw new Error(`[bootstrap-parity] legacy file must not exist: ${relPath}`);
  }
}

function assertBootstrapProxyContract() {
  assertIncludes('roma/app/api/bootstrap/route.ts', [
    '/api/roma/bootstrap',
    'proxyToParis(request, {',
  ]);
  assertIncludes('roma/lib/api/paris-proxy.ts', [
    "cache: 'no-store'",
    "response.headers.set('cache-control', 'no-store')",
    "response.headers.set('cdn-cache-control', 'no-store')",
    "response.headers.set('cloudflare-cdn-cache-control', 'no-store')",
  ]);
  assertFileMissing('roma/app/api/me/route.ts');
}

function assertBootstrapEnvelopeContract() {
  assertIncludes('paris/src/domains/roma/widgets-bootstrap.ts', [
    'export async function handleRomaBootstrap',
    'resolveIdentityMePayload',
    'mintRomaAccountAuthzCapsule',
    'resolveAccountEntitlementsSnapshot',
    'accountCapsule',
    'entitlements',
    'export async function handleRomaWidgets',
    'export async function handleRomaTemplates',
  ]);
}

function assertRomaBootstrapClientContract() {
  assertIncludes('roma/components/use-roma-me.ts', [
    'authz?: {',
    'accountCapsule?: string | null;',
    'entitlements?: {',
    'const ROMA_ME_SUCCESS_FALLBACK_TTL_MS = 5 * 60_000;',
    "fetch(`/api/bootstrap${search}`, { cache: 'no-store' })",
  ]);
  assertIncludes('bob/app/api/roma/bootstrap/route.ts', [
    "path: '/api/roma/bootstrap'",
    'proxyToParisRoute(request, {',
  ]);
}

function assertHostParityContract() {
  assertIncludes('admin/src/html/tools/dev-widget-workspace.html', [
    "window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';",
    "const defaultBob = isLocal ? 'http://localhost:3000' : 'https://bob.dev.clickeen.com';",
  ]);
  assertExcludes('admin/src/html/tools/dev-widget-workspace.html', ['bob-dev.pages.dev']);

  assertIncludes('roma/components/builder-domain.tsx', [
    'NEXT_PUBLIC_BOB_URL',
    'process.env.NODE_ENV ===',
  ]);
  assertExcludes('roma/components/builder-domain.tsx', ['window.location.hostname']);
}

function assertAdminSubjectParityContract() {
  assertExcludes('paris/src/domains/instances/index.ts', ["profile: 'devstudio'"]);
  assertExcludes('scripts/l10n/convergence-gate.mjs', ["const DEFAULT_SUBJECT = 'devstudio'"]);
  assertExcludes('bob/lib/session/useWidgetSession.tsx', ["rawSubjectMode === 'devstudio'"]);
}

function assertDevstudioLocalStageGate() {
  assertIncludes('bob/lib/api/paris/proxy-helpers.ts', ["const stage = (process.env.ENV_STAGE ?? '').trim().toLowerCase();"]);
  assertIncludes('bob/lib/api/paris/proxy-helpers.ts', ["if (stage === 'local') {"]);
  assertIncludes('bob/lib/api/paris/proxy-helpers.ts', ["if (resolveRequestSurface(request) === 'devstudio') {"]);
  assertIncludes('scripts/dev-up.sh', ['ENV_STAGE=local']);
}

function assertRuntimeParityWorkflowWiring() {
  const requiredRuntimeAuthCmd = 'node scripts/ci/runtime-parity/index.mjs --env cloud-dev --mode auth';
  const requiredRuntimePublicCmd = 'node scripts/ci/runtime-parity/index.mjs --env cloud-dev --mode public';
  assertIncludes('.github/workflows/cloud-dev-workers.yml', [requiredRuntimeAuthCmd, requiredRuntimePublicCmd]);
  assertIncludes('.github/workflows/cloud-dev-roma-app.yml', [requiredRuntimeAuthCmd, requiredRuntimePublicCmd]);
}

function assertBobBootstrapBoundaryWorkflowWiring() {
  const requiredBoundaryCmd = 'pnpm test:bob-bootstrap-boundary';
  assertIncludes('.github/workflows/pr-architecture-gates.yml', [requiredBoundaryCmd]);
  assertIncludes('.github/workflows/cloud-dev-workers.yml', [requiredBoundaryCmd]);
  assertIncludes('.github/workflows/cloud-dev-roma-app.yml', [requiredBoundaryCmd]);
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    console.error(USAGE.trim());
    process.exit(2);
  }

  assertBootstrapProxyContract();
  assertBootstrapEnvelopeContract();
  assertRomaBootstrapClientContract();
  assertHostParityContract();
  assertAdminSubjectParityContract();
  assertDevstudioLocalStageGate();
  assertBobBootstrapBoundaryWorkflowWiring();

  if (args.env === 'cloud-dev') {
    assertRuntimeParityWorkflowWiring();
  }

  console.log(`[bootstrap-parity] OK env=${args.env}`);
}

main();
