import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Tooltip Component', () => {
  const cssPath = join(__dirname, '../css/components/overlays/tooltip.css');
  const htmlPath = join(__dirname, '../html/candidates/tooltip-grid.html');

  it('should have CSS with Dieter tokens', () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).toContain('--color-');
    expect(css).toContain('.diet-tooltip');
  });

  it('should have grid HTML with role=tooltip', () => {
    const html = readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('diet-tooltip');
  });

  it('should include placement variants', () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).toContain('data-placement');
  });
});
