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

async function main(): Promise<void> {
  assertAliasCollisionFails();
  const specs = discoverWidgetSpecs();
  for (const spec of specs) {
    const raw = JSON.parse(fs.readFileSync(spec.specPath, 'utf8')) as unknown;
    await compileWidgetServer(raw as any);
  }
  console.log(`[compile-all] OK: compiled ${specs.length} widget contract(s)`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
