import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Modal Component', () => {
  const cssPath = join(__dirname, '../css/components/overlays/modal.css');
  const htmlPath = join(__dirname, '../html/candidates/modal-grid.html');

  it('should have CSS with Dieter tokens', () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).toContain('--color-bg');
    expect(css).toContain('.diet-modal');
  });

  it('should have grid HTML with role=dialog', () => {
    const html = readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal');
  });

  it('should include size variants', () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).toContain('data-size');
  });
});
