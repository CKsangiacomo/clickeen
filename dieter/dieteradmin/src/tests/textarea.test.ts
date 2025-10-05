import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

import gridHtml from '../html/candidates/textarea-grid.html?raw';
import errorHtml from '../html/candidates/textarea-state-error.html?raw';
import snippetHtml from '../html/candidates/textarea-snippet.html?raw';

const parse = (markup: string) =>
  new JSDOM(`<div id="root">${markup}</div>`).window.document.querySelector('#root')!;

describe('Textarea demos', () => {
  it('renders multiple resize options', () => {
    const fragment = parse(gridHtml);
    const textareas = fragment.querySelectorAll<HTMLTextAreaElement>('.diet-textarea__field');
    expect(textareas.length).toBeGreaterThanOrEqual(2);
  });

  it('ties error helper to textarea via aria-describedby', () => {
    const fragment = parse(errorHtml);
    const helper = fragment.querySelector('.diet-textarea__helper[data-tone="error"]');
    const textarea = fragment.querySelector<HTMLTextAreaElement>('.diet-textarea__field');
    expect(helper?.id).toBeTruthy();
    expect(textarea?.getAttribute('aria-describedby')).toBe(helper?.id ?? null);
  });

  it('includes snippet demonstrating long-form copy entry', () => {
    const fragment = parse(snippetHtml);
    const textarea = fragment.querySelector('.diet-textarea__field');
    expect(textarea).not.toBeNull();
    expect(textarea?.textContent?.length ?? textarea?.value?.length ?? 0).toBeGreaterThan(0);
  });
});
