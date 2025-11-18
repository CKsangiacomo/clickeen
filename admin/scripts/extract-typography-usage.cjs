const fs = require('fs');
const path = require('path');

const COMPONENTS_ROOT = path.resolve(__dirname, '../../dieter/components');
const TOKENS_FILE = path.resolve(__dirname, '../../bob/public/dieter/tokens.css');
const OUTPUT_FILE = path.resolve(__dirname, '../src/data/typography.usage.json');

const RULE_REGEX = /([^{}]+)\{([^{}]*)\}/g;
const VAR_REGEX = /var\((--fs-[^)]+)\)/g;

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

const usage = new Map();

function record(varName, component, selector, file) {
  if (!usage.has(varName)) {
    usage.set(varName, { rem: varToRem[varName] ?? null, occurrences: [] });
  }
  const entry = usage.get(varName);
  entry.occurrences.push({ component, selector: selector.trim(), file: path.relative(COMPONENTS_ROOT, file) });
}

walk(COMPONENTS_ROOT, (file) => {
  const css = fs.readFileSync(file, 'utf8');
  const component = path.basename(path.dirname(file));
  let match;
  while ((match = RULE_REGEX.exec(css))) {
    const selectors = match[1]
      .split(',')
      .map((s) => s.replace(/\/\*[\s\S]*?\*\//g, '').trim());
    const body = match[2];
    VAR_REGEX.lastIndex = 0;
    const vars = new Set();
    let varMatch;
    while ((varMatch = VAR_REGEX.exec(body))) {
      vars.add(varMatch[1]);
    }
    if (!vars.size) continue;
    selectors.forEach((selector) => {
      vars.forEach((varName) => record(varName, component, selector, file));
    });
  }
});

const report = Array.from(usage.entries())
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([varName, data]) => ({
    var: varName,
    rem: data.rem,
    count: data.occurrences.length,
    components: Array.from(new Set(data.occurrences.map((o) => o.component))).sort(),
    occurrences: data.occurrences,
  }));

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));
console.log(`Typography usage written to ${OUTPUT_FILE}`);
