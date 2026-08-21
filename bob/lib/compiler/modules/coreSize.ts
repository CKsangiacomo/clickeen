// Bob module: builds the shared Widget Core size controls.
// The architecture noun is Core; widget specs provide user-facing labels like Visual size.

import { encodeHtmlEntities } from '../../compiler.shared';
import coreSizeCopy from '../../../l10n/editor/core-size/en.json';

const coreSizeModeOptions = encodeHtmlEntities(
  JSON.stringify([
    { label: coreSizeCopy.options.auto, value: 'auto' },
    { label: coreSizeCopy.options.fixed, value: 'fixed' },
    { label: coreSizeCopy.options.responsive, value: 'responsive' },
  ]),
);

export function buildCoreSizeLayoutPanelFields(sizeClusterLabel: string): string[] {
  const label = encodeHtmlEntities(sizeClusterLabel);
  return [
    `  <tooldrawer-cluster label='${label}'>`,
    `    <tooldrawer-field-coresize group-label='' type='dropdown-actions' size='md' path='coreSize.mode' label='${coreSizeCopy.fields.sizing}' placeholder='${coreSizeCopy.fields.chooseSizing}' value='{{coreSize.mode}}' options='${coreSizeModeOptions}' />`,
    `    <tooldrawer-field-coresize group-label='' type='valuefield' size='md' path='coreSize.fixedHeight' label='${coreSizeCopy.fields.height}' min='0' max='2000' show-if="coreSize.mode == 'fixed'" />`,
    `    <tooldrawer-field-coresize group-label='' type='valuefield' size='md' path='coreSize.minHeight' label='${coreSizeCopy.fields.minimumHeight}' min='0' max='2000' show-if="coreSize.mode == 'responsive'" />`,
    `    <tooldrawer-field-coresize group-label='' type='valuefield' size='md' path='coreSize.preferredVw' label='${coreSizeCopy.fields.preferredViewportHeight}' min='0' max='200' show-if="coreSize.mode == 'responsive'" />`,
    `    <tooldrawer-field-coresize group-label='' type='valuefield' size='md' path='coreSize.maxHeight' label='${coreSizeCopy.fields.maximumHeight}' min='0' max='2400' show-if="coreSize.mode == 'responsive'" />`,
    '  </tooldrawer-cluster>',
  ];
}
