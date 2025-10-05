import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Switch Component', () => {
  const cssPath = join(__dirname, '../css/components/forms/switch.css');
  const htmlPath = join(__dirname, '../html/candidates/switch-grid.html');

  it('should have CSS with Dieter tokens', () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).toContain('--color-accent');
    expect(css).toContain('.diet-switch');
    expect(css).toContain('diet-switch__track');
  });

  it('should have grid HTML with role=switch', () => {
    const html = readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('role="switch"');
    expect(html).toContain('type="checkbox"');
  });

  it('should include checked state', () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).toContain(':checked');
  });
});
