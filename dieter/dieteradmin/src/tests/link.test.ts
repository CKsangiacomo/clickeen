import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

import gridHtml from '../html/candidates/link-grid.html?raw';
import externalHtml from '../html/candidates/link-state-external.html?raw';
import focusHtml from '../html/candidates/link-state-focus.html?raw';
import snippetHtml from '../html/candidates/link-snippet.html?raw';

const parse = (markup: string) =>
  new JSDOM(`<div id="root">${markup}</div>`).window.document.querySelector('#root')!;

describe('Link demos', () => {
  it('renders variants for inline and standalone copy', () => {
    const fragment = parse(gridHtml);
    const links = fragment.querySelectorAll<HTMLAnchorElement>('.diet-link');
    expect(links.length).toBeGreaterThan(0);
    expect([...links].some((link) => link.dataset.variant === 'subtle')).toBe(true);
    expect([...links].some((link) => link.dataset.underline === 'hover')).toBe(true);
  });

  it('includes accessible copy for external links', () => {
    const fragment = parse(externalHtml);
    const link = fragment.querySelector<HTMLAnchorElement>('.diet-link');
    expect(link).not.toBeNull();
    const hidden = link?.querySelector('.visually-hidden');
    expect(hidden?.textContent?.toLowerCase()).toContain('opens in new tab');
  });

  it('demonstrates focus styling', () => {
    const fragment = parse(focusHtml);
    const links = fragment.querySelectorAll<HTMLAnchorElement>('.diet-link');
    expect(links.length).toBe(2);
  });

  it('provides snippet usage with multiple variants', () => {
    const fragment = parse(snippetHtml);
    const anchors = fragment.querySelectorAll<HTMLAnchorElement>('.diet-link');
    expect(anchors.length).toBeGreaterThanOrEqual(2);
  });
});
