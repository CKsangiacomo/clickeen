import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileWidgetServer } from '../../bob/lib/compiler.server';

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

function assertCompiledControlsAreProductReadable(args: {
  widgetType: string;
  controls: Array<{
    path: string;
    label?: string;
    kind?: string;
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
    if (!control.kind || control.kind === 'unknown') {
      throw new Error(`[compile-all] ${args.widgetType} control "${control.path}" is missing kind metadata`);
    }
    const label = String(control.label || '').trim();
    if (!label) continue;
    const normalized = normalize(label);
    const isBad =
      technicalLabels.has(normalized) ||
      /[{}]|__/.test(label);

    if (isBad) {
      throw new Error(
        `[compile-all] ${args.widgetType} control label for "${control.path}" is not product-readable: "${label}"`,
      );
    }
  }
}

async function main(): Promise<void> {
  const specs = discoverWidgetSpecs();
  for (const spec of specs) {
    const raw = JSON.parse(fs.readFileSync(spec.specPath, 'utf8')) as unknown;
    const compiled = await compileWidgetServer(raw as any);
    assertCompiledControlsAreProductReadable({
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
