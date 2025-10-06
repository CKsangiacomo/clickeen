import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

import markup from '../html/candidates/input.html?raw';

const dom = new JSDOM(`<div id="root">${markup}</div>`);
const root = dom.window.document.querySelector('#root')!;

describe('Input preview', () => {
  it('renders rows for rich, standard, bare types with sm/md/lg tiles', () => {
    const rows = Array.from(root.querySelectorAll('.dieter-preview__row'));
    expect(rows.length).toBeGreaterThanOrEqual(4);

    const richRow = rows.find((row) => row.querySelector('h4')?.textContent?.includes('Icon + affixes'));
    expect(richRow).toBeTruthy();
    const richSizes = new Set(
      Array.from(richRow!.querySelectorAll('.diet-input[data-size]')).map((node) => node.getAttribute('data-size')),
    );
    expect(richSizes.has('sm')).toBe(true);
    expect(richSizes.has('md')).toBe(true);
    expect(richSizes.has('lg')).toBe(true);
  });

  it('links helper text via aria-describedby in the default composition', () => {
    const field = root.querySelector<HTMLInputElement>('#input-rich-md');
    expect(field).not.toBeNull();
    const helperId = field?.getAttribute('aria-describedby');
    expect(helperId).toBeTruthy();
    if (helperId) {
      const helper = root.querySelector(`#${helperId}`);
      expect(helper?.classList.contains('diet-input__helper')).toBe(true);
    }
  });

  it('shows error, read-only, and disabled states inside the matrix', () => {
    const error = root.querySelector('.diet-input[data-state="error"]');
    const disabled = root.querySelector('.diet-input[data-state="disabled"]');
    const readonlyField = root.querySelector<HTMLInputElement>('.diet-input input[readonly]');
    expect(error).not.toBeNull();
    expect(disabled).not.toBeNull();
    expect(readonlyField).not.toBeNull();
  });

  it('provides a snippet section below the matrix', () => {
    const snippet = root.querySelector('[data-demo="snippets"]');
    expect(snippet).not.toBeNull();
    const inputs = snippet?.querySelectorAll('.diet-input');
    expect((inputs?.length ?? 0) > 0).toBe(true);
  });
});
