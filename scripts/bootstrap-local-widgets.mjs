import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const widgetsDir = path.join(repoRoot, 'tokyo', 'widgets');
const parisOrigin = (process.env.PARIS_ORIGIN || process.env.PARIS_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '');
const DEV_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';

function readParisDevJwt() {
  const envValue = typeof process.env.PARIS_DEV_JWT === 'string' ? process.env.PARIS_DEV_JWT.trim() : '';
  if (envValue) return envValue;
  const filePath = path.join(repoRoot, 'CurrentlyExecuting', 'paris.dev.jwt');
  if (fs.existsSync(filePath)) {
    const value = fs.readFileSync(filePath, 'utf8').trim();
    if (value) return value;
  }
  return '';
}

function listWidgetTypes() {
  if (!fs.existsSync(widgetsDir)) {
    throw new Error(`[bootstrap-local-widgets] Missing widgets dir: ${widgetsDir}`);
  }
  return fs
    .readdirSync(widgetsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !['_fragments', 'shared'].includes(d.name))
    .map((d) => d.name)
    .sort();
}

function hasWidgetPackageFiles(widgetType) {
  const dir = path.join(widgetsDir, widgetType);
  const required = ['spec.json', 'widget.html', 'widget.css', 'widget.client.js', 'agent.md'];
  return required.every((name) => fs.existsSync(path.join(dir, name)));
}

function loadWidgetDefaults(widgetType) {
  const filePath = path.join(widgetsDir, widgetType, 'spec.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  const defaults = parsed?.defaults;
  if (!defaults || typeof defaults !== 'object' || Array.isArray(defaults)) {
    throw new Error(`[bootstrap-local-widgets] ${widgetType}/spec.json is missing defaults object`);
  }
  return defaults;
}

async function createInstance(args) {
  const res = await fetch(`${parisOrigin}/api/workspaces/${encodeURIComponent(DEV_WORKSPACE_ID)}/instances?subject=devstudio`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${args.parisDevJwt}`,
    },
    body: JSON.stringify({
      widgetType: args.widgetType,
      publicId: args.publicId,
      status: 'unpublished',
      config: args.config,
    }),
  });

  const text = await res.text().catch(() => '');
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${text}`.trim());
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function updateInstance(args) {
  const res = await fetch(
    `${parisOrigin}/api/workspaces/${encodeURIComponent(DEV_WORKSPACE_ID)}/instance/${encodeURIComponent(args.publicId)}?subject=devstudio`,
    {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${args.parisDevJwt}`,
    },
    body: JSON.stringify({ config: args.config }),
    },
  );

  const text = await res.text().catch(() => '');
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${text}`.trim());
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function main() {
  const parisDevJwt = readParisDevJwt();
  if (!parisDevJwt) {
    throw new Error('[bootstrap-local-widgets] Missing PARIS_DEV_JWT (set env var or write CurrentlyExecuting/paris.dev.jwt)');
  }

  const widgetTypes = listWidgetTypes();
  console.log(`[bootstrap-local-widgets] Paris origin: ${parisOrigin}`);
  console.log(`[bootstrap-local-widgets] Widgets (folders): ${widgetTypes.length}`);

  const eligible = widgetTypes.filter(hasWidgetPackageFiles);
  const skipped = widgetTypes.filter((w) => !eligible.includes(w));
  if (skipped.length > 0) {
    console.log(`[bootstrap-local-widgets] Skipping incomplete widget packages: ${skipped.join(', ')}`);
  }

  let created = 0;
  for (const widgetType of eligible) {
    const publicId = `wgt_${widgetType}_main`;
    const defaults = loadWidgetDefaults(widgetType);
    await createInstance({ parisDevJwt, widgetType, publicId, config: defaults });
    await updateInstance({ parisDevJwt, publicId, config: defaults });
    console.log(`[bootstrap-local-widgets] Synced ${publicId} to ${widgetType}/spec.json defaults`);
    created += 1;
  }

  console.log(`[bootstrap-local-widgets] OK (${created} instances)`);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[bootstrap-local-widgets] ${message}`);
  process.exit(1);
});
