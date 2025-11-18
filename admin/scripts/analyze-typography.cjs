const fs = require('fs');
const path = require('path');
const glob = require('glob');

const tokensPath = path.resolve(__dirname, '../../bob/public/dieter/tokens.css');
const tokenCss = fs.readFileSync(tokensPath, 'utf8');

const varRegex = /--fs-([0-9]+):\s*([0-9.]+)rem/g;
const varToRem = {};
let m;
while ((m = varRegex.exec(tokenCss))) {
  varToRem[`--fs-${m[1]}`] = parseFloat(m[2]);
}

const classToVars = {};
const files = glob.sync('dieter/components/**/*.css');
const selectorRegex = /(\.[\w-]+[^{]*){([^}]*)}/g;
const varUsageRegex = /var\((--fs-[^)]+)\)/g;

files.forEach((file) => {
  const css = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = selectorRegex.exec(css))) {
    const selectors = match[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const body = match[2];
    const vars = new Set();
    let varMatch;
    while ((varMatch = varUsageRegex.exec(body))) {
      vars.add(varMatch[1]);
    }
    if (!vars.size) continue;
    selectors.forEach((sel) => {
      if (!sel.startsWith('.')) return;
      const cls = sel.slice(1);
      if (
        cls.startsWith('body') ||
        cls.startsWith('label') ||
        cls.startsWith('caption') ||
        cls.startsWith('overline')
      ) {
        classToVars[cls] = classToVars[cls] || new Set();
        vars.forEach((v) => classToVars[cls].add(v));
      }
    });
  }
});

const report = Object.entries(classToVars).map(([cls, vars]) => ({
  className: cls,
  sizes: Array.from(vars).map((v) => ({ var: v, rem: varToRem[v] || null })),
  files: glob
    .sync('dieter/components/**/*.css')
    .filter((file) => {
      const css = fs.readFileSync(file, 'utf8');
      return css.includes(`.${cls}`);
    }),
}));

console.log(JSON.stringify(report, null, 2));
