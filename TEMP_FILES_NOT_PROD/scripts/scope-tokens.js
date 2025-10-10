#!/usr/bin/env node
/*
 Read a tokens.css file and rewrite :root selectors to be scoped under #centerCanvas
 to avoid global cascade bleed in Studio chrome.

 Usage: node scripts/scope-tokens.js <sourceTokensCss> <scopedOutputCss>
*/
const fs = require('node:fs');
const path = require('node:path');

function main() {
  const [src, dst] = process.argv.slice(2);
  if (!src || !dst) {
    console.error('Usage: node scripts/scope-tokens.js <sourceTokensCss> <scopedOutputCss>');
    process.exit(1);
  }
  const absSrc = path.resolve(process.cwd(), src);
  const absDst = path.resolve(process.cwd(), dst);
  if (!fs.existsSync(absSrc)) {
    console.error('[scope-tokens] Source not found:', absSrc);
    process.exit(1);
  }
  let css = fs.readFileSync(absSrc, 'utf8');
  // Replace standalone :root selectors with #centerCanvas
  css = css.replace(/(^|\s):root(\s*\{)/g, '$1#centerCanvas$2');
  // Handle :root[...] blocks as well
  css = css.replace(/:root(\s*\[[^\]]+\])/g, '#centerCanvas$1');
  fs.mkdirSync(path.dirname(absDst), { recursive: true });
  fs.writeFileSync(absDst, css);
  console.log(`[scope-tokens] Wrote scoped tokens to ${absDst}`);
}

main();


