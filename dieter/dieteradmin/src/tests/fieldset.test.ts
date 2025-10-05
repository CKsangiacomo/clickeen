import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Fieldset Component', () => {
  const cssPath = join(__dirname, '../css/components/forms/fieldset.css');
  const htmlPath = join(__dirname, '../html/candidates/fieldset-grid.html');

  it('should have CSS with Dieter tokens', () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).toContain('--color-');
    expect(css).toContain('.diet-fieldset');
  });

  it('should have grid HTML with fieldset and legend', () => {
    const html = readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('<fieldset');
    expect(html).toContain('<legend');
  });
});
