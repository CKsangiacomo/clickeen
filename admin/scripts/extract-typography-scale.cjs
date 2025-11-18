const fs = require('fs');
const path = require('path');

const COMPONENTS_ROOT = path.resolve(__dirname, '../../dieter/components');
const TOKENS_FILE = path.resolve(__dirname, '../../bob/public/dieter/tokens.css');
const OUTPUT_FILE = path.resolve(__dirname, '../src/data/typography.usage.json');

const TYPE_PREFIXES = ['body', 'label', 'caption', 'overline'];
const FS_VAR_REGEX = /var\((--fs-[^)]+)\)/g;
const RULE_REGEX = /([^{}]+)\{([^{}]*)\}/g;

const varToRem = (() => {
  const map = {};
  if (!fs.existsSync(TOKENS_FILE)) return map;
  const tokenCss = fs.readFileSync(TOKENS_FILE, 'utf8');
  const varRegex = /--fs-([\w-]+):\s*([0-9.]+)rem/g;
  let match;
  while ((match = varRegex.exec(tokenCss))) {
    map[`--fs-${match[1]}`] = parseFloat(match[2]);
  }
  return map;
})();

function walk(dir, callback) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, callback);
    } else if (entry.isFile() && entry.name.endsWith('.css')) {
      callback(full);
    }
  });
}

const classUsage = new Map();

function normalizeSelector(selector) {
  let sel = selector.trim();
  if (!sel.startsWith('.')) return null;
  sel = sel.replace(/[:\[].*$/, '');
  return sel.startsWith('.') ? sel.slice(1) : null;
}

function track(className, file, vars) {
  if (!classUsage.has(className)) {
    classUsage.set(className, { files: new Set(), vars: new Set() });
  }
  const record = classUsage.get(className);
  record.files.add(path.relative(COMPONENTS_ROOT, file));
  vars.forEach((v) => record.vars.add(v));
}

walk(COMPONENTS_ROOT, (file) => {
  const css = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = RULE_REGEX.exec(css))) {
    const selectorChunk = match[1];
    const body = match[2];

    FS_VAR_REGEX.lastIndex = 0;
    const vars = new Set();
    let varMatch;
    while ((varMatch = FS_VAR_REGEX.exec(body))) {
      vars.add(varMatch[1]);
    }
    if (!vars.size) continue;

    const selectors = selectorChunk.split(',');
    selectors.forEach((selector) => {
      const className = normalizeSelector(selector);
      if (!className) return;
      if (!TYPE_PREFIXES.some((prefix) => className.startsWith(prefix))) return;
      track(className, file, vars);
    });
  }
});

const report = Array.from(classUsage.entries())
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([className, { files, vars }]) => ({
    className,
    sizes: Array.from(vars)
      .sort()
      .map((v) => ({ var: v, rem: varToRem[v] ?? null })),
    files: Array.from(files).sort(),
  }));

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));
console.log(`Typography usage written to ${OUTPUT_FILE}`);
