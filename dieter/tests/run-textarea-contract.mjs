import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const componentUrl = new URL('../components/textarea/', import.meta.url);
const [html, css, source, spec, index, styles] = await Promise.all([
  readFile(new URL('textarea.html', componentUrl), 'utf8'),
  readFile(new URL('textarea.css', componentUrl), 'utf8'),
  readFile(new URL('textarea.ts', componentUrl), 'utf8'),
  readFile(new URL('textarea.spec.json', componentUrl), 'utf8').then(JSON.parse),
  readFile(new URL('../components/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
]);

assert.equal(spec.component, 'textarea');
assert.deepEqual(spec.attributes.size.enum, ['sm', 'md', 'lg']);
for (const attribute of ['id', 'label', 'value', 'placeholder', 'path', 'disabled', 'maxlength']) {
  assert.ok(Object.hasOwn(spec.attributes, attribute), `Textarea spec must declare ${attribute}`);
}

assert.match(html, /class="diet-textarea diet-textfield diet-popover-host"/);
assert.match(html, /class="diet-textfield__control diet-textarea__control"/);
assert.match(html, /class="diet-popover diet-textarea__popover" role="dialog"/);
assert.match(html, /<textarea[\s\S]*class="diet-textarea__editor/);
assert.match(html, /data-path="{{path}}"/);
assert.match(html, /maxlength="{{maxlength}}"/);
assert.doesNotMatch(html, /contenteditable|Apply|Save|type="submit"/i);

assert.match(source, /createDropdownHydrator/);
assert.match(source, /states\.get\(root\)\?\.editor\.focus/);
assert.match(source, /state\.editor\.addEventListener\('input'/);
assert.match(source, /state\.input\.dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/);
assert.match(source, /state\.input\.addEventListener\('external-sync'/);
assert.match(source, /External value must be a string/);
assert.match(source, /Invalid component markup/);
assert.match(source, /syncFromValue\(state, state\.input\.value\)/);
assert.doesNotMatch(source, /fetch\(|innerHTML|contentEditable|execCommand/);

assert.match(css, /text-overflow: ellipsis/);
assert.match(css, /white-space: nowrap/);
assert.match(css, /resize: vertical/);
assert.match(css, /border-color: var\(--color-system-blue\)/);

assert.match(index, /export \{ hydrateTextarea \} from '\.\/textarea\/textarea';/);
assert.match(styles, /@import url\('\.\/components\/textarea\/textarea\.css'\);/);

console.log('Dieter Textarea contract verification passed.');
