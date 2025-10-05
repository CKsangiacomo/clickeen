import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Popover Component', () => {
  const cssPath = join(__dirname, '../css/components/overlays/popover.css');
  const htmlPath = join(__dirname, '../html/candidates/popover-grid.html');

  it('should have CSS with Dieter tokens', () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).toContain('--color-');
    expect(css).toContain('.diet-popover');
  });

  it('should have grid HTML with popover markup', () => {
    const html = readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('diet-popover');
  });

  it('should include placement variants', () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).toContain('data-placement');
  });
});
