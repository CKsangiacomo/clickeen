import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

import gridHtml from '../html/candidates/spinner-grid.html?raw';
import labeledHtml from '../html/candidates/spinner-state-labeled.html?raw';
import inlineHtml from '../html/candidates/spinner-state-inline.html?raw';
import snippetHtml from '../html/candidates/spinner-snippet.html?raw';

const parse = (markup: string) =>
  new JSDOM(`<div id="root">${markup}</div>`).window.document.querySelector('#root')!;

describe('Spinner demos', () => {
  it('renders size presets with tone variations', () => {
    const fragment = parse(gridHtml);
    const spinners = fragment.querySelectorAll<HTMLDivElement>('.diet-spinner');
    expect(spinners.length).toBeGreaterThanOrEqual(3);
    const sizes = new Set([...spinners].map((node) => node.getAttribute('data-size')));
    expect(sizes.has('sm')).toBe(true);
    expect(sizes.has('md') || sizes.has(null)).toBe(true);
    expect(sizes.has('lg')).toBe(true);
  });

  it('provides labelled status for screen readers', () => {
    const fragment = parse(labeledHtml);
    const spinner = fragment.querySelector<HTMLDivElement>('.diet-spinner');
    expect(spinner?.getAttribute('role')).toBe('status');
    const sr = spinner?.querySelector('.visually-hidden');
    expect(sr?.textContent?.length).toBeGreaterThan(0);
  });

  it('shows inline layout with copy', () => {
    const fragment = parse(inlineHtml);
    const inline = fragment.querySelector<HTMLDivElement>('.diet-spinner[data-layout="inline"]');
    expect(inline).not.toBeNull();
    expect(inline?.querySelector<HTMLSpanElement>('span')?.textContent).toContain('Syncing');
  });

  it('includes snippet for uploads', () => {
    const fragment = parse(snippetHtml);
    const spinner = fragment.querySelector<HTMLDivElement>('.diet-spinner');
    expect(spinner).not.toBeNull();
  });
});
