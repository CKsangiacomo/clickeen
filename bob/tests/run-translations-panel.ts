import assert from 'node:assert/strict';
import { buildActivityRows } from '../components/TranslationsPanel';

assert.deepEqual(
  buildActivityRows([
    { stage: 'command-started', message: 'Generating 2 active locales.', total: 2, completed: 0 },
    { stage: 'overlay-written', locale: 'fr', message: 'fr overlay written.', total: 2, completed: 1 },
    { stage: 'overlay-written', locale: 'de', message: 'de overlay written.', total: 2, completed: 2 },
  ]).map((row) => ({ state: row.state, message: row.message })),
  [
    { state: 'current', message: 'Writing translations' },
    { state: 'done', message: 'French written' },
    { state: 'done', message: 'German written' },
  ],
);

console.log('translations panel command activity tests passed');
