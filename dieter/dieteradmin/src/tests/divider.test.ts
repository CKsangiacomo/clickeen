import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

import gridHtml from '../html/candidates/divider-grid.html?raw';
import verticalStateHtml from '../html/candidates/divider-state-vertical.html?raw';
import insetStateHtml from '../html/candidates/divider-state-inset.html?raw';
import strongStateHtml from '../html/candidates/divider-state-strong.html?raw';
import snippetHtml from '../html/candidates/divider-snippet.html?raw';

const parse = (markup: string) =>
  new JSDOM(`<div id="root">${markup}</div>`).window.document.querySelector('#root')!;

describe('Divider demos', () => {
  it('includes both horizontal and vertical examples in the grid', () => {
    const fragment = parse(gridHtml);
    const horizontal = fragment.querySelector('hr.diet-divider');
    expect(horizontal).not.toBeNull();
    const vertical = fragment.querySelector('.diet-divider[data-orientation="vertical"]');
    expect(vertical).not.toBeNull();
    expect(vertical?.getAttribute('role')).toBe('separator');
    expect(vertical?.getAttribute('aria-orientation')).toBe('vertical');
  });

  it('documents all thickness modifiers', () => {
    const fragment = parse(gridHtml);
    const modifiers = Array.from(
      fragment.querySelectorAll<HTMLElement>('.diet-divider[data-thickness]')
    ).map((node) => node.getAttribute('data-thickness'));
    expect(modifiers).toContain('hairline');
    expect(modifiers).toContain('medium');
    expect(modifiers).toContain('heavy');
  });

  it('highlights inset spacing guidance', () => {
    const fragment = parse(insetStateHtml);
    const inset = fragment.querySelector('.diet-divider[data-align="inset"]');
    expect(inset).not.toBeNull();
    expect(inset?.getAttribute('data-spacing')).toBe('lg');
  });

  it('demonstrates strong tone usage', () => {
    const fragment = parse(strongStateHtml);
    const strong = fragment.querySelector('.diet-divider[data-tone="strong"]');
    expect(strong).not.toBeNull();
    expect(strong?.getAttribute('data-thickness')).toBe('medium');
  });

  it('provides a snippet that uses Dieter primitives', () => {
    const fragment = parse(snippetHtml);
    expect(fragment.querySelector('.diet-container')).not.toBeNull();
    expect(fragment.querySelector('hr.diet-divider')).not.toBeNull();
  });

  it('renders toolbar state with vertical separator', () => {
    const fragment = parse(verticalStateHtml);
    const separator = fragment.querySelector('.diet-divider[data-orientation="vertical"]');
    expect(separator).not.toBeNull();
    const buttons = fragment.querySelectorAll('.diet-btn');
    expect(buttons.length).toBe(2);
  });
});
