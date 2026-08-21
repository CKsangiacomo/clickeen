import assert from 'node:assert/strict';
import {
  resolveTranslatedValues,
  type WidgetEditableFieldsContract,
} from '@clickeen/ck-contracts';
import {
  buildEditableFieldsTranslationOverlayInspection,
  mapTranslationOverlayValuesToCurrentPaths,
} from '../lib/translations-preview';

const repeatedContentContract: WidgetEditableFieldsContract = {
  widgetType: 'contract-widget',
  fields: [
    {
      path: 'items[].title',
      type: 'string',
      label: 'Item title',
      role: 'item-title',
      arrayItemIdentity: ['items[].id'],
      limits: [],
    },
  ],
};
const firstCoordinate = 'contract-widget|item-title|items[].title|items[].id=first';
const secondCoordinate = 'contract-widget|item-title|items[].title|items[].id=second';
const thirdCoordinate = 'contract-widget|item-title|items[].title|items[].id=third';
const translatedValues = {
  [firstCoordinate]: 'Premier',
  [secondCoordinate]: 'Deuxième',
};
const reorderedConfig = {
  items: [
    { id: 'second', title: 'Second' },
    { id: 'first', title: 'First' },
    { id: 'third', title: 'Third' },
  ],
};
const reorderedValuesByPath = mapTranslationOverlayValuesToCurrentPaths({
  contract: repeatedContentContract,
  config: reorderedConfig,
  values: translatedValues,
});
assert.deepEqual(reorderedValuesByPath, {
  'items.0.title': 'Deuxième',
  'items.1.title': 'Premier',
});
assert.deepEqual(
  resolveTranslatedValues(reorderedConfig, reorderedValuesByPath),
  {
    items: [
      { id: 'second', title: 'Deuxième' },
      { id: 'first', title: 'Premier' },
      { id: 'third', title: 'Third' },
    ],
  },
);
const addedInspection = buildEditableFieldsTranslationOverlayInspection({
  contract: repeatedContentContract,
  config: reorderedConfig,
  values: translatedValues,
});
assert.deepEqual(addedInspection.missingPaths, [thirdCoordinate]);

const afterDeleteValuesByPath = mapTranslationOverlayValuesToCurrentPaths({
  contract: repeatedContentContract,
  config: { items: [{ id: 'second', title: 'Second' }] },
  values: translatedValues,
});
assert.deepEqual(afterDeleteValuesByPath, { 'items.0.title': 'Deuxième' });

console.log('translations panel tests passed');
