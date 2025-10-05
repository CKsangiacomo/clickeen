import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('RadioGroup Component', () => {
  const cssPath = join(__dirname, '../css/components/forms/radiogroup.css');
  const htmlPath = join(__dirname, '../html/candidates/radiogroup-grid.html');

  it('should have CSS with Dieter tokens', () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).toContain('--color-system-blue');
    expect(css).toContain('.diet-radiogroup');
    expect(css).toContain('.diet-radio');
  });

  it('should have grid HTML demo with role=radiogroup', () => {
    const html = readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('type="radio"');
    expect(html).toContain('diet-radio__circle');
  });

  it('should include :checked state', () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).toContain(':checked');
  });
});
