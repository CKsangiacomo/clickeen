import assert from 'node:assert/strict';
import { isPageLocale, parseAccountPageSource, parsePageLocaleOverlay } from '../src/domains/pages/contract';

const source = parseAccountPageSource({
  pageId: '7UZXTP3TOI',
  displayName: 'Summer page',
  isTemplate: false,
  baseLocale: 'en',
  values: {
    title: 'Summer',
    description: 'A summer page',
    socialTitle: 'Summer social',
  },
  robots: 'index-follow',
  placements: [{ placementId: 'hero', instanceId: 'QD1G068MX7' }],
});
assert.ok(source && !source.isTemplate);
assert.equal(isPageLocale('fil'), true, 'canonical three-letter Page locales must be accepted');
assert.ok(parseAccountPageSource({ ...source, baseLocale: 'fil' }), 'fil must be accepted as Page baseLocale');
assert.deepEqual(parsePageLocaleOverlay({
  values: {
    title: 'Estate',
    description: 'Una pagina estiva',
    socialTitle: 'Estate social',
  },
}, source), {
  values: {
    title: 'Estate',
    description: 'Una pagina estiva',
    socialTitle: 'Estate social',
  },
});
assert.equal(parsePageLocaleOverlay({ values: { title: 'Estate' } }, source), null, 'required translated fields must not be omitted');
assert.equal(parsePageLocaleOverlay({ values: { title: 'Estate', description: 'Test', socialTitle: 'Test', status: 'done' } }, source), null, 'overlay metadata must fail');
assert.equal(parseAccountPageSource({ ...source, version: 1 }), null, 'legacy Page fields must fail');

console.log('Tokyo Page contract verification passed.');
