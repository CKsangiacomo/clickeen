import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Checkbox Component', () => {
  const cssPath = join(__dirname, '../css/components/forms/checkbox.css');
  const htmlPath = join(__dirname, '../html/candidates/checkbox-grid.html');

  it('should have CSS file with Dieter tokens', () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).toContain('--color-system-blue');
    expect(css).toContain('--color-system-gray');
    expect(css).toContain('--space-');
    expect(css).toContain('.diet-checkbox');
  });

  it('should have grid HTML demo', () => {
    const html = readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('diet-checkbox');
    expect(html).toContain('diet-checkbox__input');
    expect(html).toContain('diet-checkbox__box');
    expect(html).toContain('type="checkbox"');
  });

  it('should include size variants in CSS', () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).toContain('data-size="sm"');
    expect(css).toContain('data-size="md"');
    expect(css).toContain('data-size="lg"');
  });

  it('should have accessibility attributes in HTML', () => {
    const html = readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('aria-');
  });

  it('should include checked and indeterminate states in CSS', () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).toContain(':checked');
    expect(css).toContain(':indeterminate');
  });

  it('should have focus-visible styles', () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('--focus-ring');
  });

  it('should have disabled state styles', () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).toContain(':disabled');
  });

  it('should use only Dieter tokens for colors', () => {
    const css = readFileSync(cssPath, 'utf-8');
    // Should not have hardcoded hex colors except in fallbacks
    const hexMatches = css.match(/#[0-9a-fA-F]{6}/g) || [];
    expect(hexMatches.length).toBeLessThan(5); // Allow a few fallbacks
  });
});
