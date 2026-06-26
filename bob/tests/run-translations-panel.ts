import assert from 'node:assert/strict';
import { buildActivityRows } from '../components/TranslationsPanel';

assert.deepEqual(
  buildActivityRows([
    { message: 'Writing translations' },
    { message: 'French written' },
    { message: 'German written' },
  ]).map((row) => row.message),
  [
    'Writing translations',
    'French written',
    'German written',
  ],
);

console.log('translations panel activity tests passed');
