import fs from 'node:fs';

const symbolSetPath = '/Users/piero_macpro/tools/sf-symbols/src/symbolSet.json';
const outDir = '/Users/piero_macpro/code/CKeen/apps/app/dieter/tokens';
const outPath = `${outDir}/icon.types.ts`;

const raw = fs.readFileSync(symbolSetPath, 'utf8');
const data = JSON.parse(raw);

const iconNames = [];
for (const [symbolName, styles] of Object.entries(data.symbols)) {
  for (const styleName of Object.keys(styles)) {
    iconNames.push(`${symbolName}--${styleName}`);
  }
}

iconNames.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

const tsContent = 'export type IconName =\n' + iconNames.map(name => `  | "${name}"`).join('\n') + '\n';

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, tsContent);
console.log(`Generated IconName type with ${iconNames.length} icons -> ${outPath}`);


