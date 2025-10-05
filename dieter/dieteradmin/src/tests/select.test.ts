import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Select Component', () => {
  const cssPath = join(__dirname, '../css/components/forms/select.css');
  const htmlPath = join(__dirname, '../html/candidates/select-grid.html');

  it('should have CSS with Dieter tokens', () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).toContain('--color-');
    expect(css).toContain('.diet-select');
  });

  it('should have grid HTML with native select', () => {
    const html = readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('<select');
    expect(html).toContain('diet-select__native');
  });

  it('should include focus styles', () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).toContain(':focus');
  });
});
