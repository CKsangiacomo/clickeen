const fs = require('fs');
const path = require('path');

const TOKEN_FILE = path.resolve(__dirname, '../../bob/public/dieter/tokens.css');
const OUTPUT_FILE = path.resolve(__dirname, '../src/data/typography.generated.json');

const CATEGORY_MARKERS = [
  { title: 'Headings', pattern: /^\.heading-[\w-]+$/ },
  { title: 'Body', pattern: /^\.body(?:-[\w-]+)?$/ },
  { title: 'Labels & Captions', pattern: /^\.(label[\w-]*|caption(?:-small)?|overline)$/ },
];

const DEFAULT_SAMPLE = 'The quick brown fox jumps over the lazy dog';

const tokenCss = fs.readFileSync(TOKEN_FILE, 'utf8');

const ruleRegex = /([^{]+){([^}]+)}/g;
const result = {
  'Headings': [],
  'Body': [],
  'Labels & Captions': [],
};

const seen = new Set();

let match;
while ((match = ruleRegex.exec(tokenCss))) {
  const selectors = match[1]
    .split(',')
    .map((s) => s.replace(/\/\*[\s\S]*?\*\//g, '').trim())
    .filter(Boolean)
    .filter((s) => s.startsWith('.'));

  selectors.forEach((sel) => {
    const className = sel.slice(1);
    if (seen.has(className)) return;

    for (const { title, pattern } of CATEGORY_MARKERS) {
      if (pattern.test(sel)) {
        const sample = className === 'overline' ? 'OVERLINE' : DEFAULT_SAMPLE;
        result[title].push({ className, sample });
        seen.add(className);
        break;
      }
    }
  });
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
console.log(`Typography tokens written to ${OUTPUT_FILE}`);
