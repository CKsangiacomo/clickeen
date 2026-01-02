import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const widgetsDir = path.join(repoRoot, 'tokyo', 'widgets');
const parisOrigin = (process.env.PARIS_ORIGIN || process.env.PARIS_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '');

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

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function mergeMissing(defaults, current) {
  if (current === undefined || current === null) return { value: defaults, changed: true };

  if (Array.isArray(defaults) || Array.isArray(current)) {
    return { value: current, changed: false };
  }

  if (!isPlainObject(defaults) || !isPlainObject(current)) {
    return { value: current, changed: false };
  }

  let changed = false;
  const out = { ...current };
  for (const [key, defaultValue] of Object.entries(defaults)) {
    const curValue = current[key];
    if (curValue === undefined || curValue === null) {
      out[key] = defaultValue;
      changed = true;
      continue;
    }
    if (isPlainObject(defaultValue) && isPlainObject(curValue)) {
      const merged = mergeMissing(defaultValue, curValue);
      out[key] = merged.value;
      if (merged.changed) changed = true;
    }
  }

  return { value: out, changed };
}

function normalizeFaqConfig(config) {
  if (!isPlainObject(config)) return { value: config, changed: false };
  if (!Array.isArray(config.sections)) return { value: config, changed: false };

  let changed = false;
  const sections = config.sections.map((section) => {
    if (!isPlainObject(section)) return section;
    if (!Array.isArray(section.faqs)) return section;

    let sectionChanged = false;
    const faqs = section.faqs.map((faq) => {
      if (!isPlainObject(faq)) return faq;
      if (typeof faq.defaultOpen === 'boolean') return faq;
      sectionChanged = true;
      return { ...faq, defaultOpen: false };
    });

    if (!sectionChanged) return section;
    changed = true;
    return { ...section, faqs };
  });

  if (!changed) return { value: config, changed: false };
  return { value: { ...config, sections }, changed: true };
}

async function createInstance(args) {
  const res = await fetch(`${parisOrigin}/api/instance`, {
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
  const res = await fetch(`${parisOrigin}/api/instance/${encodeURIComponent(args.publicId)}`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${args.parisDevJwt}`,
    },
    body: JSON.stringify({ config: args.config }),
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
    const createdRes = await createInstance({ parisDevJwt, widgetType, publicId, config: defaults });
    const existingConfig = createdRes && typeof createdRes === 'object' ? createdRes.config : undefined;
    const merged = mergeMissing(defaults, existingConfig);
    let nextConfig = merged.value;
    let changed = merged.changed;

    if (widgetType === 'faq') {
      const normalized = normalizeFaqConfig(nextConfig);
      nextConfig = normalized.value;
      changed = changed || normalized.changed;
    }

    if (changed) {
      await updateInstance({ parisDevJwt, publicId, config: nextConfig });
      console.log(`[bootstrap-local-widgets] Patched ${publicId} (added missing defaults)`);
    }
    created += 1;
    console.log(`[bootstrap-local-widgets] Ensured ${publicId}`);
  }

  console.log(`[bootstrap-local-widgets] OK (${created} instances)`);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[bootstrap-local-widgets] ${message}`);
  process.exit(1);
});
