import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileWidgetServer } from '../../bob/lib/compiler.server';
import { compileControlsFromPanels } from '../../bob/lib/compiler/controls';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const widgetsRoot = path.join(repoRoot, 'tokyo/product/widgets');

if (!process.env.NEXT_PUBLIC_TOKYO_URL) {
  process.env.NEXT_PUBLIC_TOKYO_URL = 'https://tokyo.dev.clickeen.com';
}

function discoverWidgetSpecs(): Array<{ widgetType: string; specPath: string }> {
  return fs
    .readdirSync(widgetsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'shared')
    .map((entry) => ({ widgetType: entry.name, specPath: path.join(widgetsRoot, entry.name, 'spec.json') }))
    .filter((entry) => fs.existsSync(entry.specPath))
    .sort((a, b) => a.widgetType.localeCompare(b.widgetType));
}

function assertAliasCollisionFails(): void {
  try {
    compileControlsFromPanels({
      panels: [
        {
          id: 'content',
          label: 'Content',
          html: [
            '<tooldrawer-field type="textfield" path="content.first" label="Social share" />',
            '<tooldrawer-field type="textfield" path="content.second" label="Share link" />',
          ].join(''),
        },
      ],
      defaults: { content: { first: 'A', second: 'B' } },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Copilot alias collision')) return;
    throw error;
  }
  throw new Error('[compile-all] seeded Copilot alias collision did not fail compilation');
}

function assertCopilotChoiceLabelsAreProductLabels(args: {
  widgetType: string;
  controls: Array<{
    path: string;
    panelId?: string;
    groupId?: string;
    copilotAliases?: string[];
    copilotAmbiguityGroup?: string;
    copilotChoiceLabel?: string;
  }>;
}): void {
  const technicalLabels = new Set([
    'contentfields',
    'layoutfields',
    'settingsbehavior',
    'stylefields',
    'typofields',
  ]);

  const normalize = (value: string) =>
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');

  for (const control of args.controls) {
    const label = String(control.copilotChoiceLabel || '').trim();
    const normalized = normalize(label);
    const isBad =
      !label ||
      technicalLabels.has(normalized) ||
      /[.{}]|__/.test(label);

    if (isBad) {
      throw new Error(
        `[compile-all] ${args.widgetType} Copilot choice label for "${control.path}" is not product-readable: "${control.copilotChoiceLabel}"`,
      );
    }
  }

  const byAlias = new Map<string, Array<{ path: string; label: string }>>();
  args.controls.forEach((control) => {
    if (!control.copilotAmbiguityGroup || !Array.isArray(control.copilotAliases)) return;
    control.copilotAliases.forEach((alias) => {
      const normalizedAlias = normalize(alias);
      if (!normalizedAlias) return;
      const key = `${control.copilotAmbiguityGroup}:${normalizedAlias}`;
      const bucket = byAlias.get(key) || [];
      bucket.push({
        path: control.path,
        label: String(control.copilotChoiceLabel || '').trim(),
      });
      byAlias.set(key, bucket);
    });
  });

  for (const [key, controls] of byAlias) {
    if (controls.length < 2) continue;
    const seen = new Map<string, string>();
    for (const control of controls) {
      const normalizedLabel = normalize(control.label);
      const existingPath = seen.get(normalizedLabel);
      if (!existingPath) {
        seen.set(normalizedLabel, control.path);
        continue;
      }
      throw new Error(
        `[compile-all] ${args.widgetType} Copilot ambiguity "${key}" repeats choice "${control.label}" for "${existingPath}" and "${control.path}"`,
      );
    }
  }
}

async function main(): Promise<void> {
  assertAliasCollisionFails();
  const specs = discoverWidgetSpecs();
  for (const spec of specs) {
    const raw = JSON.parse(fs.readFileSync(spec.specPath, 'utf8')) as unknown;
    const compiled = await compileWidgetServer(raw as any);
    assertCopilotChoiceLabelsAreProductLabels({
      widgetType: spec.widgetType,
      controls: compiled.controls,
    });
  }
  console.log(`[compile-all] OK: compiled ${specs.length} widget contract(s)`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
