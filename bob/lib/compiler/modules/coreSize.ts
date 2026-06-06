// Bob module: builds the shared Widget Core size controls.
// The architecture noun is Core; widget specs provide user-facing labels like Visual size.

type JsonObject = Record<string, unknown>;

const coreSizeModeOptions =
  '[{\"label\":\"Auto\",\"value\":\"auto\"},{\"label\":\"Fixed\",\"value\":\"fixed\"},{\"label\":\"Responsive\",\"value\":\"responsive\"}]'.replace(
    /"/g,
    '&quot;',
  );

function readCoreSizeLabel(defaults: JsonObject): string {
  const uiLabels = defaults.uiLabels && typeof defaults.uiLabels === 'object' && !Array.isArray(defaults.uiLabels)
    ? (defaults.uiLabels as JsonObject)
    : null;
  const core = uiLabels?.core && typeof uiLabels.core === 'object' && !Array.isArray(uiLabels.core)
    ? (uiLabels.core as JsonObject)
    : null;
  const label = typeof core?.sizeCluster === 'string' ? core.sizeCluster.trim() : '';
  return label || 'Core size';
}

export function buildCoreSizeLayoutPanelFields(defaults: JsonObject): string[] {
  const label = readCoreSizeLabel(defaults).replace(/'/g, '&apos;');
  return [
    `  <tooldrawer-cluster label='${label}'>`,
    `    <tooldrawer-field-coresize group-label='' type='dropdown-actions' size='md' path='coreSize.mode' label='Sizing' placeholder='Choose sizing' value='{{coreSize.mode}}' options='${coreSizeModeOptions}' />`,
    "    <tooldrawer-field-coresize group-label='' type='valuefield' size='md' path='coreSize.fixedHeight' label='Height (px)' show-if=\"coreSize.mode == 'fixed'\" />",
    "    <tooldrawer-field-coresize group-label='' type='valuefield' size='md' path='coreSize.minHeight' label='Minimum height (px)' show-if=\"coreSize.mode == 'responsive'\" />",
    "    <tooldrawer-field-coresize group-label='' type='valuefield' size='md' path='coreSize.preferredVw' label='Preferred viewport height (vw)' show-if=\"coreSize.mode == 'responsive'\" />",
    "    <tooldrawer-field-coresize group-label='' type='valuefield' size='md' path='coreSize.maxHeight' label='Maximum height (px)' show-if=\"coreSize.mode == 'responsive'\" />",
    '  </tooldrawer-cluster>',
  ];
}
