import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const widgetsDir = path.join(repoRoot, 'tokyo', 'widgets');

const bobOrigin = (process.env.BOB_ORIGIN || 'http://localhost:3000').replace(/\/+$/, '');

function listWidgetTypes() {
  if (!fs.existsSync(widgetsDir)) {
    throw new Error(`[compile-all-widgets] Missing widgets dir: ${widgetsDir}`);
  }
  return fs
    .readdirSync(widgetsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name)
    .filter((name) => fs.existsSync(path.join(widgetsDir, name, 'spec.json')))
    .sort();
}

async function compileWidget(widgetType) {
  const url = `${bobOrigin}/api/widgets/${encodeURIComponent(widgetType)}/compiled`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${url} ${text ? `→ ${text}` : ''}`.trim());
  }
  return (await res.json()) ?? null;
}

function assertCompiledShape(widgetType, compiled) {
  if (!compiled || typeof compiled !== 'object') {
    throw new Error('Compiled response is not an object');
  }
  if (compiled.widgetname !== widgetType) {
    throw new Error(`Compiled widgetname mismatch (expected "${widgetType}", got "${compiled.widgetname}")`);
  }
  const assets = compiled.assets;
  if (!assets || typeof assets !== 'object') throw new Error('Missing assets');
  const dieter = assets.dieter;
  if (!dieter || typeof dieter !== 'object') throw new Error('Missing assets.dieter');
  if (!Array.isArray(dieter.styles) || dieter.styles.length === 0) throw new Error('Missing assets.dieter.styles');
  if (!Array.isArray(dieter.scripts)) throw new Error('Missing assets.dieter.scripts array');
}

async function main() {
  const widgetTypes = listWidgetTypes();
  console.log(`[compile-all-widgets] Bob origin: ${bobOrigin}`);
  console.log(`[compile-all-widgets] Widgets: ${widgetTypes.length}`);

  let failures = 0;
  for (const widgetType of widgetTypes) {
    const label = `[compile-all-widgets] ${widgetType}`;
    try {
      const compiled = await compileWidget(widgetType);
      assertCompiledShape(widgetType, compiled);
      console.log(`${label} ✅`);
    } catch (err) {
      failures++;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`${label} ❌ ${message}`);
    }
  }

  if (failures > 0) {
    console.error(`[compile-all-widgets] Failed: ${failures}/${widgetTypes.length}`);
    process.exit(1);
  }
  console.log('[compile-all-widgets] OK');
}

main().catch((err) => {
  console.error('[compile-all-widgets] Unhandled error', err);
  process.exit(1);
});
