import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parseLimitsSpec } from './limits';

const repoRoot = path.resolve(process.cwd(), '../..');
const widgetsRoot = path.join(repoRoot, 'tokyo/product/widgets');

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

test('widget limits map to ck-policy keys and do not define tier truth', () => {
  const widgetNames = readdirSync(widgetsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== 'shared')
    .sort((a, b) => a.localeCompare(b));

  assert.deepEqual(widgetNames, ['countdown', 'faq', 'logoshowcase']);

  for (const widgetName of widgetNames) {
    const limitsPath = path.join(widgetsRoot, widgetName, 'limits.json');
    const raw = readJson(limitsPath);
    assert(isRecord(raw), `${widgetName}/limits.json must be an object`);
    assert(!('tiers' in raw), `${widgetName}/limits.json must not define tiers`);
    assert(!('entitlements' in raw), `${widgetName}/limits.json must not define entitlements`);
    assert(!('values' in raw), `${widgetName}/limits.json must not define tier values`);

    const parsed = parseLimitsSpec(raw);
    assert(parsed, `${widgetName}/limits.json must parse`);
    assert(parsed.limits.length > 0, `${widgetName}/limits.json must declare at least one mapping`);
  }
});
