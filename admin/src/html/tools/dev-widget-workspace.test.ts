import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const HTML_PATH = new URL('./dev-widget-workspace.html', import.meta.url);
const HTML_SOURCE = readFileSync(HTML_PATH, 'utf8');

describe('DevStudio widget workspace tool', () => {
  it('renders the local-first workspace shell', () => {
    const dom = new JSDOM(HTML_SOURCE, {
      url: 'http://localhost:5173/#/dieter/dev-widget-workspace',
    });

    const heading = dom.window.document.querySelector('h1');
    expect(heading?.textContent || '').toContain('Widget Workspace');

    const pill = dom.window.document.querySelector('.workspace-tool__pill');
    expect(pill?.textContent || '').toContain('Zero-to-one workspace');

    expect(dom.window.document.getElementById('workspace-widget-slug')).not.toBeNull();
    expect(dom.window.document.getElementById('workspace-source-select')).not.toBeNull();
    expect(dom.window.document.getElementById('bob-iframe')).not.toBeNull();
    expect(HTML_SOURCE).toContain('type="module"');
    expect(HTML_SOURCE).toContain('resolveRuntimeProfile');
    expect(HTML_SOURCE).not.toContain('Deprecated');

    dom.window.close();
  });
});
