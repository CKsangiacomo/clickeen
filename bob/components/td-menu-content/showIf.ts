import {
  evaluateShowIfExpression,
  parseShowIfExpression,
  type ShowIfAst,
} from '../../lib/show-if-expression';

export type { ShowIfAst };

export type ShowIfEntry = {
  el: HTMLElement;
  ast: ShowIfAst | null;
  raw: string;
};

export function buildShowIfEntries(container: HTMLElement): ShowIfEntry[] {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>('[data-bob-showif]'));
  const entries: ShowIfEntry[] = [];
  nodes.forEach((node) => {
    const raw = node.getAttribute('data-bob-showif') || '';
    if (!raw.trim()) return;
    const ast = parseShowIfExpression(raw);
    entries.push({ el: node, ast, raw });
  });
  return entries;
}

export function applyShowIfVisibility(entries: ShowIfEntry[], data: Record<string, unknown>) {
  entries.forEach((entry) => {
    const isVisible = entry.ast ? evaluateShowIfExpression(entry.ast, data) : true;
    entry.el.toggleAttribute('hidden', !isVisible);
    entry.el.setAttribute('style', isVisible ? '' : 'display: none;');
  });
}
