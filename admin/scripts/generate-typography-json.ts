import fs from 'node:fs';
import path from 'node:path';

const TOKEN_FILE = path.resolve(process.cwd(), 'bob/public/dieter/tokens.css');
const OUTPUT_FILE = path.resolve(process.cwd(), 'admin/src/data/typography.generated.json');

const CATEGORY_MARKERS: Record<string, RegExp> = {
  'Headings': /^\.heading-[\w-]+/,
  'Body': /^\.body[\w-]*$/,
  'Labels & Captions': /^\.label[\w-]*$|^\.caption|^\.overline$/,
};

const DEFAULT_SAMPLE = 'The quick brown fox jumps over the lazy dog';

const tokenCss = fs.readFileSync(TOKEN_FILE, 'utf8');

const ruleRegex = /([^{]+){([^}]+)}/g;
const tokens: Record<string, { className: string; sample: string }[]> = {
  'Headings': [],
  'Body': [],
  'Labels & Captions': [],
};

const seen = new Set<string>();

let match: RegExpExecArray | null;
while ((match = ruleRegex.exec(tokenCss))) {
  const selector = match[1].trim();
  const selectors = selector.split(',').map((s) => s.trim()).filter(Boolean);

  selectors.forEach((sel) => {
    if (!sel.startsWith('.')) return;
    const className = sel.slice(1);
    if (seen.has(className)) return;

    for (const [title, pattern] of Object.entries(CATEGORY_MARKERS)) {
      if (pattern.test(sel)) {
        const sample =
          className === 'overline'
            ? 'OVERLINE'
            : DEFAULT_SAMPLE;
        tokens[title].push({ className, sample });
        seen.add(className);
        return;
      }
    }
  });
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(tokens, null, 2));

console.log(`Typography tokens written to ${OUTPUT_FILE}`);
