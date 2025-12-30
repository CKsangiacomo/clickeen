import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const bobOrigin = (process.env.BOB_ORIGIN || 'http://localhost:3000').replace(/\/+$/, '');
const promptsPath = path.join(repoRoot, 'fixtures', 'copilot', 'prompts.jsonl');

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

async function postCopilot(body) {
  const res = await fetch(`${bobOrigin}/api/ai/sdr-copilot`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
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
  const prompts = readJsonLines(promptsPath);
  const widgetFixtures = new Map();

  console.log(`[eval-copilot] Bob origin: ${bobOrigin}`);
  console.log(`[eval-copilot] Prompts: ${prompts.length}`);

  let failures = 0;
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
      const payload = await postCopilot({
        prompt: p.prompt,
        widgetType,
        sessionId,
        currentConfig: fixture.currentConfig,
        controls: fixture.controls,
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
      assert(asTrimmedString(meta.policyVersion), 'meta.policyVersion missing');
      assert(asTrimmedString(meta.dictionaryHash), 'meta.dictionaryHash missing');

      const ops = Array.isArray(payload.ops) ? payload.ops : null;
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
    } catch (err) {
      failures++;
      console.error(`${label} ❌ ${err instanceof Error ? err.message : String(err)}`);
    }
  }

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

