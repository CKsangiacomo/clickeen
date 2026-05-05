import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();

function read(path) {
  return readFileSync(join(repo, path), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    console.error(`[prd85a] ${message}`);
    process.exitCode = 1;
  }
}

const sanFranciscoIndex = read('sanfrancisco/src/index.ts');
const sanFranciscoTelemetry = read('sanfrancisco/src/telemetry.ts');
const sanFranciscoTypes = read('sanfrancisco/src/types.ts');
const sanFranciscoPackage = read('sanfrancisco/package.json');
const romaCopilot = read('roma/lib/ai/account-copilot.ts');
const bobCopilot = read('bob/components/CopilotPane.tsx');

for (const [path, source] of [
  ['sanfrancisco/src/telemetry.ts', sanFranciscoTelemetry],
  ['sanfrancisco/src/types.ts', sanFranciscoTypes],
  ['roma/lib/ai/account-copilot.ts', romaCopilot],
  ['bob/components/CopilotPane.tsx', bobCopilot],
]) {
  assert(!source.includes('ux_keep'), `${path} still contains legacy ux_keep`);
  assert(!source.includes('ux_undo'), `${path} still contains legacy ux_undo`);
}

assert(!sanFranciscoIndex.includes('isSanfranciscoCommandMessage(parsedBody)'), 'outcome handler still validates sf.command envelope');
assert(!sanFranciscoIndex.includes('parsedBody.payload'), 'outcome handler still unwraps command payload');
assert(!romaCopilot.includes("command: 'ai.outcome.attach'"), 'Roma still wraps outcome as ai.outcome.attach command');
assert(romaCopilot.includes('const bodyText = JSON.stringify(body);'), 'Roma does not sign/send direct outcome body');

assert(!sanFranciscoTelemetry.includes('function inferScopeFromPath'), 'telemetry still infers widget scope from path prefixes');
assert(sanFranciscoTelemetry.includes('const DETAILED_LEARNING_SAMPLE_PERCENT = 20'), 'paid detailed-learning sample rate is not fixed at 20%');
assert(sanFranciscoTelemetry.includes("profile !== 'free_low'"), 'San Francisco detailed learning is not gated away from free profile');
assert(sanFranciscoIndex.includes('learning/${this.env.ENVIRONMENT'), 'raw learning samples do not use bounded learning/ R2 prefix');
assert(!sanFranciscoIndex.includes('logs/${this.env.ENVIRONMENT'), 'queue still writes raw logs for every execution');
assert(!sanFranciscoPackage.includes('wrangler d1 migrations apply'), 'PRD85A should not make Worker deploy depend on D1 migration permissions');

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('[prd85a] learning/outcome contract checks passed');
