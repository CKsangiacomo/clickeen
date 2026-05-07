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
const aiRuntimePolicy = read('packages/ck-policy/src/ai-runtime.ts');
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

const legacyOutcomeEnvelopeGuard = ['isSanfranciscoCom', 'mand', 'Message(parsedBody)'].join('');
assert(!sanFranciscoIndex.includes(legacyOutcomeEnvelopeGuard), 'outcome handler still validates the deleted command envelope');
assert(!sanFranciscoIndex.includes('parsedBody.payload'), 'outcome handler still unwraps command payload');
assert(!romaCopilot.includes("command: 'ai.outcome.attach'"), 'Roma still wraps outcome as ai.outcome.attach command');
assert(romaCopilot.includes('const bodyText = JSON.stringify(body);'), 'Roma does not sign/send direct outcome body');

assert(!sanFranciscoTelemetry.includes('function inferScopeFromPath'), 'telemetry still infers widget scope from path prefixes');
assert(aiRuntimePolicy.includes('rawSamplePercent: 20'), 'paid detailed-learning sample rate is not fixed at 20% in runtime policy');
assert(aiRuntimePolicy.includes('const LOW_CAPTURE') && aiRuntimePolicy.includes('rawSamplePercent: 0'), 'free/ineligible runtime policy can still capture raw learning samples');
assert(sanFranciscoTelemetry.includes('function hasPaidLearningEntitlement'), 'San Francisco detailed learning is not gated through the paid-entitlement helper');
assert(sanFranciscoTelemetry.includes("e.agentId !== 'cs.widget.copilot.v1'") && sanFranciscoTelemetry.includes("e.subject.kind !== 'user'"), 'San Francisco detailed learning is not limited to paid user Builder copilot events');
assert(sanFranciscoTelemetry.includes('e.ai?.learningCapture?.rawSamplePercent'), 'San Francisco detailed learning ignores signed learningCapture policy');
assert(sanFranciscoIndex.includes('learning/${this.env.ENVIRONMENT'), 'raw learning samples do not use bounded learning/ R2 prefix');
assert(!sanFranciscoIndex.includes('logs/${this.env.ENVIRONMENT'), 'queue still writes raw logs for every execution');
assert(!sanFranciscoPackage.includes('wrangler d1 migrations apply'), 'PRD85A should not make Worker deploy depend on D1 migration permissions');

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('[prd85a] learning/outcome contract checks passed');
