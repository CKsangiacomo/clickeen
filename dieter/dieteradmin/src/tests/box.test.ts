import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

import gridHtml from '../html/candidates/box-grid.html?raw';
import narrowHtml from '../html/candidates/box-state-narrow.html?raw';
import contentHtml from '../html/candidates/box-state-content.html?raw';
import borderlessHtml from '../html/candidates/box-state-borderless.html?raw';

const parse = (markup: string) => new JSDOM(`<div id="root">${markup}</div>`).window.document.querySelector('#root')!;

describe('Box demos', () => {
  it('shows surface, padding, and size variants', () => {
    const fragment = parse(gridHtml);
    const boxes = fragment.querySelectorAll('.diet-box');
    expect(boxes.length).toBeGreaterThan(0);

    const sizes = new Set(Array.from(boxes).map((el) => el.getAttribute('data-padding')));
    expect(sizes.has('none')).toBe(true);
    expect(sizes.has('sm')).toBe(true);
    expect(sizes.has('md')).toBe(true);
    expect(sizes.has('lg')).toBe(true);

    const surfaces = Array.from(boxes).map((el) => el.getAttribute('data-surface'));
    expect(surfaces.includes('raised')).toBe(true);
    expect(surfaces.includes('sunken')).toBe(true);
  });

  it('renders narrow layout state', () => {
    const fragment = parse(narrowHtml);
    const narrow = fragment.querySelector('.diet-box[data-width="narrow"]');
    expect(narrow).not.toBeNull();
  });

  it('renders content width state', () => {
    const fragment = parse(contentHtml);
    const contentBox = fragment.querySelector('.diet-box[data-width="content"]');
    expect(contentBox).not.toBeNull();
  });

  it('renders borderless option', () => {
    const fragment = parse(borderlessHtml);
    const borderless = fragment.querySelector('.diet-box[data-border="none"]');
    expect(borderless).not.toBeNull();
  });
});
