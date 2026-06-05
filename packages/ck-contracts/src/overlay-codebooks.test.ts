import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  listWidgetOverlayCodebook,
  resolveWidgetOverlayCode,
} from './overlay-codebooks.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

test('widget overlay codebook covers system widgets exactly once', () => {
  const widgetTypes = new Set(
    fs
      .readdirSync(path.join(repoRoot, 'tokyo/product/widgets'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => name !== 'shared')
      .filter((name) => fs.existsSync(path.join(repoRoot, 'tokyo/product/widgets', name, 'spec.json'))),
  );
  const codebook = listWidgetOverlayCodebook();
  const codebookWidgetTypes = new Set(codebook.map((entry) => entry.widgetType));
  const codes = codebook.map((entry) => entry.code);

  assert.deepEqual([...codebookWidgetTypes].sort(), [...widgetTypes].sort());
  assert.equal(new Set(codes).size, codes.length);
  for (const widgetType of widgetTypes) {
    assert.match(resolveWidgetOverlayCode(widgetType) ?? '', /^[0-9A-Z]{3}$/);
  }
});
