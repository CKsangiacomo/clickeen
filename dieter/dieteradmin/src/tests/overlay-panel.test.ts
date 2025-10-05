import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('OverlayPanel Component', () => {
  const cssPath = join(__dirname, '../css/components/overlays/overlay-panel.css');
  const htmlPath = join(__dirname, '../html/candidates/overlay-panel-grid.html');

  it('should have CSS with Dieter tokens', () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).toContain('--color-');
    expect(css).toContain('.diet-overlay-panel');
  });

  it('should have grid HTML with role=dialog', () => {
    const html = readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('diet-overlay-panel');
  });

  it('should include position variants', () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).toContain('data-position');
  });
});
