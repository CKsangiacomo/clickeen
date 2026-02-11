import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonLines(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !l.startsWith('#'))
    .map((l, idx) => {
      try {
        return JSON.parse(l);
      } catch (err) {
        throw new Error(`[eval-copilot] Invalid JSONL at line ${idx + 1}: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseArgs(argv) {
  const options = {
    bobOrigin: (process.env.BOB_ORIGIN || 'http://localhost:3000').replace(/\/+$/, ''),
    promptsPath: path.join(repoRoot, 'fixtures', 'copilot', 'prompts.jsonl'),
    agentId: asTrimmedString(process.env.EVAL_COPILOT_AGENT_ID),
    subject: asTrimmedString(process.env.EVAL_COPILOT_SUBJECT),
  };

  for (const raw of argv) {
    if (!raw.startsWith('--')) {
      throw new Error(`[eval-copilot] Unknown arg: ${raw}`);
    }
    const [flag, ...rest] = raw.split('=');
    const value = rest.join('=').trim();
    if (flag === '--bob-origin') {
      if (!value) throw new Error('[eval-copilot] --bob-origin requires a value');
      options.bobOrigin = value.replace(/\/+$/, '');
      continue;
    }
    if (flag === '--prompts') {
      if (!value) throw new Error('[eval-copilot] --prompts requires a value');
      options.promptsPath = path.isAbsolute(value) ? value : path.join(repoRoot, value);
      continue;
    }
    if (flag === '--agent-id') {
      options.agentId = value;
      continue;
    }
    if (flag === '--subject') {
      options.subject = value;
      continue;
    }
    throw new Error(`[eval-copilot] Unknown arg: ${raw}`);
  }

  return options;
}

async function postCopilot(args) {
  const forwardedFor = asTrimmedString(args.forwardedFor);
  const res = await fetch(`${args.bobOrigin}/api/ai/widget-copilot`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}),
    },
    body: JSON.stringify(args.body),
  });
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON, got: ${text.slice(0, 500)}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const prompts = readJsonLines(options.promptsPath);
  const widgetFixtures = new Map();

  console.log(`[eval-copilot] Bob origin: ${options.bobOrigin}`);
  console.log(`[eval-copilot] Prompts path: ${options.promptsPath}`);
  if (options.agentId) console.log(`[eval-copilot] Agent override: ${options.agentId}`);
  if (options.subject) console.log(`[eval-copilot] Subject override: ${options.subject}`);
  console.log(`[eval-copilot] Prompts: ${prompts.length}`);

  let failures = 0;
  let successes = 0;
  const intents = new Map();
  const outcomes = new Map();
  let hadOps = 0;
  for (let i = 0; i < prompts.length; i++) {
    const p = prompts[i];
    const name = asTrimmedString(p.name) || `case_${i + 1}`;
    const widgetType = asTrimmedString(p.widgetType);
    const fixturePath = path.join(repoRoot, 'fixtures', 'copilot', 'widgets', `${widgetType}.json`);
    if (!widgetFixtures.has(widgetType)) {
      widgetFixtures.set(widgetType, readJson(fixturePath));
    }
    const fixture = widgetFixtures.get(widgetType);

    const sessionId = `eval_${Date.now()}_${i}_${Math.random().toString(16).slice(2)}`;

    const label = `[eval-copilot] ${name}`;
    try {
      const forwardedFor = `203.0.113.${(i % 250) + 1}`;
      const requestAgentId = asTrimmedString(p.agentId) || options.agentId;
      const requestSubject = asTrimmedString(p.subject) || options.subject;
      const requestWorkspaceId = asTrimmedString(p.workspaceId);
      const requestProvider = asTrimmedString(p.provider);
      const requestModel = asTrimmedString(p.model);
      const payload = await postCopilot({
        bobOrigin: options.bobOrigin,
        forwardedFor,
        body: {
          prompt: p.prompt,
          widgetType,
          sessionId,
          currentConfig: fixture.currentConfig,
          controls: fixture.controls,
          ...(requestAgentId ? { agentId: requestAgentId } : {}),
          ...(requestSubject ? { subject: requestSubject } : {}),
          ...(requestWorkspaceId ? { workspaceId: requestWorkspaceId } : {}),
          ...(requestProvider ? { provider: requestProvider } : {}),
          ...(requestModel ? { model: requestModel } : {}),
        },
      });

      assert(isRecord(payload), 'Response is not an object');
      assert(asTrimmedString(payload.message), 'Response missing message');

      const meta = isRecord(payload.meta) ? payload.meta : null;
      assert(meta, 'Response missing meta');

      const intent = asTrimmedString(meta.intent);
      const expectedIntent = asTrimmedString(p.expectedIntent);
      assert(intent === expectedIntent, `intent mismatch (expected "${expectedIntent}", got "${intent}")`);

      const outcome = asTrimmedString(meta.outcome);
      const expectedOutcome = asTrimmedString(p.expectedOutcome);
      assert(outcome === expectedOutcome, `outcome mismatch (expected "${expectedOutcome}", got "${outcome}")`);

      assert(asTrimmedString(meta.promptVersion), 'meta.promptVersion missing');
      assert(asTrimmedString(meta.promptProfileVersion), 'meta.promptProfileVersion missing');
      assert(asTrimmedString(meta.promptRole), 'meta.promptRole missing');
      assert(asTrimmedString(meta.policyVersion), 'meta.policyVersion missing');
      assert(asTrimmedString(meta.dictionaryHash), 'meta.dictionaryHash missing');
      const expectedPromptRole = asTrimmedString(p.expectedPromptRole);
      if (expectedPromptRole) {
        const actualPromptRole = asTrimmedString(meta.promptRole);
        assert(
          actualPromptRole === expectedPromptRole,
          `promptRole mismatch (expected "${expectedPromptRole}", got "${actualPromptRole}")`,
        );
      }

      const ops = Array.isArray(payload.ops) ? payload.ops : null;
      if (ops && ops.length > 0) hadOps += 1;
      if (p.expectOps === true) {
        assert(ops && ops.length > 0, 'Expected ops, got none');
      } else if (p.expectOps === false) {
        assert(!ops || ops.length === 0, 'Expected no ops');
      }

      const expectTextIncludes = asTrimmedString(p.expectTextIncludes);
      if (expectTextIncludes) {
        assert(
          String(payload.message).toLowerCase().includes(expectTextIncludes.toLowerCase()),
          `message did not include "${expectTextIncludes}"`,
        );
      }

      console.log(`${label} ✅`);
      successes++;
      intents.set(intent, (intents.get(intent) || 0) + 1);
      outcomes.set(outcome, (outcomes.get(outcome) || 0) + 1);
    } catch (err) {
      failures++;
      console.error(`${label} ❌ ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const total = prompts.length;
  const passRate = total > 0 ? (successes / total) * 100 : 0;
  console.log('');
  console.log('[eval-copilot] Summary');
  console.log(`  Passed: ${successes}/${total} (${passRate.toFixed(1)}%)`);
  console.log(`  Ops returned: ${hadOps}/${total}`);
  console.log('  Intents:', Object.fromEntries([...intents.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])))));
  console.log('  Outcomes:', Object.fromEntries([...outcomes.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])))));

  if (failures > 0) {
    console.error(`[eval-copilot] Failed: ${failures}/${prompts.length}`);
    process.exit(1);
  }
  console.log('[eval-copilot] OK');
}

main().catch((err) => {
  console.error('[eval-copilot] Unhandled error', err);
  process.exit(1);
});
