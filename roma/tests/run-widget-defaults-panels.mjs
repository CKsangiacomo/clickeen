import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { build } from 'esbuild';

const componentPath = fileURLToPath(
  new URL('../components/widget-defaults-builder-controls.tsx', import.meta.url),
);

const bundle = await build({
  stdin: {
    contents: `
      import { buildPanelHtml } from ${JSON.stringify(componentPath)};
      globalThis.__buildWidgetDefaultsPanelHtml = buildPanelHtml;
    `,
    resolveDir: fileURLToPath(new URL('../..', import.meta.url)),
    sourcefile: 'widget-defaults-panel-test-entry.ts',
    loader: 'ts',
  },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  treeShaking: true,
  write: false,
});

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(() => {
    const cluster = (label, path, marker) => `
      <div class="tdmenucontent__cluster">
        <div class="tdmenucontent__cluster-header">
          <div class="overline-small tdmenucontent__cluster-label">${label}</div>
        </div>
        <div class="tdmenucontent__cluster-body">
          <input data-bob-path="${path}" data-marker="${marker}">
        </div>
      </div>
    `;

    const payload = {
      panels: [
        {
          id: 'appearance',
          label: 'Appearance <strong> & "tone"',
          html: [
            cluster('Locale switcher', 'appearance.locale.background', 'appearance-first'),
            cluster('Other', 'appearance.unselected', 'must-be-filtered'),
            cluster('Locale switcher', 'appearance.locale.text', 'appearance-second'),
          ].join(''),
        },
        {
          id: 'typography',
          label: 'Typography',
          html: cluster('Locale switcher', 'typography.locale.family', 'typography'),
        },
        {
          id: 'settings',
          label: 'Settings',
          html: cluster('Locale switcher', 'settings.locale.enabled', 'must-be-absent'),
        },
      ],
    };
    const controls = [
      { panelId: 'appearance', path: 'appearance.locale.background' },
      { panelId: 'appearance', path: 'appearance.locale.text' },
      { panelId: 'typography', path: 'typography.locale.family' },
      { panelId: 'settings', path: 'settings.missing' },
    ];

    const html = globalThis.__buildWidgetDefaultsPanelHtml(payload, controls);
    const host = document.createElement('div');
    host.className = 'tdmenucontent__fields';
    host.innerHTML = html;
    document.body.appendChild(host);

    const panels = Array.from(host.children);
    return {
      panelTags: panels.map((panel) => panel.tagName),
      panelClasses: panels.map((panel) => panel.className),
      labels: panels.map(
        (panel) => panel.querySelector(':scope > .tdmenucontent__cluster-header > h3')?.textContent,
      ),
      labelChildCounts: panels.map(
        (panel) => panel.querySelector(':scope > .tdmenucontent__cluster-header > h3')?.children.length,
      ),
      markers: panels.map((panel) =>
        Array.from(panel.querySelectorAll('[data-marker]')).map((node) =>
          node.getAttribute('data-marker'),
        ),
      ),
      clusterLabels: panels.map((panel) =>
        Array.from(
          panel.querySelectorAll(
            ':scope > .tdmenucontent__cluster-body > .tdmenucontent__cluster .tdmenucontent__cluster-label',
          ),
        ).map((node) => node.textContent),
      ),
    };
  });

  assert.deepEqual(result.panelTags, ['SECTION', 'SECTION']);
  assert.deepEqual(result.panelClasses, ['tdmenucontent__cluster', 'tdmenucontent__cluster']);
  assert.deepEqual(result.labels, ['Appearance <strong> & "tone"', 'Typography']);
  assert.deepEqual(
    result.labelChildCounts,
    [0, 0],
    'trusted labels must be assigned as text rather than interpreted as markup',
  );
  assert.deepEqual(result.markers, [
    ['appearance-first', 'appearance-second'],
    ['typography'],
  ]);
  assert.deepEqual(result.clusterLabels, [
    ['Locale switcher', 'Locale switcher'],
    ['Locale switcher'],
  ]);
} finally {
  await browser.close();
}

console.log('Widget Defaults panel projection behavior passed.');
