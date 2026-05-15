import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  listLanguageOverlayCodebook,
  listWidgetOverlayCodebook,
  resolveLanguageOverlayCode,
  resolveWidgetOverlayCode,
} from './overlay-codebooks.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

test('widget overlay codebook covers the widget catalog exactly once', () => {
  const manifestPath = path.join(repoRoot, 'tokyo/product/widgets/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    widgets?: Array<{ widgetType?: unknown }>;
  };
  const widgetTypes = new Set(
    (manifest.widgets ?? []).flatMap((entry) => (typeof entry.widgetType === 'string' ? [entry.widgetType] : [])),
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

test('language overlay codebook covers every supported account locale', () => {
  const localesPath = path.join(repoRoot, 'packages/l10n/locales.json');
  const locales = JSON.parse(fs.readFileSync(localesPath, 'utf8')) as Array<{ code?: unknown }>;
  const localeCodes = new Set(locales.flatMap((entry) => (typeof entry.code === 'string' ? [entry.code] : [])));
  const codebook = listLanguageOverlayCodebook();
  const codebookLocales = new Set(codebook.map((entry) => entry.locale));
  const codes = codebook.map((entry) => entry.code);

  assert.deepEqual([...codebookLocales].sort(), [...localeCodes].sort());
  assert.equal(new Set(codes).size, codes.length);
  for (const locale of localeCodes) {
    assert.match(resolveLanguageOverlayCode(locale) ?? '', /^[0-9A-Z]{4}$/);
  }
});
