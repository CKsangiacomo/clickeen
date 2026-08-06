import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const source = await fs.readFile(new URL('../../tokyo/product/clickeen/clickeen.js', import.meta.url), 'utf8');

assert.match(source, /script\[data-clickeen\]/);
assert.match(source, /attachShadow\(\{ mode: 'open' \}\)/);
assert.match(source, /new URL\(runtimeElement\.getAttribute\('src'\), completedPublicUrl\)\.toString\(\)/);
assert.match(source, /new URL\(stylesheetElement\.getAttribute\('href'\), completedPublicUrl\)\.toString\(\)/);
assert.match(source, /data-clickeen-source/);
assert.match(source, /data-clickeen-schema-index/);
assert.match(source, /script\.dataset\.clickeenSource === publicUrl/);
assert.match(source, /script\.dataset\.clickeenSchemaIndex === String\(index\)/);
assert.doesNotMatch(source, /iframe/i);

assert.equal(
  new URL('/CLICKEEN/ABCD123456/runtime.js', 'https://clk.live/CLICKEEN/ABCD123456').toString(),
  'https://clk.live/CLICKEEN/ABCD123456/runtime.js',
  'Widget root-relative runtime must stay on clk.live',
);
assert.equal(
  new URL('./runtime.js', 'https://clk.live/CLICKEEN/pages/ABCD123456/it').toString(),
  'https://clk.live/CLICKEEN/pages/ABCD123456/runtime.js',
  'Page relative runtime must resolve beside the Page package',
);
assert.equal(
  new URL('/CLICKEEN/ABCD123456/styles.css', 'https://clk.live/CLICKEEN/ABCD123456').toString(),
  'https://clk.live/CLICKEEN/ABCD123456/styles.css',
  'Widget root-relative stylesheet must stay on clk.live',
);
assert.equal(
  new URL('./styles.css', 'https://clk.live/CLICKEEN/pages/ABCD123456/it').toString(),
  'https://clk.live/CLICKEEN/pages/ABCD123456/styles.css',
  'Page relative stylesheet must resolve beside the Page package',
);

console.log('Public clickeen.js loader contract verification passed.');
