import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const HTML_PATH = new URL('./dev-widget-workspace.html', import.meta.url);
const HTML_SOURCE = readFileSync(HTML_PATH, 'utf8');

describe('DevStudio widget workspace tool', () => {
  it('is deprecated (static notice; no iframe integration)', () => {
    const dom = new JSDOM(HTML_SOURCE, {
      url: 'http://localhost:5173/#/tools/dev-widget-workspace',
    });

    const heading = dom.window.document.querySelector('h1');
    expect(heading?.textContent || '').toContain('Widget Workspace');

    const pill = dom.window.document.querySelector('.dev-widget-workspace-deprecated__pill');
    expect(pill?.textContent || '').toContain('Deprecated');

    expect(dom.window.document.getElementById('bob-iframe')).toBeNull();
    expect(HTML_SOURCE).not.toContain('type="module"');

    dom.window.close();
  });
});

